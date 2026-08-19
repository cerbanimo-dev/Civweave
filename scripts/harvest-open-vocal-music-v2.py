#!/usr/bin/env python3
"""Build Civweave's rights-cleared, vocal-first open music catalog.

This v2 layer keeps the v1 redistribution gate intact, but changes discovery and
selection policy: every emitted candidate must have a positive vocal signal and a
minimum lyrical "teeth" score. Hand-curated ccMixter seeds are exact upload IDs
whose vocals/themes were reviewed before entering config; discovery candidates
must prove vocals from source metadata and score against the configured themes.
"""
from __future__ import annotations

import importlib.util
import json
import re
import urllib.parse
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config/open-music-harvest-v1.json"
BASE_PATH = ROOT / "scripts/harvest-open-music-v1.py"
OUTPUT_DIR = ROOT / "public/downloads/hub-media/open-music"

spec = importlib.util.spec_from_file_location("civweave_open_music_v1", BASE_PATH)
base = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(base)

VOCAL_MARKERS = {
    "vocal", "vocals", "female_vocals", "male_vocals", "female vocals", "male vocals",
    "acappella", "acapella", "a cappella", "pell", "spoken", "spoken_word", "spoken word",
    "rap", "rapper", "singing", "singer", "lyrics", "lyric", "voice", "voices", "song",
}
INSTRUMENTAL_ONLY_MARKERS = {
    "instrumental_only", "instrumental only", "no_vocals", "no vocals", "without vocals",
}


def normalized_text(value: Any) -> str:
    if isinstance(value, dict):
        value = " ".join(str(v) for v in value.values())
    elif isinstance(value, (list, tuple, set)):
        value = " ".join(str(v) for v in value)
    return base.clean(value, 12000).lower().replace("-", "_")


def item_text(item: dict) -> str:
    fields = [
        item.get("upload_name"), item.get("name"), item.get("title"),
        item.get("upload_tags"), item.get("tags"), item.get("upload_description"),
        item.get("description"), item.get("user_real_name"), item.get("user_name"),
    ]
    return " ".join(normalized_text(field) for field in fields if field)


def has_vocal_signal(item: dict) -> bool:
    text = item_text(item)
    if any(marker in text for marker in INSTRUMENTAL_ONLY_MARKERS):
        return False
    return any(marker.replace(" ", "_") in text or marker in text for marker in VOCAL_MARKERS)


def theme_hits(item: dict, preferred_terms: list[str]) -> list[str]:
    text = item_text(item)
    hits = []
    for term in preferred_terms:
        needle = normalized_text(term)
        if needle and needle in text and term not in hits:
            hits.append(term)
    return hits


def teeth_score(item: dict, preferred_terms: list[str]) -> tuple[int, list[str]]:
    hits = theme_hits(item, preferred_terms)
    score = min(5, len(hits))
    return score, hits


def ccmixter_rows(params: dict) -> list[dict]:
    query = urllib.parse.urlencode(params)
    data = base.request_json(f"https://ccmixter.org/api/query?{query}")
    if isinstance(data, list):
        return [row for row in data if isinstance(row, dict)]
    if isinstance(data, dict):
        rows = data.get("items") or data.get("results") or []
        return [row for row in rows if isinstance(row, dict)]
    return []


def record_from_item(
    playlist: dict,
    item: dict,
    requested_license: str,
    matched_query: str,
    *,
    curated: dict | None = None,
    preferred_terms: list[str],
    minimum_teeth: int,
) -> dict | None:
    lic = base.ccmixter_license(item, requested_license)
    files = base.ccmixter_files(item)
    if not lic or not files:
        return None

    upload_id = base.clean(item.get("upload_id") or item.get("id"), 120)
    source_url = base.clean(item.get("file_page_url") or item.get("upload_page_url") or item.get("url"), 1600)
    if not source_url and upload_id:
        username = base.clean(item.get("user_name") or item.get("user_real_name"), 200)
        source_url = f"https://ccmixter.org/files/{urllib.parse.quote(username)}/{urllib.parse.quote(upload_id)}"

    if curated is None:
        if not has_vocal_signal(item):
            return None
        score, themes = teeth_score(item, preferred_terms)
        if score < minimum_teeth:
            return None
        explicit = False
        curation = "metadata-discovered"
        vocal_evidence = "ccMixter source metadata contains an affirmative vocal/voice/lyric marker"
    else:
        score = max(minimum_teeth, min(5, int(curated.get("teeth_score") or minimum_teeth)))
        themes = [base.clean(value, 80) for value in curated.get("themes") or [] if base.clean(value, 80)]
        explicit = bool(curated.get("explicit"))
        curation = "hand-seeded"
        vocal_evidence = "exact ccMixter upload manually reviewed for vocals and lyrical theme before configuration"

    record = base.base_record("ccmixter", playlist, matched_query)
    record.update({
        "provider_id": upload_id or source_url,
        "title": base.clean(item.get("upload_name") or item.get("name") or item.get("title"), 260),
        "artist": base.clean(item.get("user_real_name") or item.get("user_name") or item.get("artist"), 300),
        "source_url": source_url,
        "license": lic,
        "files": files,
        "vocal_verified": True,
        "vocal_evidence": vocal_evidence,
        "instrumental_only": False,
        "teeth_score": score,
        "themes": themes,
        "explicit": explicit,
        "curation": curation,
    })
    record["attribution"] = {
        "creator": record["artist"],
        "source_title": record["title"],
        "source_url": source_url,
        "license": lic["label"],
        "license_url": lic["url"],
    }
    if not all((record["provider_id"], record["source_url"], record["title"], record["artist"])):
        return None
    return record


def harvest_curated(playlist: dict, policy: dict) -> tuple[list[dict], list[dict]]:
    records, failures = [], []
    preferred = list(policy.get("preferred_terms") or [])
    minimum = max(1, min(5, int(policy.get("minimum_teeth_score") or 2)))
    for seed in playlist.get("curated_ccmixter") or []:
        upload_id = base.clean(seed.get("id"), 120)
        if not upload_id:
            continue
        try:
            rows = ccmixter_rows({"f": "json", "dataview": "info", "ids": upload_id, "limit": 4})
            matched = None
            for item in rows:
                item_id = base.clean(item.get("upload_id") or item.get("id"), 120)
                if item_id != upload_id:
                    continue
                for requested in ("by", "sa", "pd"):
                    candidate = record_from_item(
                        playlist, item, requested, f"curated:{upload_id}", curated=seed,
                        preferred_terms=preferred, minimum_teeth=minimum,
                    )
                    if candidate:
                        matched = candidate
                        break
                if matched:
                    break
            if matched:
                records.append(matched)
            else:
                failures.append({"provider": "ccmixter", "playlist_id": playlist["id"], "query": f"curated:{upload_id}", "error": "exact curated upload did not return an allowlisted downloadable record"})
        except Exception as exc:
            failures.append({"provider": "ccmixter", "playlist_id": playlist["id"], "query": f"curated:{upload_id}", "error": base.clean(exc, 900)})
    return records, failures


def harvest_discovery(playlist: dict, policy: dict) -> tuple[list[dict], list[dict]]:
    records, failures = [], []
    preferred = list(policy.get("preferred_terms") or [])
    minimum = max(1, min(5, int(policy.get("minimum_teeth_score") or 2)))
    for query in playlist.get("queries") or []:
        for requested in ("by", "sa", "pd"):
            try:
                rows = ccmixter_rows({
                    "f": "json", "dataview": "info", "limit": base.RESULTS_PER_QUERY,
                    "search": query, "search_type": "all", "lic": requested,
                    "sort": "date", "ord": "desc",
                })
                for item in rows:
                    record = record_from_item(
                        playlist, item, requested, query, curated=None,
                        preferred_terms=preferred, minimum_teeth=minimum,
                    )
                    if record:
                        records.append(record)
            except Exception as exc:
                failures.append({"provider": "ccmixter", "playlist_id": playlist["id"], "query": query, "license_class": requested, "error": base.clean(exc, 900)})
    return records, failures


def enrich_outputs(config: dict) -> None:
    catalog_path = OUTPUT_DIR / "catalog.json"
    daily_path = OUTPUT_DIR / "daily-batch.json"
    manifest_path = OUTPUT_DIR / "lazy-manifest.json"
    policy_path = OUTPUT_DIR / "policy.json"

    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    daily = json.loads(daily_path.read_text(encoding="utf-8"))
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    policy = json.loads(policy_path.read_text(encoding="utf-8"))

    by_id = {row.get("candidate_id"): row for row in catalog.get("records") or []}
    fields = ("vocal_verified", "vocal_evidence", "instrumental_only", "teeth_score", "themes", "explicit", "curation")
    for collection in (daily.get("candidates") or [], manifest.get("entries") or []):
        for row in collection:
            source = by_id.get(row.get("candidate_id")) or {}
            for field in fields:
                if field in source:
                    row[field] = source[field]

    vocal_policy = config.get("vocal_policy") or {}
    policy.update({
        "vocal_required": True,
        "instrumental_only_rejected": True,
        "minimum_teeth_score": max(1, min(5, int(vocal_policy.get("minimum_teeth_score") or 2))),
        "selection_rule": "Every published candidate has verified vocals and lyrical substance; instrumental-only candidates are rejected.",
        "discovery_provider_scope": list(config.get("providers") or ["ccmixter"]),
    })

    curated = {
        "schema": "civweave.open-music-curated-playlists.v1",
        "built_at": daily.get("built_at"),
        "vocal_required": True,
        "instrumental_only_rejected": True,
        "playlists": [],
    }
    for playlist in config.get("playlists") or []:
        entries = []
        for row in daily.get("candidates") or []:
            if row.get("playlist_id") != playlist.get("id"):
                continue
            entries.append({key: row.get(key) for key in (
                "candidate_id", "title", "artist", "provider", "provider_id", "source_url",
                "license", "files", "attribution", "vocal_verified", "instrumental_only",
                "teeth_score", "themes", "explicit", "curation",
            )})
        curated["playlists"].append({"id": playlist.get("id"), "name": playlist.get("name"), "entries": entries})

    catalog_path.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    daily_path.write_text(json.dumps(daily, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    policy_path.write_text(json.dumps(policy, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (OUTPUT_DIR / "curated-playlists.json").write_text(json.dumps(curated, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> None:
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    if set(config.get("accepted_licenses") or []) != base.ALLOWED:
        raise SystemExit("Open music config must exactly match the code-level redistribution allowlist.")
    providers = set(config.get("providers") or ["ccmixter"])
    if providers != {"ccmixter"}:
        raise SystemExit("Vocal harvester v2 currently requires the ccMixter-only provider scope.")

    policy = config.get("vocal_policy") or {}
    if policy.get("require_vocals") is not True or policy.get("reject_instrumental_only") is not True:
        raise SystemExit("Vocal harvester requires require_vocals=true and reject_instrumental_only=true.")

    records, failures = [], []
    for playlist in config.get("playlists") or []:
        curated, curated_failures = harvest_curated(playlist, policy)
        discovered, discovery_failures = harvest_discovery(playlist, policy)
        print(f"{playlist['id']:15} curated={len(curated):2} discovered={len(discovered):3}")
        records.extend(curated)
        records.extend(discovered)
        failures.extend(curated_failures)
        failures.extend(discovery_failures)

    summary = base.build_outputs(records, failures, config)
    enrich_outputs(config)
    if summary["records"] <= 0:
        raise SystemExit("Vocal-first harvest produced no rights-cleared tracks; refusing to publish an empty refresh.")
    print(json.dumps({**summary, "vocal_required": True, "instrumental_only_rejected": True}, indent=2))


if __name__ == "__main__":
    main()
