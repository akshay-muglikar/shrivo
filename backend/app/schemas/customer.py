import uuid
from datetime import datetime

from pydantic import BaseModel


class CustomerCreate(BaseModel):
    name: str
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    gstin: str | None = None
    state: str | None = None


class CustomerUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    gstin: str | None = None
    state: str | None = None


class CustomerRead(BaseModel):
    id: uuid.UUID
    name: str
    phone: str | None
    email: str | None
    address: str | None
    gstin: str | None
    state: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
