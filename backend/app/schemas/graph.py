"""Graph schemas for network visualization."""

from pydantic import BaseModel


class GraphNode(BaseModel):
    """Node in the graph visualization."""

    id: str
    label: str
    type: str  # document, person, organization, location, face
    properties: dict = {}
    size: float = 1.0  # For visualization scaling
    color: str | None = None


class GraphEdge(BaseModel):
    """Edge in the graph visualization."""

    source: str
    target: str
    type: str  # mentions, appears_in, co_occurs, similar_face
    weight: float = 1.0
    properties: dict = {}


class GraphData(BaseModel):
    """Full graph data for visualization."""

    nodes: list[GraphNode]
    edges: list[GraphEdge]


class DocumentConnectionsResponse(BaseModel):
    """Connections for a specific document."""

    document_id: int
    document_filename: str
    graph: GraphData
    related_documents: list["RelatedDocument"]


class RelatedDocument(BaseModel):
    """Related document with connection info."""

    id: int
    filename: str
    title: str | None
    connection_type: str
    connection_strength: float
    shared_entities: list[str] = []
    shared_faces: int = 0


class EntityConnectionsResponse(BaseModel):
    """Connections for a specific entity."""

    entity_id: int
    entity_name: str
    entity_type: str
    graph: GraphData
    co_occurring_entities: list["CoOccurringEntity"]


class CoOccurringEntity(BaseModel):
    """Entity that co-occurs with another."""

    id: int
    name: str
    entity_type: str
    shared_documents: int
    co_occurrence_strength: float
