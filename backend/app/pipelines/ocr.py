"""OCR pipeline for text and image extraction from PDFs."""

import hashlib
from pathlib import Path

import fitz  # PyMuPDF
import pytesseract
from PIL import Image
from rich.console import Console
from rich.progress import Progress
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Document

console = Console()


class OCRPipeline:
    """Extract text and images from PDFs."""

    def __init__(self, db_session: Session) -> None:
        self.db = db_session
        self.pdf_dir = settings.pdf_dir
        self.images_dir = settings.images_dir
        self.images_dir.mkdir(parents=True, exist_ok=True)

    def extract_text_from_pdf(self, pdf_path: Path) -> tuple[str, int]:
        """Extract text from a PDF using PyMuPDF, falling back to OCR."""
        doc = fitz.open(pdf_path)
        full_text = []
        page_count = len(doc)

        for page_num, page in enumerate(doc):
            # Try direct text extraction first
            text = page.get_text()

            # If very little text, use OCR
            if len(text.strip()) < 50:
                # Render page to image for OCR
                mat = fitz.Matrix(2, 2)  # 2x zoom for better OCR
                pix = page.get_pixmap(matrix=mat)
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

                # OCR the image
                try:
                    ocr_text = pytesseract.image_to_string(img)
                    if ocr_text.strip():
                        text = ocr_text
                except Exception as e:
                    console.print(f"[yellow]OCR failed for page {page_num}: {e}[/yellow]")

            full_text.append(text)

        doc.close()
        return "\n\n".join(full_text), page_count

    def extract_images_from_pdf(self, pdf_path: Path, doc_id: int) -> list[str]:
        """Extract all images from a PDF."""
        doc = fitz.open(pdf_path)
        base_name = pdf_path.stem
        doc_images_dir = self.images_dir / base_name
        doc_images_dir.mkdir(parents=True, exist_ok=True)

        extracted_images = []
        image_count = 0

        for page_num, page in enumerate(doc):
            image_list = page.get_images(full=True)

            for img_index, img_info in enumerate(image_list):
                xref = img_info[0]

                try:
                    base_image = doc.extract_image(xref)
                    image_bytes = base_image["image"]
                    image_ext = base_image["ext"]

                    # Skip very small images (likely icons)
                    if len(image_bytes) < 1000:
                        continue

                    # Save image
                    image_name = f"page{page_num:03d}_img{img_index:03d}.{image_ext}"
                    image_path = doc_images_dir / image_name
                    image_path.write_bytes(image_bytes)

                    extracted_images.append(str(image_path))
                    image_count += 1

                except Exception as e:
                    console.print(f"[yellow]Failed to extract image: {e}[/yellow]")

        doc.close()
        return extracted_images

    def process_document(self, document: Document) -> bool:
        """Process a single document: extract text and images."""
        pdf_path = self.pdf_dir / document.filename

        if not pdf_path.exists():
            console.print(f"[red]PDF not found: {document.filename}[/red]")
            document.ocr_status = "failed"
            return False

        try:
            # Extract text
            text, page_count = self.extract_text_from_pdf(pdf_path)
            document.extracted_text = text
            document.page_count = page_count

            # Extract images
            images = self.extract_images_from_pdf(pdf_path, document.id)
            document.has_images = len(images) > 0
            document.image_count = len(images)

            document.ocr_status = "completed"
            return True

        except Exception as e:
            console.print(f"[red]Failed to process {document.filename}: {e}[/red]")
            document.ocr_status = "failed"
            return False

    def process_all(self, limit: int | None = None, reprocess: bool = False) -> dict:
        """Process all pending documents."""
        query = select(Document).where(Document.download_status == "downloaded")

        if not reprocess:
            query = query.where(Document.ocr_status == "pending")

        if limit:
            query = query.limit(limit)

        result = self.db.execute(query)
        documents = list(result.scalars().all())

        console.print(f"[blue]Processing {len(documents)} documents...[/blue]")

        results = {
            "total": len(documents),
            "processed": 0,
            "failed": 0,
        }

        with Progress() as progress:
            task = progress.add_task("[cyan]Processing PDFs...", total=len(documents))

            for doc in documents:
                if self.process_document(doc):
                    results["processed"] += 1
                else:
                    results["failed"] += 1

                self.db.commit()
                progress.update(task, advance=1)

        console.print(f"[green]OCR complete![/green]")
        console.print(f"  Processed: {results['processed']}")
        console.print(f"  Failed: {results['failed']}")

        return results

    def get_pending_documents(self) -> list[Document]:
        """Get documents pending OCR."""
        result = self.db.execute(
            select(Document)
            .where(Document.download_status == "downloaded")
            .where(Document.ocr_status == "pending")
        )
        return list(result.scalars().all())


def run_ocr_pipeline(limit: int | None = None, reprocess: bool = False):
    """Run the OCR pipeline as a standalone script."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(settings.database_url_sync)
    Session = sessionmaker(bind=engine)

    with Session() as session:
        pipeline = OCRPipeline(session)
        pipeline.process_all(limit=limit, reprocess=reprocess)
