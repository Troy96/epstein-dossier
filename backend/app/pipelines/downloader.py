"""PDF downloader from DOJ website using Playwright for age verification."""

import asyncio
import hashlib
from pathlib import Path
from urllib.parse import urljoin, unquote

import httpx
from bs4 import BeautifulSoup
from rich.console import Console
from rich.progress import Progress, TaskID
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Document

console = Console()

# Try to import Playwright
try:
    from playwright.async_api import async_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    console.print("[yellow]Playwright not available. Install with: pip install playwright && playwright install chromium[/yellow]")


class PDFDownloader:
    """Download PDFs from DOJ website using browser automation."""

    BASE_URL = "https://www.justice.gov"
    DATA_SET_URLS = [
        "https://www.justice.gov/epstein/doj-disclosures/data-set-1-files",
        "https://www.justice.gov/epstein/doj-disclosures/data-set-2-files",
        "https://www.justice.gov/epstein/doj-disclosures/data-set-3-files",
        "https://www.justice.gov/epstein/doj-disclosures/data-set-4-files",
        "https://www.justice.gov/epstein/doj-disclosures/data-set-5-files",
        "https://www.justice.gov/epstein/doj-disclosures/data-set-6-files",
        "https://www.justice.gov/epstein/doj-disclosures/data-set-7-files",
        "https://www.justice.gov/epstein/doj-disclosures/data-set-8-files",
        "https://www.justice.gov/epstein/doj-disclosures/data-set-9-files",
        "https://www.justice.gov/epstein/doj-disclosures/data-set-10-files",
        "https://www.justice.gov/epstein/doj-disclosures/data-set-11-files",
        "https://www.justice.gov/epstein/doj-disclosures/data-set-12-files",
    ]
    DATA_SET_URL = DATA_SET_URLS[0]  # Default for backwards compatibility

    def __init__(self, db_session: Session) -> None:
        self.db = db_session
        self.pdf_dir = settings.pdf_dir
        self.pdf_dir.mkdir(parents=True, exist_ok=True)
        self._browser = None
        self._context = None
        self._verified = False

    async def _init_browser(self):
        """Initialize Playwright browser and complete age verification."""
        if not PLAYWRIGHT_AVAILABLE:
            raise RuntimeError("Playwright is required. Install with: pip install playwright && playwright install chromium")

        if self._browser is not None:
            return

        console.print("[blue]Initializing browser...[/blue]")
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(headless=True)
        self._context = await self._browser.new_context(
            accept_downloads=True,
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )

        # Complete age verification before any downloads
        await self._complete_age_verification()

    async def _complete_age_verification(self):
        """Complete age verification on DOJ site."""
        console.print("[blue]Completing age verification...[/blue]")
        page = await self._context.new_page()
        try:
            # Navigate to a PDF to trigger age verification
            test_url = "https://www.justice.gov/epstein/files/DataSet%201/EFTA00000001.pdf"
            await page.goto(test_url, wait_until="domcontentloaded", timeout=60000)
            await asyncio.sleep(1)

            # Check if we hit age verification
            if "age-verify" in page.url:
                console.print("[yellow]Clicking age verification button...[/yellow]")
                yes_button = await page.query_selector("#age-button-yes")
                if yes_button:
                    await yes_button.click()
                    await page.wait_for_load_state("networkidle", timeout=30000)
                    console.print("[green]Age verification completed![/green]")
                else:
                    # Try alternative - any button with Yes text
                    buttons = await page.query_selector_all("button")
                    for button in buttons:
                        text = await button.inner_text()
                        if "yes" in text.lower():
                            await button.click()
                            await page.wait_for_load_state("networkidle", timeout=30000)
                            console.print("[green]Age verification completed![/green]")
                            break
            else:
                console.print("[green]No age verification needed[/green]")
        except Exception as e:
            console.print(f"[yellow]Age verification: {e}[/yellow]")
        finally:
            await page.close()

    async def _close_browser(self):
        """Close browser resources."""
        if self._context:
            await self._context.close()
        if self._browser:
            await self._browser.close()
        if hasattr(self, '_playwright') and self._playwright:
            await self._playwright.stop()
        self._browser = None
        self._context = None

    async def discover_pdfs(self, data_sets: list[int] | None = None) -> list[dict]:
        """Discover all PDF links from DOJ pages (handles pagination across all data sets)."""
        pdfs = []
        seen_filenames = set()

        # Determine which data sets to fetch
        if data_sets:
            urls_to_fetch = [self.DATA_SET_URLS[i-1] for i in data_sets if 1 <= i <= len(self.DATA_SET_URLS)]
        else:
            urls_to_fetch = self.DATA_SET_URLS

        async with httpx.AsyncClient(
            timeout=120.0,
            follow_redirects=True,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            },
        ) as client:
            for data_set_idx, data_set_url in enumerate(urls_to_fetch, 1):
                console.print(f"[blue]Fetching Data Set {data_set_idx}/{len(urls_to_fetch)}: {data_set_url}[/blue]")

                page_num = 0
                max_pages = 200  # Safety limit

                while page_num < max_pages:
                    url = data_set_url if page_num == 0 else f"{data_set_url}?page={page_num}"
                    console.print(f"[dim]  Page {page_num + 1}...[/dim]")

                    try:
                        response = await client.get(url)
                        response.raise_for_status()
                    except Exception as e:
                        console.print(f"[yellow]Error fetching page {page_num + 1}: {e}[/yellow]")
                        break

                    soup = BeautifulSoup(response.text, "html.parser")
                    page_pdfs = 0

                    for link in soup.find_all("a", href=True):
                        href = link["href"]
                        if href.endswith(".pdf"):
                            if href.startswith("/"):
                                pdf_url = urljoin(self.BASE_URL, href)
                            elif not href.startswith("http"):
                                pdf_url = urljoin(self.BASE_URL + "/", href)
                            else:
                                pdf_url = href

                            filename = href.split("/")[-1]
                            filename = unquote(filename)

                            # Skip duplicates
                            if filename in seen_filenames:
                                continue
                            seen_filenames.add(filename)

                            title = link.get_text(strip=True) or filename.replace(".pdf", "")

                            pdfs.append({
                                "filename": filename,
                                "url": pdf_url,
                                "title": title,
                            })
                            page_pdfs += 1

                    # If no new PDFs found, we've reached the end of this data set
                    if page_pdfs == 0:
                        break

                    page_num += 1

                console.print(f"[green]  Found {len([p for p in pdfs if p['filename'] not in seen_filenames or True])} total PDFs so far[/green]")

        console.print(f"[green]Total: {len(pdfs)} PDFs across {len(urls_to_fetch)} data sets[/green]")
        return pdfs

    async def download_pdf_with_browser(self, url: str, filename: str) -> tuple[bytes | None, str]:
        """Download a PDF using Playwright browser."""
        if not self._context:
            await self._init_browser()

        page = await self._context.new_page()
        downloaded_content = None

        async def handle_download(download):
            nonlocal downloaded_content
            temp_path = await download.path()
            if temp_path:
                downloaded_content = Path(temp_path).read_bytes()

        page.on("download", handle_download)

        try:
            # Go to URL and handle both download and age-verify scenarios
            response = await page.goto(url, wait_until="domcontentloaded", timeout=60000)

            # Wait a moment for download to trigger
            await asyncio.sleep(2)

            # Check if download happened
            if downloaded_content and downloaded_content.startswith(b"%PDF-"):
                file_hash = hashlib.sha256(downloaded_content).hexdigest()
                return downloaded_content, file_hash

            # Check if we hit age verification
            if "age-verify" in page.url:
                console.print(f"[yellow]Age verification for {filename}...[/yellow]")
                yes_button = await page.query_selector("#age-button-yes")
                if yes_button:
                    await yes_button.click()
                    await page.wait_for_load_state("networkidle", timeout=30000)

                    # Now try the PDF again
                    response = await page.goto(url, wait_until="domcontentloaded", timeout=60000)
                    await asyncio.sleep(2)

                    if downloaded_content and downloaded_content.startswith(b"%PDF-"):
                        file_hash = hashlib.sha256(downloaded_content).hexdigest()
                        return downloaded_content, file_hash

            # Try to read response body directly if it's a PDF
            if response and response.status == 200:
                try:
                    content = await page.content()
                    if not content.strip().startswith("<!"):
                        # Might be PDF content, try to get the body
                        body = await response.body()
                        if body and body.startswith(b"%PDF-"):
                            file_hash = hashlib.sha256(body).hexdigest()
                            return body, file_hash
                except Exception:
                    pass

            return None, ""
        except Exception as e:
            if "Download is starting" in str(e):
                # Wait for the download handler
                await asyncio.sleep(3)
                if downloaded_content and downloaded_content.startswith(b"%PDF-"):
                    file_hash = hashlib.sha256(downloaded_content).hexdigest()
                    return downloaded_content, file_hash
            console.print(f"[red]Download error for {filename}: {e}[/red]")
            return None, ""
        finally:
            await page.close()

    async def download_all(
        self,
        max_concurrent: int = 10,
        limit: int | None = None,
    ) -> dict:
        """Download all PDFs from the DOJ page."""
        pdfs = await self.discover_pdfs()

        if limit:
            pdfs = pdfs[:limit]

        console.print(f"[blue]Downloading {len(pdfs)} PDFs using browser automation...[/blue]")

        results = {
            "total": len(pdfs),
            "downloaded": 0,
            "skipped": 0,
            "failed": 0,
        }

        try:
            await self._init_browser()
        except Exception as e:
            console.print(f"[red]Failed to initialize browser: {e}[/red]")
            return results

        semaphore = asyncio.Semaphore(max_concurrent)

        async def download_one(pdf: dict, progress: Progress, task_id: TaskID):
            async with semaphore:
                filepath = self.pdf_dir / pdf["filename"]

                if filepath.exists():
                    with open(filepath, "rb") as f:
                        header = f.read(5)
                    if header == b"%PDF-":
                        progress.update(task_id, advance=1)
                        results["skipped"] += 1
                        return

                content, file_hash = await self.download_pdf_with_browser(
                    pdf["url"],
                    pdf["filename"],
                )

                if content and file_hash:
                    filepath.write_bytes(content)

                    existing = self.db.execute(
                        select(Document).where(Document.filename == pdf["filename"])
                    ).scalar_one_or_none()

                    if existing:
                        existing.download_status = "downloaded"
                        existing.file_hash = file_hash
                        existing.file_size = len(content)
                    else:
                        doc = Document(
                            filename=pdf["filename"],
                            title=pdf["title"],
                            source_url=pdf["url"],
                            download_status="downloaded",
                            file_hash=file_hash,
                            file_size=len(content),
                        )
                        self.db.add(doc)

                    self.db.commit()
                    results["downloaded"] += 1
                    console.print(f"[green]✓ {pdf['filename']}[/green]")
                else:
                    results["failed"] += 1
                    console.print(f"[red]✗ {pdf['filename']}[/red]")

                progress.update(task_id, advance=1)

        try:
            with Progress() as progress:
                task_id = progress.add_task("[cyan]Downloading...", total=len(pdfs))

                for i in range(0, len(pdfs), max_concurrent):
                    batch = pdfs[i:i + max_concurrent]
                    tasks = [download_one(pdf, progress, task_id) for pdf in batch]
                    await asyncio.gather(*tasks)
        finally:
            await self._close_browser()

        console.print(f"\n[green]Download complete![/green]")
        console.print(f"  Downloaded: {results['downloaded']}")
        console.print(f"  Skipped (existing): {results['skipped']}")
        console.print(f"  Failed: {results['failed']}")

        return results

    def get_pending_downloads(self) -> list[Document]:
        """Get documents that need downloading."""
        result = self.db.execute(
            select(Document).where(Document.download_status == "pending")
        )
        return list(result.scalars().all())


async def run_downloader(limit: int | None = None):
    """Run the downloader as a standalone script."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(settings.database_url_sync)
    Session = sessionmaker(bind=engine)

    from app.db.session import Base
    Base.metadata.create_all(engine)

    with Session() as session:
        downloader = PDFDownloader(session)
        await downloader.download_all(limit=limit)
