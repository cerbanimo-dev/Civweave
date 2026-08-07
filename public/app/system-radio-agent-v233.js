(()=>{
'use strict';

const VERSION='1.1.0';
const REVISION='system-radio-agent-v233';
const SESSION_KEY='civweave.radio.session.v3';
const PREFS_KEY='civweave.radio.preferences.v1';
const SNOOZE_KEY='civweave.radio.snooze-until.v1';
const SNOOZE_MS=30*60*1000;
const PRESENTATION_DELAY_MS=650;
const AUTO_DISMISS_MS=6000;
const EXIT_ANIMATION_MS=340;
const NAVIGATION_DEBOUNCE_MS=120;
const DISMISS_BUTTON_LABEL='Dismiss radio for 30 minutes';
const ALLOWED_PLACEMENTS=new Set(['toast','transition-card','sidebar']);
const FALLBACK_PATHS=new Map([
  ['/app/working-campus-v156.html','civweave'],
  ['/app/cabinets/living-school/index.html','living-school'],
  ['/app/realm-console-v140.html','cerbanimo'],
  ['/app/fellowfare-cabinet-v144.html','fellowfare'],
  ['/app/anarchadia-console-v139.html','anarchadia']
]);
const SYSTEM_ALIASES=Object.freeze({living_school:'living-school'});
const SYSTEM_RADIO=deepFreeze({
  anarchadia:{
    id:'anarchadia',name:'Anarchadia Radio',
    spotifyUrl:'https://open.spotify.com/playlist/2AsCLZiAPlUYHOcogllTia?si=eb56f112a533471f',
    messages:[{id:'default',text:'Need an anthem?'}],tracks:[]
  },
  cerbanimo:{
    id:'cerbanimo',name:'Cerbanimo Radio',
    spotifyUrl:'https://open.spotify.com/playlist/1CB3LLMSnuDwD013B1ZY3M?si=53a4a04d7e124ffe',
    messages:[{id:'default',text:'Pump up the tempo.'}],tracks:[]
  },
  'living-school':{
    id:'living-school',name:'Living School Radio',
    spotifyUrl:'https://open.spotify.com/playlist/2MwmQdjHyRBIu8Wy9iXWUm?si=3050b522d37e432d',
    messages:[{id:'default',text:'Live and learn.'}],tracks:[]
  },
  fellowfare:{
    id:'fellowfare',name:'Fellowfare Radio',
    spotifyUrl:'https://open.spotify.com/playlist/1q6YDYRU6hekl2MkHkI2X3?si=65a29df0b33a435c',
    messages:[{id:'default',text:"Soft Rock for the People's Mall."}],tracks:[]
  },
  civweave:{
    id:'civweave',name:'Civweave Radio',
    spotifyUrl:'https://open.spotify.com/playlist/2BLWIhSfHdbcfG5rP8IqoX?si=erOpH2egRsyWT5HvxRO0tQ',
    messages:[{id:'default',text:'Thinking big picture? Us too.'}],tracks:[]
  }
});

let decisionProvider=null;
let renderToken='';
let autoDismissTimer=0;
let exitRemovalTimer=0;
let wakeTimer=0;
let navigationTimer=0;
let lastNavigationRoute='';
let started=false;

function deepFreeze(value){
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}
function parse(value,fallback){try{return JSON.parse(value)??fallback}catch{return fallback}}
function iso(){return new Date().toISOString()}
function uid(){return globalThis.crypto?.randomUUID?.()||`radio-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`}
function normalizeSystemId(value){
  const raw=String(value||'').trim().toLowerCase();
  return SYSTEM_ALIASES[raw]||raw;
}
function activeSystem(){
  const routeId=globalThis.CivweaveSystemRoutesV227?.identify?.(location.pathname);
  const datasetId=document.documentElement?.dataset?.civweaveSystemRoute||document.documentElement?.dataset?.civweaveSystem;
  return normalizeSystemId(routeId||datasetId||FALLBACK_PATHS.get(location.pathname)||'');
}
function currentRoute(){return `${location.pathname}${location.search}${location.hash}`.slice(0,1800)}
function loadSession(){
  const stored=parse(sessionStorage.getItem(SESSION_KEY),null);
  return stored&&stored.sessionId?stored:{
    sessionId:uid(),
    activeSystem:'',
    currentRoute:'',
    previousRoute:'',
    lastShownSystem:'',
    lastShownAt:'',
    shownCount:0,
    clickedSystems:[],
    exposureBySystem:{}
  };
}
function saveSession(value){sessionStorage.setItem(SESSION_KEY,JSON.stringify(value));return value}
function preferences(){return{enabled:true,...parse(localStorage.getItem(PREFS_KEY),{})}}
function setEnabled(enabled){
  const next={...preferences(),enabled:Boolean(enabled)};
  localStorage.setItem(PREFS_KEY,JSON.stringify(next));
  if(!next.enabled)removeSuggestion('disabled');
  else scheduleEvaluation('enabled',0,true);
  return next.enabled;
}
function snoozeUntil(){
  const raw=Number(localStorage.getItem(SNOOZE_KEY)||0);
  if(!Number.isFinite(raw)||raw<=0)return 0;
  if(raw<=Date.now()){
    localStorage.removeItem(SNOOZE_KEY);
    return 0;
  }
  return raw;
}
function snoozeRemainingMs(){return Math.max(0,snoozeUntil()-Date.now())}
function scheduleWake(){
  if(wakeTimer)clearTimeout(wakeTimer);
  wakeTimer=0;
  const remaining=snoozeRemainingMs();
  if(!remaining)return;
  wakeTimer=setTimeout(()=>{
    wakeTimer=0;
    localStorage.removeItem(SNOOZE_KEY);
    emit('RADIO_SNOOZE_ENDED',{route:currentRoute(),system:activeSystem()});
    scheduleEvaluation('snooze_expired',0,true);
  },remaining+30);
}
function snooze(durationMs=SNOOZE_MS){
  const until=Date.now()+Math.max(0,Number(durationMs)||SNOOZE_MS);
  localStorage.setItem(SNOOZE_KEY,String(until));
  scheduleWake();
  removeSuggestion('snoozed');
  emit('RADIO_SNOOZED',{snoozeUntil:new Date(until).toISOString(),snoozeMs:Math.max(0,Number(durationMs)||SNOOZE_MS)});
  return until;
}
function verifiedRadio(systemId){
  const radio=SYSTEM_RADIO[normalizeSystemId(systemId)];
  if(!radio)return null;
  try{
    const url=new URL(radio.spotifyUrl);
    if(url.protocol!=='https:'||url.hostname!=='open.spotify.com'||!url.pathname.startsWith('/playlist/'))return null;
  }catch{return null}
  return radio;
}
function emit(type,detail={}){
  const payload={type,timestamp:iso(),revision:REVISION,...detail};
  globalThis.dispatchEvent?.(new CustomEvent('civweave:experience-event',{detail:payload}));
  globalThis.dispatchEvent?.(new CustomEvent('civweave:radio-event',{detail:payload}));
  return payload;
}
function analytics(name,properties){
  globalThis.dispatchEvent?.(new CustomEvent('civweave:analytics',{
    detail:{name,properties,timestamp:iso(),source:REVISION}
  }));
}
function approvedCopy(radio,copyId){return radio.messages.find(message=>message.id===copyId)||radio.messages[0]}
function contextSnapshot({previousSystem='',reason='page_navigated',session=null}={}){
  const state=session||loadSession();
  const system=activeSystem();
  return Object.freeze({
    activeSystem:system,
    currentRoute:currentRoute(),
    route:currentRoute(),
    previousSystem:normalizeSystemId(previousSystem),
    lastPlaylistShown:state.lastShownSystem,
    lastTimeShown:state.lastShownAt,
    sessionExposureCount:Number(state.shownCount||0),
    snoozeUntil:snoozeUntil(),
    snoozeRemainingMs:snoozeRemainingMs(),
    reason
  });
}
function eligibility(context){
  if(!preferences().enabled)return{eligible:false,reason:'recommendations_disabled'};
  if(!verifiedRadio(context.activeSystem))return{eligible:false,reason:'no_approved_playlist'};
  if(context.snoozeRemainingMs>0)return{eligible:false,reason:'user_snoozed'};
  return{eligible:true,reason:context.reason||'page_navigated'};
}
function defaultAgentDecision(context,gate){
  return{
    action:gate.eligible?'show':'suppress',
    messageVariant:'default',
    placement:context.reason==='system_changed'||context.reason==='session_started'?'transition-card':'toast',
    reason:gate.reason
  };
}
function sanitizeDecision(raw,radio,gate){
  const requestedCopy=String(raw?.messageVariant||'default');
  const copyId=radio.messages.some(message=>message.id===requestedCopy)?requestedCopy:'default';
  const placement=ALLOWED_PLACEMENTS.has(raw?.placement)?raw.placement:'toast';
  return Object.freeze({
    action:gate.eligible?'show':'suppress',
    messageVariant:copyId,
    placement,
    reason:String(gate.eligible?(raw?.reason||gate.reason):gate.reason).slice(0,80)
  });
}
async function agentDecision(context){
  const gate=eligibility(context);
  const radio=verifiedRadio(context.activeSystem);
  if(!radio)return Object.freeze({action:'suppress',messageVariant:'default',placement:'toast',reason:'no_approved_playlist'});
  let raw;
  try{
    raw=decisionProvider?await decisionProvider(Object.freeze({
      activeSystem:context.activeSystem,
      currentRoute:context.currentRoute,
      previousSystem:context.previousSystem,
      lastPlaylistShown:context.lastPlaylistShown,
      lastTimeShown:context.lastTimeShown,
      sessionExposureCount:context.sessionExposureCount,
      snoozeUntil:context.snoozeUntil,
      snoozeRemainingMs:context.snoozeRemainingMs,
      approvedCopyIds:radio.messages.map(message=>message.id),
      allowedPlacements:[...ALLOWED_PLACEMENTS],
      eligibility:gate
    })):defaultAgentDecision(context,gate);
  }catch{
    raw=defaultAgentDecision(context,gate);
  }
  return sanitizeDecision(raw,radio,gate);
}
function claimPresentation(context){
  const orchestrator=globalThis.CivweaveExperienceOrchestratorV232;
  if(!orchestrator?.claim)return{ok:true,token:'radio-standalone'};
  const claim=orchestrator.claim('system-radio',{priority:20,ttlMs:20000,context});
  if(claim?.ok)return claim;
  // This station ID is intentionally persistent on page navigation. If another
  // low-priority presentation has the lease, keep the radio independent rather
  // than silently dropping the page's recommendation.
  return{ok:true,token:'radio-independent'};
}
function releasePresentation(){
  if(!renderToken)return;
  if(renderToken!=='radio-standalone'&&renderToken!=='radio-independent'){
    globalThis.CivweaveExperienceOrchestratorV232?.release?.(renderToken);
  }
  renderToken='';
}
function clearSuggestionTimers(){
  if(autoDismissTimer)clearTimeout(autoDismissTimer);
  if(exitRemovalTimer)clearTimeout(exitRemovalTimer);
  autoDismissTimer=0;
  exitRemovalTimer=0;
}
function installStyle(){
  if(document.getElementById('cw-radio-style-v233'))return;
  const style=document.createElement('style');
  style.id='cw-radio-style-v233';
  style.textContent=`
#cw-radio-suggestion-v233{
  --cw-radio-progress:linear-gradient(90deg,#9be7ff,#d7a5ff,#ff7bc8,#ffd36e);
  position:fixed;
  z-index:2147482600;
  left:max(14px,env(safe-area-inset-left));
  right:auto;
  bottom:max(14px,env(safe-area-inset-bottom));
  width:min(360px,calc(100vw - 28px));
  overflow:hidden;
  isolation:isolate;
  font:500 14px/1.35 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  color:#f8f8f4;
  background:color-mix(in srgb,#07162f 92%,transparent);
  border:1px solid #ffffff2b;
  border-radius:18px;
  box-shadow:0 18px 54px #0008;
  backdrop-filter:blur(16px);
  padding:16px 48px 18px 16px;
  animation:cw-radio-in-v233 .24s ease-out both;
}
#cw-radio-suggestion-v233[data-system="anarchadia"]{--cw-radio-progress:linear-gradient(90deg,#ff335f,#ff4fb8,#ffe14a)}
#cw-radio-suggestion-v233[data-system="cerbanimo"]{--cw-radio-progress:linear-gradient(90deg,#9c58ff,#ff38c7,#45e7ff,#ffbf48)}
#cw-radio-suggestion-v233[data-system="living-school"]{--cw-radio-progress:linear-gradient(90deg,#4fbb76,#44c9c6,#f5cf4f)}
#cw-radio-suggestion-v233[data-system="fellowfare"]{--cw-radio-progress:linear-gradient(90deg,#d97849,#f1b94e,#50a679,#2f5c84)}
#cw-radio-suggestion-v233[data-system="civweave"]{--cw-radio-progress:linear-gradient(90deg,#7adfff,#b88cff,#ff72bd,#ffd16a,#7ff0c9)}
#cw-radio-suggestion-v233::before{
  content:"";position:absolute;inset:0;z-index:0;pointer-events:none;
  background:var(--cw-radio-progress);opacity:.12;transform:scaleX(0);transform-origin:left center;
  animation:cw-radio-progress-v233 ${AUTO_DISMISS_MS}ms linear forwards;
}
#cw-radio-suggestion-v233::after{
  content:"";position:absolute;left:0;right:0;bottom:0;height:4px;z-index:2;pointer-events:none;
  background:var(--cw-radio-progress);transform:scaleX(0);transform-origin:left center;
  animation:cw-radio-progress-v233 ${AUTO_DISMISS_MS}ms linear forwards;
}
#cw-radio-suggestion-v233>*{position:relative;z-index:1}
#cw-radio-suggestion-v233 .cw-radio-eyebrow{display:block;opacity:.82;margin:0 0 3px;font-size:12px;letter-spacing:.02em}
#cw-radio-suggestion-v233 .cw-radio-title{display:block;font-size:18px;margin:0 0 12px}
#cw-radio-suggestion-v233 .cw-radio-link{display:inline-flex;align-items:center;min-height:40px;padding:0 14px;border-radius:999px;background:#f8f8f4;color:#07162f;text-decoration:none;font-weight:800}
#cw-radio-suggestion-v233 .cw-radio-dismiss{position:absolute;z-index:3;right:9px;top:9px;width:34px;height:34px;border:0;border-radius:50%;background:#ffffff12;color:inherit;font-size:20px;cursor:pointer}
#cw-radio-suggestion-v233.is-exiting{pointer-events:none;animation:cw-radio-out-v233 ${EXIT_ANIMATION_MS}ms cubic-bezier(.4,0,1,1) forwards}
@keyframes cw-radio-in-v233{from{opacity:0;transform:translate3d(-28px,10px,0)}to{opacity:1;transform:translate3d(0,0,0)}}
@keyframes cw-radio-progress-v233{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes cw-radio-out-v233{from{opacity:1;transform:translate3d(0,0,0)}to{opacity:0;transform:translate3d(calc(-100% - 40px),0,0)}}
@media(max-width:560px){
  #cw-radio-suggestion-v233{
    left:max(12px,env(safe-area-inset-left));
    right:auto;
    bottom:max(12px,env(safe-area-inset-bottom));
    width:min(340px,calc(100vw - 24px));
  }
}
@media(prefers-reduced-motion:reduce){
  #cw-radio-suggestion-v233,
  #cw-radio-suggestion-v233::before,
  #cw-radio-suggestion-v233::after,
  #cw-radio-suggestion-v233.is-exiting{animation:none}
}
`;
  document.head.append(style);
}
function recordShown(context,decision){
  const session=loadSession();
  session.lastShownSystem=context.activeSystem;
  session.lastShownAt=iso();
  session.shownCount=Number(session.shownCount||0)+1;
  session.exposureBySystem={
    ...(session.exposureBySystem||{}),
    [context.activeSystem]:Number(session.exposureBySystem?.[context.activeSystem]||0)+1
  };
  saveSession(session);
  emit('RADIO_CTA_SHOWN',{system:context.activeSystem,copyId:decision.messageVariant,placement:decision.placement,reason:decision.reason});
  analytics('radio_impression',{
    system:context.activeSystem,
    copyVariant:decision.messageVariant,
    placement:decision.placement,
    sourceRoute:session.previousRoute||'',
    destinationRoute:context.currentRoute
  });
}
function removeSuggestion(reason='removed'){
  clearSuggestionTimers();
  document.getElementById('cw-radio-suggestion-v233')?.remove();
  releasePresentation();
  emit('RADIO_CTA_HIDDEN',{reason});
}
function scheduleAutoDismiss(card){
  clearSuggestionTimers();
  autoDismissTimer=setTimeout(()=>{
    autoDismissTimer=0;
    if(!card?.isConnected)return;
    card.classList.add('is-exiting');
    exitRemovalTimer=setTimeout(()=>{
      exitRemovalTimer=0;
      if(card.isConnected)removeSuggestion('auto_timeout');
    },EXIT_ANIMATION_MS);
  },AUTO_DISMISS_MS);
}
function render(context,decision){
  const radio=verifiedRadio(context.activeSystem);
  if(!radio)return false;
  const copy=approvedCopy(radio,decision.messageVariant);
  removeSuggestion('replace');
  const claim=claimPresentation(context);
  renderToken=claim.token||'radio-independent';
  installStyle();

  const card=document.createElement('aside');
  card.id='cw-radio-suggestion-v233';
  card.dataset.placement=decision.placement;
  card.dataset.system=context.activeSystem;
  card.setAttribute('role','complementary');
  card.setAttribute('aria-label',radio.name);

  const eyebrow=document.createElement('span');
  eyebrow.className='cw-radio-eyebrow';
  eyebrow.textContent=copy.text;

  const title=document.createElement('strong');
  title.className='cw-radio-title';
  title.textContent=radio.name;

  const link=document.createElement('a');
  link.className='cw-radio-link';
  link.href=radio.spotifyUrl;
  link.target='_blank';
  link.rel='noopener noreferrer';
  link.textContent='Listen on Spotify ↗';

  const dismiss=document.createElement('button');
  dismiss.className='cw-radio-dismiss';
  dismiss.type='button';
  dismiss.setAttribute('aria-label',DISMISS_BUTTON_LABEL);
  dismiss.title='Sleep radio suggestions for 30 minutes';
  dismiss.textContent='×';

  card.append(eyebrow,title,link,dismiss);

  link.addEventListener('click',()=>{
    const session=loadSession();
    session.clickedSystems=[...new Set([...(session.clickedSystems||[]),context.activeSystem])];
    saveSession(session);
    emit('RADIO_CTA_CLICKED',{system:context.activeSystem,copyId:decision.messageVariant,placement:decision.placement});
    analytics('radio_click',{system:context.activeSystem,copyVariant:decision.messageVariant,placement:decision.placement,destinationRoute:context.currentRoute});
    queueMicrotask(()=>removeSuggestion('clicked'));
  },{once:true});

  dismiss.addEventListener('click',()=>{
    const until=Date.now()+SNOOZE_MS;
    emit('RADIO_CTA_DISMISSED',{
      system:context.activeSystem,
      copyId:decision.messageVariant,
      placement:decision.placement,
      snoozeMs:SNOOZE_MS,
      snoozeUntil:new Date(until).toISOString()
    });
    analytics('radio_dismiss',{system:context.activeSystem,copyVariant:decision.messageVariant,placement:decision.placement,destinationRoute:context.currentRoute,snoozeMs:SNOOZE_MS});
    snooze(SNOOZE_MS);
  },{once:true});

  document.body.append(card);
  recordShown(context,decision);
  scheduleAutoDismiss(card);
  return true;
}
async function evaluate(context=contextSnapshot()){
  const decision=await agentDecision(context);
  if(decision.action!=='show'){
    if(decision.reason==='user_snoozed')scheduleWake();
    removeSuggestion(decision.reason);
    emit('RADIO_CTA_SUPPRESSED',{system:context.activeSystem,reason:decision.reason,snoozeRemainingMs:context.snoozeRemainingMs});
    return decision;
  }
  render(context,decision);
  return decision;
}
function registerDecisionProvider(provider){
  if(provider!==null&&typeof provider!=='function')throw new TypeError('Radio decision provider must be a function or null.');
  decisionProvider=provider;
  return Boolean(provider);
}
function updateNavigationSession(reason='page_navigated'){
  const system=activeSystem();
  if(!system||!verifiedRadio(system))return null;
  const session=loadSession();
  const previousSystem=normalizeSystemId(session.activeSystem);
  const previousRoute=session.currentRoute||'';
  const route=currentRoute();
  session.previousRoute=previousRoute;
  session.activeSystem=system;
  session.currentRoute=route;
  saveSession(session);
  const changed=Boolean(previousSystem&&previousSystem!==system);
  const resolvedReason=changed?'system_changed':reason;
  if(changed){
    emit('SYSTEM_CONTEXT_CHANGED',{previousSystem,activeSystem:system,route});
    analytics('system_switch',{system,sourceRoute:previousRoute,destinationRoute:route,previousSystem});
  }
  emit('PAGE_NAVIGATED',{previousSystem,activeSystem:system,route,previousRoute});
  return{system,session,previousSystem,previousRoute,reason:resolvedReason};
}
function scheduleEvaluation(reason='page_navigated',delay=PRESENTATION_DELAY_MS,force=false){
  if(navigationTimer)clearTimeout(navigationTimer);
  navigationTimer=0;
  const route=currentRoute();
  if(!force&&route===lastNavigationRoute)return false;
  lastNavigationRoute=route;
  navigationTimer=setTimeout(()=>{
    navigationTimer=0;
    const state=updateNavigationSession(reason);
    if(!state)return;
    evaluate(contextSnapshot({previousSystem:state.previousSystem,reason:state.reason,session:loadSession()})).catch(error=>{
      console.warn('[Civweave Radio] page recommendation failed safely.',error);
      emit('RADIO_CTA_SUPPRESSED',{system:state.system,reason:'evaluation_error'});
    });
  },Math.max(0,delay));
  return true;
}
function installNavigationWatch(){
  if(globalThis.__civweaveRadioNavigationWatchV233)return;
  globalThis.__civweaveRadioNavigationWatchV233=true;
  for(const method of ['pushState','replaceState']){
    const original=history[method];
    if(typeof original!=='function')continue;
    history[method]=function(...args){
      const result=original.apply(this,args);
      scheduleEvaluation('page_navigated',NAVIGATION_DEBOUNCE_MS);
      return result;
    };
  }
  addEventListener('popstate',()=>scheduleEvaluation('page_navigated',NAVIGATION_DEBOUNCE_MS));
  addEventListener('hashchange',()=>scheduleEvaluation('page_navigated',NAVIGATION_DEBOUNCE_MS));
  addEventListener('storage',event=>{
    if(event.key!==SNOOZE_KEY)return;
    if(snoozeRemainingMs()>0){removeSuggestion('snoozed_elsewhere');scheduleWake();}
    else scheduleEvaluation('snooze_expired',0,true);
  });
}
function start(){
  if(started)return true;
  const system=activeSystem();
  if(!system||!verifiedRadio(system))return false;
  started=true;
  installNavigationWatch();
  scheduleWake();
  const stored=parse(sessionStorage.getItem(SESSION_KEY),null);
  const session=loadSession();
  const firstSession=!stored?.sessionId;
  if(firstSession)emit('SESSION_STARTED',{sessionId:session.sessionId,activeSystem:system,route:currentRoute()});
  const reason=firstSession?'session_started':'page_navigated';
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>scheduleEvaluation(reason,PRESENTATION_DELAY_MS,true),{once:true});
  }else{
    scheduleEvaluation(reason,PRESENTATION_DELAY_MS,true);
  }
  return true;
}

const api=Object.freeze({
  version:VERSION,
  revision:REVISION,
  registry:SYSTEM_RADIO,
  normalizeSystemId,
  activeSystem,
  verifiedRadio,
  contextSnapshot,
  eligibility,
  agentDecision,
  evaluate,
  registerDecisionProvider,
  setEnabled,
  preferences,
  snooze,
  snoozeUntil,
  snoozeRemainingMs,
  start
});
globalThis.CivweaveRadioRecommendationAgentV233=api;
// Compatibility alias while callers migrate from v232.
globalThis.CivweaveRadioRecommendationAgentV232=api;
start();
globalThis.dispatchEvent?.(new CustomEvent('civweave:radio-agent-ready',{
  detail:{version:VERSION,revision:REVISION,systems:Object.keys(SYSTEM_RADIO),snoozeMs:SNOOZE_MS,placement:'bottom-left'}
}));
})();
