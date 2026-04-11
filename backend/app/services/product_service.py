import uuid
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException
from app.models.product import Product, UnitOfMeasure
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
        notes=notes,
        created_by_id=created_by_id,
    )
    db.add(movement)
    await db.flush()
    await db.refresh(product)
    return product


async def get_movements(db: AsyncSession, product_id: uuid.UUID) -> list[StockMovement]:
    await get_by_id(db, product_id)  # ensure exists
    return await ProductRepository(db).get_movements(product_id)
