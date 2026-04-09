from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expense import Expense


class ExpenseRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all(
        self,
        search: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[Expense], int]:
        query = select(Expense).order_by(Expense.expense_date.desc(), Expense.created_at.desc())
        if search:
            term = f"%{search}%"
            query = query.where(
                or_(
                    Expense.title.ilike(term),
                    Expense.category.ilike(term),
                    Expense.notes.ilike(term),
                )
            )
        if start_date:
            query = query.where(Expense.expense_date >= start_date)
        if end_date:
            query = query.where(Expense.expense_date <= end_date)

        count_q = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_q)).scalar_one()

        result = await self.db.execute(query.offset(offset).limit(limit))
        return result.scalars().all(), total

    async def get_by_id(self, expense_id: str) -> Expense | None:
        result = await self.db.execute(select(Expense).where(Expense.id == expense_id))
        return result.scalar_one_or_none()