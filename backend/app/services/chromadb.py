"""ChromaDB service for face embeddings."""

import chromadb
from chromadb.config import Settings as ChromaSettings
from rich.console import Console

from app.core.config import settings

console = Console()


class ChromaDBService:
    """Service for face embedding storage and similarity search."""

    COLLECTION_NAME = "face_embeddings"
    DISMISSED_COLLECTION_NAME = "dismissed_face_embeddings"

    def __init__(self) -> None:
        # Use persistent local storage
        persist_dir = settings.data_dir / "chromadb"
        persist_dir.mkdir(parents=True, exist_ok=True)

        try:
            # Try HTTP client first (if ChromaDB server is running)
            self.client = chromadb.HttpClient(
                host=settings.chromadb_host,
                port=settings.chromadb_port,
                settings=ChromaSettings(anonymized_telemetry=False),
            )
            # Test connection
            self.client.heartbeat()
            console.print("[green]ChromaDB server connected[/green]")
        except Exception:
            # Fall back to persistent local client
            console.print("[yellow]ChromaDB server not available, using local storage[/yellow]")
            self.client = chromadb.PersistentClient(
                path=str(persist_dir),
                settings=ChromaSettings(anonymized_telemetry=False),
            )

        self._ensure_collection()

    def _ensure_collection(self) -> None:
        """Ensure the face embeddings collections exist."""
        self.collection = self.client.get_or_create_collection(
            name=self.COLLECTION_NAME,
            metadata={"description": "Face embeddings for similarity search"},
        )
        self.dismissed_collection = self.client.get_or_create_collection(
            name=self.DISMISSED_COLLECTION_NAME,
            metadata={"description": "Dismissed false positive face embeddings"},
        )

    def add_face_embedding(
        self,
        embedding_id: str,
        embedding: list[float],
        metadata: dict | None = None,
    ) -> None:
        """Add a single face embedding."""
        self.collection.add(
            ids=[embedding_id],
            embeddings=[embedding],
            metadatas=[metadata or {}],
        )

    def add_face_embeddings(
        self,
        embedding_ids: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict] | None = None,
    ) -> None:
        """Add multiple face embeddings."""
        if not embedding_ids:
            return
        self.collection.add(
            ids=embedding_ids,
            embeddings=embeddings,
            metadatas=metadatas or [{}] * len(embedding_ids),
        )

    def search_similar(
        self,
        query_embedding: list[float],
        n_results: int = 10,
        where: dict | None = None,
    ) -> dict:
        """Search for similar faces by embedding."""
        return self.collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            where=where,
            include=["metadatas", "distances"],
        )

    def get_embedding(self, embedding_id: str) -> dict | None:
        """Get a specific embedding by ID."""
        result = self.collection.get(
            ids=[embedding_id],
            include=["embeddings", "metadatas"],
        )
        if result["ids"]:
            return {
                "id": result["ids"][0],
                "embedding": result["embeddings"][0] if result["embeddings"] is not None and len(result["embeddings"]) > 0 else None,
                "metadata": result["metadatas"][0] if result["metadatas"] is not None and len(result["metadatas"]) > 0 else None,
            }
        return None

    def delete_embedding(self, embedding_id: str) -> None:
        """Delete an embedding."""
        self.collection.delete(ids=[embedding_id])

    def delete_all_embeddings(self) -> None:
        """Delete all embeddings."""
        self.client.delete_collection(self.COLLECTION_NAME)
        self._ensure_collection()

    def add_dismissed_embedding(
        self,
        embedding_id: str,
        embedding: list[float],
        metadata: dict | None = None,
    ) -> None:
        """Add a dismissed face embedding for future filtering."""
        self.dismissed_collection.add(
            ids=[embedding_id],
            embeddings=[embedding],
            metadatas=[metadata or {}],
        )

    def is_similar_to_dismissed(
        self,
        embedding: list[float],
        threshold: float = 0.4,
    ) -> bool:
        """Check if an embedding is similar to any dismissed face."""
        if self.dismissed_collection.count() == 0:
            return False
        results = self.dismissed_collection.query(
            query_embeddings=[embedding],
            n_results=1,
            include=["distances"],
        )
        if results["distances"] is not None and len(results["distances"]) > 0 and len(results["distances"][0]) > 0:
            return results["distances"][0][0] < threshold
        return False

    def count(self) -> int:
        """Get total number of embeddings."""
        return self.collection.count()


# Singleton instance
_chromadb_service: ChromaDBService | None = None


def get_chromadb_service() -> ChromaDBService:
    """Get or create ChromaDB service instance."""
    global _chromadb_service
    if _chromadb_service is None:
        _chromadb_service = ChromaDBService()
    return _chromadb_service
