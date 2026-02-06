"""Entity API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Entity, EntityMention, Document
from app.schemas.entity import (
    EntityResponse,
    EntityListResponse,
    EntityMentionResponse,
    EntityDocumentsResponse,
    DocumentBrief,
    EntityCooccurrence,
)
from app.services.neo4j import get_neo4j_service

router = APIRouter()


@router.get("", response_model=EntityListResponse)
async def list_entities(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    entity_type: str | None = Query(None, description="Filter by type: PERSON, ORG, GPE, LOC"),
    search: str | None = Query(None, description="Search by name"),
    sort_by: str = Query("mention_count", description="Sort by: mention_count, name, document_count"),
    db: AsyncSession = Depends(get_db),
) -> EntityListResponse:
    """List entities with pagination and filters."""
    query = select(Entity)

    if entity_type:
        query = query.where(Entity.entity_type == entity_type.upper())

    if search:
        query = query.where(Entity.name.ilike(f"%{search}%"))

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Apply sorting
    if sort_by == "name":
        query = query.order_by(Entity.name)
    elif sort_by == "document_count":
        query = query.order_by(Entity.document_count.desc())
    else:
        query = query.order_by(Entity.mention_count.desc())

    # Paginate
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    entities = result.scalars().all()

    total_pages = (total + page_size - 1) // page_size if total > 0 else 0

    return EntityListResponse(
        entities=[EntityResponse.model_validate(e) for e in entities],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/types")
async def get_entity_types(
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Get available entity types with counts."""
    result = await db.execute(
        select(Entity.entity_type, func.count(Entity.id))
        .group_by(Entity.entity_type)
        .order_by(func.count(Entity.id).desc())
    )
    return [{"type": row[0], "count": row[1]} for row in result.all()]


@router.get("/{entity_id}", response_model=EntityResponse)
async def get_entity(
    entity_id: int,
    db: AsyncSession = Depends(get_db),
) -> EntityResponse:
    """Get a specific entity."""
    result = await db.execute(select(Entity).where(Entity.id == entity_id))
    entity = result.scalar_one_or_none()

    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    return EntityResponse.model_validate(entity)


@router.get("/{entity_id}/documents", response_model=EntityDocumentsResponse)
async def get_entity_documents(
    entity_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> EntityDocumentsResponse:
    """Get documents mentioning an entity."""
    # Get entity
    entity_result = await db.execute(select(Entity).where(Entity.id == entity_id))
    entity = entity_result.scalar_one_or_none()

    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    # Get documents with mention counts
    query = (
        select(
            Document.id,
            Document.filename,
            Document.title,
            func.count(EntityMention.id).label("mention_count"),
        )
        .join(EntityMention, EntityMention.document_id == Document.id)
        .where(EntityMention.entity_id == entity_id)
        .group_by(Document.id)
        .order_by(func.count(EntityMention.id).desc())
    )

    # Get total
    count_query = (
        select(func.count(func.distinct(EntityMention.document_id)))
        .where(EntityMention.entity_id == entity_id)
    )
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginate
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)

    documents = [
        DocumentBrief(
            id=row[0],
            filename=row[1],
            title=row[2],
            mention_count=row[3],
        )
        for row in result.all()
    ]

    return EntityDocumentsResponse(
        entity=EntityResponse.model_validate(entity),
        documents=documents,
        total=total,
    )


@router.get("/{entity_id}/cooccurrences")
async def get_entity_cooccurrences(
    entity_id: int,
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> list[EntityCooccurrence]:
    """Get entities that co-occur with this entity."""
    # Verify entity exists
    entity_result = await db.execute(select(Entity.id).where(Entity.id == entity_id))
    if not entity_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Entity not found")

    # Use Neo4j for co-occurrence query
    neo4j = get_neo4j_service()
    cooccurrences = neo4j.get_entity_cooccurrences(entity_id, limit)

    # Get full entity details
    entity_ids = [c["id"] for c in cooccurrences]
    if not entity_ids:
        return []

    entities_result = await db.execute(
        select(Entity).where(Entity.id.in_(entity_ids))
    )
    entities_map = {e.id: e for e in entities_result.scalars().all()}

    results = []
    for c in cooccurrences:
        if c["id"] in entities_map:
            entity = entities_map[c["id"]]
            results.append(EntityCooccurrence(
                entity=EntityResponse.model_validate(entity),
                shared_documents=c["shared_docs"],
                shared_mentions=c["shared_docs"],  # Simplified
            ))

    return results


@router.get("/{entity_id}/mentions", response_model=list[EntityMentionResponse])
async def get_entity_mentions(
    entity_id: int,
    document_id: int | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> list[EntityMentionResponse]:
    """Get specific mentions of an entity with context."""
    query = (
        select(EntityMention, Document.filename)
        .join(Document, Document.id == EntityMention.document_id)
        .where(EntityMention.entity_id == entity_id)
    )

    if document_id:
        query = query.where(EntityMention.document_id == document_id)

    query = query.limit(limit)
    result = await db.execute(query)

    mentions = []
    for row in result.all():
        mention, filename = row
        mention_response = EntityMentionResponse.model_validate(mention)
        mention_response.document_filename = filename
        mentions.append(mention_response)

    return mentions
