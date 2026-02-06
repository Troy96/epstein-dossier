"""Face schemas."""

from datetime import datetime
from pydantic import BaseModel, ConfigDict


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
