(()=>{
'use strict';

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

const VERSION='1.0.0-clean-default-v1';
const LAUNCHER_ID='cw-radio-station-launcher-v1';
const PANEL_ID='cw-radio-station-panel-v1';
const STYLE_ID='cw-radio-station-surface-v1-style';
const MODE_KEY='civweave.radio.content-mode.v1';
const SAFE_KEY='civweave.safe-mode.v1';
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
let launcher=null;
let panel=null;
let openState=false;
let currentSystem='';

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
  if(safeModeEnabled())return'clean';
  try{return localStorage.getItem(MODE_KEY)==='original'?'original':'clean'}catch{return'clean'}
}
function setMode(next){
  const value=next==='original'?'original':'clean';
  if(value==='original'&&safeModeEnabled())return false;
  try{localStorage.setItem(MODE_KEY,value)}catch{}
  render();
  try{dispatchEvent(new CustomEvent('civweave:radio-station-mode-changed',{detail:{mode:value,system:currentSystem}}))}catch{}
  return true;
}
function station(system=currentSystem){return STATIONS[system]||null}
function tracksFor(system=currentSystem){return station(system)?.tracks||[]}
function spotifyTrackUrl(track){const id=clean(track?.spotifyTrackId,40);return /^[A-Za-z0-9]{22}$/.test(id)?`https://open.spotify.com/track/${id}`:''}

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
#${LAUNCHER_ID}{position:fixed;z-index:2147483608;left:max(12px,env(safe-area-inset-left));right:auto;bottom:calc(var(--cw-themed-nav-height,64px) + env(safe-area-inset-bottom) + 12px);width:56px;height:56px;border:1px solid #ffffff55;border-radius:50%;padding:0;background:#07111fee;color:#fff;box-shadow:0 10px 30px #0009,0 0 18px #59d9ff44;font:900 25px/1 system-ui;display:grid;place-items:center;cursor:pointer;-webkit-tap-highlight-color:transparent}
#${LAUNCHER_ID}[aria-expanded="true"]{box-shadow:0 10px 30px #000a,0 0 24px #ffffff55}
#${PANEL_ID}{position:fixed;z-index:2147483609;left:max(12px,env(safe-area-inset-left));right:auto;bottom:calc(var(--cw-themed-nav-height,64px) + env(safe-area-inset-bottom) + 78px);width:min(430px,calc(100vw - 24px));max-height:min(64dvh,720px);display:grid;grid-template-rows:auto auto minmax(0,1fr);overflow:hidden;border:1px solid #ffffff30;border-radius:18px;background:#0b1019f5;color:#f8fbff;box-shadow:0 24px 70px #000c;font:14px/1.4 Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color-scheme:dark}
#${PANEL_ID}[hidden]{display:none!important}#${PANEL_ID} *{box-sizing:border-box}
#${PANEL_ID}>header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px;border-bottom:1px solid #ffffff18}
#${PANEL_ID}>header small{display:block;color:#aebccf;font-size:11px;text-transform:uppercase;letter-spacing:.09em}#${PANEL_ID}>header strong{display:block;margin-top:2px;font-size:20px}
#${PANEL_ID} button{cursor:pointer}#${PANEL_ID} [data-radio-close]{width:36px;height:36px;border:1px solid #ffffff25;border-radius:10px;background:#ffffff0b;color:#fff;font-size:20px}
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
@media(max-width:560px){#${PANEL_ID}{max-height:58dvh}#${LAUNCHER_ID}{width:54px;height:54px}}
@media(prefers-reduced-motion:reduce){#${LAUNCHER_ID},#${PANEL_ID}{scroll-behavior:auto;transition:none}}
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
  panel.querySelector('[data-radio-system]').textContent=item.name;
  const cleanButton=panel.querySelector('[data-radio-mode="clean"]');
  const originalButton=panel.querySelector('[data-radio-mode="original"]');
  cleanButton?.setAttribute('aria-pressed',selected==='clean'?'true':'false');
  originalButton?.setAttribute('aria-pressed',selected==='original'?'true':'false');
  if(originalButton){originalButton.hidden=safe;originalButton.disabled=safe}
  const safeBadge=panel.querySelector('[data-radio-safe]');
  if(safeBadge){safeBadge.hidden=!safe;safeBadge.textContent='S.A.F.E. · clean station locked'}
  const body=panel.querySelector('[data-radio-body]');
  if(selected==='original'&&!safe){
    body.innerHTML=`<section class="cw-radio-original"><p>The original station is available uncensored and may contain strong profanity or slurs. Civweave's lyric-audited companion remains the default.</p><a href="${esc(item.originalSpotifyUrl)}" target="_blank" rel="noopener noreferrer external">Open original Spotify station ↗</a></section>`;
  }else{
    body.innerHTML=`<p class="cw-radio-note">${rows.length} lyric-audited tracks · F-word/N-word/slur failures and unverified exact recordings removed.</p>${rows.map((track,index)=>{const href=spotifyTrackUrl(track);return `<article class="cw-radio-track"><span class="cw-radio-index">${index+1}</span><div><strong>${esc(track.title)}</strong><span>${esc(track.artist)} · ${esc(track.audit)}</span></div>${href?`<a href="${href}" target="_blank" rel="noopener noreferrer external" aria-label="Open ${esc(track.title)} on Spotify">Spotify ↗</a>`:''}</article>`}).join('')}`;
    const pending=pendingGovernanceCount();
    if(currentSystem==='anarchadia'&&pending>0){
      const button=document.createElement('button');button.type='button';button.className='cw-radio-governance';button.dataset.radioGovernance='true';button.textContent=`Playlist votes waiting · ${pending}`;button.addEventListener('click',()=>{try{dispatchEvent(new CustomEvent('civweave:playlist-governance-open'))}catch{}});body.append(button);
    }
  }
  launcher?.setAttribute('aria-label',`Open ${item.name}`);
  return true;
}
function ensureSurface(){
  currentSystem=detectSystem();if(!currentSystem||!document.body)return false;
  installStyle();
  if(!radioEnabled()){
    document.getElementById(LAUNCHER_ID)?.remove();document.getElementById(PANEL_ID)?.remove();launcher=null;panel=null;openState=false;return false;
  }
  if(!launcher?.isConnected){
    launcher=document.getElementById(LAUNCHER_ID)||document.createElement('button');
    launcher.id=LAUNCHER_ID;launcher.type='button';launcher.textContent='♫';launcher.setAttribute('aria-haspopup','dialog');launcher.setAttribute('aria-expanded','false');
    launcher.addEventListener('click',toggle);
    if(!launcher.isConnected)document.body.append(launcher);
  }
  if(!panel?.isConnected){
    panel=document.getElementById(PANEL_ID)||document.createElement('section');
    panel.id=PANEL_ID;panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Civweave radio station');
    panel.innerHTML=`<header><div><small>LYRIC-AUDITED DEFAULT</small><strong data-radio-system>Radio</strong></div><button type="button" data-radio-close aria-label="Close station">×</button></header><div class="cw-radio-modebar"><button type="button" data-radio-mode="clean" aria-pressed="true">Clean station</button><button type="button" data-radio-mode="original" aria-pressed="false">Original / uncensored</button><button type="button" data-radio-nominate>Nominate track</button><span class="cw-radio-safe" data-radio-safe hidden></span></div><div class="cw-radio-body" data-radio-body></div>`;
    panel.querySelector('[data-radio-close]')?.addEventListener('click',close);
    panel.querySelectorAll('[data-radio-mode]').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.radioMode)));
    panel.querySelector('[data-radio-nominate]')?.addEventListener('click',()=>{try{dispatchEvent(new CustomEvent('civweave:playlist-nomination-open',{detail:{system:currentSystem}}))}catch{}});
    if(!panel.isConnected)document.body.append(panel);
  }
  render();
  document.documentElement.dataset.civweaveRadioSurface='v1-clean-default';
  return true;
}
function open(){if(!ensureSurface())return false;openState=true;panel.hidden=false;launcher.setAttribute('aria-expanded','true');render();try{dispatchEvent(new CustomEvent('civweave:radio-station-opened',{detail:{system:currentSystem,mode:mode()}}))}catch{}return true}
function close(){if(!panel)return false;openState=false;panel.hidden=true;launcher?.setAttribute('aria-expanded','false');return true}
function toggle(){return openState?close():open()}
function refresh(){ensureSurface();if(openState)render();return true}
function start(){
  ensureSurface();
  addEventListener('pageshow',refresh);
  addEventListener('civweave:safe-mode-changed',()=>{if(safeModeEnabled())setMode('clean');else refresh()});
  addEventListener('civweave:canonical-playlists:changed',refresh);
  addEventListener('civweave:radio-preferences-changed',refresh);
  addEventListener('civweave:radio-station-open-request',open);
  try{dispatchEvent(new CustomEvent('civweave:radio-station-ready',{detail:{version:VERSION,system:currentSystem,cleanDefault:true,trackCount:tracksFor().length}}))}catch{}
}
const api=Object.freeze({version:VERSION,cleanDefault:true,systems:Object.freeze([...SYSTEMS]),stations:STATIONS,detectSystem,radioEnabled,safeModeEnabled,mode,setMode,station,tracksFor,open,close,toggle,refresh,ensureSurface});
globalThis.CivweaveRadioStationSurfaceV1=api;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
