#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path("public/downloads/knowledge-schools/open-learning-media")
REQUIRED = {"vibe-coding", "prompt-engineering", "pseudocoding", "critical-thinking", "logical-frameworks"}
ALLOWED = {"PUBLIC-DOMAIN", "CC0", "CC-BY", "CC-BY-SA"}

summary = json.loads((ROOT / "summary.json").read_text(encoding="utf-8"))
catalog = json.loads((ROOT / "catalog.json").read_text(encoding="utf-8"))
lookup = json.loads((ROOT / "lookup.json").read_text(encoding="utf-8"))
policy = json.loads((ROOT / "harvest-policy.json").read_text(encoding="utf-8"))

assert summary["records"] == catalog["record_count"] > 0
assert summary["mesh_redistributable"] > 0
assert REQUIRED <= set(summary["focus_topics"])
assert REQUIRED <= set(lookup["topics"])
assert set(policy["accepted_default_licenses"]) == ALLOWED

for slug in REQUIRED:
    info = summary["focus_topics"][slug]
    assert info["records"] > 0, slug
    assert info["mesh_redistributable"] > 0, slug
    assert info["top_titles"], slug
    assert lookup["topics"][slug], slug

for record in catalog["records"]:
    assert record.get("relevance"), record.get("title")
    assert record.get("pedagogy"), record.get("title")
    assert record.get("selection"), record.get("title")
    if record.get("mesh_redistributable"):
        assert record["license"]["spdx"] in ALLOWED, record.get("title")
        assert record.get("download_enabled") is True, record.get("title")
        assert record.get("files"), record.get("title")
        assert record.get("hash_state") == "compute-on-cache", record.get("title")

print(json.dumps({
    "records": summary["records"],
    "mesh_redistributable": summary["mesh_redistributable"],
    "download_candidates": summary["download_candidates"],
    "topics": {slug: summary["focus_topics"][slug]["records"] for slug in sorted(REQUIRED)},
}, indent=2))
