import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException
from app.models.invoice import Invoice, InvoiceItem
from app.models.stock_movement import MovementType
from app.repositories.invoice_repository import InvoiceRepository
from app.schemas.invoice import InvoiceCreate, InvoiceUpdate
from app.services import customer_service, product_service


async def get_all(
    db: AsyncSession,
    search: str | None,
    status: str | None,
    start_date: date | None,
    end_date: date | None,
    offset: int,
    limit: int,
) -> tuple[list[Invoice], int]:
    return await InvoiceRepository(db).get_all(search, status, start_date, end_date, offset, limit)


async def get_by_id(db: AsyncSession, invoice_id: uuid.UUID) -> Invoice:
    invoice = await InvoiceRepository(db).get_by_id(invoice_id)
    if not invoice:
        raise AppException(status_code=404, detail="Invoice not found")
    return invoice


async def create(db: AsyncSession, data: InvoiceCreate, created_by_id: uuid.UUID) -> Invoice:
    if not data.items:
        raise AppException(status_code=400, detail="Invoice must have at least one item")

    product_ids = [item.product_id for item in data.items]
    if len(product_ids) != len(set(product_ids)):
        raise AppException(status_code=400, detail="Duplicate products are not allowed in one invoice")

    walk_in_name = data.walk_in_customer_name.strip() if data.walk_in_customer_name else None
    walk_in_phone = data.walk_in_customer_phone.strip() if data.walk_in_customer_phone else None

    if data.customer_id is not None:
        resolved_customer = await customer_service.get_by_id(db, data.customer_id)
    elif walk_in_name or walk_in_phone:
        # Save walk-in as a customer record, using phone as the unique key
        if walk_in_phone:
            resolved_customer = await customer_service.get_or_create_by_phone(
                db, walk_in_phone, walk_in_name or "Walk-in"
            )
        else:
            from app.schemas.customer import CustomerCreate
            resolved_customer = await customer_service.create(
                db, CustomerCreate(name=walk_in_name)
            )
    else:
        raise AppException(status_code=400, detail="Provide a customer, or enter a name or mobile number")

    repo = InvoiceRepository(db)
    invoice_number = await repo.next_invoice_number()

    subtotal = Decimal("0")
    built_items: list[InvoiceItem] = []

    for item_data in data.items:
        product = await product_service.get_by_id(db, item_data.product_id)
        if item_data.quantity <= 0:
            raise AppException(status_code=400, detail="Item quantity must be greater than zero")
        if item_data.unit_price <= 0:
            raise AppException(status_code=400, detail="Item price must be greater than zero")
        line_total = item_data.unit_price * item_data.quantity
        subtotal += line_total
        built_items.append(
            InvoiceItem(
                product_id=product.id,
                product_name=product.name,
                quantity=item_data.quantity,
                unit_price=item_data.unit_price,
                line_total=line_total,
            )
        )

    tax_amount = (subtotal * data.tax_rate / Decimal("100")).quantize(Decimal("0.01"))
    total = subtotal + tax_amount

    invoice = Invoice(
        invoice_number=invoice_number,
        customer_id=resolved_customer.id,
        walk_in_customer_name=None,
        walk_in_customer_phone=None,
        status="paid",
        payment_method=data.payment_method,
        subtotal=subtotal,
        tax_rate=data.tax_rate,
        tax_amount=tax_amount,
        total=total,
        notes=data.notes,
        created_by_id=created_by_id,
    )
    db.add(invoice)
    await db.flush()  # get invoice.id

    for item in built_items:
        item.invoice_id = invoice.id
        db.add(item)

    # Deduct stock for each item
    for item_data in data.items:
        await product_service.adjust_stock(
            db,
            product_id=item_data.product_id,
            delta=-item_data.quantity,
            movement_type=MovementType.SALE,
            created_by_id=created_by_id,
            reference_id=invoice.id,
            notes=f"Invoice {invoice_number}",
        )

    await db.flush()
    return await repo.get_by_id(invoice.id)


async def update(db: AsyncSession, invoice_id: uuid.UUID, data: InvoiceUpdate) -> Invoice:
    invoice = await get_by_id(db, invoice_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(invoice, field, value)
    await db.flush()
    return await InvoiceRepository(db).get_by_id(invoice_id)
