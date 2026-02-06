"""Timeline API endpoints."""

from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Document
from app.schemas.timeline import (
    TimelineEvent,
    TimelineResponse,
    TimelineDateRange,
)

router = APIRouter()


@router.get("", response_model=TimelineResponse)
async def get_timeline(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    entity_id: int | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
) -> TimelineResponse:
    """Get timeline of documents."""
    query = select(
        Document.id,
        Document.filename,
        Document.title,
        Document.earliest_date,
    ).where(Document.earliest_date.isnot(None))

    if start_date:
        query = query.where(Document.earliest_date >= start_date)

    if end_date:
        query = query.where(Document.earliest_date <= end_date)

    if entity_id:
        from app.models import EntityMention
        # Filter to documents mentioning this entity
        subquery = (
            select(EntityMention.document_id)
            .where(EntityMention.entity_id == entity_id)
            .distinct()
        )
        query = query.where(Document.id.in_(subquery))

    query = query.order_by(Document.earliest_date).limit(limit)
    result = await db.execute(query)

    events = []
    for row in result.all():
        doc_id, filename, title, doc_date = row
        events.append(TimelineEvent(
            date=doc_date.date() if hasattr(doc_date, 'date') else doc_date,
            document_id=doc_id,
            document_filename=filename,
            document_title=title,
            event_type="document_date",
            context=None,
        ))

    actual_start = min(e.date for e in events) if events else None
    actual_end = max(e.date for e in events) if events else None

    return TimelineResponse(
        events=events,
        start_date=actual_start,
        end_date=actual_end,
        total=len(events),
    )


@router.get("/range", response_model=TimelineDateRange)
async def get_timeline_range(
    db: AsyncSession = Depends(get_db),
) -> TimelineDateRange:
    """Get the available date range for the timeline."""
    result = await db.execute(
        select(
            func.min(Document.earliest_date),
            func.max(Document.latest_date),
            func.count(Document.id),
        ).where(Document.earliest_date.isnot(None))
    )
    row = result.one()

    min_date = row[0].date() if row[0] and hasattr(row[0], 'date') else row[0]
    max_date = row[1].date() if row[1] and hasattr(row[1], 'date') else row[1]

    return TimelineDateRange(
        min_date=min_date,
        max_date=max_date,
        document_count=row[2] or 0,
    )


@router.get("/by-year")
async def get_timeline_by_year(
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Get document counts grouped by year."""
    result = await db.execute(
        select(
            func.extract('year', Document.earliest_date).label('year'),
            func.count(Document.id).label('count'),
        )
        .where(Document.earliest_date.isnot(None))
        .group_by(func.extract('year', Document.earliest_date))
        .order_by(func.extract('year', Document.earliest_date))
    )

    return [{"year": int(row[0]), "count": row[1]} for row in result.all()]


@router.get("/by-month")
async def get_timeline_by_month(
    year: int = Query(..., ge=1900, le=2100),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Get document counts grouped by month for a specific year."""
    result = await db.execute(
        select(
            func.extract('month', Document.earliest_date).label('month'),
            func.count(Document.id).label('count'),
        )
        .where(
            and_(
                Document.earliest_date.isnot(None),
                func.extract('year', Document.earliest_date) == year,
            )
        )
        .group_by(func.extract('month', Document.earliest_date))
        .order_by(func.extract('month', Document.earliest_date))
    )

    return [{"month": int(row[0]), "count": row[1]} for row in result.all()]
