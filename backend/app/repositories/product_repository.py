import uuid

from sqlalchemy import asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.product import Product
from app.models.stock_movement import StockMovement

_SORT_MAP = {
    "name_asc": asc(Product.name),
    "name_desc": desc(Product.name),
    "stock_asc": asc(Product.current_stock),
    "stock_desc": desc(Product.current_stock),
    "price_asc": asc(Product.selling_price),
    "price_desc": desc(Product.selling_price),
}


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
        sort_by: str | None = None,
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

        order = _SORT_MAP.get(sort_by or "", asc(Product.name))
        query = query.order_by(order)

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

    async def get_by_ids(self, product_ids: list[uuid.UUID]) -> dict[uuid.UUID, Product]:
        result = await self.db.execute(
            select(Product).where(Product.id.in_(product_ids))
        )
        return {p.id: p for p in result.scalars().all()}

    async def get_movements(self, product_id: uuid.UUID, limit: int = 200) -> list[StockMovement]:
        result = await self.db.execute(
            select(StockMovement)
            .where(StockMovement.product_id == product_id)
            .order_by(StockMovement.created_at.desc())
            .limit(limit)
        )
        return result.scalars().all()
