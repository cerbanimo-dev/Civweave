#!/usr/bin/env python3
"""Final high-confidence selection gate for automatically embedded open media.

Records with a topic anchor in the title are eligible. Description-only topic matches
must also have an instructional title. This deliberately favors precision over recall
for media that Living School or Cerbanimo may surface without a human curator.
"""
from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path("public/downloads/knowledge-schools/open-learning-media")
CATALOG_PATH = ROOT / "catalog.json"
SUMMARY_PATH = ROOT / "summary.json"
LOOKUP_PATH = ROOT / "lookup.json"
AUDIT_PATH = ROOT / "selection-audit.json"

TOPIC_NAMES = {
    "vibe-coding": ("Vibe Coding", "technology"),
    "prompt-engineering": ("Prompt Engineering", "technology"),
    "pseudocoding": ("Pseudocoding and Algorithm Design", "technology"),
    "critical-thinking": ("Critical Thinking", "philosophy-and-religion"),
    "logical-frameworks": ("Logical Frameworks", "philosophy-and-religion"),
}

TITLE_INSTRUCTIONAL = re.compile(
    r"\b(?:teach|teaching|learn|learning|lesson|lecture|course|tutorial|guide|workshop|"
    r"training|education|educational|introduction|intro|overview|demo|demonstration|"
    r"walkthrough|how[- ]to|framework|systems thinking|prompt|pseudo[- ]?code|algorithm|"
    r"critical thinking|media literacy|logic|logical|reasoning|decision|building|build|"
    r"prototyping|coding|programming|software|ai assistant|agentic ai)\b",
    re.I,
)


def topic_evidence(record: dict, slug: str) -> dict:
    return ((record.get("pedagogy") or {}).get(slug) or {})


def eligible_topic(record: dict, slug: str) -> tuple[bool, str]:
    evidence = topic_evidence(record, slug)
    if evidence.get("strong_title_matches"):
        return True, "strong-topic-anchor-in-title"
    if evidence.get("strong_description_matches") and TITLE_INSTRUCTIONAL.search(str(record.get("title") or "")):
        return True, "strong-description-anchor-plus-instructional-title"
    return False, "description-only-without-instructional-title"


def compact(record: dict) -> dict:
    return {
        "provider": record.get("provider"),
        "provider_id": record.get("provider_id"),
        "title": record.get("title"),
        "description": record.get("description"),
        "source_url": record.get("source_url"),
        "cache_policy": record.get("cache_policy"),
        "license": record.get("license"),
        "files": record.get("files") or [],
        "quality_score": record.get("quality_score"),
        "content_hash": record.get("content_hash"),
        "hash_state": record.get("hash_state"),
        "attribution": record.get("attribution"),
        "relevance": record.get("relevance"),
        "pedagogy": record.get("pedagogy"),
        "selection": record.get("selection"),
    }


def main() -> None:
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    summary = json.loads(SUMMARY_PATH.read_text(encoding="utf-8"))
    before = list(catalog.get("records") or [])
    kept, rejected = [], []

    for record in before:
        candidates = set((record.get("pedagogy") or {}).keys())
        accepted = {}
        reasons = {}
        for slug in sorted(candidates):
            if slug not in TOPIC_NAMES:
                continue
            ok, reason = eligible_topic(record, slug)
            reasons[slug] = reason
            if ok:
                accepted[slug] = {
                    "reason": reason,
                    "pedagogy_score": int(topic_evidence(record, slug).get("pedagogy_score") or 0),
                }
        if not accepted:
            rejected.append({
                "provider": record.get("provider"),
                "title": record.get("title"),
                "source_url": record.get("source_url"),
                "reasons": reasons,
            })
            continue

        record["selection"] = accepted
        primary = max(accepted, key=lambda slug: accepted[slug]["pedagogy_score"])
        record["topic_slug"] = primary
        record["topic_name"], record["school_slug"] = TOPIC_NAMES[primary]
        record["topic_matches"] = [
            {
                "topic_slug": slug,
                "school_slug": TOPIC_NAMES[slug][1],
                "selection_reason": info["reason"],
                "pedagogy_score": info["pedagogy_score"],
                "relevance_score": int(((record.get("relevance") or {}).get(slug) or {}).get("score") or 0),
            }
            for slug, info in sorted(accepted.items(), key=lambda item: (-item[1]["pedagogy_score"], item[0]))
        ]
        kept.append(record)

    kept.sort(key=lambda r: (
        r.get("topic_slug") or "",
        -max((m.get("pedagogy_score") or 0) for m in r.get("topic_matches") or [{}]),
        -int(r.get("quality_score") or 0),
        (r.get("title") or "").lower(),
    ))

    lookup = {slug: [] for slug in TOPIC_NAMES}
    for record in kept:
        if not record.get("mesh_redistributable"):
            continue
        for match in record.get("topic_matches") or []:
            slug = match.get("topic_slug")
            if slug in lookup:
                lookup[slug].append(compact(record))
    for slug in lookup:
        lookup[slug].sort(key=lambda r: (
            -int(((r.get("selection") or {}).get(slug) or {}).get("pedagogy_score") or 0),
            -int(r.get("quality_score") or 0),
            (r.get("title") or "").lower(),
        ))

    providers = {}
    for provider in sorted({r.get("provider") for r in kept if r.get("provider")}):
        subset = [r for r in kept if r.get("provider") == provider]
        providers[provider] = {
            "records": len(subset),
            "mesh_redistributable": sum(bool(r.get("mesh_redistributable")) for r in subset),
            "download_candidates": sum(len(r.get("files") or []) for r in subset),
        }

    focus = {}
    for slug, (name, school) in TOPIC_NAMES.items():
        subset = [r for r in kept if slug in (r.get("selection") or {})]
        ordered = sorted(subset, key=lambda r: (
            -int(((r.get("selection") or {}).get(slug) or {}).get("pedagogy_score") or 0),
            -int(r.get("quality_score") or 0),
        ))
        focus[slug] = {
            "name": name,
            "school_slug": school,
            "records": len(subset),
            "mesh_redistributable": sum(bool(r.get("mesh_redistributable")) for r in subset),
            "providers": dict(Counter(r.get("provider") for r in subset)),
            "top_titles": [r.get("title") for r in ordered[:10]],
        }

    catalog["record_count_before_selection_gate"] = len(before)
    catalog["record_count"] = len(kept)
    catalog["rejected_by_selection_gate"] = len(before) - len(kept)
    catalog["mesh_redistributable_count"] = sum(bool(r.get("mesh_redistributable")) for r in kept)
    catalog["download_candidate_count"] = sum(len(r.get("files") or []) for r in kept)
    catalog["providers"] = providers
    catalog["focus_topics"] = focus
    catalog["records"] = kept

    summary["records_before_selection_gate"] = len(before)
    summary["records"] = len(kept)
    summary["rejected_by_selection_gate"] = len(before) - len(kept)
    summary["mesh_redistributable"] = catalog["mesh_redistributable_count"]
    summary["download_candidates"] = catalog["download_candidate_count"]
    summary["providers"] = providers
    summary["focus_topics"] = focus
    summary["selection_gate"] = {
        "schema": "civweave.open-learning-media-selection-gate.v1",
        "policy": "Strong topic anchors in titles are accepted; description-only anchors additionally require an instructional title before automatic selection.",
    }

    lookup_payload = {
        "schema": "civweave.open-learning-media-lookup.v1",
        "built_at": catalog.get("built_at"),
        "relevance_gate": summary.get("relevance_gate"),
        "pedagogy_gate": summary.get("pedagogy_gate"),
        "selection_gate": summary["selection_gate"],
        "topics": lookup,
    }
    audit = {
        "schema": "civweave.open-learning-media-selection-audit.v1",
        "built_at": catalog.get("built_at"),
        "before": len(before),
        "after": len(kept),
        "rejected": len(before) - len(kept),
        "topics": focus,
        "rejected_samples": rejected[:120],
    }

    CATALOG_PATH.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    SUMMARY_PATH.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    LOOKUP_PATH.write_text(json.dumps(lookup_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    AUDIT_PATH.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    missing = [slug for slug, info in focus.items() if info["records"] <= 0 or info["mesh_redistributable"] <= 0]
    if missing:
        raise SystemExit("Selection gate left required topics without redistributable references: " + ", ".join(missing))

    print(json.dumps({
        "before": len(before),
        "after": len(kept),
        "rejected": len(before) - len(kept),
        "topics": {slug: {"records": info["records"], "mesh": info["mesh_redistributable"], "top": info["top_titles"][:3]} for slug, info in focus.items()},
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
