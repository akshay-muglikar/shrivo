from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.pagination import PageParams
from app.database import get_db, session_transaction
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.expense import ExpenseCreate, ExpenseRead, ExpenseUpdate
from app.services import expense_service

router = APIRouter(prefix="/expenses", tags=["expenses"])


@router.get("", response_model=dict)
async def list_expenses(
    search: str | None = Query(None),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    page: PageParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    items, total = await expense_service.get_all(
        db,
        search,
        start_date,
        end_date,
        page.offset,
        page.limit,
    )
    return {
        "total": total,
        "page": page.page,
        "limit": page.limit,
        "items": [ExpenseRead.model_validate(expense) for expense in items],
    }


@router.post("", response_model=ExpenseRead, status_code=status.HTTP_201_CREATED)
async def create_expense(
    body: ExpenseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    async with session_transaction(db):
        expense = await expense_service.create(db, body, current_user.id)
    return ExpenseRead.model_validate(expense)


@router.put("/{expense_id}", response_model=ExpenseRead)
async def update_expense(
    expense_id: str,
    body: ExpenseUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    async with session_transaction(db):
        expense = await expense_service.update(db, expense_id, body)
    return ExpenseRead.model_validate(expense)