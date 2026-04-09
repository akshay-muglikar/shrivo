import uuid
from datetime import date

from app.core.exceptions import AppException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expense import Expense
from app.repositories.expense_repository import ExpenseRepository
from app.schemas.expense import ExpenseCreate, ExpenseUpdate


async def get_all(
    db: AsyncSession,
    search: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[Expense], int]:
    return await ExpenseRepository(db).get_all(search, start_date, end_date, offset, limit)


async def get_by_id(db: AsyncSession, expense_id: str) -> Expense:
    expense = await ExpenseRepository(db).get_by_id(expense_id)
    if not expense:
        raise AppException(status_code=404, detail="Expense not found")
    return expense


async def create(db: AsyncSession, data: ExpenseCreate, created_by_id: uuid.UUID) -> Expense:
    expense = Expense(
        title=data.title.strip(),
        category=data.category.strip() if data.category else None,
        amount=data.amount,
        expense_date=data.expense_date,
        notes=data.notes.strip() if data.notes else None,
        created_by_id=created_by_id,
    )
    db.add(expense)
    await db.flush()
    await db.refresh(expense)
    return expense


async def update(db: AsyncSession, expense_id: str, data: ExpenseUpdate) -> Expense:
    expense = await get_by_id(db, expense_id)
    updates = data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        if field in {"title", "category", "notes"}:
            value = value.strip() if value else None
        setattr(expense, field, value)
    await db.flush()
    await db.refresh(expense)
    return expense