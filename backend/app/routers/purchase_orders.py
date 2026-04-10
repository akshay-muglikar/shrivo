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
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus
from app.models.stock_movement import MovementType, StockMovement
from app.models.supplier import Supplier
from app.models.supplier_payment import SupplierPayment
from app.models.user import User
from app.schemas.purchase_order import (
    PurchaseOrderCreate,
    PurchaseOrderListItem,
    PurchaseOrderRead,
    PurchaseOrderUpdate,
    SupplierPaymentCreate,
    SupplierPaymentRead,
)


class BulkPOAction(BaseModel):
    po_ids: list[uuid.UUID]

router = APIRouter(tags=["purchase-orders"])


async def _generate_po_number(db: AsyncSession) -> str:
    count = (await db.execute(select(func.count()).select_from(PurchaseOrder))).scalar_one()
    return f"PO-{count + 1:04d}"


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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    async with session_transaction(db):
        po = await _load_po(db, po_id)
        if po.status == PurchaseOrderStatus.RECEIVED:
            raise AppException(400, "Purchase order already received")
        if po.status == PurchaseOrderStatus.CANCELLED:
            raise AppException(400, "Cannot receive a cancelled purchase order")
        await _do_receive(db, po, current_user.id)
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


async def _do_receive(db: AsyncSession, po: PurchaseOrder, current_user_id: uuid.UUID) -> None:
    """Shared receive logic used by single and bulk receive."""
    for item in po.items:
        if item.product_id:
            product = await db.get(Product, item.product_id)
            if product:
                product.current_stock += item.quantity
                product.cost_price = item.unit_cost
                db.add(StockMovement(
                    product_id=item.product_id,
                    movement_type=MovementType.STOCK_IN,
                    quantity_delta=item.quantity,
                    reference_id=po.id,
                    notes=f"PO {po.po_number}",
                    created_by_id=current_user_id,
                ))
    supplier = await db.get(Supplier, po.supplier_id)
    if supplier:
        supplier.balance = (supplier.balance or 0) + po.total_amount
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
