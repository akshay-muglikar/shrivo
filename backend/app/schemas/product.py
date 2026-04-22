import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, field_serializer

from app.models.product import UnitOfMeasure
from app.models.stock_movement import MovementType
from app.schemas.category import CategoryRead
from app.schemas.supplier import SupplierRead


class ProductCreate(BaseModel):
    name: str
    sku: str
    category_id: uuid.UUID | None = None
    supplier_id: uuid.UUID | None = None
    description: str | None = None
    unit_of_measure: UnitOfMeasure = UnitOfMeasure.PIECE
    cost_price: Decimal = Decimal("0")
    selling_price: Decimal = Decimal("0")
    low_stock_threshold: int = 5
    hsn_code: str | None = None
    gst_rate: Decimal = Decimal("0")
    price_includes_gst: bool = False


class ProductUpdate(BaseModel):
    name: str | None = None
    sku: str | None = None
    category_id: uuid.UUID | None = None
    supplier_id: uuid.UUID | None = None
    description: str | None = None
    unit_of_measure: UnitOfMeasure | None = None
    cost_price: Decimal | None = None
    selling_price: Decimal | None = None
    low_stock_threshold: int | None = None
    is_active: bool | None = None
    hsn_code: str | None = None
    gst_rate: Decimal | None = None
    price_includes_gst: bool | None = None


class ProductRead(BaseModel):
    id: uuid.UUID
    name: str
    sku: str
    description: str | None
    unit_of_measure: str
    cost_price: Decimal
    selling_price: Decimal
    current_stock: int
    low_stock_threshold: int
    is_active: bool
    hsn_code: str | None
    gst_rate: Decimal
    price_includes_gst: bool
    category: CategoryRead | None
    supplier: SupplierRead | None

    @field_serializer("cost_price", "selling_price", "gst_rate")
    def serialize_decimal(self, value: Decimal) -> str:
        return str(value)

    model_config = {"from_attributes": True}


class StockInRequest(BaseModel):
    quantity: int
    cost_price: Decimal | None = None
    notes: str | None = None
    batch_number: str | None = None
    expiry_date: date | None = None


class ProductBatchRead(BaseModel):
    id: uuid.UUID
    batch_number: str | None
    expiry_date: date | None
    quantity_remaining: int
    cost_price: Decimal | None
    notes: str | None
    created_at: datetime

    @field_serializer("cost_price")
    def serialize_decimal(self, value: Decimal | None) -> str | None:
        return str(value) if value is not None else None

    model_config = {"from_attributes": True}


class ProductBatchWithProductRead(BaseModel):
    """Batch record with the parent product's name and SKU — used for the expiry report."""
    id: uuid.UUID
    product_id: uuid.UUID
    product_name: str
    product_sku: str
    batch_number: str | None
    expiry_date: date | None
    quantity_remaining: int
    cost_price: Decimal | None
    notes: str | None
    created_at: datetime

    @field_serializer("cost_price")
    def serialize_decimal(self, value: Decimal | None) -> str | None:
        return str(value) if value is not None else None

    model_config = {"from_attributes": True}


class StockAdjustRequest(BaseModel):
    delta: int  # positive or negative
    reason: str


class StockMovementRead(BaseModel):
    id: uuid.UUID
    movement_type: str
    quantity_delta: int
    notes: str | None
    created_at: str

    model_config = {"from_attributes": True}
