"""Entity schemas."""

from datetime import datetime
from pydantic import BaseModel, ConfigDict


class EntityBase(BaseModel):
    """Base entity schema."""

    name: str
    entity_type: str
    description: str | None = None


class EntityResponse(EntityBase):
    """Schema for entity response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    normalized_name: str
    mention_count: int
    document_count: int
    created_at: datetime


class EntityListResponse(BaseModel):
    """Paginated list of entities."""

    entities: list[EntityResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class EntityMentionResponse(BaseModel):
    """Entity mention in a document."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entity_id: int
    document_id: int
    page_number: int | None
    context_snippet: str | None
    document_filename: str | None = None


class EntityDocumentsResponse(BaseModel):
    """Documents mentioning an entity."""

    entity: EntityResponse
    documents: list["DocumentBrief"]
    total: int


class DocumentBrief(BaseModel):
    """Brief document info for entity context."""

    id: int
    filename: str
    title: str | None
    mention_count: int


class EntityCooccurrence(BaseModel):
    """Entity co-occurrence with another entity."""

    entity: EntityResponse
    shared_documents: int
    shared_mentions: int
