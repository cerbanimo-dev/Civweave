#!/usr/bin/env python3
"""Materialize a browser-sized current YouTube availability index from the API sidecar."""
from __future__ import annotations

import gzip
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("public/downloads/knowledge-schools/video-atlases")
LOOKUP = ROOT / "lookup.json"
CATALOG = ROOT / "catalog.json"
SIDECAR = ROOT / "youtube-metadata-current.json.gz"
OUTPUT = ROOT / "youtube-availability-current.json"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main():
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    lookup = json.loads(LOOKUP.read_text(encoding="utf-8"))
    all_ids = sorted({str(row.get("video_id") or "").strip() for row in lookup.get("records", []) if row.get("video_id")})

    if not SIDECAR.exists():
        payload = {
            "schema": "civweave.youtube-availability-index.v1",
            "status": "not-available",
            "built_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            "catalog_video_ids": len(all_ids),
            "eligible_video_ids": [],
            "ineligible_video_ids": [],
            "reason": "No current YouTube metadata sidecar is present; resolver must not treat this as an exclusion list.",
        }
    else:
        compressed = SIDECAR.read_bytes()
        sidecar = json.loads(gzip.decompress(compressed))
        records = sidecar.get("records") or {}
        eligible = sorted(
            video_id for video_id, row in records.items()
            if bool(row.get("embeddable")) and str(row.get("privacy_status") or "").lower() == "public"
        )
        eligible_set = set(eligible)
        ineligible = sorted(video_id for video_id in all_ids if video_id not in eligible_set)
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
            "eligible_count": len(eligible),
            "ineligible_count": len(ineligible),
            "eligible_video_ids": eligible,
            "ineligible_video_ids": ineligible,
        }

    raw = (json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")
    OUTPUT.write_bytes(raw)
    print(json.dumps({
        "output": str(OUTPUT),
        "status": payload["status"],
        "eligible": len(payload.get("eligible_video_ids") or []),
        "ineligible": len(payload.get("ineligible_video_ids") or []),
        "bytes": len(raw),
        "sha256": sha256(raw),
    }, indent=2))


if __name__ == "__main__":
    main()
