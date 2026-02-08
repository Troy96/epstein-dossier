"""Image analysis API endpoints."""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Document
from app.models.image_analysis import ImageAnalysis
from app.schemas.image_analysis import (
    ImageAnalysisResponse,
    ImageAnalysisListResponse,
    ImageAnalysisStatsResponse,
    ImageAnalysisUpdateRequest,
)

router = APIRouter()


@router.get("/stats", response_model=ImageAnalysisStatsResponse)
async def get_stats(
    db: AsyncSession = Depends(get_db),
) -> ImageAnalysisStatsResponse:
    """Get image analysis statistics."""
    # Total analyzed
    total_result = await db.execute(select(func.count(ImageAnalysis.id)))
    total_analyzed = total_result.scalar() or 0

    # Total flagged
    flagged_result = await db.execute(
        select(func.count(ImageAnalysis.id)).where(ImageAnalysis.flagged == True)
    )
    total_flagged = flagged_result.scalar() or 0

    # By category
    cat_result = await db.execute(
        select(ImageAnalysis.category, func.count(ImageAnalysis.id))
        .group_by(ImageAnalysis.category)
    )
    by_category = {row[0] or "other": row[1] for row in cat_result.all()}

    # Average interest score
    avg_result = await db.execute(select(func.avg(ImageAnalysis.interest_score)))
    avg_interest = avg_result.scalar() or 0.0

    return ImageAnalysisStatsResponse(
        total_analyzed=total_analyzed,
        total_flagged=total_flagged,
        by_category=by_category,
        avg_interest_score=round(float(avg_interest), 3),
    )


@router.get("", response_model=ImageAnalysisListResponse)
async def list_analyses(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: str | None = Query(None),
    flagged: bool | None = Query(None),
    min_score: float | None = Query(None, ge=0.0, le=1.0),
    sort_by: Literal["interest_score", "created_at", "category"] = Query("interest_score"),
    sort_dir: Literal["asc", "desc"] = Query("desc"),
    db: AsyncSession = Depends(get_db),
) -> ImageAnalysisListResponse:
    """List analyzed images with filtering."""
    query = select(ImageAnalysis, Document.filename).join(
        Document, Document.id == ImageAnalysis.document_id
    )
    count_query = select(func.count()).select_from(ImageAnalysis)

    # Apply filters
    if category:
        query = query.where(ImageAnalysis.category == category)
        count_query = count_query.where(ImageAnalysis.category == category)

    if flagged is not None:
        query = query.where(ImageAnalysis.flagged == flagged)
        count_query = count_query.where(ImageAnalysis.flagged == flagged)

    if min_score is not None:
        query = query.where(ImageAnalysis.interest_score >= min_score)
        count_query = count_query.where(ImageAnalysis.interest_score >= min_score)

    # Get total
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Sorting
    sort_column = getattr(ImageAnalysis, sort_by)
    if sort_dir == "desc":
        sort_column = sort_column.desc()
    query = query.order_by(sort_column)

    # Paginate
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)

    analyses = []
    for row in result.all():
        analysis, filename = row
        response = ImageAnalysisResponse.model_validate(analysis)
        response.document_filename = filename
        analyses.append(response)

    total_pages = (total + page_size - 1) // page_size if total > 0 else 0

    return ImageAnalysisListResponse(
        analyses=analyses,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{analysis_id}", response_model=ImageAnalysisResponse)
async def get_analysis(
    analysis_id: int,
    db: AsyncSession = Depends(get_db),
) -> ImageAnalysisResponse:
    """Get a single image analysis."""
    result = await db.execute(
        select(ImageAnalysis, Document.filename)
        .join(Document, Document.id == ImageAnalysis.document_id)
        .where(ImageAnalysis.id == analysis_id)
    )
    row = result.one_or_none()

    if not row:
        raise HTTPException(status_code=404, detail="Analysis not found")

    analysis, filename = row
    response = ImageAnalysisResponse.model_validate(analysis)
    response.document_filename = filename
    return response


@router.patch("/{analysis_id}", response_model=ImageAnalysisResponse)
async def update_analysis(
    analysis_id: int,
    update: ImageAnalysisUpdateRequest,
    db: AsyncSession = Depends(get_db),
) -> ImageAnalysisResponse:
    """Update/correct an image analysis."""
    result = await db.execute(
        select(ImageAnalysis).where(ImageAnalysis.id == analysis_id)
    )
    analysis = result.scalar_one_or_none()

    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(analysis, field, value)

    await db.commit()
    await db.refresh(analysis)

    # Re-fetch with document filename
    result = await db.execute(
        select(ImageAnalysis, Document.filename)
        .join(Document, Document.id == ImageAnalysis.document_id)
        .where(ImageAnalysis.id == analysis_id)
    )
    row = result.one()
    analysis, filename = row
    response = ImageAnalysisResponse.model_validate(analysis)
    response.document_filename = filename
    return response
