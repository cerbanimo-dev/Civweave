import fs from 'node:fs';
import assert from 'node:assert/strict';

const ROOT=new URL('../',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,ROOT),'utf8');
const radioSource=read('public/app/system-radio-agent-v233.js');
const governanceSource=read('public/app/radio-playlist-governance-v1.js');
const trackSource=read('public/app/radio-track-suggestions-v240.js');
const boundarySource=read('public/app/install-boundary-v146.js');
const trackMap=JSON.parse(read('public/app/radio-track-map-v241.json'));
const stationFiles={
  anarchadia:'public/app/radio-directory-v240/anarchadia.txt',
  cerbanimo:'public/app/radio-directory-v240/cerbanimo.txt',
  'living-school':'public/app/radio-directory-v240/living-school.txt',
  fellowfare:'public/app/radio-directory-v240/fellowfare.txt',
  civweave:'public/app/radio-directory-v240/civweave.txt'
};
const stationLines=Object.fromEntries(Object.entries(stationFiles).map(([system,path])=>[
  system,read(path).split(/\r?\n/).map(line=>line.trim()).filter(Boolean)
]));

assert.match(radioSource,/const REVISION='system-radio-agent-v233-persistent-station-v1'/,'radio agent must use the persistent-station contract');
assert.match(radioSource,/autoRecommend:false/,'radio must not throw transient playlist cards at users on page load');
assert.match(radioSource,/persistentSurface:'radio-station-surface-v1'/,'stable v233 owner must expose the universal station surface');
assert.doesNotMatch(radioSource,/history\[method\]=function/,'radio must not monkey-patch browser history');
assert.doesNotMatch(radioSource,/setInterval\(/,'radio must not poll while idle');
assert.match(radioSource,/const LAUNCHER_ID='cw-radio-station-launcher-v1'/,'universal radio launcher is missing');
assert.match(radioSource,/bottom:calc\(var\(--cw-themed-nav-height,64px\) \+ env\(safe-area-inset-bottom\) \+ 12px\)/,'radio launcher must live above the universal navigation bar');
assert.match(radioSource,/const MODE_KEY='civweave\.radio\.content-mode\.v1'/,'radio content mode must persist');
assert.match(radioSource,/const SAFE_KEY='civweave\.safe-mode\.v1'/,'radio surface must honor S.A.F.E. mode');
assert.match(radioSource,/if\(safeModeEnabled\(\)\)return'clean'/,'S.A.F.E. mode must force the lyric-audited station');
assert.match(radioSource,/originalButton\.hidden=safe;originalButton\.disabled=safe/,'uncensored station control must be unavailable in S.A.F.E. mode');
assert.match(radioSource,/Original \/ uncensored/,'original station must remain an explicit user choice outside S.A.F.E. mode');
assert.match(radioSource,/LYRIC-AUDITED DEFAULT/,'clean station must be visibly identified as the default');
assert.match(radioSource,/Nominate track/,'station surface must expose playlist nomination without an Anarchadia-only bespoke widget');
assert.match(radioSource,/civweave:playlist-governance-open/,'Anarchadia voting must be reached through an explicit event');
assert.doesNotMatch(radioSource,/MutationObserver/,'radio surface must remain event-driven');

const cleanMatch=radioSource.match(/const STATIONS=deepFreeze\((\{[\s\S]*?\})\);\n\nif\(globalThis\.CivweaveRadioStationSurfaceV1/);
assert.ok(cleanMatch,'lyric-audited station payload is missing from the canonical radio owner');
const cleanStations=JSON.parse(cleanMatch[1]);
const expectedTrackCounts={anarchadia:40,cerbanimo:38,'living-school':50,fellowfare:43,civweave:29};
assert.deepEqual(Object.keys(cleanStations).sort(),Object.keys(expectedTrackCounts).sort());
for(const [system,count] of Object.entries(expectedTrackCounts)){
  const tracks=cleanStations[system].tracks;
  assert.equal(tracks.length,count,`${system} lyric-audited station count changed`);
  assert.ok(tracks.every(track=>['PASS','PASS-LIGHT'].includes(track.audit)),`${system} clean station contains a non-passing lyric audit`);
  assert.ok(tracks.every(track=>/^[A-Za-z0-9]{22}$/.test(track.spotifyTrackId)),`${system} clean station contains a malformed Spotify track ID`);
}
assert.equal(Object.values(cleanStations).reduce((sum,station)=>sum+station.tracks.length,0),200,'lyric-audited stations must contain all 200 final tracks');
const cleanTitles=new Set(Object.values(cleanStations).flatMap(station=>station.tracks.map(track=>track.title)));
for(const blocked of ['Nazi Punks Fuck Off','Penny For A Thought','Soup is Good Food','Y.A.W','Proletariat Blues','The Fool','Chip Chop','Creator']){
  assert.ok(!cleanTitles.has(blocked),`removed lyric-audit failure returned to the default stations: ${blocked}`);
}

const originalIds={
  anarchadia:'2AsCLZiAPlUYHOcogllTia',
  cerbanimo:'1CB3LLMSnuDwD013B1ZY3M',
  'living-school':'2MwmQdjHyRBIu8Wy9iXWUm',
  fellowfare:'1q6YDYRU6hekl2MkHkI2X3',
  civweave:'2BLWIhSfHdbcfG5rP8IqoX'
};
for(const [system,id] of Object.entries(originalIds)){
  assert.match(cleanStations[system].originalSpotifyUrl,new RegExp(`/playlist/${id}(?:\\?|$)`),`${system} original playlist changed`);
  assert.equal(stationLines[system].length,expectedTrackCounts[system],`${system} original radio directory count changed`);
  assert.equal(trackMap.systems?.[system]?.playlistId,id,`${system} original Spotify manifest changed`);
  assert.equal(trackMap.systems?.[system]?.trackCount,expectedTrackCounts[system],`${system} original manifest count changed`);
}
assert.equal(Object.values(trackMap.systems).reduce((sum,system)=>sum+(system.tracks?.length||0),0),200,'original Spotify manifests must keep all 200 legacy station positions');

assert.match(trackSource,/playlistOnly:true/,'legacy exact-track helper must remain playlist-context-only');
assert.doesNotMatch(trackSource,/location\.assign/,'Spotify handoff must never navigate the installed PWA away');

assert.doesNotMatch(governanceSource,/MutationObserver/,'playlist governance must not observe and rewrite its own DOM');
assert.match(governanceSource,/idleEventDriven:true/,'playlist governance must declare its event-driven idle contract');
assert.match(governanceSource,/if\(!proposals\.length\)\{existing\?\.remove\(\);return false\}/,'empty playlist votes must not leave a floating panel over Anarchadia');
assert.match(governanceSource,/civweave:playlist-nomination-open/,'nomination dialog must open only from an explicit station action');
assert.match(governanceSource,/civweave:playlist-governance-open/,'vote panel must open only from an explicit governance action');
assert.doesNotMatch(governanceSource,/No playlist nominations are waiting here\.<\/p>/,'the old permanent empty vote panel must stay retired');

assert.match(boundarySource,/SYSTEM_RADIO_AGENT='\/app\/system-radio-agent-v233\.js'/,'install boundary must keep the canonical radio owner');
assert.match(boundarySource,/RADIO_PLAYLIST_GOVERNANCE='\/app\/radio-playlist-governance-v1\.js'/,'install boundary must keep playlist governance');
assert.ok(boundarySource.indexOf('SYSTEM_RADIO_AGENT,')<boundarySource.indexOf('RADIO_TRACK_SUGGESTIONS,'),'radio owner must load before legacy track helpers');
assert.ok(boundarySource.indexOf('CANONICAL_PLAYLISTS,')<boundarySource.indexOf('RADIO_PLAYLIST_GOVERNANCE,'),'playlist state must load before governance');

console.log('Civweave radio clean-default persistent surface + event-driven governance contract verified.');
