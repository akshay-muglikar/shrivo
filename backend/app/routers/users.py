import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException
from app.core.security import hash_password
from app.database import get_db, session_transaction
from app.dependencies import get_owner
from app.models.user import User
from app.schemas.auth import UserCreate, UserRead, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserRead])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_owner),
):
    result = await db.execute(select(User).order_by(User.created_at))
    return result.scalars().all()


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_owner),
):
    async with session_transaction(db):
        existing = await db.execute(select(User).where(User.email == body.email))
        if existing.scalar_one_or_none():
            raise AppException(status_code=400, detail="Email already in use")

        user = User(
            name=body.name,
            email=body.email,
            password_hash=hash_password(body.password),
            is_owner=body.is_owner,
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)
        return user


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: uuid.UUID,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_owner),
):
    async with session_transaction(db):
        user = await db.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if body.name is not None:
            user.name = body.name
        if body.email is not None:
            # check uniqueness
            dup = await db.execute(
                select(User).where(User.email == body.email).where(User.id != user_id)
            )
            if dup.scalar_one_or_none():
                raise AppException(status_code=400, detail="Email already in use")
            user.email = body.email
        if body.password is not None:
            user.password_hash = hash_password(body.password)
        if body.is_owner is not None:
            # prevent owner from demoting themselves
            if user.id == current_user.id and not body.is_owner:
                raise AppException(status_code=400, detail="You cannot remove your own owner role")
            user.is_owner = body.is_owner

        await db.flush()
        await db.refresh(user)
        return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_owner),
):
    async with session_transaction(db):
        user = await db.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if user.id == current_user.id:
            raise AppException(status_code=400, detail="You cannot delete your own account")
        await db.delete(user)
