"""User annotation models."""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship

from app.db.session import Base


class Annotation(Base):
    """User annotation on a document."""

    __tablename__ = "annotations"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)

    # Annotation content
    note = Column(Text)
    tags = Column(JSON)  # List of tag strings
    bookmarked = Column(Boolean, default=False)

    # Location in document (optional)
    page_number = Column(Integer)
    highlight_start = Column(Integer)
    highlight_end = Column(Integer)
    highlight_text = Column(Text)

    # User identifier (for multi-user support later)
    user_id = Column(String(100), default="default")

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    document = relationship("Document", back_populates="annotations")

    def __repr__(self) -> str:
        return f"<Annotation(id={self.id}, document_id={self.document_id})>"
