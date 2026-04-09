from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.pagination import PageParams
from app.database import get_db, session_transaction
from app.dependencies import get_current_user
from app.schemas.customer import CustomerCreate, CustomerRead, CustomerUpdate
from app.schemas.invoice import InvoiceListItem
from app.services import customer_service

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("", response_model=dict)
async def list_customers(
    search: str | None = Query(None),
    page: PageParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    items, total = await customer_service.get_page(db, search, page.offset, page.limit)
    return {
        "total": total,
        "page": page.page,
        "limit": page.limit,
        "items": [CustomerRead.model_validate(customer) for customer in items],
    }


@router.post("", response_model=CustomerRead, status_code=status.HTTP_201_CREATED)
async def create_customer(
    body: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    async with session_transaction(db):
        customer = await customer_service.create(db, body)
    return CustomerRead.model_validate(customer)


@router.put("/{customer_id}", response_model=CustomerRead)
async def update_customer(
    customer_id: str,
    body: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    async with session_transaction(db):
        customer = await customer_service.update(db, customer_id, body)
    return CustomerRead.model_validate(customer)


@router.get("/{customer_id}/invoices", response_model=list[InvoiceListItem])
async def get_customer_invoice_history(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    return await customer_service.get_invoice_history(db, customer_id)
