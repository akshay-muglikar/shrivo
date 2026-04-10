import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.pagination import PageParams
from app.database import get_db, session_transaction
from app.dependencies import get_current_user
from app.models.stock_movement import MovementType
from app.models.user import User
from app.schemas.product import (
    ProductCreate,
    ProductRead,
    ProductUpdate,
    StockAdjustRequest,
    StockInRequest,
    StockMovementRead,
)
from app.services import product_service

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=dict)
async def list_products(
    search: str | None = Query(None),
    category_id: uuid.UUID | None = Query(None),
    low_stock: bool = Query(False),
    sort_by: str | None = Query(None, pattern="^(name|stock|price)_(asc|desc)$"),
    page: PageParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    items, total = await product_service.get_all(db, search, category_id, low_stock, page.offset, page.limit, sort_by)
    return {"total": total, "page": page.page, "limit": page.limit, "items": [ProductRead.model_validate(p) for p in items]}


@router.post("", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
async def create_product(body: ProductCreate, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    async with session_transaction(db):
        product = await product_service.create(db, body)
    return ProductRead.model_validate(product)


@router.get("/{product_id}", response_model=ProductRead)
async def get_product(product_id: uuid.UUID, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    return await product_service.get_by_id(db, product_id)


@router.put("/{product_id}", response_model=ProductRead)
async def update_product(product_id: uuid.UUID, body: ProductUpdate, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    async with session_transaction(db):
        product = await product_service.update(db, product_id, body)
    return ProductRead.model_validate(product)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(product_id: uuid.UUID, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    async with session_transaction(db):
        await product_service.delete(db, product_id)


@router.post("/{product_id}/stock-in", response_model=ProductRead)
async def stock_in(
    product_id: uuid.UUID,
    body: StockInRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    async with session_transaction(db):
        product = await product_service.adjust_stock(
            db,
            product_id=product_id,
            delta=body.quantity,
            movement_type=MovementType.STOCK_IN,
            created_by_id=current_user.id,
            notes=body.notes,
            new_cost_price=body.cost_price,
        )
    return ProductRead.model_validate(product)


@router.post("/{product_id}/adjust", response_model=ProductRead)
async def adjust_stock(
    product_id: uuid.UUID,
    body: StockAdjustRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    async with session_transaction(db):
        product = await product_service.adjust_stock(
            db,
            product_id=product_id,
            delta=body.delta,
            movement_type=MovementType.ADJUSTMENT,
            created_by_id=current_user.id,
            notes=body.reason,
        )
    return ProductRead.model_validate(product)


@router.get("/{product_id}/movements", response_model=list[StockMovementRead])
async def get_movements(product_id: uuid.UUID, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    movements = await product_service.get_movements(db, product_id)
    return [StockMovementRead.model_validate(m) for m in movements]
