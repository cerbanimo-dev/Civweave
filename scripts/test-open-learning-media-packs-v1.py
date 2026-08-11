#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path("public/downloads/knowledge-schools/open-learning-media")
REGISTRY = json.loads(Path("config/open-learning-media-packs-v1.json").read_text(encoding="utf-8"))
SUMMARY = json.loads((ROOT / "summary.json").read_text(encoding="utf-8"))
LOOKUP = json.loads((ROOT / "lookup.json").read_text(encoding="utf-8"))
PACKS = json.loads((ROOT / "packs.json").read_text(encoding="utf-8"))
INSTALLER_HTML = Path("public/app/index.html").read_text(encoding="utf-8")
CACHE_RUNTIME = Path("public/app/open-learning-media-cache-v1.mjs").read_text(encoding="utf-8")

ALLOWED_LICENSES = {"PUBLIC-DOMAIN", "CC0", "CC-BY", "CC-BY-SA"}
PUBLISHED_METADATA = {
    "catalog.json",
    "lookup.json",
    "packs.json",
    "summary.json",
    "harvest-policy.json",
    "revocations.json",
    "relevance-audit.json",
    "pedagogy-audit.json",
    "selection-audit.json",
    "title-quality-audit.json",
}

for filename in PUBLISHED_METADATA:
    assert (ROOT / filename).is_file(), filename

assert "data-lazy-offline-tools" in INSTALLER_HTML
assert "module.src='/app/open-learning-media-installer-v1.mjs?v=general-knowledge-packs-v1';" in INSTALLER_HTML
assert "const LOOKUP_URL='/downloads/knowledge-schools/open-learning-media/lookup.json';" in CACHE_RUNTIME
assert "const POLICY_URL='/downloads/knowledge-schools/open-learning-media/harvest-policy.json';" in CACHE_RUNTIME
assert "const REVOCATIONS_URL='/downloads/knowledge-schools/open-learning-media/revocations.json';" in CACHE_RUNTIME

def downloadable(record: dict) -> bool:
    license_id = str((record.get("license") or {}).get("spdx") or "").upper()
    if record.get("cache_policy") != "MESH_REDISTRIBUTABLE" or license_id not in ALLOWED_LICENSES:
        return False
    for file in record.get("files") or []:
        url = str(file.get("url") or "")
        mime = str(file.get("mime") or "").lower()
        resolution = str(file.get("resolution") or "").lower()
        parsed = urlparse(url)
        if parsed.scheme == "https" and parsed.netloc and mime.startswith("video/") and "audio" not in resolution and int(file.get("bytes") or 0) > 0:
            return True
    return False

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
    assert any(downloadable(record) for record in LOOKUP["topics"][slug]), f"{slug}: no downloader-ready media file"

configured_packs = {pack["slug"]: pack for pack in REGISTRY["packs"]}
published_packs = {pack["slug"]: pack for pack in PACKS["packs"]}
lookup_packs = {pack["slug"]: pack for pack in LOOKUP["packs"]}
assert set(configured_packs) == set(published_packs) == set(lookup_packs)
assert {"general-knowledge","digital-ai-literacy","practical-life","maker-creative","civic-media-literacy","deep-science","humanities-culture"} <= set(published_packs)

for slug, pack in published_packs.items():
    assert pack["topics"], slug
    assert 0 <= float(pack["coverage"]) <= 1
    assert pack["available"] is True, slug
    assert lookup_packs[slug]["topics"] == pack["topics"], slug
    downloadable_topics = sum(
        1 for topic_slug in pack["topics"]
        if any(downloadable(record) for record in LOOKUP["topics"].get(topic_slug, []))
    )
    actual_coverage = downloadable_topics / len(pack["topics"])
    assert actual_coverage + 0.0001 >= float(pack["coverage"]), (slug, actual_coverage, pack["coverage"])

general = published_packs["general-knowledge"]
assert general["default"] is True
assert len(general["topics"]) >= 12
assert float(general["coverage"]) == 1.0

practical = published_packs["practical-life"]
assert set(practical["topics"]) == {
    "personal-finance",
    "cooking-food-safety",
    "health-wellness",
    "computing-basics",
    "statistics-data-literacy",
}
assert "emergency-preparedness" not in practical["topics"]

creative = published_packs["maker-creative"]
assert creative["name"] == "Creative Studio"
assert set(creative["topics"]) == {"arts-culture", "drawing-design", "photography-video"}

downloader_ready = sum(
    1 for records in LOOKUP["topics"].values() for record in records if downloadable(record)
)
assert downloader_ready > 0

print(json.dumps({
    "topics": len(topics),
    "required_topics": len(required),
    "packs": {slug: {"topics": len(pack["topics"]), "coverage": pack["coverage"]} for slug, pack in published_packs.items()},
    "records": SUMMARY["records"],
    "mesh_redistributable": SUMMARY["mesh_redistributable"],
    "downloader_ready_records": downloader_ready,
    "installer_wired": True,
}, indent=2))
