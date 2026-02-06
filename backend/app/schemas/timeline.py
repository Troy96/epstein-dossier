"""Timeline schemas."""

from datetime import date, datetime
from pydantic import BaseModel


class TimelineEvent(BaseModel):
    """Event on the timeline."""

    date: date
    document_id: int
    document_filename: str
    document_title: str | None
    event_type: str  # document_date, mention_date
    context: str | None = None


class TimelineResponse(BaseModel):
    """Timeline response."""

    events: list[TimelineEvent]
    start_date: date | None
    end_date: date | None
    total: int


class TimelineDateRange(BaseModel):
    """Available date range for timeline."""

    min_date: date | None
    max_date: date | None
    document_count: int
