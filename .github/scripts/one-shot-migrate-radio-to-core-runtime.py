from pathlib import Path

p=Path('scripts/verify-system-radio-v233.mjs')
s=p.read_text()

old="const boundarySource=fs.readFileSync(new URL('public/app/install-boundary-v146.js',ROOT),'utf8');\n"
new=old+"const runtimeSource=fs.readFileSync(new URL('public/app/core-interface-runtime-v1.js',ROOT),'utf8');\n"
if "const runtimeSource=" not in s:
    if old not in s: raise SystemExit('radio boundary source declaration changed')
    s=s.replace(old,new,1)

old="""assert.match(boundarySource,/RADIO_TRACK_SUGGESTIONS='\\/app\\/radio-track-suggestions-v240\\.js'/,'install boundary must keep the stable v240 script path');
assert.ok(boundarySource.indexOf('SYSTEM_RADIO_AGENT,')<boundarySource.indexOf('RADIO_TRACK_SUGGESTIONS,'),'track decorator must load after the station card runtime');
assert.match(boundarySource,/radioRecommendationRevision:'v233-every-page-30-minute-snooze-bottom-left'/,'boundary metadata must describe the active station policy');
assert.match(boundarySource,/radioTrackSuggestionRevision:'v241-playlist-context-track-links'/,'stable boundary metadata must continue identifying the playlist-context compatibility family');"""
new="""assert.match(runtimeSource,/'\\/app\\/system-radio-agent-v233\\.js'/,'core interface runtime must carry the station recommendation agent');
assert.match(runtimeSource,/'\\/app\\/radio-track-suggestions-v240\\.js'/,'core interface runtime must keep the stable v240 track-decorator path');
assert.ok(runtimeSource.indexOf("'/app/system-radio-agent-v233.js'")<runtimeSource.indexOf("'/app/radio-track-suggestions-v240.js'"),'track decorator must load after the station card runtime');
assert.doesNotMatch(boundarySource,/SYSTEM_RADIO_AGENT\\s*=/,'install boundary must not regain radio loading ownership');
assert.doesNotMatch(boundarySource,/RADIO_TRACK_SUGGESTIONS\\s*=/,'install boundary must not regain track-decorator loading ownership');
assert.match(boundarySource,/radioRecommendationRevision:'v233-every-page-30-minute-snooze-bottom-left'/,'boundary metadata must describe the active station policy');
assert.match(boundarySource,/radioTrackSuggestionRevision:'v241-playlist-context-track-links'/,'stable boundary metadata must continue identifying the playlist-context compatibility family');"""
if old not in s: raise SystemExit('radio boundary ownership assertions changed')
s=s.replace(old,new,1)
p.write_text(s)
