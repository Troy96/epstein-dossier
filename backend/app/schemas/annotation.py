"""Annotation schemas."""

from datetime import datetime
from pydantic import BaseModel, ConfigDict


class AnnotationBase(BaseModel):
    """Base annotation schema."""

    document_id: int
    note: str | None = None
    tags: list[str] | None = None
    bookmarked: bool = False
    page_number: int | None = None
    highlight_start: int | None = None
    highlight_end: int | None = None
    highlight_text: str | None = None


class AnnotationCreate(AnnotationBase):
    """Schema for creating an annotation."""

    pass


class AnnotationUpdate(BaseModel):
    """Schema for updating an annotation."""

    note: str | None = None
    tags: list[str] | None = None
    bookmarked: bool | None = None
    page_number: int | None = None
    highlight_start: int | None = None
    highlight_end: int | None = None
    highlight_text: str | None = None


class AnnotationResponse(AnnotationBase):
    """Schema for annotation response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: str
    created_at: datetime
    updated_at: datetime


class AnnotationListResponse(BaseModel):
    """List of annotations."""

    annotations: list[AnnotationResponse]
    total: int
