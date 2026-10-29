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
import concurrent.futures
import threading
import re
import urllib.request
from html.parser import HTMLParser
from datetime import datetime, timezone, timedelta
import json
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
    "rap", "rapper", "singing", "singer", "lyrics", "lyric", "voice", "voices",
}
INSTRUMENTAL_ONLY_MARKERS = {
    "instrumental_only", "instrumental only", "no_vocals", "no vocals", "without vocals",
}
BASE_QUALITY_SCORE = base.quality_score


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


def vocal_quality_score(record: dict) -> int:
    score = BASE_QUALITY_SCORE(record)
    score += 35 if record.get("curation") == "hand-seeded" else 0
    score += 5 if record.get("vocal_verified") is True else 0
    score += max(0, min(5, int(record.get("teeth_score") or 0))) * 4
    return score


base.quality_score = vocal_quality_score


def ccmixter_rows(params: dict) -> list[dict]:
    query = urllib.parse.urlencode(params)
    data = base.request_json(f"https://ccmixter.org/api/query?{query}")
    if isinstance(data, list):
        return [row for row in data if isinstance(row, dict)]
    if isinstance(data, dict):
        rows = data.get("items") or data.get("results") or []
        return [row for row in rows if isinstance(row, dict)]
    return []


DETAIL_CACHE: dict[str, dict] = {}
DETAIL_LOCK = threading.Lock()


def detailed_upload(row: dict) -> dict:
    """Resolve listing rows to the source site's detailed single-upload view."""
    uid = base.clean(row.get("upload_id") or row.get("id"), 120)
    if not uid:
        return row
    with DETAIL_LOCK:
        cached = DETAIL_CACHE.get(uid)
    if cached is not None:
        return cached
    detailed = row
    try:
        matches = ccmixter_rows({"f": "json", "dataview": "info", "ids": uid, "limit": 1})
        detailed = next((candidate for candidate in matches if base.clean(candidate.get("upload_id") or candidate.get("id"), 120) == uid), row)
    except Exception:
        pass
    with DETAIL_LOCK:
        DETAIL_CACHE[uid] = detailed
    return detailed


def record_from_item(
    playlist: dict,
    item: dict,
    requested_license: str,
    matched_query: str,
    *,
    curated: dict | None = None,
    preferred_terms: list[str],
    minimum_teeth: int,
    genre_tag: str | None = None,
    review_seed: dict | None = None,
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
        name = normalized_text(item.get("upload_name") or item.get("name") or item.get("title"))
        if any(part in name for part in ("vocal stem", "instrumental stem", "acappella stem", "acapella", "sample pack", "sample set", "stems only", "loop pack", "demo snippet", "vocal only", "instrumental only")):
            return None
        score, themes = teeth_score(item, preferred_terms)
        if genre_tag is None and review_seed is None and score < minimum_teeth:
            return None
        if genre_tag is not None:
            themes.append("genre:" + genre_tag)
        if review_seed is not None:
            curated_themes = [base.clean(value, 80) for value in review_seed.get("themes") or [] if base.clean(value, 80)]
            themes = list(dict.fromkeys(curated_themes + themes))
        explicit = None  # Lyrical language unreviewed; never imply family-safe.
        curation = "web-source-candidate" if review_seed is not None else ("genre-discovered" if genre_tag is not None else "metadata-discovered")
        vocal_evidence = "ccMixter source metadata contains an affirmative vocal/voice/lyric marker; audio and lyrics have not been manually audited"
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


class SourcePlaylistLinks(HTMLParser):
    """Collect only concrete /files/creator/id song links from a ccMixter playlist."""
    def __init__(self):
        super().__init__()
        self.ids = []
        self.seen = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "a":
            return
        href = dict(attrs).get("href") or ""
        parsed = urllib.parse.urlparse(urllib.parse.urljoin("https://ccmixter.org/", href))
        if parsed.hostname not in ("ccmixter.org", "www.ccmixter.org"):
            return
        match = re.fullmatch(r"/files/[^/]+/(\d+)", parsed.path)
        if match and match.group(1) not in self.seen:
            self.seen.add(match.group(1))
            self.ids.append(match.group(1))


def harvest_community_playlists(config: dict, policy: dict) -> tuple[list[dict], list[dict]]:
    """Read curated community playlist pages, then enforce the upload's own license.

    Playlist membership is only discovery evidence. No playlist-level statement
    can substitute for the exact upload's license, file, and vocal checks.
    """
    settings = config.get("community_playlist_discovery") or {}
    if settings.get("enabled") is not True:
        return [], []
    playlist_by_id = {p["id"]: p for p in config.get("playlists") or []}
    records, failures = [], []
    maximum = max(1, min(120, int(settings.get("max_uploads_per_playlist") or 70)))
    for page in settings.get("source_playlists") or []:
        source_id = base.clean(page.get("id"), 20)
        target = playlist_by_id.get(page.get("system"))
        if not source_id.isdigit() or not target:
            continue
        url = f"https://ccmixter.org/playlist/browse/{source_id}"
        try:
            request = urllib.request.Request(url, headers={"User-Agent": base.USER_AGENT, "Accept": "text/html"})
            with urllib.request.urlopen(request, timeout=base.REQUEST_TIMEOUT) as response:
                html = response.read(1_500_000).decode("utf-8", errors="replace")
            links = SourcePlaylistLinks()
            links.feed(html)
            ids = links.ids[:maximum]
            print(f"community-playlist {source_id}: {len(ids)} exact source upload IDs")
            for uid in ids:
                try:
                    item = detailed_upload({"upload_id": uid})
                    if base.clean(item.get("upload_id") or item.get("id"), 120) != uid:
                        continue
                    candidate = record_from_item(
                        target, item, "by", f"community-playlist:{source_id}",
                        preferred_terms=list(policy.get("preferred_terms") or []),
                        minimum_teeth=1, genre_tag="community-playlist:" + source_id,
                    )
                    if candidate:
                        candidate["curation"] = "community-playlist-unreviewed"
                        candidate["themes"] = list(dict.fromkeys(
                            [base.clean(t, 80) for t in page.get("themes") or [] if base.clean(t, 80)]
                            + candidate.get("themes", [])
                        ))
                        records.append(candidate)
                except Exception as exc:
                    failures.append({
                        "provider": "ccmixter", "playlist_id": target["id"],
                        "query": f"community-playlist:{source_id}:{uid}",
                        "error": base.clean(exc, 900),
                    })
        except Exception as exc:
            failures.append({
                "provider": "ccmixter", "playlist_id": target["id"],
                "query": f"community-playlist:{source_id}",
                "error": base.clean(exc, 900),
            })
    return records, failures


def harvest_review_candidates(playlist: dict, policy: dict) -> tuple[list[dict], list[dict]]:
    """Import exact source-page-discovered candidates without claiming a listening review.

    Each upload must independently pass the upstream license check, contain a
    qualifying direct audio file, and exhibit affirmative vocal source metadata.
    A web-page attribution statement alone never bypasses these checks.
    """
    records, failures = [], []
    preferred = list(policy.get("preferred_terms") or [])
    minimum = max(1, min(5, int(policy.get("minimum_teeth_score") or 2)))
    for seed in playlist.get("review_candidates_ccmixter") or []:
        uid = base.clean(seed.get("id"), 120)
        if not uid or not uid.isdigit():
            continue
        try:
            rows = ccmixter_rows({"f": "json", "dataview": "info", "ids": uid, "limit": 1})
            matched = None
            for item in rows:
                if base.clean(item.get("upload_id") or item.get("id"), 120) != uid:
                    continue
                candidate = record_from_item(
                    playlist, item, "by", f"source-page:{uid}", review_seed=seed,
                    preferred_terms=preferred, minimum_teeth=minimum,
                )
                if candidate and candidate["license"]["spdx"] == "CC-BY":
                    matched = candidate
                    break
            if matched:
                records.append(matched)
            else:
                failures.append({
                    "provider": "ccmixter", "playlist_id": playlist["id"], "query": f"source-page:{uid}",
                    "error": "No CC-BY-licensed, audio-bearing, source-metadata-confirmed vocal recording for exact source upload ID",
                })
        except Exception as exc:
            failures.append({
                "provider": "ccmixter", "playlist_id": playlist["id"], "query": f"source-page:{uid}",
                "error": base.clean(exc, 900),
            })
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


def harvest_genre_discovery(playlist: dict, policy: dict, settings: dict) -> tuple[list[dict], list[dict]]:
    """Find additional genuinely licensed vocal recordings by source genre tags.

    Genre can support a station's musical character, not its lyrical ideology.
    No lyrics are presumed safe without a separate lyric audit.
    """
    records, failures = [], []
    preferred = list(policy.get("preferred_terms") or [])
    minimum = max(1, min(5, int(policy.get("minimum_teeth_score") or 2)))
    per_page = max(5, min(40, int(settings.get("results_per_page") or 35)))
    pages = max(1, min(5, int(settings.get("pages_per_tag") or 3)))
    classes = [value for value in (settings.get("license_classes") or ["by", "sa"]) if value in ("by", "sa", "pd")]
    for genre in (playlist.get("genre_tags") or []):
        for requested in classes:
            inspected = 0
            for offset in range(0, per_page * pages, per_page):
                try:
                    rows = ccmixter_rows({
                        "f": "json", "dataview": "default", "limit": per_page,
                        "offset": offset, "tags": genre, "type": "any", "lic": requested,
                        "sort": "num_scores", "ord": "desc",
                    })
                    if not rows:
                        break
                    for item in rows:
                        if inspected >= 10:
                            break
                        inspected += 1
                        record = record_from_item(
                            playlist, detailed_upload(item), requested, f"genre:{genre}",
                            curated=None, preferred_terms=preferred,
                            minimum_teeth=minimum, genre_tag=genre,
                        )
                        if record:
                            records.append(record)
                    if len(rows) < per_page or inspected >= 10:
                        break
                except Exception as exc:
                    failures.append({
                        "provider": "ccmixter", "playlist_id": playlist["id"],
                        "query": f"genre:{genre}", "license_class": requested,
                        "offset": offset, "error": base.clean(exc, 900),
                    })
                    break
    return records, failures


def harvest_broad_vocals(playlist: dict, policy: dict, settings: dict) -> tuple[list[dict], list[dict]]:
    """Long-tail source-tag discovery for review, not automatic lyric approval."""
    records, failures = [], []
    diagnostics = []
    per_page = max(5, min(40, int(settings.get("results_per_page") or 35)))
    pages = max(1, min(20, int(settings.get("broad_pages_per_tag") or 12)))
    preferred = list(policy.get("preferred_terms") or [])
    minimum = max(1, min(5, int(policy.get("minimum_teeth_score") or 2)))
    for tag in settings.get("broad_vocal_tags") or []:
        for requested in settings.get("license_classes") or ["by", "sa"]:
            if requested not in ("by", "sa", "pd"):
                continue
            scanned, accepted, pages_seen, inspected = 0, 0, 0, 0
            for offset in range(0, per_page * pages, per_page):
                try:
                    rows = ccmixter_rows({
                        "f": "json", "dataview": "default", "limit": per_page,
                        "offset": offset, "tags": tag, "lic": requested,
                        "sort": "date", "ord": "desc",
                    })
                    if not rows:
                        break
                    scanned += len(rows)
                    pages_seen += 1
                    for item in rows:
                        if inspected >= 30:
                            break
                        inspected += 1
                        record = record_from_item(
                            playlist, detailed_upload(item), requested, f"vocal-pool:{tag}",
                            preferred_terms=preferred, minimum_teeth=minimum,
                            genre_tag="vocal-pool:" + tag,
                        )
                        if record:
                            record["curation"] = "vocal-pool-unreviewed"
                            records.append(record)
                            accepted += 1
                    if len(rows) < per_page or inspected >= 30:
                        break
                except Exception as exc:
                    failures.append({
                        "provider": "ccmixter", "playlist_id": playlist["id"],
                        "query": f"vocal-pool:{tag}", "license_class": requested,
                        "offset": offset, "error": base.clean(exc, 900),
                    })
                    break
            diagnostics.append({"tag": tag, "license_class": requested, "pages_seen": pages_seen, "scanned": scanned, "inspected": inspected, "accepted": accepted})
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "vocal-pool-scan.json").write_text(json.dumps({
        "schema": "civweave.open-music-vocal-pool-scan.v1",
        "at": base.now_iso(), "diagnostics": diagnostics,
        "note": "Source API result totals are pre-license and pre-quality filtering; these are candidate counts, not approved tracks.",
    }, indent=2) + "\n", encoding="utf-8")
    return records, failures


def recently_verified_catalog(max_days: int = 10) -> list[dict]:
    """Protect the radio against transient upstream harvest failures.

    Previously licensed entries only survive within a short bounded verification
    window; stale source claims never become permanent permission to stream.
    """
    path = OUTPUT_DIR / "catalog.json"
    if not path.is_file():
        return []
    try:
        packet = json.loads(path.read_text(encoding="utf-8"))
        stamp = datetime.fromisoformat(str(packet.get("built_at", "")).replace("Z", "+00:00"))
        if stamp.tzinfo is None or datetime.now(timezone.utc) - stamp > timedelta(days=max_days):
            return []
        accepted = []
        for row in packet.get("records") or []:
            lic, files = row.get("license") or {}, row.get("files") or []
            if row.get("provider") != "ccmixter" or not base.validate_record(row):
                continue
            if lic.get("commercial_use") is not True or lic.get("redistribution") is not True:
                continue
            if not str(row.get("source_url") or "").startswith("https://ccmixter.org/files/"):
                continue
            if not any(str(f.get("url") or "").startswith("https://ccmixter.org/content/") and str(f.get("url") or "").lower().endswith(".mp3") for f in files):
                continue
            if row.get("vocal_verified") is not True or row.get("explicit") is True:
                continue
            old = dict(row)
            old["carried_forward"] = True
            old["last_verified_at"] = packet["built_at"]
            accepted.append(old)
        return accepted
    except (ValueError, OSError, KeyError, TypeError):
        return []


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
    fields = ("vocal_verified", "vocal_evidence", "instrumental_only", "teeth_score", "themes", "explicit", "curation", "playlist_id", "playlist_matches", "provider", "carried_forward", "last_verified_at")
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
        "selection_rule": "Source license and vocal metadata are checked before discovery. Genre and vocal tags are signals, not listening or lyric audits. Only hand-seeded recordings were manually reviewed; other recordings remain unreviewed candidates and are excluded from S.A.F.E. playback.",
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
    playlists = config.get("playlists") or []
    genre_settings = config.get("genre_discovery") or {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = {}
        for playlist in playlists:
            futures[executor.submit(harvest_discovery, playlist, policy)] = ("themed", playlist)
            if genre_settings.get("enabled") is True:
                futures[executor.submit(harvest_genre_discovery, playlist, policy, genre_settings)] = ("genre", playlist)
                if playlist["id"] == genre_settings.get("broad_playlist_id", "civweave"):
                    futures[executor.submit(harvest_broad_vocals, playlist, policy, genre_settings)] = ("vocal-pool", playlist)
        for playlist in playlists:
            curated, curated_failures = harvest_curated(playlist, policy)
            records.extend(curated)
            failures.extend(curated_failures)
            review_candidates, review_failures = harvest_review_candidates(playlist, policy)
            print(f"{playlist['id']:15} web-sourced candidates={len(review_candidates):3}")
            records.extend(review_candidates)
            failures.extend(review_failures)
        community_candidates, community_failures = harvest_community_playlists(config, policy)
        print(f"community playlists discovered={len(community_candidates):3}")
        records.extend(community_candidates)
        failures.extend(community_failures)
        for future in concurrent.futures.as_completed(futures):
            lane, playlist = futures[future]
            discovered, discovery_failures = future.result()
            print(f"{playlist['id']:15} {lane} discovered={len(discovered):3}")
            records.extend(discovered)
            failures.extend(discovery_failures)

    previous = recently_verified_catalog()
    print(f"Previously source-verified MP3 candidates retained (10-day cap): {len(previous)}")
    records.extend(previous)
    summary = base.build_outputs(records, failures, config)
    enrich_outputs(config)
    if summary["records"] <= 0:
        raise SystemExit("Vocal-first harvest produced no rights-cleared tracks; refusing to publish an empty refresh.")
    print(json.dumps({**summary, "vocal_required": True, "instrumental_only_rejected": True}, indent=2))


if __name__ == "__main__":
    main()
