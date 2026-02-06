"""Annotation API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Annotation, Document
from app.schemas.annotation import (
    AnnotationCreate,
    AnnotationUpdate,
    AnnotationResponse,
    AnnotationListResponse,
)

router = APIRouter()


@router.get("", response_model=AnnotationListResponse)
async def list_annotations(
    document_id: int | None = Query(None),
    bookmarked: bool | None = Query(None),
    tag: str | None = Query(None),
    user_id: str = Query("default"),
    db: AsyncSession = Depends(get_db),
) -> AnnotationListResponse:
    """List annotations with optional filters."""
    query = select(Annotation).where(Annotation.user_id == user_id)

    if document_id:
        query = query.where(Annotation.document_id == document_id)

    if bookmarked is not None:
        query = query.where(Annotation.bookmarked == bookmarked)

    if tag:
        # JSON contains operation for tags array
        query = query.where(Annotation.tags.contains([tag]))

    query = query.order_by(Annotation.created_at.desc())
    result = await db.execute(query)
    annotations = result.scalars().all()

    return AnnotationListResponse(
        annotations=[AnnotationResponse.model_validate(a) for a in annotations],
        total=len(annotations),
    )


@router.post("", response_model=AnnotationResponse)
async def create_annotation(
    annotation: AnnotationCreate,
    user_id: str = Query("default"),
    db: AsyncSession = Depends(get_db),
) -> AnnotationResponse:
    """Create a new annotation."""
    # Verify document exists
    doc_result = await db.execute(
        select(Document.id).where(Document.id == annotation.document_id)
    )
    if not doc_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Document not found")

    db_annotation = Annotation(
        document_id=annotation.document_id,
        note=annotation.note,
        tags=annotation.tags,
        bookmarked=annotation.bookmarked,
        page_number=annotation.page_number,
        highlight_start=annotation.highlight_start,
        highlight_end=annotation.highlight_end,
        highlight_text=annotation.highlight_text,
        user_id=user_id,
    )

    db.add(db_annotation)
    await db.flush()
    await db.refresh(db_annotation)

    return AnnotationResponse.model_validate(db_annotation)


@router.get("/{annotation_id}", response_model=AnnotationResponse)
async def get_annotation(
    annotation_id: int,
    db: AsyncSession = Depends(get_db),
) -> AnnotationResponse:
    """Get a specific annotation."""
    result = await db.execute(
        select(Annotation).where(Annotation.id == annotation_id)
    )
    annotation = result.scalar_one_or_none()

    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")

    return AnnotationResponse.model_validate(annotation)


@router.put("/{annotation_id}", response_model=AnnotationResponse)
async def update_annotation(
    annotation_id: int,
    update: AnnotationUpdate,
    db: AsyncSession = Depends(get_db),
) -> AnnotationResponse:
    """Update an annotation."""
    result = await db.execute(
        select(Annotation).where(Annotation.id == annotation_id)
    )
    annotation = result.scalar_one_or_none()

    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")

    # Update fields if provided
    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(annotation, field, value)

    await db.flush()
    await db.refresh(annotation)

    return AnnotationResponse.model_validate(annotation)


@router.delete("/{annotation_id}")
async def delete_annotation(
    annotation_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Delete an annotation."""
    result = await db.execute(
        select(Annotation).where(Annotation.id == annotation_id)
    )
    annotation = result.scalar_one_or_none()

    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")

    await db.delete(annotation)

    return {"status": "deleted", "id": annotation_id}


@router.get("/tags/all")
async def get_all_tags(
    user_id: str = Query("default"),
    db: AsyncSession = Depends(get_db),
) -> list[str]:
    """Get all unique tags used by the user."""
    result = await db.execute(
        select(Annotation.tags)
        .where(Annotation.user_id == user_id)
        .where(Annotation.tags.isnot(None))
    )

    all_tags = set()
    for row in result.all():
        if row[0]:
            all_tags.update(row[0])

    return sorted(all_tags)


@router.get("/bookmarks/all", response_model=AnnotationListResponse)
async def get_all_bookmarks(
    user_id: str = Query("default"),
    db: AsyncSession = Depends(get_db),
) -> AnnotationListResponse:
    """Get all bookmarked documents."""
    result = await db.execute(
        select(Annotation)
        .where(Annotation.user_id == user_id)
        .where(Annotation.bookmarked == True)
        .order_by(Annotation.created_at.desc())
    )
    annotations = result.scalars().all()

    return AnnotationListResponse(
        annotations=[AnnotationResponse.model_validate(a) for a in annotations],
        total=len(annotations),
    )
