import uuid
from pydantic import BaseModel


class SupplierCreate(BaseModel):
    name: str
    phone: str | None = None
    notes: str | None = None


class SupplierUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    notes: str | None = None
    is_active: bool | None = None


class SupplierRead(BaseModel):
    id: uuid.UUID
    name: str
    phone: str | None
    notes: str | None
    is_active: bool

    model_config = {"from_attributes": True}
