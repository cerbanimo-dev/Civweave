#!/usr/bin/env python3
"""Expose the durable Video Learning Atlas records as a browser-readable lookup."""
from __future__ import annotations
import json
import sys
import zipfile
from pathlib import Path

root = Path(sys.argv[1] if len(sys.argv) > 1 else 'public/downloads/knowledge-schools/video-atlases')
core = root / 'civweave-video-atlas-core.zip'
out = root / 'lookup.json'
if not core.exists():
    raise SystemExit(f'missing {core}')
with zipfile.ZipFile(core) as archive:
    payload = json.loads(archive.read('catalog.json'))
records = payload.get('records') or []
lookup = {
    'schema': 'civweave.video-learning-atlas.lookup.v1',
    'built_at': payload.get('built_at'),
    'count': len(records),
    'records': records,
}
out.write_text(json.dumps(lookup, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
print(json.dumps({'lookup': str(out), 'records': len(records), 'bytes': out.stat().st_size}))
