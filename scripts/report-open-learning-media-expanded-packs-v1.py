#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path("public/downloads/knowledge-schools/open-learning-media")
SUMMARY = ROOT / "summary.json"
LOOKUP = ROOT / "lookup.json"
EXPANSION = Path("config/open-learning-media-pack-expansion-v2.json")

summary = json.loads(SUMMARY.read_text(encoding="utf-8"))
lookup = json.loads(LOOKUP.read_text(encoding="utf-8"))
expansion = json.loads(EXPANSION.read_text(encoding="utf-8"))
pack_stats = summary.get("packs") or {}
topic_stats = summary.get("topic_stats") or summary.get("focus_topics") or {}
lookup_topics = lookup.get("topics") or {}

print("\n=== Expanded Open Learning Media pack inspection ===")
for pack in expansion.get("packs") or []:
    slug = pack["slug"]
    stats = pack_stats.get(slug) or {}
    print(
        f"PACK {slug} | {pack['name']} | available={stats.get('available')} "
        f"coverage={stats.get('coverage')} records={stats.get('records')}"
    )
    for topic_slug in pack.get("topics") or []:
        topic = topic_stats.get(topic_slug) or {}
        records = lookup_topics.get(topic_slug) or []
        print(
            f"  TOPIC {topic_slug}: curated={topic.get('records', 0)} "
            f"downloadable={topic.get('mesh_redistributable', 0)}"
        )
        for record in records[:8]:
            license_id = str((record.get("license") or {}).get("spdx") or "")
            print(f"    - [{license_id}] {record.get('title') or '(untitled)'}")
print("=== end expanded pack inspection ===\n")
