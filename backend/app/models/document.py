"""Document model."""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, JSON
from sqlalchemy.orm import relationship

from app.db.session import Base


class Document(Base):
    """PDF document metadata and extracted content."""

    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), unique=True, index=True, nullable=False)
    title = Column(String(500))
    source_url = Column(String(1000))

    # PDF metadata
    page_count = Column(Integer, default=0)
    file_size = Column(Integer)  # bytes
    file_hash = Column(String(64))  # SHA-256

    # Extracted content
    extracted_text = Column(Text)
    has_images = Column(Boolean, default=False)
    image_count = Column(Integer, default=0)

    # Processing status
    download_status = Column(String(50), default="pending")  # pending, downloaded, failed
    ocr_status = Column(String(50), default="pending")  # pending, completed, failed
    entity_status = Column(String(50), default="pending")  # pending, completed, failed
    face_status = Column(String(50), default="pending")  # pending, completed, failed
    indexed_status = Column(String(50), default="pending")  # pending, indexed, failed

    # Dates extracted from content
    dates_mentioned = Column(JSON)  # List of dates found in document
    earliest_date = Column(DateTime)
    latest_date = Column(DateTime)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    entity_mentions = relationship("EntityMention", back_populates="document", cascade="all, delete-orphan")
    faces = relationship("Face", back_populates="document", cascade="all, delete-orphan")
    annotations = relationship("Annotation", back_populates="document", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Document(id={self.id}, filename='{self.filename}')>"
