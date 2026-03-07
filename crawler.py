"""
crawler.py — UniAdvisor AI
Auto-discovers ALL pages on uniduna.hu/en/ by following links automatically.
No need to manually find URLs — it finds them all by itself!

Run:   python crawler.py
Output:
  - university_knowledge.txt   ← upload this to Admin Panel
  - scraped_images/            ← all downloaded images
  - found_urls.txt             ← list of every URL it found
"""

import os
import time
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from urllib.parse import urljoin, urlparse
from collections import deque
import mimetypes

# ── Config ───────────────────────────────────────────────
START_URL    = "https://www.uniduna.hu/en/"
ALLOWED_BASE = "https://www.uniduna.hu/en"   # only crawl English pages
MAX_PAGES    = 200                            # safety limit
DELAY        = 0.8                            # seconds between requests
IMAGE_FOLDER = "scraped_images"
IMAGE_EXTS   = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}
OUTPUT_FILE  = "university_knowledge.txt"
URLS_FILE    = "found_urls.txt"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36"
}

REMOVE_TAGS = ["nav", "header", "footer", "script", "style",
               "noscript", "iframe", "aside", "form", "button"]

# ── Helpers ──────────────────────────────────────────────

def clean_text(text: str) -> str:
    lines = [l.strip() for l in text.splitlines()]
    lines = [l for l in lines if l and len(l) > 2]
    seen, clean = set(), []
    for l in lines:
        if l not in seen:
            seen.add(l)
            clean.append(l)
    return "\n".join(clean)


def is_valid_url(url: str) -> bool:
    """Only follow English pages on uniduna.hu — skip files, anchors, external."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return False
    if "uniduna.hu" not in parsed.netloc:
        return False
    if not parsed.path.startswith("/en"):
        return False
    # Skip non-page files
    ext = os.path.splitext(parsed.path)[1].lower()
    if ext in (".pdf", ".doc", ".docx", ".zip", ".rar", ".mp4", ".mp3"):
        return False
    if "#" in url:
        url = url.split("#")[0]
    return True


def is_pdf_url(url: str) -> bool:
    return url.lower().endswith(".pdf") and "uniduna.hu" in url


def normalize_url(url: str) -> str:
    """Remove fragments and trailing slashes for deduplication."""
    url = url.split("#")[0]
    parsed = urlparse(url)
    return parsed.scheme + "://" + parsed.netloc + parsed.path.rstrip("/")


def scrape_page(url: str):
    """Fetch a page, return (text, image_urls, discovered_links)."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        # ── Discover links ──
        links = set()
        for a in soup.find_all("a", href=True):
            full = urljoin(url, a["href"])
            norm = normalize_url(full)
            if is_valid_url(norm):
                links.add(norm)
            elif is_pdf_url(full):
                links.add(full)  # keep PDFs for separate handling

        # ── Collect images ──
        image_urls = set()
        for img in soup.find_all("img"):
            src = img.get("src") or img.get("data-src") or img.get("data-lazy-src")
            if src:
                full = urljoin(url, src)
                ext  = os.path.splitext(urlparse(full).path)[1].lower()
                if ext in IMAGE_EXTS and "uniduna.hu" in full:
                    image_urls.add(full)
            for part in (img.get("srcset") or "").split(","):
                s = part.strip().split(" ")[0]
                if s and "uniduna.hu" in urljoin(url, s):
                    image_urls.add(urljoin(url, s))

        # ── Extract text ──
        for tag in REMOVE_TAGS:
            for el in soup.find_all(tag):
                el.decompose()

        main = (
            soup.find("main") or
            soup.find("article") or
            soup.find(id="content") or
            soup.find(class_="content") or
            soup.find(class_="page-content") or
            soup.find(class_="container") or
            soup.body
        )
        text = main.get_text(separator="\n") if main else soup.get_text(separator="\n")
        return clean_text(text), image_urls, links

    except requests.exceptions.HTTPError as e:
        return f"[HTTP ERROR: {e}]", set(), set()
    except requests.exceptions.ConnectionError:
        return "[CONNECTION ERROR]", set(), set()
    except requests.exceptions.Timeout:
        return "[TIMEOUT]", set(), set()
    except Exception as e:
        return f"[ERROR: {e}]", set(), set()


def scrape_pdf(url: str) -> str:
    try:
        import io, pypdf
        resp = requests.get(url, headers=HEADERS, timeout=20)
        resp.raise_for_status()
        reader = pypdf.PdfReader(io.BytesIO(resp.content))
        return clean_text("".join(p.extract_text() or "" for p in reader.pages))
    except Exception as e:
        return f"[PDF ERROR: {e}]"


def download_image(url: str, folder: str) -> str:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10, stream=True)
        resp.raise_for_status()
        content_type = resp.headers.get("Content-Type", "")
        ext = mimetypes.guess_extension(content_type.split(";")[0].strip()) or \
              os.path.splitext(urlparse(url).path)[1] or ".jpg"
        if ext in (".jpe", ".jpeg"):
            ext = ".jpg"
        path_part = urlparse(url).path.replace("/", "_").strip("_")
        filename  = path_part[:80] + ext
        filepath  = os.path.join(folder, filename)
        if not os.path.exists(filepath):
            with open(filepath, "wb") as f:
                for chunk in resp.iter_content(8192):
                    f.write(chunk)
        return filename
    except Exception as e:
        return f"[IMG ERROR: {e}]"


# ── Main crawler ─────────────────────────────────────────
def main():
    os.makedirs(IMAGE_FOLDER, exist_ok=True)

    visited      = set()
    queue        = deque([normalize_url(START_URL)])
    pdf_queue    = set()
    all_images   = set()
    failed       = []
    page_count   = 0
    success      = 0

    print("=" * 60)
    print("  UniAdvisor AI — Auto Web Crawler")
    print(f"  Starting from: {START_URL}")
    print(f"  Max pages: {MAX_PAGES}")
    print("=" * 60)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("DUNAÚJVÁROS EGYETEM — AUTO-CRAWLED KNOWLEDGE BASE\n")
        f.write(f"Crawled: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write("=" * 60 + "\n\n")

        while queue and page_count < MAX_PAGES:
            url = queue.popleft()

            if url in visited:
                continue
            visited.add(url)
            page_count += 1

            print(f"\n[{page_count}] {url}")

            # Handle PDFs separately
            if is_pdf_url(url):
                text = scrape_pdf(url)
                img_urls, new_links = set(), set()
            else:
                text, img_urls, new_links = scrape_page(url)

            # Queue new links
            for link in new_links:
                norm = normalize_url(link)
                if is_pdf_url(link):
                    pdf_queue.add(link)
                elif norm not in visited and norm not in queue:
                    queue.append(norm)

            all_images.update(img_urls)

            if any(x in text for x in ["[HTTP ERROR", "[CONNECTION", "[TIMEOUT", "[ERROR"]):
                print(f"  ⚠️  {text}")
                failed.append(url)
            else:
                words = len(text.split())
                print(f"  ✅ {words} words | {len(img_urls)} images | {len(new_links)} new links found")
                success += 1
                f.write(f"\n{'='*60}\n")
                f.write(f"SOURCE: {url}\n")
                f.write(f"{'='*60}\n\n")
                f.write(text + "\n\n")

            time.sleep(DELAY)

        # ── Also scrape any PDFs found ──
        print(f"\n{'='*60}")
        print(f"  📄 Scraping {len(pdf_queue)} PDFs found during crawl...")
        for pdf_url in pdf_queue:
            if pdf_url not in visited:
                print(f"  PDF: {pdf_url}")
                text = scrape_pdf(pdf_url)
                if "[ERROR" not in text:
                    f.write(f"\n{'='*60}\n")
                    f.write(f"SOURCE (PDF): {pdf_url}\n")
                    f.write(f"{'='*60}\n\n")
                    f.write(text + "\n\n")
                    print(f"  ✅ {len(text.split())} words")
                time.sleep(0.5)

    # ── Save found URLs ──
    with open(URLS_FILE, "w", encoding="utf-8") as f:
        for url in sorted(visited):
            f.write(url + "\n")

    # ── Download images ──
    print(f"\n{'='*60}")
    print(f"  📸 Downloading {len(all_images)} unique images...")
    img_success = 0
    for j, img_url in enumerate(sorted(all_images), 1):
        result = download_image(img_url, IMAGE_FOLDER)
        status = "✅" if not result.startswith("[") else "⚠️ "
        print(f"  [{j}/{len(all_images)}] {status} {result}")
        if not result.startswith("["):
            img_success += 1
        time.sleep(0.3)

    # ── Summary ──
    print(f"\n{'='*60}")
    print(f"  ✅ Pages crawled:   {success}/{page_count}")
    print(f"  ✅ Images saved:    {img_success}/{len(all_images)}")
    print(f"  🔗 URLs discovered: {len(visited)}")
    if failed:
        print(f"  ⚠️  Failed pages:   {len(failed)}")
    print(f"\n  📄 Knowledge base → {OUTPUT_FILE}")
    print(f"  🖼️  Images         → ./{IMAGE_FOLDER}/")
    print(f"  🔗 All URLs found  → {URLS_FILE}")
    print(f"\n  👉 Upload '{OUTPUT_FILE}' via the Admin Panel!")
    print("=" * 60)


if __name__ == "__main__":
    main()