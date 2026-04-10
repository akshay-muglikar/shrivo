import uuid
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel


class POItemCreate(BaseModel):
    product_id: uuid.UUID | None = None
    product_name: str
    quantity: int
    unit_cost: Decimal


class POItemRead(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID | None
    product_name: str
    quantity: int
    unit_cost: Decimal
    line_total: Decimal

    model_config = {"from_attributes": True}


class SupplierSummary(BaseModel):
    id: uuid.UUID
    name: str

    model_config = {"from_attributes": True}


class PurchaseOrderCreate(BaseModel):
    supplier_id: uuid.UUID
    status: str = "draft"
    notes: str | None = None
    items: list[POItemCreate]


class PurchaseOrderUpdate(BaseModel):
    status: str | None = None
    notes: str | None = None


class PurchaseOrderRead(BaseModel):
    id: uuid.UUID
    po_number: str
    supplier: SupplierSummary
    status: str
    notes: str | None
    total_amount: Decimal
    created_at: datetime
    received_at: datetime | None
    items: list[POItemRead]

    model_config = {"from_attributes": True}


class PurchaseOrderListItem(BaseModel):
    id: uuid.UUID
    po_number: str
    supplier: SupplierSummary
    status: str
    total_amount: Decimal
    created_at: datetime

    model_config = {"from_attributes": True}


class SupplierPaymentCreate(BaseModel):
    amount: Decimal
    notes: str | None = None


class SupplierPaymentRead(BaseModel):
    id: uuid.UUID
    supplier_id: uuid.UUID
    amount: Decimal
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
