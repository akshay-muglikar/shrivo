import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, session_transaction
from app.dependencies import get_current_user, get_owner
from app.models.support_ticket import SupportTicket
from app.models.user import User

router = APIRouter(prefix="/support", tags=["support"])


class TicketCreate(BaseModel):
    subject: str
    message: str


class TicketRead(BaseModel):
    id: uuid.UUID
    subject: str
    message: str
    status: str
    submitted_by_name: Optional[str]
    submitted_by_email: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


@router.post("/tickets", status_code=status.HTTP_201_CREATED)
async def create_ticket(
    body: TicketCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    async with session_transaction(db):
        ticket = SupportTicket(
            subject=body.subject,
            message=body.message,
            submitted_by_id=current_user.id,
        )
        db.add(ticket)
        await db.flush()
        return {"id": str(ticket.id), "status": "open"}


@router.get("/tickets", response_model=list[TicketRead])
async def list_tickets(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_owner),
):
    result = await db.execute(
        select(SupportTicket)
        .options(selectinload(SupportTicket.submitted_by))
        .order_by(SupportTicket.created_at.desc())
    )
    tickets = result.scalars().all()
    return [
        TicketRead(
            id=t.id,
            subject=t.subject,
            message=t.message,
            status=t.status,
            submitted_by_name=t.submitted_by.name if t.submitted_by else None,
            submitted_by_email=t.submitted_by.email if t.submitted_by else None,
            created_at=t.created_at,
        )
        for t in tickets
    ]


@router.patch("/tickets/{ticket_id}/close", status_code=status.HTTP_200_OK)
async def close_ticket(
    ticket_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_owner),
):
    async with session_transaction(db):
        ticket = await db.get(SupportTicket, ticket_id)
        if not ticket:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Ticket not found")
        ticket.status = "closed"
        await db.flush()
        return {"id": str(ticket.id), "status": "closed"}
