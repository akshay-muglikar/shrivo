import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_serializer

from app.schemas.customer import CustomerRead


class InvoiceItemCreate(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(gt=0)
    unit_price: Decimal = Field(gt=0)


class InvoiceCreate(BaseModel):
    customer_id: uuid.UUID | None = None
    walk_in_customer_name: str | None = None
    walk_in_customer_phone: str | None = None
    discount_type: str | None = None  # "percent" | "flat" | None
    discount_value: Decimal = Field(default=Decimal("0"), ge=0)
    tax_rate: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    payment_method: str = "cash"
    notes: str | None = None
    items: list[InvoiceItemCreate]


class InvoiceUpdate(BaseModel):
    payment_method: str | None = None
    notes: str | None = None
    status: str | None = None


class InvoiceItemRead(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID | None
    product_name: str
    hsn_code: str | None
    quantity: int
    unit_price: Decimal
    line_total: Decimal

    @field_serializer("unit_price", "line_total")
    def serialize_decimal(self, value: Decimal) -> str:
        return str(value)

    model_config = {"from_attributes": True}


class InvoiceRead(BaseModel):
    id: uuid.UUID
    invoice_number: str
    customer: CustomerRead | None
    walk_in_customer_name: str | None
    walk_in_customer_phone: str | None
    status: str
    payment_method: str
    subtotal: Decimal
    discount_type: str | None
    discount_value: Decimal
    discount_amount: Decimal
    tax_rate: Decimal
    tax_amount: Decimal
    total: Decimal
    notes: str | None
    created_at: datetime
    items: list[InvoiceItemRead]

    @field_serializer("subtotal", "discount_value", "discount_amount", "tax_rate", "tax_amount", "total")
    def serialize_decimal(self, value: Decimal) -> str:
        return str(value)

    model_config = {"from_attributes": True}


class InvoiceListItem(BaseModel):
    id: uuid.UUID
    invoice_number: str
    customer: CustomerRead | None
    walk_in_customer_name: str | None
    walk_in_customer_phone: str | None
    status: str
    payment_method: str
    total: Decimal
    created_at: datetime

    @field_serializer("total")
    def serialize_decimal(self, value: Decimal) -> str:
        return str(value)

    model_config = {"from_attributes": True}
