import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_serializer

from app.schemas.customer import CustomerRead


class InvoiceItemCreate(BaseModel):
    product_id: uuid.UUID
    batch_id: uuid.UUID | None = None
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
    # GST Phase 3
    is_gst_invoice: bool = False
    supply_type: str = "intra"  # "intra" | "inter"
    place_of_supply: str | None = None
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
    gst_rate: Decimal
    price_includes_gst: bool
    quantity: int
    unit_price: Decimal
    line_total: Decimal
    mrp: Decimal | None = None
    batch_number: str | None = None
    expiry_date: date | None = None

    cgst_rate: Decimal
    sgst_rate: Decimal
    igst_rate: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    igst_amount: Decimal

    @field_serializer("gst_rate", "unit_price", "line_total", "cgst_rate", "sgst_rate", "igst_rate", "cgst_amount", "sgst_amount", "igst_amount")
    def serialize_decimal(self, value: Decimal) -> str:
        return str(value)

    @field_serializer("mrp")
    def serialize_mrp(self, value: Decimal | None) -> str | None:
        return str(value) if value is not None else None

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
    is_gst_invoice: bool
    supply_type: str
    place_of_supply: str | None
    buyer_gstin: str | None
    total_cgst: Decimal
    total_sgst: Decimal
    total_igst: Decimal
    created_at: datetime
    items: list[InvoiceItemRead]

    @field_serializer("subtotal", "discount_value", "discount_amount", "tax_rate", "tax_amount", "total", "total_cgst", "total_sgst", "total_igst")
    def serialize_decimal(self, value: Decimal) -> str:
        return str(value)

    model_config = {"from_attributes": True}


class InvoiceReturnItemCreate(BaseModel):
    invoice_item_id: uuid.UUID
    quantity: int = Field(gt=0)


class InvoiceReturnCreate(BaseModel):
    items: list[InvoiceReturnItemCreate]
    notes: str | None = None


class InvoiceReturnItemRead(BaseModel):
    id: uuid.UUID
    invoice_item_id: uuid.UUID | None
    product_id: uuid.UUID | None
    product_name: str
    batch_number: str | None
    quantity: int

    model_config = {"from_attributes": True}


class InvoiceReturnRead(BaseModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    return_number: str
    notes: str | None
    created_at: datetime
    items: list[InvoiceReturnItemRead]

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
