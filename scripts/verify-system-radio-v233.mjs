import fs from 'node:fs';
import assert from 'node:assert/strict';

const ROOT=new URL('../',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,ROOT),'utf8');
const radioSource=read('public/app/system-radio-agent-v233.js');
const safeSource=read('public/app/radio-safe-stations-v1.js');
const governanceSource=read('public/app/radio-playlist-governance-v1.js');
const trackSource=read('public/app/radio-track-suggestions-v240.js');
const boundarySource=read('public/app/install-boundary-v146.js');
const radioCoreSource=read('public/service-worker-radio-core-v305.js');
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
assert.match(radioSource,/Nominate track/,'station surface must expose playlist nomination without an Anarchadia-only bespoke widget');
assert.match(radioSource,/civweave:playlist-governance-open/,'Anarchadia voting must be reached through an explicit event');
assert.doesNotMatch(radioSource,/MutationObserver/,'radio surface must remain event-driven');

const cleanMatch=radioSource.match(/const STATIONS=deepFreeze\((\{[\s\S]*?\})\);\n\nif\(globalThis\.CivweaveRadioStationSurfaceV1/);
assert.ok(cleanMatch,'clean/default station payload is missing from the canonical radio owner');
const cleanStations=JSON.parse(cleanMatch[1]);
const expectedTrackCounts={anarchadia:40,cerbanimo:38,'living-school':50,fellowfare:43,civweave:29};
assert.deepEqual(Object.keys(cleanStations).sort(),Object.keys(expectedTrackCounts).sort());
for(const [system,count] of Object.entries(expectedTrackCounts)){
  const tracks=cleanStations[system].tracks;
  assert.equal(tracks.length,count,`${system} clean station count changed`);
  assert.ok(tracks.every(track=>['PASS','PASS-LIGHT'].includes(track.audit)),`${system} clean station contains a failed lyric audit`);
  assert.ok(tracks.every(track=>/^[A-Za-z0-9]{22}$/.test(track.spotifyTrackId)),`${system} clean station contains a malformed Spotify track ID`);
}
assert.equal(Object.values(cleanStations).reduce((sum,station)=>sum+station.tracks.length,0),200,'clean/default stations must contain all 200 final tracks');
const cleanTitles=new Set(Object.values(cleanStations).flatMap(station=>station.tracks.map(track=>track.title)));
for(const blocked of ['Nazi Punks Fuck Off','Penny For A Thought','Soup is Good Food','Y.A.W','Proletariat Blues','The Fool','Chip Chop','Creator']){
  assert.ok(!cleanTitles.has(blocked),`removed lyric-audit failure returned to the clean/default stations: ${blocked}`);
}

assert.match(safeSource,/const REVISION='radio-safe-stations-v1-general-audience-queue'/,'S.A.F.E. radio must have an independent canonical station owner');
assert.match(safeSource,/externalUncensoredRoutes:0/,'S.A.F.E. station must expose zero uncensored routes');
assert.match(safeSource,/independentQueue:true/,'S.A.F.E. station must own its queue independently');
assert.match(safeSource,/failClosed:true/,'S.A.F.E. station must fail closed');
assert.match(safeSource,/original\.hidden=true;original\.disabled=true;original\.style\.display='none'/,'S.A.F.E. must remove the uncensored control from the reachable UI');
assert.match(safeSource,/data-safe-radio-action=\\"previous\\"/,'S.A.F.E. station must expose previous-track queue navigation');
assert.match(safeSource,/data-safe-radio-action=\\"next\\"/,'S.A.F.E. station must expose next-track queue navigation');
assert.match(safeSource,/safeAudit:'SAFE-PASS-V1'/,'S.A.F.E. tracks must carry the broader safety audit contract');
assert.doesNotMatch(safeSource,/open\.spotify\.com\/playlist\//,'S.A.F.E. station must not contain any Spotify playlist route that can escape to uncensored material');
assert.doesNotMatch(safeSource,/originalSpotifyUrl/,'S.A.F.E. station must not inherit original playlist destinations');
assert.doesNotMatch(safeSource,/MutationObserver/,'S.A.F.E. station must remain event-driven');
assert.match(safeSource,/function sanitizeCoreCopy\(\)/,'radio presentation must remove internal audit implementation copy');
assert.match(safeSource,/auditLabel\.hidden=true/,'internal lyric-audit header must not be user-facing');
assert.match(safeSource,/querySelector\('\.cw-radio-note'\)\?\.remove\(\)/,'internal clean-station audit note must not be user-facing');
assert.match(safeSource,/replace\(\/\\s\+·\\s\+PASS/,'per-track PASS/PASS-LIGHT audit labels must not be user-facing');

const safeMatch=safeSource.match(/const SAFE_STATIONS=deepFreeze\((\{[\s\S]*?\})\);\n\nif\(globalThis\.CivweaveRadioSafeStationsV1/);
assert.ok(safeMatch,'S.A.F.E. station payload is missing');
const safeStations=Function('track','deepFreeze',`return deepFreeze(${safeMatch[1]});`)(
  (title,artist,spotifyTrackId)=>({title,artist,spotifyTrackId,safeAudit:'SAFE-PASS-V1'}),
  value=>value
);
assert.deepEqual(Object.keys(safeStations).sort(),Object.keys(expectedTrackCounts).sort(),'S.A.F.E. must cover all five systems');
for(const [system,station] of Object.entries(safeStations)){
  assert.equal(station.tracks.length,8,`${system} S.A.F.E. station must have the curated eight-track seed queue`);
  assert.ok(station.tracks.every(track=>track.safeAudit==='SAFE-PASS-V1'),`${system} S.A.F.E. station contains an unaudited track`);
  assert.ok(station.tracks.every(track=>/^[A-Za-z0-9]{22}$/.test(track.spotifyTrackId)),`${system} S.A.F.E. station contains a malformed Spotify track ID`);
}
const safeTitles=new Set(Object.values(safeStations).flatMap(station=>station.tracks.map(track=>track.title)));
for(const rejected of ['Over And Over','Odessa','All You Fascists','There Is Power in a Union','The Laws Have Changed',"Busy Earnin'"]){
  assert.ok(!safeTitles.has(rejected),`broader S.A.F.E. audit rejection returned to the S.A.F.E. queue: ${rejected}`);
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

assert.match(trackSource,/REVISION='radio-track-suggestions-v247-persistent-station-v1'/,'track suggestions must target the persistent station surface');
assert.match(trackSource,/civweave:radio-station-opened/,'track suggestions must trigger when the persistent station opens');
assert.match(trackSource,/civweave:radio-station-mode-changed/,'track suggestions must follow station tier changes');
assert.match(trackSource,/safeApi\(\)\?\.suggestTrack\?\.\(system\)/,'S.A.F.E. suggestions must come only from the S.A.F.E. queue');
assert.match(trackSource,/surface\(\)\?\.tracksFor\?\.\(system\)/,'clean-mode suggestions must come from the clean station payload');
assert.match(trackSource,/spotifyPlaylistTrackUrl\(track,systemId\)/,'original-mode suggestions must preserve playlist context');
assert.match(trackSource,/persistentSurface:true/,'track suggestion API must declare persistent-surface ownership');
assert.match(trackSource,/safeAware:true/,'track suggestion API must declare S.A.F.E. awareness');
assert.match(trackSource,/cleanAware:true/,'track suggestion API must declare clean-station awareness');
assert.doesNotMatch(trackSource,/const CARD_ID='cw-radio-suggestion-v233'/,'track suggestions must not depend on the retired transient card');
assert.doesNotMatch(trackSource,/location\.assign/,'Spotify handoff must never navigate the installed PWA away');

assert.doesNotMatch(governanceSource,/MutationObserver/,'playlist governance must not observe and rewrite its own DOM');
assert.match(governanceSource,/idleEventDriven:true/,'playlist governance must declare its event-driven idle contract');
assert.match(governanceSource,/if\(!proposals\.length\)\{existing\?\.remove\(\);return false\}/,'empty playlist votes must not leave a floating panel over Anarchadia');
assert.match(governanceSource,/civweave:playlist-nomination-open/,'nomination dialog must open only from an explicit station action');
assert.match(governanceSource,/civweave:playlist-governance-open/,'vote panel must open only from an explicit governance action');
assert.doesNotMatch(governanceSource,/No playlist nominations are waiting here\.<\/p>/,'the old permanent empty vote panel must stay retired');

assert.match(boundarySource,/SYSTEM_RADIO_AGENT='\/app\/system-radio-agent-v233\.js'/,'install boundary must keep the canonical radio owner');
assert.match(boundarySource,/RADIO_SAFE_STATIONS='\/app\/radio-safe-stations-v1\.js'/,'install boundary must load the canonical S.A.F.E. station owner');
assert.match(boundarySource,/RADIO_PLAYLIST_GOVERNANCE='\/app\/radio-playlist-governance-v1\.js'/,'install boundary must keep playlist governance');
assert.ok(boundarySource.indexOf('SYSTEM_RADIO_AGENT,')<boundarySource.indexOf('RADIO_SAFE_STATIONS,'),'base radio owner must load before the S.A.F.E. station policy');
assert.ok(boundarySource.indexOf('RADIO_SAFE_STATIONS,')<boundarySource.indexOf('RADIO_TRACK_SUGGESTIONS,'),'S.A.F.E. station policy must load before tier-aware suggestions');
assert.ok(boundarySource.indexOf('CANONICAL_PLAYLISTS,')<boundarySource.indexOf('RADIO_PLAYLIST_GOVERNANCE,'),'playlist state must load before governance');
assert.match(radioCoreSource,/['"]\/app\/radio-safe-stations-v1\.js['"]/,'installed shell must cache the S.A.F.E. station owner');

console.log('Civweave radio three-tier station + fail-closed S.A.F.E. queue + persistent suggestions contract verified.');
