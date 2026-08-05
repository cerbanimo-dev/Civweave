#!/usr/bin/env python3
"""Run Seed 1 from the audited 1,001-title spine and refresh current article revisions."""
from __future__ import annotations

import urllib.parse
from pathlib import Path

import build_seed1 as seed

MANIFEST_DIR = Path(__file__).with_name("manifest")


def fetch_audited_manifest():
    parts = sorted(MANIFEST_DIR.glob("seed1-titles-part*.txt"))
    if not parts:
        raise RuntimeError("No plain-text Seed 1 manifest shards were found")
    manifest_bytes = b"".join(path.read_bytes() for path in parts)
    titles = []
    for path in parts:
        titles.extend(path.read_text(encoding="utf-8").splitlines())
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
    if len(selections) != 1001:
        raise RuntimeError(f"Pinned manifest decoded to {len(selections)} unique titles; expected exactly 1,001")
    return selections, {
        "selection_url": seed.SELECTION_URL,
        "selection_method": "audited 1,001-title Wikipedia Vital Articles Level 3 manifest; article bodies and revision metadata refreshed at build time",
        "manifest_files": [str(path.relative_to(Path.cwd())) for path in parts],
        "manifest_sha256": seed.sha256_bytes(manifest_bytes),
        "retrieved_at": seed.now_iso(),
        "parsed_count": len(selections),
    }


seed.fetch_vital_list = fetch_audited_manifest
raise SystemExit(seed.main())
