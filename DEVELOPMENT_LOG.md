# Development Log - Epstein Dossier

This document captures the heavy lifting, challenges faced, and solutions implemented during development.

## Project Timeline

**Started**: February 5, 2025
**Current Status**: Core functionality complete, UI polish in progress

---

## Phase 1: Initial Setup & Data Ingestion

### Challenge 1: DOJ Age Verification Gate

**Problem**: The DOJ website uses JavaScript-based age verification that blocks direct PDF downloads. Simple HTTP requests get redirected to an age-verify page that requires clicking a "Yes" button via JavaScript.

**Attempted Solutions**:
1. Cookie-based bypass - Failed (site uses JavaScript localStorage)
2. Direct URL access with headers - Failed (302 redirects)
3. Setting age_verified cookies - Failed

**Final Solution**: Implemented **Playwright browser automation** to:
- Launch headless Chromium browser
- Navigate to PDF URL
- Detect age-verification redirect
- Click the "Yes" button programmatically
- Handle the download event
- Save PDF content with verification

**Code**: `backend/app/pipelines/downloader.py`

```python
async def _complete_age_verification(self):
    page = await self._context.new_page()
    await page.goto(test_url, wait_until="domcontentloaded")
    if "age-verify" in page.url:
        yes_button = await page.query_selector("#age-button-yes")
        if yes_button:
            await yes_button.click()
```

### Challenge 2: Pagination Discovery

**Problem**: Initially only found 50 PDFs - the DOJ site has pagination across 65+ pages per data set.

**Solution**: Updated `discover_pdfs()` to iterate through all pages:
```python
while page_num < max_pages:
    url = data_set_url if page_num == 0 else f"{data_set_url}?page={page_num}"
    # ... fetch and parse
    if page_pdfs == 0:  # No more PDFs on this page
        break
    page_num += 1
```

### Challenge 3: Multiple Data Sets

**Problem**: DOJ has 12 separate data sets, not just one.

**Solution**: Added `DATA_SET_URLS` list and modified downloader to iterate through all 12 data sets, handling pagination for each.

**Result**: Discovered **26,897 PDFs** initially (later resolved to 15,874 unique files)

---

## Phase 2: Processing Pipeline

### Challenge 4: OCR Quality on Scanned Photos

**Problem**: Most documents are FBI evidence photos with minimal extractable text. PyMuPDF's direct text extraction returns only the filename watermark.

**Solution**: Implemented fallback OCR with Tesseract:
```python
text = page.get_text()
if len(text.strip()) < 50:  # Very little text
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x zoom
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    text = pytesseract.image_to_string(img)
```

**Limitation**: Handwritten text on FBI evidence cards still has poor OCR accuracy.

### Challenge 5: dlib Installation Failure

**Problem**: `face_recognition` library requires dlib, which needs CMake and fails to compile on macOS.

**Error**: `CMake must be installed to build dlib`

**Solution**: Made face recognition optional with graceful degradation:
```python
try:
    import face_recognition
    FACE_RECOGNITION_AVAILABLE = True
except ImportError:
    FACE_RECOGNITION_AVAILABLE = False
```

### Challenge 6: SQLAlchemy Reserved Attribute

**Problem**: Model had `metadata = Column(JSON)` which conflicts with SQLAlchemy's reserved `metadata` attribute.

**Error**: `sqlalchemy.exc.InvalidRequestError`

**Solution**: Renamed column to `extra_data`:
```python
# Before: metadata = Column(JSON)
extra_data = Column(JSON)
```

### Challenge 7: greenlet Missing

**Problem**: Async SQLAlchemy requires greenlet library which wasn't installed.

**Error**: `ValueError: the greenlet library is required`

**Solution**: `pip install greenlet`

### Challenge 8: Neo4j Optional

**Problem**: Neo4j graph database adds complexity but isn't required for core search functionality.

**Solution**: Made Neo4j optional with fallback:
```python
class Neo4jService:
    def __init__(self):
        self.enabled = False
        try:
            from neo4j import GraphDatabase
            self.driver = GraphDatabase.driver(...)
            self.enabled = True
        except Exception:
            console.print("[yellow]Neo4j not available[/yellow]")
```

---

## Phase 3: Search & Indexing

### Challenge 9: Initial Search Returning Empty

**Problem**: After downloading, search returned no results.

**Root Cause**: First 5 PDFs downloaded before age verification was properly completed contained HTML of the age-verify page wrapped as PDF.

**Solution**:
1. Reset all document statuses in database
2. Re-ran OCR pipeline
3. Re-indexed in Meilisearch

### Challenge 10: Large File Count Glob Failure

**Problem**: `ls *.pdf | wc -l` failed with "argument list too long" when directory had 13,000+ files.

**Solution**: Use `find` instead:
```bash
find /path/to/pdfs -name "*.pdf" -type f | wc -l
```

---

## Phase 4: Entity Extraction

### Challenge 11: OCR Artifacts in Entities

**Problem**: spaCy NER picks up garbage text from poor OCR as "entities" (e.g., "EB\nuw", "S\nS\nS").

**Mitigation**:
- Filter entities shorter than 2 characters
- Normalize names (lowercase, strip whitespace)
- Top entities still show real names (Epstein, Maxwell, Giuffre)

### Challenge 12: Processing Time

**Problem**: Entity extraction on 15,875 documents with spaCy's large model takes significant time.

**Solution**:
- Lazy-load spaCy model (only when needed)
- Progress bar for user feedback
- Background processing with status updates

---

## Phase 5: Additional Data Sources

### Challenge 13: Court Documents Different Format

**Problem**: Maxwell case court documents from The Guardian are a single 943-page PDF, not individual files like DOJ data.

**Solution**:
- Downloaded separately to `data/court_docs/`
- Extracted full text with PyMuPDF
- Added as single document to database with 943-page count
- Indexed full 1.8M characters of text

**Result**: Search results dramatically improved:
- "Bill Clinton": 74 → 253 results
- "Alan Dershowitz": 0 → 107 results
- "Virginia Giuffre": 0 → 69 results

### Challenge 14: 404 Media Links Expired

**Problem**: Direct download links from 404 Media for court docs returned "File not found".

**Solution**: Found same documents on The Guardian's CDN which was still active.

---

## Performance Statistics

### Download Performance
- Initial speed: ~0.6 files/second (2 concurrent)
- Optimized: ~3 files/second (10 concurrent)
- Total download time: ~2 hours for 15,874 files

### Processing Times
- OCR: ~5 seconds per document average
- Entity extraction: ~0.5 seconds per document (after model loaded)
- Indexing: Batch indexing, ~1000 docs/second

### Storage
- PDFs: 5.7 GB
- Extracted images: ~1.6 GB (estimated)
- Database: ~500 MB
- Meilisearch index: ~200 MB
- **Total**: ~8 GB

---

## Key Decisions

1. **Playwright over Selenium**: Better async support, cleaner API for download handling
2. **Meilisearch over Elasticsearch**: Simpler setup, excellent typo tolerance, fast
3. **PostgreSQL for metadata**: Reliable, good async support with asyncpg
4. **Optional Neo4j**: Keep complexity low, graph features can be added later
5. **spaCy en_core_web_lg**: Best accuracy for NER, worth the 500MB model size
6. **Local processing**: All data stays local, no cloud APIs required

---

## Lessons Learned

1. **Government websites often have JavaScript barriers** - browser automation may be necessary
2. **Pagination is easy to miss** - always check for "next page" links
3. **OCR has limits** - scanned photos won't yield much searchable text
4. **Make dependencies optional** - graceful degradation > hard failures
5. **Verify downloads** - check PDF headers before saving
6. **Progress feedback is essential** - users need to know something is happening

---

## Future Improvements

1. **Face Detection**: Install dlib properly or use alternative (DeepFace, InsightFace)
2. **Better OCR**: Try Google Vision API or AWS Textract for handwritten text
3. **Graph Visualization**: Implement Neo4j or use client-side force-directed graph
4. **Timeline**: Extract and normalize dates from documents
5. **UI Polish**: Fix Documents sidebar, PDF viewer, Quick Actions
6. **Export**: CSV/JSON export of search results and entities
7. **More Data**: House Oversight Committee releases (Google Drive/Dropbox - manual download needed)

---

## Commands Reference

```bash
# Download all documents
python -c "import asyncio; from app.pipelines.downloader import run_downloader; asyncio.run(run_downloader())"

# Run OCR
python -c "from app.pipelines.ocr import run_ocr_pipeline; run_ocr_pipeline()"

# Index for search
python -c "from app.pipelines.indexer import run_indexer; run_indexer()"

# Extract entities
python -c "from app.pipelines.entities import run_entity_extraction; run_entity_extraction()"

# Check document count
psql -d epstein_dossier -c "SELECT COUNT(*) FROM documents"

# Check entity count
psql -d epstein_dossier -c "SELECT COUNT(*) FROM entities"

# Test search
curl "http://localhost:8000/api/search?q=Clinton"
```

---

*Last updated: February 6, 2025*
