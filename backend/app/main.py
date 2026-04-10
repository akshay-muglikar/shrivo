from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.config import settings
from app.core.exceptions import AppException, app_exception_handler
from app.routers import auth, categories, contact, customers, dashboard, expenses, invoices, products, suppliers, support, users
from app.routers import purchase_orders

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Inventory & Billing API", version="1.0.0")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(AppException, app_exception_handler)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(categories.router, prefix="/api/v1")
app.include_router(suppliers.router, prefix="/api/v1")
app.include_router(products.router, prefix="/api/v1")
app.include_router(customers.router, prefix="/api/v1")
app.include_router(expenses.router, prefix="/api/v1")
app.include_router(invoices.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(support.router, prefix="/api/v1")
app.include_router(contact.router, prefix="/api/v1")
app.include_router(purchase_orders.router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}
