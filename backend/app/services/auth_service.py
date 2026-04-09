from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException
from app.core.security import create_access_token, verify_password
from app.models.user import User


async def login(db: AsyncSession, email: str, password: str) -> str:
    """Verify credentials and return a JWT access token."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(password, user.password_hash):
        raise AppException(status_code=401, detail="Invalid email or password")

    return create_access_token(str(user.id))
