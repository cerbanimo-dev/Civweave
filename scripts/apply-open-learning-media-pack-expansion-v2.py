#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

BASE = Path('config/open-learning-media-packs-v1.json')
EXPANSION = Path('config/open-learning-media-pack-expansion-v2.json')

base = json.loads(BASE.read_text(encoding='utf-8'))
expansion = json.loads(EXPANSION.read_text(encoding='utf-8'))

if base.get('schema') != 'civweave.open-learning-media-pack-registry.v1':
    raise SystemExit('Unexpected base pack registry schema.')
if expansion.get('schema') != 'civweave.open-learning-media-pack-expansion.v2':
    raise SystemExit('Unexpected pack expansion schema.')


def merge_rows(existing: list[dict], additions: list[dict]) -> list[dict]:
    by_slug = {str(row.get('slug') or ''): dict(row) for row in existing if row.get('slug')}
    order = [str(row.get('slug')) for row in existing if row.get('slug')]
    for row in additions:
        slug = str(row.get('slug') or '')
        if not slug:
            continue
        if slug not in by_slug:
            order.append(slug)
        by_slug[slug] = dict(row)
    return [by_slug[slug] for slug in order]

base['packs'] = merge_rows(base.get('packs') or [], expansion.get('packs') or [])
base['topics'] = merge_rows(base.get('topics') or [], expansion.get('topics') or [])
base['revision'] = str(expansion.get('revision') or base.get('revision') or 'subject-media-packs-v2')

pack_slugs = [row['slug'] for row in base['packs']]
topic_slugs = {row['slug'] for row in base['topics']}
if len(pack_slugs) != len(set(pack_slugs)):
    raise SystemExit('Duplicate media pack slug after expansion.')
if any(topic not in topic_slugs for pack in base['packs'] for topic in pack.get('topics') or []):
    missing = sorted({topic for pack in base['packs'] for topic in pack.get('topics') or [] if topic not in topic_slugs})
    raise SystemExit(f'Pack expansion references unknown topics: {missing}')

BASE.write_text(json.dumps(base, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
print(json.dumps({'revision': base['revision'], 'packs': len(base['packs']), 'topics': len(base['topics'])}, indent=2))
