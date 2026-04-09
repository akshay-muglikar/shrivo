import uuid
from datetime import date, datetime, time, timedelta

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.customer import Customer
from app.models.invoice import Invoice


class InvoiceRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _with_relations(self, query):
        return query.options(
            selectinload(Invoice.customer),
            selectinload(Invoice.items),
        )

    async def get_all(
        self,
        search: str | None = None,
        status: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[Invoice], int]:
        query = (
            select(Invoice)
            .outerjoin(Customer, Invoice.customer_id == Customer.id)
            .options(selectinload(Invoice.customer))
        )
        if search:
            term = f"%{search}%"
            query = query.where(
                or_(
                    Invoice.invoice_number.ilike(term),
                    Invoice.walk_in_customer_name.ilike(term),
                    Invoice.walk_in_customer_phone.ilike(term),
                    Customer.name.ilike(term),
                    Customer.phone.ilike(term),
                )
            )
        if status:
            query = query.where(Invoice.status == status)
        if start_date:
            query = query.where(
                Invoice.created_at >= datetime.combine(start_date, time.min)
            )
        if end_date:
            query = query.where(
                Invoice.created_at < datetime.combine(end_date + timedelta(days=1), time.min)
            )

        count_q = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_q)).scalar_one()

        query = query.order_by(Invoice.created_at.desc()).offset(offset).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all(), total

    async def get_by_id(self, invoice_id: uuid.UUID) -> Invoice | None:
        result = await self.db.execute(
            self._with_relations(select(Invoice).where(Invoice.id == invoice_id))
        )
        return result.scalar_one_or_none()

    async def next_invoice_number(self) -> str:
        result = await self.db.execute(select(func.count()).select_from(Invoice))
        count = result.scalar_one()
        return f"INV-{count + 1:04d}"
