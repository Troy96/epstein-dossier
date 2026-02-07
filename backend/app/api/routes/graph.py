"""Graph API endpoints for network visualization."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Document, Entity, EntityMention
from app.schemas.graph import (
    GraphData,
    GraphNode,
    GraphEdge,
    DocumentConnectionsResponse,
    RelatedDocument,
    EntityConnectionsResponse,
    CoOccurringEntity,
)

router = APIRouter()


@router.get("/document/{document_id}/connections", response_model=DocumentConnectionsResponse)
async def get_document_connections(
    document_id: int,
    max_entities: int = Query(20, ge=1, le=100),
    max_related: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> DocumentConnectionsResponse:
    """Get all connections for a document."""
    # Verify document exists
    doc_result = await db.execute(
        select(Document.id, Document.filename, Document.title)
        .where(Document.id == document_id)
    )
    doc_row = doc_result.one_or_none()

    if not doc_row:
        raise HTTPException(status_code=404, detail="Document not found")

    doc_id, filename, title = doc_row

    # Build graph data - start with document node
    nodes = [
        GraphNode(
            id=f"doc_{document_id}",
            label=filename,
            type="document",
            properties={"title": title},
            size=2.0,
            color="#3b82f6",
        )
    ]
    edges = []

    # Get entities mentioned in this document from PostgreSQL
    entity_query = (
        select(Entity.id, Entity.name, Entity.entity_type, func.count(EntityMention.id).label("mention_count"))
        .join(EntityMention, EntityMention.entity_id == Entity.id)
        .where(EntityMention.document_id == document_id)
        .group_by(Entity.id, Entity.name, Entity.entity_type)
        .order_by(func.count(EntityMention.id).desc())
        .limit(max_entities)
    )
    entity_result = await db.execute(entity_query)

    for row in entity_result.all():
        ent_id, ent_name, ent_type, mention_count = row
        entity_node_id = f"entity_{ent_id}"
        nodes.append(GraphNode(
            id=entity_node_id,
            label=ent_name,
            type=ent_type.lower() if ent_type else "unknown",
            properties={"entity_type": ent_type, "mentions": mention_count},
            size=min(1.0 + mention_count * 0.1, 2.0),
            color=_get_entity_color(ent_type),
        ))
        edges.append(GraphEdge(
            source=entity_node_id,
            target=f"doc_{document_id}",
            type="mentions",
            weight=float(mention_count),
        ))

    # Find related documents (documents that share entities with this one)
    # Get entity IDs from this document
    entity_ids_query = (
        select(EntityMention.entity_id)
        .where(EntityMention.document_id == document_id)
        .distinct()
    )

    # Find other documents with those entities
    related_docs_query = (
        select(
            Document.id,
            Document.filename,
            Document.title,
            func.count(EntityMention.entity_id.distinct()).label("shared_count")
        )
        .join(EntityMention, EntityMention.document_id == Document.id)
        .where(
            and_(
                EntityMention.entity_id.in_(entity_ids_query),
                Document.id != document_id
            )
        )
        .group_by(Document.id, Document.filename, Document.title)
        .order_by(func.count(EntityMention.entity_id.distinct()).desc())
        .limit(max_related)
    )
    related_result = await db.execute(related_docs_query)

    related_docs = []
    for row in related_result.all():
        rel_id, rel_filename, rel_title, shared_count = row
        rel_node_id = f"doc_{rel_id}"
        nodes.append(GraphNode(
            id=rel_node_id,
            label=rel_filename,
            type="document",
            properties={"title": rel_title, "shared_entities": shared_count},
            size=1.5,
            color="#60a5fa",
        ))
        edges.append(GraphEdge(
            source=f"doc_{document_id}",
            target=rel_node_id,
            type="related",
            weight=float(shared_count) / 10,
        ))
        related_docs.append(RelatedDocument(
            id=rel_id,
            filename=rel_filename,
            title=rel_title,
            connection_type="shared_entities",
            connection_strength=float(shared_count) / 10,
            shared_entities=[],
            shared_faces=0,
        ))

    return DocumentConnectionsResponse(
        document_id=document_id,
        document_filename=filename,
        graph=GraphData(nodes=nodes, edges=edges),
        related_documents=related_docs,
    )


@router.get("/entity/{entity_id}/connections", response_model=EntityConnectionsResponse)
async def get_entity_connections(
    entity_id: int,
    max_documents: int = Query(15, ge=1, le=100),
    max_cooccur: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> EntityConnectionsResponse:
    """Get all connections for an entity."""
    # Verify entity exists
    entity_result = await db.execute(
        select(Entity.id, Entity.name, Entity.entity_type)
        .where(Entity.id == entity_id)
    )
    entity_row = entity_result.one_or_none()

    if not entity_row:
        raise HTTPException(status_code=404, detail="Entity not found")

    ent_id, name, entity_type = entity_row

    # Build graph data - start with entity node
    nodes = [
        GraphNode(
            id=f"entity_{entity_id}",
            label=name,
            type=entity_type.lower() if entity_type else "unknown",
            properties={"entity_type": entity_type},
            size=2.0,
            color=_get_entity_color(entity_type),
        )
    ]
    edges = []

    # Get documents mentioning this entity from PostgreSQL
    doc_query = (
        select(
            Document.id,
            Document.filename,
            Document.title,
            func.count(EntityMention.id).label("mention_count")
        )
        .join(EntityMention, EntityMention.document_id == Document.id)
        .where(EntityMention.entity_id == entity_id)
        .group_by(Document.id, Document.filename, Document.title)
        .order_by(func.count(EntityMention.id).desc())
        .limit(max_documents)
    )
    doc_result = await db.execute(doc_query)

    doc_ids = []
    for row in doc_result.all():
        doc_id, doc_filename, doc_title, mention_count = row
        doc_ids.append(doc_id)
        doc_node_id = f"doc_{doc_id}"
        nodes.append(GraphNode(
            id=doc_node_id,
            label=doc_filename,
            type="document",
            properties={"title": doc_title, "mentions": mention_count},
            size=min(1.0 + mention_count * 0.1, 1.5),
            color="#3b82f6",
        ))
        edges.append(GraphEdge(
            source=f"entity_{entity_id}",
            target=doc_node_id,
            type="mentioned_in",
            weight=float(mention_count),
        ))

    # Find co-occurring entities (other entities in the same documents)
    co_entities = []
    if doc_ids:
        cooccur_query = (
            select(
                Entity.id,
                Entity.name,
                Entity.entity_type,
                func.count(EntityMention.document_id.distinct()).label("shared_docs")
            )
            .join(EntityMention, EntityMention.entity_id == Entity.id)
            .where(
                and_(
                    EntityMention.document_id.in_(doc_ids),
                    Entity.id != entity_id
                )
            )
            .group_by(Entity.id, Entity.name, Entity.entity_type)
            .order_by(func.count(EntityMention.document_id.distinct()).desc())
            .limit(max_cooccur)
        )
        cooccur_result = await db.execute(cooccur_query)

        for row in cooccur_result.all():
            co_id, co_name, co_type, shared_docs = row
            co_node_id = f"entity_{co_id}"
            nodes.append(GraphNode(
                id=co_node_id,
                label=co_name,
                type=co_type.lower() if co_type else "unknown",
                properties={"entity_type": co_type, "shared_documents": shared_docs},
                size=min(1.0 + shared_docs * 0.1, 1.5),
                color=_get_entity_color(co_type),
            ))
            edges.append(GraphEdge(
                source=f"entity_{entity_id}",
                target=co_node_id,
                type="co_occurs",
                weight=float(shared_docs) / 5,
            ))
            co_entities.append(CoOccurringEntity(
                id=co_id,
                name=co_name,
                entity_type=co_type,
                shared_documents=shared_docs,
                co_occurrence_strength=float(shared_docs) / 10,
            ))

    return EntityConnectionsResponse(
        entity_id=entity_id,
        entity_name=name,
        entity_type=entity_type,
        graph=GraphData(nodes=nodes, edges=edges),
        co_occurring_entities=co_entities,
    )


def _get_entity_color(entity_type: str | None) -> str:
    """Get color for entity type."""
    if not entity_type:
        return "#6b7280"
    colors = {
        "PERSON": "#ef4444",  # Red
        "ORG": "#22c55e",  # Green
        "GPE": "#f59e0b",  # Amber
        "LOC": "#8b5cf6",  # Purple
        "DATE": "#06b6d4",  # Cyan
    }
    return colors.get(entity_type.upper(), "#6b7280")
