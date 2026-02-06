"""Search schemas."""

from datetime import date
from pydantic import BaseModel, Field


class SearchFilters(BaseModel):
    """Filters for search queries."""

    entity_types: list[str] | None = None  # PERSON, ORG, GPE, LOC
    entity_ids: list[int] | None = None
    date_from: date | None = None
    date_to: date | None = None
    has_faces: bool | None = None
    document_ids: list[int] | None = None


class SearchQuery(BaseModel):
    """Full-text search query."""

    query: str
    filters: SearchFilters | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    highlight_pre_tag: str = "<mark>"
    highlight_post_tag: str = "</mark>"


class SearchHit(BaseModel):
    """Single search result."""

    id: int
    filename: str
    title: str | None
    page_count: int
    score: float
    highlights: dict[str, list[str]]  # field -> highlighted snippets


class SearchResponse(BaseModel):
    """Search results response."""

    query: str
    hits: list[SearchHit]
    total: int
    page: int
    page_size: int
    total_pages: int
    processing_time_ms: int


class SearchSuggestion(BaseModel):
    """Search suggestion/autocomplete."""

    text: str
    type: str  # query, entity, document
    score: float
