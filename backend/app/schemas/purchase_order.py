import uuid
from datetime import date, datetime
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
    received_quantity: int | None = None
    batch_number: str | None = None
    expiry_date: date | None = None

    model_config = {"from_attributes": True}


class GRNItemData(BaseModel):
    po_item_id: uuid.UUID
    batch_number: str | None = None
    expiry_date: date | None = None
    received_quantity: int | None = None  # defaults to ordered quantity if None


class GRNReceiveData(BaseModel):
    supplier_invoice_no: str | None = None
    items: list[GRNItemData] | None = None


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
    supplier_invoice_no: str | None = None
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


class SupplierReturnItemCreate(BaseModel):
    product_id: uuid.UUID | None = None
    product_name: str
    quantity: int
    unit_cost: Decimal
    batch_id: uuid.UUID | None = None


class SupplierReturnCreate(BaseModel):
    supplier_credit_note_no: str | None = None
    notes: str | None = None
    items: list[SupplierReturnItemCreate]


class SupplierReturnItemRead(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID | None
    batch_id: uuid.UUID | None
    product_name: str
    quantity: int
    unit_cost: Decimal
    line_total: Decimal
    batch_number: str | None = None
    expiry_date: date | None = None

    model_config = {"from_attributes": True}


class SupplierReturnRead(BaseModel):
    id: uuid.UUID
    return_number: str
    supplier: SupplierSummary
    supplier_credit_note_no: str | None = None
    notes: str | None
    total_amount: Decimal
    created_at: datetime
    items: list[SupplierReturnItemRead]

    model_config = {"from_attributes": True}
