#!/usr/bin/env python3
"""Harvest rights-cleared learning videos for Civweave's local-first media mesh.

This builder is metadata-first: it records provider URLs, explicit license evidence,
and cache candidates, but never downloads audiovisual binaries into the repository.
Nodes compute SHA-256 when a permitted media file actually enters local cache.
"""
from __future__ import annotations

import concurrent.futures
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

OUTPUT_DIR = Path(os.environ.get(
    "OPEN_MEDIA_OUTPUT_DIR",
    "public/downloads/knowledge-schools/open-learning-media",
))
RESULTS_PER_QUERY = max(5, min(int(os.environ.get("OPEN_MEDIA_RESULTS_PER_QUERY", "16")), 50))
MAX_WORKERS = max(1, min(int(os.environ.get("OPEN_MEDIA_WORKERS", "4")), 8))
REQUEST_TIMEOUT = max(10, min(int(os.environ.get("OPEN_MEDIA_TIMEOUT", "35")), 90))
USER_AGENT = "Civweave-Open-Learning-Harvester/1.0 (+https://github.com/cerbanimo-dev/Civweave)"

FOCUS_TOPICS = [
    {
        "slug": "vibe-coding",
        "name": "Vibe Coding",
        "school_slug": "technology",
        "queries": [
            "vibe coding",
            "AI coding assistant",
            "AI pair programming",
            "LLM coding",
            "coding with generative AI",
        ],
        "concepts": ["vibe coding", "AI-assisted programming", "code generation", "software iteration"],
    },
    {
        "slug": "prompt-engineering",
        "name": "Prompt Engineering",
        "school_slug": "technology",
        "queries": [
            "prompt engineering",
            "LLM prompting",
            "prompt design",
            "few shot prompting",
            "AI prompt patterns",
        ],
        "concepts": ["prompt engineering", "LLM prompting", "prompt patterns", "evaluation"],
    },
    {
        "slug": "pseudocoding",
        "name": "Pseudocoding and Algorithm Design",
        "school_slug": "technology",
        "queries": [
            "pseudocode",
            "pseudocode algorithms",
            "algorithm design",
            "programming flowchart",
            "computational thinking",
        ],
        "concepts": ["pseudocode", "algorithms", "flowcharts", "computational thinking"],
    },
    {
        "slug": "critical-thinking",
        "name": "Critical Thinking",
        "school_slug": "philosophy-and-religion",
        "queries": [
            "critical thinking",
            "argument analysis",
            "source evaluation",
            "media literacy",
            "evidence reasoning",
        ],
        "concepts": ["critical thinking", "argument analysis", "source evaluation", "evidence"],
    },
    {
        "slug": "logical-frameworks",
        "name": "Logical Frameworks",
        "school_slug": "philosophy-and-religion",
        "queries": [
            "formal logic",
            "propositional logic",
            "logical reasoning",
            "logical fallacies",
            "decision framework",
            "systems thinking",
        ],
        "concepts": ["formal logic", "logical reasoning", "decision frameworks", "systems thinking"],
    },
]

PEERTUBE_LICENSES = {
    1: ("CC-BY", "Attribution", False),
    2: ("CC-BY-SA", "Attribution - Share Alike", True),
    7: ("CC0", "Public Domain Dedication", False),
    8: ("PUBLIC-DOMAIN", "Free of known copyright restrictions", False),
}
IA_ALLOWED_LICENSES = [
    ("creativecommons.org/publicdomain/zero", "CC0", False),
    ("creativecommons.org/publicdomain/mark", "PUBLIC-DOMAIN", False),
    ("creativecommons.org/licenses/by-sa/", "CC-BY-SA", True),
    ("creativecommons.org/licenses/by/", "CC-BY", False),
]
COMMONS_ALLOWED = [
    (re.compile(r"public\s*domain|public-domain", re.I), "PUBLIC-DOMAIN", False),
    (re.compile(r"\bcc0\b|creative\s*commons\s*zero", re.I), "CC0", False),
    (re.compile(r"\bcc\s*by[-\s]?sa\b|cc-by-sa|attribution-sharealike", re.I), "CC-BY-SA", True),
    (re.compile(r"\bcc\s*by\b|cc-by|attribution(?!.*noncommercial)", re.I), "CC-BY", False),
]
VIDEO_EXTS = {".webm", ".ogv", ".ogg", ".mp4", ".m4v", ".mov", ".mkv"}


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def clean_text(value: Any, limit: int = 800) -> str:
    if value is None:
        return ""
    if isinstance(value, (list, tuple)):
        value = " ".join(str(v) for v in value if v is not None)
    text = html.unescape(re.sub(r"<[^>]+>", " ", str(value)))
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit]


def request_json(url: str, attempts: int = 3) -> dict:
    last = None
    for attempt in range(attempts):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception as exc:
            last = exc
            if attempt + 1 < attempts:
                time.sleep(min(5.0, 0.75 * (2 ** attempt)))
    raise RuntimeError(f"request failed: {url}: {last}")


def host(url: str) -> str:
    try:
        return urllib.parse.urlparse(url).netloc.lower()
    except Exception:
        return ""


def base_record(topic: dict, provider: str, query: str) -> dict:
    return {
        "schema": "civweave.open-learning-media-node.v1",
        "provider": provider,
        "provider_id": "",
        "topic_slug": topic["slug"],
        "topic_name": topic["name"],
        "school_slug": topic["school_slug"],
        "concepts": topic["concepts"],
        "matched_query": query,
        "title": "",
        "description": "",
        "creator": "",
        "language": None,
        "duration_seconds": 0,
        "source_url": "",
        "source_host": "",
        "license": {},
        "cache_policy": "LINK_ONLY",
        "mesh_redistributable": False,
        "download_enabled": False,
        "files": [],
        "content_hash": None,
        "hash_state": "compute-on-cache",
        "attribution": {},
    }


def policy_license(spdx: str, label: str, url: str, evidence: str, share_alike: bool) -> dict:
    return {
        "spdx": spdx,
        "label": label,
        "url": url,
        "evidence": clean_text(evidence, 1000),
        "commercial_use": True,
        "derivatives": True,
        "share_alike": share_alike,
    }


def commons_license(ext: dict) -> dict | None:
    fields = [
        clean_text((ext.get("LicenseShortName") or {}).get("value"), 120),
        clean_text((ext.get("UsageTerms") or {}).get("value"), 180),
        clean_text((ext.get("License") or {}).get("value"), 120),
        clean_text((ext.get("LicenseUrl") or {}).get("value"), 500),
    ]
    haystack = " | ".join(fields)
    if re.search(r"non[-\s]?commercial|no[-\s]?derivatives|\bcc[-\s]?by[-\s]?nc\b|\bcc[-\s]?by[-\s]?nd\b", haystack, re.I):
        return None
    for pattern, spdx, share_alike in COMMONS_ALLOWED:
        if pattern.search(haystack):
            return policy_license(spdx, fields[0] or fields[1] or spdx, fields[3], haystack, share_alike)
    return None


def harvest_commons(topic: dict, query: str) -> list[dict]:
    params = urllib.parse.urlencode({
        "action": "query",
        "generator": "search",
        "gsrsearch": f"{query} filetype:video",
        "gsrnamespace": 6,
        "gsrlimit": RESULTS_PER_QUERY,
        "prop": "imageinfo",
        "iiprop": "url|size|mime|sha1|extmetadata",
        "format": "json",
        "formatversion": 2,
        "origin": "*",
    })
    data = request_json(f"https://commons.wikimedia.org/w/api.php?{params}")
    records = []
    for page in (data.get("query") or {}).get("pages") or []:
        info = ((page.get("imageinfo") or [{}])[0]) or {}
        mime = clean_text(info.get("mime"), 80).lower()
        if not mime.startswith("video/"):
            continue
        ext = info.get("extmetadata") or {}
        lic = commons_license(ext)
        if not lic:
            continue
        title_page = str(page.get("title") or "")
        source_url = clean_text(info.get("descriptionurl"), 1200) or (
            "https://commons.wikimedia.org/wiki/" + urllib.parse.quote(title_page.replace(" ", "_"))
        )
        file_url = clean_text(info.get("url"), 1500)
        record = base_record(topic, "wikimedia-commons", query)
        record.update({
            "provider_id": title_page,
            "title": clean_text((ext.get("ObjectName") or {}).get("value") or re.sub(r"^File:", "", title_page), 260),
            "description": clean_text((ext.get("ImageDescription") or {}).get("value"), 1800),
            "creator": clean_text((ext.get("Artist") or {}).get("value"), 300),
            "source_url": source_url,
            "source_host": "commons.wikimedia.org",
            "license": lic,
            "cache_policy": "MESH_REDISTRIBUTABLE",
            "mesh_redistributable": True,
            "download_enabled": bool(file_url),
            "files": [{
                "url": file_url,
                "mime": mime,
                "bytes": int(info.get("size") or 0),
                "provider_sha1": clean_text(info.get("sha1"), 80) or None,
                "role": "original",
            }] if file_url else [],
        })
        record["attribution"] = {
            "creator": record["creator"],
            "source_title": record["title"],
            "source_url": source_url,
            "license": lic["label"],
            "license_url": lic["url"],
        }
        if record["files"]:
            records.append(record)
    return records


def parse_peertube_license(value: Any) -> dict | None:
    raw_id = value.get("id") if isinstance(value, dict) else value
    try:
        license_id = int(raw_id)
    except Exception:
        return None
    value = PEERTUBE_LICENSES.get(license_id)
    if not value:
        return None
    spdx, label, share_alike = value
    return {"id": license_id, "license": policy_license(spdx, label, "", f"PeerTube API licence id {license_id}: {label}", share_alike)}


def peertube_detail(source_url: str, uuid: str) -> dict:
    parsed = urllib.parse.urlparse(source_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return {}
    try:
        return request_json(f"{parsed.scheme}://{parsed.netloc}/api/v1/videos/{urllib.parse.quote(uuid)}", attempts=2)
    except Exception:
        return {}


def peertube_files(detail: dict) -> list[dict]:
    out, seen = [], set()
    def add(obj: dict, role: str):
        url = clean_text(obj.get("fileDownloadUrl") or obj.get("fileUrl") or obj.get("url"), 1600)
        if not url or url in seen:
            return
        seen.add(url)
        out.append({
            "url": url,
            "bytes": int(obj.get("size") or 0),
            "resolution": clean_text((obj.get("resolution") or {}).get("label"), 80),
            "fps": obj.get("fps"),
            "role": role,
        })
    for obj in detail.get("files") or []:
        if isinstance(obj, dict):
            add(obj, "web-video")
    for playlist in detail.get("streamingPlaylists") or []:
        if not isinstance(playlist, dict):
            continue
        for obj in playlist.get("files") or []:
            if isinstance(obj, dict):
                add(obj, "streaming-file")
    return out


def harvest_peertube(topic: dict, query: str) -> list[dict]:
    params = [
        ("search", query),
        ("count", str(RESULTS_PER_QUERY)),
        ("nsfw", "false"),
        ("sort", "-publishedAt"),
    ]
    for license_id in sorted(PEERTUBE_LICENSES):
        params.append(("licenceOneOf", str(license_id)))
    data = request_json("https://sepiasearch.org/api/v1/search/videos?" + urllib.parse.urlencode(params))
    records = []
    for item in data.get("data") or []:
        parsed_license = parse_peertube_license(item.get("licence"))
        uuid = clean_text(item.get("uuid"), 100)
        source_url = clean_text(item.get("url"), 1200)
        if not parsed_license or not uuid or not source_url:
            continue
        detail = peertube_detail(source_url, uuid)
        detail_license = parse_peertube_license(detail.get("licence")) if detail else None
        if detail_license:
            parsed_license = detail_license
        download_enabled = bool(detail.get("downloadEnabled")) if detail else False
        files = peertube_files(detail) if download_enabled else []
        record = base_record(topic, "peertube", query)
        record.update({
            "provider_id": uuid,
            "title": clean_text(item.get("name") or detail.get("name"), 260),
            "description": clean_text(item.get("description") or detail.get("description"), 1800),
            "creator": clean_text(
                ((item.get("account") or {}).get("displayName"))
                or ((item.get("channel") or {}).get("displayName"))
                or ((detail.get("account") or {}).get("displayName")), 300),
            "language": clean_text(((item.get("language") or {}).get("id")), 40) or None,
            "duration_seconds": int(item.get("duration") or detail.get("duration") or 0),
            "source_url": source_url,
            "source_host": host(source_url),
            "license": parsed_license["license"],
            "cache_policy": "MESH_REDISTRIBUTABLE" if files else "LINK_ONLY",
            "mesh_redistributable": bool(files),
            "download_enabled": bool(files),
            "files": files,
        })
        record["attribution"] = {
            "creator": record["creator"],
            "source_title": record["title"],
            "source_url": source_url,
            "license": record["license"]["label"],
            "license_url": "",
        }
        records.append(record)
    return records


def ia_license(url: Any) -> dict | None:
    license_url = clean_text(url, 600)
    lowered = license_url.lower()
    for needle, spdx, share_alike in IA_ALLOWED_LICENSES:
        if needle in lowered:
            return policy_license(spdx, spdx, license_url, f"Internet Archive metadata licenseurl={license_url}", share_alike)
    return None


def ia_files(identifier: str, metadata: dict) -> list[dict]:
    out = []
    for obj in metadata.get("files") or []:
        if not isinstance(obj, dict):
            continue
        name = clean_text(obj.get("name"), 1000)
        if not name or Path(name.lower()).suffix not in VIDEO_EXTS:
            continue
        quoted = urllib.parse.quote(name, safe="/()!$&'*,;=:@-._~")
        size = str(obj.get("size") or "")
        out.append({
            "url": f"https://archive.org/download/{urllib.parse.quote(identifier)}/{quoted}",
            "bytes": int(size) if size.isdigit() else 0,
            "provider_sha1": clean_text(obj.get("sha1"), 80) or None,
            "provider_md5": clean_text(obj.get("md5"), 80) or None,
            "format": clean_text(obj.get("format"), 120),
            "role": "original" if clean_text(obj.get("source"), 40).lower() == "original" else "derivative",
        })
    out.sort(key=lambda item: (0 if item["role"] == "original" else 1, item.get("bytes") or 0))
    return out[:6]


def harvest_archive(topic: dict, query: str) -> list[dict]:
    q = f'(\"{query}\") AND mediatype:movies AND licenseurl:*'
    params = urllib.parse.urlencode([
        ("q", q),
        ("fl[]", "identifier"),
        ("fl[]", "title"),
        ("fl[]", "description"),
        ("fl[]", "creator"),
        ("fl[]", "licenseurl"),
        ("fl[]", "language"),
        ("rows", str(RESULTS_PER_QUERY)),
        ("page", "1"),
        ("output", "json"),
    ])
    data = request_json(f"https://archive.org/advancedsearch.php?{params}")
    records = []
    for item in ((data.get("response") or {}).get("docs") or []):
        lic = ia_license(item.get("licenseurl"))
        identifier = clean_text(item.get("identifier"), 500)
        if not lic or not identifier:
            continue
        try:
            full = request_json(f"https://archive.org/metadata/{urllib.parse.quote(identifier)}", attempts=2)
        except Exception:
            full = {}
        meta = full.get("metadata") or {}
        if meta.get("licenseurl"):
            detail_license = ia_license(meta.get("licenseurl"))
            if not detail_license:
                continue
            lic = detail_license
        files = ia_files(identifier, full) if full else []
        source_url = f"https://archive.org/details/{urllib.parse.quote(identifier)}"
        record = base_record(topic, "internet-archive", query)
        record.update({
            "provider_id": identifier,
            "title": clean_text(item.get("title") or meta.get("title"), 260),
            "description": clean_text(item.get("description") or meta.get("description"), 1800),
            "creator": clean_text(item.get("creator") or meta.get("creator"), 300),
            "language": clean_text(item.get("language") or meta.get("language"), 40) or None,
            "source_url": source_url,
            "source_host": "archive.org",
            "license": lic,
            "cache_policy": "MESH_REDISTRIBUTABLE" if files else "LINK_ONLY",
            "mesh_redistributable": bool(files),
            "download_enabled": bool(files),
            "files": files,
        })
        record["attribution"] = {
            "creator": record["creator"],
            "source_title": record["title"],
            "source_url": source_url,
            "license": lic["label"],
            "license_url": lic["url"],
        }
        records.append(record)
    return records


HARVESTERS = {
    "wikimedia-commons": harvest_commons,
    "peertube": harvest_peertube,
    "internet-archive": harvest_archive,
}


def quality_score(record: dict) -> int:
    score = 8 if record.get("title") else 0
    score += 6 if record.get("description") else 0
    score += 3 if record.get("creator") else 0
    score += 2 if record.get("duration_seconds") else 0
    score += 30 if record.get("mesh_redistributable") else 0
    score += 16 if record.get("download_enabled") else 0
    score += 12 if record.get("files") else 0
    score += {"CC0": 8, "PUBLIC-DOMAIN": 8, "CC-BY": 6, "CC-BY-SA": 5}.get((record.get("license") or {}).get("spdx"), 0)
    score += {"wikimedia-commons": 8, "peertube": 5, "internet-archive": 4}.get(record.get("provider"), 0)
    return score


def dedupe(records: list[dict]) -> list[dict]:
    merged = {}
    for record in records:
        key = f"{record.get('provider')}:{record.get('provider_id') or record.get('source_url')}"
        current = merged.get(key)
        if current is None or quality_score(record) > quality_score(current):
            old_matches = (current or {}).get("topic_matches", [])
            merged[key] = record
            merged[key]["topic_matches"] = old_matches
        chosen = merged[key]
        match = {"topic_slug": record.get("topic_slug"), "matched_query": record.get("matched_query"), "school_slug": record.get("school_slug")}
        if match not in chosen.setdefault("topic_matches", []):
            chosen["topic_matches"].append(match)
    return list(merged.values())


def run_job(provider: str, topic: dict, query: str):
    try:
        return provider, topic["slug"], query, HARVESTERS[provider](topic, query), None
    except Exception as exc:
        return provider, topic["slug"], query, [], clean_text(exc, 700)


def build_outputs(records: list[dict], failures: list[dict]) -> dict:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    built_at = now_iso()
    records = dedupe(records)
    records.sort(key=lambda r: (r.get("topic_slug") or "", -quality_score(r), r.get("provider") or "", (r.get("title") or "").lower()))
    for record in records:
        record["quality_score"] = quality_score(record)

    focus_stats = {}
    for topic in FOCUS_TOPICS:
        subset = [r for r in records if r.get("topic_slug") == topic["slug"] or any(m.get("topic_slug") == topic["slug"] for m in r.get("topic_matches", []))]
        focus_stats[topic["slug"]] = {
            "name": topic["name"],
            "school_slug": topic["school_slug"],
            "queries": topic["queries"],
            "concepts": topic["concepts"],
            "records": len(subset),
            "mesh_redistributable": sum(1 for r in subset if r.get("mesh_redistributable")),
            "providers": dict(Counter(r.get("provider") for r in subset)),
        }

    provider_stats = {}
    for provider in HARVESTERS:
        subset = [r for r in records if r.get("provider") == provider]
        provider_stats[provider] = {
            "records": len(subset),
            "mesh_redistributable": sum(1 for r in subset if r.get("mesh_redistributable")),
            "download_candidates": sum(len(r.get("files") or []) for r in subset),
        }

    policy = {
        "schema": "civweave.open-learning-media-harvest-policy.v1",
        "built_at": built_at,
        "principle": "Explicit redistribution evidence is required before Civweave labels media mesh-redistributable.",
        "accepted_default_licenses": ["PUBLIC-DOMAIN", "CC0", "CC-BY", "CC-BY-SA"],
        "excluded_default_classes": ["CC-BY-NC", "CC-BY-ND", "CC-BY-NC-SA", "CC-BY-NC-ND", "custom", "unknown", "all-rights-reserved"],
        "provider_rules": {
            "wikimedia-commons": "Require Commons machine-readable metadata matching the conservative allowlist.",
            "peertube": "Require PeerTube licence id 1, 2, 7, or 8. Mesh caching additionally requires downloadEnabled and a provider file URL.",
            "internet-archive": "Require explicit item licenseurl matching CC0/Public Domain/CC BY/CC BY-SA and a downloadable video file.",
        },
        "hashing": "SHA-256 is computed by the node when a media binary enters local cache; provider hashes are retained as provenance hints.",
        "youtube": "YouTube audiovisual binaries remain LINK_ONLY and are not harvested into this redistributable cache.",
    }

    catalog = {
        "schema": "civweave.open-learning-media-catalog.v1",
        "built_at": built_at,
        "record_count": len(records),
        "mesh_redistributable_count": sum(1 for r in records if r.get("mesh_redistributable")),
        "download_candidate_count": sum(len(r.get("files") or []) for r in records),
        "providers": provider_stats,
        "focus_topics": focus_stats,
        "failure_count": len(failures),
        "failures": failures,
        "records": records,
    }

    lookup = {}
    for record in records:
        if not record.get("mesh_redistributable"):
            continue
        slugs = {record.get("topic_slug")}
        slugs.update(m.get("topic_slug") for m in record.get("topic_matches", []))
        for slug in sorted(x for x in slugs if x):
            lookup.setdefault(slug, []).append({
                "provider": record["provider"],
                "provider_id": record["provider_id"],
                "title": record["title"],
                "description": record["description"],
                "source_url": record["source_url"],
                "cache_policy": record["cache_policy"],
                "license": record["license"],
                "files": record["files"],
                "quality_score": record["quality_score"],
                "content_hash": record["content_hash"],
                "hash_state": record["hash_state"],
                "attribution": record["attribution"],
            })
    for slug in lookup:
        lookup[slug].sort(key=lambda r: (-int(r.get("quality_score") or 0), r.get("title") or ""))

    summary = {
        "schema": "civweave.open-learning-media-harvest-summary.v1",
        "built_at": built_at,
        "records": catalog["record_count"],
        "mesh_redistributable": catalog["mesh_redistributable_count"],
        "download_candidates": catalog["download_candidate_count"],
        "providers": provider_stats,
        "focus_topics": focus_stats,
        "failures": len(failures),
    }

    outputs = {
        "catalog.json": catalog,
        "lookup.json": {"schema": "civweave.open-learning-media-lookup.v1", "built_at": built_at, "topics": lookup},
        "harvest-policy.json": policy,
        "summary.json": summary,
    }
    for name, payload in outputs.items():
        (OUTPUT_DIR / name).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return summary


def main() -> None:
    jobs = [(provider, topic, query) for provider in HARVESTERS for topic in FOCUS_TOPICS for query in topic["queries"]]
    print(f"Open Learning Harvester: {len(jobs)} source/topic queries, {MAX_WORKERS} workers.")
    records, failures = [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = [pool.submit(run_job, *job) for job in jobs]
        for future in concurrent.futures.as_completed(futures):
            provider, topic_slug, query, found, error = future.result()
            print(f"{provider:18} {topic_slug:20} {query!r}: {len(found)}")
            records.extend(found)
            if error:
                failures.append({"provider": provider, "topic_slug": topic_slug, "query": query, "error": error})
    summary = build_outputs(records, failures)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if summary["records"] <= 0 or summary["mesh_redistributable"] <= 0:
        raise SystemExit("Harvest produced no usable open-media records.")
    missing = [slug for slug, info in summary["focus_topics"].items() if int(info.get("records") or 0) <= 0]
    if missing:
        raise SystemExit("Required focus topics produced zero references: " + ", ".join(missing))


if __name__ == "__main__":
    main()
