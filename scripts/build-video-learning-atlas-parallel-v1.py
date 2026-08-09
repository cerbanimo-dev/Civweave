#!/usr/bin/env python3
"""Parallel materializer for build-video-learning-atlas-v1.py."""
from __future__ import annotations

import gzip
import importlib.util
import json
import os
import sys
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

WORKERS = max(2, min(int(os.environ.get('VIDEO_ATLAS_WORKERS', '8')), 16))


def discover_parallel():
    # Resolve dataset splits once before workers touch the shared split cache.
    for source in base.SOURCES:
        try:
            base._SPLITS[source['dataset']] = base.hf_split(source['dataset'])
        except Exception as exc:
            print(f"source split unavailable: {source['id']}: {exc}", flush=True)
    discovered = {}
    failures = {}
    with ThreadPoolExecutor(max_workers=min(WORKERS, len(base.SCHOOLS))) as pool:
        future_map = {pool.submit(base.discover_school, school): school for school in base.SCHOOLS}
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
        'materializer': {'mode': 'parallel-school-search', 'workers': WORKERS},
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
    }, indent=2), flush=True)


if __name__ == '__main__':
    build()
