#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "public/downloads/knowledge-schools/open-learning-media/catalog.json"
REGISTRY_PATH = ROOT / "config/open-learning-media-packs-v1.json"
CURATOR_PATH = ROOT / "scripts/curate-open-learning-media-library-v1.py"
TOPIC_SLUG = os.environ.get("OPEN_MEDIA_DIAGNOSTIC_TOPIC", "communication-conflict").strip()


def load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def ready_file(record: dict) -> bool:
    if not record.get("mesh_redistributable"):
        return False
    for file in record.get("files") or []:
        try:
            size = int(file.get("bytes") or 0)
        except (TypeError, ValueError):
            size = 0
        if str(file.get("url") or "").startswith("https://") and str(file.get("mime") or "").lower().startswith("video/") and size > 0:
            return True
    return False


def main() -> None:
    curator = load_module(CURATOR_PATH, "civweave_open_media_curator_diag")
    registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    topics = {row["slug"]: row for row in registry.get("topics") or []}
    topic = topics.get(TOPIC_SLUG)
    if not topic:
        raise SystemExit(f"Unknown diagnostic topic: {TOPIC_SLUG}")

    candidates = []
    for record in catalog.get("records") or []:
        slugs = {record.get("topic_slug")}
        slugs.update(
            row.get("topic_slug") for row in record.get("topic_matches") or []
            if isinstance(row, dict)
        )
        if TOPIC_SLUG not in slugs:
            continue
        title = str(record.get("title") or "")
        desc = str(record.get("description") or "")
        body = f"{title} {desc}"
        aliases = topic.get("aliases") or []
        concepts = topic.get("concepts") or []
        alias_hits = curator.informative_hits(TOPIC_SLUG, aliases, body, title)
        concept_hits = curator.hits(concepts, body)
        score = 10 * len(alias_hits) + 4 * len([x for x in concept_hits if x not in alias_hits])
        threshold = int(topic.get("threshold") or 8)
        relevance_ok = score >= threshold
        educational = bool(curator.EDUCATIONAL.search(body))
        teaching_title = bool(curator.TEACHING_SIGNAL.search(title))
        clickbait = bool(curator.CLICKBAIT.search(title))
        noninstructional = bool(curator.NON_INSTRUCTIONAL.search(title))
        title_hits = curator.informative_hits(TOPIC_SLUG, aliases, title, title)
        desc_hits = curator.informative_hits(TOPIC_SLUG, aliases, desc, title)
        pedagogy_ok = relevance_ok and not clickbait and not noninstructional and educational and bool(title_hits or desc_hits)
        selection_ok = pedagogy_ok and (bool(title_hits) or (bool(desc_hits) and bool(curator.TITLE_INSTRUCTIONAL.search(title))))
        if not relevance_ok:
            stage = "RELEVANCE_REJECT"
        elif not pedagogy_ok:
            stage = "PEDAGOGY_REJECT"
        elif not selection_ok:
            stage = "SELECTION_REJECT"
        elif not ready_file(record):
            stage = "SELECTED_LINK_ONLY"
        else:
            stage = "DOWNLOADER_READY"
        candidates.append((
            0 if stage == "DOWNLOADER_READY" else 1 if stage == "SELECTED_LINK_ONLY" else 2,
            -score,
            title.lower(),
            {
                "stage": stage,
                "title": title,
                "provider": record.get("provider"),
                "matched_query": record.get("matched_query"),
                "creator": record.get("creator"),
                "license": (record.get("license") or {}).get("spdx"),
                "cache_policy": record.get("cache_policy"),
                "mesh_redistributable": bool(record.get("mesh_redistributable")),
                "download_enabled": bool(record.get("download_enabled")),
                "file_count": len(record.get("files") or []),
                "file_ready": ready_file(record),
                "relevance_score": score,
                "alias_hits": alias_hits,
                "concept_hits": concept_hits,
                "educational": educational,
                "teaching_title": teaching_title,
                "title_hits": title_hits,
                "description_hits": desc_hits,
                "clickbait": clickbait,
                "noninstructional": noninstructional,
                "description": desc[:360],
                "source_url": record.get("source_url"),
            },
        ))

    candidates.sort(key=lambda row: row[:3])
    print(f"\n=== Raw Open Learning Media candidate audit: {TOPIC_SLUG} ({len(candidates)} records) ===")
    counts = {}
    for _, _, _, info in candidates:
        counts[info["stage"]] = counts.get(info["stage"], 0) + 1
    print("stage_counts=" + json.dumps(counts, sort_keys=True))
    for _, _, _, info in candidates[:80]:
        print(json.dumps(info, ensure_ascii=False, sort_keys=True))
    print("=== end raw candidate audit ===\n")


if __name__ == "__main__":
    main()
