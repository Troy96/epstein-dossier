"""Image analysis model for AI-powered image scanning."""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship

from app.db.session import Base


class ImageAnalysis(Base):
    """AI-generated analysis of a document image."""

    __tablename__ = "image_analyses"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)

    # Source image
    image_path = Column(String(500), nullable=False)

    # AI-generated analysis
    description = Column(Text)
    tags = Column(JSON, default=list)  # List of string tags
    category = Column(String(50), index=True)  # document, photo, handwritten, map, flight_log, receipt, evidence, explicit, correspondence, other
    interest_score = Column(Float, default=0.0)  # 0.0 to 1.0

    # Flagging
    flagged = Column(Boolean, default=False, index=True)
    flag_reason = Column(Text)

    # Raw API response
    raw_response = Column(JSON)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    document = relationship("Document", back_populates="image_analyses")

    def __repr__(self) -> str:
        return f"<ImageAnalysis(id={self.id}, document_id={self.document_id}, category='{self.category}', flagged={self.flagged})>"
