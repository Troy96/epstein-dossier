"""Neo4j service for graph relationships."""

from rich.console import Console

from app.core.config import settings

console = Console()


class Neo4jService:
    """Service for graph database operations."""

    def __init__(self) -> None:
        self.enabled = False
        self.driver = None
        try:
            from neo4j import GraphDatabase
            self.driver = GraphDatabase.driver(
                settings.neo4j_uri,
                auth=(settings.neo4j_user, settings.neo4j_password),
            )
            # Test connection
            with self.driver.session() as session:
                session.run("RETURN 1")
            self._ensure_constraints()
            self.enabled = True
            console.print("[green]Neo4j connected[/green]")
        except Exception as e:
            console.print(f"[yellow]Neo4j not available, graph features disabled: {e}[/yellow]")
            self.driver = None

    def _ensure_constraints(self) -> None:
        """Create constraints and indexes."""
        if not self.enabled or not self.driver:
            return
        with self.driver.session() as session:
            session.run("""
                CREATE CONSTRAINT document_id IF NOT EXISTS
                FOR (d:Document) REQUIRE d.id IS UNIQUE
            """)
            session.run("""
                CREATE CONSTRAINT entity_id IF NOT EXISTS
                FOR (e:Entity) REQUIRE e.id IS UNIQUE
            """)
            session.run("""
                CREATE CONSTRAINT face_id IF NOT EXISTS
                FOR (f:Face) REQUIRE f.id IS UNIQUE
            """)
            session.run("""
                CREATE INDEX entity_type IF NOT EXISTS
                FOR (e:Entity) ON (e.type)
            """)

    def close(self) -> None:
        """Close the driver connection."""
        if self.driver:
            self.driver.close()

    def create_document_node(self, doc_id: int, filename: str, title: str | None = None) -> None:
        """Create a document node."""
        if not self.enabled or not self.driver:
            return
        with self.driver.session() as session:
            session.run("""
                MERGE (d:Document {id: $id})
                SET d.filename = $filename, d.title = $title
            """, id=doc_id, filename=filename, title=title)

    def create_entity_node(self, entity_id: int, name: str, entity_type: str) -> None:
        """Create an entity node."""
        if not self.enabled or not self.driver:
            return
        with self.driver.session() as session:
            session.run("""
                MERGE (e:Entity {id: $id})
                SET e.name = $name, e.type = $type
            """, id=entity_id, name=name, type=entity_type)

    def create_mention_relationship(self, entity_id: int, document_id: int, count: int = 1) -> None:
        """Create MENTIONED_IN relationship between entity and document."""
        if not self.enabled or not self.driver:
            return
        with self.driver.session() as session:
            session.run("""
                MATCH (e:Entity {id: $entity_id})
                MATCH (d:Document {id: $document_id})
                MERGE (e)-[r:MENTIONED_IN]->(d)
                SET r.count = $count
            """, entity_id=entity_id, document_id=document_id, count=count)

    def create_face_node(self, face_id: int, document_id: int, cluster_id: int | None = None) -> None:
        """Create a face node and link to document."""
        if not self.enabled or not self.driver:
            return
        with self.driver.session() as session:
            session.run("""
                MERGE (f:Face {id: $face_id})
                SET f.cluster_id = $cluster_id
                WITH f
                MATCH (d:Document {id: $document_id})
                MERGE (f)-[:APPEARS_IN]->(d)
            """, face_id=face_id, document_id=document_id, cluster_id=cluster_id)

    def create_same_person_relationship(self, face_id_1: int, face_id_2: int, similarity: float) -> None:
        """Create SAME_PERSON relationship between faces."""
        if not self.enabled or not self.driver:
            return
        with self.driver.session() as session:
            session.run("""
                MATCH (f1:Face {id: $face_id_1})
                MATCH (f2:Face {id: $face_id_2})
                MERGE (f1)-[r:SAME_PERSON]->(f2)
                SET r.similarity = $similarity
            """, face_id_1=face_id_1, face_id_2=face_id_2, similarity=similarity)

    def get_document_connections(self, document_id: int, limit: int = 50) -> dict:
        """Get all connections for a document."""
        if not self.enabled or not self.driver:
            return {"document": None, "entities": [], "faces": [], "related_documents": []}
        with self.driver.session() as session:
            result = session.run("""
                MATCH (d:Document {id: $document_id})
                OPTIONAL MATCH (e:Entity)-[m:MENTIONED_IN]->(d)
                OPTIONAL MATCH (f:Face)-[:APPEARS_IN]->(d)
                OPTIONAL MATCH (e)-[:MENTIONED_IN]->(other:Document)
                WHERE other.id <> d.id
                WITH d,
                     collect(DISTINCT {id: e.id, name: e.name, type: e.type}) as entities,
                     collect(DISTINCT {id: f.id, cluster_id: f.cluster_id}) as faces,
                     collect(DISTINCT {id: other.id, filename: other.filename}) as related_docs
                RETURN d, entities, faces, related_docs[0..$limit] as related_docs
            """, document_id=document_id, limit=limit)
            record = result.single()
            if record:
                return {
                    "document": dict(record["d"]),
                    "entities": [e for e in record["entities"] if e["id"]],
                    "faces": [f for f in record["faces"] if f["id"]],
                    "related_documents": record["related_docs"],
                }
            return {"document": None, "entities": [], "faces": [], "related_documents": []}

    def get_entity_connections(self, entity_id: int, limit: int = 50) -> dict:
        """Get connections for an entity."""
        if not self.enabled or not self.driver:
            return {"entity": None, "documents": [], "co_occurring_entities": []}
        with self.driver.session() as session:
            result = session.run("""
                MATCH (e:Entity {id: $entity_id})
                OPTIONAL MATCH (e)-[:MENTIONED_IN]->(d:Document)
                OPTIONAL MATCH (other:Entity)-[:MENTIONED_IN]->(d)
                WHERE other.id <> e.id
                WITH e,
                     collect(DISTINCT {id: d.id, filename: d.filename}) as documents,
                     collect(DISTINCT {id: other.id, name: other.name, type: other.type}) as co_entities
                RETURN e, documents[0..$limit] as documents, co_entities[0..$limit] as co_entities
            """, entity_id=entity_id, limit=limit)
            record = result.single()
            if record:
                return {
                    "entity": dict(record["e"]),
                    "documents": record["documents"],
                    "co_occurring_entities": [e for e in record["co_entities"] if e["id"]],
                }
            return {"entity": None, "documents": [], "co_occurring_entities": []}

    def get_entity_cooccurrences(self, entity_id: int, limit: int = 20) -> list[dict]:
        """Get entities that co-occur with the given entity."""
        if not self.enabled or not self.driver:
            return []
        with self.driver.session() as session:
            result = session.run("""
                MATCH (e:Entity {id: $entity_id})-[:MENTIONED_IN]->(d:Document)
                MATCH (other:Entity)-[:MENTIONED_IN]->(d)
                WHERE other.id <> e.id
                WITH other, count(DISTINCT d) as shared_docs
                ORDER BY shared_docs DESC
                LIMIT $limit
                RETURN other.id as id, other.name as name, other.type as type, shared_docs
            """, entity_id=entity_id, limit=limit)
            return [dict(record) for record in result]


# Singleton instance
_neo4j_service: Neo4jService | None = None


def get_neo4j_service() -> Neo4jService:
    """Get or create Neo4j service instance."""
    global _neo4j_service
    if _neo4j_service is None:
        _neo4j_service = Neo4jService()
    return _neo4j_service
