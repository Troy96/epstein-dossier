"""CLI for managing the Epstein Dossier data pipelines."""

import asyncio

import typer
from rich.console import Console
from rich.table import Table
from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

app = typer.Typer(help="Epstein Dossier CLI")
console = Console()


def get_session():
    """Get database session."""
    engine = create_engine(settings.database_url_sync)
    Session = sessionmaker(bind=engine)
    return Session()


@app.command()
def download(
    limit: int = typer.Option(None, help="Limit number of PDFs to download"),
    concurrent: int = typer.Option(5, help="Number of concurrent downloads"),
):
    """Download PDFs from DOJ website."""
    from app.pipelines.downloader import PDFDownloader

    session = get_session()
    downloader = PDFDownloader(session)
    asyncio.run(downloader.download_all(max_concurrent=concurrent, limit=limit))
    session.close()


@app.command()
def ocr(
    limit: int = typer.Option(None, help="Limit number of documents to process"),
    reprocess: bool = typer.Option(False, help="Reprocess already completed documents"),
):
    """Run OCR on downloaded PDFs."""
    from app.pipelines.ocr import OCRPipeline

    session = get_session()
    pipeline = OCRPipeline(session)
    pipeline.process_all(limit=limit, reprocess=reprocess)
    session.close()


@app.command()
def entities(
    limit: int = typer.Option(None, help="Limit number of documents to process"),
    reprocess: bool = typer.Option(False, help="Reprocess already completed documents"),
):
    """Extract entities from document text."""
    from app.pipelines.entities import EntityExtractor

    session = get_session()
    extractor = EntityExtractor(session)
    extractor.process_all(limit=limit, reprocess=reprocess)
    session.close()


@app.command()
def faces(
    limit: int = typer.Option(None, help="Limit number of documents to process"),
    reprocess: bool = typer.Option(False, help="Reprocess already completed documents"),
    cluster: bool = typer.Option(True, help="Run face clustering after detection"),
):
    """Detect and process faces from document images."""
    from app.pipelines.faces import FaceProcessor

    session = get_session()
    processor = FaceProcessor(session)
    processor.process_all(limit=limit, reprocess=reprocess)

    if cluster:
        processor.cluster_faces()

    session.close()


@app.command()
def analyze_images(
    limit: int = typer.Option(None, help="Limit number of documents to process"),
    reprocess: bool = typer.Option(False, help="Reprocess already completed documents"),
):
    """Analyze document images using Claude Vision AI."""
    from app.pipelines.image_analysis import ImageAnalyzer

    session = get_session()
    analyzer = ImageAnalyzer(session)
    analyzer.process_all(limit=limit, reprocess=reprocess)
    session.close()


@app.command()
def index(
    limit: int = typer.Option(None, help="Limit number of documents to index"),
    reindex: bool = typer.Option(False, help="Reindex already indexed documents"),
):
    """Index documents in Meilisearch."""
    from app.pipelines.indexer import SearchIndexer

    session = get_session()
    indexer = SearchIndexer(session)
    indexer.index_all(limit=limit, reindex=reindex)
    session.close()


@app.command()
def process_all(
    limit: int = typer.Option(None, help="Limit number of documents to process"),
):
    """Run all processing pipelines in sequence."""
    from app.pipelines.downloader import PDFDownloader
    from app.pipelines.ocr import OCRPipeline
    from app.pipelines.entities import EntityExtractor
    from app.pipelines.faces import FaceProcessor
    from app.pipelines.indexer import SearchIndexer

    session = get_session()

    console.print("[bold blue]Starting full pipeline...[/bold blue]")

    # 1. Download
    console.print("\n[bold]Step 1: Downloading PDFs[/bold]")
    downloader = PDFDownloader(session)
    asyncio.run(downloader.download_all(limit=limit))

    # 2. OCR
    console.print("\n[bold]Step 2: Running OCR[/bold]")
    ocr_pipeline = OCRPipeline(session)
    ocr_pipeline.process_all(limit=limit)

    # 3. Entity extraction
    console.print("\n[bold]Step 3: Extracting Entities[/bold]")
    extractor = EntityExtractor(session)
    extractor.process_all(limit=limit)

    # 4. Face processing
    console.print("\n[bold]Step 4: Processing Faces[/bold]")
    processor = FaceProcessor(session)
    processor.process_all(limit=limit)
    processor.cluster_faces()

    # 5. Indexing
    console.print("\n[bold]Step 5: Indexing for Search[/bold]")
    indexer = SearchIndexer(session)
    indexer.index_all(limit=limit)

    console.print("\n[bold green]Pipeline complete![/bold green]")
    session.close()


@app.command()
def status():
    """Show processing status."""
    from app.models import Document, Entity, Face, FaceCluster

    session = get_session()

    # Document counts by status
    console.print("\n[bold]Document Status[/bold]")
    table = Table()
    table.add_column("Status")
    table.add_column("Download")
    table.add_column("OCR")
    table.add_column("Entities")
    table.add_column("Faces")
    table.add_column("Images AI")
    table.add_column("Indexed")

    statuses = ["pending", "completed", "downloaded", "indexed", "failed"]

    for status in statuses:
        row = [status]
        for field in ["download_status", "ocr_status", "entity_status", "face_status", "image_analysis_status", "indexed_status"]:
            result = session.execute(
                select(func.count(Document.id)).where(getattr(Document, field) == status)
            )
            count = result.scalar() or 0
            row.append(str(count) if count > 0 else "-")
        table.add_row(*row)

    console.print(table)

    # Entity counts
    console.print("\n[bold]Entity Counts[/bold]")
    result = session.execute(
        select(Entity.entity_type, func.count(Entity.id))
        .group_by(Entity.entity_type)
    )
    entity_table = Table()
    entity_table.add_column("Type")
    entity_table.add_column("Count")
    for row in result.all():
        entity_table.add_row(row[0], str(row[1]))
    console.print(entity_table)

    # Face counts
    console.print("\n[bold]Face Counts[/bold]")
    face_count = session.execute(select(func.count(Face.id))).scalar()
    cluster_count = session.execute(select(func.count(FaceCluster.id))).scalar()
    console.print(f"Total faces: {face_count}")
    console.print(f"Face clusters: {cluster_count}")

    session.close()


@app.command()
def init_db():
    """Initialize database tables."""
    from app.db.session import Base

    engine = create_engine(settings.database_url_sync)
    Base.metadata.create_all(engine)
    console.print("[green]Database initialized![/green]")


@app.command()
def serve(
    host: str = typer.Option("0.0.0.0", help="Host to bind to"),
    port: int = typer.Option(8080, help="Port to listen on"),
    reload: bool = typer.Option(True, help="Enable auto-reload"),
):
    """Start the API server."""
    import uvicorn
    uvicorn.run("app.main:app", host=host, port=port, reload=reload)


if __name__ == "__main__":
    app()
