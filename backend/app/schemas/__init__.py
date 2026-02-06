"""Pydantic schemas for API requests and responses."""

from app.schemas.document import (
    DocumentBase,
    DocumentCreate,
    DocumentResponse,
    DocumentSearchResult,
    DocumentListResponse,
)
from app.schemas.entity import (
    EntityBase,
    EntityResponse,
    EntityListResponse,
    EntityMentionResponse,
)
from app.schemas.face import (
    FaceResponse,
    FaceListResponse,
    FaceClusterResponse,
    FaceSimilarityResult,
)
from app.schemas.search import (
    SearchQuery,
    SearchFilters,
    SearchResponse,
)
from app.schemas.annotation import (
    AnnotationBase,
    AnnotationCreate,
    AnnotationUpdate,
    AnnotationResponse,
)

__all__ = [
    "DocumentBase",
    "DocumentCreate",
    "DocumentResponse",
    "DocumentSearchResult",
    "DocumentListResponse",
    "EntityBase",
    "EntityResponse",
    "EntityListResponse",
    "EntityMentionResponse",
    "FaceResponse",
    "FaceListResponse",
    "FaceClusterResponse",
    "FaceSimilarityResult",
    "SearchQuery",
    "SearchFilters",
    "SearchResponse",
    "AnnotationBase",
    "AnnotationCreate",
    "AnnotationUpdate",
    "AnnotationResponse",
]
