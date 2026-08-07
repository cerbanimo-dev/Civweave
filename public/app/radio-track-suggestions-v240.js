(()=>{
'use strict';

const VERSION='1.0.0';
const REVISION='radio-track-suggestions-v240';
const PICK_KEY='civweave.radio.track-picks.v240';
const CARD_ID='cw-radio-suggestion-v233';
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

function deepFreeze(value){
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    Object.freeze(value);Object.values(value).forEach(deepFreeze);
  }
  return value;
}
function parse(value,fallback){try{return JSON.parse(value)??fallback}catch{return fallback}}
function normalizeSystemId(value){
  const raw=String(value||'').trim().toLowerCase();
  return SYSTEM_ALIASES[raw]||raw;
}
function randomIndex(length){
  if(length<=1)return 0;
  if(globalThis.crypto?.getRandomValues){
    const values=new Uint32Array(1);globalThis.crypto.getRandomValues(values);return values[0]%length;
  }
  return Math.floor(Math.random()*length);
}
function pickDifferent(list,last=''){
  if(!Array.isArray(list)||!list.length)return'';
  if(list.length===1)return list[0];
  let candidate=list[randomIndex(list.length)];
  for(let i=0;i<4&&candidate===last;i++)candidate=list[randomIndex(list.length)];
  return candidate===last?list[(list.indexOf(last)+1)%list.length]:candidate;
}
function loadPicks(){return parse(sessionStorage.getItem(PICK_KEY),{})}
function savePicks(value){try{sessionStorage.setItem(PICK_KEY,JSON.stringify(value))}catch{}return value}
async function loadTracks(systemId){
  const system=normalizeSystemId(systemId),path=DIRECTORY_PATHS[system];
  if(!path)return[];
  if(!trackCache.has(system)){
    trackCache.set(system,fetch(path,{cache:'force-cache'})
      .then(response=>{if(!response.ok)throw new Error(`radio directory ${response.status}`);return response.text()})
      .then(text=>text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean))
      .catch(error=>{trackCache.delete(system);console.warn('[Civweave Radio] station directory unavailable.',system,error);return[]}));
  }
  return trackCache.get(system);
}
async function pickTrack(systemId){
  const system=normalizeSystemId(systemId),tracks=await loadTracks(system);
  const picks=loadPicks(),track=pickDifferent(tracks,picks[system]?.track||'');
  if(track)savePicks({...picks,[system]:{...(picks[system]||{}),track}});
  return track;
}
function pickTag(systemId){
  const system=normalizeSystemId(systemId),tags=TAGS[system]||[];
  const picks=loadPicks(),tag=pickDifferent(tags,picks[system]?.tag||'');
  if(tag)savePicks({...picks,[system]:{...(picks[system]||{}),tag}});
  return tag;
}
function spotifySearchUrl(track){
  const query=String(track||'').trim();
  return query?`https://open.spotify.com/search/${encodeURIComponent(query)}`:'https://open.spotify.com/';
}
function installStyle(){
  if(document.getElementById('cw-radio-track-style-v240'))return;
  const style=document.createElement('style');style.id='cw-radio-track-style-v240';style.textContent=`
#${CARD_ID} .cw-radio-pick-v240{margin:0 0 12px;padding:10px 11px;border:1px solid #ffffff24;border-radius:13px;background:#00000024}
#${CARD_ID} .cw-radio-tag-v240{display:inline-flex;max-width:100%;margin:0 0 7px;padding:4px 8px;border:1px solid #ffffff34;border-radius:999px;background:#ffffff10;font-size:10px;font-weight:900;letter-spacing:.08em;line-height:1.25;text-transform:uppercase}
#${CARD_ID} .cw-radio-pick-label-v240{display:block;margin:0 0 2px;opacity:.66;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
#${CARD_ID} .cw-radio-track-v240{display:block;font-size:14px;line-height:1.35}
#${CARD_ID} .cw-radio-actions-v240{display:flex;flex-wrap:wrap;gap:7px;align-items:center}
#${CARD_ID} .cw-radio-track-link-v240{display:inline-flex;align-items:center;min-height:36px;padding:0 12px;border:1px solid #ffffff35;border-radius:999px;color:#fff;text-decoration:none;font-size:12px;font-weight:850;background:#ffffff0d}
#${CARD_ID} .cw-radio-link{min-height:36px;padding:0 12px;font-size:12px}
`;document.head?.append(style);
}
async function decorate(systemId){
  const system=normalizeSystemId(systemId),card=document.getElementById(CARD_ID);
  if(!card||!DIRECTORY_PATHS[system])return null;
  if(card.dataset.radioTrackSuggestionRevision===REVISION)return card.dataset.radioTrack||null;
  const track=await pickTrack(system);if(!track||!card.isConnected)return null;
  const tag=pickTag(system);installStyle();
  const block=document.createElement('div');block.className='cw-radio-pick-v240';
  const badge=document.createElement('span');badge.className='cw-radio-tag-v240';badge.textContent=tag;
  const label=document.createElement('span');label.className='cw-radio-pick-label-v240';label.textContent='Random pull from this station';
  const title=document.createElement('strong');title.className='cw-radio-track-v240';title.textContent=track;
  block.append(badge,label,title);
  const stationLink=card.querySelector?.('.cw-radio-link');
  const actions=document.createElement('div');actions.className='cw-radio-actions-v240';
  const trackLink=document.createElement('a');trackLink.className='cw-radio-track-link-v240';trackLink.href=spotifySearchUrl(track);trackLink.target='_blank';trackLink.rel='noopener noreferrer';trackLink.textContent='Find this track ↗';
  trackLink.addEventListener('click',()=>globalThis.dispatchEvent?.(new CustomEvent('civweave:radio-track-event',{detail:{type:'RADIO_TRACK_CLICKED',revision:REVISION,system,track,tag}})),{once:true});
  const radioTitle=card.querySelector?.('.cw-radio-title');
  if(radioTitle?.after)radioTitle.after(block);else card.insertBefore?.(block,stationLink||null);
  if(stationLink){
    stationLink.textContent='Open station ↗';
    if(stationLink.parentNode===card){card.insertBefore(actions,stationLink);actions.append(trackLink,stationLink)}else actions.append(trackLink);
  }else{actions.append(trackLink);block.after?.(actions)}
  card.dataset.radioTrackSuggestionRevision=REVISION;card.dataset.radioTrack=track;
  globalThis.dispatchEvent?.(new CustomEvent('civweave:radio-track-event',{detail:{type:'RADIO_TRACK_SUGGESTED',revision:REVISION,system,track,tag}}));
  return track;
}
function onRadioEvent(event){const detail=event?.detail||{};if(detail.type==='RADIO_CTA_SHOWN')decorate(detail.system)}
function start(){
  addEventListener('civweave:radio-event',onRadioEvent);
  const existing=document.getElementById(CARD_ID);if(existing)decorate(existing.dataset.system||'');
  return true;
}
const api=Object.freeze({version:VERSION,revision:REVISION,directoryPaths:DIRECTORY_PATHS,tags:TAGS,normalizeSystemId,loadTracks,pickTrack,pickTag,spotifySearchUrl,decorate,start});
globalThis.CivweaveRadioTrackSuggestionsV240=api;
start();
globalThis.dispatchEvent?.(new CustomEvent('civweave:radio-track-suggestions-ready',{detail:{version:VERSION,revision:REVISION,systems:Object.keys(DIRECTORY_PATHS)}}));
})();
