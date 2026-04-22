# Shrivo — Codebase Reference for Claude

This file is the authoritative quick-reference for the Shrivo codebase. Read it before asking questions or exploring files.

---

## What This App Is

Shrivo is a full-stack inventory + billing SaaS for small Indian retail shops (pharmacies, general stores). Core workflow: receive stock from suppliers → create GST-compliant invoices → send via WhatsApp → track expenses → view dashboard analytics. Indian-market specific: INR, Lakh/Crore words, CGST/SGST/IGST, HSN codes, GSTIN fields, state-based tax logic.

---

## Monorepo Layout

```
inventory/
├── backend/          FastAPI Python app
├── frontend/         React TypeScript app (Vite)
├── docker-compose.yml
├── render.yaml       Render.com IaC (alternative to Azure)
└── .github/workflows/
    ├── azure-static-web-apps-ashy-water-0f203721e.yml  → frontend to Azure SWA
    └── main_shrivo.yml                                  → backend to Azure App Service (OIDC)
```

---

## Tech Stack

**Backend:** FastAPI (Python 3.12), SQLAlchemy 2.0 async, asyncpg, Alembic, Pydantic v2, python-jose (JWT HS256), passlib bcrypt, slowapi (rate limiting)

**Frontend:** React 19, TypeScript, Vite 8, React Router v7, TanStack Query v5, Zustand v5 (auth only), React Hook Form v7, Zod v4, shadcn/ui, Tailwind CSS v4, Recharts v3, TanStack Table v8, jspdf + html2canvas (PDF), Sonner (toasts), @dnd-kit (drag and drop)

**Infra:** Azure App Service (backend), Azure Static Web Apps (frontend), Render PostgreSQL 18 (database), GitHub Actions CI/CD with OIDC (no stored secrets)

---

## Backend Structure

```
backend/app/
├── main.py            FastAPI app, 12 routers mounted at /api/v1, CORS, rate limiting
├── config.py          pydantic-settings: DATABASE_URL, SECRET_KEY, Twilio, CORS origins
├── database.py        Async SQLAlchemy engine (NullPool), session_transaction() context manager
├── dependencies.py    get_current_user(), get_owner() FastAPI deps
├── core/
│   ├── security.py    bcrypt hash/verify, JWT encode/decode
│   ├── pagination.py  PageParams (page/limit/offset)
│   └── exceptions.py  AppException + global handler
├── models/            15 SQLAlchemy ORM models (see Models section below)
├── schemas/           Pydantic v2 request/response schemas (mirror models/)
├── routers/           12 FastAPI routers — HTTP layer only, delegate to services
├── services/          Business logic layer (invoice_service, product_service, etc.)
└── repositories/      Complex query layer (invoice_repo, product_repo, customer_repo, expense_repo)
```

**Layering rule:** routers → services → repositories → SQLAlchemy. Simple CRUD may skip repositories and go router → service directly. All writes use `session_transaction()` for commit/rollback.

### Key Routers (`/api/v1/...`)

| Router file | Prefix | Notes |
|---|---|---|
| auth.py | /auth | login, me, register |
| products.py | /products | CRUD + stock-in + batch ops |
| invoices.py | /invoices | CRUD + return + cancel |
| purchase_orders.py | /purchase-orders | PO lifecycle + GRN receive + bulk ops + supplier returns + supplier payments |
| suppliers.py | /suppliers | CRUD |
| customers.py | /customers | CRUD |
| expenses.py | /expenses | CRUD with date filter |
| dashboard.py | /dashboard | aggregated KPIs + daily trend |
| users.py | /users | owner-only user management |
| tickets.py | /tickets | support tickets |
| contact.py | /contact | public contact form (no auth) |

### Models

Core models (all in `backend/app/models/`):

- `User` — id, email, name, hashed_password, role (`owner`|`staff`), is_active
- `Product` — id, name, sku (unique), category, supplier_id, unit_of_measure, current_stock, low_stock_threshold, gst_rate, hsn_code, price_includes_gst, selling_price, is_active
- `ProductBatch` — id, product_id, batch_number, expiry_date, quantity_remaining, cost_price, created_at
- `StockMovement` — id, product_id, batch_id, movement_type (`stock_in`|`sale`|`adjustment`|`return`|`damage`), quantity, reference_id, reference_type, notes, created_at
- `Supplier` — id, name, contact, email, address, balance (payable)
- `SupplierPayment` — id, supplier_id, amount, notes, created_at
- `PurchaseOrder` — id, po_number (`PO-XXXX`), supplier_id, status (`draft`|`ordered`|`received`|`cancelled`), items (JSON), total_amount
- `Customer` — id, name, phone (unique), email, address, gstin, state
- `Invoice` — id, invoice_number (`INV-XXXX`), customer_id, status (`draft`|`paid`|`cancelled`), payment_method, buyer_gstin, place_of_supply, supply_type, items (JSON with per-item cgst/sgst/igst snapshotted), subtotal, tax_amount, discount_amount, total
- `InvoiceReturn` — id, return_number (`RET-XXXX`), invoice_id, items (JSON), reason, refund_amount
- `Expense` — id, description, amount, category, date, created_by
- `Ticket` — id, user_id, subject, message, status (`open`|`closed`)
- `ContactLead` — id, name, email, phone, message, status

### Critical Business Logic

**Stock integrity (`product_service.py`):**
- `adjust_stock()` is the ONLY function that should modify stock. It atomically updates `Product.current_stock` and writes a `StockMovement` row in the same transaction. Never update stock directly outside this function.

**FEFO batch selection (`invoice_service.py` → `select_batches_fefo()`):**
- At invoice creation, batches are allocated in First-Expiry-First-Out order. Returns a list of `(batch_id, qty_to_deduct)` pairs. Always use this function for sale allocations — never pick batches manually.

**GST snapshot:**
- Per-item CGST/SGST/IGST amounts are computed and stored on the `InvoiceItem` at creation time. They are NOT recalculated from current product GST rates later. This is intentional — historical invoices must remain accurate after rate changes.

**Intra vs. inter-state tax:**
- If `shop_state == customer_state` → CGST + SGST each at `gst_rate / 2`
- If different states → IGST at full `gst_rate`
- Determined from `supply_type` field on Invoice (`intra_state` | `inter_state`)

**Invoice return validation:**
- Before creating a return, the service checks `already_returned_qty` per item across all existing returns for that invoice. Prevents over-returning.

**PO → GRN flow:**
- Receiving a PO creates one `ProductBatch` per line item, calls `adjust_stock()` for each, and increments `Supplier.balance`.

---

## Frontend Structure

```
frontend/src/
├── app/router.tsx        React Router v7 route tree; auth guards via OwnerOnly component
├── features/             Feature-sliced — each feature owns api/, components/, pages/
│   ├── auth/             JWT login, Zustand store, /me hydration
│   ├── dashboard/        KPI cards, daily sales Recharts line chart
│   ├── products/         CRUD, stock-in modal, batch management, expiry report
│   ├── invoices/         CRUD, returns, print/PDF, WhatsApp share
│   ├── suppliers/        CRUD, PO lifecycle, GRN modal, payments, supplier returns
│   ├── customers/        CRUD
│   ├── expenses/         CRUD with date filter
│   ├── settings/         Invoice settings, user management, tickets (owner only)
│   ├── help/             Support ticket form (staff)
│   ├── landing/          Public landing page
│   └── contact/          Public contact form
├── components/
│   ├── layout/           AppShell, Sidebar, TopNav — main authenticated shell
│   └── ui/               shadcn/ui primitives (Button, Dialog, Table, etc.)
└── lib/
    ├── api-client.ts     Axios instance; Bearer token injected by request interceptor; 401 → redirect by response interceptor
    ├── formatters.ts     INR currency, Indian number words, date formatting
    ├── date-filters.ts   Preset date range helpers (today, this month, etc.)
    └── theme.ts          Theme utilities
```

### Key Frontend Files

- `src/lib/api-client.ts` — all API calls go through this Axios instance; modify auth logic here
- `src/app/router.tsx` — full route tree; add new pages here
- `src/features/invoices/utils/printInvoice.ts` — builds full invoice HTML (all 3 templates × 5 paper sizes); thermal + full-page paths
- `src/features/invoices/utils/whatsappShare.ts` — 3-tier share: Web Share API with PDF → text-only share → wa.me deep-link
- `src/features/auth/store/authStore.ts` — Zustand store; `user`, `token`, `setUser`, `logout`

### State Management Pattern

- **Server state:** TanStack Query (`useQuery`, `useMutation`). On mutation success, call `queryClient.invalidateQueries()` for the affected resource key.
- **Auth state:** Zustand store (`useAuthStore`). Token is stored in `localStorage`; user object is hydrated from `/auth/me` on page load.
- **Invoice settings** (template, paper size, shop info, GST config, WhatsApp template): `localStorage` directly — no backend, no Zustand. Read with `localStorage.getItem`, write with `localStorage.setItem`.

### Auth Flow

1. `POST /auth/login` → returns `{ access_token, user }`
2. Token stored to `localStorage` + Zustand store
3. Axios request interceptor reads token from `localStorage` and adds `Authorization: Bearer <token>`
4. Axios response interceptor: on 401, clears token and redirects to `/login`
5. On app load, if token in `localStorage` but no user in store, fetches `GET /auth/me` to rehydrate

### Role Gating

- Backend: `get_owner` dependency on owner-only endpoints; `get_current_user` for authenticated-only
- Frontend: `OwnerOnly` component wraps owner-only routes in `router.tsx`; also used inline to hide UI elements

---

## PDF & Print

PDF is entirely client-side:
1. `printInvoice.ts` builds an HTML string (no React) for the selected template and paper size
2. The HTML is written into a hidden `<iframe>`
3. `html2canvas` captures the iframe content as a canvas
4. `jsPDF` converts canvas to PDF blob
5. Blob is used for download or passed to Web Share API

Lazy-loaded — `jspdf` and `html2canvas` are not in the initial bundle.

---

## Deployment & CI/CD

**Production URLs:**
- Backend: `https://shrivo-c7fybjezcfeqe9bj.canadacentral-01.azurewebsites.net`
- Frontend: Azure Static Web Apps (`ashy-water-0f203721e.azurestaticapps.net`)
- DB: Render PostgreSQL 18, Singapore region

**CI/CD (GitHub Actions):**
- Push to `main` → two parallel jobs:
  1. Frontend build (Vite) with `VITE_API_BASE_URL` injected → deploy to Azure SWA
  2. Backend zip deploy → Azure App Service via OIDC (no stored secrets)
- Container startup command: `alembic upgrade head && gunicorn -w 2 -k uvicorn.workers.UvicornWorker app.main:app`
- Migrations run automatically on every deploy

**Docker (local/Render):**
- `docker-compose up --build` starts backend + frontend; nginx proxies `/api/` to backend
- `frontend/nginx.conf`: proxies `/api/` → `backend:8000`, SPA fallback for all other routes, 1-year cache for static assets

---

## Database Notes

- NullPool is intentional — Azure App Service is stateless; persistent pools cause connection exhaustion
- `statement_cache_size: 0` on asyncpg to avoid prepared statement conflicts across connections
- 20 Alembic migration versions in `backend/alembic/versions/`
- To create a new migration: `alembic revision --autogenerate -m "description"` then inspect before applying

---

## Common Patterns

**Adding a new API endpoint:**
1. Add Pydantic schemas to `schemas/`
2. Add SQLAlchemy model changes + Alembic migration if needed
3. Add business logic to `services/`
4. Add router handler in `routers/` using `session_transaction()`
5. Register router in `main.py` if new file

**Adding a new frontend page:**
1. Create `features/<domain>/pages/NewPage.tsx`
2. Add route to `src/app/router.tsx`
3. Add nav link in `components/layout/Sidebar.tsx` if needed
4. Create `features/<domain>/api/` hooks using `useQuery`/`useMutation`

**Paginated list endpoints return:**
```json
{ "total": 100, "page": 1, "limit": 20, "items": [...] }
```

**All timestamps are UTC. Format for display using `formatters.ts`.**
