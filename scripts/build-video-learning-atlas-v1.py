#!/usr/bin/env python3
"""
Build Civweave's optional Video Learning Atlas from public educational-video catalogs.

Durable bundles contain only source-dataset metadata and open-licensed/derived text.
YouTube Data API descriptions are written to a separate expiring sidecar because
YouTube API non-authorized metadata must be refreshed or deleted within 30 days.
"""
from __future__ import annotations

import gzip
import hashlib
import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import zipfile
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

OUTPUT_DIR = Path(os.environ.get(
    "VIDEO_ATLAS_OUTPUT_DIR",
    "public/downloads/knowledge-schools/video-atlases",
))
PER_SCHOOL = max(25, min(int(os.environ.get("VIDEO_ATLAS_PER_SCHOOL", "250")), 1000))
HF_PAGE = max(10, min(int(os.environ.get("VIDEO_ATLAS_HF_PAGE", "60")), 100))
YOUTUBE_KEY = (
    os.environ.get("YOUTUBE_API_KEY")
    or os.environ.get("GOOGLE_API_KEY")
    or ""
).strip()
USER_AGENT = "Civweave-Video-Atlas/1.0 (+https://github.com/cerbanimo-dev/Civweave)"

SCHOOLS = [
    {
        "slug": "people",
        "name": "School of People and Lives",
        "keywords": ["biography", "human development", "culture", "identity"],
    },
    {
        "slug": "history",
        "name": "School of History",
        "keywords": ["world history", "ancient history", "modern history", "historical methods"],
    },
    {
        "slug": "geography",
        "name": "School of Geography",
        "keywords": ["physical geography", "human geography", "cartography", "climate geography"],
    },
    {
        "slug": "arts",
        "name": "School of Arts",
        "keywords": ["art history", "drawing", "music theory", "film making"],
    },
    {
        "slug": "everyday-life",
        "name": "School of Everyday Life",
        "keywords": ["cooking", "gardening", "home repair", "personal finance basics"],
    },
    {
        "slug": "philosophy-and-religion",
        "name": "School of Philosophy and Religion",
        "keywords": ["philosophy", "ethics", "world religions", "logic"],
    },
    {
        "slug": "society-and-social-sciences",
        "name": "School of Society and Social Sciences",
        "keywords": ["sociology", "psychology", "economics", "political science"],
    },
    {
        "slug": "health-medicine-and-disease",
        "name": "School of Health, Medicine and Disease",
        "keywords": ["anatomy", "public health", "first aid", "medical science"],
    },
    {
        "slug": "science",
        "name": "School of Science",
        "keywords": ["physics", "chemistry", "biology", "astronomy"],
    },
    {
        "slug": "technology",
        "name": "School of Technology",
        "keywords": ["programming", "electronics", "engineering", "computer science"],
    },
    {
        "slug": "mathematics",
        "name": "School of Mathematics",
        "keywords": ["algebra", "calculus", "geometry", "statistics"],
    },
]

SOURCES = [
    {
        "id": "massive-yt-edu-queue",
        "dataset": "thepowerfuldeez/massive-yt-edu-queue",
        "license": "MIT metadata dataset; individual video rights vary",
        "role": "broad educational discovery",
    },
    {
        "id": "youtube-commons",
        "dataset": "PleIAs/YouTube-Commons",
        "license": "CC-BY-4.0 corpus",
        "role": "open transcript and provenance layer",
    },
    {
        "id": "howto-interlink7m",
        "dataset": "Awiny/Howto-Interlink7M",
        "license": "Apache-2.0 dataset; derived from HowTo100M source videos",
        "role": "practical procedural layer",
        "upstream": "HowTo100M",
    },
]

def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def iso(dt: datetime) -> str:
    return dt.replace(microsecond=0).isoformat().replace("+00:00", "Z")

def clean_text(value, limit=500):
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    return text[:limit]

def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def request_json(url: str, attempts=4, timeout=45):
    last = None
    for attempt in range(attempts):
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception as exc:
            last = exc
            if attempt + 1 < attempts:
                time.sleep(min(8, 1.5 ** attempt))
    raise RuntimeError(f"request failed after {attempts} attempts: {url}: {last}")

def hf_split(dataset: str):
    query = urllib.parse.urlencode({"dataset": dataset})
    data = request_json(f"https://datasets-server.huggingface.co/splits?{query}")
    splits = data.get("splits") or []
    if not splits:
        raise RuntimeError(f"No viewer split available for {dataset}")
    preferred = next((item for item in splits if item.get("split") == "train"), splits[0])
    return preferred["config"], preferred["split"]

_SPLITS = {}

def hf_search(dataset: str, query_text: str, length=HF_PAGE):
    if dataset not in _SPLITS:
        _SPLITS[dataset] = hf_split(dataset)
    config, split = _SPLITS[dataset]
    params = urllib.parse.urlencode({
        "dataset": dataset,
        "config": config,
        "split": split,
        "query": query_text,
        "offset": 0,
        "length": length,
    })
    data = request_json(f"https://datasets-server.huggingface.co/search?{params}")
    return [entry.get("row") or {} for entry in (data.get("rows") or [])]

def youtube_url(video_id: str):
    return f"https://www.youtube.com/watch?v={video_id}"

def parse_video_id_from_path(path: str):
    name = str(path or "").rsplit("/", 1)[-1]
    name = re.sub(r"\.(?:mp4|webm|mkv|mov)$", "", name, flags=re.I)
    return name if re.fullmatch(r"[\w-]{11}", name or "") else ""

def summarize_interlink(clips_value):
    if not clips_value:
        return ""
    clips = clips_value
    if isinstance(clips_value, str):
        try:
            clips = json.loads(clips_value)
        except Exception:
            return clean_text(clips_value, 420)
    if not isinstance(clips, list):
        return ""
    pieces = []
    for clip in clips[:4]:
        if isinstance(clip, dict):
            caption = clean_text(clip.get("caption"), 220)
            if caption:
                pieces.append(caption)
    return clean_text(" ".join(pieces), 500)

def normalize_row(source_id: str, row: dict, query: str, rank: int):
    if source_id == "massive-yt-edu-queue":
        video_id = clean_text(row.get("video_id"), 20)
        if not re.fullmatch(r"[\w-]{11}", video_id):
            return None
        title = clean_text(row.get("title"), 180)
        return {
            "video_id": video_id,
            "url": clean_text(row.get("url"), 240) or youtube_url(video_id),
            "title": title,
            "creator": clean_text(row.get("source"), 160),
            "duration_seconds": int(row.get("duration_seconds") or 0),
            "language": None,
            "catalog_description": "",
            "catalog_description_source": None,
            "source_datasets": [source_id],
            "source_details": {
                source_id: {
                    "content_category": clean_text(row.get("content_category"), 80),
                    "priority": int(row.get("priority") or 0),
                    "license_risk": clean_text(row.get("license_risk"), 20),
                    "matched_query": query,
                    "result_rank": rank,
                }
            },
        }
    if source_id == "youtube-commons":
        video_id = clean_text(row.get("video_id"), 20)
        if not re.fullmatch(r"[\w-]{11}", video_id):
            return None
        excerpt = clean_text(row.get("text"), 500)
        return {
            "video_id": video_id,
            "url": clean_text(row.get("video_link"), 240) or youtube_url(video_id),
            "title": clean_text(row.get("title"), 180),
            "creator": clean_text(row.get("channel"), 160),
            "duration_seconds": 0,
            "language": clean_text(
                row.get("original_language")
                or row.get("source_language")
                or row.get("transcription_language"),
                24,
            ) or None,
            "catalog_description": excerpt,
            "catalog_description_source": "CC-BY transcript excerpt" if excerpt else None,
            "source_datasets": [source_id],
            "source_details": {
                source_id: {
                    "license": clean_text(row.get("license"), 40) or "CC-BY",
                    "date": clean_text(row.get("date"), 40),
                    "matched_query": query,
                    "result_rank": rank,
                }
            },
        }
    if source_id == "howto-interlink7m":
        video_id = parse_video_id_from_path(row.get("video"))
        if not video_id:
            return None
        summary = summarize_interlink(row.get("clips"))
        return {
            "video_id": video_id,
            "url": youtube_url(video_id),
            "title": "",
            "creator": "",
            "duration_seconds": 0,
            "language": "en",
            "catalog_description": summary,
            "catalog_description_source": "Apache-2.0 HowTo-Interlink7M annotations" if summary else None,
            "source_datasets": [source_id],
            "source_details": {
                source_id: {
                    "has_all_clips": bool(row.get("has_all_clips")),
                    "matched_query": query,
                    "result_rank": rank,
                    "upstream": "HowTo100M",
                }
            },
        }
    return None

def merge_record(base: dict, incoming: dict):
    for field in ("url", "title", "creator", "language", "catalog_description", "catalog_description_source"):
        if not base.get(field) and incoming.get(field):
            base[field] = incoming[field]
    if not base.get("duration_seconds") and incoming.get("duration_seconds"):
        base["duration_seconds"] = incoming["duration_seconds"]
    base["source_datasets"] = sorted(set(base["source_datasets"] + incoming["source_datasets"]))
    base.setdefault("source_details", {}).update(incoming.get("source_details") or {})
    return base

def score(record: dict, keyword_index=0):
    points = 100 - keyword_index * 7
    sources = set(record.get("source_datasets") or [])
    if "youtube-commons" in sources:
        points += 28
    if "massive-yt-edu-queue" in sources:
        details = record.get("source_details", {}).get("massive-yt-edu-queue", {})
        points += int(details.get("priority") or 0) * 4
        risk = details.get("license_risk")
        if risk == "green":
            points += 20
        elif risk == "yellow":
            points += 8
        elif risk == "red":
            points -= 25
    if "howto-interlink7m" in sources:
        points += 12
    if record.get("catalog_description"):
        points += 8
    if record.get("title"):
        points += 4
    return points

def discover_school(school):
    merged = {}
    scoring = defaultdict(int)
    failures = []
    for source in SOURCES:
        for keyword_index, keyword in enumerate(school["keywords"]):
            try:
                rows = hf_search(source["dataset"], keyword)
            except Exception as exc:
                failures.append({
                    "source": source["id"],
                    "query": keyword,
                    "error": clean_text(exc, 300),
                })
                continue
            for rank, row in enumerate(rows, start=1):
                record = normalize_row(source["id"], row, keyword, rank)
                if not record:
                    continue
                video_id = record["video_id"]
                if video_id in merged:
                    merge_record(merged[video_id], record)
                else:
                    merged[video_id] = record
                scoring[video_id] = max(scoring[video_id], score(merged[video_id], keyword_index) - rank // 5)
    ranked = sorted(
        merged.values(),
        key=lambda record: (-scoring[record["video_id"]], record.get("title") or record["video_id"]),
    )
    selected = ranked[:PER_SCHOOL]
    for idx, record in enumerate(selected, start=1):
        record["school_slug"] = school["slug"]
        record["school_name"] = school["name"]
        record["rank"] = idx
        record["selection_score"] = scoring[record["video_id"]]
    return selected, failures

def chunks(items, size=50):
    for start in range(0, len(items), size):
        yield items[start:start + size]

def youtube_enrich(records):
    if not YOUTUBE_KEY:
        return {}, {"status": "not-run", "reason": "No YOUTUBE_API_KEY/GOOGLE_API_KEY available."}
    ids = sorted({record["video_id"] for record in records})
    sidecar = {}
    errors = []
    for batch in chunks(ids, 50):
        params = urllib.parse.urlencode({
            "part": "snippet,status,contentDetails",
            "id": ",".join(batch),
            "key": YOUTUBE_KEY,
        })
        try:
            data = request_json(f"https://www.googleapis.com/youtube/v3/videos?{params}", attempts=3)
        except Exception as exc:
            errors.append(clean_text(exc, 400))
            if "403" in str(exc) or "400" in str(exc):
                break
            continue
        for item in data.get("items") or []:
            snippet = item.get("snippet") or {}
            status = item.get("status") or {}
            content = item.get("contentDetails") or {}
            video_id = item.get("id")
            if not video_id:
                continue
            sidecar[video_id] = {
                "video_id": video_id,
                "title": clean_text(snippet.get("title"), 180),
                "description": clean_text(snippet.get("description"), 5000),
                "channel_title": clean_text(snippet.get("channelTitle"), 180),
                "published_at": clean_text(snippet.get("publishedAt"), 48),
                "default_language": clean_text(snippet.get("defaultLanguage"), 24) or None,
                "duration_iso8601": clean_text(content.get("duration"), 48),
                "caption": clean_text(content.get("caption"), 12),
                "embeddable": bool(status.get("embeddable")),
                "youtube_license": clean_text(status.get("license"), 40),
            }
        time.sleep(0.05)
    return sidecar, {
        "status": "ok" if sidecar else "failed",
        "requested": len(ids),
        "returned": len(sidecar),
        "errors": errors[:3],
    }

def json_bytes(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")

def write_zip(path: Path, files: dict[str, bytes]):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, payload in files.items():
            archive.writestr(name, payload)
    data = buffer.getvalue()
    path.write_bytes(data)
    return {
        "file": path.name,
        "bytes": len(data),
        "sha256": sha256_bytes(data),
    }

def human_bytes(value):
    amount = float(value)
    for unit in ("B", "KiB", "MiB", "GiB"):
        if amount < 1024 or unit == "GiB":
            return f"{amount:.0f} {unit}" if unit == "B" else f"{amount:.2f} {unit}"
        amount /= 1024

def build():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUTPUT_DIR.glob("civweave-video-atlas-*.zip"):
        old.unlink()
    for old in OUTPUT_DIR.glob("youtube-metadata-current.json.gz"):
        old.unlink()

    built_at = now_utc()
    schools_payload = []
    all_records = []
    all_failures = []

    print(f"Building {len(SCHOOLS)} school video catalogs at up to {PER_SCHOOL} records each.")
    for school in SCHOOLS:
        records, failures = discover_school(school)
        print(f"{school['slug']}: {len(records)} selected; {len(failures)} discovery failures")
        all_records.extend(records)
        all_failures.extend([{"school_slug": school["slug"], **failure} for failure in failures])
        payload = {
            "schema": "civweave.video-learning-atlas.school.v1",
            "built_at": iso(built_at),
            "school_slug": school["slug"],
            "school_name": school["name"],
            "keywords": school["keywords"],
            "count": len(records),
            "records": records,
        }
        readme = (
            f"Civweave Video Learning Atlas — {school['name']}\n"
            f"Built: {iso(built_at)}\n"
            "This package contains links and lightweight metadata only; it contains no YouTube video files.\n"
            "Descriptions in this durable package come only from source-dataset text with compatible provenance.\n"
            "Current YouTube API descriptions, when available, are distributed separately as a 30-day refresh sidecar.\n"
        ).encode("utf-8")
        pack = write_zip(
            OUTPUT_DIR / f"civweave-video-atlas-{school['slug']}.zip",
            {
                "catalog.json": json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8"),
                "README.txt": readme,
            },
        )
        schools_payload.append({
            "school_slug": school["slug"],
            "school_name": school["name"],
            "keywords": school["keywords"],
            "count": len(records),
            "zip_file": pack["file"],
            "zip_bytes": pack["bytes"],
            "zip_human": human_bytes(pack["bytes"]),
            "zip_sha256": pack["sha256"],
        })

    sidecar, enrichment = youtube_enrich(all_records)
    expires_at = built_at + timedelta(days=29)
    sidecar_meta = None
    if sidecar:
        sidecar_payload = {
            "schema": "civweave.youtube-api-metadata-sidecar.v1",
            "built_at": iso(built_at),
            "expires_at": iso(expires_at),
            "refresh_required_days": 30,
            "records": sidecar,
        }
        raw = json_bytes(sidecar_payload)
        compressed = gzip.compress(raw, compresslevel=9, mtime=0)
        sidecar_path = OUTPUT_DIR / "youtube-metadata-current.json.gz"
        sidecar_path.write_bytes(compressed)
        sidecar_meta = {
            "file": sidecar_path.name,
            "bytes": len(compressed),
            "human": human_bytes(len(compressed)),
            "sha256": sha256_bytes(compressed),
            "records": len(sidecar),
            "built_at": iso(built_at),
            "expires_at": iso(expires_at),
            "refresh_required_days": 30,
        }

    all_payload = {
        "schema": "civweave.video-learning-atlas.core.v1",
        "built_at": iso(built_at),
        "records": all_records,
        "sources": SOURCES,
        "discovery_failures": all_failures,
    }
    core_pack = write_zip(
        OUTPUT_DIR / "civweave-video-atlas-core.zip",
        {
            "catalog.json": json.dumps(all_payload, ensure_ascii=False, indent=2).encode("utf-8"),
            "sources.json": json.dumps(SOURCES, ensure_ascii=False, indent=2).encode("utf-8"),
            "README.txt": (
                "Civweave Video Learning Atlas — complete core\n"
                f"Built: {iso(built_at)}\n"
                f"Records: {len(all_records)} across {len(SCHOOLS)} foundation schools.\n"
                "No video binaries are included. Follow the YouTube URLs when online.\n"
                "Source-dataset text/provenance is durable; YouTube Data API descriptions are kept in a separate expiring sidecar.\n"
            ).encode("utf-8"),
        },
    )

    source_stats = defaultdict(int)
    for record in all_records:
        for source in record.get("source_datasets") or []:
            source_stats[source] += 1

    catalog = {
        "schema": "civweave.video-learning-atlas.catalog.v1",
        "built_at": iso(built_at),
        "per_school_target": PER_SCHOOL,
        "total_records": len(all_records),
        "unique_video_ids": len({r["video_id"] for r in all_records}),
        "sources": SOURCES,
        "source_record_counts": dict(source_stats),
        "core_bundle": {
            "file": core_pack["file"],
            "bytes": core_pack["bytes"],
            "human": human_bytes(core_pack["bytes"]),
            "sha256": core_pack["sha256"],
            "records": len(all_records),
        },
        "schools": schools_payload,
        "youtube_api_enrichment": enrichment,
        "youtube_metadata_sidecar": sidecar_meta,
        "discovery_failure_count": len(all_failures),
    }
    catalog_path = OUTPUT_DIR / "catalog.json"
    catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    sums = []
    for path in sorted(OUTPUT_DIR.iterdir()):
        if path.is_file() and path.name != "SHA256SUMS":
            sums.append(f"{sha256_bytes(path.read_bytes())}  {path.name}")
    (OUTPUT_DIR / "SHA256SUMS").write_text("\n".join(sums) + "\n", encoding="utf-8")

    print(json.dumps({
        "output_dir": str(OUTPUT_DIR),
        "records": len(all_records),
        "unique_video_ids": catalog["unique_video_ids"],
        "enrichment": enrichment,
        "sidecar": sidecar_meta,
    }, indent=2))

if __name__ == "__main__":
    build()
