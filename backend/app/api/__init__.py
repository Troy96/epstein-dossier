"""API router configuration."""

from fastapi import APIRouter

from app.api.routes import documents, search, entities, faces, graph, timeline, annotations, export, image_analysis

api_router = APIRouter()

api_router.include_router(search.router, prefix="/search", tags=["search"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(entities.router, prefix="/entities", tags=["entities"])
api_router.include_router(faces.router, prefix="/faces", tags=["faces"])
api_router.include_router(graph.router, prefix="/graph", tags=["graph"])
api_router.include_router(timeline.router, prefix="/timeline", tags=["timeline"])
api_router.include_router(annotations.router, prefix="/annotations", tags=["annotations"])
api_router.include_router(export.router, prefix="/export", tags=["export"])
api_router.include_router(image_analysis.router, prefix="/image-analysis", tags=["image-analysis"])
