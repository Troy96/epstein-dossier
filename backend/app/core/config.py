"""Application configuration."""

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Get the backend directory (parent of app)
_BACKEND_DIR = Path(__file__).parent.parent.parent


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Application
    app_name: str = "Epstein Dossier"
    debug: bool = False

    # PostgreSQL
    database_url: str = "postgresql+asyncpg://epstein:epstein_secret@localhost:5432/epstein_dossier"
    database_url_sync: str = "postgresql://epstein:epstein_secret@localhost:5432/epstein_dossier"

    # Meilisearch
    meilisearch_url: str = "http://localhost:7700"
    meilisearch_key: str = "epstein_meili_key"

    # Neo4j
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "epstein_neo4j_secret"

    # ChromaDB
    chromadb_host: str = "localhost"
    chromadb_port: int = 8000

    # Data directories (absolute paths based on backend dir)
    data_dir: Path = _BACKEND_DIR / "data"
    pdf_dir: Path = _BACKEND_DIR / "data" / "pdfs"
    images_dir: Path = _BACKEND_DIR / "data" / "images"
    faces_dir: Path = _BACKEND_DIR / "data" / "faces"

    # DOJ Source
    doj_base_url: str = "https://www.justice.gov/epstein/doj-disclosures/data-set-1-files"

    # Processing
    max_workers: int = 4
    batch_size: int = 50

    def ensure_dirs(self) -> None:
        """Ensure all data directories exist."""
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.pdf_dir.mkdir(parents=True, exist_ok=True)
        self.images_dir.mkdir(parents=True, exist_ok=True)
        self.faces_dir.mkdir(parents=True, exist_ok=True)


settings = Settings()
