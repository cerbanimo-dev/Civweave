#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path("public/downloads/knowledge-schools/open-learning-media")
SUMMARY = ROOT / "summary.json"

if not SUMMARY.is_file():
    raise SystemExit("Open Learning Media summary.json was not generated.")

summary = json.loads(SUMMARY.read_text(encoding="utf-8"))
topics = summary.get("focus_topics") or summary.get("topic_stats") or {}
packs = summary.get("packs") or {}

print("\n=== Open Learning Media pack coverage diagnostics ===")
for slug, pack in packs.items():
    if pack.get("available"):
        continue
    print(f"PACK {slug}: coverage={pack.get('coverage')} records={pack.get('records')} covered={pack.get('covered_topics')}")
    for topic_slug in pack.get("topics") or []:
        topic = topics.get(topic_slug) or {}
        print(
            f"  TOPIC {topic_slug}: records={topic.get('records', 0)} "
            f"mesh_redistributable={topic.get('mesh_redistributable', 0)} "
            f"providers={topic.get('providers', {})}"
        )
        titles = topic.get("top_titles") or []
        if not titles:
            print("    (no curated titles survived)")
        for title in titles[:12]:
            print(f"    - {title}")
print("=== end diagnostics ===\n")
