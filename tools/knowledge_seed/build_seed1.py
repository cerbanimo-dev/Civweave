#!/usr/bin/env python3
"""Build Commonweave Knowledge Seed 1 from the live English Wikipedia Vital Articles Level 3 list.

The build stores text, section-level full-text search, internal links, external references,
source provenance, and a small reviewed video-reference manifest. It deliberately excludes
images, audio, video binaries, HTML, and embedding vectors.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import csv
import datetime as dt
import hashlib
import json
import random
import re
import shutil
import sqlite3
import sys
import threading
import time
import urllib.parse
import zipfile
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable

import requests
from bs4 import BeautifulSoup, NavigableString, Tag

BUILD_VERSION = "1.0.0"
SELECTION_URL = "https://en.wikipedia.org/wiki/Wikipedia:Vital_articles/Level/3"
API_URL = "https://en.wikipedia.org/w/api.php"
REST_HTML_URL = "https://en.wikipedia.org/w/rest.php/v1/page/{title}/html"
RESTBASE_HTML_URL = "https://en.wikipedia.org/api/rest_v1/page/html/{title}"
USER_AGENT = (
    "CommonweaveKnowledgeSeed/1.0 "
    "(https://github.com/cerbanimo-dev/Commonweave; offline educational corpus build)"
)
HEADERS = {"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9"}
STOP_SECTIONS = {"see also", "references", "external links", "notes", "further reading"}
EXCLUDED_NAMESPACES = {
    "book", "category", "draft", "file", "help", "media", "mediawiki", "module",
    "portal", "special", "talk", "template", "timedtext", "user", "wikipedia",
}
EXCLUDED_CLASSES = {
    "ambox", "authority-control", "catlinks", "metadata", "navbox", "navbar",
    "nomobile", "noprint", "shortdescription", "sidebar", "sistersitebox", "toc",
    "vertical-navbox", "hatnote", "mw-editsection", "mw-empty-elt",
}
_thread_local = threading.local()

VIDEO_CANDIDATES = [
    {
        "record_id": "vid-mit-how-to-speak", "title": "How to Speak", "domain": "communication",
        "provider": "MIT OpenCourseWare", "url": "https://ocw.mit.edu/courses/res-tll-005-how-to-speak-january-iap-2018/pages/how-to-speak/",
        "available_assets": "video; outline; downloadable course", "license": "CC-BY-NC-SA-4.0",
        "distribution_state": "noncommercial-pack-only",
        "notes": "General communication and presentation skills; verify item credits before bundling media.",
    },
    {
        "record_id": "vid-mit-linear-algebra-final", "title": "Gil Strang's Final 18.06 Linear Algebra Lecture", "domain": "mathematics",
        "provider": "MIT OpenCourseWare", "url": "https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/resources/gil-strang-final-lecture/",
        "available_assets": "video; course notes; problem sets; course download", "license": "CC-BY-NC-SA-4.0",
        "distribution_state": "noncommercial-pack-only",
        "notes": "Capstone reference after foundational linear algebra modules.",
    },
    {
        "record_id": "vid-mit-nature-nurture", "title": "Contributions from Nature and Nurture", "domain": "psychology",
        "provider": "MIT OpenCourseWare", "url": "https://ocw.mit.edu/courses/9-00sc-introduction-to-psychology-fall-2011/resources/contributions-from-nature-and-nurture/",
        "available_assets": "video; transcript; lecture notes; open textbook", "license": "CC-BY-NC-SA-4.0",
        "distribution_state": "noncommercial-pack-only",
        "notes": "Pair with genetics, development, and research-methods sources.",
    },
    {
        "record_id": "vid-mit-oscillations", "title": "Periodic Oscillations and Harmonic Oscillators", "domain": "physical-sciences",
        "provider": "MIT OpenCourseWare", "url": "https://ocw.mit.edu/courses/8-03sc-physics-iii-vibrations-and-waves-fall-2016/resources/lecture-1-video/",
        "available_assets": "video; transcript; offline download; notes; problem sets", "license": "CC-BY-NC-SA-4.0",
        "distribution_state": "noncommercial-pack-only", "notes": "Undergraduate treatment; prerequisite tagging required.",
    },
    {
        "record_id": "vid-mit-quantum-world", "title": "It's a Quantum World: The Theory of Quantum Mechanics", "domain": "physical-sciences",
        "provider": "MIT OpenCourseWare", "url": "https://ocw.mit.edu/courses/3-021j-introduction-to-modeling-and-simulation-spring-2012/resources/lecture-1/",
        "available_assets": "video; transcript; offline download; lecture notes", "license": "CC-BY-NC-SA-4.0",
        "distribution_state": "noncommercial-pack-only", "notes": "Introductory framing for quantum mechanics and modeling.",
    },
    {
        "record_id": "vid-mit-fractals", "title": "Fractals! Rough Cut", "domain": "mathematics",
        "provider": "MIT OpenCourseWare", "url": "https://ocw.mit.edu/courses/20-219-becoming-the-next-bill-nye-writing-and-hosting-the-educational-show-january-iap-2015/resources/fractals-rough-cut-1/",
        "available_assets": "video; transcript; offline download", "license": "CC-BY-NC-SA-4.0",
        "distribution_state": "noncommercial-pack-only", "notes": "Short educational production; page identifies CC BY-NC-SA.",
    },
    {
        "record_id": "vid-noaa-carbon-cycle", "title": "What Is the Carbon Cycle?", "domain": "earth-and-space",
        "provider": "NOAA", "url": "https://www.noaa.gov/what-is-carbon-cycle-1-minute",
        "available_assets": "video; web article", "license": "US-GOV-PD-candidate", "distribution_state": "item-review-required",
        "notes": "Inspect credits and embedded-media ownership before bundling media.",
    },
    {
        "record_id": "vid-noaa-grid-resolution", "title": "Climate Modeling 101: Grid Resolution", "domain": "earth-and-space",
        "provider": "NOAA Geophysical Fluid Dynamics Laboratory", "url": "https://www.gfdl.noaa.gov/cm101-grid-resolution/",
        "available_assets": "video; closed captions; transcript; references", "license": "US-GOV-PD-candidate",
        "distribution_state": "item-review-required", "notes": "Page lists video, captions, transcript, and supporting references.",
    },
    {
        "record_id": "vid-noaa-arctic-ice", "title": "The Shrinking Arctic Ice Cap", "domain": "earth-and-space",
        "provider": "NOAA Geophysical Fluid Dynamics Laboratory", "url": "https://www.gfdl.noaa.gov/wp-content/uploads/files/user_files/kd/pdf/transcript_icecap-video.pdf",
        "available_assets": "transcript PDF; linked educational video", "license": "US-GOV-PD-candidate",
        "distribution_state": "item-review-required", "notes": "Transcript identifies a June 2009 production.",
    },
    {
        "record_id": "vid-noaa-wet-dry", "title": "Will the Wet Get Wetter and the Dry Drier?", "domain": "earth-and-space",
        "provider": "NOAA Geophysical Fluid Dynamics Laboratory", "url": "https://www.gfdl.noaa.gov/wp-content/uploads/files/user_files/kd/pdf/script_wet_get_wetter.pdf",
        "available_assets": "transcript PDF; linked educational video", "license": "US-GOV-PD-candidate",
        "distribution_state": "item-review-required", "notes": "Transcript identifies a July 2009 production.",
    },
    {
        "record_id": "vid-noaa-weather-data", "title": "Using Weather.gov Data in the Classroom", "domain": "earth-and-space",
        "provider": "NOAA", "url": "https://www.noaa.gov/education/resource-collections/data/tutorials/weather-gov",
        "available_assets": "tutorial video; transcript or captions expected", "license": "US-GOV-PD-candidate",
        "distribution_state": "item-review-required", "notes": "Verify availability and asset rights before bundling.",
    },
    {
        "record_id": "vid-nist-time", "title": "Time, Einstein, and the Coolest Stuff in the Universe", "domain": "physical-sciences",
        "provider": "NIST", "url": "https://www.nist.gov/comms/text-transcript-time-einstein-and-coolest-stuff-universe",
        "available_assets": "full text transcript; related video", "license": "US-GOV-PD-candidate",
        "distribution_state": "item-review-required", "notes": "Atomic clocks, ultracold atoms, relativity, and GPS context.",
    },
    {
        "record_id": "vid-nist-bridges", "title": "Speckles for Safety: Measuring Stress in Bridges", "domain": "technology-and-engineering",
        "provider": "NIST", "url": "https://www.nist.gov/mml/materials-science-and-engineering-division/speckles-safety-nist-helps-measure-stress-bridges",
        "available_assets": "video transcript", "license": "US-GOV-PD-candidate", "distribution_state": "item-review-required",
        "notes": "Older measurement-method case study; verify current context.",
    },
    {
        "record_id": "vid-nist-lead", "title": "Get the Lead Out of Paints for Children's Products", "domain": "biology-and-health",
        "provider": "NIST", "url": "https://www.nist.gov/mml/csd/get-lead-out-paints-childrens-products-video-transcript",
        "available_assets": "video transcript", "license": "US-GOV-PD-candidate", "distribution_state": "item-review-required",
        "notes": "Measurement standards and consumer-product safety; pair with current health guidance.",
    },
    {
        "record_id": "vid-nist-biometrics", "title": "Key to Security: Biometrics Standards", "domain": "technology-and-engineering",
        "provider": "NIST", "url": "https://www.nist.gov/itl/key-security-biometrics-standards-video-transcript",
        "available_assets": "video transcript", "license": "US-GOV-PD-candidate", "distribution_state": "item-review-required",
        "notes": "Include privacy, civil-liberties, error-rate, and bias companion sources.",
    },
]


@dataclass(frozen=True)
class Selection:
    ordinal: int
    title: str
    domain: str
    subdomain: str
    source_url: str


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def normalize_ws(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def human_bytes(value: int) -> str:
    units = ["B", "KiB", "MiB", "GiB"]
    amount = float(value)
    for unit in units:
        if amount < 1024 or unit == units[-1]:
            return f"{amount:.2f} {unit}" if unit != "B" else f"{int(amount)} B"
        amount /= 1024
    return f"{value} B"


def get_session() -> requests.Session:
    session = getattr(_thread_local, "session", None)
    if session is None:
        session = requests.Session()
        session.headers.update(HEADERS)
        _thread_local.session = session
    return session


def request(method: str, url: str, *, session: requests.Session | None = None, max_attempts: int = 6, **kwargs: Any) -> requests.Response:
    active = session or get_session()
    timeout = kwargs.pop("timeout", (15, 75))
    retry_status = {429, 500, 502, 503, 504}
    last_error: Exception | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            response = active.request(method, url, timeout=timeout, **kwargs)
            if response.status_code not in retry_status:
                response.raise_for_status()
                return response
            retry_after = response.headers.get("Retry-After")
            delay = float(retry_after) if retry_after and retry_after.isdigit() else min(20.0, 0.75 * (2 ** (attempt - 1)))
            last_error = RuntimeError(f"HTTP {response.status_code} for {url}")
        except (requests.RequestException, RuntimeError) as exc:
            last_error = exc
            delay = min(20.0, 0.75 * (2 ** (attempt - 1)))
        if attempt < max_attempts:
            time.sleep(delay + random.random() * 0.35)
    raise RuntimeError(f"Request failed after {max_attempts} attempts: {url}: {last_error}")


def clean_heading(tag: Tag) -> str:
    text = normalize_ws(tag.get_text(" ", strip=True))
    return re.sub(r"\[edit\]$", "", text, flags=re.I).strip()


def title_from_href(href: str) -> str | None:
    if not href or href.startswith("#"):
        return None
    absolute = urllib.parse.urljoin("https://en.wikipedia.org/wiki/", href)
    parsed = urllib.parse.urlparse(absolute)
    if parsed.netloc not in {"en.wikipedia.org", "www.en.wikipedia.org"} or not parsed.path.startswith("/wiki/"):
        return None
    raw = urllib.parse.unquote(parsed.path[len("/wiki/"):]).replace("_", " ").strip()
    if not raw or raw == "Main Page":
        return None
    prefix = raw.split(":", 1)[0].lower() if ":" in raw else ""
    return None if prefix in EXCLUDED_NAMESPACES else raw


def excluded_by_ancestor(tag: Tag) -> bool:
    for parent in [tag, *list(tag.parents)]:
        if not isinstance(parent, Tag):
            continue
        if parent.name in {"nav", "style", "script"}:
            return True
        classes = set(parent.get("class", []))
        if classes & EXCLUDED_CLASSES:
            return True
        if parent.name == "table" and "infobox" not in classes:
            return True
    return False


def fetch_vital_list() -> tuple[list[Selection], dict[str, Any]]:
    session = requests.Session()
    session.headers.update(HEADERS)
    response = request("GET", SELECTION_URL, session=session)
    html = response.text
    soup = BeautifulSoup(html, "lxml")
    root = soup.select_one("#mw-content-text .mw-parser-output") or soup.select_one(".mw-parser-output")
    if root is None:
        raise RuntimeError("Could not locate Wikipedia article body for Vital Articles Level 3")
    h2 = h3 = h4 = ""
    stopped = False
    seen: set[str] = set()
    selections: list[Selection] = []
    for element in root.find_all(["h2", "h3", "h4", "li"]):
        if excluded_by_ancestor(element):
            continue
        if element.name in {"h2", "h3", "h4"}:
            heading = clean_heading(element)
            if element.name == "h2":
                h2, h3, h4 = heading, "", ""
                stopped = heading.casefold() in STOP_SECTIONS
            elif element.name == "h3":
                h3, h4 = heading, ""
            else:
                h4 = heading
            continue
        if stopped or element.find("li") is not None:
            continue
        for anchor in element.find_all("a", href=True):
            if "new" in anchor.get("class", []):
                continue
            title = title_from_href(anchor["href"])
            if not title or title in seen or title.startswith("Vital articles") or title.startswith("Wikipedia vital articles"):
                continue
            seen.add(title)
            selections.append(Selection(
                ordinal=len(selections) + 1,
                title=title,
                domain=h2 or "Unclassified",
                subdomain=" / ".join(part for part in (h3, h4) if part),
                source_url=urllib.parse.urljoin(SELECTION_URL, anchor["href"]),
            ))
    audit = {
        "selection_url": SELECTION_URL,
        "retrieved_at": now_iso(),
        "http_last_modified": response.headers.get("Last-Modified"),
        "http_etag": response.headers.get("ETag"),
        "html_sha256": sha256_bytes(html.encode("utf-8")),
        "parsed_count": len(selections),
    }
    if not 950 <= len(selections) <= 1050:
        raise RuntimeError(f"Vital list parser returned {len(selections)} titles; expected approximately 1,000. Aborting rather than silently building the wrong corpus.")
    return selections, audit


def chunks(items: list[Any], size: int) -> Iterable[list[Any]]:
    for start in range(0, len(items), size):
        yield items[start:start + size]


def resolve_alias(title: str, aliases: dict[str, str]) -> str:
    current = title
    visited: set[str] = set()
    while current in aliases and current not in visited:
        visited.add(current)
        current = aliases[current]
    return current


def fetch_metadata(selections: list[Selection]) -> tuple[dict[str, dict[str, Any]], list[dict[str, str]]]:
    session = requests.Session()
    session.headers.update(HEADERS)
    metadata: dict[str, dict[str, Any]] = {}
    failures: list[dict[str, str]] = []
    for batch_number, batch in enumerate(chunks(selections, 40), start=1):
        requested = [item.title for item in batch]
        payload = {
            "action": "query", "format": "json", "formatversion": "2", "prop": "info|revisions",
            "inprop": "url", "rvprop": "ids|timestamp", "redirects": "1", "titles": "|".join(requested),
        }
        data = request("POST", API_URL, session=session, data=payload).json()
        query = data.get("query", {})
        aliases: dict[str, str] = {}
        for item in query.get("normalized", []):
            aliases[item["from"]] = item["to"]
        for item in query.get("redirects", []):
            aliases[item["from"]] = item["to"]
        pages = {page.get("title", ""): page for page in query.get("pages", [])}
        for requested_title in requested:
            final_title = resolve_alias(requested_title, aliases)
            page = pages.get(final_title)
            if page is None or page.get("missing") is True:
                failures.append({"title": requested_title, "stage": "metadata", "error": "missing page"})
                continue
            revision = (page.get("revisions") or [{}])[0]
            metadata[requested_title] = {
                "title": page.get("title", final_title), "page_id": page.get("pageid"),
                "revision_id": revision.get("revid"), "parent_revision_id": revision.get("parentid"),
                "revision_timestamp": revision.get("timestamp"),
                "canonical_url": page.get("canonicalurl") or page.get("fullurl") or ("https://en.wikipedia.org/wiki/" + urllib.parse.quote(final_title.replace(" ", "_"))),
                "redirected_from": requested_title if requested_title != final_title else None,
            }
        print(f"metadata batch {batch_number}: {min(batch_number * 40, len(selections))}/{len(selections)}", flush=True)
        time.sleep(0.1)
    return metadata, failures


def nearest_section_heading(tag: Tag) -> str:
    section = tag.find_parent("section")
    if section is None:
        return "Lead"
    heading = section.find(["h1", "h2", "h3", "h4", "h5", "h6"], recursive=False) or section.find(["h1", "h2", "h3", "h4", "h5", "h6"])
    return clean_heading(heading) if heading else "Lead"


def extract_references(soup: BeautifulSoup) -> list[dict[str, Any]]:
    references: list[dict[str, Any]] = []
    seen: set[str] = set()
    for tag in soup.select("ol.mw-references > li, li[id^='cite_note']"):
        text = normalize_ws(tag.get_text(" ", strip=True))
        if not text or text in seen:
            continue
        urls: list[str] = []
        for anchor in tag.find_all("a", href=True):
            href = urllib.parse.urljoin("https://en.wikipedia.org/", anchor["href"])
            parsed = urllib.parse.urlparse(href)
            if parsed.scheme in {"http", "https"} and parsed.netloc not in {"en.wikipedia.org", "www.en.wikipedia.org"}:
                urls.append(href)
        seen.add(text)
        references.append({"reference_index": len(references) + 1, "citation_text": text, "urls": list(dict.fromkeys(urls))})
    return references


def extract_infobox(soup: BeautifulSoup) -> list[str]:
    rows: list[str] = []
    for table in soup.select("table.infobox"):
        for row in table.select("tr"):
            label_tag, value_tag = row.find("th"), row.find("td")
            label = normalize_ws(label_tag.get_text(" ", strip=True)) if label_tag else ""
            value = normalize_ws(value_tag.get_text(" ", strip=True)) if value_tag else ""
            if label and value:
                rows.append(f"{label}: {value}")
            elif label and not row.find(["h1", "h2", "h3", "h4"]) and len(label) <= 200:
                rows.append(label)
    return list(dict.fromkeys(rows))


def extract_internal_links(soup: BeautifulSoup) -> list[dict[str, Any]]:
    links: list[dict[str, Any]] = []
    seen: set[str] = set()
    for anchor in soup.find_all("a", href=True):
        if excluded_by_ancestor(anchor):
            continue
        target = title_from_href(anchor["href"])
        if not target or target in seen:
            continue
        seen.add(target)
        links.append({
            "target_title": target,
            "target_url": "https://en.wikipedia.org/wiki/" + urllib.parse.quote(target.replace(" ", "_")),
            "anchor_text": normalize_ws(anchor.get_text(" ", strip=True)),
            "section_heading": nearest_section_heading(anchor),
        })
    return links


def extract_external_links(soup: BeautifulSoup) -> list[dict[str, Any]]:
    links: list[dict[str, Any]] = []
    seen: set[str] = set()
    for anchor in soup.find_all("a", href=True):
        href = urllib.parse.urljoin("https://en.wikipedia.org/", anchor["href"])
        parsed = urllib.parse.urlparse(href)
        if parsed.scheme not in {"http", "https"} or parsed.netloc in {"en.wikipedia.org", "www.en.wikipedia.org"} or href in seen:
            continue
        seen.add(href)
        context = "reference" if anchor.find_parent("ol", class_="mw-references") or anchor.find_parent(id=re.compile(r"^cite_note")) else "body"
        links.append({"url": href, "anchor_text": normalize_ws(anchor.get_text(" ", strip=True)), "section_heading": nearest_section_heading(anchor), "context": context})
    return links


def iter_content_blocks(node: Tag, root: Tag) -> Iterable[Tag]:
    for child in node.children:
        if isinstance(child, NavigableString) or not isinstance(child, Tag):
            continue
        if child is not root and child.name == "section":
            continue
        classes = set(child.get("class", []))
        if child.name in {"script", "style", "nav", "figure", "table"} or classes & EXCLUDED_CLASSES:
            continue
        if child.name in {"p", "blockquote", "dd", "pre"}:
            yield child
            continue
        if child.name in {"ul", "ol"}:
            if "mw-references" in classes:
                continue
            yield from child.find_all("li", recursive=False)
            continue
        yield from iter_content_blocks(child, root)


def extract_sections(soup: BeautifulSoup, infobox_rows: list[str]) -> list[dict[str, Any]]:
    for tag in soup.select("sup.reference, .mw-editsection, style, script, noscript"):
        tag.decompose()
    for tag in soup.select("ol.mw-references, table.infobox"):
        tag.decompose()
    sections: list[dict[str, Any]] = []
    if infobox_rows:
        sections.append({"section_index": 0, "heading": "Infobox", "level": 1, "text": "\n".join(infobox_rows)})
    root = soup.body or soup
    section_tags = root.find_all("section") or [root]
    for section in section_tags:
        heading_tag = section.find(["h1", "h2", "h3", "h4", "h5", "h6"], recursive=False) or section.find(["h1", "h2", "h3", "h4", "h5", "h6"])
        heading = clean_heading(heading_tag) if heading_tag else "Lead"
        level = int(heading_tag.name[1]) if heading_tag and heading_tag.name and heading_tag.name[1:].isdigit() else 1
        paragraphs = []
        for block in iter_content_blocks(section, section):
            text = normalize_ws(block.get_text(" ", strip=True))
            if len(text) >= 2 and text.casefold() not in {heading.casefold(), "contents"}:
                paragraphs.append(text)
        paragraphs = list(dict.fromkeys(paragraphs))
        if paragraphs:
            sections.append({"section_index": len(sections), "heading": heading or "Untitled section", "level": level, "text": "\n\n".join(paragraphs)})
    return sections


def fetch_article(selection: Selection, metadata: dict[str, Any]) -> dict[str, Any]:
    title = metadata["title"]
    encoded = urllib.parse.quote(title.replace(" ", "_"), safe="")
    response: requests.Response | None = None
    errors: list[str] = []
    for url in [REST_HTML_URL.format(title=encoded), RESTBASE_HTML_URL.format(title=encoded)]:
        try:
            response = request("GET", url, headers={**HEADERS, "Accept": "text/html"})
            break
        except Exception as exc:
            errors.append(f"{url}: {exc}")
    if response is None:
        raise RuntimeError("; ".join(errors))
    html = response.content
    soup = BeautifulSoup(html, "lxml")
    infobox = extract_infobox(soup)
    references = extract_references(soup)
    internal_links = extract_internal_links(soup)
    external_links = extract_external_links(soup)
    sections = extract_sections(soup, infobox)
    summary = ""
    for section in sections:
        if section["heading"] == "Lead" and section["text"]:
            summary = section["text"].split("\n\n", 1)[0]
            break
    if not summary:
        for section in sections:
            if section["text"]:
                summary = section["text"].split("\n\n", 1)[0]
                break
    total_chars = sum(len(section["text"]) for section in sections)
    total_words = sum(len(re.findall(r"\b\w+\b", section["text"], flags=re.UNICODE)) for section in sections)
    return {
        "selection": asdict(selection), "metadata": metadata, "retrieved_at": now_iso(), "html_sha256": sha256_bytes(html),
        "http_etag": response.headers.get("ETag"), "http_last_modified": response.headers.get("Last-Modified"),
        "summary": summary[:4000], "sections": sections, "internal_links": internal_links, "external_links": external_links,
        "references": references, "char_count": total_chars, "word_count": total_words,
    }


def init_database(path: Path) -> sqlite3.Connection:
    if path.exists():
        path.unlink()
    connection = sqlite3.connect(path)
    connection.executescript("""
        PRAGMA journal_mode=OFF;
        PRAGMA synchronous=OFF;
        PRAGMA temp_store=MEMORY;
        PRAGMA foreign_keys=ON;
        PRAGMA page_size=4096;
        CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE articles (
            id INTEGER PRIMARY KEY, selection_ordinal INTEGER NOT NULL, selection_title TEXT NOT NULL,
            title TEXT NOT NULL UNIQUE, domain TEXT NOT NULL, subdomain TEXT NOT NULL, page_id INTEGER,
            revision_id INTEGER, parent_revision_id INTEGER, revision_timestamp TEXT, canonical_url TEXT NOT NULL,
            redirected_from TEXT, summary TEXT NOT NULL, word_count INTEGER NOT NULL, char_count INTEGER NOT NULL,
            retrieved_at TEXT NOT NULL, source_html_sha256 TEXT NOT NULL, http_etag TEXT, http_last_modified TEXT,
            source_name TEXT NOT NULL DEFAULT 'English Wikipedia', license TEXT NOT NULL DEFAULT 'CC BY-SA 4.0',
            attribution TEXT NOT NULL DEFAULT 'Wikipedia contributors; see canonical page history'
        );
        CREATE TABLE sections (
            id INTEGER PRIMARY KEY, article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
            article_title TEXT NOT NULL, section_index INTEGER NOT NULL, heading TEXT NOT NULL,
            heading_level INTEGER NOT NULL, text TEXT NOT NULL, word_count INTEGER NOT NULL, char_count INTEGER NOT NULL,
            UNIQUE(article_id, section_index)
        );
        CREATE TABLE internal_links (
            id INTEGER PRIMARY KEY, article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
            target_title TEXT NOT NULL, target_url TEXT NOT NULL, anchor_text TEXT NOT NULL, section_heading TEXT NOT NULL,
            in_seed INTEGER NOT NULL DEFAULT 0, UNIQUE(article_id, target_title)
        );
        CREATE TABLE external_links (
            id INTEGER PRIMARY KEY, article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
            url TEXT NOT NULL, anchor_text TEXT NOT NULL, section_heading TEXT NOT NULL, context TEXT NOT NULL,
            UNIQUE(article_id, url)
        );
        CREATE TABLE references_list (
            id INTEGER PRIMARY KEY, article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
            reference_index INTEGER NOT NULL, citation_text TEXT NOT NULL, urls_json TEXT NOT NULL,
            UNIQUE(article_id, reference_index)
        );
        CREATE TABLE video_references (
            record_id TEXT PRIMARY KEY, title TEXT NOT NULL, domain TEXT NOT NULL, provider TEXT NOT NULL,
            url TEXT NOT NULL, available_assets TEXT NOT NULL, license TEXT NOT NULL,
            distribution_state TEXT NOT NULL, notes TEXT NOT NULL
        );
        CREATE TABLE failures (id INTEGER PRIMARY KEY, title TEXT NOT NULL, stage TEXT NOT NULL, error TEXT NOT NULL);
        CREATE INDEX idx_articles_domain ON articles(domain, subdomain);
        CREATE INDEX idx_sections_article ON sections(article_id, section_index);
        CREATE INDEX idx_internal_links_source ON internal_links(article_id);
        CREATE INDEX idx_internal_links_target ON internal_links(target_title);
        CREATE INDEX idx_internal_links_in_seed ON internal_links(in_seed);
        CREATE INDEX idx_external_links_source ON external_links(article_id);
        CREATE INDEX idx_references_article ON references_list(article_id, reference_index);
    """)
    return connection


def insert_article(connection: sqlite3.Connection, result: dict[str, Any]) -> int:
    selection, meta = result["selection"], result["metadata"]
    cursor = connection.execute("""
        INSERT INTO articles (
            selection_ordinal, selection_title, title, domain, subdomain, page_id, revision_id,
            parent_revision_id, revision_timestamp, canonical_url, redirected_from, summary, word_count,
            char_count, retrieved_at, source_html_sha256, http_etag, http_last_modified
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        selection["ordinal"], selection["title"], meta["title"], selection["domain"], selection["subdomain"],
        meta.get("page_id"), meta.get("revision_id"), meta.get("parent_revision_id"), meta.get("revision_timestamp"),
        meta["canonical_url"], meta.get("redirected_from"), result["summary"], result["word_count"], result["char_count"],
        result["retrieved_at"], result["html_sha256"], result.get("http_etag"), result.get("http_last_modified"),
    ))
    article_id = int(cursor.lastrowid)
    for section in result["sections"]:
        connection.execute("""
            INSERT INTO sections (article_id, article_title, section_index, heading, heading_level, text, word_count, char_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            article_id, meta["title"], section["section_index"], section["heading"], section["level"], section["text"],
            len(re.findall(r"\b\w+\b", section["text"], flags=re.UNICODE)), len(section["text"]),
        ))
    for link in result["internal_links"]:
        connection.execute("INSERT OR IGNORE INTO internal_links (article_id, target_title, target_url, anchor_text, section_heading) VALUES (?, ?, ?, ?, ?)", (article_id, link["target_title"], link["target_url"], link["anchor_text"], link["section_heading"]))
    for link in result["external_links"]:
        connection.execute("INSERT OR IGNORE INTO external_links (article_id, url, anchor_text, section_heading, context) VALUES (?, ?, ?, ?, ?)", (article_id, link["url"], link["anchor_text"], link["section_heading"], link["context"]))
    for reference in result["references"]:
        connection.execute("INSERT OR IGNORE INTO references_list (article_id, reference_index, citation_text, urls_json) VALUES (?, ?, ?, ?)", (article_id, reference["reference_index"], reference["citation_text"], json.dumps(reference["urls"], ensure_ascii=False)))
    return article_id


def write_selection_csv(path: Path, selections: list[Selection], metadata: dict[str, dict[str, Any]]) -> None:
    fields = ["ordinal", "selection_title", "canonical_title", "domain", "subdomain", "page_id", "revision_id", "revision_timestamp", "canonical_url", "selection_source_url"]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for item in selections:
            meta = metadata.get(item.title, {})
            writer.writerow({
                "ordinal": item.ordinal, "selection_title": item.title, "canonical_title": meta.get("title", ""),
                "domain": item.domain, "subdomain": item.subdomain, "page_id": meta.get("page_id", ""),
                "revision_id": meta.get("revision_id", ""), "revision_timestamp": meta.get("revision_timestamp", ""),
                "canonical_url": meta.get("canonical_url", ""), "selection_source_url": item.source_url,
            })


def write_video_csv(path: Path) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(VIDEO_CANDIDATES[0].keys()))
        writer.writeheader()
        writer.writerows(VIDEO_CANDIDATES)


def directory_size(path: Path) -> int:
    return sum(file.stat().st_size for file in path.rglob("*") if file.is_file())


def create_zip(source_dir: Path, zip_path: Path) -> None:
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for file in sorted(source_dir.rglob("*")):
            if file.is_file():
                archive.write(file, arcname=f"{source_dir.name}/{file.relative_to(source_dir)}")


def write_size_report(output_dir: Path, zip_path: Path, reported_zip_size: int, stats: dict[str, Any]) -> None:
    files = []
    for path in sorted(output_dir.rglob("*")):
        if path.is_file() and path.name not in {"SIZE_REPORT.json", "SIZE_REPORT.md", "SHA256SUMS"}:
            files.append({"path": str(path.relative_to(output_dir)), "bytes": path.stat().st_size})
    unpacked = directory_size(output_dir)
    database_size = (output_dir / "commonweave-seed1.sqlite").stat().st_size
    report = {
        "generated_at": now_iso(), "package_zip": zip_path.name, "package_zip_bytes": reported_zip_size,
        "package_zip_human": human_bytes(reported_zip_size), "unpacked_directory_bytes": unpacked,
        "unpacked_directory_human": human_bytes(unpacked), "database_bytes": database_size,
        "database_human": human_bytes(database_size), "counts": stats, "files": files,
    }
    (output_dir / "SIZE_REPORT.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (output_dir / "SIZE_REPORT.md").write_text("\n".join([
        "# Seed 1 size report", "",
        f"- Compressed package: **{report['package_zip_human']}** ({reported_zip_size:,} bytes)",
        f"- Unpacked directory: **{report['unpacked_directory_human']}** ({unpacked:,} bytes)",
        f"- SQLite database: **{report['database_human']}** ({database_size:,} bytes)",
        f"- Articles stored: **{stats['articles']}**", f"- Searchable sections: **{stats['sections']}**",
        f"- Internal links: **{stats['internal_links']}**", f"- External links: **{stats['external_links']}**",
        f"- References: **{stats['references']}**", f"- Failed articles: **{stats['failures']}**", "",
        "No size target was imposed. These are the measured results of the content-first build.", "",
    ]), encoding="utf-8")


def write_checksums(output_dir: Path) -> None:
    entries = [f"{sha256_file(path)}  {path.relative_to(output_dir)}" for path in sorted(output_dir.rglob("*")) if path.is_file() and path.name != "SHA256SUMS"]
    (output_dir / "SHA256SUMS").write_text("\n".join(entries) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="build/commonweave-knowledge-seed1")
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--limit", type=int, default=0, help="Development-only article limit; 0 builds the complete live list")
    args = parser.parse_args()
    output_dir = Path(args.output).resolve()
    build_root = output_dir.parent
    zip_path = build_root / f"{output_dir.name}.zip"
    shutil.rmtree(output_dir, ignore_errors=True)
    output_dir.mkdir(parents=True, exist_ok=True)
    build_started = now_iso()

    print("Fetching live Vital Articles Level 3 selection…", flush=True)
    selections, selection_audit = fetch_vital_list()
    if args.limit:
        selections = selections[:args.limit]
        selection_audit["development_limit"] = args.limit
    print(f"Selected {len(selections)} live foundational articles", flush=True)
    metadata, initial_failures = fetch_metadata(selections)
    write_selection_csv(output_dir / "article-manifest.csv", selections, metadata)
    write_video_csv(output_dir / "video-references.csv")

    database_path = output_dir / "commonweave-seed1.sqlite"
    connection = init_database(database_path)
    for video in VIDEO_CANDIDATES:
        connection.execute("INSERT INTO video_references (record_id, title, domain, provider, url, available_assets, license, distribution_state, notes) VALUES (:record_id, :title, :domain, :provider, :url, :available_assets, :license, :distribution_state, :notes)", video)
    for failure in initial_failures:
        connection.execute("INSERT INTO failures(title, stage, error) VALUES (?, ?, ?)", (failure["title"], failure["stage"], failure["error"]))
    connection.commit()

    eligible = [(item, metadata[item.title]) for item in selections if item.title in metadata]
    completed = 0
    print(f"Fetching and parsing {len(eligible)} article bodies with {args.workers} workers…", flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
        future_map = {executor.submit(fetch_article, item, meta): item for item, meta in eligible}
        for future in concurrent.futures.as_completed(future_map):
            item = future_map[future]
            try:
                insert_article(connection, future.result())
            except Exception as exc:
                error = f"{type(exc).__name__}: {exc}"
                connection.execute("INSERT INTO failures(title, stage, error) VALUES (?, 'article', ?)", (item.title, error[:4000]))
                print(f"FAILED {item.title}: {error}", file=sys.stderr, flush=True)
            completed += 1
            if completed % 10 == 0 or completed == len(eligible):
                connection.commit()
                print(f"articles processed: {completed}/{len(eligible)}", flush=True)

    connection.execute("""
        UPDATE internal_links SET in_seed = EXISTS (
            SELECT 1 FROM articles a WHERE lower(a.title) = lower(internal_links.target_title)
            OR lower(a.selection_title) = lower(internal_links.target_title)
        )
    """)
    connection.executescript("""
        CREATE VIRTUAL TABLE section_fts USING fts5(
            article_title, heading, text, content='sections', content_rowid='id',
            tokenize='unicode61 remove_diacritics 2'
        );
        INSERT INTO section_fts(section_fts) VALUES('rebuild');
    """)
    metadata_values = {
        "seed_name": "Commonweave Knowledge Seed 1", "seed_version": BUILD_VERSION,
        "build_started_at": build_started, "build_completed_at": now_iso(), "selection_url": SELECTION_URL,
        "selection_retrieved_at": selection_audit["retrieved_at"], "source": "English Wikipedia",
        "source_license": "CC BY-SA 4.0",
        "content_policy": "text, links, references, metadata, and search index; no media binaries or embeddings",
    }
    connection.executemany("INSERT INTO metadata(key, value) VALUES (?, ?)", metadata_values.items())
    connection.commit()
    connection.execute("ANALYZE")
    connection.commit()
    connection.execute("VACUUM")
    integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
    stats = {
        "selection_titles": len(selections), "metadata_records": len(metadata),
        "articles": connection.execute("SELECT COUNT(*) FROM articles").fetchone()[0],
        "sections": connection.execute("SELECT COUNT(*) FROM sections").fetchone()[0],
        "internal_links": connection.execute("SELECT COUNT(*) FROM internal_links").fetchone()[0],
        "internal_links_in_seed": connection.execute("SELECT COUNT(*) FROM internal_links WHERE in_seed = 1").fetchone()[0],
        "external_links": connection.execute("SELECT COUNT(*) FROM external_links").fetchone()[0],
        "references": connection.execute("SELECT COUNT(*) FROM references_list").fetchone()[0],
        "video_references": connection.execute("SELECT COUNT(*) FROM video_references").fetchone()[0],
        "failures": connection.execute("SELECT COUNT(*) FROM failures").fetchone()[0],
        "total_words": connection.execute("SELECT COALESCE(SUM(word_count), 0) FROM articles").fetchone()[0],
        "total_text_characters": connection.execute("SELECT COALESCE(SUM(char_count), 0) FROM articles").fetchone()[0],
    }
    connection.close()

    audit = {
        "seed_name": "Commonweave Knowledge Seed 1", "seed_version": BUILD_VERSION,
        "build_started_at": build_started, "build_completed_at": now_iso(), "sqlite_integrity": integrity,
        "selection": selection_audit, "counts": stats,
        "known_limits": [
            "Wikipedia changes continuously; every article stores a revision ID and revision timestamp.",
            "The live Level 3 vital-article selection is a community-maintained general-studies spine, not a complete curriculum.",
            "Rendered tables, mathematical diagrams, images, audio, and video binaries are excluded from this text-and-links build.",
            "Video entries are references only; item-level licensing review is required before bundling media or transcripts.",
            "No semantic embeddings are bundled; local installations may generate a separate optional index.",
        ],
    }
    (output_dir / "audit.json").write_text(json.dumps(audit, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (output_dir / "RIGHTS.md").write_text("""# Rights and attribution

## Wikipedia text

Article text and link data are derived from English Wikipedia and are distributed under the Creative Commons Attribution-ShareAlike 4.0 International license. Each article record retains its canonical URL, page ID, revision ID, revision timestamp, source attribution, retrieval timestamp, and content hash. Contributor history is available through the canonical page history.

This database is a transformed and indexed collection. Redistributors must preserve attribution, identify modifications, provide the applicable license notice, and follow share-alike requirements.

## Linked material

A URL or citation is not a license grant. External pages, transcripts, and videos retain their own terms. The video manifest records preliminary rights states and does not bundle media. MIT OpenCourseWare entries are marked for noncommercial packs only. Government-source candidates still require item-level credit and third-party-rights review.
""", encoding="utf-8")
    (output_dir / "README.md").write_text(f"""# Commonweave Knowledge Seed 1

A content-first offline general-studies seed assembled from the live English Wikipedia Vital Articles Level 3 list. This build contains **{stats['articles']:,} articles**, **{stats['sections']:,} searchable sections**, **{stats['internal_links']:,} internal links**, **{stats['external_links']:,} external links**, and **{stats['references']:,} citation records**.

## Main file

`commonweave-seed1.sqlite` is the canonical local source. Search `section_fts` with SQLite FTS5 and join `rowid` to `sections.id`. Article provenance lives in `articles`; links and references live in their corresponding tables.

```sql
SELECT s.article_title, s.heading, snippet(section_fts, 2, '[', ']', ' … ', 24) AS excerpt
FROM section_fts
JOIN sections s ON s.id = section_fts.rowid
WHERE section_fts MATCH 'photosynthesis'
ORDER BY bm25(section_fts)
LIMIT 10;
```

Included: current article text organized by section, revision-aware provenance and hashes, local full-text search, internal and external links, citations, the live selection manifest, a curated educational-video reference manifest, rights notes, checksums, audit, and a measured size report.

Excluded: images, audio, video binaries, raw HTML, raw wikitext, edit history, and semantic embedding vectors.
""", encoding="utf-8")

    reported_zip_size = 0
    for _ in range(6):
        write_size_report(output_dir, zip_path, reported_zip_size, stats)
        write_checksums(output_dir)
        create_zip(output_dir, zip_path)
        actual = zip_path.stat().st_size
        if actual == reported_zip_size:
            break
        reported_zip_size = actual
    zip_path.with_suffix(zip_path.suffix + ".sha256").write_text(f"{sha256_file(zip_path)}  {zip_path.name}\n", encoding="utf-8")
    print("\nBUILD COMPLETE", flush=True)
    print(f"SQLite: {database_path} ({human_bytes(database_path.stat().st_size)})", flush=True)
    print(f"Package: {zip_path} ({human_bytes(zip_path.stat().st_size)})", flush=True)
    print(json.dumps(stats, indent=2), flush=True)
    print((output_dir / "SIZE_REPORT.md").read_text(encoding="utf-8"), flush=True)
    return 0 if integrity == "ok" and stats["articles"] >= int(len(selections) * 0.95) else 2


if __name__ == "__main__":
    raise SystemExit(main())
