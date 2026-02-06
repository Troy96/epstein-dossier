"""Search service combining Meilisearch with database filters."""

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Document, Entity, EntityMention
from app.services.meilisearch import get_meilisearch_service
from app.schemas.search import SearchQuery, SearchResponse, SearchHit


class SearchService:
    """Unified search service."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.meilisearch = get_meilisearch_service()

    async def search(self, query: SearchQuery) -> SearchResponse:
        """Perform full-text search with optional filters."""
        import time
        start_time = time.time()

        # Build Meilisearch filter string
        filter_parts = []

        if query.filters:
            if query.filters.document_ids:
                ids_str = ", ".join(str(id) for id in query.filters.document_ids)
                filter_parts.append(f"id IN [{ids_str}]")

            if query.filters.has_faces is not None:
                filter_parts.append(f"has_images = {str(query.filters.has_faces).lower()}")

            if query.filters.date_from:
                filter_parts.append(f"earliest_date >= {query.filters.date_from.isoformat()}")

            if query.filters.date_to:
                filter_parts.append(f"latest_date <= {query.filters.date_to.isoformat()}")

            # Entity filters require database lookup first
            if query.filters.entity_ids:
                doc_ids = await self._get_documents_by_entities(query.filters.entity_ids)
                if doc_ids:
                    ids_str = ", ".join(str(id) for id in doc_ids)
                    filter_parts.append(f"id IN [{ids_str}]")
                else:
                    # No documents match the entity filter
                    return SearchResponse(
                        query=query.query,
                        hits=[],
                        total=0,
                        page=query.page,
                        page_size=query.page_size,
                        total_pages=0,
                        processing_time_ms=int((time.time() - start_time) * 1000),
                    )

        filter_str = " AND ".join(filter_parts) if filter_parts else None

        # Perform Meilisearch query
        results = self.meilisearch.search(
            query=query.query,
            page=query.page,
            page_size=query.page_size,
            filters=filter_str,
            highlight_pre_tag=query.highlight_pre_tag,
            highlight_post_tag=query.highlight_post_tag,
        )

        # Convert results to response format
        hits = []
        for hit in results.get("hits", []):
            formatted = hit.get("_formatted", {})
            highlights = {}
            if "extracted_text" in formatted:
                highlights["extracted_text"] = [formatted["extracted_text"]]
            if "title" in formatted:
                highlights["title"] = [formatted["title"]]

            hits.append(SearchHit(
                id=hit["id"],
                filename=hit.get("filename", ""),
                title=hit.get("title"),
                page_count=hit.get("page_count", 0),
                score=hit.get("_rankingScore", 0),
                highlights=highlights,
            ))

        total = results.get("estimatedTotalHits", 0)
        total_pages = (total + query.page_size - 1) // query.page_size if total > 0 else 0

        return SearchResponse(
            query=query.query,
            hits=hits,
            total=total,
            page=query.page,
            page_size=query.page_size,
            total_pages=total_pages,
            processing_time_ms=int((time.time() - start_time) * 1000),
        )

    async def _get_documents_by_entities(self, entity_ids: list[int]) -> list[int]:
        """Get document IDs that mention any of the given entities."""
        result = await self.db.execute(
            select(EntityMention.document_id)
            .where(EntityMention.entity_id.in_(entity_ids))
            .distinct()
        )
        return [row[0] for row in result.all()]

    async def get_search_suggestions(
        self,
        prefix: str,
        limit: int = 10,
    ) -> list[dict]:
        """Get search suggestions based on prefix."""
        suggestions = []

        # Search entities matching prefix
        result = await self.db.execute(
            select(Entity.name, Entity.entity_type)
            .where(Entity.name.ilike(f"{prefix}%"))
            .order_by(Entity.mention_count.desc())
            .limit(limit)
        )
        for row in result.all():
            suggestions.append({
                "text": row[0],
                "type": f"entity:{row[1].lower()}",
                "score": 1.0,
            })

        return suggestions
