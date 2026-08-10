#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path("public/downloads/knowledge-schools/open-learning-media")
REGISTRY = json.loads(Path("config/open-learning-media-packs-v1.json").read_text(encoding="utf-8"))
SUMMARY = json.loads((ROOT / "summary.json").read_text(encoding="utf-8"))
LOOKUP = json.loads((ROOT / "lookup.json").read_text(encoding="utf-8"))
PACKS = json.loads((ROOT / "packs.json").read_text(encoding="utf-8"))

topics = {topic["slug"]: topic for topic in REGISTRY["topics"]}
required = {slug for slug, topic in topics.items() if topic.get("required")}
assert len(topics) >= 30
assert "emergency-preparedness" in topics
assert "first-aid-basics" not in topics
assert required <= set(SUMMARY["topic_stats"])
assert required <= set(LOOKUP["topics"])
assert LOOKUP["pack_registry_revision"] == REGISTRY["revision"]
assert PACKS["revision"] == REGISTRY["revision"]

for slug in required:
    info = SUMMARY["topic_stats"][slug]
    assert info["records"] > 0, slug
    assert info["mesh_redistributable"] > 0, slug
    assert LOOKUP["topics"][slug], slug

configured_packs = {pack["slug"]: pack for pack in REGISTRY["packs"]}
published_packs = {pack["slug"]: pack for pack in PACKS["packs"]}
assert set(configured_packs) == set(published_packs)
assert {"general-knowledge","digital-ai-literacy","practical-life","maker-creative","civic-media-literacy","deep-science","humanities-culture"} <= set(published_packs)

for slug, pack in published_packs.items():
    assert pack["topics"], slug
    assert 0 <= float(pack["coverage"]) <= 1
    assert pack["available"] is True, slug

general = published_packs["general-knowledge"]
assert general["default"] is True
assert len(general["topics"]) >= 12
assert float(general["coverage"]) == 1.0

practical = published_packs["practical-life"]
expected_practical = {
    "personal-finance",
    "cooking-food-safety",
    "health-wellness",
    "computing-basics",
    "statistics-data-literacy",
}
assert set(practical["topics"]) == expected_practical
assert "emergency-preparedness" not in practical["topics"]

print(json.dumps({
    "topics": len(topics),
    "required_topics": len(required),
    "packs": {slug: {"topics": len(pack["topics"]), "coverage": pack["coverage"]} for slug, pack in published_packs.items()},
    "records": SUMMARY["records"],
    "mesh_redistributable": SUMMARY["mesh_redistributable"],
}, indent=2))
