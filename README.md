# Shrivo — Inventory & Billing Management System

A production-grade, full-stack SaaS application for small Indian retail businesses. Shrivo handles the full business workflow — from stock intake and supplier purchase orders to GST-compliant invoice generation, WhatsApp delivery, and real-time analytics.

**Live:** [shrivo-c7fybjezcfeqe9bj.canadacentral-01.azurewebsites.net](https://shrivo-c7fybjezcfeqe9bj.canadacentral-01.azurewebsites.net)

---

## Features

**Inventory & Batch Tracking**
- Per-product batch management with lot numbers and expiry dates
- FEFO (First Expiry First Out) auto-selection at point of sale
- Real-time stock ledger: every movement (sale, return, adjustment, damage) is journalled
- Low-stock alerts, expiry reports, and bulk stock updates

**GST-Compliant Invoicing**
- Auto-numbered invoices (`INV-XXXX`) with draft / paid / cancelled lifecycle
- Per-item CGST/SGST/IGST amounts snapshotted at sale time — immutable audit trail even if tax rates change later
- Intra-state vs. inter-state tax logic based on shop and customer state; HSN codes; GSTIN fields
- Invoice returns (`RET-XXXX`): partial or full, validates against already-returned quantities and restores batch stock
- Amount displayed in Indian words (Lakh/Crore formatting)

**Invoice Printing & PDF Export**
- Three print templates (classic, modern, minimal) across five paper sizes (A4, A5, Letter, 80mm thermal, 58mm thermal)
- Fully client-side PDF generation (html2canvas → jsPDF) — no server dependency
- Thermal receipt template with monospace compact layout

**WhatsApp Sharing**
- Three-tier share flow: native Web Share API with PDF file (mobile) → text-only share → `wa.me` deep-link (desktop)
- Customizable message template with shop and invoice variables

**Supplier & Purchase Order Management**
- Full PO lifecycle: draft → ordered → received/cancelled
- GRN (Goods Received Note) flow: receive against a PO, specify batch numbers and expiry dates per item — automatically creates batch records and stock movements
- Running payable ledger per supplier; supplier payments and supplier returns

**Customer CRM**
- Walk-in customers auto-created by phone number at invoice time
- Full customer records with GSTIN, state, and purchase history

**Dashboard & Analytics**
- Date-range filtered KPIs: revenue, net profit, stock value, supplier payables
- Daily sales trend chart; recent invoices and POs at a glance

**Role-Based Access Control**
- `owner` and `staff` roles; owner-only routes for settings, reports, and user management
- Self-demotion and self-deletion blocked server-side

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | FastAPI (Python 3.12), SQLAlchemy 2.0 (async), Alembic, asyncpg |
| **Database** | PostgreSQL 18 |
| **Auth** | JWT (HS256, 30-day), bcrypt, rate-limited login via slowapi |
| **Frontend** | React 19, TypeScript, Vite 8 |
| **UI** | shadcn/ui, Tailwind CSS v4, Recharts, TanStack Table |
| **State** | TanStack Query v5 (server), Zustand v5 (auth) |
| **Forms** | React Hook Form v7, Zod v4 |
| **Hosting** | Azure App Service (backend), Azure Static Web Apps (frontend) |
| **Database Host** | Render PostgreSQL |
| **CI/CD** | GitHub Actions (OIDC workload identity — no stored secrets) |
| **Containerization** | Docker, docker-compose, multi-stage frontend image (nginx) |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Azure Static Web Apps               │
│              React 19 + TypeScript (Vite)            │
│  TanStack Query · shadcn/ui · html2canvas + jsPDF   │
└──────────────────────────┬──────────────────────────┘
                           │ HTTPS / REST
┌──────────────────────────▼──────────────────────────┐
│                   Azure App Service                  │
│            FastAPI + uvicorn (2 workers)             │
│   Routers → Services → Repositories → SQLAlchemy    │
└──────────────────────────┬──────────────────────────┘
                           │ asyncpg
┌──────────────────────────▼──────────────────────────┐
│               Render PostgreSQL 18                   │
│         (20 Alembic migrations, async NullPool)      │
└─────────────────────────────────────────────────────┘
```

**Backend** follows a layered architecture: FastAPI routers handle HTTP concerns, a service layer owns all business logic (stock checks, FEFO selection, GST calculation, return validation), and repositories isolate complex queries. All write paths go through a `session_transaction` context manager for clean commit/rollback semantics.

**Frontend** uses a feature-sliced structure — each domain (`invoices`, `products`, `suppliers`, etc.) owns its own `api/`, `components/`, and `pages/` directories. Invoice settings (template, paper size, GST config, WhatsApp template) are persisted to `localStorage` so the app works offline for configuration without a backend round-trip.

**CI/CD** uses OIDC workload identity federation for Azure deployments — no long-lived credentials are stored in GitHub secrets.

---

## Project Structure

```
inventory/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app entry point, 12 routers, CORS, rate limiting
│   │   ├── models/            # 15 SQLAlchemy models
│   │   ├── schemas/           # Pydantic v2 request/response schemas
│   │   ├── routers/           # 12 REST API routers (all under /api/v1)
│   │   ├── services/          # Business logic: invoice, product, supplier, PO
│   │   ├── repositories/      # Data access layer for complex queries
│   │   └── core/              # JWT security, pagination, exception handling
│   ├── alembic/               # 20 database migration versions
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/router.tsx     # React Router v7 route tree with auth guards
│   │   ├── features/          # Feature-sliced modules
│   │   │   ├── invoices/      # CRUD, returns, print/PDF, WhatsApp share
│   │   │   ├── products/      # Batch management, stock movements, expiry report
│   │   │   ├── suppliers/     # PO lifecycle, GRN, payments, supplier returns
│   │   │   ├── dashboard/     # Analytics, KPI cards, sales trend
│   │   │   └── ...            # customers, expenses, settings, auth, landing
│   │   ├── components/        # Shared layout (AppShell, sidebar) + shadcn/ui
│   │   └── lib/               # Axios client, formatters, theme, date filters
│   ├── nginx.conf             # Proxies /api/ to backend; SPA fallback; 1-year asset cache
│   └── Dockerfile             # Multi-stage: node:20-alpine build → nginx:1.27-alpine serve
├── docker-compose.yml
├── render.yaml                # Full-stack Render.com IaC config
└── .github/workflows/         # Azure App Service + Azure Static Web Apps CI/CD
```

---

## Local Development

**Prerequisites:** Python 3.12+, Node.js 20+, PostgreSQL

**Backend**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Create a .env file
echo "DATABASE_URL=postgresql+asyncpg://user:pass@localhost/shrivo" > .env
echo "SECRET_KEY=your-secret-key" >> .env

alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend**
```bash
cd frontend
npm install
VITE_API_BASE_URL=http://localhost:8000/api/v1 npm run dev
```

**Docker (full stack)**
```bash
docker-compose up --build
# App available at http://localhost:80
```

---

## API Overview

All endpoints are under `/api/v1`. Authentication uses `Authorization: Bearer <token>`.

| Resource | Endpoints |
|---|---|
| Auth | `POST /auth/login`, `GET /auth/me`, `POST /auth/register` |
| Products | Full CRUD + stock-in, batch management, expiry report |
| Invoices | Full CRUD + return, cancel, status update |
| Purchase Orders | Full CRUD + receive (GRN), bulk operations |
| Suppliers | CRUD + payments, supplier returns |
| Customers | Full CRUD |
| Expenses | Full CRUD with date-range filtering |
| Dashboard | Aggregated KPIs + sales trend |
| Users | Owner-only CRUD for user management |

---

## Deployment

The production stack is fully automated via GitHub Actions:

1. **Push to `main`** triggers two parallel workflows
2. **Backend** — Python app is zipped (excluding venvs/cache), authenticated to Azure via OIDC, and deployed to Azure App Service. Container startup runs `alembic upgrade head` automatically before serving traffic.
3. **Frontend** — Vite builds with the production API URL injected as an env var, output deployed to Azure Static Web Apps.

An alternative `render.yaml` config supports one-click deployment to Render.com as a Docker-based backend + static frontend with a managed PostgreSQL instance.

---

## Key Technical Decisions

- **Async throughout:** `asyncpg` + SQLAlchemy 2.0 async engine with `NullPool` — appropriate for the stateless Azure App Service environment where persistent connection pools would leak.
- **Client-side PDF:** PDF rendering via `html2canvas` + `jsPDF` eliminates a server-side PDF dependency (no headless Chrome, no reportlab complexity in production).
- **Immutable GST snapshots:** Per-item tax amounts are recorded at invoice creation time, not calculated from current product rates — ensures historical invoices remain accurate after rate changes.
- **FEFO enforcement:** A single canonical `select_batches_fefo` function is the only path for batch selection at sale time, preventing accidental stock allocation out of expiry order.
- **OIDC CI/CD:** Workload identity federation means zero long-lived Azure credentials in GitHub — the deploy workflow authenticates ephemerally per run.
