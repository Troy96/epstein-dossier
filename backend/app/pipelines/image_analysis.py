"""Image analysis pipeline using Claude Vision API."""

import base64
import json
from pathlib import Path

import anthropic
from rich.console import Console
from rich.progress import Progress
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Document
from app.models.image_analysis import ImageAnalysis

console = Console()

ANALYSIS_PROMPT = """Analyze this image extracted from a legal document (Epstein case DOJ disclosure). Return a JSON object with these fields:

1. "description": 1-2 sentence description of what's in the image
2. "category": One of: document, photo, handwritten, map, flight_log, receipt, evidence, explicit, correspondence, other
3. "tags": Array of descriptive tags (e.g. ["handwritten", "letter", "dated", "signature"])
4. "interest_score": Float 0.0-1.0 rating how notable/evidence-worthy this image is:
   - 0.0-0.2: Routine/boring (blank pages, logos, standard forms)
   - 0.3-0.5: Somewhat interesting (typed documents, standard correspondence)
   - 0.6-0.8: Notable (names of known persons, travel records, financial records, handwritten notes)
   - 0.9-1.0: Highly significant (compromising situations, direct evidence, flight logs with names, photos of key individuals)
5. "flagged": Boolean - true if the image shows any of: compromising situations, illegal activity evidence, photos of identifiable people in notable context, handwritten notes with sensitive content, flight/travel records, financial records
6. "flag_reason": If flagged, explain why in one sentence. Otherwise null.

Return ONLY valid JSON, no other text."""

# Minimum file size to analyze (skip tiny images like logos/artifacts)
MIN_IMAGE_SIZE_BYTES = 5000


class ImageAnalyzer:
    """Analyze document images using Claude Vision API."""

    def __init__(self, db_session: Session) -> None:
        self.db = db_session
        self.images_dir = settings.images_dir
        self.client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    def _encode_image(self, image_path: Path) -> tuple[str, str]:
        """Read and base64-encode an image file. Returns (base64_data, media_type)."""
        suffix = image_path.suffix.lower()
        media_type_map = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
            ".webp": "image/webp",
        }
        media_type = media_type_map.get(suffix, "image/png")

        with open(image_path, "rb") as f:
            data = base64.b64encode(f.read()).decode("utf-8")

        return data, media_type

    def analyze_image(self, image_path: Path) -> dict | None:
        """Send a single image to Claude Vision and get analysis."""
        try:
            image_data, media_type = self._encode_image(image_path)

            response = self.client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=500,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": media_type,
                                    "data": image_data,
                                },
                            },
                            {
                                "type": "text",
                                "text": ANALYSIS_PROMPT,
                            },
                        ],
                    }
                ],
            )

            # Parse the response
            response_text = response.content[0].text.strip()

            # Try to extract JSON from the response
            if response_text.startswith("```"):
                # Strip markdown code blocks
                response_text = response_text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

            result = json.loads(response_text)
            return result

        except json.JSONDecodeError as e:
            console.print(f"[yellow]Failed to parse JSON response for {image_path}: {e}[/yellow]")
            return None
        except anthropic.APIError as e:
            console.print(f"[red]API error for {image_path}: {e}[/red]")
            return None
        except Exception as e:
            console.print(f"[yellow]Analysis failed for {image_path}: {e}[/yellow]")
            return None

    def process_document(self, document: Document) -> int:
        """Process all images from a document."""
        if not document.has_images or document.image_count == 0:
            document.image_analysis_status = "completed"
            return 0

        doc_images_dir = self.images_dir / document.filename.replace(".pdf", "")

        if not doc_images_dir.exists():
            document.image_analysis_status = "completed"
            return 0

        try:
            analyzed_count = 0

            for image_path in sorted(doc_images_dir.iterdir()):
                if image_path.suffix.lower() not in [".png", ".jpg", ".jpeg"]:
                    continue

                # Skip tiny images (logos, artifacts)
                if image_path.stat().st_size < MIN_IMAGE_SIZE_BYTES:
                    continue

                # Skip if already analyzed
                existing = self.db.execute(
                    select(ImageAnalysis).where(
                        ImageAnalysis.document_id == document.id,
                        ImageAnalysis.image_path == str(image_path),
                    )
                ).scalar_one_or_none()

                if existing:
                    continue

                # Analyze the image
                result = self.analyze_image(image_path)

                if result:
                    analysis = ImageAnalysis(
                        document_id=document.id,
                        image_path=str(image_path),
                        description=result.get("description"),
                        tags=result.get("tags", []),
                        category=result.get("category", "other"),
                        interest_score=min(1.0, max(0.0, float(result.get("interest_score", 0.0)))),
                        flagged=bool(result.get("flagged", False)),
                        flag_reason=result.get("flag_reason"),
                        raw_response=result,
                    )
                    self.db.add(analysis)
                    analyzed_count += 1

            document.image_analysis_status = "completed"
            return analyzed_count

        except Exception as e:
            console.print(f"[red]Image analysis failed for {document.filename}: {e}[/red]")
            document.image_analysis_status = "failed"
            return 0

    def process_all(self, limit: int | None = None, reprocess: bool = False) -> dict:
        """Process all pending documents for image analysis."""
        query = select(Document).where(
            Document.ocr_status == "completed",
            Document.has_images == True,
        )

        if not reprocess:
            query = query.where(Document.image_analysis_status == "pending")

        if limit:
            query = query.limit(limit)

        result = self.db.execute(query)
        documents = list(result.scalars().all())

        console.print(f"[blue]Analyzing images from {len(documents)} documents...[/blue]")

        results = {
            "total": len(documents),
            "processed": 0,
            "failed": 0,
            "images_analyzed": 0,
        }

        with Progress() as progress:
            task = progress.add_task("[cyan]Analyzing images...", total=len(documents))

            for doc in documents:
                count = self.process_document(doc)

                if doc.image_analysis_status == "completed":
                    results["processed"] += 1
                    results["images_analyzed"] += count
                else:
                    results["failed"] += 1

                self.db.commit()
                progress.update(task, advance=1)

        console.print("[green]Image analysis complete![/green]")
        console.print(f"  Processed: {results['processed']}")
        console.print(f"  Failed: {results['failed']}")
        console.print(f"  Images analyzed: {results['images_analyzed']}")

        return results


def run_image_analysis(limit: int | None = None, reprocess: bool = False):
    """Run image analysis as a standalone script."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(settings.database_url_sync)
    Session = sessionmaker(bind=engine)

    with Session() as session:
        analyzer = ImageAnalyzer(session)
        analyzer.process_all(limit=limit, reprocess=reprocess)
