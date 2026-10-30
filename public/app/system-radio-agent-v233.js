(()=>{
'use strict';

try{if(globalThis.parent!==globalThis&&globalThis.parent.document?.documentElement?.hasAttribute('data-persistent-system')){const inherit=()=>{globalThis.CivweaveRadioRecommendationAgentV233=globalThis.parent.CivweaveRadioRecommendationAgentV233;globalThis.CivweaveRadioRecommendationAgentV232=globalThis.CivweaveRadioRecommendationAgentV233};if(globalThis.parent.CivweaveRadioRecommendationAgentV233)inherit();else globalThis.parent.addEventListener('civweave:radio-agent-ready',inherit,{once:true});return}}catch{}

const VERSION='1.2.0';
const REVISION='system-radio-agent-v233-persistent-station-v1';
const SESSION_KEY='civweave.radio.session.v3';
const PREFS_KEY='civweave.radio.preferences.v1';
const SNOOZE_KEY='civweave.radio.snooze-until.v1';
const SNOOZE_MS=30*60*1000;
const FALLBACK_PATHS=new Map([
  ['/app/working-campus-v156.html','civweave'],
  ['/app/cabinets/living-school/index.html','living-school'],
  ['/app/realm-console-v140.html','cerbanimo'],
  ['/app/fellowfare-cabinet-v144.html','fellowfare'],
  ['/app/anarchadia-console-v139.html','anarchadia']
]);
const SYSTEM_ALIASES=Object.freeze({living_school:'living-school'});
const SYSTEM_RADIO=deepFreeze({
  anarchadia:{id:'anarchadia',name:'Anarchadia Radio',spotifyUrl:'https://open.spotify.com/playlist/2AsCLZiAPlUYHOcogllTia?si=eb56f112a533471f',messages:[{id:'default',text:'Need an anthem?'}],tracks:[]},
  cerbanimo:{id:'cerbanimo',name:'Cerbanimo Radio',spotifyUrl:'https://open.spotify.com/playlist/1CB3LLMSnuDwD013B1ZY3M?si=53a4a04d7e124ffe',messages:[{id:'default',text:'Pump up the tempo.'}],tracks:[]},
  'living-school':{id:'living-school',name:'Living School Radio',spotifyUrl:'https://open.spotify.com/playlist/2MwmQdjHyRBIu8Wy9iXWUm?si=3050b522d37e432d',messages:[{id:'default',text:'Live and learn.'}],tracks:[]},
  fellowfare:{id:'fellowfare',name:'FellowFare Radio',spotifyUrl:'https://open.spotify.com/playlist/1q6YDYRU6hekl2MkHkI2X3?si=65a29df0b33a435c',messages:[{id:'default',text:"Soft Rock for the People's Mall."}],tracks:[]},
  civweave:{id:'civweave',name:'Civweave Radio',spotifyUrl:'https://open.spotify.com/playlist/2BLWIhSfHdbcfG5rP8IqoX?si=erOpH2egRsyWT5HvxRO0tQ',messages:[{id:'default',text:'Thinking big picture? Us too.'}],tracks:[]}
});

if(globalThis.CivweaveRadioRecommendationAgentV233?.revision===REVISION)return;
let decisionProvider=null;
let started=false;

function deepFreeze(value){
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);Object.values(value).forEach(deepFreeze)}
  return value;
}
function parse(value,fallback){try{return JSON.parse(value)??fallback}catch{return fallback}}
function iso(){return new Date().toISOString()}
function uid(){return globalThis.crypto?.randomUUID?.()||`radio-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`}
function normalizeSystemId(value){const raw=String(value||'').trim().toLowerCase();return SYSTEM_ALIASES[raw]||raw}
function activeSystem(){
  const routeId=globalThis.CivweaveSystemRoutesV227?.identify?.(location.pathname);
  const datasetId=document.documentElement?.dataset?.civweaveSystemRoute||document.documentElement?.dataset?.civweaveSystem;
  return normalizeSystemId(routeId||datasetId||FALLBACK_PATHS.get(location.pathname)||'');
}
function currentRoute(){return `${location.pathname}${location.search}${location.hash}`.slice(0,1800)}
function loadSession(){
  const stored=parse(sessionStorage.getItem(SESSION_KEY),null);
  return stored&&stored.sessionId?stored:{sessionId:uid(),activeSystem:'',currentRoute:'',previousRoute:'',lastShownSystem:'',lastShownAt:'',shownCount:0,clickedSystems:[],exposureBySystem:{}};
}
function saveSession(value){sessionStorage.setItem(SESSION_KEY,JSON.stringify(value));return value}
function preferences(){return{enabled:true,...parse(localStorage.getItem(PREFS_KEY),{})}}
function setEnabled(enabled){
  const next={...preferences(),enabled:Boolean(enabled)};
  try{localStorage.setItem(PREFS_KEY,JSON.stringify(next))}catch{}
  try{dispatchEvent(new CustomEvent('civweave:radio-preferences-changed',{detail:next}))}catch{}
  globalThis.CivweaveRadioStationSurfaceV1?.refresh?.();
  return next.enabled;
}
function snoozeUntil(){
  const raw=Number(localStorage.getItem(SNOOZE_KEY)||0);
  if(!Number.isFinite(raw)||raw<=Date.now()){if(raw)try{localStorage.removeItem(SNOOZE_KEY)}catch{};return 0}
  return raw;
}
function snoozeRemainingMs(){return Math.max(0,snoozeUntil()-Date.now())}
function snooze(durationMs=SNOOZE_MS){
  const until=Date.now()+Math.max(0,Number(durationMs)||SNOOZE_MS);
  try{localStorage.setItem(SNOOZE_KEY,String(until))}catch{}
  emit('RADIO_SNOOZED',{snoozeUntil:new Date(until).toISOString(),snoozeMs:Math.max(0,Number(durationMs)||SNOOZE_MS)});
  return until;
}
function verifiedRadio(systemId){
  const radio=SYSTEM_RADIO[normalizeSystemId(systemId)];
  if(!radio)return null;
  try{const url=new URL(radio.spotifyUrl);if(url.protocol!=='https:'||url.hostname!=='open.spotify.com'||!url.pathname.startsWith('/playlist/'))return null}catch{return null}
  return radio;
}
function emit(type,detail={}){
  const payload={type,timestamp:iso(),revision:REVISION,...detail};
  try{dispatchEvent(new CustomEvent('civweave:experience-event',{detail:payload}));dispatchEvent(new CustomEvent('civweave:radio-event',{detail:payload}))}catch{}
  return payload;
}
function contextSnapshot({previousSystem='',reason='explicit_station_open',session=null}={}){
  const state=session||loadSession(),system=activeSystem();
  return Object.freeze({activeSystem:system,currentRoute:currentRoute(),route:currentRoute(),previousSystem:normalizeSystemId(previousSystem),lastPlaylistShown:state.lastShownSystem,lastTimeShown:state.lastShownAt,sessionExposureCount:Number(state.shownCount||0),snoozeUntil:snoozeUntil(),snoozeRemainingMs:snoozeRemainingMs(),reason});
}
function eligibility(context){
  if(!preferences().enabled)return{eligible:false,reason:'recommendations_disabled'};
  if(!verifiedRadio(context.activeSystem))return{eligible:false,reason:'no_approved_playlist'};
  return{eligible:true,reason:context.reason||'explicit_station_open'};
}
function defaultAgentDecision(context,gate){return{action:gate.eligible?'show':'suppress',messageVariant:'default',placement:'persistent-launcher',reason:gate.reason}}
async function agentDecision(context=contextSnapshot()){
  const gate=eligibility(context),radio=verifiedRadio(context.activeSystem);
  if(!radio)return Object.freeze({action:'suppress',messageVariant:'default',placement:'persistent-launcher',reason:'no_approved_playlist'});
  let raw;try{raw=decisionProvider?await decisionProvider(Object.freeze({activeSystem:context.activeSystem,currentRoute:context.currentRoute,previousSystem:context.previousSystem,eligibility:gate})):defaultAgentDecision(context,gate)}catch{raw=defaultAgentDecision(context,gate)}
  return Object.freeze({action:gate.eligible?'show':'suppress',messageVariant:'default',placement:'persistent-launcher',reason:String(gate.eligible?(raw?.reason||gate.reason):gate.reason).slice(0,80)});
}
async function evaluate(context=contextSnapshot()){
  const decision=await agentDecision(context);
  if(decision.action==='show'){
    const surface=globalThis.CivweaveRadioStationSurfaceV1;
    if(surface?.open)surface.open();
    else try{dispatchEvent(new CustomEvent('civweave:radio-station-open-request',{detail:{system:context.activeSystem}}))}catch{}
    emit('RADIO_STATION_OPEN_REQUESTED',{system:context.activeSystem,reason:decision.reason});
  }else emit('RADIO_CTA_SUPPRESSED',{system:context.activeSystem,reason:decision.reason});
  return decision;
}
function registerDecisionProvider(provider){if(provider!==null&&typeof provider!=='function')throw new TypeError('Radio decision provider must be a function or null.');decisionProvider=provider;return Boolean(provider)}
function updateNavigationSession(reason='page_navigated'){
  const system=activeSystem();if(!system||!verifiedRadio(system))return null;
  const session=loadSession(),previousSystem=normalizeSystemId(session.activeSystem),previousRoute=session.currentRoute||'',route=currentRoute();
  session.previousRoute=previousRoute;session.activeSystem=system;session.currentRoute=route;saveSession(session);
  if(previousSystem&&previousSystem!==system)emit('SYSTEM_CONTEXT_CHANGED',{previousSystem,activeSystem:system,route});
  emit('PAGE_NAVIGATED',{previousSystem,activeSystem:system,route,previousRoute});
  return{system,session,previousSystem,previousRoute,reason};
}
function start(){
  if(started)return true;
  const system=activeSystem();if(!system||!verifiedRadio(system))return false;
  started=true;const stored=parse(sessionStorage.getItem(SESSION_KEY),null),session=loadSession();
  updateNavigationSession('page_navigated');
  if(!stored?.sessionId)emit('SESSION_STARTED',{sessionId:session.sessionId,activeSystem:system,route:currentRoute()});
  document.documentElement.dataset.civweaveRadioAgent='persistent-user-opened-v1';
  return true;
}

const api=Object.freeze({
  version:VERSION,revision:REVISION,registry:SYSTEM_RADIO,normalizeSystemId,activeSystem,verifiedRadio,contextSnapshot,eligibility,agentDecision,evaluate,registerDecisionProvider,setEnabled,preferences,snooze,snoozeUntil,snoozeRemainingMs,start,
  autoRecommend:false,persistentSurface:'radio-station-surface-v1'
});
globalThis.CivweaveRadioRecommendationAgentV233=api;
globalThis.CivweaveRadioRecommendationAgentV232=api;
start();
try{dispatchEvent(new CustomEvent('civweave:radio-agent-ready',{detail:{version:VERSION,revision:REVISION,systems:Object.keys(SYSTEM_RADIO),snoozeMs:SNOOZE_MS,placement:'persistent-bottom-left',autoRecommend:false}}))}catch{}
})();

(()=>{
'use strict';

const VERSION='1.2.1-mobile-music-launcher-v1';
const LAUNCHER_ID='cw-radio-station-launcher-v1';
const PANEL_ID='cw-radio-station-panel-v1';
const STYLE_ID='cw-radio-station-surface-v1-style';
const MODE_KEY='civweave.radio.playback-mode.v1';
const SAFE_KEY='civweave.safe-mode.v1';
const CATALOG_PATH='/downloads/hub-media/open-music/starter-catalog.json';
const STREAM_MANIFEST_PATH='/downloads/hub-media/open-music/lazy-manifest.json';
const AUDIO_CACHE='civweave.radio.offline-audio.v1';
const MAX_AUDIO_BYTES=16*1024*1024;
const PALETTES=Object.freeze({civweave:['#cfabed','#21152e'],'living-school':['#a1dc79','#14251c'],cerbanimo:['#c8a2ff','#241735'],fellowfare:['#ffc463','#2b2114'],anarchadia:['#ff90c2','#2e1626']});
const SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia'];
const FALLBACK_PATHS=new Map([
  ['/app/working-campus-v156.html','civweave'],
  ['/app/cabinets/living-school/index.html','living-school'],
  ['/app/realm-console-v140.html','cerbanimo'],
  ['/app/fellowfare-cabinet-v144.html','fellowfare'],
  ['/app/anarchadia-console-v139.html','anarchadia']
]);
const STATIONS=deepFreeze({"civweave":{"name":"Civweave Radio","guide":"Weaveling","originalSpotifyUrl":"https://open.spotify.com/playlist/2BLWIhSfHdbcfG5rP8IqoX","tracks":[{"title":"The Revolution Will Not Be Televised","artist":"Gil Scott-Heron","spotifyTrackId":"7kjg2NCn3Zx70m1DFHSSGO","audit":"PASS-LIGHT"},{"title":"Soundtrack to the Struggle","artist":"Lowkey","spotifyTrackId":"5RbPGLDpUxSZdhZza4L7Tx","audit":"PASS"},{"title":"You Are Not A Riot (An RSVP from David Siquieros to Andy Warhol)","artist":"The Coup","spotifyTrackId":"6aYNICjPksx2715uA0UynF","audit":"PASS"},{"title":"People's Faces","artist":"Kae Tempest","spotifyTrackId":"23PCboN3H4Bk9dKzWUrHQL","audit":"PASS"},{"title":"Water No Get Enemy","artist":"Fela Kuti","spotifyTrackId":"2mQPAF4uZzwJMVRLqB7yyd","audit":"PASS"},{"title":"List Of Demands (Reparations)","artist":"Saul Williams","spotifyTrackId":"5eCB9j5o3KVJ1uL9bFQf8R","audit":"PASS"},{"title":"United Minds","artist":"Arrested Development","spotifyTrackId":"2wgxw4RfO6xNxfwUld7b9V","audit":"PASS-LIGHT"},{"title":"Clue","artist":"Mega Mango","spotifyTrackId":"24vuJBPU6pznqy1wF1hl4v","audit":"PASS"},{"title":"A Change Is Gonna Come","artist":"Sam Cooke","spotifyTrackId":"0KOE1hat4SIer491XKk4Pa","audit":"PASS"},{"title":"Tightrope (feat. Big Boi) - Big Boi Vocal Edit","artist":"Janelle Monáe,Big Boi","spotifyTrackId":"1ljzHUgt2SU2ADkhfa9eBC","audit":"PASS-LIGHT"},{"title":"Revolution","artist":"The Beatles","spotifyTrackId":"5KGLcZLBCAqdPP6sa5zLYs","audit":"PASS"},{"title":"I'll Take You There","artist":"The Staple Singers","spotifyTrackId":"7jiugKbRYzAptqScmOANqT","audit":"PASS"},{"title":"Chicago","artist":"Sufjan Stevens","spotifyTrackId":"1yupbrI7ROhigIHpQBevPh","audit":"PASS"},{"title":"Resister","artist":"She Drew The Gun","spotifyTrackId":"2T6hgTJJ5x7qNxcy9w7R3a","audit":"PASS"},{"title":"Ain't No Stoppin' Us Now","artist":"McFadden & Whitehead","spotifyTrackId":"4Ymk3pqpkGx19gyxxUj5LK","audit":"PASS"},{"title":"Move on Up - Single Edit","artist":"Curtis Mayfield","spotifyTrackId":"0MHXrqn909p0LRTPsNsGEi","audit":"PASS"},{"title":"Higher Ground","artist":"Stevie Wonder","spotifyTrackId":"6OlRnUa93tkUXDX8Ow3Bko","audit":"PASS"},{"title":"Everyday People","artist":"Sly & The Family Stone","spotifyTrackId":"4ZVZBc5xvMyV3WzWktn8i7","audit":"PASS"},{"title":"You Can Get It If You Really Want","artist":"Jimmy Cliff","spotifyTrackId":"1Pao4DTLMB4gJPTnqmLgSQ","audit":"PASS"},{"title":"For the Love of Money","artist":"The O'Jays","spotifyTrackId":"3p1JoOEhVkEnTaa4JzTMSk","audit":"PASS"},{"title":"We Got to Have Peace","artist":"Curtis Mayfield","spotifyTrackId":"1Hqtsr4UAaj495dQxFqdk8","audit":"PASS"},{"title":"Once in a Lifetime","artist":"Talking Heads","spotifyTrackId":"1Tr4K5MU5XYE44umXGDndd","audit":"PASS"},{"title":"Time (You and I)","artist":"Khruangbin","spotifyTrackId":"1y9hFN1CsG28HXYg4Tn5k9","audit":"PASS"},{"title":"Lovely Day","artist":"Bill Withers","spotifyTrackId":"0bRXwKfigvpKZUurwqAlEh","audit":"PASS"},{"title":"Busy Earnin'","artist":"Jungle","spotifyTrackId":"5TloYFwzd09yWy8xkRLVUu","audit":"PASS-LIGHT"},{"title":"Soulful Strut","artist":"Young-Holt Unlimited","spotifyTrackId":"6v8mOtpRlXbG3BOauqPRHC","audit":"PASS"},{"title":"Back Pocket","artist":"Vulfpeck,Theo Katzman,Christine Hucal,Mark Dover","spotifyTrackId":"0tLwe28zupkUQMpoXIDgX2","audit":"PASS"},{"title":"Shiny Happy People","artist":"R.E.M.","spotifyTrackId":"1v2zyAJrChw5JnfafSkwkJ","audit":"PASS"},{"title":"Little Warrior","artist":"Sri Kala,Malia Kulp","spotifyTrackId":"1dD8yQrqNsXhYLE7d5bKt4","audit":"PASS"}]},"living-school":{"name":"Living School Radio","guide":"Moss","originalSpotifyUrl":"https://open.spotify.com/playlist/2MwmQdjHyRBIu8Wy9iXWUm","tracks":[{"title":"From Little Things Big Things Grow","artist":"Paul Kelly","spotifyTrackId":"4n5yVHeJzTkoPbJfXtN4h9","audit":"PASS"},{"title":"People's Faces","artist":"Kae Tempest","spotifyTrackId":"23PCboN3H4Bk9dKzWUrHQL","audit":"PASS"},{"title":"Heavy","artist":"Street Play","spotifyTrackId":"3he3wNUgMH3M4A1P23ZPQQ","audit":"PASS"},{"title":"All You Fascists","artist":"Billy Bragg,Wilco","spotifyTrackId":"7ELquuoDdTdpZGENKNbkBy","audit":"PASS"},{"title":"The Revolution Will Not Be Televised","artist":"Gil Scott-Heron","spotifyTrackId":"7kjg2NCn3Zx70m1DFHSSGO","audit":"PASS-LIGHT"},{"title":"Long Live Palestine","artist":"Lowkey","spotifyTrackId":"6V3OLZgJzFTTOKmOk7joMr","audit":"PASS"},{"title":"Know Your Rights - Remastered","artist":"The Clash","spotifyTrackId":"31l6t3Jq09uywRTVGbzant","audit":"PASS"},{"title":"You Are Not A Riot (An RSVP from David Siquieros to Andy Warhol)","artist":"The Coup","spotifyTrackId":"6aYNICjPksx2715uA0UynF","audit":"PASS"},{"title":"Estranged Fruit","artist":"Fishbone,NOFX","spotifyTrackId":"1IXVO2dCjrYXSLHqPqRx5J","audit":"PASS"},{"title":"Can't Say It out Loud","artist":"Street Play","spotifyTrackId":"2AyhKWVXpbMLfvWPQmnR7e","audit":"PASS"},{"title":"Swarm the Hive Mind","artist":"mercury","spotifyTrackId":"5jVvOLyhniE3BW5uyhTr82","audit":"PASS"},{"title":"War on the Workers","artist":"Anne Feeney","spotifyTrackId":"5b6QESphWzfmonVHPEdF0z","audit":"PASS-LIGHT"},{"title":"Busy Earnin'","artist":"Jungle","spotifyTrackId":"5TloYFwzd09yWy8xkRLVUu","audit":"PASS-LIGHT"},{"title":"Tightrope (feat. Big Boi) - Big Boi Vocal Edit","artist":"Janelle Monáe,Big Boi","spotifyTrackId":"1ljzHUgt2SU2ADkhfa9eBC","audit":"PASS-LIGHT"},{"title":"Redemption Song","artist":"Bob Marley & The Wailers","spotifyTrackId":"26PwuMotZqcczKLHi4Htz3","audit":"PASS"},{"title":"Move on Up - Single Edit","artist":"Curtis Mayfield","spotifyTrackId":"0MHXrqn909p0LRTPsNsGEi","audit":"PASS"},{"title":"I'll Take You There","artist":"The Staple Singers","spotifyTrackId":"7jiugKbRYzAptqScmOANqT","audit":"PASS"},{"title":"Higher Ground","artist":"Stevie Wonder","spotifyTrackId":"6OlRnUa93tkUXDX8Ow3Bko","audit":"PASS"},{"title":"The Laws Have Changed","artist":"The New Pornographers","spotifyTrackId":"0mgAzpg1dOmr2meovmlBwp","audit":"PASS"},{"title":"Lovely Day","artist":"Bill Withers","spotifyTrackId":"0bRXwKfigvpKZUurwqAlEh","audit":"PASS"},{"title":"Everyday People","artist":"Sly & The Family Stone","spotifyTrackId":"4ZVZBc5xvMyV3WzWktn8i7","audit":"PASS"},{"title":"You Can Get It If You Really Want","artist":"Jimmy Cliff","spotifyTrackId":"1Pao4DTLMB4gJPTnqmLgSQ","audit":"PASS"},{"title":"For the Love of Money","artist":"The O'Jays","spotifyTrackId":"3p1JoOEhVkEnTaa4JzTMSk","audit":"PASS"},{"title":"Anti-Fun Propaganda","artist":"Gen and the Degenerates","spotifyTrackId":"1ta9VB5cCexQUcTyujDthc","audit":"PASS"},{"title":"Ain't No Stoppin' Us Now","artist":"McFadden & Whitehead","spotifyTrackId":"4Ymk3pqpkGx19gyxxUj5LK","audit":"PASS"},{"title":"Soulful Strut","artist":"Young-Holt Unlimited","spotifyTrackId":"6v8mOtpRlXbG3BOauqPRHC","audit":"PASS"},{"title":"Back Pocket","artist":"Vulfpeck,Theo Katzman,Christine Hucal,Mark Dover","spotifyTrackId":"0tLwe28zupkUQMpoXIDgX2","audit":"PASS"},{"title":"The Boy with the Arab Strap","artist":"Belle and Sebastian","spotifyTrackId":"3PTtk27SzmM2NxdS1mLEJd","audit":"PASS"},{"title":"Paprika","artist":"Japanese Breakfast","spotifyTrackId":"3zyqphgXvgHe436IMKeey3","audit":"PASS"},{"title":"Loud Pipes","artist":"Ratatat","spotifyTrackId":"3qkFIjYRInFasy2jeDZPgm","audit":"PASS"},{"title":"Shiny Happy People","artist":"R.E.M.","spotifyTrackId":"1v2zyAJrChw5JnfafSkwkJ","audit":"PASS"},{"title":"Little Warrior","artist":"Sri Kala,Malia Kulp","spotifyTrackId":"1dD8yQrqNsXhYLE7d5bKt4","audit":"PASS"},{"title":"Favorite Son","artist":"Gully Boys","spotifyTrackId":"7b2RpTtUfRGSU5deTTl074","audit":"PASS"},{"title":"God Save The Queens","artist":"Vienna Vienna","spotifyTrackId":"5gYbg3Tj7FwPGTljJ6oWEb","audit":"PASS"},{"title":"On And On","artist":"The Velveteers","spotifyTrackId":"3yGvuM7ZiPgjGbicd90rty","audit":"PASS"},{"title":"Sisyphus","artist":"Andrew Bird","spotifyTrackId":"403vzOZN0tETDpvFipkNIL","audit":"PASS-LIGHT"},{"title":"Sound of da Police","artist":"KRS-One","spotifyTrackId":"3Y6XWs8xMlCngyIxNOFnsp","audit":"PASS"},{"title":"Welcome to America","artist":"Lecrae","spotifyTrackId":"3YAUHKKgknXXpPKvczjNdf","audit":"PASS"},{"title":"Symphony Of Destruction","artist":"Megadeth","spotifyTrackId":"51TG9W3y9qyO8BY5RXKgnZ","audit":"PASS"},{"title":"True Trans Soul Rebel","artist":"Against Me!","spotifyTrackId":"4nXBhyVotGUDSsoLI4eJ01","audit":"PASS"},{"title":"Bad Reputation","artist":"Joan Jett & the Blackhearts","spotifyTrackId":"7pu8AhGUxHZSCWTkQ2eb5M","audit":"PASS-LIGHT"},{"title":"There Is Power in a Union","artist":"Billy Bragg","spotifyTrackId":"23ZMCzhyAclr3CslulKe39","audit":"PASS"},{"title":"I'll Take You There","artist":"The Staple Singers","spotifyTrackId":"7jiugKbRYzAptqScmOANqT","audit":"PASS"},{"title":"You Can Get It If You Really Want","artist":"Jimmy Cliff","spotifyTrackId":"1Pao4DTLMB4gJPTnqmLgSQ","audit":"PASS"},{"title":"Time (You and I)","artist":"Khruangbin","spotifyTrackId":"1y9hFN1CsG28HXYg4Tn5k9","audit":"PASS"},{"title":"Chicago","artist":"Sufjan Stevens","spotifyTrackId":"1yupbrI7ROhigIHpQBevPh","audit":"PASS"},{"title":"Once in a Lifetime","artist":"Talking Heads","spotifyTrackId":"1Tr4K5MU5XYE44umXGDndd","audit":"PASS"},{"title":"Little Bit Longer","artist":"Moselle","spotifyTrackId":"05atH3qAvyHwcgWm01B6ux","audit":"PASS"},{"title":"Nowhere To Go","artist":"Slow Funeral","spotifyTrackId":"2uWPfhu9bH0SaYxOQeMSFA","audit":"PASS"},{"title":"Time (You and I)","artist":"Khruangbin","spotifyTrackId":"1y9hFN1CsG28HXYg4Tn5k9","audit":"PASS"}]},"cerbanimo":{"name":"Cerbanimo Radio","guide":"Kamiya","originalSpotifyUrl":"https://open.spotify.com/playlist/1CB3LLMSnuDwD013B1ZY3M","tracks":[{"title":"Estranged Fruit","artist":"Fishbone,NOFX","spotifyTrackId":"1IXVO2dCjrYXSLHqPqRx5J","audit":"PASS"},{"title":"Can't Say It out Loud","artist":"Street Play","spotifyTrackId":"2AyhKWVXpbMLfvWPQmnR7e","audit":"PASS"},{"title":"For the Love of Money","artist":"The O'Jays","spotifyTrackId":"3p1JoOEhVkEnTaa4JzTMSk","audit":"PASS"},{"title":"Sound of da Police","artist":"KRS-One","spotifyTrackId":"3Y6XWs8xMlCngyIxNOFnsp","audit":"PASS"},{"title":"Know Your Rights - Remastered","artist":"The Clash","spotifyTrackId":"31l6t3Jq09uywRTVGbzant","audit":"PASS"},{"title":"Resister","artist":"She Drew The Gun","spotifyTrackId":"2T6hgTJJ5x7qNxcy9w7R3a","audit":"PASS"},{"title":"United Minds","artist":"Arrested Development","spotifyTrackId":"2wgxw4RfO6xNxfwUld7b9V","audit":"PASS-LIGHT"},{"title":"List Of Demands (Reparations)","artist":"Saul Williams","spotifyTrackId":"5eCB9j5o3KVJ1uL9bFQf8R","audit":"PASS"},{"title":"War on the Workers","artist":"Anne Feeney","spotifyTrackId":"5b6QESphWzfmonVHPEdF0z","audit":"PASS-LIGHT"},{"title":"All You Fascists","artist":"Billy Bragg,Wilco","spotifyTrackId":"7ELquuoDdTdpZGENKNbkBy","audit":"PASS"},{"title":"Favorite Son","artist":"Gully Boys","spotifyTrackId":"7b2RpTtUfRGSU5deTTl074","audit":"PASS"},{"title":"Ain't No Stoppin' Us Now","artist":"McFadden & Whitehead","spotifyTrackId":"4Ymk3pqpkGx19gyxxUj5LK","audit":"PASS"},{"title":"Tightrope (feat. Big Boi) - Big Boi Vocal Edit","artist":"Janelle Monáe,Big Boi","spotifyTrackId":"1ljzHUgt2SU2ADkhfa9eBC","audit":"PASS-LIGHT"},{"title":"You Are Not A Riot (An RSVP from David Siquieros to Andy Warhol)","artist":"The Coup","spotifyTrackId":"6aYNICjPksx2715uA0UynF","audit":"PASS"},{"title":"Move on Up - Single Edit","artist":"Curtis Mayfield","spotifyTrackId":"0MHXrqn909p0LRTPsNsGEi","audit":"PASS"},{"title":"The Laws Have Changed","artist":"The New Pornographers","spotifyTrackId":"0mgAzpg1dOmr2meovmlBwp","audit":"PASS"},{"title":"Genesis","artist":"Justice","spotifyTrackId":"5iG0sNphqkvscYeBxWkNKE","audit":"PASS"},{"title":"I'll Take You There","artist":"The Staple Singers","spotifyTrackId":"7jiugKbRYzAptqScmOANqT","audit":"PASS"},{"title":"Revolution","artist":"The Beatles","spotifyTrackId":"5KGLcZLBCAqdPP6sa5zLYs","audit":"PASS"},{"title":"Breathe","artist":"The Prodigy","spotifyTrackId":"6rmXhRIemCTPyMYZRDN7Qg","audit":"PASS"},{"title":"Tribulations","artist":"LCD Soundsystem","spotifyTrackId":"0NUvPZbFLiVkydUbjGnXKf","audit":"PASS"},{"title":"Busy Earnin'","artist":"Jungle","spotifyTrackId":"5TloYFwzd09yWy8xkRLVUu","audit":"PASS-LIGHT"},{"title":"Freeze Me","artist":"Death From Above 1979","spotifyTrackId":"7hFlW9d7ui1d9YG4m4CYPz","audit":"PASS"},{"title":"Stylo (feat. Mos Def and Bobby Womack)","artist":"Gorillaz,Bobby Womack,Mos Def","spotifyTrackId":"6LUfuyLgvgqrykiTE6sJHY","audit":"PASS"},{"title":"Uncontrollable Urge","artist":"DEVO","spotifyTrackId":"1KS7MVTv1uXuuZ9KAPjtE9","audit":"PASS"},{"title":"Robot Rock","artist":"Daft Punk","spotifyTrackId":"7LL40F6YdZgeiQ6en1c7Lk","audit":"PASS"},{"title":"Odessa","artist":"Caribou","spotifyTrackId":"1KnvBEzvNo3ha7ozE0eWUb","audit":"PASS"},{"title":"Atlas","artist":"Battles","spotifyTrackId":"0QhOKLjueYgO6bUY9K7JVa","audit":"PASS"},{"title":"Over And Over","artist":"Hot Chip","spotifyTrackId":"3vxYFt4Ty5sw1C1B1pRZlD","audit":"PASS"},{"title":"Romantic Rights","artist":"Death From Above 1979","spotifyTrackId":"52RNaqG34sXwYfVqWj1d0P","audit":"PASS"},{"title":"On And On","artist":"The Velveteers","spotifyTrackId":"3yGvuM7ZiPgjGbicd90rty","audit":"PASS"},{"title":"IWYTWT","artist":"Chase Petra","spotifyTrackId":"0wcv3TBRy5GcnkfMIyp9MG","audit":"PASS"},{"title":"Girl God Gun","artist":"Gen and the Degenerates","spotifyTrackId":"2gGwnLDwSxsi0zbkwEKSI6","audit":"PASS"},{"title":"Swarm the Hive Mind","artist":"mercury","spotifyTrackId":"5jVvOLyhniE3BW5uyhTr82","audit":"PASS"},{"title":"X","artist":"moony","spotifyTrackId":"56wTQgMCfTDYvnKuKDsEog","audit":"PASS"},{"title":"Listening","artist":"Boy Bandicoot","spotifyTrackId":"4HCs9rhfXhdKW8vTlHUSWp","audit":"PASS"},{"title":"Heavy","artist":"Street Play","spotifyTrackId":"3he3wNUgMH3M4A1P23ZPQQ","audit":"PASS"},{"title":"God Save The Queens","artist":"Vienna Vienna","spotifyTrackId":"5gYbg3Tj7FwPGTljJ6oWEb","audit":"PASS"}]},"fellowfare":{"name":"FellowFare Radio","guide":"Rook","originalSpotifyUrl":"https://open.spotify.com/playlist/1q6YDYRU6hekl2MkHkI2X3","tracks":[{"title":"Shiny Happy People","artist":"R.E.M.","spotifyTrackId":"1v2zyAJrChw5JnfafSkwkJ","audit":"PASS"},{"title":"Little Warrior","artist":"Sri Kala,Malia Kulp","spotifyTrackId":"1dD8yQrqNsXhYLE7d5bKt4","audit":"PASS"},{"title":"People's Faces","artist":"Kae Tempest","spotifyTrackId":"23PCboN3H4Bk9dKzWUrHQL","audit":"PASS"},{"title":"Caravan","artist":"Rush","spotifyTrackId":"43l8BalXmo4y50runkgJEh","audit":"PASS"},{"title":"Redemption Song","artist":"Bob Marley & The Wailers","spotifyTrackId":"26PwuMotZqcczKLHi4Htz3","audit":"PASS"},{"title":"Straight to Hell - Remastered","artist":"The Clash","spotifyTrackId":"2ax1vei61BzRGsEn6ckEdL","audit":"PASS"},{"title":"Revolution","artist":"The Beatles","spotifyTrackId":"5KGLcZLBCAqdPP6sa5zLYs","audit":"PASS"},{"title":"It's The End Of The World As We Know It (And I Feel Fine)","artist":"R.E.M.","spotifyTrackId":"2oSpQ7QtIKTNFfA08Cy0ku","audit":"PASS"},{"title":"Blowin' in the Wind","artist":"Bob Dylan","spotifyTrackId":"18GiV1BaXzPVYpp9rmOg0E","audit":"PASS"},{"title":"United Minds","artist":"Arrested Development","spotifyTrackId":"2wgxw4RfO6xNxfwUld7b9V","audit":"PASS-LIGHT"},{"title":"Move on Up - Single Edit","artist":"Curtis Mayfield","spotifyTrackId":"0MHXrqn909p0LRTPsNsGEi","audit":"PASS"},{"title":"I'll Take You There","artist":"The Staple Singers","spotifyTrackId":"7jiugKbRYzAptqScmOANqT","audit":"PASS"},{"title":"Higher Ground","artist":"Stevie Wonder","spotifyTrackId":"6OlRnUa93tkUXDX8Ow3Bko","audit":"PASS"},{"title":"Time (You and I)","artist":"Khruangbin","spotifyTrackId":"1y9hFN1CsG28HXYg4Tn5k9","audit":"PASS"},{"title":"Lovely Day","artist":"Bill Withers","spotifyTrackId":"0bRXwKfigvpKZUurwqAlEh","audit":"PASS"},{"title":"Busy Earnin'","artist":"Jungle","spotifyTrackId":"5TloYFwzd09yWy8xkRLVUu","audit":"PASS-LIGHT"},{"title":"Everyday People","artist":"Sly & The Family Stone","spotifyTrackId":"4ZVZBc5xvMyV3WzWktn8i7","audit":"PASS"},{"title":"You Can Get It If You Really Want","artist":"Jimmy Cliff","spotifyTrackId":"1Pao4DTLMB4gJPTnqmLgSQ","audit":"PASS"},{"title":"For the Love of Money","artist":"The O'Jays","spotifyTrackId":"3p1JoOEhVkEnTaa4JzTMSk","audit":"PASS"},{"title":"Ain't No Stoppin' Us Now","artist":"McFadden & Whitehead","spotifyTrackId":"4Ymk3pqpkGx19gyxxUj5LK","audit":"PASS"},{"title":"August 10","artist":"Khruangbin","spotifyTrackId":"4I59UjiR1vDGGdLmdvFoJO","audit":"PASS"},{"title":"Soulful Strut","artist":"Young-Holt Unlimited","spotifyTrackId":"6v8mOtpRlXbG3BOauqPRHC","audit":"PASS"},{"title":"Back Pocket","artist":"Vulfpeck,Theo Katzman,Christine Hucal,Mark Dover","spotifyTrackId":"0tLwe28zupkUQMpoXIDgX2","audit":"PASS"},{"title":"We Got to Have Peace","artist":"Curtis Mayfield","spotifyTrackId":"1Hqtsr4UAaj495dQxFqdk8","audit":"PASS"},{"title":"The Boy with the Arab Strap","artist":"Belle and Sebastian","spotifyTrackId":"3PTtk27SzmM2NxdS1mLEJd","audit":"PASS"},{"title":"You Hear Yes (feat. Mannequin Pussy and Scowl)","artist":"Destroy Boys,Mannequin Pussy,Scowl","spotifyTrackId":"3XSCsuqhAqaVoYkYHHFrNC","audit":"PASS"},{"title":"Heavy","artist":"Street Play","spotifyTrackId":"3he3wNUgMH3M4A1P23ZPQQ","audit":"PASS"},{"title":"God Save The Queens","artist":"Vienna Vienna","spotifyTrackId":"5gYbg3Tj7FwPGTljJ6oWEb","audit":"PASS"},{"title":"On And On","artist":"The Velveteers","spotifyTrackId":"3yGvuM7ZiPgjGbicd90rty","audit":"PASS"},{"title":"Anti-Fun Propaganda","artist":"Gen and the Degenerates","spotifyTrackId":"1ta9VB5cCexQUcTyujDthc","audit":"PASS"},{"title":"Electric Version","artist":"The New Pornographers","spotifyTrackId":"0mgAzpg1dOmr2meovmlBwp","audit":"PASS"},{"title":"You Go Down Smooth","artist":"Lake Street Dive","spotifyTrackId":"2NVTpSoonYCVm7RE8zczEy","audit":"PASS"},{"title":"Paprika","artist":"Japanese Breakfast","spotifyTrackId":"3zyqphgXvgHe436IMKeey3","audit":"PASS"},{"title":"Loud Pipes","artist":"Ratatat","spotifyTrackId":"3qkFIjYRInFasy2jeDZPgm","audit":"PASS"},{"title":"Swarm the Hive Mind","artist":"mercury","spotifyTrackId":"5jVvOLyhniE3BW5uyhTr82","audit":"PASS"},{"title":"Can't Say It out Loud","artist":"Street Play","spotifyTrackId":"2AyhKWVXpbMLfvWPQmnR7e","audit":"PASS"},{"title":"Little Bit Longer","artist":"Moselle","spotifyTrackId":"05atH3qAvyHwcgWm01B6ux","audit":"PASS"},{"title":"Chicago","artist":"Sufjan Stevens","spotifyTrackId":"1yupbrI7ROhigIHpQBevPh","audit":"PASS"},{"title":"Nowhere To Go","artist":"Slow Funeral","spotifyTrackId":"2uWPfhu9bH0SaYxOQeMSFA","audit":"PASS"},{"title":"Clue","artist":"Mega Mango","spotifyTrackId":"24vuJBPU6pznqy1wF1hl4v","audit":"PASS"},{"title":"Once in a Lifetime","artist":"Talking Heads","spotifyTrackId":"1Tr4K5MU5XYE44umXGDndd","audit":"PASS"},{"title":"Tightrope (feat. Big Boi) - Big Boi Vocal Edit","artist":"Janelle Monáe,Big Boi","spotifyTrackId":"1ljzHUgt2SU2ADkhfa9eBC","audit":"PASS-LIGHT"},{"title":"Sound of da Police","artist":"KRS-One","spotifyTrackId":"3Y6XWs8xMlCngyIxNOFnsp","audit":"PASS"}]},"anarchadia":{"name":"Anarchadia Radio","guide":"Merlin","originalSpotifyUrl":"https://open.spotify.com/playlist/2AsCLZiAPlUYHOcogllTia","tracks":[{"title":"All You Fascists","artist":"Billy Bragg,Wilco","spotifyTrackId":"7ELquuoDdTdpZGENKNbkBy","audit":"PASS"},{"title":"The Revolution Will Not Be Televised","artist":"Gil Scott-Heron","spotifyTrackId":"7kjg2NCn3Zx70m1DFHSSGO","audit":"PASS-LIGHT"},{"title":"Talkin' Bout a Revolution","artist":"Tracy Chapman","spotifyTrackId":"0YMFcrMtBowDdD5bPz0cgy","audit":"PASS"},{"title":"Long Live Palestine","artist":"Lowkey","spotifyTrackId":"6V3OLZgJzFTTOKmOk7joMr","audit":"PASS"},{"title":"Know Your Rights - Remastered","artist":"The Clash","spotifyTrackId":"31l6t3Jq09uywRTVGbzant","audit":"PASS"},{"title":"The Laws Have Changed","artist":"The New Pornographers","spotifyTrackId":"0mgAzpg1dOmr2meovmlBwp","audit":"PASS"},{"title":"Ohio","artist":"Crosby, Stills, Nash & Young","spotifyTrackId":"0ToHhkK4qtwEyKOxhQpMbJ","audit":"PASS"},{"title":"United Minds","artist":"Arrested Development","spotifyTrackId":"2wgxw4RfO6xNxfwUld7b9V","audit":"PASS-LIGHT"},{"title":"Estranged Fruit","artist":"Fishbone,NOFX","spotifyTrackId":"1IXVO2dCjrYXSLHqPqRx5J","audit":"PASS"},{"title":"Can't Say It out Loud","artist":"Street Play","spotifyTrackId":"2AyhKWVXpbMLfvWPQmnR7e","audit":"PASS"},{"title":"Swarm the Hive Mind","artist":"mercury","spotifyTrackId":"5jVvOLyhniE3BW5uyhTr82","audit":"PASS"},{"title":"War on the Workers","artist":"Anne Feeney","spotifyTrackId":"5b6QESphWzfmonVHPEdF0z","audit":"PASS-LIGHT"},{"title":"United States of Whatever","artist":"Rat Sauce","spotifyTrackId":"7t6UHtRK7s9r9i7mQevBmS","audit":"PASS"},{"title":"Rise Above","artist":"Black Flag","spotifyTrackId":"7KZMpFoS06305cO3KEwyvH","audit":"PASS"},{"title":"Don't Shoot Guns Down","artist":"SAULT","spotifyTrackId":"6XhOClFvKwdfAna8JAqFL4","audit":"PASS"},{"title":"We Got to Have Peace","artist":"Curtis Mayfield","spotifyTrackId":"1Hqtsr4UAaj495dQxFqdk8","audit":"PASS"},{"title":"Long Live Palestine Part 2","artist":"Lowkey,Eslam Jawaad,Hasan Salaam,NARCY,Shadia Mansour,Hichkas,Reveal,DAM","spotifyTrackId":"4MmXVIiWQj1hkdKLvpvVRr","audit":"PASS-LIGHT"},{"title":"Resister","artist":"She Drew The Gun","spotifyTrackId":"2T6hgTJJ5x7qNxcy9w7R3a","audit":"PASS"},{"title":"Welcome to America","artist":"Lecrae","spotifyTrackId":"3YAUHKKgknXXpPKvczjNdf","audit":"PASS"},{"title":"You Are Not A Riot (An RSVP from David Siquieros to Andy Warhol)","artist":"The Coup","spotifyTrackId":"6aYNICjPksx2715uA0UynF","audit":"PASS"},{"title":"Sound of da Police","artist":"KRS-One","spotifyTrackId":"3Y6XWs8xMlCngyIxNOFnsp","audit":"PASS"},{"title":"Favorite Son","artist":"Gully Boys","spotifyTrackId":"7b2RpTtUfRGSU5deTTl074","audit":"PASS"},{"title":"Symphony Of Destruction","artist":"Megadeth","spotifyTrackId":"51TG9W3y9qyO8BY5RXKgnZ","audit":"PASS"},{"title":"Revolution","artist":"The Beatles","spotifyTrackId":"5KGLcZLBCAqdPP6sa5zLYs","audit":"PASS"},{"title":"Bad Reputation","artist":"Joan Jett & the Blackhearts","spotifyTrackId":"7pu8AhGUxHZSCWTkQ2eb5M","audit":"PASS-LIGHT"},{"title":"Born Without Hate","artist":"Damien Dempsey","spotifyTrackId":"2vEkKsdtrlN5VXnHUl5nNM","audit":"PASS"},{"title":"Corporate Realness","artist":"Dream Nails","spotifyTrackId":"4FsQjRjGiaz9jkMs1J4Gny","audit":"PASS"},{"title":"True Trans Soul Rebel","artist":"Against Me!","spotifyTrackId":"4nXBhyVotGUDSsoLI4eJ01","audit":"PASS"},{"title":"Girl God Gun","artist":"Gen and the Degenerates","spotifyTrackId":"2gGwnLDwSxsi0zbkwEKSI6","audit":"PASS"},{"title":"There Is Power in a Union","artist":"Billy Bragg","spotifyTrackId":"23ZMCzhyAclr3CslulKe39","audit":"PASS"},{"title":"Anti-Fun Propaganda","artist":"Gen and the Degenerates","spotifyTrackId":"1ta9VB5cCexQUcTyujDthc","audit":"PASS"},{"title":"You Hear Yes (feat. Mannequin Pussy and Scowl)","artist":"Destroy Boys,Mannequin Pussy,Scowl","spotifyTrackId":"3XSCsuqhAqaVoYkYHHFrNC","audit":"PASS"},{"title":"Busy Earnin'","artist":"Jungle","spotifyTrackId":"5TloYFwzd09yWy8xkRLVUu","audit":"PASS-LIGHT"},{"title":"God Save The Queens","artist":"Vienna Vienna","spotifyTrackId":"5gYbg3Tj7FwPGTljJ6oWEb","audit":"PASS"},{"title":"On And On","artist":"The Velveteers","spotifyTrackId":"3yGvuM7ZiPgjGbicd90rty","audit":"PASS"},{"title":"Heavy","artist":"Street Play","spotifyTrackId":"3he3wNUgMH3M4A1P23ZPQQ","audit":"PASS"},{"title":"Sisyphus","artist":"Andrew Bird","spotifyTrackId":"403vzOZN0tETDpvFipkNIL","audit":"PASS-LIGHT"},{"title":"Suck Me Dry","artist":"RAT BATH","spotifyTrackId":"6ejWWmdL2QEM8qrRrTewgx","audit":"PASS"},{"title":"Lycanthropy","artist":"Street Play","spotifyTrackId":"5Cjs2wjJ9EzDnVsuY8dkNu","audit":"PASS"},{"title":"So Funny","artist":"Karen Dió","spotifyTrackId":"2njz7ibHxnn2VJn4D9puUd","audit":"PASS-LIGHT"}]}});

if(globalThis.CivweaveRadioStationSurfaceV1?.version===VERSION)return;
try{if(globalThis.parent!==globalThis&&globalThis.parent.document?.documentElement?.hasAttribute('data-persistent-system')){const inherit=()=>{globalThis.CivweaveRadioStationSurfaceV1=globalThis.parent.CivweaveRadioStationSurfaceV1};if(globalThis.parent.CivweaveRadioStationSurfaceV1)inherit();else globalThis.parent.addEventListener('civweave:radio-station-ready',inherit,{once:true});return}}catch{}
let launcher=null;
let panel=null;
let openState=false;
let currentSystem='';
let audio=null;
let catalog=[];
let catalogLoaded=false;
let catalogPromise=null;
let catalogError='';
let currentTrack=null;
let playbackToken=0;
let pendingSeek=null;
let objectUrl='';
let isPlaying=false;
let statusText='Choose a track to listen.';
let searchTerm='';
let shuffleEnabled=false;
const recentTrackIds=[];
let started=false;
const savedIds=new Set();
const busyIds=new Set();

function deepFreeze(value){
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}
function clean(value,max=500){return String(value??'').trim().slice(0,max)}
function esc(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function detectSystem(){
  const route=globalThis.CivweaveSystemRoutesV227?.identify?.(location.pathname);
  if(SYSTEMS.includes(route))return route;
  const declared=clean(document.documentElement?.dataset?.civweaveSystemRoute||document.documentElement?.dataset?.civweaveSystem||document.body?.dataset?.civweaveSystem,80).toLowerCase();
  if(SYSTEMS.includes(declared))return declared;
  const query=new URLSearchParams(location.search).get('system');
  if(SYSTEMS.includes(query))return query;
  return FALLBACK_PATHS.get(location.pathname)||'';
}
function radioEnabled(){
  try{return JSON.parse(localStorage.getItem('civweave.radio.preferences.v1')||'{}')?.enabled!==false}catch{return true}
}
function safeModeEnabled(){
  try{
    const api=globalThis.CivweaveSafeModeV1;
    if(api?.read)return Boolean(api.read()?.enabled);
  }catch{}
  try{return Boolean(JSON.parse(localStorage.getItem(SAFE_KEY)||'{}')?.enabled)}catch{return false}
}
function mode(){
  try{const selected=localStorage.getItem(MODE_KEY);if(selected==='original')return safeModeEnabled()?'clean':'original';return selected==='clean'?'clean':'direct'}catch{return'direct'}
}
function setMode(next){
  const value=['direct','clean','original'].includes(next)?next:'direct';
  if(value==='original'&&safeModeEnabled())return false;
  try{localStorage.setItem(MODE_KEY,value)}catch{}
  render();
  try{dispatchEvent(new CustomEvent('civweave:radio-station-mode-changed',{detail:{mode:value,system:currentSystem}}))}catch{}
  return true;
}
function station(system=currentSystem){return STATIONS[system]||null}
function tracksFor(system=currentSystem){return station(system)?.tracks||[]}
function spotifyTrackUrl(track){const id=clean(track?.spotifyTrackId,40);return /^[A-Za-z0-9]{22}$/.test(id)?`https://open.spotify.com/track/${id}`:''}

function safeUrl(value,{audioFile=false}={}){
  if(!clean(value))return'';
  try{const url=new URL(value,location.href);if(url.protocol!=='https:'&&url.origin!==location.origin)return'';if(audioFile&&url.origin!==location.origin)return'';return url.href}catch{return''}
}
function normalizeRecord(row){
  const license=row?.license,id=clean(row?.candidate_id,120),file=row?.files?.find(item=>item?.url&&item?.role==='redistributed-source-download')||row?.files?.[0];
  const href=safeUrl(file?.url,{audioFile:true}),source=safeUrl(row?.source_url),licenseUrl=safeUrl(license?.url);
  if(!id||!href||!source||!licenseUrl||!['CC-BY','CC-BY-SA','CC0','PUBLIC-DOMAIN'].includes(license?.spdx)||license?.redistribution!==true||!clean(license?.evidence)||row?.download_enabled!==true||row?.mesh_redistributable!==true||row?.explicit!==false)return null;
  const bytes=Number(file?.bytes)||0;if(bytes<=0||bytes>MAX_AUDIO_BYTES)return null;
  const systems=[...new Set([row.playlist_id,...(row.playlist_matches||[]).map(item=>item.playlist_id)].filter(id=>SYSTEMS.includes(id)))];
  return Object.freeze({id,title:clean(row.title,240),artist:clean(row.artist,240),url:href,source,licenseUrl,license:clean(license.label||license.spdx,100),credits:clean(row.attribution?.credit_line||row.attribution?.creator||row.artist,1200),bytes,sha256:clean(file.sha256||row.content_hash,64),systems,safeAudit:row.safeAudit==='SAFE-PASS-V1',changes:clean(row.attribution?.changes||'Unmodified source recording.',200)});
}
function normalizeStreamRecord(row){
  const license=row?.license||{},file=(row?.files||[]).find(item=>/\.mp3(?:\?|$)/i.test(item?.url||''));
  if(row?.explicit===true||row?.vocal_verified!==true||row?.instrumental_only===true||!row?.candidate_id||!file||!['CC-BY','CC-BY-SA','CC0','PUBLIC-DOMAIN'].includes(license.spdx)||license.redistribution!==true||license.commercial_use!==true||!clean(license.evidence))return null;
  let url;try{url=new URL(file.url)}catch{return null}
  if(url.protocol!=='https:'||url.hostname!=='ccmixter.org'||!url.pathname.startsWith('/content/')||!url.pathname.toLowerCase().endsWith('.mp3'))return null;
  const source=safeUrl(row.source_url),licenseUrl=safeUrl(String(license.url||'').replace(/^http:\/\/creativecommons\.org\//,'https://creativecommons.org/')),bytes=Number(file.bytes)||0;
  if(!source||!licenseUrl||bytes<=0||bytes>MAX_AUDIO_BYTES||!/^https:\/\/ccmixter\.org\/files\//.test(source)||!/^https:\/\/creativecommons\.org\//.test(licenseUrl))return null;
  const systems=[...new Set([row.playlist_id,...(row.playlist_matches||[]).map(item=>item.playlist_id)].filter(id=>SYSTEMS.includes(id)))];
  return Object.freeze({id:clean(row.candidate_id,120),title:clean(row.title,240),artist:clean(row.artist,240),url:url.href,source,licenseUrl,license:clean(license.label||license.spdx,100),credits:clean(row.attribution?.creator||row.artist,1200),bytes,sha256:'',systems,safeAudit:false,streamOnly:true,changes:row.curation==='hand-seeded'?'Unmodified CC-licensed recording; streaming only.':row.curation==='web-source-candidate'?'Source-page CC-BY candidate · vocal and lyric listening review pending.':row.curation==='vocal-pool-unreviewed'?'Vocal-tag candidate · full-song and lyric review pending.':row.curation==='genre-discovered'?'Genre-matched candidate · lyric review pending.':'Themed metadata candidate · lyric review pending.'});
}
function directTracksFor(system=currentSystem){return catalog.filter(row=>!safeModeEnabled()||row.safeAudit).sort((a,b)=>Number(b.systems.includes(system))-Number(a.systems.includes(system)))}
async function loadCatalog(){
  if(catalogPromise)return catalogPromise;
  catalogPromise=(async()=>{
    try{
      const unique=new Map();let received=false;
      const verified=await fetch(CATALOG_PATH,{cache:'force-cache'});
      if(verified.ok){const packet=await verified.json();if(Array.isArray(packet.records)){received=true;for(const row of packet.records){const track=normalizeRecord(row);if(track&&!unique.has(track.id))unique.set(track.id,track)}}}
      try{
        const response=await fetch(STREAM_MANIFEST_PATH,{cache:'no-store'});
        if(response.ok){const packet=await response.json();if(packet.schema==='civweave.open-music-lazy-manifest.v1'&&Array.isArray(packet.entries)){received=true;for(const row of packet.entries.slice(0,350)){const track=normalizeStreamRecord(row);if(track&&!unique.has(track.id))unique.set(track.id,track);if(unique.size>=300)break}}}
      }catch(error){console.warn('[Civweave Radio] Remote library unavailable; using verified local catalog.',error)}
      if(!received)throw new Error('No open music catalog available.');
      catalog=[...unique.values()];catalogError='';catalogLoaded=true;
      if(globalThis.caches)try{const cache=await caches.open(AUDIO_CACHE);await Promise.all(catalog.filter(track=>!track.streamOnly).map(async track=>{if(await cache.match(track.url))savedIds.add(track.id)}))}catch{}
    }catch(error){catalogError='Music catalog could not be loaded. Select Retry to load it again.';catalogLoaded=true;catalogPromise=null}
    render();return catalog;
  })();return catalogPromise;
}
function revokeObjectUrl(){if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=''}}
function status(message){statusText=message;updatePlaybackUi()}
function cancelSeek(){if(pendingSeek){pendingSeek.controller.abort();pendingSeek=null}}
function stopTrack(){playbackToken++;cancelSeek();audio?.pause();audio?.removeAttribute('src');audio?.load();revokeObjectUrl();currentTrack=null;isPlaying=false;updatePlaybackUi()}
async function playTrack(id){
  if(!audio)ensureSurface();
  const track=directTracksFor().find(row=>row.id===id);if(!track){status('This track is unavailable in the current station.');return false}
  const token=++playbackToken;cancelSeek();audio.pause();revokeObjectUrl();currentTrack=track;recentTrackIds.unshift(track.id);if(recentTrackIds.length>12)recentTrackIds.length=12;status(`Loading ${track.title}…`);updatePlaybackUi();
  try{
    let source=track.url;
    if(globalThis.caches)try{const cached=await(await caches.open(AUDIO_CACHE)).match(track.url);if(cached){const blob=await cached.blob();if(token!==playbackToken)return false;objectUrl=URL.createObjectURL(blob);source=objectUrl;savedIds.add(track.id)}}catch{}
    if(token!==playbackToken)return false;
    audio.src=source;audio.load();await audio.play();if(token!==playbackToken)return false;
    isPlaying=true;status(`Playing ${track.title}${savedIds.has(track.id)?' · saved offline':''}.`);renderTrackList();return true;
  }catch(error){if(token===playbackToken){isPlaying=false;status('Playback could not start. Try Play again, or save the track while online.')}return false}
}
function nextTrack(direction=1){const rows=directTracksFor();if(!rows.length)return false;const index=rows.findIndex(row=>row.id===currentTrack?.id);if(shuffleEnabled&&direction>0&&rows.length>1){let pool=rows.filter(row=>row.id!==currentTrack?.id&&!recentTrackIds.includes(row.id));if(!pool.length){recentTrackIds.length=0;pool=rows.filter(row=>row.id!==currentTrack?.id)}const picked=pool[Math.floor(Math.random()*pool.length)];return playTrack(picked.id)}return playTrack(rows[index<0?(direction>0?0:rows.length-1):(index+direction+rows.length)%rows.length].id)}
async function togglePlayback(){if(!currentTrack)return playTrack(directTracksFor()[0]?.id);if(isPlaying){audio.pause();isPlaying=false;status('Paused.');return true}try{await audio.play();isPlaying=true;status(`Playing ${currentTrack.title}.`);return true}catch{status('Playback could not start. Try selecting the track again.');return false}}
async function verifiedAudio(track,signal){
  const response=await fetch(track.url,{cache:'no-store',signal});if(signal.aborted||!response.ok||response.type==='opaque')throw new Error('Audio unavailable.');
  const declared=Number(response.headers.get('content-length'))||0;if(declared>MAX_AUDIO_BYTES)throw new Error('Invalid audio size.');
  let bytes;
  if(response.body?.getReader){
    const reader=response.body.getReader(),chunks=[];let length=0;
    try{for(;;){const part=await reader.read();if(signal.aborted)throw new Error('Audio request cancelled.');if(part.done)break;length+=part.value.byteLength;if(length>MAX_AUDIO_BYTES||length>track.bytes){await reader.cancel();throw new Error('Audio too large.')}chunks.push(part.value)}}finally{reader.releaseLock()}
    const joined=new Uint8Array(length);let offset=0;for(const part of chunks){joined.set(part,offset);offset+=part.byteLength}bytes=joined.buffer;
  }else bytes=await response.arrayBuffer();
  if(signal.aborted||bytes.byteLength!==track.bytes||bytes.byteLength>MAX_AUDIO_BYTES)throw new Error('Invalid audio size.');
  const header=new Uint8Array(bytes,0,Math.min(bytes.byteLength,3));if(!(header[0]===73&&header[1]===68&&header[2]===51)&&!(header[0]===255&&(header[1]&224)===224))throw new Error('Invalid MP3 response.');
  if(!globalThis.crypto?.subtle)throw new Error('Audio integrity checking is unavailable.');
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
  if(signal.aborted||track.sha256&&hash!==track.sha256)throw new Error('Audio integrity mismatch.');
  return{bytes,hash};
}
function canSeekTo(target){
  if(objectUrl&&audio?.src===objectUrl)return true;
  try{for(let index=0;index<audio.seekable.length;index++)if(target>=audio.seekable.start(index)&&target<=audio.seekable.end(index))return true}catch{}
  return false;
}
function loadSeekSource(source,signal){
  return new Promise((resolve,reject)=>{
    const cleanup=()=>{audio.removeEventListener('loadedmetadata',ready);audio.removeEventListener('error',failed);signal.removeEventListener('abort',aborted)};
    const ready=()=>{cleanup();resolve()};
    const failed=()=>{cleanup();reject(new Error('Prepared audio could not be decoded.'))};
    const aborted=()=>{cleanup();reject(new Error('Seek preparation cancelled.'))};
    audio.addEventListener('loadedmetadata',ready);audio.addEventListener('error',failed);signal.addEventListener('abort',aborted,{once:true});
    if(signal.aborted){aborted();return}audio.src=source;audio.load();if(audio.readyState>=1)ready();
  });
}
async function seekTrack(value){
  if(!audio||!currentTrack||!Number.isFinite(audio.duration))return false;
  const target=Math.min(audio.duration,Math.max(0,Number(value)||0));
  if(currentTrack.streamOnly){try{for(let i=0;i<audio.seekable.length;i++)if(target>=audio.seekable.start(i)&&target<=audio.seekable.end(i)){audio.currentTime=target;updatePlaybackUi();return true}}catch{}status('Seeking is unavailable on this source stream.');return false}
  if(pendingSeek&&pendingSeek.token===playbackToken&&pendingSeek.track.id===currentTrack.id){pendingSeek.target=target;updatePlaybackUi();return pendingSeek.promise}
  if(canSeekTo(target)){audio.currentTime=target;updatePlaybackUi();return true}
  const request={token:++playbackToken,track:currentTrack,target,wasPlaying:isPlaying,controller:new AbortController(),promise:null};
  pendingSeek=request;audio.pause();isPlaying=false;status(`Preparing this track for seeking… (${(currentTrack.bytes/1048576).toFixed(1)} MB)`);
  const timer=setTimeout(()=>request.controller.abort(),90000);
  request.promise=(async()=>{
    try{
      const {bytes}=await verifiedAudio(request.track,request.controller.signal);
      if(request.token!==playbackToken||currentTrack?.id!==request.track.id)return false;
      revokeObjectUrl();objectUrl=URL.createObjectURL(new Blob([bytes],{type:'audio/mpeg'}));request.preparedUrl=objectUrl;
      await loadSeekSource(objectUrl,request.controller.signal);
      if(request.token!==playbackToken||currentTrack?.id!==request.track.id)return false;
      audio.currentTime=Math.min(audio.duration,request.target);pendingSeek=null;
      if(request.wasPlaying){await audio.play();if(request.token!==playbackToken)return false;isPlaying=true}
      status(`${request.wasPlaying?'Playing from':'Paused at'} ${timeLabel(audio.currentTime)}.`);return true;
    }catch(error){if(request.token===playbackToken){if(request.preparedUrl&&objectUrl===request.preparedUrl){revokeObjectUrl();audio.src=request.track.url;audio.load();audio.pause()}isPlaying=false;status('Could not seek in this recording. Playback is paused; choose Play to resume.')}return false}
    finally{clearTimeout(timer);if(pendingSeek===request)pendingSeek=null;updatePlaybackUi()}
  })();return request.promise;
}
async function saveOffline(id){
  const track=directTracksFor().find(row=>row.id===id);if(!track||busyIds.has(id))return false;
  if(track.streamOnly){status('This recording streams from the artist’s source. Offline saving requires a verified local copy.');return false}
  if(!globalThis.caches||!globalThis.crypto?.subtle){status('Offline audio storage is unavailable in this browser. You can still stream.');return false}
  busyIds.add(id);status(`Saving ${track.title} for offline listening…`);renderTrackList();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),90000);
  try{
    const {bytes,hash}=await verifiedAudio(track,controller.signal);
    const cache=await caches.open(AUDIO_CACHE);await cache.put(track.url,new Response(bytes,{headers:{'content-type':'audio/mpeg','content-length':String(bytes.byteLength),'x-civweave-audio-sha256':hash}}));
    savedIds.add(id);status(`${track.title} saved offline.`);return true;
  }catch(error){status(`Could not save ${track.title}. Check your connection or device storage and try again.`);return false}
  finally{clearTimeout(timer);busyIds.delete(id);renderTrackList()}
}
async function removeOffline(id){
  const track=catalog.find(row=>row.id===id);if(!track||busyIds.has(id))return false;
  try{if(!globalThis.caches)throw new Error('Storage unavailable.');await(await caches.open(AUDIO_CACHE)).delete(track.url);savedIds.delete(id);status(`${track.title} removed from offline storage.`);renderTrackList();return true}catch{status('Could not remove the offline copy. Try again.');return false}
}
function timeLabel(value){const seconds=Math.max(0,Math.floor(Number(value)||0));return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`}
function updatePlaybackUi(){
  if(!panel)return;
  const duration=Number.isFinite(audio?.duration)?audio.duration:0,position=pendingSeek?.target??(Number(audio?.currentTime)||0);
  const title=panel.querySelector('[data-radio-current]');if(title)title.textContent=currentTrack?`${currentTrack.title} — ${currentTrack.artist}`:'Choose a track';
  const play=panel.querySelector('[data-radio-play]');if(play){play.textContent=pendingSeek?'Preparing…':isPlaying?'Pause':'Play';play.setAttribute('aria-label',pendingSeek?'Preparing track for seeking':isPlaying?'Pause music':'Play music');play.disabled=Boolean(pendingSeek)||!directTracksFor().length&&!currentTrack}
  const seek=panel.querySelector('[data-radio-seek]');if(seek){seek.max=String(duration||1);seek.value=String(position);seek.disabled=!duration}
  const time=panel.querySelector('[data-radio-time]');if(time)time.textContent=`${timeLabel(position)} / ${timeLabel(duration)}`;
  const message=panel.querySelector('[data-radio-status]');if(message&&message.textContent!==statusText)message.textContent=statusText;
  const credits=panel.querySelector('[data-radio-current-credits]');if(credits&&credits.dataset.track!==(currentTrack?.id||'')){credits.dataset.track=currentTrack?.id||'';credits.innerHTML=currentTrack?`${esc(currentTrack.credits)} · <a href="${esc(currentTrack.source)}" target="_blank" rel="noopener noreferrer external">Source</a> · <a href="${esc(currentTrack.licenseUrl)}" target="_blank" rel="noopener noreferrer external">${esc(currentTrack.license)}</a> · ${esc(currentTrack.changes)}`:''}
  launcher?.setAttribute('aria-label',isPlaying?`Radio · playing ${currentTrack?.title||'music'}`:`Open ${station()?.name||'radio'}`);
  launcher?.setAttribute('data-playing',isPlaying?'true':'false');
}
function renderTrackList(){
  if(!panel||mode()!=='direct')return;
  const body=panel.querySelector('[data-radio-body]');if(!body)return;
  const rows=directTracksFor().filter(track=>(track.title+' '+track.artist).toLowerCase().includes(searchTerm));
  body.innerHTML=catalogError?`<p>${esc(catalogError)}</p><button type="button" data-radio-retry>Retry catalog</button>`:!catalogLoaded?'<p>Loading open music…</p>':!rows.length?`<p>${safeModeEnabled()?'No direct recordings have a complete S.A.F.E. audit yet. The S.A.F.E. Spotify extension remains available below.':'No open recordings are available for this station yet.'}</p>`:`<p class="cw-radio-note">${rows.length} of ${directTracksFor().length} open recordings · continues after Play · local verified downloads available offline; source streams require internet and are not individually lyric-audited.</p>${rows.map(track=>`<article class="cw-radio-direct-track" data-radio-track="${esc(track.id)}"><strong>${esc(track.title)}</strong><span>${esc(track.credits)}</span><div class="cw-radio-direct-actions"><button type="button" data-radio-track-play="${esc(track.id)}" aria-label="Play ${esc(track.title)}">Play</button>${track.streamOnly?'<span class="cw-radio-stream-only">Stream only</span>':`<button type="button" ${busyIds.has(track.id)?'disabled':''} data-radio-offline="${esc(track.id)}">${busyIds.has(track.id)?'Saving…':savedIds.has(track.id)?'Remove offline':'Save offline'} · ${(track.bytes/1048576).toFixed(1)} MB</button>`}</div><small><a href="${esc(track.source)}" target="_blank" rel="noopener noreferrer external">Source &amp; full credits</a> · <a href="${esc(track.licenseUrl)}" target="_blank" rel="noopener noreferrer external">${esc(track.license)}</a> · ${esc(track.changes)}</small></article>`).join('')}`;
  updatePlaybackUi();
}

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
#${LAUNCHER_ID}{position:fixed;z-index:2147483608;left:max(12px,env(safe-area-inset-left));right:auto;padding:0;font:900 28px/1 system-ui;display:grid;place-items:center;cursor:pointer;-webkit-tap-highlight-color:transparent}
#${PANEL_ID}{position:fixed;z-index:2147483609;left:max(12px,env(safe-area-inset-left));right:auto;width:min(430px,calc(100vw - 24px));border:1px solid #ffffff30;border-radius:18px;color:#f8fbff;font:14px/1.4 Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color-scheme:dark}
#${PANEL_ID}[hidden]{display:none!important}#${PANEL_ID} *{box-sizing:border-box}
#${PANEL_ID}>header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px;border-bottom:1px solid #ffffff18}
#${PANEL_ID}>header small{display:block;color:#aebccf;font-size:11px;text-transform:uppercase;letter-spacing:.09em}#${PANEL_ID}>header strong{display:block;margin-top:2px;font-size:20px}
#${PANEL_ID} button{cursor:pointer}#${PANEL_ID} [data-radio-close]{width:44px;height:44px;flex:none;border:1px solid #ffffff25;border-radius:10px;background:#ffffff0b;color:#fff;font-size:20px}
#${PANEL_ID} .cw-radio-modebar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 12px;border-bottom:1px solid #ffffff12;background:#ffffff05}
#${PANEL_ID} .cw-radio-modebar button,#${PANEL_ID} .cw-radio-modebar a{min-height:34px;display:inline-flex;align-items:center;border:1px solid #ffffff28;border-radius:999px;padding:0 11px;background:#ffffff0a;color:#fff;text-decoration:none;font-weight:800}
#${PANEL_ID} .cw-radio-modebar button[aria-pressed="true"]{border-color:#83e9ff;background:#83e9ff20}#${PANEL_ID} .cw-radio-safe{margin-left:auto;color:#aeecc1;font-size:11px;font-weight:800}
#${PANEL_ID} .cw-radio-body{min-height:0;overflow:auto;padding:8px 12px 14px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
#${PANEL_ID} .cw-radio-note{margin:5px 2px 10px;color:#aebccf;font-size:12px}
#${PANEL_ID} .cw-radio-track{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:9px;align-items:center;padding:9px 2px;border-bottom:1px solid #ffffff12}
#${PANEL_ID} .cw-radio-track:last-child{border-bottom:0}#${PANEL_ID} .cw-radio-index{display:grid;place-items:center;width:30px;height:30px;border:1px solid #ffffff20;border-radius:9px;color:#9fb2c8;font:800 11px/1 ui-monospace,monospace}
#${PANEL_ID} .cw-radio-track strong{display:block;font-size:13px}#${PANEL_ID} .cw-radio-track span{display:block;margin-top:2px;color:#9fb0c3;font-size:11px}
#${PANEL_ID} .cw-radio-track a{min-height:34px;display:inline-flex;align-items:center;border:1px solid #ffffff28;border-radius:999px;padding:0 10px;color:#fff;text-decoration:none;font-weight:850;font-size:11px}
#${PANEL_ID} .cw-radio-original{display:grid;gap:12px;padding:14px 2px}#${PANEL_ID} .cw-radio-original p{margin:0;color:#c5cfdb}#${PANEL_ID} .cw-radio-original a{justify-self:start;display:inline-flex;min-height:40px;align-items:center;border-radius:999px;padding:0 14px;background:#f8f8f4;color:#07111f;text-decoration:none;font-weight:900}
#${PANEL_ID} .cw-radio-governance{width:100%;margin-top:10px;min-height:38px;border:1px solid #ffffff28;border-radius:12px;background:#ffffff09;color:#fff;font-weight:850}
@media(prefers-reduced-motion:reduce){#${LAUNCHER_ID},#${PANEL_ID}{scroll-behavior:auto;transition:none}}
/* One dock offset in the parent; an embedded standalone fallback already has a shortened viewport. */
html[data-radio-embedded="true"]{--cw-radio-dock-space:0px}
html:not([data-radio-embedded="true"]){--cw-radio-dock-space:calc(var(--cw-themed-nav-height,64px) + env(safe-area-inset-bottom))}
#${LAUNCHER_ID}{bottom:calc(var(--cw-radio-dock-space) + 10px);width:50px;height:50px;min-width:50px;min-height:50px;padding:0!important;display:grid!important;place-items:center;visibility:visible!important;opacity:1!important;background:var(--cw-radio-background,#21152e);border:2px solid var(--cw-radio-accent,#cfabed);border-radius:15px;color:var(--cw-radio-accent,#cfabed);box-shadow:0 3px 14px #000a;isolation:isolate;touch-action:manipulation}
#${LAUNCHER_ID} svg{display:block!important;width:28px;height:28px;fill:none;stroke:currentColor;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
@media(max-width:640px){#${LAUNCHER_ID}{left:max(14px,env(safe-area-inset-left));bottom:calc(var(--cw-radio-dock-space) + 14px);width:54px;height:54px;min-width:54px;min-height:54px;border-radius:17px}}
#${LAUNCHER_ID}[aria-expanded="true"],#${LAUNCHER_ID}[data-playing="true"]{box-shadow:none;color:var(--cw-radio-accent,#cfabed)}
#${LAUNCHER_ID}:focus-visible{outline:2px solid currentColor;outline-offset:2px}
#${PANEL_ID}{bottom:calc(var(--cw-radio-dock-space) + 58px);max-height:calc(100dvh - var(--cw-radio-dock-space) - 78px);display:grid;grid-template-rows:auto auto auto minmax(0,1fr);min-height:0;overflow:hidden;background:var(--cw-radio-background,#21152e);border-color:color-mix(in srgb,var(--cw-radio-accent,#cfabed) 45%,transparent);box-shadow:0 12px 34px #0008;overscroll-behavior:contain}
#${PANEL_ID}>header{padding:10px 12px;flex:none}#${PANEL_ID}>header strong{font-size:17px}
#${PANEL_ID} .cw-radio-modebar{padding:8px 12px;max-height:112px;overflow-y:auto;overscroll-behavior:contain}#${PANEL_ID} .cw-radio-modebar>button{min-height:44px}
#${PANEL_ID} .cw-radio-modebar details{flex:1;min-width:140px}#${PANEL_ID} .cw-radio-modebar summary{cursor:pointer;min-height:44px;display:flex;align-items:center;font-size:12px;color:var(--cw-radio-accent,#cfabed)}
#${PANEL_ID} .cw-radio-modebar details[open]>div{display:flex;gap:6px;flex-wrap:wrap;padding:4px 0}
#${PANEL_ID} .cw-radio-modebar button[aria-pressed="true"]{border-color:var(--cw-radio-accent,#cfabed);background:color-mix(in srgb,var(--cw-radio-accent,#cfabed) 15%,transparent)}
#${PANEL_ID} .cw-radio-player{display:grid;grid-template-columns:minmax(0,1fr) 76px;gap:6px;padding:10px 12px;border-bottom:1px solid #ffffff20;min-width:0}
#${PANEL_ID} .cw-radio-player>audio{display:none}#${PANEL_ID} [data-radio-current]{grid-column:1/-1;grid-row:1}
#${PANEL_ID} .cw-radio-controls{grid-column:1;grid-row:2}#${PANEL_ID} .cw-radio-volume{grid-column:2;grid-row:2;flex-direction:column;justify-content:center;gap:0}
#${PANEL_ID} .cw-radio-seek{grid-column:1/-1;grid-row:3}#${PANEL_ID} [data-radio-status]{grid-column:1/-1;grid-row:4;max-height:2.8em;overflow:auto}
#${PANEL_ID} [data-radio-current-credits]{grid-column:1/-1;grid-row:5;max-height:2.8em;overflow:auto}
#${PANEL_ID} .cw-radio-player>strong{font-size:13px;overflow-wrap:anywhere}#${PANEL_ID} .cw-radio-controls{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
#${PANEL_ID} .cw-radio-player button,#${PANEL_ID} .cw-radio-direct-actions button,#${PANEL_ID} [data-radio-retry]{min-height:44px;border:1px solid #ffffff38;border-radius:10px;background:#ffffff0b;color:inherit;padding:7px 10px;font-weight:750}
#${PANEL_ID} button:disabled{opacity:.5;cursor:default}#${PANEL_ID} .cw-radio-seek{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center}#${PANEL_ID} .cw-radio-volume{display:flex;gap:8px;align-items:center;font-size:11px}
#${PANEL_ID} input[type="range"]{min-height:28px;width:100%;accent-color:var(--cw-radio-accent,#cfabed);margin:0}#${PANEL_ID} .cw-radio-volume input{max-width:130px}
#${PANEL_ID} [data-radio-status]{margin:0;font-size:11px;color:#d5d5df}#${PANEL_ID} [data-radio-current-credits]{font-size:10px;overflow-wrap:anywhere}#${PANEL_ID} a{color:var(--cw-radio-accent,#cfabed)}
#${PANEL_ID} .cw-radio-body{min-height:0;overflow:auto;overscroll-behavior:contain}#${PANEL_ID} .cw-radio-note{color:#d0cbd6}
#${PANEL_ID} .cw-radio-direct-track{display:grid;gap:6px;padding:12px 0;border-bottom:1px solid #ffffff20;overflow-wrap:anywhere}#${PANEL_ID} .cw-radio-direct-track>span,#${PANEL_ID} .cw-radio-direct-track>small{font-size:11px;color:#d5d5df}
#${PANEL_ID} .cw-radio-direct-actions{display:flex;gap:7px;flex-wrap:wrap}#${PANEL_ID} .cw-radio-stream-only{font-size:11px;opacity:.72;align-self:center}#${PANEL_ID} [data-radio-search]{min-width:0;width:100%;border-radius:8px;background:#ffffff12;border:1px solid #ffffff30;color:inherit;padding:7px 9px;min-height:40px}
@media(max-width:360px){#${PANEL_ID} .cw-radio-controls{grid-column:1/-1}#${PANEL_ID} .cw-radio-volume{grid-column:1/-1;grid-row:4;flex-direction:row;justify-content:flex-start;gap:8px}#${PANEL_ID} [data-radio-status]{grid-row:5}#${PANEL_ID} [data-radio-current-credits]{grid-row:6}}
/* When even compact controls cannot fit, preserve a sticky Close and expose all content through one scrollable fallback. */
@media(max-height:520px){#${PANEL_ID}{display:block;overflow:auto}#${PANEL_ID}>header{position:sticky;top:0;z-index:2;background:var(--cw-radio-background,#21152e)}#${PANEL_ID} .cw-radio-body{overflow:visible}#${PANEL_ID} .cw-radio-modebar{max-height:none;overflow-y:visible}}
`;
  document.head?.append(style);
}
function pendingGovernanceCount(){
  try{return (globalThis.CivweaveCanonicalPlaylistsV1?.read?.().proposals||[]).filter(row=>['awaiting-electorate','voting','approved'].includes(row.status)).length}catch{return 0}
}
function render(){
  if(!panel?.isConnected)return false;
  currentSystem=detectSystem()||currentSystem;
  const item=station();if(!item)return false;
  const selected=mode(),safe=safeModeEnabled(),rows=tracksFor();
  const [accent,background]=PALETTES[currentSystem]||PALETTES.civweave;
  for(const node of [launcher,panel])if(node){node.style.setProperty('--cw-radio-accent',accent);node.style.setProperty('--cw-radio-background',background)}
  const directButton=panel.querySelector('[data-radio-mode="direct"]');directButton?.setAttribute('aria-pressed',selected==='direct'?'true':'false');
  panel.querySelector('[data-radio-system]').textContent=item.name;
  const cleanButton=panel.querySelector('[data-radio-mode="clean"]');
  const originalButton=panel.querySelector('[data-radio-mode="original"]');
  cleanButton?.setAttribute('aria-pressed',selected==='clean'?'true':'false');
  originalButton?.setAttribute('aria-pressed',selected==='original'?'true':'false');
  if(originalButton){originalButton.hidden=safe;originalButton.disabled=safe}
  const safeBadge=panel.querySelector('[data-radio-safe]');
  if(safeBadge){safeBadge.hidden=!safe;safeBadge.textContent='S.A.F.E.'}
  const body=panel.querySelector('[data-radio-body]');
  if(selected==='direct'){
    renderTrackList();
  }else if(selected==='original'&&!safe){
    body.innerHTML=`<section class="cw-radio-original"><p>The original station is available uncensored and may contain strong profanity or slurs. Civweave's lyric-audited companion remains the default.</p><a href="${esc(item.originalSpotifyUrl)}" target="_blank" rel="noopener noreferrer external">Open original Spotify station ↗</a></section>`;
  }else{
    body.innerHTML=`<p class="cw-radio-note">${rows.length} lyric-audited tracks · F-word/N-word/slur failures and unverified exact recordings removed.</p>${rows.map((track,index)=>{const href=spotifyTrackUrl(track);return `<article class="cw-radio-track"><span class="cw-radio-index">${index+1}</span><div><strong>${esc(track.title)}</strong><span>${esc(track.artist)} · ${esc(track.audit)}</span></div>${href?`<a href="${href}" target="_blank" rel="noopener noreferrer external" aria-label="Open ${esc(track.title)} on Spotify">Spotify ↗</a>`:''}</article>`}).join('')}`;
    const pending=pendingGovernanceCount();
    if(currentSystem==='anarchadia'&&pending>0){
      const button=document.createElement('button');button.type='button';button.className='cw-radio-governance';button.dataset.radioGovernance='true';button.textContent=`Playlist votes waiting · ${pending}`;button.addEventListener('click',()=>{try{dispatchEvent(new CustomEvent('civweave:playlist-governance-open'))}catch{}});body.append(button);
    }
  }
  updatePlaybackUi();
  return true;
}
function ensureSurface(){
  currentSystem=detectSystem();if(!currentSystem||!document.body)return false;
  document.documentElement.dataset.radioEmbedded=new URLSearchParams(location.search).get('embed')==='1'?'true':'false';
  installStyle();
  if(!radioEnabled()){
    stopTrack();document.getElementById(LAUNCHER_ID)?.remove();document.getElementById(PANEL_ID)?.remove();launcher=null;panel=null;audio=null;openState=false;return false;
  }
  if(!launcher?.isConnected){
    launcher=document.getElementById(LAUNCHER_ID)||document.createElement('button');
    launcher.id=LAUNCHER_ID;launcher.type='button';launcher.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 18V5l12-2v13"/><ellipse cx="6" cy="18" rx="3" ry="2.5"/><ellipse cx="18" cy="16" rx="3" ry="2.5"/></svg>';launcher.setAttribute('aria-label','Open music and playlists');launcher.setAttribute('title','Music and playlists');launcher.setAttribute('aria-haspopup','dialog');launcher.setAttribute('aria-expanded','false');
    launcher.addEventListener('click',toggle);
    if(!launcher.isConnected)document.body.append(launcher);
  }
  if(!panel?.isConnected){
    panel=document.getElementById(PANEL_ID)||document.createElement('section');
    panel.id=PANEL_ID;panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Civweave radio station');
    panel.innerHTML=`<header><div><small>Open music</small><strong data-radio-system>Radio</strong></div><button type="button" data-radio-close aria-label="Close station">×</button></header><div class="cw-radio-modebar"><button type="button" data-radio-mode="direct" aria-pressed="true">Listen here</button><button type="button" data-radio-shuffle aria-pressed="false">Shuffle off</button><input type="search" data-radio-search aria-label="Search recordings" placeholder="Search songs or artists"><details><summary>Spotify extension</summary><div><button type="button" data-radio-mode="clean" aria-pressed="false">Clean station</button><button type="button" data-radio-mode="original" aria-pressed="false">Original / uncensored</button><button type="button" data-radio-nominate>Nominate track</button></div></details><span class="cw-radio-safe" data-radio-safe hidden></span></div><section class="cw-radio-player" aria-label="Music player"><audio preload="none" data-radio-audio></audio><strong data-radio-current>Choose a track</strong><div class="cw-radio-controls"><button type="button" data-radio-previous aria-label="Previous track">Previous</button><button type="button" data-radio-play>Play</button><button type="button" data-radio-next aria-label="Next track">Next</button></div><div class="cw-radio-seek"><input type="range" min="0" max="1" value="0" step="1" data-radio-seek aria-label="Seek in track" disabled><span data-radio-time>0:00 / 0:00</span></div><label class="cw-radio-volume">Volume<input type="range" min="0" max="1" step="0.05" value="0.7" data-radio-volume></label><p data-radio-status role="status" aria-live="polite"></p><div data-radio-current-credits></div></section><div class="cw-radio-body" data-radio-body></div>`;
    audio=panel.querySelector('audio');audio.volume=0.7;
    for(const event of ['timeupdate','loadedmetadata','durationchange'])audio.addEventListener(event,updatePlaybackUi);
    audio.addEventListener('play',()=>{isPlaying=true;updatePlaybackUi()});audio.addEventListener('pause',()=>{isPlaying=false;updatePlaybackUi()});
    audio.addEventListener('ended',()=>{isPlaying=false;status('Track finished. Playing next…');nextTrack(1);updatePlaybackUi()});
    audio.addEventListener('error',()=>{isPlaying=false;status('This recording could not be played. Try saving it while online, or choose another track.')});
    panel.querySelector('[data-radio-play]').addEventListener('click',togglePlayback);
    panel.querySelector('[data-radio-shuffle]').addEventListener('click',event=>{shuffleEnabled=!shuffleEnabled;event.currentTarget.textContent=shuffleEnabled?'Shuffle on':'Shuffle off';event.currentTarget.setAttribute('aria-pressed',String(shuffleEnabled))});
    panel.querySelector('[data-radio-search]').addEventListener('input',event=>{searchTerm=event.target.value.trim().toLowerCase().slice(0,120);renderTrackList()});
    panel.querySelector('[data-radio-previous]').addEventListener('click',()=>nextTrack(-1));panel.querySelector('[data-radio-next]').addEventListener('click',()=>nextTrack(1));
    panel.querySelector('[data-radio-seek]').addEventListener('input',event=>{seekTrack(event.target.value)});
    panel.querySelector('[data-radio-volume]').addEventListener('input',event=>{audio.volume=Math.min(1,Math.max(0,Number(event.target.value)||0))});
    panel.querySelector('[data-radio-body]').addEventListener('click',event=>{
      const play=event.target.closest?.('[data-radio-track-play]');if(play){playTrack(play.dataset.radioTrackPlay);return}
      const offline=event.target.closest?.('[data-radio-offline]');if(offline){const id=offline.dataset.radioOffline;savedIds.has(id)?removeOffline(id):saveOffline(id);return}
      if(event.target.closest?.('[data-radio-retry]'))loadCatalog();
    });
    panel.querySelector('[data-radio-close]')?.addEventListener('click',close);
    panel.querySelectorAll('[data-radio-mode]').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.radioMode)));
    panel.querySelector('[data-radio-nominate]')?.addEventListener('click',()=>{try{dispatchEvent(new CustomEvent('civweave:playlist-nomination-open',{detail:{system:currentSystem}}))}catch{}});
    if(!panel.isConnected)document.body.append(panel);
  }
  render();
  document.documentElement.dataset.civweaveRadioSurface='v1-direct-audio';
  return true;
}
function open(){if(!ensureSurface())return false;openState=true;panel.hidden=false;launcher.setAttribute('aria-expanded','true');render();loadCatalog();try{dispatchEvent(new CustomEvent('civweave:radio-station-opened',{detail:{system:currentSystem,mode:mode()}}))}catch{}return true}
function close(){if(!panel)return false;openState=false;panel.hidden=true;launcher?.setAttribute('aria-expanded','false');return true}
function toggle(){return openState?close():open()}
function refresh(){ensureSurface();if(openState)render();return true}
function start(){
  if(started)return true;started=true;
  ensureSurface();
  addEventListener('pageshow',refresh);
  addEventListener('civweave:safe-mode-changed',()=>{if(safeModeEnabled()&&currentTrack&&!currentTrack.safeAudit){stopTrack();status('S.A.F.E. is on. Select a recording with a complete safety audit.')}if(safeModeEnabled()&&mode()==='original')setMode('clean');else refresh()});
  addEventListener('civweave:system-route-changed',refresh);
  addEventListener('keydown',event=>{if(event.key==='Escape'&&openState){close();launcher?.focus()}});
  addEventListener('pagehide',()=>{playbackToken++;cancelSeek();audio?.pause();revokeObjectUrl()});
  addEventListener('civweave:canonical-playlists:changed',refresh);
  addEventListener('civweave:radio-preferences-changed',refresh);
  addEventListener('civweave:radio-station-open-request',open);
  try{dispatchEvent(new CustomEvent('civweave:radio-station-ready',{detail:{version:VERSION,system:currentSystem,cleanDefault:true,trackCount:tracksFor().length}}))}catch{}
}
const api=Object.freeze({version:VERSION,directAudio:true,directDefault:true,cleanDefault:true,catalogPath:CATALOG_PATH,streamManifestPath:STREAM_MANIFEST_PATH,audioCache:AUDIO_CACHE,systems:Object.freeze([...SYSTEMS]),stations:STATIONS,detectSystem,radioEnabled,safeModeEnabled,mode,setMode,station,tracksFor,directTracksFor,playTrack,saveOffline,removeOffline,open,close,toggle,refresh,ensureSurface});
globalThis.CivweaveRadioStationSurfaceV1=api;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
