"""Document API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Document
from app.schemas.document import (
    DocumentResponse,
    DocumentListResponse,
    DocumentTextResponse,
    DocumentImagesResponse,
)
from app.core.config import settings

router = APIRouter()


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None, description="Filter by processing status"),
    db: AsyncSession = Depends(get_db),
) -> DocumentListResponse:
    """List all documents with pagination."""
    query = select(Document)

    if status:
        query = query.where(Document.ocr_status == status)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get paginated results
    query = query.order_by(Document.filename)
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    documents = result.scalars().all()

    total_pages = (total + page_size - 1) // page_size if total > 0 else 0

    return DocumentListResponse(
        documents=[DocumentResponse.model_validate(doc) for doc in documents],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
) -> DocumentResponse:
    """Get a specific document by ID."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    return DocumentResponse.model_validate(document)


@router.get("/{document_id}/text", response_model=DocumentTextResponse)
async def get_document_text(
    document_id: int,
    db: AsyncSession = Depends(get_db),
) -> DocumentTextResponse:
    """Get extracted text from a document."""
    result = await db.execute(
        select(Document.id, Document.filename, Document.extracted_text, Document.page_count)
        .where(Document.id == document_id)
    )
    row = result.one_or_none()

    if not row:
        raise HTTPException(status_code=404, detail="Document not found")

    return DocumentTextResponse(
        id=row[0],
        filename=row[1],
        text=row[2],
        page_count=row[3],
    )


@router.get("/{document_id}/images", response_model=DocumentImagesResponse)
async def get_document_images(
    document_id: int,
    db: AsyncSession = Depends(get_db),
) -> DocumentImagesResponse:
    """Get list of images extracted from a document."""
    result = await db.execute(
        select(Document.id, Document.filename)
        .where(Document.id == document_id)
    )
    row = result.one_or_none()

    if not row:
        raise HTTPException(status_code=404, detail="Document not found")

    doc_id, filename = row
    base_name = filename.replace(".pdf", "")

    # Find images in the images directory
    images_dir = settings.images_dir / base_name
    images = []
    if images_dir.exists():
        images = sorted([
            f"/api/static/images/{base_name}/{f.name}"
            for f in images_dir.iterdir()
            if f.suffix.lower() in [".png", ".jpg", ".jpeg"]
        ])

    return DocumentImagesResponse(
        id=doc_id,
        filename=filename,
        images=images,
    )


@router.get("/{document_id}/pdf")
async def get_document_pdf(
    document_id: int,
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    """Get the original PDF file."""
    result = await db.execute(
        select(Document.filename).where(Document.id == document_id)
    )
    row = result.one_or_none()

    if not row:
        raise HTTPException(status_code=404, detail="Document not found")

    filename = row[0]
    pdf_path = settings.pdf_dir / filename

    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="PDF file not found")

    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=filename,
    )


@router.get("/stats/summary")
async def get_documents_stats(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get document statistics."""
    # Total documents
    total_result = await db.execute(select(func.count(Document.id)))
    total = total_result.scalar() or 0

    # By status
    status_result = await db.execute(
        select(Document.ocr_status, func.count(Document.id))
        .group_by(Document.ocr_status)
    )
    status_counts = {row[0]: row[1] for row in status_result.all()}

    # With faces
    faces_result = await db.execute(
        select(func.count(Document.id)).where(Document.has_images == True)
    )
    with_images = faces_result.scalar() or 0

    return {
        "total": total,
        "by_status": status_counts,
        "with_images": with_images,
    }
