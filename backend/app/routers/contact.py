import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException
from app.database import get_db, session_transaction
from app.dependencies import get_owner
from app.models.contact_lead import ContactLead

router = APIRouter(prefix="/contact", tags=["contact"])


class ContactLeadCreate(BaseModel):
    name: str
    email: str
    phone: str | None = None
    business_name: str | None = None
    message: str


class ContactLeadRead(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    phone: str | None
    business_name: str | None
    message: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


@router.post("/leads", status_code=status.HTTP_201_CREATED)
async def create_contact_lead(
    body: ContactLeadCreate,
    db: AsyncSession = Depends(get_db),
):
    name = body.name.strip()
    email = body.email.strip().lower()
    message = body.message.strip()

    if len(name) < 2:
        raise AppException(status_code=400, detail="Name is required")
    if "@" not in email or "." not in email.split("@")[-1]:
        raise AppException(status_code=400, detail="Valid email is required")
    if len(message) < 10:
        raise AppException(status_code=400, detail="Message should be at least 10 characters")

    async with session_transaction(db):
        lead = ContactLead(
            name=name,
            email=email,
            phone=body.phone.strip() if body.phone else None,
            business_name=body.business_name.strip() if body.business_name else None,
            message=message,
        )
        db.add(lead)
        await db.flush()
        return {"id": str(lead.id), "status": lead.status}


@router.get("/leads", response_model=list[ContactLeadRead])
async def list_contact_leads(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_owner),
):
    result = await db.execute(select(ContactLead).order_by(ContactLead.created_at.desc()))
    return result.scalars().all()


@router.patch("/leads/{lead_id}/close", status_code=status.HTTP_200_OK)
async def close_contact_lead(
    lead_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_owner),
):
    async with session_transaction(db):
        lead = await db.get(ContactLead, lead_id)
        if not lead:
            raise AppException(status_code=404, detail="Lead not found")
        lead.status = "closed"
        await db.flush()
        return {"id": str(lead.id), "status": lead.status}