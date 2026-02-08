"""Image analysis schemas."""

from datetime import datetime
from pydantic import BaseModel, ConfigDict, model_validator

from app.core.config import settings


class ImageAnalysisResponse(BaseModel):
    """Schema for image analysis response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    document_id: int
    image_path: str
    description: str | None
    tags: list[str] | None
    category: str | None
    interest_score: float
    flagged: bool
    flag_reason: str | None
    created_at: datetime
    document_filename: str | None = None

    @model_validator(mode="after")
    def normalize_paths(self) -> "ImageAnalysisResponse":
        """Convert absolute filesystem paths to relative URL paths."""
        images_dir = str(settings.images_dir)
        if self.image_path and self.image_path.startswith(images_dir):
            self.image_path = "/static/images" + self.image_path[len(images_dir):]
        return self


class ImageAnalysisListResponse(BaseModel):
    """Paginated list of image analyses."""

    analyses: list[ImageAnalysisResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class ImageAnalysisStatsResponse(BaseModel):
    """Statistics about image analyses."""

    total_analyzed: int
    total_flagged: int
    by_category: dict[str, int]
    avg_interest_score: float


class ImageAnalysisUpdateRequest(BaseModel):
    """Request to update an image analysis."""

    tags: list[str] | None = None
    category: str | None = None
    interest_score: float | None = None
    flagged: bool | None = None
    flag_reason: str | None = None
