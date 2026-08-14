#!/usr/bin/env python3
from __future__ import annotations
import importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PATH=ROOT/'scripts/harvest-open-music-v1.py'
spec=importlib.util.spec_from_file_location('open_music',PATH);mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)

def require(value,message):
    if not value: raise AssertionError(message)

cc0=mod.commons_license({'LicenseShortName':{'value':'CC0'},'UsageTerms':{'value':'Creative Commons Zero'},'LicenseUrl':{'value':'https://creativecommons.org/publicdomain/zero/1.0/'}})
require(cc0 and cc0['spdx']=='CC0','Commons CC0 must pass')
blocked=mod.commons_license({'LicenseShortName':{'value':'CC BY-NC 4.0'},'UsageTerms':{'value':'Attribution-NonCommercial'},'LicenseUrl':{'value':'https://creativecommons.org/licenses/by-nc/4.0/'}})
require(blocked is None,'NonCommercial Commons audio must be rejected')
require(mod.ia_license('https://creativecommons.org/licenses/by/4.0/')['spdx']=='CC-BY','IA CC BY must pass')
require(mod.ia_license('https://creativecommons.org/licenses/by-nd/4.0/') is None,'IA NoDerivatives must be rejected')
require(mod.ccmixter_license({'license_url':'https://creativecommons.org/licenses/by-sa/4.0/','license_name':'CC BY-SA 4.0'},'sa')['spdx']=='CC-BY-SA','ccMixter BY-SA must pass')
require(mod.ccmixter_license({'license_url':'https://creativecommons.org/licenses/by-nc/4.0/','license_name':'CC BY-NC 4.0'},'by') is None,'ccMixter NC must be rejected even if query class is unexpected')
valid={'license':mod.license_record('CC-BY','CC BY','https://creativecommons.org/licenses/by/4.0/','explicit fixture'), 'source_url':'https://example.test/track', 'files':[{'url':'https://example.test/track.ogg'}]}
require(mod.validate_record(valid),'Fully rights-cleared record must pass final gate')
invalid={**valid,'license':{'spdx':'CC-BY-NC','redistribution':False,'evidence':'fixture'}}
require(not mod.validate_record(invalid),'Final gate must reject unapproved licenses')
print('open-music strict license gate: ok')
