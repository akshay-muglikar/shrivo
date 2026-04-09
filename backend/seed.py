"""Run: python seed.py  (from backend/ with venv active)"""
import asyncio
import uuid

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.core.security import hash_password
from app.models.category import Category
from app.models.product import Product, UnitOfMeasure
from app.models.supplier import Supplier
from app.models.user import User

engine = create_async_engine(settings.DATABASE_URL)
Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def seed():
    async with Session() as db:
        async with db.begin():
            # Users
            owner = User(name="Shop Owner", email="owner@shop.com", password_hash=hash_password("owner123"), is_owner=True)
            staff = User(name="Staff", email="staff@shop.com", password_hash=hash_password("staff123"), is_owner=False)
            db.add_all([owner, staff])
            await db.flush()

            # Categories
            cat_snacks = Category(name="Snacks", description="Chips, biscuits, candies")
            cat_drinks = Category(name="Drinks", description="Beverages and juices")
            cat_grocery = Category(name="Grocery", description="Daily grocery items")
            db.add_all([cat_snacks, cat_drinks, cat_grocery])
            await db.flush()

            # Suppliers
            sup1 = Supplier(name="Metro Wholesale", phone="9876543210")
            sup2 = Supplier(name="Local Distributor", phone="9123456789")
            db.add_all([sup1, sup2])
            await db.flush()

            # Products
            products = [
                Product(name="Lay's Classic Salted", sku="LAY-001", category_id=cat_snacks.id, supplier_id=sup1.id, unit_of_measure=UnitOfMeasure.PIECE, cost_price=10, selling_price=20, current_stock=50, low_stock_threshold=10),
                Product(name="Parle-G Biscuits", sku="PAR-001", category_id=cat_snacks.id, supplier_id=sup1.id, unit_of_measure=UnitOfMeasure.PIECE, cost_price=5, selling_price=10, current_stock=3, low_stock_threshold=10),
                Product(name="Coca-Cola 500ml", sku="COK-001", category_id=cat_drinks.id, supplier_id=sup2.id, unit_of_measure=UnitOfMeasure.PIECE, cost_price=20, selling_price=40, current_stock=30, low_stock_threshold=10),
                Product(name="Tata Salt 1kg", sku="SAL-001", category_id=cat_grocery.id, supplier_id=sup1.id, unit_of_measure=UnitOfMeasure.KG, cost_price=18, selling_price=25, current_stock=2, low_stock_threshold=5),
                Product(name="Aashirvaad Atta 5kg", sku="ATT-001", category_id=cat_grocery.id, supplier_id=sup1.id, unit_of_measure=UnitOfMeasure.KG, cost_price=200, selling_price=260, current_stock=15, low_stock_threshold=5),
            ]
            db.add_all(products)

    print("✓ Seed complete")
    print("  owner@shop.com / owner123")
    print("  staff@shop.com / staff123")
    await engine.dispose()


asyncio.run(seed())
