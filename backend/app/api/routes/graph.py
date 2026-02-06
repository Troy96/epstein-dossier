"""Graph API endpoints for network visualization."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Document, Entity
from app.schemas.graph import (
    GraphData,
    GraphNode,
    GraphEdge,
    DocumentConnectionsResponse,
    RelatedDocument,
    EntityConnectionsResponse,
    CoOccurringEntity,
)
from app.services.neo4j import get_neo4j_service

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

    # Get connections from Neo4j
    neo4j = get_neo4j_service()
    connections = neo4j.get_document_connections(document_id, limit=max_related)

    # Build graph data
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

    # Add entity nodes and edges
    for entity in connections.get("entities", [])[:max_entities]:
        entity_node_id = f"entity_{entity['id']}"
        nodes.append(GraphNode(
            id=entity_node_id,
            label=entity["name"],
            type=entity["type"].lower(),
            properties={"entity_type": entity["type"]},
            size=1.0,
            color=_get_entity_color(entity["type"]),
        ))
        edges.append(GraphEdge(
            source=entity_node_id,
            target=f"doc_{document_id}",
            type="mentions",
            weight=1.0,
        ))

    # Add related document nodes
    related_docs = []
    for rel_doc in connections.get("related_documents", [])[:max_related]:
        rel_node_id = f"doc_{rel_doc['id']}"
        if rel_node_id not in [n.id for n in nodes]:
            nodes.append(GraphNode(
                id=rel_node_id,
                label=rel_doc["filename"],
                type="document",
                size=1.5,
                color="#60a5fa",
            ))
            edges.append(GraphEdge(
                source=f"doc_{document_id}",
                target=rel_node_id,
                type="related",
                weight=0.5,
            ))

        related_docs.append(RelatedDocument(
            id=rel_doc["id"],
            filename=rel_doc["filename"],
            title=rel_doc.get("title"),
            connection_type="shared_entities",
            connection_strength=0.5,
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
    max_documents: int = Query(20, ge=1, le=100),
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

    # Get connections from Neo4j
    neo4j = get_neo4j_service()
    connections = neo4j.get_entity_connections(entity_id, limit=max(max_documents, max_cooccur))

    # Build graph data
    nodes = [
        GraphNode(
            id=f"entity_{entity_id}",
            label=name,
            type=entity_type.lower(),
            properties={"entity_type": entity_type},
            size=2.0,
            color=_get_entity_color(entity_type),
        )
    ]

    edges = []

    # Add document nodes
    for doc in connections.get("documents", [])[:max_documents]:
        doc_node_id = f"doc_{doc['id']}"
        nodes.append(GraphNode(
            id=doc_node_id,
            label=doc["filename"],
            type="document",
            size=1.0,
            color="#3b82f6",
        ))
        edges.append(GraphEdge(
            source=f"entity_{entity_id}",
            target=doc_node_id,
            type="mentioned_in",
            weight=1.0,
        ))

    # Add co-occurring entity nodes
    co_entities = []
    for co_ent in connections.get("co_occurring_entities", [])[:max_cooccur]:
        co_node_id = f"entity_{co_ent['id']}"
        if co_node_id not in [n.id for n in nodes]:
            nodes.append(GraphNode(
                id=co_node_id,
                label=co_ent["name"],
                type=co_ent["type"].lower(),
                properties={"entity_type": co_ent["type"]},
                size=1.0,
                color=_get_entity_color(co_ent["type"]),
            ))
            edges.append(GraphEdge(
                source=f"entity_{entity_id}",
                target=co_node_id,
                type="co_occurs",
                weight=0.5,
            ))

        co_entities.append(CoOccurringEntity(
            id=co_ent["id"],
            name=co_ent["name"],
            entity_type=co_ent["type"],
            shared_documents=1,  # Would need additional query for accurate count
            co_occurrence_strength=0.5,
        ))

    return EntityConnectionsResponse(
        entity_id=entity_id,
        entity_name=name,
        entity_type=entity_type,
        graph=GraphData(nodes=nodes, edges=edges),
        co_occurring_entities=co_entities,
    )


@router.get("/query")
async def query_graph(
    cypher: str = Query(..., description="Cypher query to execute"),
    limit: int = Query(100, ge=1, le=500),
) -> dict:
    """Execute a custom Cypher query (read-only)."""
    # Only allow read queries
    cypher_lower = cypher.lower()
    if any(keyword in cypher_lower for keyword in ["create", "merge", "delete", "set", "remove"]):
        raise HTTPException(
            status_code=400,
            detail="Only read queries (MATCH) are allowed",
        )

    neo4j = get_neo4j_service()
    with neo4j.driver.session() as session:
        result = session.run(f"{cypher} LIMIT {limit}")
        records = [dict(record) for record in result]
        return {"results": records, "count": len(records)}


def _get_entity_color(entity_type: str) -> str:
    """Get color for entity type."""
    colors = {
        "PERSON": "#ef4444",  # Red
        "ORG": "#22c55e",  # Green
        "GPE": "#f59e0b",  # Amber
        "LOC": "#8b5cf6",  # Purple
        "DATE": "#06b6d4",  # Cyan
    }
    return colors.get(entity_type.upper(), "#6b7280")
