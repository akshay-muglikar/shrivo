# Inventory

Inventory is a FastAPI + React application for billing, inventory, customers, suppliers, expenses, and dashboard reporting.

## Services

- Backend: FastAPI + SQLAlchemy + Alembic
- Frontend: React + Vite
- Database: PostgreSQL

## Local Development

### 1. Start Postgres

Make sure Docker Desktop is running, then start the local services:

```bash
docker compose up -d
```

### 2. Configure environment

Use [.env.example](/Users/akshay/Documents/repos/inventory/.env.example) as the starting point for local configuration.

### 3. Run migrations and seed data

```bash
cd backend
source .venv/bin/activate
alembic upgrade head
python seed.py
```

### 4. Start the backend

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs: http://localhost:8000/docs

### 5. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:5173

### Seed login credentials

- owner@shop.com / owner123
- staff@shop.com / staff123

## Environment Variables

### Backend

These values are loaded by [backend/app/config.py](/Users/akshay/Documents/repos/inventory/backend/app/config.py).

Required:

```env
DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@HOST:5432/DBNAME?ssl=require
SECRET_KEY=replace-with-a-long-random-secret
```

Recommended:

```env
ACCESS_TOKEN_EXPIRE_DAYS=30
ENVIRONMENT=production
CORS_ORIGINS=["http://localhost:5173"]
TIMEZONE=Asia/Kolkata
```

Optional:

```env
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
PORT=8000
```

Notes:

- `DATABASE_URL` must use `postgresql+asyncpg://`, not plain `postgresql://`, because the backend uses SQLAlchemy async.
- `CORS_ORIGINS` must be a JSON array string.
- Render usually provides `PORT` automatically.

### Frontend

The frontend can run locally without extra variables because Vite proxies API calls during development. For deployed builds, set:

```env
VITE_API_BASE_URL=https://your-backend-domain/api/v1
```

Notes:

- `VITE_API_BASE_URL` is baked in at build time.
- If omitted, the frontend falls back to `/api/v1`.

### Docker Compose variables

If you use [docker-compose.yml](/Users/akshay/Documents/repos/inventory/docker-compose.yml), these additional variables may be used:

```env
POSTGRES_USER=inventory
POSTGRES_PASSWORD=your_password
POSTGRES_DB=inventory
DOMAIN=localhost
APP_PORT=80
```

## Docker

The repo already includes one Dockerfile per service:

- Backend: [backend/Dockerfile](/Users/akshay/Documents/repos/inventory/backend/Dockerfile)
- Frontend: [frontend/Dockerfile](/Users/akshay/Documents/repos/inventory/frontend/Dockerfile)

## Render Deployment

The repo includes a Render Blueprint at [render.yaml](/Users/akshay/Documents/repos/inventory/render.yaml).

Backend service env vars on Render:

```env
DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@HOST:5432/DBNAME?ssl=require
SECRET_KEY=replace-with-a-long-random-secret
ENVIRONMENT=production
ACCESS_TOKEN_EXPIRE_DAYS=30
CORS_ORIGINS=["https://your-frontend.onrender.com"]
```

Frontend service env vars on Render:

```env
VITE_API_BASE_URL=https://your-backend.onrender.com/api/v1
```

Render notes:

- Do not use plain `postgresql://...` for the backend service.
- If you use a Render-managed database connection string, convert it to `postgresql+asyncpg://...`.
- `VITE_API_BASE_URL` must point to the public backend URL.

## Azure Deployment

Azure-specific deployment notes are documented in [AZURE_APP_SERVICE.md](/Users/akshay/Documents/repos/inventory/AZURE_APP_SERVICE.md).
