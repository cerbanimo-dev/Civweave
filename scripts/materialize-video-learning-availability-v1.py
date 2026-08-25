#!/usr/bin/env python3
"""Materialize a browser-sized YouTube availability index with a real embed probe.

The YouTube Data API `embeddable` bit is necessary but not sufficient for Civweave.
This materializer also requests the privacy-enhanced iframe endpoint with Civweave's
origin/referrer and rejects responses that are unavailable or carry frame-blocking
headers. The browser may therefore describe a row as "privacy-enhanced embed verified"
only when this stronger check passed during the current refresh window.
"""
from __future__ import annotations

import gzip
import hashlib
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(os.environ.get(
    "VIDEO_ATLAS_OUTPUT_DIR",
    "public/downloads/knowledge-schools/video-atlases",
))
LOOKUP = ROOT / "lookup.json"
CATALOG = ROOT / "catalog.json"
SIDECAR = ROOT / "youtube-metadata-current.json.gz"
OUTPUT = ROOT / "youtube-availability-current.json"
EMBED_ORIGIN = os.environ.get("VIDEO_ATLAS_EMBED_ORIGIN", "https://civweave.cc").rstrip("/")
PROBE_WORKERS = max(2, min(int(os.environ.get("VIDEO_ATLAS_EMBED_PROBE_WORKERS", "8")), 24))
PROBE_TIMEOUT = max(4, min(int(os.environ.get("VIDEO_ATLAS_EMBED_PROBE_TIMEOUT", "12")), 30))
USER_AGENT = "Civweave-Video-Embed-Probe/1.0 (+https://github.com/cerbanimo-dev/Civweave)"
VERIFY_MODE = "youtube-data-api+privacy-enhanced-embed-probe"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def write_sums():
    sums = []
    for path in sorted(ROOT.iterdir()):
        if path.is_file() and path.name != "SHA256SUMS":
            sums.append(f"{sha256(path.read_bytes())}  {path.name}")
    (ROOT / "SHA256SUMS").write_text("\n".join(sums) + "\n", encoding="utf-8")


def frame_ancestors_blocks(csp: str) -> bool:
    if not csp:
        return False
    for policy in csp.split(","):
        match = re.search(r"(?:^|;)\s*frame-ancestors\s+([^;]+)", policy, flags=re.I)
        if not match:
            continue
        sources = {token.strip().lower() for token in match.group(1).split() if token.strip()}
        if "'none'" in sources:
            return True
        if sources == {"'self'"}:
            return True
    return False


def playability_status(body: str) -> str:
    normalized = body.replace('\\"', '"')
    match = re.search(
        r'"playabilityStatus"\s*:\s*\{\s*"status"\s*:\s*"([A-Z_]+)"',
        normalized,
    )
    return match.group(1) if match else ""


def probe_embed(video_id: str):
    query = urllib.parse.urlencode({
        "enablejsapi": "1",
        "playsinline": "1",
        "rel": "0",
        "origin": EMBED_ORIGIN,
    })
    url = f"https://www.youtube-nocookie.com/embed/{video_id}?{query}"
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml",
            "Referer": f"{EMBED_ORIGIN}/",
            "Sec-Fetch-Dest": "iframe",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "cross-site",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=PROBE_TIMEOUT) as response:
            status = int(getattr(response, "status", 0) or 0)
            headers = response.headers
            body = response.read(512_000).decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as exc:
        return video_id, False, f"http-{exc.code}"
    except Exception as exc:
        return video_id, False, f"network-{type(exc).__name__.lower()}"

    if status != 200:
        return video_id, False, f"http-{status or 'unknown'}"
    x_frame = str(headers.get("X-Frame-Options") or "").strip().lower()
    if x_frame and ("deny" in x_frame or "sameorigin" in x_frame):
        return video_id, False, "x-frame-options"
    csp = str(headers.get("Content-Security-Policy") or "")
    if frame_ancestors_blocks(csp):
        return video_id, False, "csp-frame-ancestors"
    if len(body) < 1000:
        return video_id, False, "empty-embed-response"
    playback = playability_status(body)
    if playback and playback != "OK":
        return video_id, False, f"playability-{playback.lower()}"
    return video_id, True, "ok"


def api_candidate(row: dict) -> bool:
    if not bool(row.get("embeddable")):
        return False
    privacy = str(row.get("privacy_status") or "").strip().lower()
    return privacy in ("", "public")


def main():
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    lookup = json.loads(LOOKUP.read_text(encoding="utf-8"))
    all_ids = sorted({str(row.get("video_id") or "").strip() for row in lookup.get("records", []) if row.get("video_id")})

    if not SIDECAR.exists():
        built_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
        payload = {
            "schema": "civweave.youtube-availability-index.v1",
            "status": "not-available",
            "built_at": built_at,
            "catalog_video_ids": len(all_ids),
            "eligible_video_ids": [],
            "ineligible_video_ids": [],
            "reason": "No current YouTube metadata sidecar is present; no embed-verification claim can be made.",
        }
    else:
        compressed = SIDECAR.read_bytes()
        sidecar = json.loads(gzip.decompress(compressed))
        records = sidecar.get("records") or {}
        candidates = sorted(video_id for video_id, row in records.items() if api_candidate(row))
        results = {}
        with ThreadPoolExecutor(max_workers=PROBE_WORKERS) as pool:
            future_map = {pool.submit(probe_embed, video_id): video_id for video_id in candidates}
            for future in as_completed(future_map):
                video_id = future_map[future]
                try:
                    _, ok, reason = future.result()
                except Exception as exc:
                    ok, reason = False, f"probe-{type(exc).__name__.lower()}"
                results[video_id] = (ok, reason)

        eligible = sorted(video_id for video_id, result in results.items() if result[0])
        eligible_set = set(eligible)
        ineligible = sorted(video_id for video_id in all_ids if video_id not in eligible_set)
        failures = Counter(reason for ok, reason in results.values() if not ok)
        network_failures = sum(count for reason, count in failures.items() if reason.startswith("network-") or reason in {"http-429", "http-502", "http-503", "http-504"})
        if candidates and not eligible and network_failures >= max(5, len(candidates) // 2):
            raise SystemExit("Embed probe could not verify any candidates because the probe network was unavailable; keeping the previous index is safer than publishing an empty current index.")

        payload = {
            "schema": "civweave.youtube-availability-index.v1",
            "status": "current",
            "built_at": sidecar.get("built_at"),
            "expires_at": sidecar.get("expires_at"),
            "refresh_required_days": sidecar.get("refresh_required_days", 30),
            "source_sidecar_file": SIDECAR.name,
            "source_sidecar_sha256": sha256(compressed),
            "catalog_video_ids": len(all_ids),
            "returned_video_ids": len(records),
            "api_embed_candidates": len(candidates),
            "eligible_count": len(eligible),
            "ineligible_count": len(ineligible),
            "eligible_video_ids": eligible,
            "ineligible_video_ids": ineligible,
            "verification": {
                "mode": VERIFY_MODE,
                "embed_host": "www.youtube-nocookie.com",
                "embed_origin": EMBED_ORIGIN,
                "probe_workers": PROBE_WORKERS,
                "probe_timeout_seconds": PROBE_TIMEOUT,
                "probe_success_count": len(eligible),
                "probe_failure_count": len(candidates) - len(eligible),
                "probe_failure_reasons": dict(sorted(failures.items())),
            },
        }

    raw = (json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")
    OUTPUT.write_bytes(raw)
    catalog["youtube_availability_index"] = {
        "file": OUTPUT.name,
        "status": payload["status"],
        "bytes": len(raw),
        "sha256": sha256(raw),
        "eligible_video_ids": len(payload.get("eligible_video_ids") or []),
        "ineligible_video_ids": len(payload.get("ineligible_video_ids") or []),
        "verification_mode": (payload.get("verification") or {}).get("mode"),
        "built_at": payload.get("built_at"),
        "expires_at": payload.get("expires_at"),
    }
    CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_sums()
    print(json.dumps({
        "output": str(OUTPUT),
        "status": payload["status"],
        "eligible": len(payload.get("eligible_video_ids") or []),
        "ineligible": len(payload.get("ineligible_video_ids") or []),
        "verification": payload.get("verification"),
        "bytes": len(raw),
        "sha256": sha256(raw),
    }, indent=2))


if __name__ == "__main__":
    main()
