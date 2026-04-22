import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException
from app.models.product import Product, UnitOfMeasure
from app.models.product_batch import ProductBatch
from app.models.stock_movement import MovementType, StockMovement
from app.repositories.product_repository import ProductRepository
from app.schemas.product import ProductCreate, ProductUpdate


async def get_all(
    db: AsyncSession,
    search: str | None,
    category_id: uuid.UUID | None,
    low_stock: bool,
    offset: int,
    limit: int,
    sort_by: str | None = None,
) -> tuple[list[Product], int]:
    return await ProductRepository(db).get_all(search, category_id, low_stock, offset, limit, sort_by)


async def get_by_id(db: AsyncSession, product_id: uuid.UUID) -> Product:
    product = await ProductRepository(db).get_by_id(product_id)
    if not product:
        raise AppException(status_code=404, detail="Product not found")
    return product


async def create(db: AsyncSession, data: ProductCreate) -> Product:
    repo = ProductRepository(db)
    if await repo.get_by_sku(data.sku):
        raise AppException(status_code=409, detail=f"SKU '{data.sku}' already exists")

    product = Product(**data.model_dump())
    db.add(product)
    await db.flush()
    return await repo.get_by_id(product.id)


async def update(db: AsyncSession, product_id: uuid.UUID, data: ProductUpdate) -> Product:
    product = await get_by_id(db, product_id)
    update_data = data.model_dump(exclude_unset=True)

    if update_data.get("sku") and update_data["sku"] != product.sku:
        existing = await ProductRepository(db).get_by_sku(update_data["sku"])
        if existing and existing.id != product.id:
            raise AppException(status_code=409, detail=f"SKU '{update_data['sku']}' already exists")

    for field, value in update_data.items():
        setattr(product, field, value)
    await db.flush()
    return await ProductRepository(db).get_by_id(product_id)


async def delete(db: AsyncSession, product_id: uuid.UUID) -> None:
    product = await get_by_id(db, product_id)
    product.is_active = False
    await db.flush()


async def adjust_stock(
    db: AsyncSession,
    product_id: uuid.UUID,
    delta: int,
    movement_type: MovementType,
    created_by_id: uuid.UUID | None = None,
    reference_id: uuid.UUID | None = None,
    notes: str | None = None,
    new_cost_price: Decimal | None = None,
    batch_id: uuid.UUID | None = None,
) -> Product:
    """
    Single entry point for ALL stock changes.
    Updates current_stock and inserts a StockMovement in one transaction.
    """
    product = await get_by_id(db, product_id)

    new_stock = product.current_stock + delta
    if new_stock < 0:
        raise AppException(
            status_code=400,
            detail=f"Insufficient stock. Available: {product.current_stock}, requested: {abs(delta)}",
        )

    product.current_stock = new_stock
    if new_cost_price is not None:
        product.cost_price = new_cost_price

    movement = StockMovement(
        product_id=product_id,
        movement_type=movement_type.value,
        quantity_delta=delta,
        reference_id=reference_id,
        batch_id=batch_id,
        notes=notes,
        created_by_id=created_by_id,
    )
    db.add(movement)
    await db.flush()
    await db.refresh(product)
    return product


async def create_batch(
    db: AsyncSession,
    product_id: uuid.UUID,
    quantity: int,
    created_by_id: uuid.UUID,
    batch_number: str | None = None,
    expiry_date: date | None = None,
    cost_price: Decimal | None = None,
    reference_id: uuid.UUID | None = None,
    notes: str | None = None,
) -> tuple[Product, ProductBatch]:
    """Create a new batch record and perform a STOCK_IN movement."""
    batch = ProductBatch(
        product_id=product_id,
        batch_number=batch_number,
        expiry_date=expiry_date,
        quantity_remaining=quantity,
        cost_price=cost_price,
        created_by_id=created_by_id,
        notes=notes,
    )
    db.add(batch)
    await db.flush()  # get batch.id

    product = await adjust_stock(
        db,
        product_id=product_id,
        delta=quantity,
        movement_type=MovementType.STOCK_IN,
        created_by_id=created_by_id,
        reference_id=reference_id,
        notes=notes,
        new_cost_price=cost_price,
        batch_id=batch.id,
    )
    return product, batch


async def get_active_batches_fefo(
    db: AsyncSession, product_id: uuid.UUID
) -> list[ProductBatch]:
    """Return batches with stock remaining, ordered earliest-expiry-first (FEFO).
    Batches with no expiry date come last."""
    result = await db.execute(
        select(ProductBatch)
        .where(
            ProductBatch.product_id == product_id,
            ProductBatch.quantity_remaining > 0,
        )
        .order_by(ProductBatch.expiry_date.asc().nulls_last())
    )
    return list(result.scalars().all())


async def get_batches(
    db: AsyncSession, product_id: uuid.UUID
) -> list[ProductBatch]:
    """Return ALL batches for a product (including exhausted ones), newest first."""
    await get_by_id(db, product_id)  # ensure exists
    result = await db.execute(
        select(ProductBatch)
        .where(ProductBatch.product_id == product_id)
        .order_by(ProductBatch.created_at.desc())
    )
    return list(result.scalars().all())


async def get_movements(db: AsyncSession, product_id: uuid.UUID) -> list[StockMovement]:
    await get_by_id(db, product_id)  # ensure exists
    return await ProductRepository(db).get_movements(product_id)


async def get_all_batches(
    db: AsyncSession,
    status: str | None,   # "expired" | "expiring_soon" | "ok" | None (all)
    search: str | None,
    offset: int,
    limit: int,
) -> tuple[list[tuple[ProductBatch, Product]], int]:
    """Return in-stock batches (with parent product) across the store, filtered by expiry status."""
    from datetime import date as date_type
    from sqlalchemy import and_, func as sa_func, or_

    today = date_type.today()
    soon_threshold = today.__class__.fromordinal(today.toordinal() + 30)

    query = (
        select(ProductBatch, Product)
        .join(Product, ProductBatch.product_id == Product.id)
        .where(
            Product.is_active == True,  # noqa: E712
            ProductBatch.quantity_remaining > 0,
        )
    )

    if search:
        term = f"%{search}%"
        query = query.where(
            or_(
                Product.name.ilike(term),
                Product.sku.ilike(term),
                ProductBatch.batch_number.ilike(term),
            )
        )

    if status == "expired":
        query = query.where(
            and_(ProductBatch.expiry_date.is_not(None), ProductBatch.expiry_date < today)
        )
    elif status == "expiring_soon":
        query = query.where(
            and_(
                ProductBatch.expiry_date.is_not(None),
                ProductBatch.expiry_date >= today,
                ProductBatch.expiry_date <= soon_threshold,
            )
        )
    elif status == "ok":
        query = query.where(
            or_(
                ProductBatch.expiry_date.is_(None),
                ProductBatch.expiry_date > soon_threshold,
            )
        )

    count_q = select(sa_func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar_one()

    query = query.order_by(ProductBatch.expiry_date.asc().nulls_last()).offset(offset).limit(limit)
    result = await db.execute(query)
    rows = result.all()
    return [(batch, product) for batch, product in rows], total
