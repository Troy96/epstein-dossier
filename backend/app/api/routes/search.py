"""Search API endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.services.search import SearchService
from app.schemas.search import SearchQuery, SearchResponse, SearchFilters

router = APIRouter()


@router.get("", response_model=SearchResponse)
async def search_documents(
    q: str = Query(..., min_length=1, description="Search query"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    entity_ids: list[int] | None = Query(None),
    has_faces: bool | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> SearchResponse:
    """Search documents by keyword."""
    from datetime import date

    filters = SearchFilters(
        entity_ids=entity_ids,
        has_faces=has_faces,
        date_from=date.fromisoformat(date_from) if date_from else None,
        date_to=date.fromisoformat(date_to) if date_to else None,
    )

    query = SearchQuery(
        query=q,
        page=page,
        page_size=page_size,
        filters=filters if any([entity_ids, has_faces, date_from, date_to]) else None,
    )

    service = SearchService(db)
    return await service.search(query)


@router.post("", response_model=SearchResponse)
async def search_documents_post(
    query: SearchQuery,
    db: AsyncSession = Depends(get_db),
) -> SearchResponse:
    """Search documents with full query body."""
    service = SearchService(db)
    return await service.search(query)


@router.get("/suggestions")
async def get_search_suggestions(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Get search suggestions for autocomplete."""
    service = SearchService(db)
    return await service.get_search_suggestions(q, limit)
