"""Face detection and clustering models."""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Index
from sqlalchemy.orm import relationship

from app.db.session import Base


class FaceCluster(Base):
    """Group of faces representing the same person."""

    __tablename__ = "face_clusters"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255))  # Optional name if identified
    representative_face_id = Column(Integer)  # Best quality face for this cluster

    # Stats
    face_count = Column(Integer, default=0)
    document_count = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    faces = relationship("Face", back_populates="cluster")

    def __repr__(self) -> str:
        return f"<FaceCluster(id={self.id}, name='{self.name}', face_count={self.face_count})>"


class Face(Base):
    """Detected face in a document image."""

    __tablename__ = "faces"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    cluster_id = Column(Integer, ForeignKey("face_clusters.id", ondelete="SET NULL"), index=True)

    # Source image info
    image_path = Column(String(500), nullable=False)  # Path to extracted image
    page_number = Column(Integer)

    # Face location in image
    bbox_top = Column(Integer)
    bbox_right = Column(Integer)
    bbox_bottom = Column(Integer)
    bbox_left = Column(Integer)

    # Face crop path
    face_crop_path = Column(String(500))

    # Quality metrics
    face_size = Column(Integer)  # pixels (width * height)
    confidence = Column(Float)

    # Embedding reference (stored in ChromaDB)
    embedding_id = Column(String(100), unique=True, index=True)

    # Extra data
    extra_data = Column(JSON)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    document = relationship("Document", back_populates="faces")
    cluster = relationship("FaceCluster", back_populates="faces")

    __table_args__ = (
        Index("ix_faces_doc_page", "document_id", "page_number"),
    )

    def __repr__(self) -> str:
        return f"<Face(id={self.id}, document_id={self.document_id}, cluster_id={self.cluster_id})>"
