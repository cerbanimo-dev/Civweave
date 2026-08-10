#!/usr/bin/env python3
"""Deterministically remove off-topic results from the Open Learning Media harvest.

Provider search ranking is discovery-only. This filter requires explicit topical evidence
in title/description before a record becomes part of Civweave's learning-media index.
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
AUDIT_PATH = ROOT / "relevance-audit.json"

TOPICS = {
    "vibe-coding": {
        "name": "Vibe Coding",
        "school_slug": "technology",
        "threshold": 6,
        "signals": [
            (r"\bvibe cod(?:e|ing)\b", 12, "vibe coding"),
            (r"\bai[- ]assisted (?:coding|programming|software development)\b", 10, "AI-assisted coding"),
            (r"\bai (?:coding|code) assistant\b", 9, "AI coding assistant"),
            (r"\bai pair programming\b", 9, "AI pair programming"),
            (r"\bllm(?:s)? (?:for |in )?(?:coding|programming|software development)\b", 8, "LLM coding"),
            (r"\bcod(?:e|ing) generation\b", 7, "code generation"),
            (r"\bgenerative ai\b", 2, "generative AI"),
            (r"\b(?:coding|programming|software development)\b", 3, "programming context"),
            (r"\b(?:copilot|codeium|cursor|coding agent|code agent)\b", 5, "AI coding tool"),
        ],
    },
    "prompt-engineering": {
        "name": "Prompt Engineering",
        "school_slug": "technology",
        "threshold": 6,
        "signals": [
            (r"\bprompt engineering\b", 12, "prompt engineering"),
            (r"\bprompt design\b", 9, "prompt design"),
            (r"\b(?:few[- ]shot|zero[- ]shot) prompt(?:ing)?\b", 9, "few/zero-shot prompting"),
            (r"\bprompt pattern(?:s)?\b", 8, "prompt patterns"),
            (r"\bprompt injection\b", 7, "prompt injection"),
            (r"\b(?:llm|language model) prompt(?:ing|s)?\b", 8, "LLM prompting"),
            (r"\bprompt(?:ing|s)?\b", 3, "prompting"),
            (r"\b(?:generative ai|language model|llm|chatgpt|claude|gemini)\b", 3, "generative-model context"),
        ],
    },
    "pseudocoding": {
        "name": "Pseudocoding and Algorithm Design",
        "school_slug": "technology",
        "threshold": 6,
        "signals": [
            (r"\bpseudo[- ]?code\b", 12, "pseudocode"),
            (r"\balgorithm design\b", 9, "algorithm design"),
            (r"\bcomputational thinking\b", 9, "computational thinking"),
            (r"\bprogram(?:ming)? flowchart(?:s)?\b", 8, "programming flowchart"),
            (r"\bflowchart(?:s)?\b", 4, "flowchart"),
            (r"\balgorithm(?:s|ic)?\b", 3, "algorithm"),
            (r"\b(?:programming|coding|computer science)\b", 3, "programming context"),
        ],
    },
    "critical-thinking": {
        "name": "Critical Thinking",
        "school_slug": "philosophy-and-religion",
        "threshold": 6,
        "signals": [
            (r"\bcritical thinking\b", 12, "critical thinking"),
            (r"\bargument analysis\b", 10, "argument analysis"),
            (r"\bsource evaluation\b", 10, "source evaluation"),
            (r"\bmedia literacy\b", 9, "media literacy"),
            (r"\binformation literacy\b", 8, "information literacy"),
            (r"\bfact[- ]check(?:ing)?\b", 8, "fact checking"),
            (r"\b(?:evaluate|evaluating) (?:sources|evidence|claims)\b", 7, "evaluation of evidence"),
            (r"\bevidence[- ]based reasoning\b", 9, "evidence-based reasoning"),
            (r"\bcredib(?:ility|le)\b", 4, "credibility"),
            (r"\b(?:bias|misinformation|disinformation)\b", 3, "bias/misinformation"),
        ],
    },
    "logical-frameworks": {
        "name": "Logical Frameworks",
        "school_slug": "philosophy-and-religion",
        "threshold": 6,
        "signals": [
            (r"\bformal logic\b", 12, "formal logic"),
            (r"\bpropositional logic\b", 12, "propositional logic"),
            (r"\bpredicate logic\b", 11, "predicate logic"),
            (r"\bboolean logic\b", 9, "Boolean logic"),
            (r"\blogical reasoning\b", 10, "logical reasoning"),
            (r"\blogical fallac(?:y|ies)\b", 10, "logical fallacies"),
            (r"\bsystems thinking\b", 9, "systems thinking"),
            (r"\bdecision framework(?:s)?\b", 9, "decision framework"),
            (r"\bdecision tree(?:s)?\b", 7, "decision tree"),
            (r"\b(?:deductive|inductive|abductive) reasoning\b", 8, "reasoning framework"),
            (r"\bsyllogism(?:s)?\b", 7, "syllogism"),
            (r"\b(?:logic|reasoning)\b", 3, "logic/reasoning"),
        ],
    },
}


def normalized_text(record: dict) -> str:
    return " ".join([
        str(record.get("title") or ""),
        str(record.get("description") or ""),
    ]).lower()


def score_topic(record: dict, slug: str) -> tuple[int, list[str]]:
    text = normalized_text(record)
    score = 0
    evidence = []
    for pattern, weight, label in TOPICS[slug]["signals"]:
        if re.search(pattern, text, re.I):
            score += weight
            evidence.append(label)
    return score, evidence


def relevant_slugs(record: dict) -> dict[str, dict]:
    candidates = {record.get("topic_slug")}
    candidates.update(m.get("topic_slug") for m in (record.get("topic_matches") or []) if isinstance(m, dict))
    candidates = {slug for slug in candidates if slug in TOPICS}
    accepted = {}
    for slug in candidates:
        score, evidence = score_topic(record, slug)
        if score >= TOPICS[slug]["threshold"]:
            accepted[slug] = {"score": score, "evidence": evidence}
    return accepted


def compact_record(record: dict) -> dict:
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
    }


def main() -> None:
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    before = list(catalog.get("records") or [])
    accepted = []
    rejected_samples = []

    for record in before:
        relevance = relevant_slugs(record)
        if not relevance:
            if len(rejected_samples) < 80:
                rejected_samples.append({
                    "provider": record.get("provider"),
                    "title": record.get("title"),
                    "original_topic": record.get("topic_slug"),
                    "matched_query": record.get("matched_query"),
                })
            continue
        record["relevance"] = relevance
        primary = max(relevance, key=lambda slug: relevance[slug]["score"])
        record["topic_slug"] = primary
        record["topic_name"] = TOPICS[primary]["name"]
        record["school_slug"] = TOPICS[primary]["school_slug"]
        record["topic_matches"] = [
            {
                "topic_slug": slug,
                "school_slug": TOPICS[slug]["school_slug"],
                "relevance_score": info["score"],
                "relevance_evidence": info["evidence"],
            }
            for slug, info in sorted(relevance.items(), key=lambda kv: (-kv[1]["score"], kv[0]))
        ]
        accepted.append(record)

    accepted.sort(key=lambda r: (
        r.get("topic_slug") or "",
        -max((x.get("relevance_score") or 0) for x in (r.get("topic_matches") or [{}])),
        -int(r.get("quality_score") or 0),
        (r.get("title") or "").lower(),
    ))

    lookup = {slug: [] for slug in TOPICS}
    for record in accepted:
        for match in record.get("topic_matches") or []:
            slug = match.get("topic_slug")
            if slug in lookup and record.get("mesh_redistributable"):
                lookup[slug].append(compact_record(record))
    for slug in lookup:
        lookup[slug].sort(key=lambda r: (
            -int(((r.get("relevance") or {}).get(slug) or {}).get("score") or 0),
            -int(r.get("quality_score") or 0),
            (r.get("title") or "").lower(),
        ))

    providers = {}
    for provider in sorted({r.get("provider") for r in accepted if r.get("provider")}):
        subset = [r for r in accepted if r.get("provider") == provider]
        providers[provider] = {
            "records": len(subset),
            "mesh_redistributable": sum(bool(r.get("mesh_redistributable")) for r in subset),
            "download_candidates": sum(len(r.get("files") or []) for r in subset),
        }

    focus_topics = {}
    for slug, definition in TOPICS.items():
        subset = [r for r in accepted if slug in (r.get("relevance") or {})]
        mesh = [r for r in subset if r.get("mesh_redistributable")]
        focus_topics[slug] = {
            "name": definition["name"],
            "school_slug": definition["school_slug"],
            "records": len(subset),
            "mesh_redistributable": len(mesh),
            "providers": dict(Counter(r.get("provider") for r in subset)),
            "top_titles": [r.get("title") for r in sorted(
                subset,
                key=lambda r: (-int((r.get("relevance", {}).get(slug) or {}).get("score") or 0), -int(r.get("quality_score") or 0)),
            )[:8]],
        }

    catalog["record_count_before_relevance_gate"] = len(before)
    catalog["record_count"] = len(accepted)
    catalog["rejected_by_relevance_gate"] = len(before) - len(accepted)
    catalog["mesh_redistributable_count"] = sum(bool(r.get("mesh_redistributable")) for r in accepted)
    catalog["download_candidate_count"] = sum(len(r.get("files") or []) for r in accepted)
    catalog["providers"] = providers
    catalog["focus_topics"] = focus_topics
    catalog["records"] = accepted

    summary = json.loads(SUMMARY_PATH.read_text(encoding="utf-8"))
    summary["records_before_relevance_gate"] = len(before)
    summary["records"] = len(accepted)
    summary["rejected_by_relevance_gate"] = len(before) - len(accepted)
    summary["mesh_redistributable"] = catalog["mesh_redistributable_count"]
    summary["download_candidates"] = catalog["download_candidate_count"]
    summary["providers"] = providers
    summary["focus_topics"] = focus_topics
    summary["relevance_gate"] = {
        "schema": "civweave.open-learning-media-relevance-gate.v1",
        "policy": "Provider search is discovery only; title/description must independently meet a topic-specific deterministic threshold.",
    }

    lookup_payload = {
        "schema": "civweave.open-learning-media-lookup.v1",
        "built_at": catalog.get("built_at"),
        "relevance_gate": summary["relevance_gate"],
        "topics": lookup,
    }
    audit = {
        "schema": "civweave.open-learning-media-relevance-audit.v1",
        "built_at": catalog.get("built_at"),
        "before": len(before),
        "after": len(accepted),
        "rejected": len(before) - len(accepted),
        "topics": focus_topics,
        "rejected_samples": rejected_samples,
    }

    CATALOG_PATH.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    SUMMARY_PATH.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    LOOKUP_PATH.write_text(json.dumps(lookup_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    AUDIT_PATH.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    missing = [slug for slug, info in focus_topics.items() if info["records"] <= 0]
    if missing:
        raise SystemExit("Topical relevance gate left required topics empty: " + ", ".join(missing))
    print(json.dumps({
        "before": len(before),
        "after": len(accepted),
        "rejected": len(before) - len(accepted),
        "topics": {slug: {"records": info["records"], "mesh": info["mesh_redistributable"]} for slug, info in focus_topics.items()},
    }, indent=2))


if __name__ == "__main__":
    main()
