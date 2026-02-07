"""Pipeline to extract dates from DATE entities and update document date fields."""

import asyncio
import re
from datetime import date
from dateutil import parser as date_parser
from dateutil.parser import ParserError
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import async_session_maker
from app.models import Document, Entity, EntityMention


# Patterns to skip - relative dates, day names, etc.
SKIP_PATTERNS = [
    r'^today$',
    r'^tomorrow$',
    r'^yesterday$',
    r'^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$',
    r'^(this|next|last)\s+(week|month|year)$',
    r'^the\s+\d{4}s$',  # "the 1990s"
    r'^(early|late|mid)\s+\d{4}s?$',
    r'^about\s+\d{4}\s+through',
    r'^between\s+approximately',
    r'^at\s+least\s+\d{4}$',
    r'^about\s+\d{4}$',
    r'^(one|two|three|four|five|six|seven|eight|nine|ten)\s+(day|week|month|year)s?',
    r'^\d+\s+(day|week|month|year)s?\s+(ago|later|before|after)',
]

# Compile patterns
SKIP_REGEXES = [re.compile(p, re.IGNORECASE) for p in SKIP_PATTERNS]


def is_valid_date_string(text: str) -> bool:
    """Check if a date string should be parsed."""
    text = text.strip().lower()

    # Skip if matches any skip pattern
    for regex in SKIP_REGEXES:
        if regex.match(text):
            return False

    # Skip if just a day name
    if text in ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']:
        return False

    # Skip if just "today", "tomorrow", etc.
    if text in ['today', 'tomorrow', 'yesterday', 'now', 'later', 'earlier']:
        return False

    return True


def parse_date_safe(text: str) -> date | None:
    """Safely parse a date string, returning None if invalid."""
    if not is_valid_date_string(text):
        return None

    try:
        # If only a year was provided (e.g., "1997"), use January 1
        text_stripped = text.strip()
        if len(text_stripped) == 4 and text_stripped.isdigit():
            year = int(text_stripped)
            if 1900 <= year <= 2025:
                return date(year, 1, 1)
            return None

        # Try parsing with dateutil
        from datetime import datetime
        default_dt = datetime(1900, 1, 1)
        parsed = date_parser.parse(text, fuzzy=True, default=default_dt)

        # Handle both date and datetime objects
        if isinstance(parsed, date) and not isinstance(parsed, datetime):
            result = parsed
        else:
            result = parsed.date()

        # Sanity check: dates should be between 1900 and 2025
        if result.year < 1900 or result.year > 2025:
            return None

        return result
    except (ParserError, ValueError, OverflowError, TypeError, AttributeError):
        return None


async def extract_dates_for_document(db: AsyncSession, doc_id: int) -> tuple[date | None, date | None]:
    """Extract earliest and latest dates for a document from its DATE entities."""
    # Get all DATE entity mentions for this document
    result = await db.execute(
        select(Entity.name)
        .join(EntityMention, EntityMention.entity_id == Entity.id)
        .where(
            EntityMention.document_id == doc_id,
            Entity.entity_type == 'DATE'
        )
        .distinct()
    )

    date_names = [row[0] for row in result.all()]

    # Parse all valid dates
    parsed_dates = []
    for name in date_names:
        parsed = parse_date_safe(name)
        if parsed:
            parsed_dates.append(parsed)

    if not parsed_dates:
        return None, None

    return min(parsed_dates), max(parsed_dates)


async def update_document_dates(batch_size: int = 100, verbose: bool = True) -> dict:
    """Update earliest_date and latest_date for all documents based on DATE entities."""
    stats = {
        'total_documents': 0,
        'updated': 0,
        'skipped': 0,
        'errors': 0,
    }

    async with async_session_maker() as db:
        # Get total count of documents with DATE entity mentions
        result = await db.execute(
            select(func.count(func.distinct(EntityMention.document_id)))
            .join(Entity, Entity.id == EntityMention.entity_id)
            .where(Entity.entity_type == 'DATE')
        )
        total = result.scalar() or 0
        stats['total_documents'] = total

        if verbose:
            print(f"Processing {total} documents with DATE entities...")

        # Get all document IDs with DATE mentions
        result = await db.execute(
            select(func.distinct(EntityMention.document_id))
            .join(Entity, Entity.id == EntityMention.entity_id)
            .where(Entity.entity_type == 'DATE')
        )
        doc_ids = [row[0] for row in result.all()]

        # Process in batches
        for i in range(0, len(doc_ids), batch_size):
            batch = doc_ids[i:i + batch_size]

            for doc_id in batch:
                try:
                    earliest, latest = await extract_dates_for_document(db, doc_id)

                    if earliest or latest:
                        await db.execute(
                            update(Document)
                            .where(Document.id == doc_id)
                            .values(
                                earliest_date=earliest,
                                latest_date=latest or earliest,
                            )
                        )
                        stats['updated'] += 1
                    else:
                        stats['skipped'] += 1

                except Exception as e:
                    stats['errors'] += 1
                    if verbose:
                        print(f"Error processing document {doc_id}: {e}")

            await db.commit()

            if verbose and (i + batch_size) % 500 == 0:
                print(f"Processed {min(i + batch_size, len(doc_ids))}/{total} documents...")

        if verbose:
            print(f"\nComplete! Updated: {stats['updated']}, Skipped: {stats['skipped']}, Errors: {stats['errors']}")

    return stats


async def main():
    """Run date extraction pipeline."""
    print("Starting date extraction pipeline...")
    stats = await update_document_dates(verbose=True)
    print(f"\nFinal stats: {stats}")


if __name__ == "__main__":
    asyncio.run(main())
