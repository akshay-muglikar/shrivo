from fastapi import Query
from pydantic import BaseModel


class PageParams:
    def __init__(
        self,
        page: int = Query(1, ge=1, description="Page number"),
        limit: int = Query(20, ge=1, le=500, description="Items per page"),
    ):
        self.page = page
        self.limit = limit
        self.offset = (page - 1) * limit


class PagedResponse(BaseModel):
    total: int
    page: int
    limit: int
    items: list
