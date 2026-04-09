import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.product import Product
from app.models.stock_movement import StockMovement


class ProductRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all(
        self,
        search: str | None = None,
        category_id: uuid.UUID | None = None,
        low_stock: bool = False,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[Product], int]:
        query = (
            select(Product)
            .options(selectinload(Product.category), selectinload(Product.supplier))
            .where(Product.is_active == True)  # noqa: E712
        )
        if search:
            query = query.where(Product.name.ilike(f"%{search}%") | Product.sku.ilike(f"%{search}%"))
        if category_id:
            query = query.where(Product.category_id == category_id)
        if low_stock:
            query = query.where(Product.current_stock <= Product.low_stock_threshold)

        count_query = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_query)).scalar_one()

        result = await self.db.execute(query.offset(offset).limit(limit))
        return result.scalars().all(), total

    async def get_by_id(self, product_id: uuid.UUID) -> Product | None:
        result = await self.db.execute(
            select(Product)
            .options(selectinload(Product.category), selectinload(Product.supplier))
            .where(Product.id == product_id)
        )
        return result.scalar_one_or_none()

    async def get_by_sku(self, sku: str) -> Product | None:
        result = await self.db.execute(select(Product).where(Product.sku == sku))
        return result.scalar_one_or_none()

    async def get_movements(self, product_id: uuid.UUID) -> list[StockMovement]:
        result = await self.db.execute(
            select(StockMovement)
            .where(StockMovement.product_id == product_id)
            .order_by(StockMovement.created_at.desc())
        )
        return result.scalars().all()
