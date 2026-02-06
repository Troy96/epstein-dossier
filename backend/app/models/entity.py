"""Entity models for NER extraction."""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship

from app.db.session import Base


class Entity(Base):
    """Named entity (person, organization, location)."""

    __tablename__ = "entities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(500), nullable=False)
    normalized_name = Column(String(500), index=True)  # Lowercase, cleaned
    entity_type = Column(String(50), nullable=False, index=True)  # PERSON, ORG, GPE, LOC, DATE
    description = Column(Text)

    # Aggregated stats
    mention_count = Column(Integer, default=0)
    document_count = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    mentions = relationship("EntityMention", back_populates="entity", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_entities_type_name", "entity_type", "normalized_name"),
    )

    def __repr__(self) -> str:
        return f"<Entity(id={self.id}, name='{self.name}', type='{self.entity_type}')>"


class EntityMention(Base):
    """Link between entity and document with context."""

    __tablename__ = "entity_mentions"

    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)

    # Context
    page_number = Column(Integer)
    context_snippet = Column(Text)  # Surrounding text
    char_start = Column(Integer)
    char_end = Column(Integer)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    entity = relationship("Entity", back_populates="mentions")
    document = relationship("Document", back_populates="entity_mentions")

    __table_args__ = (
        Index("ix_entity_mentions_entity_doc", "entity_id", "document_id"),
    )

    def __repr__(self) -> str:
        return f"<EntityMention(entity_id={self.entity_id}, document_id={self.document_id})>"
