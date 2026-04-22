import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import AppException
from app.core.pagination import PageParams
from app.database import get_db, session_transaction
from app.dependencies import get_current_user
from app.models.product import Product
from app.models.product_batch import ProductBatch
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus
from app.models.supplier import Supplier
from app.models.supplier_payment import SupplierPayment
from app.models.supplier_return import SupplierReturn, SupplierReturnItem
from app.models.stock_movement import MovementType, StockMovement
from app.models.user import User
from app.schemas.purchase_order import (
    GRNReceiveData,
    PurchaseOrderCreate,
    PurchaseOrderListItem,
    PurchaseOrderRead,
    PurchaseOrderUpdate,
    SupplierPaymentCreate,
    SupplierPaymentRead,
    SupplierReturnCreate,
    SupplierReturnRead,
)
from app.services import product_service


class BulkPOAction(BaseModel):
    po_ids: list[uuid.UUID]

router = APIRouter(tags=["purchase-orders"])


async def _generate_po_number(db: AsyncSession) -> str:
    count = (await db.execute(select(func.count()).select_from(PurchaseOrder))).scalar_one()
    return f"PO-{count + 1:04d}"


async def _generate_supplier_return_number(db: AsyncSession) -> str:
    count = (await db.execute(select(func.count()).select_from(SupplierReturn))).scalar_one()
    return f"SR-{count + 1:04d}"


async def _load_po(db: AsyncSession, po_id: uuid.UUID) -> PurchaseOrder:
    result = await db.execute(
        select(PurchaseOrder)
        .options(
            selectinload(PurchaseOrder.supplier),
            selectinload(PurchaseOrder.items).selectinload(PurchaseOrderItem.product),
        )
        .where(PurchaseOrder.id == po_id)
    )
    po = result.scalar_one_or_none()
    if not po:
        raise AppException(404, "Purchase order not found")
    return po


def _normalize_grn_items(body: GRNReceiveData | None) -> dict[uuid.UUID, dict]:
    if not body or not body.items:
        return {}

    item_map: dict[uuid.UUID, dict] = {}
    for item in body.items:
        if item.po_item_id in item_map:
            raise AppException(400, "Duplicate GRN item entries are not allowed")
        item_map[item.po_item_id] = item.model_dump()
    return item_map


async def _load_supplier_return(db: AsyncSession, return_id: uuid.UUID) -> SupplierReturn:
    result = await db.execute(
        select(SupplierReturn)
        .options(
            selectinload(SupplierReturn.supplier),
            selectinload(SupplierReturn.items).selectinload(SupplierReturnItem.product),
        )
        .where(SupplierReturn.id == return_id)
    )
    supplier_return = result.scalar_one_or_none()
    if not supplier_return:
        raise AppException(404, "Supplier return not found")
    return supplier_return


@router.get("/purchase-orders", response_model=dict)
async def list_purchase_orders(
    supplier_id: uuid.UUID | None = Query(None),
    status: str | None = Query(None),
    page: PageParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    query = (
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.supplier))
        .order_by(PurchaseOrder.created_at.desc())
    )
    if supplier_id:
        query = query.where(PurchaseOrder.supplier_id == supplier_id)
    if status:
        query = query.where(PurchaseOrder.status == status)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar_one()
    result = await db.execute(query.offset(page.offset).limit(page.limit))
    items = result.scalars().all()

    return {
        "total": total,
        "page": page.page,
        "limit": page.limit,
        "items": [PurchaseOrderListItem.model_validate(po) for po in items],
    }


@router.post("/purchase-orders", response_model=PurchaseOrderRead, status_code=status.HTTP_201_CREATED)
async def create_purchase_order(
    body: PurchaseOrderCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    async with session_transaction(db):
        supplier = await db.get(Supplier, body.supplier_id)
        if not supplier:
            raise AppException(404, "Supplier not found")
        if not body.items:
            raise AppException(400, "Purchase order must have at least one item")

        po_number = await _generate_po_number(db)
        po = PurchaseOrder(
            po_number=po_number,
            supplier_id=body.supplier_id,
            status=body.status or PurchaseOrderStatus.DRAFT,
            notes=body.notes,
        )
        db.add(po)
        await db.flush()

        total = 0
        for item_data in body.items:
            product_name = item_data.product_name
            if item_data.product_id and not product_name.strip():
                product = await db.get(Product, item_data.product_id)
                if product:
                    product_name = product.name
            line_total = item_data.quantity * item_data.unit_cost
            total += line_total
            db.add(PurchaseOrderItem(
                po_id=po.id,
                product_id=item_data.product_id,
                product_name=product_name,
                quantity=item_data.quantity,
                unit_cost=item_data.unit_cost,
                line_total=line_total,
            ))
        po.total_amount = total
        await db.flush()

    return PurchaseOrderRead.model_validate(await _load_po(db, po.id))


@router.get("/purchase-orders/{po_id}", response_model=PurchaseOrderRead)
async def get_purchase_order(
    po_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    return PurchaseOrderRead.model_validate(await _load_po(db, po_id))


@router.patch("/purchase-orders/{po_id}", response_model=PurchaseOrderRead)
async def update_purchase_order(
    po_id: uuid.UUID,
    body: PurchaseOrderUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    async with session_transaction(db):
        po = await _load_po(db, po_id)
        if po.status == PurchaseOrderStatus.RECEIVED:
            raise AppException(400, "Cannot update a received purchase order")
        for field, value in body.model_dump(exclude_unset=True).items():
            setattr(po, field, value)
        await db.flush()
    return PurchaseOrderRead.model_validate(await _load_po(db, po_id))


@router.post("/purchase-orders/{po_id}/receive", response_model=PurchaseOrderRead)
async def receive_purchase_order(
    po_id: uuid.UUID,
    body: GRNReceiveData | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    async with session_transaction(db):
        po = await _load_po(db, po_id)
        if po.status == PurchaseOrderStatus.RECEIVED:
            raise AppException(400, "Purchase order already received")
        if po.status == PurchaseOrderStatus.CANCELLED:
            raise AppException(400, "Cannot receive a cancelled purchase order")
        await _do_receive(db, po, current_user.id, body)
        await db.flush()
    return PurchaseOrderRead.model_validate(await _load_po(db, po_id))


@router.delete("/purchase-orders/{po_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_purchase_order(
    po_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    async with session_transaction(db):
        po = await db.get(PurchaseOrder, po_id)
        if not po:
            raise AppException(404, "Purchase order not found")
        if po.status == PurchaseOrderStatus.RECEIVED:
            raise AppException(400, "Cannot delete a received purchase order")
        await db.delete(po)
        await db.flush()


# ── Bulk PO actions ────────────────────────────────────────────────────────


async def _do_receive(
    db: AsyncSession,
    po: PurchaseOrder,
    current_user_id: uuid.UUID,
    body: GRNReceiveData | None = None,
) -> None:
    """Shared receive logic used by single and bulk receive."""
    grn_items = _normalize_grn_items(body)
    po_item_ids = {item.id for item in po.items}
    unknown_ids = [str(item_id) for item_id in grn_items if item_id not in po_item_ids]
    if unknown_ids:
        raise AppException(400, f"GRN items do not belong to purchase order: {', '.join(unknown_ids)}")

    supplier_invoice_no = body.supplier_invoice_no.strip() if body and body.supplier_invoice_no else None
    if body and body.supplier_invoice_no is not None and not supplier_invoice_no:
        supplier_invoice_no = None

    receive_note = f"PO {po.po_number}"
    if supplier_invoice_no:
        receive_note = f"{receive_note} / Supplier Inv {supplier_invoice_no}"

    for item in po.items:
        grn_item = grn_items.get(item.id, {})
        received_quantity = grn_item.get("received_quantity")
        if received_quantity is None:
            received_quantity = item.quantity

        if received_quantity <= 0:
            raise AppException(400, f"Received quantity must be positive for '{item.product_name}'")
        if received_quantity > item.quantity:
            raise AppException(400, f"Received quantity cannot exceed ordered quantity for '{item.product_name}'")

        batch_number = grn_item.get("batch_number")
        batch_number = batch_number.strip() if isinstance(batch_number, str) and batch_number.strip() else None
        expiry_date = grn_item.get("expiry_date")

        item.received_quantity = received_quantity
        item.batch_number = batch_number
        item.expiry_date = expiry_date

        if item.product_id:
            product = await db.get(Product, item.product_id)
            if not product:
                raise AppException(404, f"Product linked to '{item.product_name}' was not found")

            await product_service.create_batch(
                db,
                product_id=item.product_id,
                quantity=received_quantity,
                created_by_id=current_user_id,
                batch_number=batch_number,
                expiry_date=expiry_date,
                cost_price=item.unit_cost,
                reference_id=po.id,
                notes=receive_note,
            )

    supplier = await db.get(Supplier, po.supplier_id)
    if supplier:
        supplier.balance = (supplier.balance or 0) + po.total_amount
    po.supplier_invoice_no = supplier_invoice_no
    po.status = PurchaseOrderStatus.RECEIVED
    po.received_at = datetime.now(timezone.utc)


@router.post("/purchase-orders/bulk-receive")
async def bulk_receive_purchase_orders(
    body: BulkPOAction,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    received, skipped, errors = [], [], []
    async with session_transaction(db):
        for po_id in body.po_ids:
            try:
                po = await _load_po(db, po_id)
                if po.status == PurchaseOrderStatus.RECEIVED:
                    skipped.append(str(po_id))
                    continue
                if po.status == PurchaseOrderStatus.CANCELLED:
                    errors.append({"id": str(po_id), "reason": "Cannot receive a cancelled PO"})
                    continue
                await _do_receive(db, po, current_user.id)
                received.append(str(po_id))
            except AppException as e:
                errors.append({"id": str(po_id), "reason": e.detail})
        await db.flush()
    return {"received": received, "skipped": skipped, "errors": errors}


@router.post("/purchase-orders/bulk-cancel")
async def bulk_cancel_purchase_orders(
    body: BulkPOAction,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    cancelled, skipped, errors = [], [], []
    async with session_transaction(db):
        for po_id in body.po_ids:
            try:
                po = await db.get(PurchaseOrder, po_id)
                if not po:
                    errors.append({"id": str(po_id), "reason": "Not found"})
                    continue
                if po.status == PurchaseOrderStatus.RECEIVED:
                    skipped.append(str(po_id))
                    continue
                if po.status == PurchaseOrderStatus.CANCELLED:
                    skipped.append(str(po_id))
                    continue
                po.status = PurchaseOrderStatus.CANCELLED
                cancelled.append(str(po_id))
            except AppException as e:
                errors.append({"id": str(po_id), "reason": e.detail})
        await db.flush()
    return {"cancelled": cancelled, "skipped": skipped, "errors": errors}


# ── Supplier payments ───────────────────────────────────────────────────────


@router.post(
    "/suppliers/{supplier_id}/payments",
    response_model=SupplierPaymentRead,
    status_code=status.HTTP_201_CREATED,
)
async def record_payment(
    supplier_id: uuid.UUID,
    body: SupplierPaymentCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    async with session_transaction(db):
        supplier = await db.get(Supplier, supplier_id)
        if not supplier:
            raise AppException(404, "Supplier not found")
        if body.amount <= 0:
            raise AppException(400, "Amount must be positive")

        supplier.balance = (supplier.balance or 0) - body.amount
        payment = SupplierPayment(
            supplier_id=supplier_id,
            amount=body.amount,
            notes=body.notes,
        )
        db.add(payment)
        await db.flush()
        await db.refresh(payment)
    return SupplierPaymentRead.model_validate(payment)


@router.get("/suppliers/{supplier_id}/payments", response_model=list[SupplierPaymentRead])
async def list_payments(
    supplier_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    supplier = await db.get(Supplier, supplier_id)
    if not supplier:
        raise AppException(404, "Supplier not found")
    result = await db.execute(
        select(SupplierPayment)
        .where(SupplierPayment.supplier_id == supplier_id)
        .order_by(SupplierPayment.created_at.desc())
        .limit(50)
    )
    return [SupplierPaymentRead.model_validate(p) for p in result.scalars().all()]


# ── Supplier returns ────────────────────────────────────────────────────────


@router.get("/suppliers/{supplier_id}/returns", response_model=list[SupplierReturnRead])
async def list_supplier_returns(
    supplier_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    supplier = await db.get(Supplier, supplier_id)
    if not supplier:
        raise AppException(404, "Supplier not found")

    result = await db.execute(
        select(SupplierReturn)
        .options(
            selectinload(SupplierReturn.supplier),
            selectinload(SupplierReturn.items),
        )
        .where(SupplierReturn.supplier_id == supplier_id)
        .order_by(SupplierReturn.created_at.desc())
        .limit(100)
    )
    return [SupplierReturnRead.model_validate(item) for item in result.scalars().all()]


@router.get("/supplier-returns/{return_id}", response_model=SupplierReturnRead)
async def get_supplier_return(
    return_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    return SupplierReturnRead.model_validate(await _load_supplier_return(db, return_id))


@router.post(
    "/suppliers/{supplier_id}/returns",
    response_model=SupplierReturnRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_supplier_return(
    supplier_id: uuid.UUID,
    body: SupplierReturnCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    async with session_transaction(db):
        supplier = await db.get(Supplier, supplier_id)
        if not supplier:
            raise AppException(404, "Supplier not found")
        if not body.items:
            raise AppException(400, "Supplier return must include at least one item")

        return_number = await _generate_supplier_return_number(db)
        supplier_return = SupplierReturn(
            return_number=return_number,
            supplier_id=supplier_id,
            supplier_credit_note_no=body.supplier_credit_note_no.strip() if body.supplier_credit_note_no else None,
            notes=body.notes,
        )
        db.add(supplier_return)
        await db.flush()

        total_amount = 0
        for item_data in body.items:
            if item_data.quantity <= 0:
                raise AppException(400, f"Returned quantity must be positive for '{item_data.product_name}'")
            if item_data.unit_cost <= 0:
                raise AppException(400, f"Unit cost must be positive for '{item_data.product_name}'")

            line_total = item_data.quantity * item_data.unit_cost
            total_amount += line_total

            product_name = item_data.product_name
            batch_id: uuid.UUID | None = None
            batch_number: str | None = None
            expiry_date = None

            if item_data.product_id:
                product = await db.get(Product, item_data.product_id)
                if not product:
                    raise AppException(404, f"Product linked to '{item_data.product_name}' was not found")
                product_name = product.name

                qty_to_reduce = item_data.quantity
                if item_data.batch_id:
                    batch = await db.get(ProductBatch, item_data.batch_id)
                    if not batch or batch.product_id != item_data.product_id:
                        raise AppException(400, f"Batch not found for '{product_name}'")
                    if batch.quantity_remaining < qty_to_reduce:
                        raise AppException(
                            400,
                            f"Insufficient stock in batch '{batch.batch_number}' for '{product_name}'",
                        )

                    batch.quantity_remaining -= qty_to_reduce
                    batch_id = batch.id
                    batch_number = batch.batch_number
                    expiry_date = batch.expiry_date

                    db.add(StockMovement(
                        product_id=item_data.product_id,
                        movement_type=MovementType.RETURN.value,
                        quantity_delta=-qty_to_reduce,
                        reference_id=supplier_return.id,
                        batch_id=batch.id,
                        notes=f"Supplier return {return_number}",
                        created_by_id=current_user.id,
                    ))
                else:
                    active_batches = await product_service.get_active_batches_fefo(db, item_data.product_id)
                    total_batch_stock = sum(b.quantity_remaining for b in active_batches)
                    if total_batch_stock < qty_to_reduce:
                        raise AppException(
                            400,
                            f"Insufficient stock for '{product_name}': {total_batch_stock} units available",
                        )

                    remaining = qty_to_reduce
                    for batch in active_batches:
                        if remaining <= 0:
                            break
                        deduct = min(batch.quantity_remaining, remaining)
                        batch.quantity_remaining -= deduct
                        if batch_id is None:
                            batch_id = batch.id
                            batch_number = batch.batch_number
                            expiry_date = batch.expiry_date
                        db.add(StockMovement(
                            product_id=item_data.product_id,
                            movement_type=MovementType.RETURN.value,
                            quantity_delta=-deduct,
                            reference_id=supplier_return.id,
                            batch_id=batch.id,
                            notes=f"Supplier return {return_number}",
                            created_by_id=current_user.id,
                        ))
                        remaining -= deduct

                product.current_stock -= qty_to_reduce

            db.add(SupplierReturnItem(
                supplier_return_id=supplier_return.id,
                product_id=item_data.product_id,
                batch_id=batch_id,
                product_name=product_name,
                quantity=item_data.quantity,
                unit_cost=item_data.unit_cost,
                line_total=line_total,
                batch_number=batch_number,
                expiry_date=expiry_date,
            ))

        supplier_return.total_amount = total_amount
        supplier.balance = (supplier.balance or 0) - total_amount
        await db.flush()

    return SupplierReturnRead.model_validate(await _load_supplier_return(db, supplier_return.id))
