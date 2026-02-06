"""Entity extraction pipeline using spaCy NER."""

import re
from collections import defaultdict

import spacy
from rich.console import Console
from rich.progress import Progress
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Document, Entity, EntityMention
from app.services.neo4j import get_neo4j_service

console = Console()


class EntityExtractor:
    """Extract named entities from document text."""

    # Entity types to extract
    ENTITY_TYPES = {"PERSON", "ORG", "GPE", "LOC", "DATE"}

    def __init__(self, db_session: Session) -> None:
        self.db = db_session
        self._nlp = None

    @property
    def nlp(self):
        """Lazy load spaCy model."""
        if self._nlp is None:
            console.print("[blue]Loading spaCy model...[/blue]")
            self._nlp = spacy.load("en_core_web_lg")
        return self._nlp

    def normalize_name(self, name: str) -> str:
        """Normalize entity name for deduplication."""
        # Lowercase, strip whitespace, remove extra spaces
        normalized = " ".join(name.lower().split())
        # Remove common titles/prefixes
        prefixes = ["mr.", "mrs.", "ms.", "dr.", "prof."]
        for prefix in prefixes:
            if normalized.startswith(prefix):
                normalized = normalized[len(prefix):].strip()
        return normalized

    def extract_entities(self, text: str) -> list[dict]:
        """Extract entities from text."""
        if not text or len(text.strip()) < 10:
            return []

        # Process text in chunks to handle large documents
        max_length = 1000000  # spaCy default
        chunks = [text[i:i + max_length] for i in range(0, len(text), max_length)]

        entities = []
        for chunk in chunks:
            doc = self.nlp(chunk)

            for ent in doc.ents:
                if ent.label_ in self.ENTITY_TYPES:
                    # Skip very short entities
                    if len(ent.text.strip()) < 2:
                        continue

                    # Get context around entity
                    start = max(0, ent.start_char - 100)
                    end = min(len(chunk), ent.end_char + 100)
                    context = chunk[start:end]

                    entities.append({
                        "text": ent.text.strip(),
                        "label": ent.label_,
                        "start": ent.start_char,
                        "end": ent.end_char,
                        "context": context,
                    })

        return entities

    def get_or_create_entity(self, name: str, entity_type: str) -> Entity:
        """Get existing entity or create new one."""
        normalized = self.normalize_name(name)

        # Look for existing entity
        result = self.db.execute(
            select(Entity).where(
                Entity.normalized_name == normalized,
                Entity.entity_type == entity_type,
            )
        )
        entity = result.scalar_one_or_none()

        if entity:
            return entity

        # Create new entity
        entity = Entity(
            name=name,
            normalized_name=normalized,
            entity_type=entity_type,
            mention_count=0,
            document_count=0,
        )
        self.db.add(entity)
        self.db.flush()

        return entity

    def process_document(self, document: Document) -> int:
        """Process a single document for entities."""
        if not document.extracted_text:
            document.entity_status = "completed"
            return 0

        try:
            # Extract entities
            raw_entities = self.extract_entities(document.extracted_text)

            # Group by normalized name and type
            entity_groups = defaultdict(list)
            for ent in raw_entities:
                key = (self.normalize_name(ent["text"]), ent["label"])
                entity_groups[key].append(ent)

            mention_count = 0
            neo4j = get_neo4j_service()

            # Create document node in Neo4j
            neo4j.create_document_node(document.id, document.filename, document.title)

            for (normalized, label), mentions in entity_groups.items():
                # Get or create entity
                entity = self.get_or_create_entity(mentions[0]["text"], label)

                # Create mention records
                for mention in mentions:
                    db_mention = EntityMention(
                        entity_id=entity.id,
                        document_id=document.id,
                        context_snippet=mention["context"],
                        char_start=mention["start"],
                        char_end=mention["end"],
                    )
                    self.db.add(db_mention)
                    mention_count += 1

                # Update entity counts
                entity.mention_count += len(mentions)
                entity.document_count += 1

                # Create Neo4j relationships
                neo4j.create_entity_node(entity.id, entity.name, entity.entity_type)
                neo4j.create_mention_relationship(entity.id, document.id, len(mentions))

            document.entity_status = "completed"
            return mention_count

        except Exception as e:
            console.print(f"[red]Entity extraction failed for {document.filename}: {e}[/red]")
            document.entity_status = "failed"
            return 0

    def process_all(self, limit: int | None = None, reprocess: bool = False) -> dict:
        """Process all pending documents."""
        query = select(Document).where(Document.ocr_status == "completed")

        if not reprocess:
            query = query.where(Document.entity_status == "pending")

        if limit:
            query = query.limit(limit)

        result = self.db.execute(query)
        documents = list(result.scalars().all())

        console.print(f"[blue]Extracting entities from {len(documents)} documents...[/blue]")

        results = {
            "total": len(documents),
            "processed": 0,
            "failed": 0,
            "entities_found": 0,
        }

        with Progress() as progress:
            task = progress.add_task("[cyan]Extracting entities...", total=len(documents))

            for doc in documents:
                mentions = self.process_document(doc)

                if doc.entity_status == "completed":
                    results["processed"] += 1
                    results["entities_found"] += mentions
                else:
                    results["failed"] += 1

                self.db.commit()
                progress.update(task, advance=1)

        console.print(f"[green]Entity extraction complete![/green]")
        console.print(f"  Processed: {results['processed']}")
        console.print(f"  Failed: {results['failed']}")
        console.print(f"  Total mentions: {results['entities_found']}")

        return results

    def get_top_entities(self, entity_type: str | None = None, limit: int = 20) -> list[Entity]:
        """Get top entities by mention count."""
        query = select(Entity).order_by(Entity.mention_count.desc())

        if entity_type:
            query = query.where(Entity.entity_type == entity_type)

        query = query.limit(limit)
        result = self.db.execute(query)
        return list(result.scalars().all())


def run_entity_extraction(limit: int | None = None, reprocess: bool = False):
    """Run entity extraction as a standalone script."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(settings.database_url_sync)
    Session = sessionmaker(bind=engine)

    with Session() as session:
        extractor = EntityExtractor(session)
        extractor.process_all(limit=limit, reprocess=reprocess)
