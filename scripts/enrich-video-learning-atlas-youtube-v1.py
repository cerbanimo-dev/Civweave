#!/usr/bin/env python3
"""Enrich an already-built Civweave Video Learning Atlas with current YouTube API metadata.

The API key is read only from YOUTUBE_API_KEY / GOOGLE_API_KEY. It is never written to
output. Current YouTube API metadata is kept in a separate expiring gzip sidecar, with
a small browser availability index used to exclude unavailable/non-embeddable videos.
"""
from __future__ import annotations

import gzip
import hashlib
import json
import os
import re
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(os.environ.get(
    "VIDEO_ATLAS_OUTPUT_DIR",
    "public/downloads/knowledge-schools/video-atlases",
))
LOOKUP = ROOT / "lookup.json"
CATALOG = ROOT / "catalog.json"
SIDECAR = ROOT / "youtube-metadata-current.json.gz"
AVAILABILITY = ROOT / "youtube-availability-current.json"
KEY = (os.environ.get("YOUTUBE_API_KEY") or os.environ.get("GOOGLE_API_KEY") or "").strip()
USER_AGENT = "Civweave-Video-Atlas-Enricher/1.0 (+https://github.com/cerbanimo-dev/Civweave)"


def now_utc():
    return datetime.now(timezone.utc)


def iso(dt):
    return dt.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def clean(value, limit=5000):
    return re.sub(r"\s+", " ", str(value or "")).strip()[:limit]


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def chunks(items, size=50):
    for start in range(0, len(items), size):
        yield items[start:start + size]


def request_json(url, attempts=4, timeout=45):
    last = None
    for attempt in range(attempts):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception as exc:
            last = exc
            if attempt + 1 < attempts:
                time.sleep(min(8, 1.5 ** attempt))
    raise RuntimeError(f"YouTube request failed after {attempts} attempts: {last}")


def main():
    if not KEY:
        raise SystemExit("YOUTUBE_API_KEY or GOOGLE_API_KEY is required")
    lookup = json.loads(LOOKUP.read_text(encoding="utf-8"))
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    ids = sorted({str(row.get("video_id") or "").strip() for row in lookup.get("records", []) if row.get("video_id")})
    ids = [video_id for video_id in ids if re.fullmatch(r"[\w-]{11}", video_id)]
    built_at = now_utc()
    expires_at = built_at + timedelta(days=29)
    records = {}
    errors = []
    requested_batches = 0

    fields = "items(id,snippet(title,description,channelTitle,publishedAt,defaultLanguage),status(embeddable,privacyStatus),contentDetails(duration))"
    for batch in chunks(ids, 50):
        requested_batches += 1
        params = urllib.parse.urlencode({
            "part": "snippet,status,contentDetails",
            "id": ",".join(batch),
            "key": KEY,
            "fields": fields,
        })
        try:
            data = request_json(f"https://www.googleapis.com/youtube/v3/videos?{params}")
        except Exception as exc:
            errors.append(clean(exc, 500))
            continue
        for item in data.get("items") or []:
            video_id = clean(item.get("id"), 20)
            if not video_id:
                continue
            snippet = item.get("snippet") or {}
            status = item.get("status") or {}
            content = item.get("contentDetails") or {}
            records[video_id] = {
                "video_id": video_id,
                "title": clean(snippet.get("title"), 180),
                "description": clean(snippet.get("description"), 5000),
                "channel_title": clean(snippet.get("channelTitle"), 180),
                "published_at": clean(snippet.get("publishedAt"), 48),
                "default_language": clean(snippet.get("defaultLanguage"), 24) or None,
                "duration_iso8601": clean(content.get("duration"), 48),
                "embeddable": bool(status.get("embeddable", False)),
                "privacy_status": clean(status.get("privacyStatus"), 32),
            }

    if errors:
        raise SystemExit(f"YouTube enrichment incomplete: {len(errors)} batch request(s) failed; first error: {errors[0]}")
    if not records:
        raise SystemExit("YouTube enrichment returned zero records")

    payload = {
        "schema": "civweave.youtube-api-metadata-sidecar.v1",
        "built_at": iso(built_at),
        "expires_at": iso(expires_at),
        "refresh_required_days": 30,
        "requested_video_ids": len(ids),
        "returned_video_ids": len(records),
        "missing_or_unavailable_video_ids": len(ids) - len(records),
        "records": records,
    }
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    compressed = gzip.compress(raw, compresslevel=9, mtime=0)
    SIDECAR.write_bytes(compressed)

    eligible = sorted(
        video_id for video_id, row in records.items()
        if bool(row.get("embeddable")) and str(row.get("privacy_status") or "").lower() == "public"
    )
    eligible_set = set(eligible)
    ineligible = sorted(video_id for video_id in ids if video_id not in eligible_set)
    availability_payload = {
        "schema": "civweave.youtube-availability-index.v1",
        "status": "current",
        "built_at": iso(built_at),
        "expires_at": iso(expires_at),
        "refresh_required_days": 30,
        "source_sidecar_file": SIDECAR.name,
        "source_sidecar_sha256": sha256(compressed),
        "catalog_video_ids": len(ids),
        "returned_video_ids": len(records),
        "eligible_count": len(eligible),
        "ineligible_count": len(ineligible),
        "eligible_video_ids": eligible,
        "ineligible_video_ids": ineligible,
    }
    availability_raw = (json.dumps(availability_payload, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")
    AVAILABILITY.write_bytes(availability_raw)

    sidecar_meta = {
        "file": SIDECAR.name,
        "bytes": len(compressed),
        "human": f"{len(compressed) / 1024:.2f} KiB",
        "sha256": sha256(compressed),
        "records": len(records),
        "requested_video_ids": len(ids),
        "missing_or_unavailable_video_ids": len(ids) - len(records),
        "built_at": iso(built_at),
        "expires_at": iso(expires_at),
        "refresh_required_days": 30,
    }
    catalog["youtube_api_enrichment"] = {
        "status": "success",
        "requested_video_ids": len(ids),
        "returned_video_ids": len(records),
        "missing_or_unavailable_video_ids": len(ids) - len(records),
        "requested_batches": requested_batches,
        "source": "YouTube Data API v3 videos.list",
        "built_at": iso(built_at),
    }
    catalog["youtube_metadata_sidecar"] = sidecar_meta
    catalog["youtube_availability_index"] = {
        "file": AVAILABILITY.name,
        "bytes": len(availability_raw),
        "sha256": sha256(availability_raw),
        "eligible_video_ids": len(eligible),
        "ineligible_video_ids": len(ineligible),
        "built_at": iso(built_at),
        "expires_at": iso(expires_at),
    }
    CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    sums = []
    for path in sorted(ROOT.iterdir()):
        if path.is_file() and path.name != "SHA256SUMS":
            sums.append(f"{sha256(path.read_bytes())}  {path.name}")
    (ROOT / "SHA256SUMS").write_text("\n".join(sums) + "\n", encoding="utf-8")

    print(json.dumps({
        "status": "success",
        "requested_video_ids": len(ids),
        "returned_video_ids": len(records),
        "missing_or_unavailable_video_ids": len(ids) - len(records),
        "eligible_video_ids": len(eligible),
        "ineligible_video_ids": len(ineligible),
        "requested_batches": requested_batches,
        "sidecar_bytes": len(compressed),
        "sidecar_sha256": sidecar_meta["sha256"],
        "availability_bytes": len(availability_raw),
        "expires_at": sidecar_meta["expires_at"],
    }, indent=2))


if __name__ == "__main__":
    main()
