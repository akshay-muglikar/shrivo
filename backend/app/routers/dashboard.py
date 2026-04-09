from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models.expense import Expense
from app.models.invoice import Invoice
from app.models.product import Product

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

    # Low stock count (always current, not time-filtered)
    low_stock_q = await db.execute(
        select(func.count())
        .select_from(Product)
        .where(Product.is_active == True)  # noqa: E712
        .where(Product.current_stock <= Product.low_stock_threshold)
    )
    low_stock_count = low_stock_q.scalar_one()

    # Daily sales trend for every day in [d_from, d_to]
    days = (d_to - d_from).days + 1
    trend = []
    for i in range(days):
        day = d_from + timedelta(days=i)
        row = await db.execute(
            select(func.coalesce(func.sum(Invoice.total), 0))
            .where(Invoice.status == "paid")
            .where(func.date(Invoice.created_at) == day)
        )
        trend.append({"date": day.isoformat(), "revenue": float(row.scalar_one())})

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
        "net_profit": float(net_profit),
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
