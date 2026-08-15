import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const ROOT=new URL('../',import.meta.url);
const radioSource=fs.readFileSync(new URL('public/app/system-radio-agent-v233.js',ROOT),'utf8');
const trackSource=fs.readFileSync(new URL('public/app/radio-track-suggestions-v240.js',ROOT),'utf8');
const boundarySource=fs.readFileSync(new URL('public/app/install-boundary-v146.js',ROOT),'utf8');
const runtimeSource=fs.readFileSync(new URL('public/app/core-interface-runtime-v1.js',ROOT),'utf8');
const trackMap=JSON.parse(fs.readFileSync(new URL('public/app/radio-track-map-v241.json',ROOT),'utf8'));
const stationFiles={
  anarchadia:'public/app/radio-directory-v240/anarchadia.txt',
  cerbanimo:'public/app/radio-directory-v240/cerbanimo.txt',
  'living-school':'public/app/radio-directory-v240/living-school.txt',
  fellowfare:'public/app/radio-directory-v240/fellowfare.txt',
  civweave:'public/app/radio-directory-v240/civweave.txt'
};
const stationLines=Object.fromEntries(Object.entries(stationFiles).map(([system,path])=>[
  system,fs.readFileSync(new URL(path,ROOT),'utf8').split(/\r?\n/).map(line=>line.trim()).filter(Boolean)
]));

class Store {
  constructor(){this.map=new Map()}
  getItem(key){return this.map.has(key)?this.map.get(key):null}
  setItem(key,value){this.map.set(key,String(value))}
  removeItem(key){this.map.delete(key)}
}

const localStorage=new Store();
const sessionStorage=new Store();
const document={
  readyState:'complete',
  documentElement:{dataset:{civweaveSystemRoute:''}},
  body:{append(){}},
  head:{append(){}},
  getElementById(){return null},
  addEventListener(){},
  createElement(){return{dataset:{},classList:{add(){}},setAttribute(){},append(){},addEventListener(){},remove(){},isConnected:true}}
};
const history={pushState(){},replaceState(){}};
const sandbox={
  console,URL,Date,Math,JSON,Object,Array,Set,Map,Number,String,Boolean,Promise,
  document,history,location:{pathname:'/not-a-system',search:'',hash:''},
  localStorage,sessionStorage,
  crypto:{randomUUID:()=> 'radio-v233-test'},
  CustomEvent:class CustomEvent{constructor(type,{detail}={}){this.type=type;this.detail=detail}},
  dispatchEvent(){},addEventListener(){},setTimeout(){return 1},clearTimeout(){},queueMicrotask(fn){fn()}
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(radioSource,sandbox,{filename:'system-radio-agent-v233.js'});
vm.runInContext(trackSource,sandbox,{filename:'radio-track-suggestions-v240.js'});

const radio=sandbox.CivweaveRadioRecommendationAgentV233;
const tracks=sandbox.CivweaveRadioTrackSuggestionsV246;
assert.ok(radio,'v233 radio runtime must initialize');
assert.ok(tracks,'v246 playlist-only track suggestion behavior must initialize from stable v240 file');
assert.equal(sandbox.CivweaveRadioRecommendationAgentV232,radio,'v232 compatibility alias must point to v233 runtime');
assert.equal(sandbox.CivweaveRadioTrackSuggestionsV245,tracks,'v245 compatibility alias must point to v246 behavior');
assert.equal(sandbox.CivweaveRadioTrackSuggestionsV244,tracks,'v244 compatibility alias must point to v246 behavior');
assert.equal(sandbox.CivweaveRadioTrackSuggestionsV243,tracks,'v243 compatibility alias must point to v246 behavior');
assert.equal(sandbox.CivweaveRadioTrackSuggestionsV242,tracks,'v242 compatibility alias must point to v246 behavior');
assert.equal(sandbox.CivweaveRadioTrackSuggestionsV241,tracks,'v241 compatibility alias must point to v246 behavior');
assert.equal(sandbox.CivweaveRadioTrackSuggestionsV240,tracks,'stable v240 compatibility alias must point to v246 behavior');
assert.equal(radio.revision,'system-radio-agent-v233');
assert.equal(tracks.revision,'radio-track-suggestions-v246');
assert.equal(tracks.recentWindow,6,'track picker must retain a useful recent-history window');
assert.equal(tracks.trackMapPath,'/app/radio-track-map-v241.json');
assert.equal(trackMap.version,1);
assert.equal(trackMap.revision,'radio-track-map-v241');
assert.equal(typeof trackMap.systems,'object');

const expectedIds={
  anarchadia:'2AsCLZiAPlUYHOcogllTia',
  cerbanimo:'1CB3LLMSnuDwD013B1ZY3M',
  'living-school':'2MwmQdjHyRBIu8Wy9iXWUm',
  fellowfare:'1q6YDYRU6hekl2MkHkI2X3',
  civweave:'2BLWIhSfHdbcfG5rP8IqoX'
};
assert.deepEqual(Object.keys(radio.registry).sort(),Object.keys(expectedIds).sort());
for(const [system,id] of Object.entries(expectedIds)){
  assert.match(radio.registry[system].spotifyUrl,new RegExp(`/playlist/${id}(?:\\?|$)`),`${system} playlist changed`);
  assert.equal(tracks.playlistMeta(system).playlistId,id,`${system} playlist context ID drifted`);
}

const expectedTrackCounts={anarchadia:40,cerbanimo:38,'living-school':50,fellowfare:43,civweave:29};
for(const [system,count] of Object.entries(expectedTrackCounts)){
  assert.equal(stationLines[system].length,count,`${system} radio directory count changed`);
  assert.ok(stationLines[system].every(line=>line.includes(' - ')),`${system} contains a malformed radio directory line`);
  assert.equal(tracks.directoryPaths[system],`/app/radio-directory-v240/${system}.txt`,`${system} directory path is not canonical`);
  assert.ok(tracks.tags[system].length>=8,`${system} needs a healthy pool of episode-label tags`);
  assert.equal(trackMap.systems?.[system]?.playlistId,expectedIds[system],`${system} manifest playlist changed`);
  assert.equal(trackMap.systems?.[system]?.trackCount,count,`${system} manifest count changed`);
  assert.equal(trackMap.systems?.[system]?.tracks?.length,count,`${system} manifest ID count changed`);
  assert.ok(trackMap.systems[system].tracks.every(id=>/^[A-Za-z0-9]{22}$/.test(id)),`${system} manifest contains malformed Spotify IDs`);
}
assert.equal(Object.values(expectedTrackCounts).reduce((sum,count)=>sum+count,0),200,'uploaded radio directory total changed');
assert.equal(Object.values(trackMap.systems).reduce((sum,system)=>sum+(system.tracks?.length||0),0),200,'Spotify manifest must contain all 200 exact IDs');
assert.ok(stationLines.anarchadia.includes('Dead Kennedys - Nazi Punks Fuck Off'));
assert.ok(stationLines.cerbanimo.includes('The Coup - Ride The Fence'));
assert.ok(stationLines['living-school'].includes('Billy Bragg - There Is Power in a Union'));
assert.ok(stationLines.fellowfare.includes('Bob Marley & The Wailers - Redemption Song'));
assert.ok(stationLines.civweave.includes('Fela Kuti - Water No Get Enemy'));

const testTrackId='6rqhFgbbKwnb9MLmUQDhG6';
const enriched=tracks.parseTrackLine(`The Coup - Ride The Fence\tspotify:track:${testTrackId}`,7);
assert.equal(enriched.label,'The Coup - Ride The Fence');
assert.equal(enriched.position,7);
assert.equal(enriched.spotifyTrackId,testTrackId);
const playlistUrl=new URL(tracks.spotifyPlaylistTrackUrl(enriched,'cerbanimo'));
assert.equal(playlistUrl.pathname,`/playlist/${expectedIds.cerbanimo}`,'suggested-track handoff must keep the approved station playlist as the Spotify resource');
assert.equal(playlistUrl.searchParams.get('highlight'),`spotify:track:${testTrackId}`,'playlist handoff must identify the suggested track without changing resources');
assert.equal(tracks.spotifyContextUrl(enriched,'cerbanimo'),playlistUrl.href,'legacy context helper must resolve to the playlist-only handoff');
assert.equal(tracks.spotifyContentLink(enriched,'cerbanimo'),playlistUrl.href,'legacy content-link helper must resolve to the playlist-only handoff');
assert.equal(tracks.spotifyHighlightedPlaylistUrl(enriched,'cerbanimo'),playlistUrl.href,'highlight helper must resolve to the playlist-only handoff');
const legacy=tracks.parseTrackLine('The Coup - Ride The Fence',7);
assert.equal(legacy.spotifyTrackId,'');
assert.match(tracks.spotifyPlaylistTrackUrl(legacy,'cerbanimo'),new RegExp(`/playlist/${expectedIds.cerbanimo}(?:\\?|$)`),'legacy metadata must fall back to the approved station, never an isolated track');
const externalProbe={};
assert.equal(tracks.externalizeSpotifyLink(externalProbe),externalProbe,'external handoff helper must return the original link');
assert.equal(externalProbe.target,'_blank','Spotify handoff must leave the installed Civweave PWA open');
assert.equal(externalProbe.rel,'noopener noreferrer external','external Spotify handoff must isolate its opener');
assert.ok(tracks.pickTag('living-school'),'Living School must produce a label tag');

const pageContext={
  activeSystem:'cerbanimo',currentRoute:'/app/realm-console-v140.html?room=workshop',route:'/app/realm-console-v140.html?room=workshop',
  previousSystem:'cerbanimo',lastPlaylistShown:'cerbanimo',lastTimeShown:new Date().toISOString(),sessionExposureCount:999,
  snoozeUntil:0,snoozeRemainingMs:0,reason:'page_navigated'
};
const awakeEligibility=radio.eligibility(pageContext);
assert.equal(awakeEligibility.eligible,true,'ordinary page navigation must always be eligible when awake');
assert.equal(awakeEligibility.reason,'page_navigated','ordinary page navigation must retain its navigation reason');

radio.registerDecisionProvider(async()=>({action:'suppress',messageVariant:'default',placement:'toast',reason:'provider_suppress'}));
const forced=await radio.agentDecision(pageContext);
assert.equal(forced.action,'show','presentation provider may not suppress an eligible per-page station ID');

const until=radio.snooze(30*60*1000);
assert.ok(until>Date.now()+29*60*1000,'explicit snooze must last about 30 minutes');
const sleeping=radio.eligibility({...pageContext,snoozeUntil:until,snoozeRemainingMs:until-Date.now()});
assert.equal(sleeping.eligible,false);
assert.equal(sleeping.reason,'user_snoozed');

assert.match(radioSource,/const SNOOZE_MS=30\*60\*1000;/,'snooze must be exactly 30 minutes');
assert.match(radioSource,/SNOOZE_KEY='civweave\.radio\.snooze-until\.v1'/,'snooze must persist across page loads');
assert.doesNotMatch(radioSource,/MAX_SESSION_EXPOSURES/,'session impression cap must stay retired');
assert.doesNotMatch(radioSource,/REENTRY_ELIGIBILITY_MS/,'re-entry cooldown must stay retired');
assert.doesNotMatch(radioSource,/SYSTEM_COOLDOWN_MS/,'per-system cooldown must stay retired');
assert.doesNotMatch(radioSource,/dismissedThisSession/,'session-long dismissal must stay retired');
assert.match(radioSource,/left:max\(14px,env\(safe-area-inset-left\)\)/,'radio must live in the bottom-left safe area');
assert.match(radioSource,/right:auto;/,'radio must explicitly vacate the chat button corner');
assert.match(radioSource,/translate3d\(calc\(-100% - 40px\),0,0\)/,'radio must exit toward the left edge');
assert.match(radioSource,/removeSuggestion\('auto_timeout'\)/,'auto timeout must only hide the current card');
assert.match(radioSource,/dismiss\.addEventListener\('click',[\s\S]*snooze\(SNOOZE_MS\)/,'explicit X must trigger the 30-minute snooze');
assert.match(radioSource,/scheduleEvaluation\('page_navigated',NAVIGATION_DEBOUNCE_MS\)/,'same-document navigation must re-evaluate radio');
assert.match(radioSource,/scheduleEvaluation\(reason,PRESENTATION_DELAY_MS,true\)/,'each new document must force an initial recommendation');

assert.match(trackSource,/fetch\(path,\{cache:'force-cache'\}\)/,'track suggestions must use the local/offline station directory');
assert.match(trackSource,/fetch\(TRACK_MAP_PATH,\{cache:'force-cache'\}\)/,'exact Spotify IDs must come from the local/offline manifest');
assert.match(trackSource,/mappedTrackId\(map,system,index\)/,'manifest IDs must map to the existing station order');
assert.match(trackSource,/detail\.type==='RADIO_CTA_SHOWN'/,'track lookup must trigger from the existing Spotify station suggestion');
assert.match(trackSource,/RADIO_TRACK_SUGGESTED/,'track suggestions must emit an observable event');
assert.match(trackSource,/Suggested from this station/,'card must explicitly identify the selected song as a station suggestion');
assert.match(trackSource,/Station track \$\{track\.position\+1\} of \$\{tracks\.length\}/,'card must expose the exact station position of the suggestion');
assert.match(trackSource,/Open station at suggested track ↗/,'the only Spotify CTA must remain a station action');
assert.match(trackSource,/new URL\(meta\.spotifyUrl\)/,'suggested-track handoff must build from the approved station playlist URL');
assert.match(trackSource,/searchParams\.set\('highlight',`spotify:track:\$\{id\}`\)/,'playlist handoff must identify the suggested track inside the station');
assert.match(trackSource,/configureStationLink\(stationLink,track,system,tag\)/,'suggestion metadata must decorate the station link rather than creating a track link');
assert.match(trackSource,/playlistOnly:true/,'radio events must state the playlist-only invariant');
assert.doesNotMatch(trackSource,/new URL\(`https:\/\/open\.spotify\.com\/track\/\$\{id\}`\)/,'radio must never construct an isolated Spotify track destination');
assert.doesNotMatch(trackSource,/spotify\.link\/content_linking/,'radio must never wrap a standalone track in Spotify content linking');
assert.doesNotMatch(trackSource,/trackLink/,'radio must not create a separate track CTA');
assert.match(trackSource,/const RECENT_WINDOW=6;/,'recommendations must remember multiple recent tracks');
assert.match(trackSource,/recent:nextRecent/,'recent track history must persist per station');
assert.match(trackSource,/link\.target='_blank'/,'Spotify links must leave the installed Civweave PWA open');
assert.match(trackSource,/link\.rel='noopener noreferrer external'/,'external Spotify windows must be opener-isolated');
assert.doesNotMatch(trackSource,/stationLink\.target='_self'/,'station link must never replace the installed PWA');
assert.doesNotMatch(trackSource,/location\.assign/,'Spotify playback must never navigate the Civweave PWA away');
assert.doesNotMatch(trackSource,/open\.spotify\.com\/search\//,'v246 behavior must never strand users in Spotify search');
assert.doesNotMatch(trackSource,/api\.spotify\.com/,'ordinary radio playback must not require Spotify API access');
assert.doesNotMatch(trackSource,/Authorization:/,'ordinary radio playback must not carry Spotify credentials');
assert.match(trackSource,/THE SYLLABUS HAS UNIONIZED/,'snarky station labels must ship with the runtime');
assert.match(trackSource,/NO KPI SURVIVED THE CHORUS/,'Cerbanimo label voice must remain distinct');
assert.match(trackSource,/SURPLUS VALUE RETURNED TO SENDER/,'FellowFare label voice must remain distinct');

assert.match(runtimeSource,/'\/app\/system-radio-agent-v233\.js'/,'core interface runtime must carry the station recommendation agent');
assert.match(runtimeSource,/'\/app\/radio-track-suggestions-v240\.js'/,'core interface runtime must keep the stable v240 track-decorator path');
assert.ok(runtimeSource.indexOf("'/app/system-radio-agent-v233.js'")<runtimeSource.indexOf("'/app/radio-track-suggestions-v240.js'"),'track decorator must load after the station card runtime');
assert.doesNotMatch(boundarySource,/SYSTEM_RADIO_AGENT\s*=/,'install boundary must not regain radio loading ownership');
assert.doesNotMatch(boundarySource,/RADIO_TRACK_SUGGESTIONS\s*=/,'install boundary must not regain track-decorator loading ownership');
assert.match(boundarySource,/radioRecommendationRevision:'v233-every-page-30-minute-snooze-bottom-left'/,'boundary metadata must describe the active station policy');
assert.match(boundarySource,/radioTrackSuggestionRevision:'v241-playlist-context-track-links'/,'stable boundary metadata must continue identifying the playlist-context compatibility family');

console.log('Civweave system radio v233 + stable-v240/v246 playlist-only highlighted station handoff contract verified.');