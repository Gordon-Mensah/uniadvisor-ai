"""
scraper.py — UniAdvisor AI  (Full Version)
Scrapes ALL text pages + downloads images from Dunaújváros Egyetem website.

Run:   python scraper.py
Output:
  - university_knowledge.txt   ← upload this to Admin Panel
  - scraped_images/            ← folder of all downloaded images
"""

import os
import time
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from urllib.parse import urljoin, urlparse
import mimetypes

# ── All URLs to scrape ───────────────────────────────────
URLS = [
    "https://www.uniduna.hu/en/",
    "https://www.uniduna.hu/en/about-us",
    "https://www.uniduna.hu/en/about-us/rector-s-greeting",
    "https://www.uniduna.hu/en/about-us/brief-history",
    "https://www.uniduna.hu/en/about-us/foundation-for-the-university-of-dunaujvaros/about-the-foundation",
    "https://www.uniduna.hu/en/about-us/foundation-for-the-university-of-dunaujvaros/board-of-trustees",
    "https://www.uniduna.hu/en/about-us/foundation-for-the-university-of-dunaujvaros/supervisory-committee",
    "https://www.uniduna.hu/en/about-us/foundation-for-the-university-of-dunaujvaros/data-and-contact-information",
    "https://www.uniduna.hu/en/about-us/foundation-for-the-university-of-dunaujvaros/asset-controller",
    "https://www.uniduna.hu/en/about-us/about-dunaujvaros",
    "https://www.uniduna.hu/en/about-us/uod-campus",
    "https://www.uniduna.hu/en/about-us/contacts",
    "https://www.uniduna.hu/en/about-us/uod-on-social-media",
    "https://www.uniduna.hu/en/news_archive",
    "https://www.uniduna.hu/en/education/bachelor-programs",
    "https://www.uniduna.hu/en/education/bachelor-programs/business-administration-and-management-bsc",
    "https://www.uniduna.hu/en/education/bachelor-programs/communication-and-media-science-ba",
    "https://www.uniduna.hu/en/education/bachelor-programs/computer-science-engineering-bsc",
    "https://www.uniduna.hu/en/education/bachelor-programs/material-engineering-bsc",
    "https://www.uniduna.hu/en/education/bachelor-programs/mechanical_engineering_bsc",
    "https://www.uniduna.hu/en/education/bachelor-programs/atpl-and-mechanical-engineering-bsc",
    "https://www.uniduna.hu/en/education/master-programs",
    "https://www.uniduna.hu/en/education/master-programs/mechanical_engineering_msc",
    "https://www.uniduna.hu/en/education/master-programs/teacher-of-engineering-ma",
    "https://www.uniduna.hu/en/education/special-programs/preparatory-year-program",
    "https://www.uniduna.hu/en/education/double-degree-programs",
    "https://www.uniduna.hu/en/education/double-degree-programs/double-degree-with-university-of-international-business",
    "https://www.uniduna.hu/en/education/institute-of-social-sciences",
    "https://www.uniduna.hu/en/education/institute-of-engineering-sciences",
    "https://www.uniduna.hu/en/education/institute-of-information-technology",
    "https://www.uniduna.hu/en/education/teacher-training-centre",
    "https://www.uniduna.hu/en/application/why-uod",
    "https://www.uniduna.hu/en/application/student-testimonials",
    "https://www.uniduna.hu/en/application/alumni-interviews",
    "https://www.uniduna.hu/en/application/application-process",
    "https://www.uniduna.hu/en/application/application-process/how-to-apply",
    "https://www.uniduna.hu/en/application/application-process/representatives",
    "https://www.uniduna.hu/en/application/application-period",
    "https://www.uniduna.hu/en/application/application-checklist",
    "https://www.uniduna.hu/en/application/fees-and-payment",
    "https://www.uniduna.hu/en/application/scholarships",
    "https://www.uniduna.hu/en/application/admission-faq",
    "https://www.uniduna.hu/en/application/application-for-chinese-students",
    "https://www.uniduna.hu/en/prepare-for-your-stay/visa",
    "https://www.uniduna.hu/en/prepare-for-your-stay/housing",
    "https://www.uniduna.hu/en/prepare-for-your-stay/cost-of-living",
    "https://www.uniduna.hu/en/prepare-for-your-stay/academic-calendar",
    "https://www.uniduna.hu/en/prepare-for-your-stay/how-to-get-to-duna%C3%BAjv%C3%A1ros",
    "https://www.uniduna.hu/en/for-students/medical-information/medical-care-scholarship",
    "https://www.uniduna.hu/en/for-students/medical-information/medical-care-self-financed-study-more",
    "https://www.uniduna.hu/en/for-students/medical-information/where-you-should-go",
    "https://www.uniduna.hu/en/international",
    "https://www.uniduna.hu/en/research",
    "https://www.uniduna.hu/en/for-students",
    "https://www.uniduna.hu/en/for-students/student-services",
    "https://www.uniduna.hu/en/for-students/library",
    "https://www.uniduna.hu/en/for-students/sport",
    "https://www.uniduna.hu/en/for-students/career",
    "https://www.uniduna.hu/en/for-students/erasmus",
]

PDF_URLS = [
    "https://www.uniduna.hu/images/documents/UOD_Industrial_and_R_and_D_services.pdf",
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36"
}

REMOVE_TAGS  = ["nav", "header", "footer", "script", "style",
                "noscript", "iframe", "aside", "form", "button"]
IMAGE_FOLDER = "scraped_images"
IMAGE_EXTS   = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}


def clean_text(text: str) -> str:
    lines = [l.strip() for l in text.splitlines()]
    lines = [l for l in lines if l and len(l) > 2]
    seen, clean = set(), []
    for l in lines:
        if l not in seen:
            seen.add(l)
            clean.append(l)
    return "\n".join(clean)


def scrape_page(url: str):
    """Returns (text_content, list_of_image_urls)"""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        # Collect image URLs
        image_urls = []
        for img in soup.find_all("img"):
            src = img.get("src") or img.get("data-src") or img.get("data-lazy-src")
            if src:
                full_url = urljoin(url, src)
                ext = os.path.splitext(urlparse(full_url).path)[1].lower()
                if ext in IMAGE_EXTS and "uniduna.hu" in full_url:
                    image_urls.append(full_url)
            # srcset
            for part in (img.get("srcset") or "").split(","):
                src2 = part.strip().split(" ")[0]
                if src2 and "uniduna.hu" in urljoin(url, src2):
                    image_urls.append(urljoin(url, src2))

        # Remove noise tags
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
        return clean_text(text), list(set(image_urls))

    except requests.exceptions.HTTPError as e:
        return f"[HTTP ERROR: {e}]", []
    except requests.exceptions.ConnectionError:
        return "[CONNECTION ERROR]", []
    except requests.exceptions.Timeout:
        return "[TIMEOUT]", []
    except Exception as e:
        return f"[ERROR: {e}]", []


def scrape_pdf(url: str) -> str:
    try:
        import io, pypdf
        resp = requests.get(url, headers=HEADERS, timeout=20)
        resp.raise_for_status()
        reader = pypdf.PdfReader(io.BytesIO(resp.content))
        text = "".join(page.extract_text() or "" for page in reader.pages)
        return clean_text(text)
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


def main():
    os.makedirs(IMAGE_FOLDER, exist_ok=True)
    output_file    = "university_knowledge.txt"
    total          = len(URLS) + len(PDF_URLS)
    success_text   = 0
    success_imgs   = 0
    failed_pages   = []
    all_image_urls = set()

    print("=" * 60)
    print("  UniAdvisor AI — Full University Scraper")
    print(f"  Scraping {len(URLS)} pages + {len(PDF_URLS)} PDFs")
    print(f"  Images saved to → ./{IMAGE_FOLDER}/")
    print("=" * 60)

    with open(output_file, "w", encoding="utf-8") as f:
        f.write("DUNAÚJVÁROS EGYETEM — FULL KNOWLEDGE BASE\n")
        f.write(f"Scraped: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Total pages: {total}\n")
        f.write("=" * 60 + "\n\n")

        # ── Text pages ──
        for i, url in enumerate(URLS, 1):
            print(f"\n[{i}/{total}] {url}")
            text, img_urls = scrape_page(url)

            if any(x in text for x in ["[HTTP ERROR", "[CONNECTION", "[TIMEOUT", "[ERROR"]):
                print(f"  ⚠️  {text}")
                failed_pages.append(url)
            else:
                print(f"  ✅ {len(text.split())} words  |  {len(img_urls)} images found")
                success_text += 1
                all_image_urls.update(img_urls)

            f.write(f"\n{'='*60}\n")
            f.write(f"SOURCE: {url}\n")
            f.write(f"{'='*60}\n\n")
            f.write(text + "\n\n")
            time.sleep(0.8)

        # ── PDFs ──
        for i, url in enumerate(PDF_URLS, len(URLS) + 1):
            print(f"\n[{i}/{total}] PDF: {url}")
            text = scrape_pdf(url)
            if "[ERROR" in text:
                print(f"  ⚠️  {text}")
                failed_pages.append(url)
            else:
                print(f"  ✅ PDF: {len(text.split())} words")
                success_text += 1

            f.write(f"\n{'='*60}\n")
            f.write(f"SOURCE (PDF): {url}\n")
            f.write(f"{'='*60}\n\n")
            f.write(text + "\n\n")
            time.sleep(0.5)

    # ── Download images ──
    print(f"\n{'='*60}")
    print(f"  📸 Downloading {len(all_image_urls)} unique images...")
    print(f"{'='*60}")

    for j, img_url in enumerate(sorted(all_image_urls), 1):
        result = download_image(img_url, IMAGE_FOLDER)
        status = "✅" if not result.startswith("[") else "⚠️ "
        print(f"  [{j}/{len(all_image_urls)}] {status} {result}")
        if not result.startswith("["):
            success_imgs += 1
        time.sleep(0.3)

    # ── Summary ──
    print(f"\n{'='*60}")
    print(f"  ✅ Pages scraped:   {success_text}/{total}")
    print(f"  ✅ Images saved:    {success_imgs}/{len(all_image_urls)}")
    if failed_pages:
        print(f"  ⚠️  Failed ({len(failed_pages)}):")
        for p in failed_pages:
            print(f"     - {p}")
    print(f"\n  📄 Knowledge base → university_knowledge.txt")
    print(f"  🖼️  Images folder  → ./{IMAGE_FOLDER}/")
    print(f"\n  👉 Upload 'university_knowledge.txt' via the Admin Panel!")
    print("=" * 60)


if __name__ == "__main__":
    main()