(()=>{
'use strict';

const VERSION='1.1.0';
const REVISION='radio-safe-stations-v1-general-audience-queue';
const SAFE_KEY='civweave.safe-mode.v1';
const STATE_KEY='civweave.radio.safe-station-state.v1';
const PANEL_ID='cw-radio-station-panel-v1';
const STYLE_ID='cw-radio-safe-stations-v1-style';
const SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia'];
const FALLBACK_PATHS=new Map([
  ['/app/working-campus-v156.html','civweave'],
  ['/app/cabinets/living-school/index.html','living-school'],
  ['/app/realm-console-v140.html','cerbanimo'],
  ['/app/fellowfare-cabinet-v144.html','fellowfare'],
  ['/app/anarchadia-console-v139.html','anarchadia']
]);

const SAFE_STATIONS=deepFreeze({
  civweave:{
    name:'Civweave Radio',guide:'Weaveling',policy:'general-audience-non-graphic-v1',
    tracks:[
      track('Soulful Strut','Young-Holt Unlimited','6v8mOtpRlXbG3BOauqPRHC'),
      track('Time (You and I)','Khruangbin','1y9hFN1CsG28HXYg4Tn5k9'),
      track('Lovely Day','Bill Withers','0bRXwKfigvpKZUurwqAlEh'),
      track('Back Pocket','Vulfpeck, Theo Katzman, Christine Hucal, Mark Dover','0tLwe28zupkUQMpoXIDgX2'),
      track('Shiny Happy People','R.E.M.','1v2zyAJrChw5JnfafSkwkJ'),
      track('Higher Ground','Stevie Wonder','6OlRnUa93tkUXDX8Ow3Bko'),
      track('You Can Get It If You Really Want','Jimmy Cliff','1Pao4DTLMB4gJPTnqmLgSQ'),
      track("I'll Take You There",'The Staple Singers','7jiugKbRYzAptqScmOANqT')
    ]
  },
  'living-school':{
    name:'Living School Radio',guide:'Moss',policy:'general-audience-non-graphic-v1',
    tracks:[
      track('From Little Things Big Things Grow','Paul Kelly','4n5yVHeJzTkoPbJfXtN4h9'),
      track('Paprika','Japanese Breakfast','3zyqphgXvgHe436IMKeey3'),
      track('Loud Pipes','Ratatat','3qkFIjYRInFasy2jeDZPgm'),
      track('Soulful Strut','Young-Holt Unlimited','6v8mOtpRlXbG3BOauqPRHC'),
      track('Shiny Happy People','R.E.M.','1v2zyAJrChw5JnfafSkwkJ'),
      track('Lovely Day','Bill Withers','0bRXwKfigvpKZUurwqAlEh'),
      track('Back Pocket','Vulfpeck, Theo Katzman, Christine Hucal, Mark Dover','0tLwe28zupkUQMpoXIDgX2'),
      track('Time (You and I)','Khruangbin','1y9hFN1CsG28HXYg4Tn5k9')
    ]
  },
  cerbanimo:{
    name:'Cerbanimo Radio',guide:'Kamiya',policy:'general-audience-non-graphic-v1',
    tracks:[
      track('Genesis','Justice','5iG0sNphqkvscYeBxWkNKE'),
      track('Robot Rock','Daft Punk','7LL40F6YdZgeiQ6en1c7Lk'),
      track('Atlas','Battles','0QhOKLjueYgO6bUY9K7JVa'),
      track('Soulful Strut','Young-Holt Unlimited','6v8mOtpRlXbG3BOauqPRHC'),
      track('Loud Pipes','Ratatat','3qkFIjYRInFasy2jeDZPgm'),
      track("Ain't No Stoppin' Us Now",'McFadden & Whitehead','4Ymk3pqpkGx19gyxxUj5LK'),
      track('Move on Up - Single Edit','Curtis Mayfield','0MHXrqn909p0LRTPsNsGEi'),
      track('Back Pocket','Vulfpeck, Theo Katzman, Christine Hucal, Mark Dover','0tLwe28zupkUQMpoXIDgX2')
    ]
  },
  fellowfare:{
    name:'FellowFare Radio',guide:'Rook',policy:'general-audience-non-graphic-v1',
    tracks:[
      track('Soulful Strut','Young-Holt Unlimited','6v8mOtpRlXbG3BOauqPRHC'),
      track('Loud Pipes','Ratatat','3qkFIjYRInFasy2jeDZPgm'),
      track('August 10','Khruangbin','4I59UjiR1vDGGdLmdvFoJO'),
      track('Lovely Day','Bill Withers','0bRXwKfigvpKZUurwqAlEh'),
      track('Back Pocket','Vulfpeck, Theo Katzman, Christine Hucal, Mark Dover','0tLwe28zupkUQMpoXIDgX2'),
      track('Shiny Happy People','R.E.M.','1v2zyAJrChw5JnfafSkwkJ'),
      track('You Can Get It If You Really Want','Jimmy Cliff','1Pao4DTLMB4gJPTnqmLgSQ'),
      track("I'll Take You There",'The Staple Singers','7jiugKbRYzAptqScmOANqT')
    ]
  },
  anarchadia:{
    name:'Anarchadia Radio',guide:'Merlin',policy:'general-audience-non-graphic-v1',
    tracks:[
      track("Talkin' Bout a Revolution",'Tracy Chapman','0YMFcrMtBowDdD5bPz0cgy'),
      track('Resister','She Drew The Gun','2T6hgTJJ5x7qNxcy9w7R3a'),
      track('Everyday People','Sly & The Family Stone','4ZVZBc5xvMyV3WzWktn8i7'),
      track('Shiny Happy People','R.E.M.','1v2zyAJrChw5JnfafSkwkJ'),
      track('Higher Ground','Stevie Wonder','6OlRnUa93tkUXDX8Ow3Bko'),
      track('You Can Get It If You Really Want','Jimmy Cliff','1Pao4DTLMB4gJPTnqmLgSQ'),
      track("I'll Take You There",'The Staple Singers','7jiugKbRYzAptqScmOANqT'),
      track("Ain't No Stoppin' Us Now",'McFadden & Whitehead','4Ymk3pqpkGx19gyxxUj5LK')
    ]
  }
});

if(globalThis.CivweaveRadioSafeStationsV1?.revision===REVISION)return;

function deepFreeze(value){
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    Object.freeze(value);Object.values(value).forEach(deepFreeze);
  }
  return value;
}
function track(title,artist,spotifyTrackId){return Object.freeze({title,artist,spotifyTrackId,safeAudit:'SAFE-PASS-V1'})}
function parse(value,fallback){try{return JSON.parse(value)??fallback}catch{return fallback}}
function esc(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function safeModeEnabled(){
  try{const api=globalThis.CivweaveSafeModeV1;if(api?.read)return Boolean(api.read()?.enabled)}catch{}
  try{return Boolean(parse(localStorage.getItem(SAFE_KEY),{})?.enabled)}catch{return false}
}
function normalizeSystemId(value){return String(value||'').trim().toLowerCase().replace('_','-')}
function currentSystem(){
  const surface=globalThis.CivweaveRadioStationSurfaceV1;
  return normalizeSystemId(surface?.detectSystem?.()||document.documentElement?.dataset?.civweaveSystemRoute||FALLBACK_PATHS.get(location.pathname)||'');
}
function station(system=currentSystem()){return SAFE_STATIONS[normalizeSystemId(system)]||null}
function tracksFor(system=currentSystem()){return station(system)?.tracks||[]}
function loadState(){try{return parse(sessionStorage.getItem(STATE_KEY),{})||{}}catch{return{}}}
function saveState(state){try{sessionStorage.setItem(STATE_KEY,JSON.stringify(state))}catch{}return state}
function stateFor(system=currentSystem()){
  const id=normalizeSystemId(system),tracks=tracksFor(id),all=loadState(),stored=all[id]||{};
  const index=Math.min(Math.max(Number(stored.index)||0,0),Math.max(0,tracks.length-1));
  const suggestionIndex=Number.isInteger(stored.suggestionIndex)?Math.min(Math.max(stored.suggestionIndex,0),Math.max(0,tracks.length-1)):-1;
  return{id,index,suggestionIndex,recent:Array.isArray(stored.recent)?stored.recent.slice(0,6):[]};
}
function writeState(system,next){const id=normalizeSystemId(system),all=loadState();all[id]={...all[id],...next};saveState(all);return stateFor(id)}
function currentTrack(system=currentSystem()){const state=stateFor(system),tracks=tracksFor(system);return tracks[state.index]||null}
function select(index,system=currentSystem()){
  const id=normalizeSystemId(system),tracks=tracksFor(id);if(!tracks.length)return null;
  const bounded=Math.min(Math.max(Number(index)||0,0),tracks.length-1);writeState(id,{index:bounded});render();emit('SAFE_STATION_TRACK_SELECTED',{system:id,index:bounded,track:tracks[bounded]});return tracks[bounded];
}
function next(system=currentSystem()){const tracks=tracksFor(system),state=stateFor(system);return tracks.length?select((state.index+1)%tracks.length,system):null}
function previous(system=currentSystem()){const tracks=tracksFor(system),state=stateFor(system);return tracks.length?select((state.index-1+tracks.length)%tracks.length,system):null}
function randomIndex(length){if(length<=1)return 0;if(globalThis.crypto?.getRandomValues){const value=new Uint32Array(1);globalThis.crypto.getRandomValues(value);return value[0]%length}return Math.floor(Math.random()*length)}
function suggestTrack(system=currentSystem()){
  const id=normalizeSystemId(system),tracks=tracksFor(id),state=stateFor(id);if(!tracks.length)return null;
  const blocked=new Set(state.recent);let candidates=tracks.map((track,index)=>({track,index})).filter(({track})=>!blocked.has(track.spotifyTrackId)&&track.spotifyTrackId!==currentTrack(id)?.spotifyTrackId);
  if(!candidates.length)candidates=tracks.map((track,index)=>({track,index}));
  const picked=candidates[randomIndex(candidates.length)]||candidates[0];
  const recent=[picked.track.spotifyTrackId,...state.recent.filter(value=>value!==picked.track.spotifyTrackId)].slice(0,6);
  writeState(id,{suggestionIndex:picked.index,recent});
  emit('SAFE_STATION_TRACK_SUGGESTED',{system:id,index:picked.index,track:picked.track});
  return picked.track;
}
function suggestedTrack(system=currentSystem()){
  const state=stateFor(system),tracks=tracksFor(system);
  return state.suggestionIndex>=0?tracks[state.suggestionIndex]||null:null;
}
function selectSuggested(system=currentSystem()){
  const state=stateFor(system);return state.suggestionIndex>=0?select(state.suggestionIndex,system):null;
}
function spotifyTrackUrl(trackValue){const id=String(trackValue?.spotifyTrackId||'');return /^[A-Za-z0-9]{22}$/.test(id)?`https://open.spotify.com/track/${id}`:''}
function emit(type,detail={}){try{dispatchEvent(new CustomEvent('civweave:radio-safe-station-event',{detail:{type,revision:REVISION,...detail}}))}catch{}}

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
#${PANEL_ID} .cw-radio-safe-station{display:grid;gap:10px}
#${PANEL_ID} .cw-radio-safe-current{display:grid;gap:7px;padding:12px;border:1px solid #ffffff24;border-radius:14px;background:#ffffff08}
#${PANEL_ID} .cw-radio-safe-current small{opacity:.7;font-size:10px;font-weight:850;letter-spacing:.08em;text-transform:uppercase}
#${PANEL_ID} .cw-radio-safe-current strong{font-size:15px}
#${PANEL_ID} .cw-radio-safe-controls{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
#${PANEL_ID} .cw-radio-safe-controls button,#${PANEL_ID} .cw-radio-safe-controls a{min-height:36px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #ffffff28;border-radius:999px;padding:0 11px;background:#ffffff0a;color:#fff;text-decoration:none;font-weight:800}
#${PANEL_ID} .cw-radio-safe-queue{display:grid;gap:2px;margin:0;padding:0;list-style:none}
#${PANEL_ID} .cw-radio-safe-queue button{width:100%;display:grid;grid-template-columns:30px minmax(0,1fr);gap:8px;align-items:center;text-align:left;border:0;border-radius:10px;padding:8px;background:transparent;color:inherit}
#${PANEL_ID} .cw-radio-safe-queue button[aria-current="true"]{background:#83e9ff18;outline:1px solid #83e9ff55}
#${PANEL_ID} .cw-radio-safe-queue b{display:block;font-size:12px}#${PANEL_ID} .cw-radio-safe-queue span{display:block;opacity:.68;font-size:10px}
`;
  document.head?.append(style);
}
function sanitizeCoreCopy(){
  const panel=document.getElementById(PANEL_ID);if(!panel)return false;
  const auditLabel=panel.querySelector(':scope > header small');if(auditLabel)auditLabel.hidden=true;
  panel.querySelector('.cw-radio-note')?.remove();
  panel.querySelectorAll('.cw-radio-track > div > span').forEach(node=>{node.textContent=String(node.textContent||'').replace(/\s+·\s+PASS(?:-LIGHT)?\s*$/,'')});
  const originalNote=panel.querySelector('.cw-radio-original p');if(originalNote)originalNote.textContent='This opens the original station and may contain explicit content.';
  return true;
}
function restoreCoreSurface(){
  const panel=document.getElementById(PANEL_ID),surface=globalThis.CivweaveRadioStationSurfaceV1;if(!panel)return false;
  const original=panel.querySelector('[data-radio-mode="original"]'),clean=panel.querySelector('[data-radio-mode="clean"]');
  if(original){original.style.removeProperty('display');original.removeAttribute('aria-hidden')}
  if(clean)clean.textContent='Clean station';
  surface?.refresh?.();sanitizeCoreCopy();
  return true;
}
function render(){
  if(!safeModeEnabled()){sanitizeCoreCopy();return false}
  const panel=document.getElementById(PANEL_ID),id=currentSystem(),item=station(id);if(!panel||!item)return false;
  installStyle();sanitizeCoreCopy();
  const original=panel.querySelector('[data-radio-mode="original"]'),clean=panel.querySelector('[data-radio-mode="clean"]'),badge=panel.querySelector('[data-radio-safe]'),body=panel.querySelector('[data-radio-body]');
  if(original){original.hidden=true;original.disabled=true;original.style.display='none';original.setAttribute('aria-hidden','true')}
  if(clean){clean.textContent='S.A.F.E. station';clean.setAttribute('aria-pressed','true')}
  if(badge){badge.hidden=false;badge.textContent='S.A.F.E.'}
  if(!body)return false;
  const state=stateFor(id),current=item.tracks[state.index]||item.tracks[0],href=spotifyTrackUrl(current);
  body.innerHTML=`<section class="cw-radio-safe-station" data-radio-safe-station="${esc(id)}"><div class="cw-radio-safe-current"><small>Current track · ${state.index+1} of ${item.tracks.length}</small><strong>${esc(current?.title||'')}</strong><span>${esc(current?.artist||'')}</span><div class="cw-radio-safe-controls"><button type="button" data-safe-radio-action="previous">Previous</button>${href?`<a href="${href}" target="_blank" rel="noopener noreferrer external">Open current track ↗</a>`:''}<button type="button" data-safe-radio-action="next">Next</button></div></div><ol class="cw-radio-safe-queue">${item.tracks.map((row,index)=>`<li><button type="button" data-safe-radio-index="${index}" aria-current="${index===state.index?'true':'false'}"><span>${index+1}</span><span><b>${esc(row.title)}</b><span>${esc(row.artist)}</span></span></button></li>`).join('')}</ol></section>`;
  if(body.dataset.safeRadioBound!=='true'){
    body.dataset.safeRadioBound='true';
    body.addEventListener('click',event=>{
      const action=event.target.closest?.('[data-safe-radio-action]')?.dataset.safeRadioAction;
      if(action==='previous'){previous();return}
      if(action==='next'){next();return}
      const button=event.target.closest?.('[data-safe-radio-index]');if(button)select(Number(button.dataset.safeRadioIndex));
    });
  }
  document.documentElement.dataset.civweaveRadioSafeStation='active';
  emit('SAFE_STATION_RENDERED',{system:id,index:state.index,trackCount:item.tracks.length});
  return true;
}
function enforce(){
  if(safeModeEnabled())return render();
  delete document.documentElement.dataset.civweaveRadioSafeStation;
  return restoreCoreSurface();
}
function start(){
  installStyle();sanitizeCoreCopy();
  addEventListener('civweave:radio-station-opened',()=>{safeModeEnabled()?render():sanitizeCoreCopy()});
  addEventListener('civweave:radio-station-mode-changed',()=>{safeModeEnabled()?render():sanitizeCoreCopy()});
  addEventListener('civweave:safe-mode-changed',enforce);
  addEventListener('pageshow',()=>{safeModeEnabled()?render():sanitizeCoreCopy()});
  if(safeModeEnabled())queueMicrotask(render);
  return true;
}

const api=Object.freeze({
  version:VERSION,revision:REVISION,systems:Object.freeze([...SYSTEMS]),stations:SAFE_STATIONS,
  safeModeEnabled,currentSystem,station,tracksFor,stateFor,currentTrack,select,next,previous,suggestTrack,suggestedTrack,selectSuggested,spotifyTrackUrl,render,enforce,sanitizeCoreCopy,start,
  failClosed:true,externalUncensoredRoutes:0,independentQueue:true,policy:'general-audience-non-graphic-v1'
});
globalThis.CivweaveRadioSafeStationsV1=api;
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
try{dispatchEvent(new CustomEvent('civweave:radio-safe-stations-ready',{detail:{version:VERSION,revision:REVISION,systems:SYSTEMS,failClosed:true,independentQueue:true}}))}catch{}
})();
