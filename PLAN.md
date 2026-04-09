# Inventory & Billing Management System — Implementation Plan

## Overview

A simple, fast inventory and billing tool for shop owners and their employees. Core workflow: manage stock, create invoices quickly, send to customers via WhatsApp, record payments, see what's low on stock.

**Design principle:** Every action a shop employee takes should require as few steps as possible.

---

## Tech Stack

### Backend
| Layer | Technology | Reason |
|---|---|---|
| Framework | FastAPI (Python) | Auto-generated OpenAPI docs, async, Pydantic validation built-in |
| Database | PostgreSQL 16 | ACID transactions for stock/billing consistency |
| ORM | SQLAlchemy 2.0 + Alembic | Async ORM; Alembic for migrations |
| Validation | Pydantic v2 | Request/response models, automatic serialization |
| Auth | python-jose + passlib | JWT tokens; bcrypt password hashing |
| PDF | reportlab | Invoice PDF generation |
| WhatsApp | Twilio WhatsApp API | Send invoice to customer's WhatsApp |
| Decimal Math | Python `Decimal` (stdlib) | No float rounding errors in billing |
| Server | Uvicorn | ASGI server |

### Frontend
| Layer | Technology | Reason |
|---|---|---|
| Framework | React + TypeScript + Vite | Fast builds |
| Server State | TanStack Query (React Query) | Caching, optimistic updates |
| UI Components | shadcn/ui + Tailwind CSS | Clean components, fast to build with |
| Forms | React Hook Form + Zod | Type-safe forms |
| Charts | Recharts | Simple dashboard charts |
| HTTP Client | Axios | API calls with auth interceptor |
| Auth State | Zustand | Global auth token storage |

---

## Project Structure

```
inventory/
├── backend/
│   ├── app/
│   │   ├── main.py                       # FastAPI app, router registration
│   │   ├── config.py                     # pydantic-settings, reads .env
│   │   ├── database.py                   # Async SQLAlchemy engine + get_db dependency
│   │   ├── dependencies.py               # get_current_user dependency
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── category.py
│   │   │   ├── product.py
│   │   │   ├── stock_movement.py
│   │   │   ├── supplier.py
│   │   │   ├── customer.py
│   │   │   ├── invoice.py
│   │   │   ├── payment.py
│   │   │   └── expense.py
│   │   ├── schemas/
│   │   │   ├── auth.py
│   │   │   ├── category.py
│   │   │   ├── product.py
│   │   │   ├── supplier.py
│   │   │   ├── customer.py
│   │   │   ├── invoice.py
│   │   │   ├── payment.py
│   │   │   ├── expense.py
│   │   │   └── dashboard.py
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── categories.py
│   │   │   ├── products.py
│   │   │   ├── suppliers.py
│   │   │   ├── customers.py
│   │   │   ├── invoices.py
│   │   │   ├── payments.py
│   │   │   ├── expenses.py
│   │   │   └── dashboard.py
│   │   ├── services/
│   │   │   ├── auth_service.py
│   │   │   ├── product_service.py        # adjust_stock() — all stock changes go here
│   │   │   ├── invoice_service.py        # send(), void(), record_payment()
│   │   │   ├── expense_service.py
│   │   │   ├── pdf_service.py
│   │   │   └── whatsapp_service.py       # Twilio wrapper
│   │   ├── repositories/
│   │   │   ├── product_repository.py
│   │   │   ├── invoice_repository.py
│   │   │   └── dashboard_repository.py   # Aggregation queries
│   │   └── core/
│   │       ├── exceptions.py
│   │       ├── security.py               # JWT + bcrypt
│   │       └── pagination.py
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   ├── alembic.ini
│   ├── requirements.txt
│   └── seed.py
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── main.tsx
│   │   │   └── router.tsx
│   │   ├── components/
│   │   │   ├── ui/                       # shadcn/ui (do not edit)
│   │   │   └── layout/
│   │   │       ├── AppShell.tsx
│   │   │       ├── Sidebar.tsx
│   │   │       └── Header.tsx
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   │   ├── api/
│   │   │   │   ├── components/LoginForm.tsx
│   │   │   │   └── store/auth.store.ts
│   │   │   ├── products/
│   │   │   │   ├── api/
│   │   │   │   ├── components/           # ProductTable, ProductForm, StockBadge, StockInForm
│   │   │   │   └── pages/               # ProductsPage
│   │   │   ├── suppliers/
│   │   │   │   ├── api/
│   │   │   │   ├── components/
│   │   │   │   └── pages/
│   │   │   ├── customers/
│   │   │   │   ├── api/
│   │   │   │   ├── components/
│   │   │   │   └── pages/
│   │   │   ├── invoices/
│   │   │   │   ├── api/
│   │   │   │   ├── components/           # InvoiceBuilder, LineItemRow, InvoiceSummary
│   │   │   │   └── pages/               # InvoicesPage, InvoiceDetailPage
│   │   │   ├── expenses/
│   │   │   │   ├── api/
│   │   │   │   ├── components/           # ExpenseForm, ExpenseTable
│   │   │   │   └── pages/ExpensesPage.tsx
│   │   │   └── dashboard/
│   │   │       ├── api/                  # summary.ts, sales-trend.ts, top-products.ts
│   │   │       ├── components/
│   │   │       │   ├── PeriodSelector.tsx   # Today / Last 3 Days / This Week / This Month / Custom
│   │   │       │   ├── KPICard.tsx
│   │   │       │   ├── SalesTrendChart.tsx  # Revenue vs Expenses bar chart
│   │   │       │   ├── TopProductsTable.tsx
│   │   │       │   ├── LowStockList.tsx
│   │   │       │   └── RecentInvoices.tsx
│   │   │       ├── hooks/useDashboardPeriod.ts  # shared period state
│   │   │       └── pages/DashboardPage.tsx
│   │   ├── lib/
│   │   │   ├── api-client.ts             # Axios instance + auth interceptor
│   │   │   ├── utils.ts
│   │   │   └── formatters.ts
│   │   └── types/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── components.json
│
├── .env.example
├── .gitignore
├── docker-compose.yml
└── PLAN.md
```

---

## Database Schema

```python
# Enums
class UnitOfMeasure(str, enum.Enum):
    PIECE = "piece"; KG = "kg"; LITER = "liter"; BOX = "box"; METER = "meter"

class MovementType(str, enum.Enum):
    STOCK_IN = "stock_in"     # supplier delivery or manual addition
    SALE = "sale"             # invoice sent
    ADJUSTMENT = "adjustment" # correction
    RETURN = "return"         # voided invoice
    DAMAGE = "damage"         # written off

class InvoiceStatus(str, enum.Enum):
    DRAFT = "draft"; SENT = "sent"; PAID = "paid"
    PARTIAL = "partial"; VOID = "void"

class PaymentMethod(str, enum.Enum):
    CASH = "cash"; UPI = "upi"; BANK_TRANSFER = "bank_transfer"
    CARD = "card"; CHEQUE = "cheque"

class ExpenseCategory(str, enum.Enum):
    SALARY = "salary"         # employee wages
    FOOD = "food"             # snacks, lunch, tea
    UTILITIES = "utilities"   # electricity, water, internet
    RENT = "rent"
    TRANSPORT = "transport"
    SUPPLIES = "supplies"     # shop supplies, packaging
    OTHER = "other"

# Tables
User:          id UUID PK, name, email UNIQUE, password_hash, is_owner BOOL, created_at
               [is_owner = True for shop owner; False for employees]

Category:      id UUID PK, name, description

Supplier:      id UUID PK, name, phone, notes

Product:       id UUID PK, name, sku UNIQUE, category_id FK, supplier_id FK (nullable),
               unit_of_measure, cost_price NUMERIC(12,2), selling_price NUMERIC(12,2),
               current_stock INT DEFAULT 0, low_stock_threshold INT DEFAULT 5,
               is_active BOOL, created_at, updated_at

StockMovement: id UUID PK, product_id FK, movement_type, quantity_delta INT,
               reference_id UUID (nullable — invoice id or manual),
               notes, created_by_id FK, created_at
               [IMMUTABLE — never UPDATE or DELETE]

Customer:      id UUID PK, name, phone UNIQUE, whatsapp_number, notes, is_active

Invoice:       id UUID PK, invoice_number UNIQUE, customer_id FK (nullable — walk-in),
               status, issued_at, due_at (nullable),
               subtotal NUMERIC(12,2), discount_amount NUMERIC(12,2) DEFAULT 0,
               tax_rate NUMERIC(5,2) DEFAULT 0, tax_amount NUMERIC(12,2),
               total_amount NUMERIC(12,2), notes, created_by_id FK

InvoiceItem:   id UUID PK, invoice_id FK, product_id FK, description,
               quantity INT, unit_price NUMERIC(12,2),
               discount_percent NUMERIC(5,2) DEFAULT 0, line_total NUMERIC(12,2)

Payment:       id UUID PK, invoice_id FK, amount NUMERIC(12,2),
               payment_method, paid_at, notes, created_by_id FK

Expense:       id UUID PK, category (ExpenseCategory), description,
               amount NUMERIC(12,2), payment_method, paid_at,
               paid_to (optional name, e.g. employee name),
               notes, created_by_id FK
```

### Relationships

```
Supplier → Products (optional — tracks which supplier provides a product)
Category → Products
Product  → StockMovements (immutable ledger of all stock changes)
Customer → Invoices → InvoiceItems → Products
Invoice  → Payments (multiple payments per invoice for partial pay)
```

---

## API Endpoints

Prefix: `/api/v1`. Docs at `/docs`.

### Auth
```
POST   /api/v1/auth/login               returns long-lived token (30 days)
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
```

### Products
```
GET    /api/v1/products                 ?search, category_id, low_stock
POST   /api/v1/products
GET    /api/v1/products/{id}
PUT    /api/v1/products/{id}
DELETE /api/v1/products/{id}            soft delete
POST   /api/v1/products/{id}/stock-in   { quantity, supplier_id, cost_price, notes }
POST   /api/v1/products/{id}/adjust     { delta, reason }   manual correction
GET    /api/v1/products/{id}/movements
```

### Categories
```
GET    /api/v1/categories
POST   /api/v1/categories
PUT    /api/v1/categories/{id}
DELETE /api/v1/categories/{id}
```

### Suppliers
```
GET    /api/v1/suppliers
POST   /api/v1/suppliers
PUT    /api/v1/suppliers/{id}
DELETE /api/v1/suppliers/{id}
```

### Customers
```
GET    /api/v1/customers                ?search
POST   /api/v1/customers
PUT    /api/v1/customers/{id}
GET    /api/v1/customers/{id}/invoices
```

### Invoices
```
GET    /api/v1/invoices                 ?status, customer_id, date_from, date_to
POST   /api/v1/invoices                 creates as DRAFT
GET    /api/v1/invoices/{id}
PUT    /api/v1/invoices/{id}            DRAFT only
POST   /api/v1/invoices/{id}/send       DRAFT → SENT, deducts stock, sends WhatsApp
POST   /api/v1/invoices/{id}/void       SENT/PARTIAL → VOID, reverses stock
POST   /api/v1/invoices/{id}/payments   record payment
GET    /api/v1/invoices/{id}/pdf
```

### Expenses
```
GET    /api/v1/expenses                 ?category, date_from, date_to
POST   /api/v1/expenses
PUT    /api/v1/expenses/{id}
DELETE /api/v1/expenses/{id}
```

### Dashboard
```
GET    /api/v1/dashboard/summary        ?from=&to=   revenue, expenses, net, invoice count, stock value
GET    /api/v1/dashboard/low-stock                   products below threshold (no date filter needed)
GET    /api/v1/dashboard/sales-trend    ?from=&to=   daily revenue + expenses grouped by date
GET    /api/v1/dashboard/top-products   ?from=&to=   top 5 products by units sold in period
```

Preset periods the frontend sends as `from`/`to` query params:
- **Today** — `from=today&to=today`
- **Last 3 days** — `from=3d`
- **This week** — `from=7d`
- **This month** — `from=30d`
- **Custom** — explicit `from=YYYY-MM-DD&to=YYYY-MM-DD`

Backend resolves shorthand (`today`, `3d`, `30d`) to absolute dates. All times in shop's local timezone (configured via `TIMEZONE` env var).

---

## Implementation Phases

### Phase 1 — Foundation
**Goal:** Running server, products in database, staff can log in.

- [ ] `backend/` setup: virtualenv, FastAPI, SQLAlchemy, Alembic, uvicorn
- [ ] `docker-compose.yml` with PostgreSQL 16
- [ ] `app/config.py` — pydantic-settings, fails fast on missing vars
- [ ] `app/database.py` — async engine + `get_db` dependency
- [ ] ORM models: User, Category, Supplier, Product, StockMovement — Alembic migration
- [ ] `app/core/security.py` — JWT (30-day token, no refresh needed), bcrypt
- [ ] Auth router: `POST /auth/login` returns token; `get_current_user` dependency
- [ ] Categories + Suppliers routers (simple CRUD)
- [ ] Products router + `POST /{id}/stock-in` and `POST /{id}/adjust`
  - Both call `product_service.adjust_stock()` — wraps stock update + StockMovement insert in one transaction
- [ ] React + Vite scaffold, Tailwind, shadcn/ui, login page, products list with low-stock badges

**Milestone:** Staff can log in, add products, and add stock.

---

### Phase 2 — Customers, Invoicing & Expenses
**Goal:** Create and send an invoice in under a minute. Log any expense in seconds.

- [ ] ORM models: Customer, Invoice, InvoiceItem, Payment — Alembic migration
- [ ] Auto-increment invoice number: `INV-0001`, `INV-0002`...
- [ ] Customers router (CRUD + search by name/phone)
- [ ] Invoice router + service:
  - DRAFT CRUD with server-side line-item math (`Decimal`)
  - `invoice_service.send()` — stock check, deduct, set SENT, trigger WhatsApp (all in one transaction)
  - `invoice_service.void()` — returns stock via RETURN movement
  - `invoice_service.record_payment()` — sets PARTIAL or PAID
- [ ] `pdf_service.generate()` — reportlab: shop name, items table, totals, payment status
- [ ] `whatsapp_service.send_invoice()` — Twilio: sends PDF link + amount due to customer
- [ ] Invoice builder UI: customer search/select, product search, quantity, live total, "Send" button
- [ ] ORM model: Expense — Alembic migration
- [ ] Expenses router + service: CRUD, filter by category and date
- [ ] Expense UI: simple form (category dropdown, amount, who paid to, date, note) + table with daily totals

**Milestone:** Can create an invoice, tap Send → customer gets WhatsApp with PDF. Can log expenses in a few taps.

---

### Phase 3 — Dashboard & Low Stock
**Goal:** Owner sees business health at a glance.

- [ ] Dashboard endpoints: `summary`, `low-stock`, `sales-trend`, `top-products` — all accept `from`/`to` query params
- [ ] Backend resolves shorthand period params (`today`, `3d`, `7d`, `30d`) to date ranges using shop timezone (`TIMEZONE` env var, default `Asia/Kolkata`)
- [ ] Dashboard UI layout:
  - **Period selector** at the top: `Today | Last 3 Days | This Week | This Month | Custom` — single tap switches all cards and charts
  - **4 KPI cards**: Total Sales, Total Expenses, Net Profit, No. of Invoices — all update with period
  - **Revenue vs Expenses bar chart** (one bar per day in the selected range, Recharts)
  - **Top 5 Products** table (units sold in period)
  - **Low Stock list** (always current, not date-filtered)
  - **Recent Invoices** (filtered to period)
- [ ] Period state lives in a `useDashboardPeriod` hook — single source of truth, shared by all dashboard components via React context or Zustand slice
- [ ] Low-stock banner on products page (always on, independent of period)

**Milestone:** Owner taps "Today" or "This Month" and all numbers update instantly. No page reload.**

---

### Phase 4 — Polish & Deploy
**Goal:** Stable, usable in the shop.

- [ ] Seed script with realistic demo data
- [ ] Offset pagination on lists (simple, good enough for shop scale)
- [ ] DB indexes: `(invoice.status, invoice.issued_at)`, `(product.current_stock)`, `(customer.phone)`
- [ ] Rate limiting (`slowapi`) on login endpoint only
- [ ] CORS, `TrustedHostMiddleware`
- [ ] `Dockerfile` (multi-stage), Nginx to serve frontend + proxy `/api/v1`

**Milestone:** Deployed and running.

---

## Architectural Rules

### Backend: Router → Service → Repository
- **Router**: parse HTTP request, call service, return Pydantic schema. No SQL.
- **Service**: business logic, calls repository, raises `AppException`. No FastAPI types.
- **Repository**: SQL queries only, returns ORM models. No logic.

### Frontend: Feature modules
Each feature (`features/products/`, etc.) owns its own api calls, components, hooks, and pages. Cross-feature imports are not allowed. Shared UI stays in `components/`.

### Stock changes go through one function
`product_service.adjust_stock(db, product_id, delta, type, reference_id, notes)` is the only way to change stock. It updates `current_stock` and inserts a `StockMovement` in the same transaction. Direct column updates are forbidden.

### Long-lived auth token (30 days)
Shop staff should stay logged in. No refresh token complexity. Token expires in 30 days. On expiry, user logs in again. This is appropriate for an internal tool on a trusted device.

### Walk-in sales
`customer_id` is nullable on Invoice. For walk-in customers without a profile, `customer_id = null` and no WhatsApp is sent. WhatsApp only fires when a customer with a `whatsapp_number` is attached.

### Money is never a float
Database: `NUMERIC(12, 2)`. Python: `Decimal`. Pydantic serializes as string in responses.

### Invoices are immutable once sent
Void and recreate. No in-place editing of sent invoices.

---

## Critical Files

| File | Why Critical |
|---|---|
| `backend/app/services/product_service.py` | `adjust_stock()` — all stock changes funnel here |
| `backend/app/services/invoice_service.py` | send/void/payment logic with transactions + WhatsApp trigger |
| `backend/app/core/security.py` | Auth token creation and verification |
| `frontend/src/features/invoices/components/InvoiceBuilder.tsx` | Primary daily-use UI — must be fast and simple |
| `frontend/src/features/dashboard/pages/DashboardPage.tsx` | First screen owner sees — must show the right info |

---

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/inventory

# Auth
SECRET_KEY=
ACCESS_TOKEN_EXPIRE_DAYS=30

# WhatsApp (Twilio)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# App
PORT=8000
ENVIRONMENT=development
CORS_ORIGINS=["http://localhost:5173"]
TIMEZONE=Asia/Kolkata                   # used for date range resolution on dashboard
```

## Python Dependencies (`requirements.txt`)

```
fastapi
uvicorn[standard]
sqlalchemy[asyncio]
asyncpg
alembic
pydantic[email]
pydantic-settings
python-jose[cryptography]
passlib[bcrypt]
reportlab
twilio
slowapi
python-multipart
```
