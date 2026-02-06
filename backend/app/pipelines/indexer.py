"""Index documents in Meilisearch for full-text search."""

from rich.console import Console
from rich.progress import Progress
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Document
from app.services.meilisearch import get_meilisearch_service

console = Console()


class SearchIndexer:
    """Index documents in Meilisearch."""

    def __init__(self, db_session: Session) -> None:
        self.db = db_session
        self.meilisearch = get_meilisearch_service()

    def index_document(self, document: Document) -> bool:
        """Index a single document."""
        try:
            doc_data = {
                "id": document.id,
                "filename": document.filename,
                "title": document.title,
                "extracted_text": document.extracted_text or "",
                "page_count": document.page_count,
                "has_images": document.has_images,
                "image_count": document.image_count,
                "earliest_date": document.earliest_date.isoformat() if document.earliest_date else None,
                "latest_date": document.latest_date.isoformat() if document.latest_date else None,
            }

            self.meilisearch.index_document(doc_data)
            document.indexed_status = "indexed"
            return True

        except Exception as e:
            console.print(f"[red]Indexing failed for {document.filename}: {e}[/red]")
            document.indexed_status = "failed"
            return False

    def index_all(self, limit: int | None = None, reindex: bool = False) -> dict:
        """Index all pending documents."""
        query = select(Document).where(Document.ocr_status == "completed")

        if not reindex:
            query = query.where(Document.indexed_status == "pending")

        if limit:
            query = query.limit(limit)

        result = self.db.execute(query)
        documents = list(result.scalars().all())

        console.print(f"[blue]Indexing {len(documents)} documents...[/blue]")

        results = {
            "total": len(documents),
            "indexed": 0,
            "failed": 0,
        }

        # Batch index for efficiency
        batch_size = settings.batch_size
        batches = [documents[i:i + batch_size] for i in range(0, len(documents), batch_size)]

        with Progress() as progress:
            task = progress.add_task("[cyan]Indexing...", total=len(documents))

            for batch in batches:
                batch_data = []
                for doc in batch:
                    doc_data = {
                        "id": doc.id,
                        "filename": doc.filename,
                        "title": doc.title,
                        "extracted_text": doc.extracted_text or "",
                        "page_count": doc.page_count,
                        "has_images": doc.has_images,
                        "image_count": doc.image_count,
                        "earliest_date": doc.earliest_date.isoformat() if doc.earliest_date else None,
                        "latest_date": doc.latest_date.isoformat() if doc.latest_date else None,
                    }
                    batch_data.append(doc_data)
                    doc.indexed_status = "indexed"

                try:
                    self.meilisearch.index_documents(batch_data)
                    results["indexed"] += len(batch)
                except Exception as e:
                    console.print(f"[red]Batch indexing failed: {e}[/red]")
                    for doc in batch:
                        doc.indexed_status = "failed"
                    results["failed"] += len(batch)

                self.db.commit()
                progress.update(task, advance=len(batch))

        console.print(f"[green]Indexing complete![/green]")
        console.print(f"  Indexed: {results['indexed']}")
        console.print(f"  Failed: {results['failed']}")

        return results

    def get_stats(self) -> dict:
        """Get search index statistics."""
        return self.meilisearch.get_stats()


def run_indexer(limit: int | None = None, reindex: bool = False):
    """Run indexer as a standalone script."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(settings.database_url_sync)
    Session = sessionmaker(bind=engine)

    with Session() as session:
        indexer = SearchIndexer(session)
        indexer.index_all(limit=limit, reindex=reindex)
