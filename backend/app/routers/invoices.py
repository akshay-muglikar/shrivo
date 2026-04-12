import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.pagination import PageParams
from app.database import get_db, session_transaction
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.invoice import InvoiceCreate, InvoiceListItem, InvoiceRead, InvoiceUpdate
from app.services import invoice_service

router = APIRouter(prefix="/invoices", tags=["invoices"])


@router.get("", response_model=dict)
async def list_invoices(
    search: str | None = Query(None),
    status: str | None = Query(None),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    page: PageParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    items, total = await invoice_service.get_all(
        db,
        search,
        status,
        start_date,
        end_date,
        page.offset,
        page.limit,
    )
    return {
        "total": total,
        "page": page.page,
        "limit": page.limit,
        "items": [InvoiceListItem.model_validate(i) for i in items],
    }


@router.post("", response_model=InvoiceRead, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    body: InvoiceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    async with session_transaction(db):
        invoice = await invoice_service.create(db, body, current_user.id)
    return InvoiceRead.model_validate(invoice)


@router.get("/{invoice_id}", response_model=InvoiceRead)
async def get_invoice(
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    invoice = await invoice_service.get_by_id(db, invoice_id)
    return InvoiceRead.model_validate(invoice)


@router.patch("/{invoice_id}", response_model=InvoiceRead)
async def update_invoice(
    invoice_id: uuid.UUID,
    body: InvoiceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    async with session_transaction(db):
        invoice = await invoice_service.update(db, invoice_id, body, current_user.id)
    return InvoiceRead.model_validate(invoice)
