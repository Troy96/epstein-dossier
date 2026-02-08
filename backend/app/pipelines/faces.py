"""Face detection and recognition pipeline."""

import uuid
from pathlib import Path
from collections import defaultdict

import numpy as np
from PIL import Image
from rich.console import Console
from rich.progress import Progress
from sklearn.cluster import DBSCAN
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Document, Face, FaceCluster
from app.services.chromadb import get_chromadb_service
from app.services.neo4j import get_neo4j_service

console = Console()

# Optional face_recognition import
try:
    import face_recognition
    FACE_RECOGNITION_AVAILABLE = True
except ImportError:
    FACE_RECOGNITION_AVAILABLE = False
    console.print("[yellow]face_recognition not installed - face detection disabled[/yellow]")
    console.print("[yellow]Install with: pip install face-recognition[/yellow]")


class FaceProcessor:
    """Detect and process faces from document images."""

    def __init__(self, db_session: Session) -> None:
        self.db = db_session
        self.images_dir = settings.images_dir
        self.faces_dir = settings.faces_dir
        self.faces_dir.mkdir(parents=True, exist_ok=True)

    def detect_faces_in_image(self, image_path: Path) -> list[dict]:
        """Detect faces in an image and generate embeddings."""
        if not FACE_RECOGNITION_AVAILABLE:
            return []

        try:
            # Load image
            image = face_recognition.load_image_file(str(image_path))

            # Detect face locations
            face_locations = face_recognition.face_locations(image, model="hog")

            if not face_locations:
                return []

            # Generate face encodings
            face_encodings = face_recognition.face_encodings(image, face_locations)

            faces = []
            for location, encoding in zip(face_locations, face_encodings):
                top, right, bottom, left = location

                # Calculate face size
                face_size = (bottom - top) * (right - left)

                # Skip very small faces
                if face_size < 1000:
                    continue

                faces.append({
                    "bbox": {
                        "top": top,
                        "right": right,
                        "bottom": bottom,
                        "left": left,
                    },
                    "encoding": encoding.tolist(),
                    "size": face_size,
                })

            return faces

        except Exception as e:
            console.print(f"[yellow]Face detection failed for {image_path}: {e}[/yellow]")
            return []

    def save_face_crop(
        self,
        image_path: Path,
        bbox: dict,
        face_id: str,
        doc_name: str,
    ) -> Path:
        """Crop and save a face from an image."""
        doc_faces_dir = self.faces_dir / doc_name
        doc_faces_dir.mkdir(parents=True, exist_ok=True)

        image = Image.open(image_path)
        top, right, bottom, left = bbox["top"], bbox["right"], bbox["bottom"], bbox["left"]

        # Add some padding
        padding = int((bottom - top) * 0.2)
        top = max(0, top - padding)
        left = max(0, left - padding)
        bottom = min(image.height, bottom + padding)
        right = min(image.width, right + padding)

        # Crop and save
        face_crop = image.crop((left, top, right, bottom))
        crop_path = doc_faces_dir / f"{face_id}.jpg"
        face_crop.save(crop_path, "JPEG", quality=90)

        return crop_path

    def process_document(self, document: Document) -> int:
        """Process all images from a document for faces."""
        if not FACE_RECOGNITION_AVAILABLE:
            document.face_status = "skipped"
            return 0

        if not document.has_images or document.image_count == 0:
            document.face_status = "completed"
            return 0

        doc_images_dir = self.images_dir / document.filename.replace(".pdf", "")

        if not doc_images_dir.exists():
            document.face_status = "completed"
            return 0

        try:
            chromadb = get_chromadb_service()
            neo4j = get_neo4j_service()
            face_count = 0

            # Process each image
            for image_path in doc_images_dir.iterdir():
                if image_path.suffix.lower() not in [".png", ".jpg", ".jpeg"]:
                    continue

                faces = self.detect_faces_in_image(image_path)

                for face_data in faces:
                    # Skip if similar to a dismissed face
                    if chromadb.is_similar_to_dismissed(face_data["encoding"]):
                        continue

                    # Generate unique ID
                    embedding_id = f"face_{uuid.uuid4().hex[:16]}"

                    # Extract page number from image name
                    page_num = None
                    if "page" in image_path.name:
                        try:
                            page_num = int(image_path.name.split("page")[1][:3])
                        except:
                            pass

                    # Save face crop
                    doc_name = document.filename.replace(".pdf", "")
                    crop_path = self.save_face_crop(
                        image_path,
                        face_data["bbox"],
                        embedding_id,
                        doc_name,
                    )

                    # Create database record
                    db_face = Face(
                        document_id=document.id,
                        image_path=str(image_path),
                        page_number=page_num,
                        bbox_top=face_data["bbox"]["top"],
                        bbox_right=face_data["bbox"]["right"],
                        bbox_bottom=face_data["bbox"]["bottom"],
                        bbox_left=face_data["bbox"]["left"],
                        face_crop_path=str(crop_path),
                        face_size=face_data["size"],
                        embedding_id=embedding_id,
                    )
                    self.db.add(db_face)
                    self.db.flush()

                    # Store embedding in ChromaDB
                    chromadb.add_face_embedding(
                        embedding_id=embedding_id,
                        embedding=face_data["encoding"],
                        metadata={
                            "face_id": db_face.id,
                            "document_id": document.id,
                            "filename": document.filename,
                        },
                    )

                    # Create Neo4j node
                    neo4j.create_face_node(db_face.id, document.id)

                    face_count += 1

            document.face_status = "completed"
            return face_count

        except Exception as e:
            console.print(f"[red]Face processing failed for {document.filename}: {e}[/red]")
            document.face_status = "failed"
            return 0

    def process_all(self, limit: int | None = None, reprocess: bool = False) -> dict:
        """Process all pending documents for faces."""
        if not FACE_RECOGNITION_AVAILABLE:
            console.print("[yellow]Face recognition not available, skipping...[/yellow]")
            return {"total": 0, "processed": 0, "failed": 0, "faces_found": 0}

        query = select(Document).where(
            Document.ocr_status == "completed",
            Document.has_images == True,
        )

        if not reprocess:
            query = query.where(Document.face_status == "pending")

        if limit:
            query = query.limit(limit)

        result = self.db.execute(query)
        documents = list(result.scalars().all())

        console.print(f"[blue]Processing faces from {len(documents)} documents...[/blue]")

        results = {
            "total": len(documents),
            "processed": 0,
            "failed": 0,
            "faces_found": 0,
        }

        with Progress() as progress:
            task = progress.add_task("[cyan]Detecting faces...", total=len(documents))

            for doc in documents:
                faces = self.process_document(doc)

                if doc.face_status == "completed":
                    results["processed"] += 1
                    results["faces_found"] += faces
                else:
                    results["failed"] += 1

                self.db.commit()
                progress.update(task, advance=1)

        console.print(f"[green]Face detection complete![/green]")
        console.print(f"  Processed: {results['processed']}")
        console.print(f"  Failed: {results['failed']}")
        console.print(f"  Total faces: {results['faces_found']}")

        return results

    def cluster_faces(self, distance_threshold: float = 0.5) -> dict:
        """Cluster faces that appear to be the same person."""
        if not FACE_RECOGNITION_AVAILABLE:
            return {"clusters": 0, "faces_clustered": 0}

        console.print("[blue]Clustering faces...[/blue]")

        # Get all faces with embeddings
        result = self.db.execute(select(Face).where(Face.embedding_id.isnot(None)))
        faces = list(result.scalars().all())

        if len(faces) < 2:
            console.print("[yellow]Not enough faces to cluster[/yellow]")
            return {"clusters": 0, "faces_clustered": 0}

        # Get embeddings from ChromaDB
        chromadb = get_chromadb_service()
        embeddings = []
        face_ids = []

        for face in faces:
            emb_data = chromadb.get_embedding(face.embedding_id)
            if emb_data and emb_data["embedding"] is not None:
                embeddings.append(emb_data["embedding"])
                face_ids.append(face.id)

        if len(embeddings) < 2:
            return {"clusters": 0, "faces_clustered": 0}

        # Perform clustering with DBSCAN
        embeddings_array = np.array(embeddings)
        clustering = DBSCAN(
            eps=distance_threshold,
            min_samples=2,
            metric="euclidean",
        ).fit(embeddings_array)

        # Group faces by cluster
        cluster_assignments = defaultdict(list)
        for face_id, cluster_label in zip(face_ids, clustering.labels_):
            if cluster_label >= 0:  # -1 means noise/unclustered
                cluster_assignments[cluster_label].append(face_id)

        console.print(f"[green]Found {len(cluster_assignments)} clusters[/green]")

        # Create cluster records
        neo4j = get_neo4j_service()

        for cluster_label, cluster_face_ids in cluster_assignments.items():
            # Get faces in this cluster
            cluster_faces = self.db.execute(
                select(Face).where(Face.id.in_(cluster_face_ids))
            ).scalars().all()

            # Find representative face (largest)
            representative = max(cluster_faces, key=lambda f: f.face_size or 0)

            # Count unique documents
            doc_ids = set(f.document_id for f in cluster_faces)

            # Create cluster record
            db_cluster = FaceCluster(
                representative_face_id=representative.id,
                face_count=len(cluster_face_ids),
                document_count=len(doc_ids),
            )
            self.db.add(db_cluster)
            self.db.flush()

            # Update faces with cluster ID
            for face in cluster_faces:
                face.cluster_id = db_cluster.id

            # Create Neo4j relationships for same person
            for i, f1 in enumerate(cluster_faces):
                for f2 in cluster_faces[i + 1:]:
                    neo4j.create_same_person_relationship(f1.id, f2.id, 0.9)

        self.db.commit()

        return {
            "clusters": len(cluster_assignments),
            "faces_clustered": sum(len(f) for f in cluster_assignments.values()),
        }


def run_face_processing(limit: int | None = None, reprocess: bool = False):
    """Run face processing as a standalone script."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(settings.database_url_sync)
    Session = sessionmaker(bind=engine)

    with Session() as session:
        processor = FaceProcessor(session)
        processor.process_all(limit=limit, reprocess=reprocess)
        processor.cluster_faces()
