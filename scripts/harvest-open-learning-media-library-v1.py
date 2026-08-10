#!/usr/bin/env python3
"""Harvest the expanded Civweave Open Learning Media library from the pack registry."""
from __future__ import annotations

import concurrent.futures
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATH = ROOT / "config/open-learning-media-packs-v1.json"
LEGACY_PATH = ROOT / "scripts/harvest-open-learning-media-v1.py"

# Discovery-only refinements for subjects where broad search phrases produce too much
# topical material and too little explicit teaching material. The canonical concepts,
# aliases, pack membership, and quality gates remain registry-driven.
DISCOVERY_REFINEMENTS = {
    "earth-geography": [
        "map reading educational film",
        "map reading land navigation",
        "world geography educational video",
        "physical geography educational video",
        "free maps free knowledge",
        "open mapping geography",
    ],
    "biology-life": [
        "cell biology educational film",
        "biology educational film",
        "genetics biology educational film",
        "molecular biology lesson",
        "ecology biology educational video",
    ],
    "civics-society": [
        "civics lesson government",
        "government explained civics",
        "democracy civics lesson",
        "parliament government introduction",
    ],
    "arts-culture": [
        "Baroque Art Rembrandt",
        "art history documentary",
        "art history course",
        "visual arts tutorial",
        "Krita digital painting tutorial",
    ],
}

def load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def main() -> None:
    registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    topics = list(registry.get("topics") or [])
    if not topics:
        raise SystemExit("Open Learning Media pack registry contains no topics.")
    slugs = [t.get("slug") for t in topics]
    if len(slugs) != len(set(slugs)):
        raise SystemExit("Open Learning Media pack registry contains duplicate topic slugs.")

    for topic in topics:
        refined = DISCOVERY_REFINEMENTS.get(topic.get("slug"))
        if refined:
            topic["queries"] = refined

    legacy = load_module(LEGACY_PATH, "civweave_open_media_harvest_v1")
    legacy.FOCUS_TOPICS = topics
    jobs = [
        (provider, topic, query)
        for provider in legacy.HARVESTERS
        for topic in topics
        for query in topic.get("queries") or []
    ]
    print(f"Open Learning Library: {len(topics)} topics, {len(jobs)} source/topic queries, {legacy.MAX_WORKERS} workers.")
    records, failures = [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=legacy.MAX_WORKERS) as pool:
        futures = [pool.submit(legacy.run_job, *job) for job in jobs]
        for future in concurrent.futures.as_completed(futures):
            provider, topic_slug, query, found, error = future.result()
            print(f"{provider:18} {topic_slug:24} {query!r}: {len(found)}")
            records.extend(found)
            if error:
                failures.append({"provider": provider, "topic_slug": topic_slug, "query": query, "error": error})

    summary = legacy.build_outputs(records, failures)
    required = {t["slug"] for t in topics if t.get("required")}
    missing = [slug for slug in sorted(required) if int((summary.get("focus_topics", {}).get(slug) or {}).get("records") or 0) <= 0]
    if summary.get("records", 0) <= 0 or summary.get("mesh_redistributable", 0) <= 0:
        raise SystemExit("Harvest produced no usable open-media records.")
    if missing:
        raise SystemExit("Required library topics produced zero discovery references: " + ", ".join(missing))
    print(json.dumps({"topics": len(topics), "required": len(required), "records": summary["records"], "failures": summary["failures"]}, indent=2))

if __name__ == "__main__":
    main()
