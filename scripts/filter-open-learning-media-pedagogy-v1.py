#!/usr/bin/env python3
"""High-precision pedagogical gate for Civweave's open learning media seed.

The broad harvester discovers candidates and the relevance gate scores topical evidence.
This second gate requires a strong conceptual anchor. If that anchor appears only in the
body description, the record must also show explicit instructional/educational intent.
The goal is a smaller seed that is safe to use automatically in generated learning paths.
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
AUDIT_PATH = ROOT / "pedagogy-audit.json"

STRONG = {
    "vibe-coding": [
        r"\bvibe cod(?:e|ing)\b",
        r"\bai[- ]assisted (?:coding|programming|software development)\b",
        r"\bai (?:coding|code) assistant\b",
        r"\bai pair programming\b",
        r"\bllm(?:s)? (?:for |in )?(?:coding|programming|software development)\b",
        r"\b(?:coding|code) agent(?:s)?\b",
        r"\b(?:claude code|github copilot|codeium|cursor)\b",
        r"\bcode generation\b",
    ],
    "prompt-engineering": [
        r"\bprompt engineering\b",
        r"\bprompt design\b",
        r"\bprompt pattern(?:s)?\b",
        r"\b(?:few[- ]shot|zero[- ]shot) prompt(?:ing)?\b",
        r"\b(?:llm|language model) prompt(?:ing|s)?\b",
        r"\b(?:generative ai|chatgpt|claude|gemini) prompt(?:ing|s)?\b",
        r"\bprompt injection\b",
    ],
    "pseudocoding": [
        r"\bpseudo[- ]?code\b",
        r"\balgorithm design\b",
        r"\bcomputational thinking\b",
        r"\bprogram(?:ming)? flowchart(?:s)?\b",
        r"\bflowchart(?:s)?\b.*\b(?:algorithm|programming|coding)\b",
        r"\b(?:algorithm|programming|coding)\b.*\bflowchart(?:s)?\b",
    ],
    "critical-thinking": [
        r"\bcritical thinking\b",
        r"\bargument analysis\b",
        r"\bsource evaluation\b",
        r"\bmedia literacy\b",
        r"\binformation literacy\b",
        r"\bfact[- ]check(?:ing)?\b",
        r"\bevidence[- ]based reasoning\b",
        r"\b(?:evaluate|evaluating) (?:sources|evidence|claims)\b",
    ],
    "logical-frameworks": [
        r"\bformal logic\b",
        r"\bpropositional logic\b",
        r"\bpredicate logic\b",
        r"\bboolean logic\b",
        r"\blogical reasoning\b",
        r"\blogical fallac(?:y|ies)\b",
        r"\bsystems thinking\b",
        r"\bdecision framework(?:s)?\b",
        r"\bdecision tree(?:s)?\b",
        r"\b(?:deductive|inductive|abductive) reasoning\b",
        r"\bsyllogism(?:s)?\b",
    ],
}

EDUCATIONAL = re.compile(
    r"\b(?:teach|teaches|teaching|taught|learn|learning|lesson|lecture|course|classroom|"
    r"student|students|tutorial|guide|workshop|training|education|educational|curriculum|"
    r"explain|explains|explained|introduction|introductory|overview|demonstration|demo|"
    r"example|examples|walkthrough|how[- ]to|presentation|conference|talk|seminar|method|"
    r"framework|technique|practice|practices)\b",
    re.I,
)

CLICKBAIT = re.compile(
    r"\b(?:breaking|entire .{0,20} in shock|terrible news|can't believe|cannot believe|"
    r"just destroyed|just received|flee(?:s|ing)?|you won't believe)\b",
    re.I,
)

TOPIC_NAMES = {
    "vibe-coding": ("Vibe Coding", "technology"),
    "prompt-engineering": ("Prompt Engineering", "technology"),
    "pseudocoding": ("Pseudocoding and Algorithm Design", "technology"),
    "critical-thinking": ("Critical Thinking", "philosophy-and-religion"),
    "logical-frameworks": ("Logical Frameworks", "philosophy-and-religion"),
}


def matches(patterns: list[str], text: str) -> list[str]:
    return [pattern for pattern in patterns if re.search(pattern, text, re.I | re.S)]


def classify(record: dict, slug: str) -> tuple[bool, dict]:
    title = str(record.get("title") or "")
    description = str(record.get("description") or "")
    title_matches = matches(STRONG[slug], title)
    desc_matches = matches(STRONG[slug], description)
    educational = bool(EDUCATIONAL.search(title + " " + description))
    clickbait = bool(CLICKBAIT.search(title))

    # A concept named directly in the title is sufficiently explicit. Otherwise the
    # description needs both a strong topic anchor and evidence that the item is meant
    # to teach/explain/demo the concept rather than merely mention it in passing.
    accepted = bool(title_matches) or (bool(desc_matches) and educational and not clickbait)

    # "code generation" alone is ambiguous; for vibe coding require explicit AI/model
    # context when this is the only anchor.
    if accepted and slug == "vibe-coding":
        all_matches = title_matches + desc_matches
        only_codegen = all_matches and all("code generation" in x for x in all_matches)
        if only_codegen and not re.search(r"\b(?:ai|llm|language model|generative|copilot|claude|gemini|cursor)\b", title + " " + description, re.I):
            accepted = False

    score = 0
    score += 20 * len(title_matches)
    score += 8 * len(desc_matches)
    score += 5 if educational else 0
    score += 6 if record.get("mesh_redistributable") else 0
    score += min(6, int(record.get("quality_score") or 0) // 15)
    score -= 30 if clickbait else 0
    return accepted, {
        "strong_title_matches": title_matches,
        "strong_description_matches": desc_matches,
        "educational_intent": educational,
        "clickbait_title": clickbait,
        "pedagogy_score": score,
    }


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
    }


def main() -> None:
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    summary = json.loads(SUMMARY_PATH.read_text(encoding="utf-8"))
    before = list(catalog.get("records") or [])
    kept: list[dict] = []
    rejected: list[dict] = []

    for record in before:
        candidates = set((record.get("relevance") or {}).keys())
        candidates.update(m.get("topic_slug") for m in record.get("topic_matches") or [] if isinstance(m, dict))
        decisions = {}
        for slug in sorted(candidates):
            if slug not in STRONG:
                continue
            ok, evidence = classify(record, slug)
            if ok:
                decisions[slug] = evidence
        if not decisions:
            rejected.append({
                "provider": record.get("provider"),
                "title": record.get("title"),
                "source_url": record.get("source_url"),
                "relevance_topics": sorted(candidates),
            })
            continue

        record["pedagogy"] = decisions
        primary = max(decisions, key=lambda slug: decisions[slug]["pedagogy_score"])
        record["topic_slug"] = primary
        record["topic_name"], record["school_slug"] = TOPIC_NAMES[primary]
        record["topic_matches"] = [
            {
                "topic_slug": slug,
                "school_slug": TOPIC_NAMES[slug][1],
                "relevance_score": ((record.get("relevance") or {}).get(slug) or {}).get("score", 0),
                "pedagogy_score": evidence["pedagogy_score"],
                "strong_title_matches": evidence["strong_title_matches"],
                "strong_description_matches": evidence["strong_description_matches"],
                "educational_intent": evidence["educational_intent"],
            }
            for slug, evidence in sorted(decisions.items(), key=lambda kv: (-kv[1]["pedagogy_score"], kv[0]))
        ]
        kept.append(record)

    kept.sort(key=lambda r: (
        r.get("topic_slug") or "",
        -max((x.get("pedagogy_score") or 0) for x in r.get("topic_matches") or [{}]),
        -int(r.get("quality_score") or 0),
        (r.get("title") or "").lower(),
    ))

    lookup = {slug: [] for slug in STRONG}
    for record in kept:
        if not record.get("mesh_redistributable"):
            continue
        for match in record.get("topic_matches") or []:
            slug = match.get("topic_slug")
            if slug in lookup:
                lookup[slug].append(compact(record))
    for slug in lookup:
        lookup[slug].sort(key=lambda r: (
            -int(((r.get("pedagogy") or {}).get(slug) or {}).get("pedagogy_score") or 0),
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
        subset = [r for r in kept if slug in (r.get("pedagogy") or {})]
        ordered = sorted(subset, key=lambda r: (
            -int(((r.get("pedagogy") or {}).get(slug) or {}).get("pedagogy_score") or 0),
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

    catalog["record_count_before_pedagogy_gate"] = len(before)
    catalog["record_count"] = len(kept)
    catalog["rejected_by_pedagogy_gate"] = len(before) - len(kept)
    catalog["mesh_redistributable_count"] = sum(bool(r.get("mesh_redistributable")) for r in kept)
    catalog["download_candidate_count"] = sum(len(r.get("files") or []) for r in kept)
    catalog["providers"] = providers
    catalog["focus_topics"] = focus
    catalog["records"] = kept

    summary["records_before_pedagogy_gate"] = len(before)
    summary["records"] = len(kept)
    summary["rejected_by_pedagogy_gate"] = len(before) - len(kept)
    summary["mesh_redistributable"] = catalog["mesh_redistributable_count"]
    summary["download_candidates"] = catalog["download_candidate_count"]
    summary["providers"] = providers
    summary["focus_topics"] = focus
    summary["pedagogy_gate"] = {
        "schema": "civweave.open-learning-media-pedagogy-gate.v1",
        "policy": "Require a strong conceptual anchor in the title, or a strong description anchor plus explicit educational intent; reject clickbait description-only matches.",
    }

    audit = {
        "schema": "civweave.open-learning-media-pedagogy-audit.v1",
        "built_at": catalog.get("built_at"),
        "before": len(before),
        "after": len(kept),
        "rejected": len(before) - len(kept),
        "topics": focus,
        "rejected_samples": rejected[:120],
    }

    lookup_payload = {
        "schema": "civweave.open-learning-media-lookup.v1",
        "built_at": catalog.get("built_at"),
        "relevance_gate": summary.get("relevance_gate"),
        "pedagogy_gate": summary["pedagogy_gate"],
        "topics": lookup,
    }

    CATALOG_PATH.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    SUMMARY_PATH.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    LOOKUP_PATH.write_text(json.dumps(lookup_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    AUDIT_PATH.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    missing = [slug for slug, info in focus.items() if info["records"] <= 0 or info["mesh_redistributable"] <= 0]
    if missing:
        raise SystemExit("Pedagogy gate left required topics without redistributable references: " + ", ".join(missing))

    print(json.dumps({
        "before": len(before),
        "after": len(kept),
        "rejected": len(before) - len(kept),
        "topics": {slug: {"records": info["records"], "mesh": info["mesh_redistributable"], "top": info["top_titles"][:3]} for slug, info in focus.items()},
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
