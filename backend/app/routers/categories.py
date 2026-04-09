import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException
from app.database import get_db
from app.dependencies import get_current_user
from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryRead, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryRead])
async def list_categories(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(Category).order_by(Category.name))
    return result.scalars().all()


@router.post("", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
async def create_category(body: CategoryCreate, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    category = Category(**body.model_dump())
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


@router.put("/{category_id}", response_model=CategoryRead)
async def update_category(category_id: uuid.UUID, body: CategoryUpdate, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    category = await db.get(Category, category_id)
    if not category:
        raise AppException(404, "Category not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    await db.commit()
    await db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(category_id: uuid.UUID, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    category = await db.get(Category, category_id)
    if not category:
        raise AppException(404, "Category not found")
    await db.delete(category)
    await db.commit()
