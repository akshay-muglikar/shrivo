from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.core.exceptions import AppException, app_exception_handler
from app.routers import auth, categories, contact, customers, dashboard, expenses, invoices, products, suppliers, support, users

app = FastAPI(title="Inventory & Billing API", version="1.0.0")

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


@app.get("/health")
async def health():
    return {"status": "ok"}
