(()=>{
'use strict';

const VERSION='1.4.0';
const REVISION='radio-track-suggestions-v245';
const PICK_KEY='civweave.radio.track-picks.v242';
const TRACK_MAP_PATH='/app/radio-track-map-v241.json';
const CARD_ID='cw-radio-suggestion-v233';
const RECENT_WINDOW=6;
const SPOTIFY_CAMPAIGN='civweave-pwa';
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
function spotifyTrackId(value){
  const raw=String(value||'').trim();
  if(!raw)return'';
  const uri=raw.match(/^spotify:track:([A-Za-z0-9]+)$/i);if(uri)return uri[1];
  const url=raw.match(/open\.spotify\.com\/track\/([A-Za-z0-9]+)/i);if(url)return url[1];
  return /^[A-Za-z0-9]{22}$/.test(raw)?raw:'';
}
function parseTrackLine(line,index=0){
  const raw=String(line||'').trim();
  if(!raw)return null;
  const parts=raw.split('\t').map(part=>part.trim());
  const label=parts[0]||'';
  const id=spotifyTrackId(parts[1]||'');
  return label?Object.freeze({label,position:index,spotifyTrackId:id}):null;
}
function trackKey(track){
  const id=spotifyTrackId(track?.spotifyTrackId||'');
  return id||String(track?.label||track||'').trim().toLowerCase();
}
function pickDifferent(list,recent=[]){
  if(!Array.isArray(list)||!list.length)return null;
  const blocked=new Set((Array.isArray(recent)?recent:[recent]).map(value=>String(value||'').trim().toLowerCase()).filter(Boolean));
  const fresh=list.filter(item=>!blocked.has(trackKey(item)));
  const pool=fresh.length?fresh:list;
  return pool[randomIndex(pool.length)]||null;
}
function loadPicks(){return parse(sessionStorage.getItem(PICK_KEY),{})}
function savePicks(value){try{sessionStorage.setItem(PICK_KEY,JSON.stringify(value))}catch{}return value}
function mappedTrackId(map,system,position){return spotifyTrackId(map?.systems?.[system]?.tracks?.[position]||'')}
async function loadTrackMap(){
  if(!trackMapPromise){
    trackMapPromise=fetch(TRACK_MAP_PATH,{cache:'force-cache'})
      .then(response=>response.ok?response.json():{systems:{}})
      .catch(()=>({systems:{}}));
  }
  return trackMapPromise;
}
function radioFor(systemId){
  const system=normalizeSystemId(systemId);
  return globalThis.CivweaveRadioRecommendationAgentV233?.registry?.[system]||null;
}
function playlistMeta(systemId){
  const system=normalizeSystemId(systemId),radio=radioFor(system);
  const spotifyUrl=String(radio?.spotifyUrl||'');
  const match=spotifyUrl.match(/open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/i);
  if(!match)return null;
  return Object.freeze({system,playlistId:match[1],playlistUri:`spotify:playlist:${match[1]}`,spotifyUrl});
}
function stationUrl(systemId){return playlistMeta(systemId)?.spotifyUrl||'https://open.spotify.com/'}
function spotifyContextUrl(track,systemId){
  const meta=playlistMeta(systemId);if(!meta)return'https://open.spotify.com/';
  const id=spotifyTrackId(track?.spotifyTrackId||'');
  if(!id)return meta.spotifyUrl;
  const url=new URL(`https://open.spotify.com/track/${id}`);
  url.searchParams.set('context',meta.playlistUri);
  return url.href;
}
function spotifyContentLink(track,systemId){
  const meta=playlistMeta(systemId);if(!meta)return'https://open.spotify.com/';
  const id=spotifyTrackId(track?.spotifyTrackId||'');
  if(!id)return meta.spotifyUrl;
  const contentUrl=spotifyContextUrl({...track,spotifyTrackId:id},systemId);
  const handoff=new URL('https://spotify.link/content_linking');
  handoff.searchParams.set('~campaign',SPOTIFY_CAMPAIGN);
  handoff.searchParams.set('$deeplink_path',contentUrl);
  handoff.searchParams.set('$fallback_url',contentUrl);
  handoff.searchParams.set('$canonical_url',contentUrl);
  return handoff.href;
}
// Compatibility helper retained from the failed v243 highlight experiment.
function spotifyHighlightedPlaylistUrl(track,systemId){return spotifyContentLink(track,systemId)}
async function loadTracks(systemId){
  const system=normalizeSystemId(systemId),path=DIRECTORY_PATHS[system];
  if(!path)return[];
  if(!trackCache.has(system)){
    trackCache.set(system,Promise.all([
      fetch(path,{cache:'force-cache'}).then(response=>{if(!response.ok)throw new Error(`radio directory ${response.status}`);return response.text()}),
      loadTrackMap()
    ]).then(([text,map])=>text.split(/\r?\n/).map((line,index)=>{
      const parsed=parseTrackLine(line,index);if(!parsed)return null;
      const id=parsed.spotifyTrackId||mappedTrackId(map,system,index);
      return id?Object.freeze({...parsed,spotifyTrackId:id}):parsed;
    }).filter(Boolean)).catch(error=>{trackCache.delete(system);console.warn('[Civweave Radio] station directory unavailable.',system,error);return[]}));
  }
  return trackCache.get(system);
}
async function pickTrack(systemId){
  const system=normalizeSystemId(systemId),tracks=await loadTracks(system);
  const picks=loadPicks(),prior=picks[system]||{};
  const recent=Array.isArray(prior.recent)?prior.recent:[];
  const track=pickDifferent(tracks,recent);
  if(track){
    const key=trackKey(track);
    const nextRecent=[key,...recent.filter(value=>value!==key)].slice(0,RECENT_WINDOW);
    savePicks({...picks,[system]:{...prior,track:track.label,spotifyTrackId:spotifyTrackId(track.spotifyTrackId),recent:nextRecent}});
  }
  return track;
}
function pickTag(systemId){
  const system=normalizeSystemId(systemId),tags=TAGS[system]||[];
  const picks=loadPicks();
  let tag=tags.length?tags[randomIndex(tags.length)]:'';
  for(let i=0;i<4&&tag===picks[system]?.tag&&tags.length>1;i++)tag=tags[randomIndex(tags.length)];
  if(tag)savePicks({...picks,[system]:{...(picks[system]||{}),tag}});
  return tag;
}
function installStyle(){
  if(document.getElementById('cw-radio-track-style-v245'))return;
  const style=document.createElement('style');style.id='cw-radio-track-style-v245';style.textContent=`
#${CARD_ID} .cw-radio-pick-v241{margin:0 0 12px;padding:10px 11px;border:1px solid #ffffff24;border-radius:13px;background:#00000024}
#${CARD_ID} .cw-radio-tag-v241{display:inline-flex;max-width:100%;margin:0 0 7px;padding:4px 8px;border:1px solid #ffffff34;border-radius:999px;background:#ffffff10;font-size:10px;font-weight:900;letter-spacing:.08em;line-height:1.25;text-transform:uppercase}
#${CARD_ID} .cw-radio-pick-label-v241{display:block;margin:0 0 2px;opacity:.66;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
#${CARD_ID} .cw-radio-track-v241{display:block;font-size:14px;line-height:1.35}
#${CARD_ID} .cw-radio-track-position-v245{display:block;margin-top:3px;opacity:.66;font-size:10px;font-weight:750;letter-spacing:.04em;text-transform:uppercase}
#${CARD_ID} .cw-radio-actions-v241{display:flex;flex-wrap:wrap;gap:7px;align-items:center}
#${CARD_ID} .cw-radio-track-link-v241{display:inline-flex;align-items:center;min-height:36px;padding:0 12px;border:1px solid #ffffff35;border-radius:999px;color:#fff;text-decoration:none;font-size:12px;font-weight:850;background:#ffffff0d}
#${CARD_ID} .cw-radio-link{min-height:36px;padding:0 12px;font-size:12px}
`;document.head?.append(style);
}
function externalizeSpotifyLink(link){
  if(!link)return null;
  link.target='_blank';
  link.rel='noopener noreferrer external';
  return link;
}
async function decorate(systemId){
  const system=normalizeSystemId(systemId),card=document.getElementById(CARD_ID);
  if(!card||!DIRECTORY_PATHS[system])return null;
  if(card.dataset.radioTrackSuggestionRevision===REVISION)return card.dataset.radioTrack||null;
  const tracks=await loadTracks(system);
  const track=await pickTrack(system);if(!track||!card.isConnected)return null;
  const tag=pickTag(system);installStyle();
  const block=document.createElement('div');block.className='cw-radio-pick-v241';
  const badge=document.createElement('span');badge.className='cw-radio-tag-v241';badge.textContent=tag;
  const label=document.createElement('span');label.className='cw-radio-pick-label-v241';label.textContent='Suggested from this station';
  const title=document.createElement('strong');title.className='cw-radio-track-v241';title.textContent=track.label;
  const position=document.createElement('span');position.className='cw-radio-track-position-v245';position.textContent=`Station track ${track.position+1} of ${tracks.length}`;
  block.append(badge,label,title,position);

  const stationLink=externalizeSpotifyLink(card.querySelector?.('.cw-radio-link'));
  if(stationLink)stationLink.textContent='Open station ↗';
  const actions=document.createElement('div');actions.className='cw-radio-actions-v241';
  const trackLink=externalizeSpotifyLink(document.createElement('a'));trackLink.className='cw-radio-track-link-v241';
  let trackLinkMounted=false;
  const mountContextLink=id=>{
    const resolved=spotifyTrackId(id||track.spotifyTrackId||'');
    if(!resolved)return'';
    const meta=playlistMeta(system);if(!meta)return'';
    const contextUrl=spotifyContextUrl({...track,spotifyTrackId:resolved},system);
    trackLink.href=spotifyContentLink({...track,spotifyTrackId:resolved},system);
    trackLink.textContent='Play suggested station track ↗';
    trackLink.dataset.spotifyContextReady='true';
    trackLink.dataset.spotifyPlaylistId=meta.playlistId;
    trackLink.dataset.spotifyTrackId=resolved;
    trackLink.dataset.spotifyContextUrl=contextUrl;
    if(!trackLinkMounted){
      if(stationLink?.parentNode===card){
        card.insertBefore(actions,stationLink);actions.append(trackLink,stationLink);
      }else{
        actions.append(trackLink);block.after?.(actions);
      }
      trackLinkMounted=true;
    }
    return resolved;
  };
  trackLink.addEventListener('click',()=>{
    globalThis.dispatchEvent?.(new CustomEvent('civweave:radio-track-event',{detail:{type:'RADIO_TRACK_CLICKED',revision:REVISION,system,track:track.label,position:track.position,spotifyTrackId:trackLink.dataset.spotifyTrackId||'',playlistId:trackLink.dataset.spotifyPlaylistId||'',contextUrl:trackLink.dataset.spotifyContextUrl||'',contextReady:true,external:true,contentLinking:true,tag}}));
  },{once:true});

  const radioTitle=card.querySelector?.('.cw-radio-title');
  if(radioTitle?.after)radioTitle.after(block);else card.insertBefore?.(block,stationLink||null);
  const initialId=mountContextLink('');
  if(!initialId&&!stationLink){
    const fallback=externalizeSpotifyLink(document.createElement('a'));fallback.className='cw-radio-track-link-v241';fallback.href=stationUrl(system);fallback.textContent='Open station ↗';
    block.after?.(fallback);
  }

  card.dataset.radioTrackSuggestionRevision=REVISION;card.dataset.radioTrack=track.label;card.dataset.radioTrackPosition=String(track.position);card.dataset.spotifyTrackId=initialId;
  globalThis.dispatchEvent?.(new CustomEvent('civweave:radio-track-event',{detail:{type:'RADIO_TRACK_SUGGESTED',revision:REVISION,system,track:track.label,position:track.position,stationTrackNumber:track.position+1,stationTrackCount:tracks.length,spotifyTrackId:initialId,playlistId:playlistMeta(system)?.playlistId||'',contextReady:Boolean(initialId),external:true,contentLinking:Boolean(initialId),tag}}));
  return track.label;
}
function onRadioEvent(event){const detail=event?.detail||{};if(detail.type==='RADIO_CTA_SHOWN')decorate(detail.system)}
function start(){
  addEventListener('civweave:radio-event',onRadioEvent);
  const existing=document.getElementById(CARD_ID);if(existing)decorate(existing.dataset.system||'');
  return true;
}
const api=Object.freeze({version:VERSION,revision:REVISION,recentWindow:RECENT_WINDOW,directoryPaths:DIRECTORY_PATHS,trackMapPath:TRACK_MAP_PATH,tags:TAGS,normalizeSystemId,spotifyTrackId,parseTrackLine,trackKey,playlistMeta,stationUrl,spotifyContextUrl,spotifyContentLink,spotifyHighlightedPlaylistUrl,loadTrackMap,loadTracks,pickTrack,pickTag,externalizeSpotifyLink,decorate,start});
globalThis.CivweaveRadioTrackSuggestionsV245=api;
globalThis.CivweaveRadioTrackSuggestionsV244=api;
globalThis.CivweaveRadioTrackSuggestionsV243=api;
globalThis.CivweaveRadioTrackSuggestionsV242=api;
globalThis.CivweaveRadioTrackSuggestionsV241=api;
globalThis.CivweaveRadioTrackSuggestionsV240=api;
start();
globalThis.dispatchEvent?.(new CustomEvent('civweave:radio-track-suggestions-ready',{detail:{version:VERSION,revision:REVISION,systems:Object.keys(DIRECTORY_PATHS),playlistContext:true,exactTrackLink:true,spotifyContentLinking:true,externalPlaybackHandoff:true,recentWindow:RECENT_WINDOW,trackMapPath:TRACK_MAP_PATH}}));
})();
