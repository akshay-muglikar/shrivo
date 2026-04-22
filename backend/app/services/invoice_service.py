import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import select, func as sa_func
from sqlalchemy.orm import selectinload

from app.core.exceptions import AppException
from app.models.invoice import Invoice, InvoiceItem
from app.models.invoice_return import InvoiceReturn, InvoiceReturnItem
from app.models.product_batch import ProductBatch
from app.models.stock_movement import MovementType, StockMovement
from app.repositories.invoice_repository import InvoiceRepository
from app.repositories.product_repository import ProductRepository
from app.schemas.invoice import InvoiceCreate, InvoiceReturnCreate, InvoiceUpdate
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

    # Batch-fetch all products in one query
    product_map = await ProductRepository(db).get_by_ids([item.product_id for item in data.items])
    missing = [str(item.product_id) for item in data.items if item.product_id not in product_map]
    if missing:
        raise AppException(status_code=404, detail=f"Products not found: {', '.join(missing)}")

    subtotal = Decimal("0")
    built_items: list[InvoiceItem] = []
    # (product_id, batch, qty_to_deduct) — collected for all batched items
    batch_deductions: list[tuple[uuid.UUID, ProductBatch, int]] = []

    for item_data in data.items:
        product = product_map[item_data.product_id]
        if item_data.quantity <= 0:
            raise AppException(status_code=400, detail="Item quantity must be greater than zero")
        if item_data.unit_price <= 0:
            raise AppException(status_code=400, detail="Item price must be greater than zero")

        # Determine batch assignment (explicit or FEFO auto)
        batch_id_snap: uuid.UUID | None = None
        batch_number_snap: str | None = None
        expiry_date_snap: date | None = None

        if item_data.batch_id:
            # Caller specified a batch — validate and use it
            from sqlalchemy import select as sa_select
            stmt = sa_select(ProductBatch).where(
                ProductBatch.id == item_data.batch_id,
                ProductBatch.product_id == item_data.product_id,
            )
            result = await db.execute(stmt)
            explicit_batch = result.scalar_one_or_none()
            if not explicit_batch:
                raise AppException(
                    status_code=400,
                    detail=f"Batch not found for product '{product.name}'",
                )
            if explicit_batch.quantity_remaining < item_data.quantity:
                raise AppException(
                    status_code=400,
                    detail=f"Insufficient stock in batch '{explicit_batch.batch_number}': "
                           f"{explicit_batch.quantity_remaining} available",
                )
            batch_deductions.append((item_data.product_id, explicit_batch, item_data.quantity))
            batch_id_snap = explicit_batch.id
            batch_number_snap = explicit_batch.batch_number
            expiry_date_snap = explicit_batch.expiry_date
        else:
            # FEFO auto-selection
            active_batches = await product_service.get_active_batches_fefo(db, item_data.product_id)
            if active_batches:
                total_batch_stock = sum(b.quantity_remaining for b in active_batches)
                if total_batch_stock < item_data.quantity:
                    raise AppException(
                        status_code=400,
                        detail=f"Insufficient batch stock for '{product.name}': {total_batch_stock} units available across all batches",
                    )
                remaining = item_data.quantity
                for batch in active_batches:
                    if remaining <= 0:
                        break
                    deduct = min(batch.quantity_remaining, remaining)
                    batch_deductions.append((item_data.product_id, batch, deduct))
                    remaining -= deduct
                    if batch_id_snap is None:
                        batch_id_snap = batch.id
                        batch_number_snap = batch.batch_number
                        expiry_date_snap = batch.expiry_date

        line_total = item_data.unit_price * item_data.quantity
        subtotal += line_total

        # Phase 3 — compute per-item GST amounts when is_gst_invoice
        gst_rate = product.gst_rate or Decimal("0")
        cgst_rate = sgst_rate = igst_rate = Decimal("0")
        cgst_amount = sgst_amount = igst_amount = Decimal("0")
        if data.is_gst_invoice and gst_rate > 0:
            if product.price_includes_gst:
                taxable_line = (line_total / (1 + gst_rate / Decimal("100"))).quantize(Decimal("0.01"))
            else:
                taxable_line = line_total
            if data.supply_type == "inter":
                igst_rate = gst_rate
                igst_amount = (taxable_line * igst_rate / Decimal("100")).quantize(Decimal("0.01"))
            else:
                cgst_rate = (gst_rate / Decimal("2")).quantize(Decimal("0.01"))
                sgst_rate = cgst_rate
                cgst_amount = (taxable_line * cgst_rate / Decimal("100")).quantize(Decimal("0.01"))
                sgst_amount = cgst_amount

        built_items.append(
            InvoiceItem(
                product_id=product.id,
                product_name=product.name,
                hsn_code=product.hsn_code,
                gst_rate=product.gst_rate,
                price_includes_gst=product.price_includes_gst,
                quantity=item_data.quantity,
                unit_price=item_data.unit_price,
                line_total=line_total,
                mrp=product.selling_price,
                batch_id=batch_id_snap,
                batch_number=batch_number_snap,
                expiry_date=expiry_date_snap,
                cgst_rate=cgst_rate,
                sgst_rate=sgst_rate,
                igst_rate=igst_rate,
                cgst_amount=cgst_amount,
                sgst_amount=sgst_amount,
                igst_amount=igst_amount,
            )
        )

    discount_value = data.discount_value or Decimal("0")
    if data.discount_type == "percent":
        discount_amount = (subtotal * discount_value / Decimal("100")).quantize(Decimal("0.01"))
    elif data.discount_type == "flat":
        discount_amount = min(discount_value, subtotal).quantize(Decimal("0.01"))
    else:
        discount_amount = Decimal("0")

    taxable = subtotal - discount_amount
    tax_amount = (taxable * data.tax_rate / Decimal("100")).quantize(Decimal("0.01"))
    total = taxable + tax_amount

    total_cgst = sum(i.cgst_amount for i in built_items).quantize(Decimal("0.01"))
    total_sgst = sum(i.sgst_amount for i in built_items).quantize(Decimal("0.01"))
    total_igst = sum(i.igst_amount for i in built_items).quantize(Decimal("0.01"))

    invoice = Invoice(
        invoice_number=invoice_number,
        customer_id=resolved_customer.id,
        walk_in_customer_name=None,
        walk_in_customer_phone=None,
        status="paid",
        payment_method=data.payment_method,
        subtotal=subtotal,
        discount_type=data.discount_type,
        discount_value=discount_value,
        discount_amount=discount_amount,
        tax_rate=data.tax_rate,
        tax_amount=tax_amount,
        total=total,
        notes=data.notes,
        is_gst_invoice=data.is_gst_invoice,
        supply_type=data.supply_type,
        place_of_supply=data.place_of_supply,
        buyer_gstin=resolved_customer.gstin if data.is_gst_invoice else None,
        total_cgst=total_cgst,
        total_sgst=total_sgst,
        total_igst=total_igst,
        created_by_id=created_by_id,
    )
    db.add(invoice)
    await db.flush()  # get invoice.id

    for item in built_items:
        item.invoice_id = invoice.id
        db.add(item)

    # Products that have batch deductions assigned
    batched_product_ids = {pid for pid, _, _ in batch_deductions}

    # Apply batch deductions (FEFO)
    for product_id, batch, deduct_qty in batch_deductions:
        batch.quantity_remaining -= deduct_qty
        db.add(StockMovement(
            product_id=product_id,
            movement_type=MovementType.SALE.value,
            quantity_delta=-deduct_qty,
            reference_id=invoice.id,
            batch_id=batch.id,
            notes=f"Invoice {invoice_number}",
            created_by_id=created_by_id,
        ))
        # Decrement product.current_stock per unit deducted
        product_map[product_id].current_stock -= deduct_qty

    # Non-batched items — use existing adjust_stock path
    for item_data in data.items:
        if item_data.product_id not in batched_product_ids:
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


async def update(db: AsyncSession, invoice_id: uuid.UUID, data: InvoiceUpdate, updated_by_id: uuid.UUID) -> Invoice:
    invoice = await get_by_id(db, invoice_id)
    update_data = data.model_dump(exclude_unset=True)

    # Restore stock when cancelling a paid invoice
    if update_data.get("status") == "cancelled" and invoice.status == "paid":
        for item in invoice.items:
            # Restore batch quantity if this item was sold from a specific batch
            if item.batch_id:
                batch = await db.get(ProductBatch, item.batch_id)
                if batch:
                    batch.quantity_remaining += item.quantity

            await product_service.adjust_stock(
                db,
                product_id=item.product_id,
                delta=item.quantity,
                movement_type=MovementType.RETURN,
                created_by_id=updated_by_id,
                notes=f"Cancelled invoice {invoice.invoice_number}",
                batch_id=item.batch_id,
            )

    for field, value in update_data.items():
        setattr(invoice, field, value)
    await db.flush()
    return await InvoiceRepository(db).get_by_id(invoice_id)


async def get_returns(db: AsyncSession, invoice_id: uuid.UUID) -> list[InvoiceReturn]:
    await get_by_id(db, invoice_id)  # 404 if missing
    result = await db.execute(
        select(InvoiceReturn)
        .where(InvoiceReturn.invoice_id == invoice_id)
        .options(selectinload(InvoiceReturn.items))
        .order_by(InvoiceReturn.created_at.asc())
    )
    return list(result.scalars().all())


async def create_return(
    db: AsyncSession,
    invoice_id: uuid.UUID,
    data: InvoiceReturnCreate,
    created_by_id: uuid.UUID,
) -> InvoiceReturn:
    invoice = await get_by_id(db, invoice_id)

    if invoice.status == "cancelled":
        raise AppException(status_code=400, detail="Cannot return a cancelled invoice")

    # Build item map for validation
    item_map: dict[uuid.UUID, InvoiceItem] = {item.id: item for item in invoice.items}

    # Sum already-returned quantities per invoice item
    already_returned: dict[uuid.UUID, int] = {}
    for item_id in item_map:
        result = await db.execute(
            select(sa_func.coalesce(sa_func.sum(InvoiceReturnItem.quantity), 0))
            .where(InvoiceReturnItem.invoice_item_id == item_id)
        )
        already_returned[item_id] = result.scalar_one()

    # Validate return quantities against remaining unreturned units
    for ri in data.items:
        orig = item_map.get(ri.invoice_item_id)
        if not orig:
            raise AppException(status_code=400, detail=f"Invoice item {ri.invoice_item_id} not found on this invoice")
        unreturned = orig.quantity - already_returned.get(ri.invoice_item_id, 0)
        if ri.quantity > unreturned:
            raise AppException(
                status_code=400,
                detail=f"Cannot return {ri.quantity} of '{orig.product_name}': only {unreturned} unreturned unit(s) remain",
            )

    # Generate return number
    count_result = await db.execute(select(sa_func.count()).select_from(InvoiceReturn))
    count = count_result.scalar_one()
    return_number = f"RET-{count + 1:04d}"

    inv_return = InvoiceReturn(
        invoice_id=invoice_id,
        return_number=return_number,
        notes=data.notes,
        created_by_id=created_by_id,
    )
    db.add(inv_return)
    await db.flush()  # get inv_return.id

    for ri in data.items:
        orig = item_map[ri.invoice_item_id]

        # Restore batch stock if applicable
        if orig.batch_id:
            batch = await db.get(ProductBatch, orig.batch_id)
            if batch:
                batch.quantity_remaining += ri.quantity

        # Restore product.current_stock and create RETURN movement
        await product_service.adjust_stock(
            db,
            product_id=orig.product_id,
            delta=ri.quantity,
            movement_type=MovementType.RETURN,
            created_by_id=created_by_id,
            notes=f"Return {return_number} for invoice {invoice.invoice_number}",
            batch_id=orig.batch_id,
        )

        db.add(
            InvoiceReturnItem(
                return_id=inv_return.id,
                invoice_item_id=orig.id,
                product_id=orig.product_id,
                product_name=orig.product_name,
                batch_id=orig.batch_id,
                batch_number=orig.batch_number,
                quantity=ri.quantity,
            )
        )

    await db.flush()

    # Reload with items
    result = await db.execute(
        select(InvoiceReturn)
        .where(InvoiceReturn.id == inv_return.id)
        .options(selectinload(InvoiceReturn.items))
    )
    return result.scalar_one()
