"""FastAPI application entry point."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import api_router
from app.core.config import settings
from app.db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    settings.ensure_dirs()
    await init_db()
    yield
    # Shutdown


app = FastAPI(
    title=settings.app_name,
    description="Comprehensive search platform for Epstein DOJ files",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes (must be before static mounts to take priority)
app.include_router(api_router, prefix="/api")

# Static file serving for images and face crops
if settings.images_dir.exists():
    app.mount("/api/static/images", StaticFiles(directory=str(settings.images_dir)), name="images")
if settings.faces_dir.exists():
    app.mount("/api/static/faces", StaticFiles(directory=str(settings.faces_dir)), name="faces")


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": settings.app_name,
        "version": "0.1.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}
