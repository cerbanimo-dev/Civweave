#!/usr/bin/env python3
from __future__ import annotations
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / 'scripts/harvest-open-vocal-music-v2.py'
spec = importlib.util.spec_from_file_location('open_vocal_music', PATH)
mod = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(mod)


def require(value, message):
    if not value:
        raise AssertionError(message)

vocal = {
    'upload_name': 'Freedom to Share',
    'upload_tags': 'remix media attribution female_vocals lyrics freedom commons share',
    'upload_description': 'A song about freedom, community, rights and sharing.'
}
instrumental = {
    'upload_name': 'Ambient Study',
    'upload_tags': 'instrumental_only ambient electronic',
    'upload_description': 'No vocals.'
}
weak_vocal = {
    'upload_name': 'Ordinary Love Song',
    'upload_tags': 'male_vocals pop',
    'upload_description': 'A simple song.'
}

require(mod.has_vocal_signal(vocal), 'Positive vocal metadata must pass')
require(not mod.has_vocal_signal(instrumental), 'Instrumental-only metadata must be rejected')
score, themes = mod.teeth_score(vocal, ['freedom', 'commons', 'share', 'justice'])
require(score >= 3 and 'freedom' in themes and 'commons' in themes, 'Thematic lyric signals must contribute to teeth score')
weak_score, _ = mod.teeth_score(weak_vocal, ['freedom', 'commons', 'share', 'justice'])
require(weak_score == 0, 'Vocals alone must not satisfy the lyrical substance gate')
print('open-vocal-music vocal + teeth gate: ok')
