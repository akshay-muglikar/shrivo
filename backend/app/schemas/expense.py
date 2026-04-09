import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_serializer


class ExpenseCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    category: str | None = Field(default=None, max_length=100)
    amount: Decimal = Field(gt=0)
    expense_date: date
    notes: str | None = None


class ExpenseUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    category: str | None = Field(default=None, max_length=100)
    amount: Decimal | None = Field(default=None, gt=0)
    expense_date: date | None = None
    notes: str | None = None


class ExpenseRead(BaseModel):
    id: uuid.UUID
    title: str
    category: str | None
    amount: Decimal
    expense_date: date
    notes: str | None
    created_at: datetime

    @field_serializer("amount")
    def serialize_decimal(self, value: Decimal) -> str:
        return str(value)

    model_config = {"from_attributes": True}