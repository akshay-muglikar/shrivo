import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer
from app.models.invoice import Invoice


class CustomerRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all(
        self,
        search: str | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[Customer], int]:
        query = select(Customer).order_by(Customer.name)
        if search:
            query = query.where(
                Customer.name.ilike(f"%{search}%") | Customer.phone.ilike(f"%{search}%")
            )

        count_q = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_q)).scalar_one()

        result = await self.db.execute(query.offset(offset).limit(limit))
        return result.scalars().all(), total

    async def get_by_id(self, customer_id: uuid.UUID) -> Customer | None:
        result = await self.db.execute(select(Customer).where(Customer.id == customer_id))
        return result.scalar_one_or_none()

    async def get_by_phone(self, phone: str) -> Customer | None:
        result = await self.db.execute(select(Customer).where(Customer.phone == phone))
        return result.scalar_one_or_none()

    async def get_invoice_history(self, customer_id: uuid.UUID) -> list[Invoice]:
        result = await self.db.execute(
            select(Invoice)
            .where(Invoice.customer_id == customer_id)
            .order_by(Invoice.created_at.desc())
        )
        return result.scalars().all()
