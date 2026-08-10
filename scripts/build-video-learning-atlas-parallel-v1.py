#!/usr/bin/env python3
"""Parallel, rate-conscious materializer for build-video-learning-atlas-v1.py."""
from __future__ import annotations

import gzip
import importlib.util
import json
import os
import re
import sys
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import timedelta
from pathlib import Path

BASE_PATH = Path(__file__).with_name('build-video-learning-atlas-v1.py')
spec = importlib.util.spec_from_file_location('civweave_video_atlas_base', BASE_PATH)
base = importlib.util.module_from_spec(spec)
assert spec and spec.loader
sys.modules[spec.name] = base
spec.loader.exec_module(base)

WORKERS = max(2, min(int(os.environ.get('VIDEO_ATLAS_WORKERS', '4')), 8))
SEARCH_ROWS = max(40, min(int(os.environ.get('VIDEO_ATLAS_SEARCH_ROWS', '100')), 100))

# Use viewer-backed sources only. The PleIAs YouTube-Commons repository is excellent
# archival material but its Dataset Viewer is currently unavailable. Common Pile's
# filtered Creative Commons YouTube corpus exposes equivalent open video provenance
# plus title, description and transcript text through the viewer API.
base.SOURCES = [
    {
        'id': 'massive-yt-edu-queue',
        'dataset': 'thepowerfuldeez/massive-yt-edu-queue',
        'license': 'MIT metadata dataset; individual video rights vary',
        'role': 'broad educational discovery',
    },
    {
        'id': 'common-pile-youtube',
        'dataset': 'common-pile/youtube_filtered',
        'license': 'Creative Commons YouTube corpus; CC provenance retained per record',
        'role': 'open title, description, transcript and provenance layer',
    },
    {
        'id': 'howto-interlink7m',
        'dataset': 'Awiny/Howto-Interlink7M',
        'license': 'Apache-2.0 dataset; derived from HowTo100M source videos',
        'role': 'practical procedural layer',
        'upstream': 'HowTo100M',
    },
]

SCHOOL_SEARCH = {
    'people': 'human development biography',
    'history': 'history',
    'geography': 'geography',
    'arts': 'art music design',
    'everyday-life': 'cooking gardening repair',
    'philosophy-and-religion': 'philosophy ethics religion',
    'society-and-social-sciences': 'sociology psychology economics',
    'health-medicine-and-disease': 'health medicine anatomy',
    'science': 'science physics biology chemistry',
    'technology': 'technology engineering programming electronics',
    'mathematics': 'mathematics algebra geometry calculus',
}

_original_normalize = base.normalize_row
_original_score = base.score


def _metadata(value):
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}
    return {}


def normalize_row(source_id, row, query, rank):
    if source_id != 'common-pile-youtube':
        return _original_normalize(source_id, row, query, rank)
    video_id = base.clean_text(row.get('id'), 20)
    if not re.fullmatch(r'[\w-]{11}', video_id):
        return None
    metadata = _metadata(row.get('metadata'))
    description = base.clean_text(row.get('description'), 1200)
    transcript = base.clean_text(row.get('text'), 900)
    digest = description or transcript
    if description and transcript and transcript.lower() not in description.lower():
        digest = base.clean_text(f'{description} Transcript excerpt: {transcript}', 1800)
    return {
        'video_id': video_id,
        'url': base.youtube_url(video_id),
        'title': base.clean_text(row.get('title'), 180),
        'creator': base.clean_text(row.get('channel_id'), 160),
        'duration_seconds': int(row.get('duration') or 0),
        'language': 'en',
        'catalog_description': digest,
        'catalog_description_source': 'open YouTube description/transcript' if digest else None,
        'source_datasets': [source_id],
        'source_details': {
            source_id: {
                'license': base.clean_text(metadata.get('license'), 180) or 'Creative Commons',
                'provenance': base.clean_text(metadata.get('provenance'), 180),
                'published_time': base.clean_text(row.get('published_time'), 48),
                'matched_query': query,
                'result_rank': rank,
            }
        },
    }


def score(record, keyword_index=0):
    points = _original_score(record, keyword_index)
    if 'common-pile-youtube' in set(record.get('source_datasets') or []):
        points += 28
    return points


base.normalize_row = normalize_row
base.score = score


def _merge_candidate(merged, scoring, record, rank_penalty=0):
    if not record:
        return
    video_id = record['video_id']
    if video_id in merged:
        base.merge_record(merged[video_id], record)
    else:
        merged[video_id] = record
    scoring[video_id] = max(scoring[video_id], base.score(merged[video_id], 0) - rank_penalty)


def discover_school_compact(school):
    """Use one broad query per source, then one primary-source fallback if sparse.

    The Dataset Viewer search service is shared infrastructure. A compact query plan
    is materially more reliable than spraying four keyword searches across every
    source and school, while 100 rows from each of three sources still gives enough
    candidates to curate up to 250 records per school.
    """
    merged = {}
    scoring = defaultdict(int)
    failures = []
    broad = SCHOOL_SEARCH.get(school['slug']) or school['keywords'][0]
    for source in base.SOURCES:
        try:
            rows = base.hf_search(source['dataset'], broad, length=SEARCH_ROWS)
        except Exception as exc:
            failures.append({'source': source['id'], 'query': broad, 'error': base.clean_text(exc, 300)})
            continue
        for rank, row in enumerate(rows, start=1):
            _merge_candidate(merged, scoring, base.normalize_row(source['id'], row, broad, rank), rank // 5)
        time.sleep(0.12)

    # If the broad plan was sparse, spend exactly one extra request on the primary
    # educational queue using the most concrete school keyword.
    if len(merged) < min(base.PER_SCHOOL, 100):
        primary = next((source for source in base.SOURCES if source['id'] == 'massive-yt-edu-queue'), None)
        fallback_query = school['keywords'][0]
        if primary and fallback_query != broad:
            try:
                rows = base.hf_search(primary['dataset'], fallback_query, length=SEARCH_ROWS)
                for rank, row in enumerate(rows, start=1):
                    _merge_candidate(merged, scoring, base.normalize_row(primary['id'], row, fallback_query, rank), rank // 5)
            except Exception as exc:
                failures.append({'source': primary['id'], 'query': fallback_query, 'error': base.clean_text(exc, 300)})

    ranked = sorted(merged.values(), key=lambda record: (-scoring[record['video_id']], record.get('title') or record['video_id']))
    selected = ranked[:base.PER_SCHOOL]
    for index, record in enumerate(selected, start=1):
        record['school_slug'] = school['slug']
        record['school_name'] = school['name']
        record['rank'] = index
        record['selection_score'] = scoring[record['video_id']]
    return selected, failures


def discover_parallel():
    # Resolve dataset splits once before workers touch the shared split cache. Drop
    # any unavailable source for this build rather than retrying it for every query.
    available_sources = []
    for source in base.SOURCES:
        try:
            base._SPLITS[source['dataset']] = base.hf_split(source['dataset'])
            available_sources.append(source)
        except Exception as exc:
            print(f"source split unavailable: {source['id']}: {exc}", flush=True)
    base.SOURCES = available_sources
    if not base.SOURCES:
        raise RuntimeError('No Video Learning Atlas source has an available Dataset Viewer split.')
    discovered = {}
    failures = {}
    with ThreadPoolExecutor(max_workers=min(WORKERS, len(base.SCHOOLS))) as pool:
        future_map = {pool.submit(discover_school_compact, school): school for school in base.SCHOOLS}
        for future in as_completed(future_map):
            school = future_map[future]
            try:
                records, school_failures = future.result()
            except Exception as exc:
                records, school_failures = [], [{'source': 'school-worker', 'query': school['slug'], 'error': base.clean_text(exc, 300)}]
            discovered[school['slug']] = records
            failures[school['slug']] = school_failures
            print(f"{school['slug']}: {len(records)} selected; {len(school_failures)} discovery failures", flush=True)
    return discovered, failures


def build():
    root = base.OUTPUT_DIR
    root.mkdir(parents=True, exist_ok=True)
    for old in root.glob('civweave-video-atlas-*.zip'):
        old.unlink()
    sidecar_path = root / 'youtube-metadata-current.json.gz'
    if sidecar_path.exists():
        sidecar_path.unlink()

    built_at = base.now_utc()
    discovered, failure_map = discover_parallel()
    schools_payload = []
    all_records = []
    all_failures = []

    # Write in canonical SCHOOLS order so output ordering is deterministic.
    for school in base.SCHOOLS:
        records = discovered.get(school['slug'], [])
        failures = failure_map.get(school['slug'], [])
        all_records.extend(records)
        all_failures.extend([{'school_slug': school['slug'], **failure} for failure in failures])
        payload = {
            'schema': 'civweave.video-learning-atlas.school.v1',
            'built_at': base.iso(built_at),
            'school_slug': school['slug'],
            'school_name': school['name'],
            'keywords': school['keywords'],
            'count': len(records),
            'records': records,
        }
        readme = (
            f"Civweave Video Learning Atlas — {school['name']}\n"
            f"Built: {base.iso(built_at)}\n"
            "This package contains links and lightweight metadata only; it contains no YouTube video files.\n"
            "Descriptions in this durable package come only from source-dataset text with compatible provenance.\n"
            "Current YouTube API descriptions, when available, are distributed separately as a 30-day refresh sidecar.\n"
        ).encode('utf-8')
        pack = base.write_zip(
            root / f"civweave-video-atlas-{school['slug']}.zip",
            {
                'catalog.json': json.dumps(payload, ensure_ascii=False, indent=2).encode('utf-8'),
                'README.txt': readme,
            },
        )
        schools_payload.append({
            'school_slug': school['slug'],
            'school_name': school['name'],
            'keywords': school['keywords'],
            'count': len(records),
            'zip_file': pack['file'],
            'zip_bytes': pack['bytes'],
            'zip_human': base.human_bytes(pack['bytes']),
            'zip_sha256': pack['sha256'],
        })

    sidecar, enrichment = base.youtube_enrich(all_records)
    expires_at = built_at + timedelta(days=29)
    sidecar_meta = None
    if sidecar:
        sidecar_payload = {
            'schema': 'civweave.youtube-api-metadata-sidecar.v1',
            'built_at': base.iso(built_at),
            'expires_at': base.iso(expires_at),
            'refresh_required_days': 30,
            'records': sidecar,
        }
        raw = base.json_bytes(sidecar_payload)
        compressed = gzip.compress(raw, compresslevel=9, mtime=0)
        sidecar_path.write_bytes(compressed)
        sidecar_meta = {
            'file': sidecar_path.name,
            'bytes': len(compressed),
            'human': base.human_bytes(len(compressed)),
            'sha256': base.sha256_bytes(compressed),
            'records': len(sidecar),
            'built_at': base.iso(built_at),
            'expires_at': base.iso(expires_at),
            'refresh_required_days': 30,
        }

    all_payload = {
        'schema': 'civweave.video-learning-atlas.core.v1',
        'built_at': base.iso(built_at),
        'records': all_records,
        'sources': base.SOURCES,
        'discovery_failures': all_failures,
    }
    core_pack = base.write_zip(
        root / 'civweave-video-atlas-core.zip',
        {
            'catalog.json': json.dumps(all_payload, ensure_ascii=False, indent=2).encode('utf-8'),
            'sources.json': json.dumps(base.SOURCES, ensure_ascii=False, indent=2).encode('utf-8'),
            'README.txt': (
                'Civweave Video Learning Atlas — complete core\n'
                f"Built: {base.iso(built_at)}\n"
                f"Records: {len(all_records)} across {len(base.SCHOOLS)} foundation schools.\n"
                'No video binaries are included. Follow the YouTube URLs when online.\n'
                'Source-dataset text/provenance is durable; YouTube Data API descriptions are kept in a separate expiring sidecar.\n'
            ).encode('utf-8'),
        },
    )

    source_stats = defaultdict(int)
    for record in all_records:
        for source in record.get('source_datasets') or []:
            source_stats[source] += 1

    catalog = {
        'schema': 'civweave.video-learning-atlas.catalog.v1',
        'built_at': base.iso(built_at),
        'per_school_target': base.PER_SCHOOL,
        'total_records': len(all_records),
        'unique_video_ids': len({record['video_id'] for record in all_records}),
        'sources': base.SOURCES,
        'source_record_counts': dict(source_stats),
        'core_bundle': {
            'file': core_pack['file'],
            'bytes': core_pack['bytes'],
            'human': base.human_bytes(core_pack['bytes']),
            'sha256': core_pack['sha256'],
            'records': len(all_records),
        },
        'schools': schools_payload,
        'youtube_api_enrichment': enrichment,
        'youtube_metadata_sidecar': sidecar_meta,
        'discovery_failure_count': len(all_failures),
        'materializer': {
            'mode': 'parallel-rate-conscious-school-search',
            'workers': WORKERS,
            'search_rows': SEARCH_ROWS,
            'planned_primary_searches': len(base.SCHOOLS) * len(base.SOURCES),
        },
    }
    (root / 'catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    sums = []
    for path in sorted(root.iterdir()):
        if path.is_file() and path.name != 'SHA256SUMS':
            sums.append(f"{base.sha256_bytes(path.read_bytes())}  {path.name}")
    (root / 'SHA256SUMS').write_text('\n'.join(sums) + '\n', encoding='utf-8')

    print(json.dumps({
        'output_dir': str(root),
        'records': len(all_records),
        'unique_video_ids': catalog['unique_video_ids'],
        'enrichment': enrichment,
        'sidecar': sidecar_meta,
        'workers': WORKERS,
        'sources': [source['id'] for source in base.SOURCES],
        'failures': len(all_failures),
    }, indent=2), flush=True)


if __name__ == '__main__':
    build()
