#!/usr/bin/env python3
"""Build Civweave's rights-cleared, lazy-download Hub Music Library.

The output is deliberately strict: a record is emitted only when the source exposes
an explicit license in Civweave's redistribution allowlist AND at least one direct
downloadable audio file. Unknown, noncommercial, no-derivatives, custom, or merely
"free to download" material is discarded rather than retained as a link-only record.
"""
from __future__ import annotations

import concurrent.futures
import hashlib
import html
import json
import os
import re
import time
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config/open-music-harvest-v1.json"
OUTPUT_DIR = ROOT / "public/downloads/hub-media/open-music"
RESULTS_PER_QUERY = max(3, min(int(os.environ.get("OPEN_MUSIC_RESULTS_PER_QUERY", "12")), 40))
MAX_WORKERS = max(1, min(int(os.environ.get("OPEN_MUSIC_WORKERS", "6")), 10))
REQUEST_TIMEOUT = max(10, min(int(os.environ.get("OPEN_MUSIC_TIMEOUT", "35")), 90))
USER_AGENT = "Civweave-Open-Music-Harvester/1.0 (+https://github.com/cerbanimo-dev/Civweave)"
ALLOWED = {"PUBLIC-DOMAIN", "CC0", "CC-BY", "CC-BY-SA"}
AUDIO_EXTS = {".mp3", ".ogg", ".oga", ".opus", ".flac", ".wav", ".m4a", ".aac", ".aif", ".aiff"}
COMMONS_ALLOWED = [
    (re.compile(r"\bcc0\b|creative\s*commons\s*zero|publicdomain/zero", re.I), "CC0", False),
    (re.compile(r"public\s*domain|public-domain|publicdomain/mark", re.I), "PUBLIC-DOMAIN", False),
    (re.compile(r"\bcc\s*by[-\s]?sa\b|cc-by-sa|attribution-sharealike", re.I), "CC-BY-SA", True),
    (re.compile(r"\bcc\s*by\b|cc-by|attribution(?!.*noncommercial)", re.I), "CC-BY", False),
]
IA_ALLOWED = [
    ("creativecommons.org/publicdomain/zero", "CC0", False),
    ("creativecommons.org/publicdomain/mark", "PUBLIC-DOMAIN", False),
    ("creativecommons.org/licenses/by-sa/", "CC-BY-SA", True),
    ("creativecommons.org/licenses/by/", "CC-BY", False),
]
CCMIXTER_LICENSES = {"by": "CC-BY", "sa": "CC-BY-SA", "pd": "PUBLIC-DOMAIN"}


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def clean(value: Any, limit: int = 1200) -> str:
    if value is None:
        return ""
    if isinstance(value, (list, tuple)):
        value = " ".join(str(part) for part in value if part is not None)
    text = html.unescape(re.sub(r"<[^>]+>", " ", str(value)))
    return re.sub(r"\s+", " ", text).strip()[:limit]


def request_json(url: str, attempts: int = 3) -> Any:
    last = None
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
            with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception as exc:  # network failures are recorded per source/query
            last = exc
            if attempt + 1 < attempts:
                time.sleep(min(5.0, 0.75 * (2 ** attempt)))
    raise RuntimeError(f"request failed: {url}: {last}")


def license_record(spdx: str, label: str, url: str, evidence: str, share_alike: bool = False) -> dict:
    if spdx not in ALLOWED:
        raise ValueError(f"license {spdx} is outside the redistribution allowlist")
    return {
        "spdx": spdx,
        "label": clean(label, 160) or spdx,
        "url": clean(url, 1000),
        "evidence": clean(evidence, 1800),
        "commercial_use": True,
        "redistribution": True,
        "derivatives": True,
        "share_alike": bool(share_alike),
    }


def commons_license(ext: dict) -> dict | None:
    fields = [
        clean((ext.get("LicenseShortName") or {}).get("value"), 160),
        clean((ext.get("UsageTerms") or {}).get("value"), 220),
        clean((ext.get("License") or {}).get("value"), 160),
        clean((ext.get("LicenseUrl") or {}).get("value"), 800),
    ]
    evidence = " | ".join(fields)
    if re.search(r"non[-\s]?commercial|no[-\s]?derivatives|\bcc[-\s]?by[-\s]?nc\b|\bcc[-\s]?by[-\s]?nd\b", evidence, re.I):
        return None
    for pattern, spdx, share_alike in COMMONS_ALLOWED:
        if pattern.search(evidence):
            return license_record(spdx, fields[0] or fields[1] or spdx, fields[3], evidence, share_alike)
    return None


def ia_license(value: Any) -> dict | None:
    url = clean(value, 800)
    lowered = url.lower()
    if any(blocked in lowered for blocked in ("/by-nc", "/by-nd", "noncommercial", "noderivatives")):
        return None
    for needle, spdx, share_alike in IA_ALLOWED:
        if needle in lowered:
            return license_record(spdx, spdx, url, f"Internet Archive metadata licenseurl={url}", share_alike)
    return None


def ccmixter_license(item: dict, requested: str) -> dict | None:
    url = clean(item.get("license_url") or item.get("upload_license_url") or item.get("license"), 800)
    label = clean(item.get("license_name") or item.get("upload_license_name") or requested, 180)
    evidence = f"ccMixter Query API lic={requested}; license={label}; url={url}"
    lowered = f"{label} {url}".lower()
    if any(token in lowered for token in ("noncommercial", "no derivatives", "by-nc", "by-nd", "bync")):
        return None
    if "creativecommons.org/publicdomain" in lowered or requested == "pd":
        return license_record("PUBLIC-DOMAIN", label or "Public Domain", url, evidence)
    if "creativecommons.org/licenses/by-sa/" in lowered or requested == "sa":
        return license_record("CC-BY-SA", label or "CC BY-SA", url, evidence, True)
    if "creativecommons.org/licenses/by/" in lowered or requested == "by":
        return license_record("CC-BY", label or "CC BY", url, evidence)
    return None


def base_record(provider: str, playlist: dict, query: str) -> dict:
    return {
        "schema": "civweave.open-music-track.v1",
        "provider": provider,
        "provider_id": "",
        "playlist_id": playlist["id"],
        "matched_query": query,
        "title": "",
        "artist": "",
        "album": "",
        "duration_seconds": 0,
        "source_url": "",
        "license": {},
        "files": [],
        "attribution": {},
        "cache_policy": "MESH_REDISTRIBUTABLE_LAZY",
        "mesh_redistributable": True,
        "download_enabled": True,
        "content_hash": None,
        "hash_state": "compute-sha256-on-cache",
    }


def harvest_commons(playlist: dict, query: str) -> list[dict]:
    params = urllib.parse.urlencode({
        "action": "query", "generator": "search", "gsrsearch": f"{query} filetype:audio",
        "gsrnamespace": 6, "gsrlimit": RESULTS_PER_QUERY, "prop": "imageinfo",
        "iiprop": "url|size|mime|sha1|extmetadata", "format": "json", "formatversion": 2, "origin": "*",
    })
    data = request_json(f"https://commons.wikimedia.org/w/api.php?{params}")
    out = []
    for page in (data.get("query") or {}).get("pages") or []:
        info = ((page.get("imageinfo") or [{}])[0]) or {}
        mime = clean(info.get("mime"), 100).lower()
        file_url = clean(info.get("url"), 1800)
        if not mime.startswith("audio/") or not file_url:
            continue
        ext = info.get("extmetadata") or {}
        lic = commons_license(ext)
        if not lic:
            continue
        title_page = clean(page.get("title"), 500)
        source_url = clean(info.get("descriptionurl"), 1600) or "https://commons.wikimedia.org/wiki/" + urllib.parse.quote(title_page.replace(" ", "_"))
        record = base_record("wikimedia-commons", playlist, query)
        record.update({
            "provider_id": title_page,
            "title": clean((ext.get("ObjectName") or {}).get("value") or re.sub(r"^File:", "", title_page), 260),
            "artist": clean((ext.get("Artist") or {}).get("value"), 300),
            "source_url": source_url,
            "license": lic,
            "files": [{"url": file_url, "mime": mime, "bytes": int(info.get("size") or 0), "provider_sha1": clean(info.get("sha1"), 100) or None, "role": "original"}],
        })
        record["attribution"] = {"creator": record["artist"], "source_title": record["title"], "source_url": source_url, "license": lic["label"], "license_url": lic["url"]}
        if record["title"] and record["artist"]:
            out.append(record)
    return out


def ia_audio_files(identifier: str, payload: dict) -> list[dict]:
    files = []
    for obj in payload.get("files") or []:
        if not isinstance(obj, dict):
            continue
        name = clean(obj.get("name"), 1000)
        suffix = Path(urllib.parse.urlparse(name).path.lower()).suffix
        if not name or suffix not in AUDIO_EXTS:
            continue
        quoted = urllib.parse.quote(name, safe="/()!$&'*,;=:@-._~")
        size = str(obj.get("size") or "")
        files.append({
            "url": f"https://archive.org/download/{urllib.parse.quote(identifier)}/{quoted}",
            "bytes": int(size) if size.isdigit() else 0,
            "provider_sha1": clean(obj.get("sha1"), 100) or None,
            "provider_md5": clean(obj.get("md5"), 100) or None,
            "format": clean(obj.get("format"), 120),
            "role": "original" if clean(obj.get("source"), 40).lower() == "original" else "derivative",
        })
    files.sort(key=lambda row: (0 if row["role"] == "original" else 1, -(row.get("bytes") or 0)))
    return files[:8]


def harvest_archive(playlist: dict, query: str) -> list[dict]:
    search = f'(\"{query}\") AND mediatype:audio AND licenseurl:*'
    params = urllib.parse.urlencode([
        ("q", search), ("fl[]", "identifier"), ("fl[]", "title"), ("fl[]", "creator"),
        ("fl[]", "description"), ("fl[]", "licenseurl"), ("rows", str(RESULTS_PER_QUERY)),
        ("page", "1"), ("output", "json"),
    ])
    data = request_json(f"https://archive.org/advancedsearch.php?{params}")
    out = []
    for item in ((data.get("response") or {}).get("docs") or []):
        identifier = clean(item.get("identifier"), 500)
        lic = ia_license(item.get("licenseurl"))
        if not identifier or not lic:
            continue
        full = request_json(f"https://archive.org/metadata/{urllib.parse.quote(identifier)}", attempts=2)
        metadata = full.get("metadata") or {}
        if metadata.get("licenseurl"):
            lic = ia_license(metadata.get("licenseurl"))
            if not lic:
                continue
        files = ia_audio_files(identifier, full)
        if not files:
            continue
        source_url = f"https://archive.org/details/{urllib.parse.quote(identifier)}"
        record = base_record("internet-archive", playlist, query)
        record.update({
            "provider_id": identifier,
            "title": clean(item.get("title") or metadata.get("title"), 260),
            "artist": clean(item.get("creator") or metadata.get("creator"), 300),
            "album": clean(metadata.get("album"), 240),
            "source_url": source_url,
            "license": lic,
            "files": files,
        })
        record["attribution"] = {"creator": record["artist"], "source_title": record["title"], "source_url": source_url, "license": lic["label"], "license_url": lic["url"]}
        if record["title"] and record["artist"]:
            out.append(record)
    return out


def ccmixter_files(item: dict) -> list[dict]:
    candidates = item.get("files") or item.get("upload_files") or []
    if isinstance(candidates, dict):
        candidates = list(candidates.values())
    out = []
    for obj in candidates if isinstance(candidates, list) else []:
        if not isinstance(obj, dict):
            continue
        url = clean(obj.get("download_url") or obj.get("file_download_url") or obj.get("url"), 1800)
        name = clean(obj.get("file_name") or obj.get("name"), 800)
        suffix = Path(urllib.parse.urlparse(url or name).path.lower()).suffix
        if not url or suffix not in AUDIO_EXTS:
            continue
        out.append({"url": url, "mime": clean(obj.get("mime_type") or obj.get("file_format"), 120), "bytes": int(obj.get("file_rawsize") or obj.get("size") or 0), "role": "source-download"})
    direct = clean(item.get("download_url") or item.get("file_download_url"), 1800)
    if direct and not out and Path(urllib.parse.urlparse(direct).path.lower()).suffix in AUDIO_EXTS:
        out.append({"url": direct, "mime": "", "bytes": 0, "role": "source-download"})
    return out[:8]


def harvest_ccmixter(playlist: dict, query: str) -> list[dict]:
    out = []
    for requested in ("by", "sa", "pd"):
        params = urllib.parse.urlencode({"f": "json", "dataview": "info", "limit": RESULTS_PER_QUERY, "search": query, "search_type": "all", "lic": requested, "sort": "date", "ord": "desc"})
        data = request_json(f"https://ccmixter.org/api/query?{params}")
        rows = data if isinstance(data, list) else (data.get("items") or data.get("results") or []) if isinstance(data, dict) else []
        for item in rows:
            if not isinstance(item, dict):
                continue
            lic = ccmixter_license(item, requested)
            files = ccmixter_files(item)
            if not lic or not files:
                continue
            upload_id = clean(item.get("upload_id") or item.get("id"), 120)
            source_url = clean(item.get("file_page_url") or item.get("upload_page_url") or item.get("url"), 1600)
            if not source_url and upload_id:
                source_url = f"https://ccmixter.org/files/{urllib.parse.quote(clean(item.get('user_name') or item.get('user_real_name'), 200))}/{urllib.parse.quote(upload_id)}"
            record = base_record("ccmixter", playlist, query)
            record.update({
                "provider_id": upload_id or source_url,
                "title": clean(item.get("upload_name") or item.get("name") or item.get("title"), 260),
                "artist": clean(item.get("user_real_name") or item.get("user_name") or item.get("artist"), 300),
                "source_url": source_url,
                "license": lic,
                "files": files,
            })
            record["attribution"] = {"creator": record["artist"], "source_title": record["title"], "source_url": source_url, "license": lic["label"], "license_url": lic["url"]}
            if record["provider_id"] and record["source_url"] and record["title"] and record["artist"]:
                out.append(record)
    return out


HARVESTERS = {"wikimedia-commons": harvest_commons, "internet-archive": harvest_archive, "ccmixter": harvest_ccmixter}


def quality_score(record: dict) -> int:
    score = 35
    score += 8 if record.get("title") else 0
    score += 8 if record.get("artist") else 0
    score += 6 if record.get("album") else 0
    score += 12 if any(row.get("provider_sha1") or row.get("provider_md5") for row in record.get("files") or []) else 0
    score += {"CC0": 10, "PUBLIC-DOMAIN": 10, "CC-BY": 8, "CC-BY-SA": 7}.get((record.get("license") or {}).get("spdx"), 0)
    score += {"wikimedia-commons": 7, "ccmixter": 6, "internet-archive": 5}.get(record.get("provider"), 0)
    return score


def candidate_id(record: dict) -> str:
    raw = f"{record.get('provider')}|{record.get('provider_id')}|{record.get('title')}|{record.get('artist')}"
    return "openmusic:" + hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


def dedupe(records: list[dict]) -> list[dict]:
    chosen = {}
    for record in records:
        if not record.get("license", {}).get("spdx") in ALLOWED or not record.get("files"):
            continue
        key = (record.get("provider"), record.get("provider_id") or record.get("source_url"))
        current = chosen.get(key)
        if current is None or quality_score(record) > quality_score(current):
            record["playlist_matches"] = list((current or {}).get("playlist_matches") or [])
            chosen[key] = record
        target = chosen[key]
        match = {"playlist_id": record.get("playlist_id"), "matched_query": record.get("matched_query")}
        if match not in target.setdefault("playlist_matches", []):
            target["playlist_matches"].append(match)
    return list(chosen.values())


def run_job(provider: str, playlist: dict, query: str):
    try:
        return provider, playlist["id"], query, HARVESTERS[provider](playlist, query), None
    except Exception as exc:
        return provider, playlist["id"], query, [], clean(exc, 900)


def validate_record(record: dict) -> bool:
    return bool(
        record.get("license", {}).get("spdx") in ALLOWED
        and record.get("license", {}).get("redistribution") is True
        and clean(record.get("license", {}).get("evidence"), 1800)
        and clean(record.get("source_url"), 1800)
        and record.get("files")
        and all(clean(row.get("url"), 1800) for row in record.get("files") or [])
    )


def build_outputs(records: list[dict], failures: list[dict], config: dict) -> dict:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    built_at = now_iso()
    records = [row for row in dedupe(records) if validate_record(row)]
    for record in records:
        record["candidate_id"] = candidate_id(record)
        record["quality_score"] = quality_score(record)
    records.sort(key=lambda row: (-row["quality_score"], row["provider"], row["title"].lower()))

    lookup = {}
    for record in records:
        for match in record.get("playlist_matches") or [{"playlist_id": record.get("playlist_id"), "matched_query": record.get("matched_query")}]:
            pid = match.get("playlist_id")
            if pid:
                lookup.setdefault(pid, []).append(record)

    per_playlist = max(1, min(100, int(config.get("daily_batch_per_playlist") or 20)))
    batch = []
    seen = set()
    for playlist in config.get("playlists") or []:
        for record in lookup.get(playlist["id"], [])[:per_playlist]:
            key = (playlist["id"], record["candidate_id"])
            if key in seen:
                continue
            seen.add(key)
            batch.append({
                "candidate_id": record["candidate_id"], "playlist_id": playlist["id"], "title": record["title"], "artist": record["artist"],
                "album": record.get("album", ""), "provider": record["provider"], "provider_id": record["provider_id"], "source_url": record["source_url"],
                "matched_query": next((m.get("matched_query") for m in record.get("playlist_matches", []) if m.get("playlist_id") == playlist["id"]), record.get("matched_query")),
                "license": record["license"], "files": record["files"], "attribution": record["attribution"], "quality_score": record["quality_score"],
                "governance_state": "anarchadia-nomination-candidate", "spotify_required": False, "rights_gate": "passed-explicit-redistribution",
            })

    policy = {
        "schema": "civweave.open-music-policy.v1", "built_at": built_at,
        "accepted_licenses": sorted(ALLOWED),
        "excluded_classes": ["CC-BY-NC", "CC-BY-ND", "CC-BY-NC-SA", "CC-BY-NC-ND", "custom", "unknown", "all-rights-reserved", "download-only-without-redistribution-grant"],
        "rule": "A track is omitted entirely unless explicit source evidence permits Civweave redistribution and a direct downloadable audio file is available.",
        "storage": "metadata-and-download-references-only; hubs fetch lazily and compute SHA-256 when the binary enters cache",
        "providers": {"wikimedia-commons": "machine-readable Commons license metadata", "internet-archive": "explicit licenseurl plus downloadable audio", "ccmixter": "Query API restricted to allowlisted Creative Commons/Public Domain classes plus per-result license evidence"},
    }
    catalog = {"schema": "civweave.open-music-catalog.v1", "built_at": built_at, "record_count": len(records), "failure_count": len(failures), "failures": failures, "provider_counts": dict(Counter(row["provider"] for row in records)), "records": records}
    manifest = {"schema": "civweave.open-music-lazy-manifest.v1", "built_at": built_at, "entry_count": len(records), "entries": [{"candidate_id": row["candidate_id"], "title": row["title"], "artist": row["artist"], "source_url": row["source_url"], "license": row["license"], "attribution": row["attribution"], "files": row["files"], "content_hash": None, "hash_state": "compute-sha256-on-cache", "cache_policy": "MESH_REDISTRIBUTABLE_LAZY"} for row in records]}
    daily = {"schema": "civweave.open-music-daily-batch.v1", "built_at": built_at, "candidate_count": len(batch), "candidates": batch}
    summary = {"schema": "civweave.open-music-harvest-summary.v1", "built_at": built_at, "records": len(records), "daily_candidates": len(batch), "providers": dict(Counter(row["provider"] for row in records)), "failures": len(failures)}
    for name, payload in (("policy.json", policy), ("catalog.json", catalog), ("lazy-manifest.json", manifest), ("daily-batch.json", daily), ("summary.json", summary)):
        (OUTPUT_DIR / name).write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return summary


def main() -> None:
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    if set(config.get("accepted_licenses") or []) != ALLOWED:
        raise SystemExit("Open music config must exactly match the code-level redistribution allowlist.")
    playlists = config.get("playlists") or []
    jobs = [(provider, playlist, query) for provider in HARVESTERS for playlist in playlists for query in playlist.get("queries") or []]
    records, failures = [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = [pool.submit(run_job, *job) for job in jobs]
        for future in concurrent.futures.as_completed(futures):
            provider, playlist_id, query, found, error = future.result()
            print(f"{provider:18} {playlist_id:15} {query!r}: {len(found)}")
            records.extend(found)
            if error:
                failures.append({"provider": provider, "playlist_id": playlist_id, "query": query, "error": error})
    summary = build_outputs(records, failures, config)
    if summary["records"] <= 0:
        raise SystemExit("Strict open-music harvest produced no redistributable tracks; refusing to publish an empty refresh.")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
