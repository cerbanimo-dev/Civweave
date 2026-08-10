#!/usr/bin/env python3
"""Remove automatic media selections whose titles do not visibly anchor the selected topic."""
from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path("public/downloads/knowledge-schools/open-learning-media")
REGISTRY_PATH = Path("config/open-learning-media-packs-v1.json")

TITLE_ANCHORS = {
    "world-history": r"\b(?:history|historical|civilization|civilisation|ancient|medieval|renaissance|world war)\b",
    "earth-geography": r"\b(?:geograph|maps?\b|mapping|latitude|longitude|landform|contour|topograph|cartograph)",
    "civics-society": r"\b(?:civics?|government|parliament|democra|election|voting|constitution|citizen)",
    "biology-life": r"\b(?:biology|biological|cell\b|cells\b|genetic|dna\b|ecolog|organism|chromosome|molecular biology)",
    "physics-foundations": r"\b(?:physics|physical science|force\b|forces\b|motion|mechanic|electricity|energy|space flight)",
    "chemistry-foundations": r"\b(?:chemistry|chemical|periodic|element|electron|atom|molecule|isotope|equation)",
    "astronomy-space": r"\b(?:astronom|solar system|planet|star\b|stars\b|galax|cosmos|space science|observatory)",
    "mathematics-foundations": r"\b(?:math|mathemat|algebra|geometry|fraction|equation|mensuration|lattice|conjecture)",
    "computing-basics": r"\b(?:computer|computing|computer science|cpu\b|hardware|software|networking|internet|assembly|programming)",
    "arts-culture": r"\b(?:art\b|arts\b|art history|painting|krita|museum|gallery|music|culture|cultural|design)",
    "health-wellness": r"\b(?:health|wellness|nutrition|anatomy|hygiene|exercise|human body|brain function)",
    "philosophy-ethics": r"\b(?:philosoph|ethics|ethical|moral)",
    "vibe-coding": r"\b(?:vibe coding|ai coding|coding assistant|cline\b|pair programming|code generation)",
    "prompt-engineering": r"\b(?:prompt engineering|prompt design|prompting|llm prompt)",
    "pseudocoding": r"\b(?:pseudocode|algorithm|computational thinking|flowchart|dijkstra)",
    "critical-thinking": r"\b(?:critical thinking|media literacy|information literacy|fact check|source evaluation|evidence)",
    "logical-frameworks": r"\b(?:logic|logical|systems thinking|system dynamics|emergence|decision framework)",
    "personal-finance": r"\b(?:personal finance|finance|financial|budget|budgeting|credit|money|gnucash|wise buying|shopping)",
    "cooking-food-safety": r"\b(?:cooking|food safety|food hygiene|kitchen|food preserv|foodborne)",
    "emergency-preparedness": r"\b(?:emergency preparedness|disaster preparedness|civil defense|fire safety|fire drill|emergency kit)",
    "home-maintenance": r"\b(?:home maintenance|home repair|household repair|house repair)",
    "career-work-skills": r"\b(?:career|resume|résumé|job interview|workplace|work skills)",
    "electronics-basics": r"\b(?:electronics|electronic|circuit|solder|karnaugh)",
    "woodworking-basics": r"\b(?:woodwork|carpentry|joinery|bending oak)",
    "sewing-textiles": r"\b(?:sewing|stitch|mending|garment|fabric repair|textile repair)",
    "drawing-design": r"\b(?:drawing|sketch|design|inkscape|krita|comic|animation|brush)",
    "photography-video": r"\b(?:photograph|camera|shutter|cinematograph|video production|motion picture)",
    "statistics-data-literacy": r"\b(?:statistics|statistical|data literacy|probability|chart|graph|labplot|data visual)",
    "climate-environment": r"\b(?:climate|environment|ecosystem|ecology)",
    "law-rights-basics": r"\b(?:law\b|legal|rights\b|civil rights|constitution|court)",
}
COMPILED = {slug: re.compile(pattern, re.I) for slug, pattern in TITLE_ANCHORS.items()}


def record_key(record):
    return f"{record.get('provider')}:{record.get('provider_id')}"


def compact(record):
    keys = ["provider","provider_id","title","description","source_url","cache_policy","license","files","quality_score","content_hash","hash_state","attribution","relevance","pedagogy","selection"]
    return {key: record.get(key) for key in keys}



def downloader_ready(record):
    if not record.get("mesh_redistributable"):
        return False
    for file in record.get("files") or []:
        url=str(file.get("url") or "")
        mime=str(file.get("mime") or "").lower()
        try:
            size=int(file.get("bytes") or 0)
        except (TypeError, ValueError):
            size=0
        if url.startswith("https://") and mime.startswith("video/") and size>0:
            return True
    return False

def main():
    registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    topics = {topic["slug"]: topic for topic in registry["topics"]}
    catalog_path = ROOT / "catalog.json"
    summary_path = ROOT / "summary.json"
    lookup_path = ROOT / "lookup.json"
    packs_path = ROOT / "packs.json"
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    lookup = json.loads(lookup_path.read_text(encoding="utf-8"))
    packs_payload = json.loads(packs_path.read_text(encoding="utf-8"))

    before = list(catalog.get("records") or [])
    kept = []
    rejected_links = []
    for record in before:
        title = str(record.get("title") or "")
        original_selection = dict(record.get("selection") or {})
        selection = {}
        for slug, evidence in original_selection.items():
            pattern = COMPILED.get(slug)
            if pattern and pattern.search(title):
                selection[slug] = evidence
            else:
                rejected_links.append({"provider": record.get("provider"), "provider_id": record.get("provider_id"), "title": title, "topic_slug": slug})
        if not selection:
            continue
        record["selection"] = selection
        record["relevance"] = {slug: value for slug, value in (record.get("relevance") or {}).items() if slug in selection}
        record["pedagogy"] = {slug: value for slug, value in (record.get("pedagogy") or {}).items() if slug in selection}
        matches = [m for m in (record.get("topic_matches") or []) if m.get("topic_slug") in selection]
        matches.sort(key=lambda m: (-int(m.get("pedagogy_score") or 0), -int(m.get("relevance_score") or 0), str(m.get("topic_slug") or "")))
        record["topic_matches"] = matches
        primary = matches[0]["topic_slug"] if matches else max(selection, key=lambda slug: int((selection[slug] or {}).get("pedagogy_score") or 0))
        record["topic_slug"] = primary
        record["topic_name"] = topics[primary]["name"]
        record["school_slug"] = topics[primary]["school_slug"]
        kept.append(record)

    kept.sort(key=lambda r: (r.get("topic_slug") or "", -max([int((m or {}).get("pedagogy_score") or 0) for m in (r.get("topic_matches") or [])] or [0]), -int(r.get("quality_score") or 0), str(r.get("title") or "").lower()))

    topic_stats = {}
    lookup_topics = {slug: [] for slug in topics}
    for slug, topic in topics.items():
        subset = [record for record in kept if slug in (record.get("selection") or {})]
        subset.sort(key=lambda r: (-int(((r.get("selection") or {}).get(slug) or {}).get("pedagogy_score") or 0), -int(r.get("quality_score") or 0), str(r.get("title") or "").lower()))
        topic_stats[slug] = {
            "name": topic["name"],
            "school_slug": topic["school_slug"],
            "required": bool(topic.get("required")),
            "records": len(subset),
            "mesh_redistributable": sum(downloader_ready(r) for r in subset),
            "providers": dict(Counter(r.get("provider") for r in subset)),
            "top_titles": [r.get("title") for r in subset[:10]],
        }
        lookup_topics[slug] = [compact(r) for r in subset if downloader_ready(r)]

    providers = {}
    for provider in sorted({r.get("provider") for r in kept if r.get("provider")}):
        subset = [r for r in kept if r.get("provider") == provider]
        providers[provider] = {
            "records": len(subset),
            "mesh_redistributable": sum(downloader_ready(r) for r in subset),
            "download_candidates": sum(len(r.get("files") or []) for r in subset),
        }

    minimum = float(registry.get("minimum_pack_topic_coverage") or 0.6)
    pack_stats = {}
    public_packs = []
    for pack in registry["packs"]:
        slugs = [slug for slug in pack.get("topics") or [] if slug in topics]
        covered = [slug for slug in slugs if topic_stats[slug]["mesh_redistributable"] > 0]
        coverage = len(covered) / len(slugs) if slugs else 0
        keys = {record_key(r) for r in kept if downloader_ready(r) and any(slug in (r.get("selection") or {}) for slug in slugs)}
        available = bool(slugs) and coverage >= (1.0 if pack.get("default") else minimum)
        pack_stats[pack["slug"]] = {
            "name": pack["name"], "kind": pack.get("kind") or "extension", "description": pack.get("description") or "",
            "topics": slugs, "covered_topics": covered, "coverage": round(coverage, 4), "records": len(keys), "available": available,
        }
        public_packs.append({
            "slug": pack["slug"], "name": pack["name"], "kind": pack.get("kind") or "extension", "default": bool(pack.get("default")),
            "description": pack.get("description") or "", "topics": slugs, "coverage": round(coverage, 4), "available": available,
        })

    mesh_count = sum(downloader_ready(r) for r in kept)
    download_count = sum(len(r.get("files") or []) for r in kept)
    catalog.update({
        "records_before_title_quality_gate": len(before), "rejected_by_title_quality_gate": len(before) - len(kept),
        "rejected_topic_links_by_title_quality_gate": len(rejected_links), "record_count": len(kept),
        "mesh_redistributable_count": mesh_count, "download_candidate_count": download_count,
        "providers": providers, "focus_topics": topic_stats, "topic_stats": topic_stats, "packs": pack_stats, "records": kept,
    })
    summary.update({
        "records_before_title_quality_gate": len(before), "rejected_by_title_quality_gate": len(before) - len(kept),
        "rejected_topic_links_by_title_quality_gate": len(rejected_links), "records": len(kept), "mesh_redistributable": mesh_count,
        "download_candidates": download_count, "providers": providers, "focus_topics": topic_stats, "topic_stats": topic_stats, "packs": pack_stats,
        "title_quality_gate": {"schema": "civweave.open-learning-media-title-quality-gate.v1", "policy": "Automatic topic selection must be visibly anchored in the media title using a topic-specific vocabulary."},
    })
    lookup.update({"topics": lookup_topics, "packs": public_packs, "title_quality_gate": summary["title_quality_gate"]})
    packs_payload.update({"packs": public_packs})

    catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lookup_path.write_text(json.dumps(lookup, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    packs_path.write_text(json.dumps(packs_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (ROOT / "title-quality-audit.json").write_text(json.dumps({
        "schema": "civweave.open-learning-media-title-quality-audit.v1", "built_at": catalog.get("built_at"),
        "records_before": len(before), "records_after": len(kept), "rejected_records": len(before) - len(kept),
        "rejected_topic_links": len(rejected_links), "rejected_samples": rejected_links[:200], "topics": topic_stats, "packs": pack_stats,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    missing_required = [slug for slug, topic in topics.items() if topic.get("required") and topic_stats[slug]["mesh_redistributable"] <= 0]
    if missing_required:
        raise SystemExit("Required topics failed title-quality coverage: " + ", ".join(sorted(missing_required)))
    unavailable = [slug for slug, info in pack_stats.items() if not info["available"]]
    if unavailable:
        raise SystemExit("Packs failed title-quality coverage: " + ", ".join(sorted(unavailable)))
    print(json.dumps({"records_before": len(before), "records_after": len(kept), "mesh_redistributable": mesh_count, "packs": {slug: {"coverage": info["coverage"], "records": info["records"]} for slug, info in pack_stats.items()}}, indent=2))

if __name__ == "__main__":
    main()
