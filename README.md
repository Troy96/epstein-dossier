# Epstein Dossier

A comprehensive search platform for the DOJ-released Epstein files. Unlike the official DOJ search that only matches document titles, this platform enables full-text search, entity extraction, and document analysis across 15,875 documents.

## Current Status (Feb 2025)

| Component | Status | Details |
|-----------|--------|---------|
| **Data Ingestion** | ✅ Complete | 15,875 documents from 12 DOJ data sets |
| **Full-Text Search** | ✅ Working | Meilisearch indexed, instant results |
| **Entity Extraction** | ✅ Complete | 139,018 entities, 731,021 mentions |
| **Image Extraction** | ✅ Complete | 15,875 image folders |
| **OCR Processing** | ✅ Complete | All documents text-extracted |
| **Court Documents** | ✅ Added | Maxwell case 2024 (943 pages) |
| **Documents View** | ✅ Complete | Browse all documents with pagination |
| **PDF Viewer** | ✅ Working | Embedded PDF viewer with download |
| **Entity Explorer** | ✅ Working | Search and filter entities by type |
| **Faces Detection** | ⏳ Pending | Requires dlib installation |
| **Graph View** | ✅ Working | Neo4j optional, graceful fallback |
| **Timeline View** | ✅ Working | Browse documents by year/month |
| **Bookmarks** | ✅ Working | Save and manage document bookmarks |
| **Settings** | ✅ Working | Service status and statistics |

### Data Summary

| Metric | Value |
|--------|-------|
| Total Documents | 15,875 |
| Total Size | 5.7 GB |
| Unique Entities | 139,018 |
| Entity Mentions | 731,021 |
| Search Results for "Clinton" | 253 |
| Search Results for "Maxwell" | 1,000+ |

## Features

- **Full-Text Search**: Search the actual content of 15,875+ PDFs, not just titles
- **Entity Extraction**: 139K+ automatically identified people, organizations, locations, dates
- **Court Documents**: Integrated 2024 Maxwell case unsealed documents (depositions, emails)
- **Image Extraction**: All images extracted from FBI evidence photos
- **Document Browser**: Browse all documents with pagination and filtering
- **PDF Viewer**: View PDFs directly in the browser or download them
- **Entity Explorer**: Browse entities by type (Person, Org, Location, Date)
- **Graph Visualization**: Explore connections between documents and entities
- **Timeline View**: Browse documents chronologically by year and month
- **Bookmarks**: Save documents for later with annotations and tags
- **Face Recognition**: (Pending) Detect, crop, and search faces across documents

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Python 3.11+, FastAPI |
| Search | Meilisearch |
| Database | PostgreSQL |
| Graph DB | Neo4j |
| Vector DB | ChromaDB |
| OCR | Tesseract + PyMuPDF |
| Face AI | face_recognition (dlib) |
| NLP | spaCy (en_core_web_lg) |
| Frontend | Next.js 14, React, Tailwind CSS |
| Containers | Docker Compose |

## Quick Start

### Prerequisites

- Docker & Docker Compose
- 16GB RAM recommended
- 20GB disk space

### 1. Start Services

```bash
# Copy environment file
cp .env.example .env

# Start all services
docker-compose up -d
```

### 2. Initialize Database

```bash
# Install Python dependencies (for CLI)
pip install -e .

# Initialize database tables
python -m app.cli init-db
```

### 3. Run Processing Pipeline

```bash
# Download PDFs from DOJ
python -m app.cli download

# Run OCR on PDFs
python -m app.cli ocr

# Extract entities
python -m app.cli entities

# Detect faces
python -m app.cli faces

# Index for search
python -m app.cli index

# Or run all at once
python -m app.cli process-all
```

### 4. Access the Application

- **Frontend**: http://localhost:3000
- **API**: http://localhost:8080
- **API Docs**: http://localhost:8080/docs
- **Meilisearch**: http://localhost:7700
- **Neo4j Browser**: http://localhost:7474

## Project Structure

```
epstein-index/
├── backend/
│   └── app/
│       ├── api/routes/      # FastAPI endpoints
│       ├── core/            # Configuration
│       ├── db/              # Database setup
│       ├── models/          # SQLAlchemy models
│       ├── pipelines/       # Data processing
│       ├── schemas/         # Pydantic schemas
│       ├── services/        # External service integrations
│       ├── cli.py           # Command-line interface
│       └── main.py          # FastAPI app
├── frontend/
│   └── src/
│       ├── app/             # Next.js pages
│       ├── components/      # React components
│       ├── lib/             # API client, utilities
│       └── types/           # TypeScript types
├── data/
│   ├── pdfs/               # Downloaded PDFs
│   ├── images/             # Extracted images
│   └── faces/              # Cropped faces
├── docker-compose.yml
├── pyproject.toml
└── README.md
```

## CLI Commands

```bash
# Download PDFs from DOJ website
python -m app.cli download [--limit N]

# Run OCR on downloaded PDFs
python -m app.cli ocr [--limit N] [--reprocess]

# Extract named entities
python -m app.cli entities [--limit N] [--reprocess]

# Detect and cluster faces
python -m app.cli faces [--limit N] [--reprocess]

# Index documents for search
python -m app.cli index [--limit N] [--reindex]

# Run full pipeline
python -m app.cli process-all [--limit N]

# Check processing status
python -m app.cli status

# Start API server
python -m app.cli serve [--host HOST] [--port PORT]
```

## API Endpoints

### Search
- `GET /api/search?q={query}` - Full-text search
- `GET /api/search/suggestions?q={prefix}` - Autocomplete

### Documents
- `GET /api/documents` - List documents
- `GET /api/documents/{id}` - Get document details
- `GET /api/documents/{id}/text` - Get extracted text
- `GET /api/documents/{id}/pdf` - Download PDF

### Entities
- `GET /api/entities` - List entities
- `GET /api/entities/{id}` - Get entity details
- `GET /api/entities/{id}/documents` - Get documents mentioning entity

### Faces
- `GET /api/faces` - List detected faces
- `GET /api/faces/clusters` - List face clusters
- `GET /api/faces/{id}/similar` - Find similar faces
- `POST /api/faces/search` - Search by uploaded face image

### Graph
- `GET /api/graph/document/{id}/connections` - Document connections
- `GET /api/graph/entity/{id}/connections` - Entity connections

### Timeline
- `GET /api/timeline` - Get timeline events
- `GET /api/timeline/by-year` - Document counts by year

### Annotations
- `GET /api/annotations` - List annotations
- `POST /api/annotations` - Create annotation
- `PUT /api/annotations/{id}` - Update annotation

### Export
- `GET /api/export/search?q={query}&format=csv` - Export search results
- `GET /api/export/entities?format=csv` - Export entities
- `GET /api/export/faces/clusters?format=json` - Export face clusters

## Development

### Backend

```bash
cd backend
pip install -e ".[dev]"

# Run tests
pytest

# Run linter
ruff check .

# Start dev server
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install

# Run dev server
npm run dev

# Build for production
npm run build
```

## License

This project processes publicly released government documents. The code is provided as-is for research and journalistic purposes.

## Acknowledgments

- DOJ for releasing the Epstein files
- Open source libraries: spaCy, face_recognition, Meilisearch, Neo4j
