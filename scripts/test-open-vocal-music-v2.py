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
source_item = {
    'upload_id': '900001', 'upload_name': 'A Better Community',
    'user_name': 'songwriter', 'file_page_url': 'https://ccmixter.org/files/songwriter/900001',
    'upload_tags': 'remix media female_vocals attribution audio mp3',
    'upload_description': 'A full-song mix with lead singing.',
    'license_url': 'https://creativecommons.org/licenses/by/3.0/',
    'license_name': 'Attribution (3.0)',
    'files': [{'download_url': 'https://ccmixter.org/content/songwriter/a-better-community.mp3',
               'file_rawsize': '3200000'}],
}
candidate = mod.record_from_item(
    {'id': 'civweave'}, source_item, 'by', 'source-page:900001',
    review_seed={'themes': ['cooperation', 'creative commons']},
    preferred_terms=['freedom'], minimum_teeth=1,
)
require(candidate is not None, 'Source-page candidates with verified CC-BY, vocals, and audio should be eligible')
require(candidate['curation'] == 'web-source-candidate', 'Source-page candidate must not pretend to be hand-curated')
require(candidate['explicit'] is None, 'Source-page candidates must never silently be declared non-explicit')
require('cooperation' in candidate['themes'], 'Web-sourced candidate should retain source-informed themes')
noncommercial = {**source_item, 'license_url': 'https://creativecommons.org/licenses/by-nc/3.0/'}
require(mod.record_from_item(
    {'id':'civweave'}, noncommercial, 'by', 'source-page:900001',
    review_seed={'themes':['cooperation']}, preferred_terms=[], minimum_teeth=1,
) is None, 'CC-BY-NC recording must not enter the source-page candidate catalog')
vocal_stem = {**source_item, 'upload_name': 'Lead Vocal Stems Only'}
require(mod.record_from_item(
    {'id':'civweave'}, vocal_stem, 'by', 'source-page:900001',
    review_seed={'themes':['cooperation']}, preferred_terms=[], minimum_teeth=1,
) is None, 'A vocal-only stem should not be represented as a finished song')
print('open-vocal-music source-page candidate license + audit controls: ok')

print('open-vocal-music vocal + teeth gate: ok')
