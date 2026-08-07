(()=>{
'use strict';

const VERSION='1.0.0';
const REVISION='system-radio-agent-v232';
const SESSION_KEY='civweave.radio.session.v1';
const MEMORY_KEY='civweave.radio.memory.v1';
const PREFS_KEY='civweave.radio.preferences.v1';
const SYSTEM_COOLDOWN_MS=30*60*1000;
const REENTRY_ELIGIBILITY_MS=45*60*1000;
const MAX_SESSION_EXPOSURES=3;
const PRESENTATION_DELAY_MS=1100;
const DISMISS_BUTTON_LABEL='Dismiss radio recommendation';
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
    messages:[{id:'default',text:'Need an anthem?'}]
  },
  cerbanimo:{
    id:'cerbanimo',name:'Cerbanimo Radio',
    spotifyUrl:'https://open.spotify.com/playlist/1CB3LLMSnuDwD013B1ZY3M?si=53a4a04d7e124ffe',
    messages:[{id:'default',text:'Pump up the tempo.'}]
  },
  'living-school':{
    id:'living-school',name:'Living School Radio',
    spotifyUrl:'https://open.spotify.com/playlist/2MwmQdjHyRBIu8Wy9iXWUm?si=3050b522d37e432d',
    messages:[{id:'default',text:'Live and learn.'}]
  },
  fellowfare:{
    id:'fellowfare',name:'Fellowfare Radio',
    spotifyUrl:'https://open.spotify.com/playlist/1q6YDYRU6hekl2MkHkI2X3?si=65a29df0b33a435c',
    messages:[{id:'default',text:"Soft Rock for the People's Mall."}]
  },
  civweave:{
    id:'civweave',name:'Civweave Radio',
    spotifyUrl:'https://open.spotify.com/playlist/2BLWIhSfHdbcfG5rP8IqoX?si=erOpH2egRsyWT5HvxRO0tQ',
    messages:[{id:'default',text:'Thinking big picture? Us too.'}]
  }
});
let decisionProvider=null;
let interactionState={interacted:false,critical:false,lastInteractionAt:null};
let renderToken='';

function deepFreeze(value){
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}
function parse(value,fallback){try{return JSON.parse(value)??fallback}catch{return fallback}}
function iso(){return new Date().toISOString()}
function millis(value){const parsed=Date.parse(String(value||''));return Number.isFinite(parsed)?parsed:0}
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
  return stored&&stored.sessionId?stored:{sessionId:uid(),activeSystem:'',currentRoute:'',lastShownSystem:'',lastShownAt:'',shownCount:0,dismissedThisSession:false,clickedSystems:[],exposureBySystem:{}};
}
function saveSession(value){sessionStorage.setItem(SESSION_KEY,JSON.stringify(value));return value}
function loadMemory(){return parse(localStorage.getItem(MEMORY_KEY),{lastShownAtBySystem:{}})}
function saveMemory(value){localStorage.setItem(MEMORY_KEY,JSON.stringify(value));return value}
function preferences(){return{enabled:true,...parse(localStorage.getItem(PREFS_KEY),{})}}
function setEnabled(enabled){
  const next={...preferences(),enabled:Boolean(enabled)};
  localStorage.setItem(PREFS_KEY,JSON.stringify(next));
  if(!next.enabled)removeSuggestion('disabled');
  return next.enabled;
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
  const payload={type,timestamp:iso(),...detail};
  globalThis.dispatchEvent?.(new CustomEvent('civweave:experience-event',{detail:payload}));
  globalThis.dispatchEvent?.(new CustomEvent('civweave:radio-event',{detail:payload}));
  return payload;
}
function analytics(name,properties){
  globalThis.dispatchEvent?.(new CustomEvent('civweave:analytics',{detail:{name,properties,timestamp:iso(),source:REVISION}}));
}
function approvedCopy(radio,copyId){return radio.messages.find(message=>message.id===copyId)||radio.messages[0]}
function protectedFlow(context){
  if(context.userInteractionState?.critical)return true;
  const orchestrator=globalThis.CivweaveExperienceOrchestratorV232;
  if(orchestrator?.protectedFlow?.(context))return true;
  const route=String(context.route||'');
  return /(?:^|\/)(?:checkout|payment|billing|auth|login|sign[-_]?in|sign[-_]?up|submit|confirmation?|destructive|recovery|error)(?:\/|$)/i.test(route);
}
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
    dismissalState:{dismissedThisSession:Boolean(state.dismissedThisSession)},
    sessionExposureCount:Number(state.shownCount||0),
    userInteractionState:{...interactionState},
    reason
  });
}
function eligibility(context){
  const radio=verifiedRadio(context.activeSystem);
  if(!preferences().enabled)return{eligible:false,reason:'recommendations_disabled'};
  if(!radio)return{eligible:false,reason:'no_approved_playlist'};
  if(context.dismissalState.dismissedThisSession)return{eligible:false,reason:'dismissed_this_session'};
  if(protectedFlow(context))return{eligible:false,reason:'protected_flow'};
  if(context.sessionExposureCount>=MAX_SESSION_EXPOSURES)return{eligible:false,reason:'session_frequency_cap'};
  const memory=loadMemory();
  const lastSystemShown=millis(memory.lastShownAtBySystem?.[context.activeSystem]);
  if(lastSystemShown&&Date.now()-lastSystemShown<SYSTEM_COOLDOWN_MS)return{eligible:false,reason:'system_cooldown'};
  const lastAnyShown=millis(context.lastTimeShown);
  const systemChanged=Boolean(context.previousSystem&&context.previousSystem!==context.activeSystem);
  const sessionEntry=!context.previousSystem&&context.reason==='session_started';
  if(!systemChanged&&!sessionEntry&&lastAnyShown&&Date.now()-lastAnyShown<REENTRY_ELIGIBILITY_MS)return{eligible:false,reason:'recently_shown'};
  return{eligible:true,reason:systemChanged?'system_changed':sessionEntry?'session_started':'eligible_reentry'};
}
function defaultAgentDecision(context,gate){
  if(!gate.eligible)return{action:'suppress',messageVariant:'default',placement:'toast',reason:gate.reason};
  if(gate.reason==='eligible_reentry'&&!context.userInteractionState.interacted)return{action:'suppress',messageVariant:'default',placement:'toast',reason:'awaiting_meaningful_interaction'};
  return{
    action:'show',
    messageVariant:'default',
    placement:gate.reason==='system_changed'||gate.reason==='session_started'?'transition-card':'toast',
    reason:gate.reason
  };
}
function sanitizeDecision(raw,radio,gate){
  const action=raw?.action==='show'?'show':'suppress';
  const requestedCopy=String(raw?.messageVariant||'default');
  const copyId=radio.messages.some(message=>message.id===requestedCopy)?requestedCopy:'default';
  const placement=ALLOWED_PLACEMENTS.has(raw?.placement)?raw.placement:'toast';
  if(!gate.eligible)return Object.freeze({action:'suppress',messageVariant:copyId,placement,reason:gate.reason});
  return Object.freeze({action,messageVariant:copyId,placement,reason:String(raw?.reason||gate.reason).slice(0,80)});
}
async function agentDecision(context){
  const gate=eligibility(context);
  const radio=verifiedRadio(context.activeSystem);
  if(!radio)return Object.freeze({action:'suppress',messageVariant:'default',placement:'toast',reason:'no_approved_playlist'});
  const agentInput=Object.freeze({
    activeSystem:context.activeSystem,
    currentRoute:context.currentRoute,
    previousSystem:context.previousSystem,
    lastPlaylistShown:context.lastPlaylistShown,
    lastTimeShown:context.lastTimeShown,
    dismissalState:context.dismissalState,
    sessionExposureCount:context.sessionExposureCount,
    userInteractionState:context.userInteractionState,
    approvedCopyIds:radio.messages.map(message=>message.id),
    allowedPlacements:[...ALLOWED_PLACEMENTS],
    eligibility:gate
  });
  let raw;
  try{raw=decisionProvider?await decisionProvider(agentInput):defaultAgentDecision(context,gate)}catch{raw={action:'suppress',reason:'agent_error'}}
  return sanitizeDecision(raw,radio,gate);
}
function claimPresentation(context){
  const orchestrator=globalThis.CivweaveExperienceOrchestratorV232;
  if(!orchestrator?.claim)return{ok:true,token:'radio-standalone'};
  return orchestrator.claim('system-radio',{priority:20,ttlMs:20000,context});
}
function releasePresentation(){
  if(!renderToken)return;
  globalThis.CivweaveExperienceOrchestratorV232?.release?.(renderToken);
  renderToken='';
}
function installStyle(){
  if(document.getElementById('cw-radio-style-v232'))return;
  const style=document.createElement('style');
  style.id='cw-radio-style-v232';
  style.textContent=`
#cw-radio-suggestion-v232{position:fixed;z-index:2147482600;right:max(14px,env(safe-area-inset-right));bottom:max(82px,calc(env(safe-area-inset-bottom) + 76px));width:min(360px,calc(100vw - 28px));font:500 14px/1.35 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#f8f8f4;background:color-mix(in srgb,#07162f 92%,transparent);border:1px solid #ffffff2b;border-radius:18px;box-shadow:0 18px 54px #0008;backdrop-filter:blur(16px);padding:16px 48px 16px 16px;animation:cw-radio-in-v232 .24s ease-out}
#cw-radio-suggestion-v232[data-placement="transition-card"]{bottom:50%;transform:translateY(50%)}
#cw-radio-suggestion-v232[data-placement="sidebar"]{top:max(88px,calc(env(safe-area-inset-top) + 72px));bottom:auto}
#cw-radio-suggestion-v232 .cw-radio-eyebrow{display:block;opacity:.82;margin:0 0 3px;font-size:12px;letter-spacing:.02em}
#cw-radio-suggestion-v232 .cw-radio-title{display:block;font-size:18px;margin:0 0 12px}
#cw-radio-suggestion-v232 .cw-radio-link{display:inline-flex;align-items:center;min-height:40px;padding:0 14px;border-radius:999px;background:#f8f8f4;color:#07162f;text-decoration:none;font-weight:800}
#cw-radio-suggestion-v232 .cw-radio-dismiss{position:absolute;right:9px;top:9px;width:34px;height:34px;border:0;border-radius:50%;background:#ffffff12;color:inherit;font-size:20px;cursor:pointer}
@keyframes cw-radio-in-v232{from{opacity:0;translate:0 8px}to{opacity:1;translate:0 0}}
@media(max-width:560px){#cw-radio-suggestion-v232{left:14px;right:14px;width:auto;bottom:max(76px,calc(env(safe-area-inset-bottom) + 70px))}#cw-radio-suggestion-v232[data-placement="transition-card"]{bottom:max(76px,calc(env(safe-area-inset-bottom) + 70px));transform:none}}
@media(prefers-reduced-motion:reduce){#cw-radio-suggestion-v232{animation:none}}
`;
  document.head.append(style);
}
function recordShown(context,decision,radio){
  const session=loadSession();
  session.lastShownSystem=context.activeSystem;
  session.lastShownAt=iso();
  session.shownCount=Number(session.shownCount||0)+1;
  session.exposureBySystem={...(session.exposureBySystem||{}),[context.activeSystem]:Number(session.exposureBySystem?.[context.activeSystem]||0)+1};
  saveSession(session);
  const memory=loadMemory();
  memory.lastShownAtBySystem={...(memory.lastShownAtBySystem||{}),[context.activeSystem]:session.lastShownAt};
  saveMemory(memory);
  const props={system:context.activeSystem,copyVariant:decision.messageVariant,placement:decision.placement,sourceRoute:context.previousSystem?session.previousRoute||'':'',destinationRoute:context.currentRoute};
  emit('RADIO_CTA_SHOWN',{system:context.activeSystem,copyId:decision.messageVariant,placement:decision.placement,reason:decision.reason});
  analytics('radio_impression',props);
  return props;
}
function removeSuggestion(reason='removed'){
  document.getElementById('cw-radio-suggestion-v232')?.remove();
  releasePresentation();
  emit('RADIO_CTA_HIDDEN',{reason});
}
function render(context,decision){
  const radio=verifiedRadio(context.activeSystem);
  if(!radio)return false;
  const copy=approvedCopy(radio,decision.messageVariant);
  removeSuggestion('replace');
  const claim=claimPresentation(context);
  if(!claim.ok){emit('RADIO_CTA_SUPPRESSED',{system:context.activeSystem,reason:claim.reason});return false}
  renderToken=claim.token;
  installStyle();
  const card=document.createElement('aside');
  card.id='cw-radio-suggestion-v232';
  card.dataset.placement=decision.placement;
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
    const session=loadSession();
    session.dismissedThisSession=true;
    saveSession(session);
    emit('RADIO_CTA_DISMISSED',{system:context.activeSystem,copyId:decision.messageVariant,placement:decision.placement});
    analytics('radio_dismiss',{system:context.activeSystem,copyVariant:decision.messageVariant,placement:decision.placement,destinationRoute:context.currentRoute});
    removeSuggestion('dismissed');
  },{once:true});
  document.body.append(card);
  recordShown(context,decision,radio);
  return true;
}
async function evaluate(context=contextSnapshot()){
  const decision=await agentDecision(context);
  if(decision.action!=='show'){
    emit('RADIO_CTA_SUPPRESSED',{system:context.activeSystem,reason:decision.reason});
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
function noteInteraction(event){
  if(event?.target?.closest?.('#cw-radio-suggestion-v232'))return;
  interactionState={...interactionState,interacted:true,lastInteractionAt:iso()};
}
function setCriticalInteraction(critical=true){interactionState={...interactionState,critical:Boolean(critical)};return interactionState.critical}
function start(){
  const system=activeSystem();
  if(!system||!verifiedRadio(system))return false;
  const stored=parse(sessionStorage.getItem(SESSION_KEY),null);
  const session=loadSession();
  const previousSystem=normalizeSystemId(session.activeSystem);
  const previousRoute=session.currentRoute||'';
  const firstSession=!stored?.sessionId;
  const changed=Boolean(previousSystem&&previousSystem!==system);
  session.previousRoute=previousRoute;
  session.activeSystem=system;
  session.currentRoute=currentRoute();
  saveSession(session);
  if(firstSession)emit('SESSION_STARTED',{sessionId:session.sessionId,activeSystem:system,route:session.currentRoute});
  if(changed){
    emit('SYSTEM_CONTEXT_CHANGED',{previousSystem,activeSystem:system,route:session.currentRoute});
    analytics('system_switch',{system,sourceRoute:previousRoute,destinationRoute:session.currentRoute,previousSystem});
  }
  emit('PAGE_NAVIGATED',{previousSystem,activeSystem:system,route:session.currentRoute,previousRoute});
  const reason=changed?'system_changed':firstSession?'session_started':'page_navigated';
  const run=()=>evaluate(contextSnapshot({previousSystem,reason,session:loadSession()})).catch(error=>{
    console.warn('[Civweave Radio] recommendation evaluation failed safely.',error);
    emit('RADIO_CTA_SUPPRESSED',{system,reason:'evaluation_error'});
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,PRESENTATION_DELAY_MS),{once:true});
  else setTimeout(run,PRESENTATION_DELAY_MS);
  return true;
}

document.addEventListener('pointerdown',noteInteraction,{capture:true,passive:true});
document.addEventListener('keydown',noteInteraction,{capture:true});
const api=Object.freeze({
  version:VERSION,revision:REVISION,registry:SYSTEM_RADIO,normalizeSystemId,verifiedRadio,contextSnapshot,eligibility,agentDecision,evaluate,
  registerDecisionProvider,setEnabled,preferences,setCriticalInteraction,start
});
globalThis.CivweaveRadioRecommendationAgentV232=api;
start();
globalThis.dispatchEvent?.(new CustomEvent('civweave:radio-agent-ready',{detail:{version:VERSION,revision:REVISION,systems:Object.keys(SYSTEM_RADIO)}}));
})();
