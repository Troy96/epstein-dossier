"""Document schemas."""

from datetime import datetime
from pydantic import BaseModel, ConfigDict


class DocumentBase(BaseModel):
    """Base document schema."""

    filename: str
    title: str | None = None
    source_url: str | None = None


class DocumentCreate(DocumentBase):
    """Schema for creating a document."""

    pass


class DocumentResponse(DocumentBase):
    """Schema for document response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    page_count: int
    file_size: int | None
    has_images: bool
    image_count: int
    download_status: str
    ocr_status: str
    entity_status: str
    face_status: str
    indexed_status: str
    earliest_date: datetime | None
    latest_date: datetime | None
    created_at: datetime
    updated_at: datetime


class DocumentSearchResult(BaseModel):
    """Document in search results with highlights."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    title: str | None
    page_count: int
    highlights: list[str] = []
    score: float | None = None


class DocumentListResponse(BaseModel):
    """Paginated list of documents."""

    documents: list[DocumentResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class DocumentTextResponse(BaseModel):
    """Full text of a document."""

    id: int
    filename: str
    text: str | None
    page_count: int


class DocumentImagesResponse(BaseModel):
    """List of images from a document."""

    id: int
    filename: str
    images: list[str]  # List of image paths/URLs
