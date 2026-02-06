"""Meilisearch service for full-text search."""

import meilisearch
from meilisearch.errors import MeilisearchApiError

from app.core.config import settings


class MeilisearchService:
    """Service for interacting with Meilisearch."""

    INDEX_NAME = "documents"

    def __init__(self) -> None:
        self.client = meilisearch.Client(
            settings.meilisearch_url,
            settings.meilisearch_key if settings.meilisearch_key else None,
        )
        self._ensure_index()

    def _ensure_index(self) -> None:
        """Ensure the documents index exists with proper settings."""
        try:
            self.client.get_index(self.INDEX_NAME)
        except MeilisearchApiError:
            self.client.create_index(self.INDEX_NAME, {"primaryKey": "id"})

        # Configure index settings
        index = self.client.index(self.INDEX_NAME)
        index.update_settings({
            "searchableAttributes": [
                "extracted_text",
                "title",
                "filename",
            ],
            "filterableAttributes": [
                "id",
                "has_images",
                "page_count",
                "earliest_date",
                "latest_date",
            ],
            "sortableAttributes": [
                "filename",
                "page_count",
                "earliest_date",
                "latest_date",
            ],
            "rankingRules": [
                "words",
                "typo",
                "proximity",
                "attribute",
                "sort",
                "exactness",
            ],
        })

    def index_document(self, document: dict) -> None:
        """Index a single document."""
        index = self.client.index(self.INDEX_NAME)
        index.add_documents([document])

    def index_documents(self, documents: list[dict]) -> None:
        """Index multiple documents."""
        if not documents:
            return
        index = self.client.index(self.INDEX_NAME)
        index.add_documents(documents)

    def search(
        self,
        query: str,
        page: int = 1,
        page_size: int = 20,
        filters: str | None = None,
        highlight_pre_tag: str = "<mark>",
        highlight_post_tag: str = "</mark>",
    ) -> dict:
        """Search documents."""
        index = self.client.index(self.INDEX_NAME)

        search_params = {
            "limit": page_size,
            "offset": (page - 1) * page_size,
            "attributesToHighlight": ["extracted_text", "title"],
            "highlightPreTag": highlight_pre_tag,
            "highlightPostTag": highlight_post_tag,
            "attributesToCrop": ["extracted_text"],
            "cropLength": 200,
        }

        if filters:
            search_params["filter"] = filters

        return index.search(query, search_params)

    def delete_document(self, document_id: int) -> None:
        """Delete a document from the index."""
        index = self.client.index(self.INDEX_NAME)
        index.delete_document(document_id)

    def delete_all_documents(self) -> None:
        """Delete all documents from the index."""
        index = self.client.index(self.INDEX_NAME)
        index.delete_all_documents()

    def get_stats(self) -> dict:
        """Get index statistics."""
        index = self.client.index(self.INDEX_NAME)
        return index.get_stats()


# Singleton instance
_meilisearch_service: MeilisearchService | None = None


def get_meilisearch_service() -> MeilisearchService:
    """Get or create Meilisearch service instance."""
    global _meilisearch_service
    if _meilisearch_service is None:
        _meilisearch_service = MeilisearchService()
    return _meilisearch_service
