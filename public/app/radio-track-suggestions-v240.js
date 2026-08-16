(()=>{
'use strict';

const VERSION='1.6.0';
const REVISION='radio-track-suggestions-v247-persistent-station-v1';
const PICK_KEY='civweave.radio.track-picks.v247';
const TRACK_MAP_PATH='/app/radio-track-map-v241.json';
const PANEL_ID='cw-radio-station-panel-v1';
const STYLE_ID='cw-radio-track-style-v247';
const RECENT_WINDOW=6;
const DIRECTORY_PATHS=Object.freeze({
  civweave:'/app/radio-directory-v240/civweave.txt',
  'living-school':'/app/radio-directory-v240/living-school.txt',
  cerbanimo:'/app/radio-directory-v240/cerbanimo.txt',
  fellowfare:'/app/radio-directory-v240/fellowfare.txt',
  anarchadia:'/app/radio-directory-v240/anarchadia.txt'
});
const TAGS=deepFreeze({
  anarchadia:[
    'NO PERMITS WERE CONSULTED','CIVIC PROCEDURE, LOUDER','CONSENSUS WITH DISTORTION',
    'THE COMMITTEE HAS LEFT THE BUILDING','NOT APPROVED BY ANY RESPECTABLE BOARD',
    'PLEASE DIRECT COMPLAINTS TO MUTUAL AID','THE AUX CORD IS NOW COMMON PROPERTY',
    'DECENTRALIZED, EXCEPT FOR THE DRUMS'
  ],
  cerbanimo:[
    'THIS MEETING COULD HAVE BEEN A BASSLINE','NO KPI SURVIVED THE CHORUS','CLOCK IN. ORGANIZE OUT.',
    'AUTHORIZED BY THE PEOPLE WHO BUILT IT','MANAGEMENT HAS BEEN REPLACED BY A WHITEBOARD',
    'PRODUCTIVITY, NOW WITH COLLECTIVE BARGAINING','THE SHOP FLOOR HAS SEIZED THE AUX',
    'WORKFLOW STATUS: LOUDLY SELF-MANAGED'
  ],
  'living-school':[
    'THE SYLLABUS HAS UNIONIZED','PEER REVIEW, BUT WITH DRUMS','EXTRA CREDIT FOR ASKING WHO WROTE THE RUBRIC',
    'OFFICE HOURS HAVE BECOME AN ASSEMBLY','NO STANDARDIZED TESTING DURING THIS TRACK',
    'THE HIDDEN CURRICULUM IS SHOWING','KNOWLEDGE WANTS A COMMONS, APPARENTLY',
    'READING LIST TEMPORARILY IN CONTROL OF THE READERS'
  ],
  fellowfare:[
    'FAIR TRADE, UNFAIRLY CATCHY','SURPLUS VALUE RETURNED TO SENDER',
    'MARKET SIGNAL RECEIVED. MARKET BOSS NOT FOUND.','NO MIDDLEMEN WERE HARMED. THEY WERE JUST UNNECESSARY.',
    'CO-OP AISLE 7 HAS THE AUX CORD','TODAY’S SPECIAL: MUTUAL BENEFIT',
    'PRICE DISCOVERED. PROFIT MOTIVE MISPLACED.','THE PEOPLE’S MALL HAS EXCELLENT TASTE'
  ],
  civweave:[
    'THE COMMONS HAVE SEIZED THE AUX','SYSTEMS THINKING, NOW DANCEABLE','FEDERATED VIBES, LOCAL AUTONOMY',
    'NO SINGLE POINT OF FAILURE, INCLUDING THE CHORUS','INTEROPERABILITY WITH FEELINGS',
    'THE NETWORK HAS FORMED A BAND','PROTOCOL STATUS: COLLECTIVELY BANGING',
    'DISTRIBUTED CONSENSUS, QUESTIONABLE DANCE MOVES'
  ]
});
const SYSTEM_ALIASES=Object.freeze({living_school:'living-school'});
const trackCache=new Map();
let trackMapPromise=null;

function deepFreeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);Object.values(value).forEach(deepFreeze)}return value}
function parse(value,fallback){try{return JSON.parse(value)??fallback}catch{return fallback}}
function esc(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function normalizeSystemId(value){const raw=String(value||'').trim().toLowerCase();return SYSTEM_ALIASES[raw]||raw}
function randomIndex(length){if(length<=1)return 0;if(globalThis.crypto?.getRandomValues){const values=new Uint32Array(1);globalThis.crypto.getRandomValues(values);return values[0]%length}return Math.floor(Math.random()*length)}
function spotifyTrackId(value){
  const raw=String(value||'').trim();if(!raw)return'';
  const uri=raw.match(/^spotify:track:([A-Za-z0-9]+)$/i);if(uri)return uri[1];
  const url=raw.match(/open\.spotify\.com\/track\/([A-Za-z0-9]+)/i);if(url)return url[1];
  return /^[A-Za-z0-9]{22}$/.test(raw)?raw:'';
}
function parseTrackLine(line,index=0){
  const raw=String(line||'').trim();if(!raw)return null;
  const parts=raw.split('\t').map(part=>part.trim()),label=parts[0]||'',id=spotifyTrackId(parts[1]||'');
  return label?Object.freeze({label,position:index,spotifyTrackId:id}):null;
}
function normalizeTrack(track,index=0){
  if(!track)return null;
  const title=String(track.title||'').trim(),artist=String(track.artist||'').trim(),label=String(track.label||[artist,title].filter(Boolean).join(' · ')).trim();
  return Object.freeze({...track,title,artist,label,position:Number.isInteger(track.position)?track.position:index,spotifyTrackId:spotifyTrackId(track.spotifyTrackId||'')});
}
function trackKey(track){const id=spotifyTrackId(track?.spotifyTrackId||'');return id||String(track?.label||track?.title||track||'').trim().toLowerCase()}
function loadPicks(){try{return parse(sessionStorage.getItem(PICK_KEY),{})||{}}catch{return{}}}
function savePicks(value){try{sessionStorage.setItem(PICK_KEY,JSON.stringify(value))}catch{}return value}
function pickDifferent(list,recent=[]){
  if(!Array.isArray(list)||!list.length)return null;
  const blocked=new Set((Array.isArray(recent)?recent:[recent]).map(value=>String(value||'').trim().toLowerCase()).filter(Boolean));
  const fresh=list.filter(item=>!blocked.has(trackKey(item))),pool=fresh.length?fresh:list;
  return pool[randomIndex(pool.length)]||null;
}
function rememberPick(system,scope,track){
  if(!track)return null;
  const id=normalizeSystemId(system),picks=loadPicks(),bucket=picks[id]?.[scope]||{},recent=Array.isArray(bucket.recent)?bucket.recent:[],key=trackKey(track);
  const nextRecent=[key,...recent.filter(value=>value!==key)].slice(0,RECENT_WINDOW);
  savePicks({...picks,[id]:{...(picks[id]||{}),[scope]:{track:track.label||track.title||'',spotifyTrackId:spotifyTrackId(track.spotifyTrackId),recent:nextRecent}}});
  return track;
}
function recentFor(system,scope){const picks=loadPicks();return Array.isArray(picks[normalizeSystemId(system)]?.[scope]?.recent)?picks[normalizeSystemId(system)][scope].recent:[]}
function pickTag(systemId){
  const system=normalizeSystemId(systemId),tags=TAGS[system]||[],picks=loadPicks();let tag=tags.length?tags[randomIndex(tags.length)]:'';
  for(let i=0;i<4&&tag===picks[system]?.tag&&tags.length>1;i++)tag=tags[randomIndex(tags.length)];
  if(tag)savePicks({...picks,[system]:{...(picks[system]||{}),tag}});return tag;
}
function mappedTrackId(map,system,position){return spotifyTrackId(map?.systems?.[system]?.tracks?.[position]||'')}
async function loadTrackMap(){
  if(!trackMapPromise)trackMapPromise=fetch(TRACK_MAP_PATH,{cache:'force-cache'}).then(response=>response.ok?response.json():{systems:{}}).catch(()=>({systems:{}}));
  return trackMapPromise;
}
async function loadTracks(systemId){
  const system=normalizeSystemId(systemId),path=DIRECTORY_PATHS[system];if(!path)return[];
  if(!trackCache.has(system)){
    trackCache.set(system,Promise.all([
      fetch(path,{cache:'force-cache'}).then(response=>{if(!response.ok)throw new Error(`radio directory ${response.status}`);return response.text()}),
      loadTrackMap()
    ]).then(([text,map])=>text.split(/\r?\n/).map((line,index)=>{
      const parsed=parseTrackLine(line,index);if(!parsed)return null;
      return normalizeTrack({...parsed,spotifyTrackId:parsed.spotifyTrackId||mappedTrackId(map,system,index)},index);
    }).filter(Boolean)).catch(error=>{trackCache.delete(system);console.warn('[Civweave Radio] station directory unavailable.',system,error);return[]}));
  }
  return trackCache.get(system);
}
function radioFor(systemId){return globalThis.CivweaveRadioRecommendationAgentV233?.registry?.[normalizeSystemId(systemId)]||null}
function playlistMeta(systemId){
  const system=normalizeSystemId(systemId),spotifyUrl=String(radioFor(system)?.spotifyUrl||''),match=spotifyUrl.match(/open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/i);if(!match)return null;
  return Object.freeze({system,playlistId:match[1],playlistUri:`spotify:playlist:${match[1]}`,spotifyUrl});
}
function stationUrl(systemId){return playlistMeta(systemId)?.spotifyUrl||'https://open.spotify.com/'}
function spotifyPlaylistTrackUrl(track,systemId){
  const meta=playlistMeta(systemId);if(!meta)return'https://open.spotify.com/';
  const id=spotifyTrackId(track?.spotifyTrackId||'');if(!id)return meta.spotifyUrl;
  const url=new URL(meta.spotifyUrl);url.searchParams.set('highlight',`spotify:track:${id}`);return url.href;
}
function spotifyContextUrl(track,systemId){return spotifyPlaylistTrackUrl(track,systemId)}
function spotifyContentLink(track,systemId){return spotifyPlaylistTrackUrl(track,systemId)}
function spotifyHighlightedPlaylistUrl(track,systemId){return spotifyPlaylistTrackUrl(track,systemId)}
function surface(){return globalThis.CivweaveRadioStationSurfaceV1||null}
function safeApi(){return globalThis.CivweaveRadioSafeStationsV1||null}
function safeModeEnabled(){return Boolean(safeApi()?.safeModeEnabled?.()||surface()?.safeModeEnabled?.())}
function activeSystem(){return normalizeSystemId(surface()?.detectSystem?.()||safeApi()?.currentSystem?.()||'')}
function activeMode(){return safeModeEnabled()?'safe':surface()?.mode?.()||'clean'}
async function pickTrack(systemId){
  const system=normalizeSystemId(systemId),tracks=await loadTracks(system),track=pickDifferent(tracks,recentFor(system,'original'));return rememberPick(system,'original',track);
}
async function pickSuggestion(systemId=activeSystem()){
  const system=normalizeSystemId(systemId),mode=activeMode();
  if(mode==='safe'){
    const api=safeApi(),track=api?.suggestTrack?.(system);return track?normalizeTrack(track):null;
  }
  if(mode==='clean'){
    const rows=(surface()?.tracksFor?.(system)||[]).map(normalizeTrack).filter(Boolean),track=pickDifferent(rows,recentFor(system,'clean'));return rememberPick(system,'clean',track);
  }
  return pickTrack(system);
}
function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
#${PANEL_ID} .cw-radio-persistent-suggestion{display:grid;gap:6px;margin:4px 0 10px;padding:10px 11px;border:1px solid #ffffff24;border-radius:13px;background:#00000024}
#${PANEL_ID} .cw-radio-persistent-suggestion small{opacity:.66;font-size:10px;font-weight:850;letter-spacing:.08em;text-transform:uppercase}
#${PANEL_ID} .cw-radio-persistent-suggestion strong{font-size:14px;line-height:1.35}
#${PANEL_ID} .cw-radio-persistent-suggestion span{opacity:.7;font-size:11px}
#${PANEL_ID} .cw-radio-persistent-suggestion a,#${PANEL_ID} .cw-radio-persistent-suggestion button{justify-self:start;min-height:34px;display:inline-flex;align-items:center;border:1px solid #ffffff28;border-radius:999px;padding:0 11px;background:#ffffff0a;color:#fff;text-decoration:none;font-weight:800}
#${PANEL_ID} .cw-radio-track[data-radio-suggested="true"]{outline:1px solid #83e9ff88;border-radius:10px;background:#83e9ff10}
`;
  document.head?.append(style);
}
function emitSuggested(system,mode,track,extra={}){
  try{dispatchEvent(new CustomEvent('civweave:radio-track-event',{detail:{type:'RADIO_TRACK_SUGGESTED',revision:REVISION,system,mode,track:track?.label||track?.title||'',position:Number.isInteger(track?.position)?track.position:null,spotifyTrackId:spotifyTrackId(track?.spotifyTrackId||''),persistentSurface:true,...extra}}))}catch{}
}
function highlightCleanTrack(title){
  const panel=document.getElementById(PANEL_ID),rows=[...(panel?.querySelectorAll?.('.cw-radio-track')||[])];let found=null;
  for(const row of rows){row.removeAttribute('data-radio-suggested');if(!found&&row.querySelector('strong')?.textContent?.trim()===title)found=row}
  if(found){found.dataset.radioSuggested='true';found.scrollIntoView?.({block:'nearest',behavior:'smooth'});setTimeout(()=>found?.removeAttribute?.('data-radio-suggested'),3500)}
  return Boolean(found);
}
function configureStationLink(link,track,system,tag){
  if(!link)return'';
  const meta=playlistMeta(system),resolved=spotifyTrackId(track?.spotifyTrackId||'');
  link.href=resolved?spotifyPlaylistTrackUrl({...track,spotifyTrackId:resolved},system):stationUrl(system);link.target='_blank';link.rel='noopener noreferrer external';
  link.textContent=resolved?'Open station at suggested track ↗':'Open station ↗';link.dataset.spotifyPlaylistId=meta?.playlistId||'';link.dataset.spotifyTrackId=resolved;link.dataset.spotifyPlaylistOnly='true';
  link.addEventListener?.('click',()=>{try{dispatchEvent(new CustomEvent('civweave:radio-track-event',{detail:{type:'RADIO_TRACK_CLICKED',revision:REVISION,system,mode:'original',track:track?.label||'',spotifyTrackId:resolved,playlistId:meta?.playlistId||'',playlistUrl:link.href,playlistOnly:true,external:true,tag}}))}catch{}},{once:true});
  return resolved;
}
function externalizeSpotifyLink(link){if(!link)return null;link.target='_blank';link.rel='noopener noreferrer external';return link}
async function renderSuggestion(systemId=activeSystem()){
  const panel=document.getElementById(PANEL_ID),body=panel?.querySelector?.('[data-radio-body]');if(!panel||panel.hidden||!body)return null;
  body.querySelector('[data-radio-persistent-suggestion]')?.remove();
  const system=normalizeSystemId(systemId||activeSystem()),mode=activeMode(),track=await pickSuggestion(system);if(!track||!body.isConnected)return null;
  installStyle();const tag=pickTag(system),root=document.createElement('div');root.className='cw-radio-persistent-suggestion';root.dataset.radioPersistentSuggestion='true';
  const title=track.title||track.label||'',artist=track.artist||'';
  root.innerHTML=`<small>${esc(tag||'Suggested from this station')}</small><strong>${esc(title)}</strong>${artist?`<span>${esc(artist)}</span>`:''}`;
  if(mode==='safe'){
    const button=document.createElement('button');button.type='button';button.textContent='Use this suggestion';button.addEventListener('click',()=>{safeApi()?.selectSuggested?.(system);safeApi()?.render?.();queueMicrotask(()=>renderSuggestion(system))});root.append(button);
    emitSuggested(system,mode,track,{safeStation:true,playlistOnly:false,external:false});
  }else if(mode==='clean'){
    const button=document.createElement('button');button.type='button';button.textContent='Show in station';button.addEventListener('click',()=>highlightCleanTrack(track.title));root.append(button);
    emitSuggested(system,mode,track,{auditedStation:true,playlistOnly:false,external:false});
  }else{
    const link=document.createElement('a');configureStationLink(link,track,system,tag);root.append(link);
    emitSuggested(system,mode,track,{playlistOnly:true,external:true,playlistUrl:link.href,playlistId:playlistMeta(system)?.playlistId||''});
  }
  body.prepend(root);return track;
}
function scheduleSuggestion(system){queueMicrotask(()=>{renderSuggestion(system).catch(error=>console.warn('[Civweave Radio] suggestion render failed.',error))})}
function decorate(systemId){scheduleSuggestion(systemId);return Promise.resolve(null)}
function onRadioEvent(event){const detail=event?.detail||{};if(detail.type==='RADIO_CTA_SHOWN')scheduleSuggestion(detail.system)}
function start(){
  installStyle();
  addEventListener('civweave:radio-event',onRadioEvent);
  addEventListener('civweave:radio-station-opened',event=>scheduleSuggestion(event?.detail?.system));
  addEventListener('civweave:radio-station-mode-changed',event=>scheduleSuggestion(event?.detail?.system));
  addEventListener('civweave:safe-mode-changed',()=>scheduleSuggestion(activeSystem()));
  addEventListener('pageshow',()=>{const panel=document.getElementById(PANEL_ID);if(panel&&!panel.hidden)scheduleSuggestion(activeSystem())});
  return true;
}
const api=Object.freeze({
  version:VERSION,revision:REVISION,recentWindow:RECENT_WINDOW,directoryPaths:DIRECTORY_PATHS,trackMapPath:TRACK_MAP_PATH,tags:TAGS,
  normalizeSystemId,spotifyTrackId,parseTrackLine,trackKey,playlistMeta,stationUrl,spotifyPlaylistTrackUrl,spotifyContextUrl,spotifyContentLink,spotifyHighlightedPlaylistUrl,
  loadTrackMap,loadTracks,pickTrack,pickSuggestion,pickTag,externalizeSpotifyLink,configureStationLink,renderSuggestion,decorate,start,
  persistentSurface:true,safeAware:true,cleanAware:true,originalPlaylistContext:true,isolatedTrackLinks:false
});
globalThis.CivweaveRadioTrackSuggestionsV247=api;
globalThis.CivweaveRadioTrackSuggestionsV246=api;
globalThis.CivweaveRadioTrackSuggestionsV245=api;
globalThis.CivweaveRadioTrackSuggestionsV244=api;
globalThis.CivweaveRadioTrackSuggestionsV243=api;
globalThis.CivweaveRadioTrackSuggestionsV242=api;
globalThis.CivweaveRadioTrackSuggestionsV241=api;
globalThis.CivweaveRadioTrackSuggestionsV240=api;
start();
try{dispatchEvent(new CustomEvent('civweave:radio-track-suggestions-ready',{detail:{version:VERSION,revision:REVISION,systems:Object.keys(DIRECTORY_PATHS),persistentSurface:true,safeAware:true,cleanAware:true,originalPlaylistContext:true,recentWindow:RECENT_WINDOW}}))}catch{}
})();
