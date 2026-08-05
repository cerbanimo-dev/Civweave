#!/usr/bin/env python3
"""Run Seed 1 from the audited 1,001-title spine and refresh current article revisions."""
from __future__ import annotations

import base64
import gzip
import json
import urllib.parse
from pathlib import Path

import build_seed1 as seed

MANIFEST = Path(__file__).with_name("manifest") / "seed1-titles.json.gz.b64"


def fetch_audited_manifest():
    encoded = MANIFEST.read_text(encoding="ascii").strip()
    raw = gzip.decompress(base64.b64decode(encoded))
    titles = json.loads(raw.decode("utf-8"))
    selections = []
    seen = set()
    for title in titles:
        title = seed.normalize_ws(str(title).replace("_", " "))
        if not title or title in seen:
            continue
        seen.add(title)
        selections.append(seed.Selection(
            ordinal=len(selections) + 1,
            title=title,
            domain="General studies",
            subdomain="",
            source_url="https://en.wikipedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_")),
        ))
    if not 950 <= len(selections) <= 1050:
        raise RuntimeError(f"Pinned manifest decoded to {len(selections)} titles; expected approximately 1,000")
    return selections, {
        "selection_url": seed.SELECTION_URL,
        "selection_method": "audited 1,001-title Wikipedia Vital Articles Level 3 manifest; article bodies and revision metadata refreshed at build time",
        "manifest_file": str(MANIFEST.relative_to(Path.cwd())),
        "manifest_sha256": seed.sha256_bytes(raw),
        "retrieved_at": seed.now_iso(),
        "parsed_count": len(selections),
    }


seed.fetch_vital_list = fetch_audited_manifest
raise SystemExit(seed.main())
