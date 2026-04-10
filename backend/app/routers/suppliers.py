import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException
from app.core.pagination import PageParams
from app.database import get_db
from app.dependencies import get_current_user
from app.models.supplier import Supplier
from app.schemas.supplier import SupplierCreate, SupplierRead, SupplierUpdate

router = APIRouter(prefix="/suppliers", tags=["suppliers"])


@router.get("", response_model=dict)
async def list_suppliers(
    search: str | None = Query(None),
    page: PageParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    query = select(Supplier).where(Supplier.is_active == True).order_by(Supplier.name)  # noqa: E712
    if search:
        term = f"%{search}%"
        query = query.where(
            or_(
                Supplier.name.ilike(term),
                Supplier.phone.ilike(term),
                Supplier.notes.ilike(term),
            )
        )

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar_one()
    result = await db.execute(query.offset(page.offset).limit(page.limit))

    return {
        "total": total,
        "page": page.page,
        "limit": page.limit,
        "items": [SupplierRead.model_validate(supplier) for supplier in result.scalars().all()],
    }


@router.post("", response_model=SupplierRead, status_code=status.HTTP_201_CREATED)
async def create_supplier(body: SupplierCreate, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    supplier = Supplier(**body.model_dump())
    db.add(supplier)
    await db.commit()
    await db.refresh(supplier)
    return supplier


@router.put("/{supplier_id}", response_model=SupplierRead)
async def update_supplier(supplier_id: uuid.UUID, body: SupplierUpdate, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    supplier = await db.get(Supplier, supplier_id)
    if not supplier:
        raise AppException(404, "Supplier not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(supplier, field, value)
    await db.commit()
    await db.refresh(supplier)
    return supplier


@router.get("/{supplier_id}", response_model=SupplierRead)
async def get_supplier(supplier_id: uuid.UUID, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    supplier = await db.get(Supplier, supplier_id)
    if not supplier:
        raise AppException(404, "Supplier not found")
    return SupplierRead.model_validate(supplier)


@router.delete("/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_supplier(supplier_id: uuid.UUID, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    supplier = await db.get(Supplier, supplier_id)
    if not supplier:
        raise AppException(404, "Supplier not found")
    supplier.is_active = False
    await db.commit()
