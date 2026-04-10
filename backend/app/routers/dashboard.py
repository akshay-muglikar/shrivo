from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import cast, Date, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models.expense import Expense
from app.models.invoice import Invoice
from app.models.product import Product
from app.models.purchase_order import PurchaseOrder, PurchaseOrderStatus
from app.models.supplier import Supplier

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
async def get_summary(
    date_from: date = Query(default=None),
    date_to: date = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    today = date.today()
    d_from: date = date_from or today
    d_to: date = date_to or today

    # Clamp: from <= to
    if d_from > d_to:
        d_from, d_to = d_to, d_from

    # Revenue in range (paid invoices)
    revenue_q = await db.execute(
        select(func.coalesce(func.sum(Invoice.total), 0))
        .where(Invoice.status == "paid")
        .where(func.date(Invoice.created_at) >= d_from)
        .where(func.date(Invoice.created_at) <= d_to)
    )
    period_revenue = revenue_q.scalar_one()

    # Invoice count in range
    inv_count_q = await db.execute(
        select(func.count())
        .select_from(Invoice)
        .where(Invoice.status == "paid")
        .where(func.date(Invoice.created_at) >= d_from)
        .where(func.date(Invoice.created_at) <= d_to)
    )
    period_invoice_count = inv_count_q.scalar_one()

    # Expenses in range
    expenses_q = await db.execute(
        select(func.coalesce(func.sum(Expense.amount), 0))
        .where(Expense.expense_date >= d_from)
        .where(Expense.expense_date <= d_to)
    )
    period_expenses = expenses_q.scalar_one()

    net_profit = Decimal(str(period_revenue)) - Decimal(str(period_expenses))

    # Inventory value = sum(current_stock × cost_price) for active products
    stock_value_q = await db.execute(
        select(func.coalesce(func.sum(Product.current_stock * Product.cost_price), 0))
        .where(Product.is_active == True)  # noqa: E712
    )
    stock_value = stock_value_q.scalar_one()

    # Low stock count (always current, not time-filtered)
    low_stock_q = await db.execute(
        select(func.count())
        .select_from(Product)
        .where(Product.is_active == True)  # noqa: E712
        .where(Product.current_stock <= Product.low_stock_threshold)
    )
    low_stock_count = low_stock_q.scalar_one()

    # Daily sales trend — single GROUP BY query instead of one query per day
    trend_q = await db.execute(
        select(
            cast(Invoice.created_at, Date).label("day"),
            func.coalesce(func.sum(Invoice.total), 0).label("revenue"),
        )
        .where(Invoice.status == "paid")
        .where(func.date(Invoice.created_at) >= d_from)
        .where(func.date(Invoice.created_at) <= d_to)
        .group_by("day")
        .order_by("day")
    )
    rows = {str(r.day): float(r.revenue) for r in trend_q}
    days = (d_to - d_from).days + 1
    trend = [
        {
            "date": (d_from + timedelta(days=i)).isoformat(),
            "revenue": rows.get((d_from + timedelta(days=i)).isoformat(), 0.0),
        }
        for i in range(days)
    ]

    # Recent 6 invoices in range
    recent_q = await db.execute(
        select(Invoice)
        .options(selectinload(Invoice.customer))
        .where(Invoice.status == "paid")
        .where(func.date(Invoice.created_at) >= d_from)
        .where(func.date(Invoice.created_at) <= d_to)
        .order_by(Invoice.created_at.desc())
        .limit(6)
    )
    recent_invoices = recent_q.scalars().all()

    # Period purchases: total of received POs in range
    purchases_q = await db.execute(
        select(func.coalesce(func.sum(PurchaseOrder.total_amount), 0))
        .where(PurchaseOrder.status == PurchaseOrderStatus.RECEIVED)
        .where(func.date(PurchaseOrder.received_at) >= d_from)
        .where(func.date(PurchaseOrder.received_at) <= d_to)
    )
    period_purchases = purchases_q.scalar_one()

    # Total outstanding supplier payable (sum of positive balances across all suppliers)
    payable_q = await db.execute(
        select(func.coalesce(func.sum(Supplier.balance), 0))
        .where(Supplier.is_active == True)  # noqa: E712
        .where(Supplier.balance > 0)
    )
    total_supplier_payable = payable_q.scalar_one()

    # Pending PO count (draft + ordered)
    pending_po_q = await db.execute(
        select(func.count())
        .select_from(PurchaseOrder)
        .where(PurchaseOrder.status.in_([PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.ORDERED]))
    )
    pending_po_count = pending_po_q.scalar_one()

    # Recent 5 POs (all time, most recent first)
    recent_pos_q = await db.execute(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.supplier))
        .order_by(PurchaseOrder.created_at.desc())
        .limit(5)
    )
    recent_pos = recent_pos_q.scalars().all()

    # Low stock products (always current)
    low_stock_products_q = await db.execute(
        select(Product)
        .where(Product.is_active == True)  # noqa: E712
        .where(Product.current_stock <= Product.low_stock_threshold)
        .order_by(Product.current_stock.asc())
        .limit(5)
    )
    low_stock_products = low_stock_products_q.scalars().all()

    return {
        "date_from": d_from.isoformat(),
        "date_to": d_to.isoformat(),
        "period_revenue": float(period_revenue),
        "period_invoice_count": period_invoice_count,
        "period_expenses": float(period_expenses),
        "period_purchases": float(period_purchases),
        "net_profit": float(net_profit),
        "total_supplier_payable": float(total_supplier_payable),
        "pending_po_count": pending_po_count,
        "stock_value": float(stock_value),
        "low_stock_count": low_stock_count,
        "sales_trend": trend,
        "recent_invoices": [
            {
                "id": str(inv.id),
                "invoice_number": inv.invoice_number,
                "customer_name": inv.customer.name if inv.customer else inv.walk_in_customer_name or "Walk-in",
                "total": float(inv.total),
                "payment_method": inv.payment_method,
                "created_at": inv.created_at.isoformat(),
            }
            for inv in recent_invoices
        ],
        "recent_pos": [
            {
                "id": str(po.id),
                "po_number": po.po_number,
                "supplier_name": po.supplier.name,
                "status": po.status,
                "total_amount": float(po.total_amount),
                "created_at": po.created_at.isoformat(),
            }
            for po in recent_pos
        ],
        "low_stock_products": [
            {
                "id": str(p.id),
                "name": p.name,
                "sku": p.sku,
                "current_stock": p.current_stock,
                "low_stock_threshold": p.low_stock_threshold,
            }
            for p in low_stock_products
        ],
    }
