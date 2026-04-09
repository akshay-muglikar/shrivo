import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException
from app.models.customer import Customer
from app.repositories.customer_repository import CustomerRepository
from app.schemas.customer import CustomerCreate, CustomerUpdate
from app.schemas.invoice import InvoiceListItem


async def get_all(db: AsyncSession, search: str | None = None) -> list[Customer]:
    items, _ = await CustomerRepository(db).get_all(search, 0, 500)
    return items


async def get_page(
    db: AsyncSession,
    search: str | None = None,
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[Customer], int]:
    return await CustomerRepository(db).get_all(search, offset, limit)


async def get_by_id(db: AsyncSession, customer_id: uuid.UUID) -> Customer:
    customer = await CustomerRepository(db).get_by_id(customer_id)
    if not customer:
        raise AppException(status_code=404, detail="Customer not found")
    return customer


async def create(db: AsyncSession, data: CustomerCreate) -> Customer:
    customer = Customer(**data.model_dump())
    db.add(customer)
    await db.flush()
    await db.refresh(customer)
    return customer


async def update(db: AsyncSession, customer_id: uuid.UUID, data: CustomerUpdate) -> Customer:
    customer = await get_by_id(db, customer_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(customer, field, value)
    await db.flush()
    await db.refresh(customer)
    return customer


async def get_invoice_history(db: AsyncSession, customer_id: uuid.UUID) -> list[InvoiceListItem]:
    customer = await get_by_id(db, customer_id)
    invoices = await CustomerRepository(db).get_invoice_history(customer.id)
    return [InvoiceListItem.model_validate(invoice) for invoice in invoices]


async def get_or_create_by_phone(
    db: AsyncSession, phone: str, name: str
) -> Customer:
    """Look up a customer by phone number; create one if not found."""
    repo = CustomerRepository(db)
    customer = await repo.get_by_phone(phone)
    if customer:
        return customer
    customer = Customer(name=name, phone=phone)
    db.add(customer)
    await db.flush()
    await db.refresh(customer)
    return customer
