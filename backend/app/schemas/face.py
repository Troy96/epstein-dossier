"""Face schemas."""

from datetime import datetime
from pydantic import BaseModel, ConfigDict, model_validator

from app.core.config import settings


class FaceResponse(BaseModel):
    """Schema for face response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    document_id: int
    cluster_id: int | None
    image_path: str
    page_number: int | None
    face_crop_path: str | None
    face_size: int | None
    confidence: float | None
    created_at: datetime
    document_filename: str | None = None

    @model_validator(mode="after")
    def normalize_paths(self) -> "FaceResponse":
        """Convert absolute filesystem paths to relative URL paths."""
        faces_dir = str(settings.faces_dir)
        if self.face_crop_path and self.face_crop_path.startswith(faces_dir):
            self.face_crop_path = "/static/faces" + self.face_crop_path[len(faces_dir):]
        images_dir = str(settings.images_dir)
        if self.image_path and self.image_path.startswith(images_dir):
            self.image_path = "/static/images" + self.image_path[len(images_dir):]
        return self


class FaceListResponse(BaseModel):
    """Paginated list of faces."""

    faces: list[FaceResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class FaceClusterResponse(BaseModel):
    """Schema for face cluster response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str | None
    face_count: int
    document_count: int
    representative_face: FaceResponse | None = None
    sample_faces: list[FaceResponse] = []


class FaceClusterListResponse(BaseModel):
    """List of face clusters."""

    clusters: list[FaceClusterResponse]
    total: int


class FaceSimilarityResult(BaseModel):
    """Result of face similarity search."""

    face: FaceResponse
    similarity: float  # 0.0 to 1.0, higher is more similar
    distance: float  # Lower is more similar


class FaceSimilarityResponse(BaseModel):
    """Response for face similarity search."""

    query_face_id: int | None = None  # None if searching by uploaded image
    results: list[FaceSimilarityResult]
    total: int
