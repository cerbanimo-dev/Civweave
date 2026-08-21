(()=>{
'use strict';

const VERSION='1.3.1-minilm-decision-strip-live-guild-balance';
const ROOT_ID='cw-persistent-guide-chat-v215';
const STYLE_ID='cw-minilm-decision-strip-v1-style';
const STRIP_ATTR='data-minilm-decision-strip';
const LABEL_ATTR='data-minilm-label';
const TRACKER_ATTR='data-guild-neuron-tracker';
const MOBILE_GUILD_STATE_KEY='civweave.mobile-guild.v1';
const CAPACITY_SESSION_KEY='civweave.host-capacity.sessions.v1';
const MINILM_ROUTER_SRC='/app/minilm-response-router-v347.js?v=1.3.0-minilm-primary';
const SERVER_ROUTER_SRC='/app/server-ai-router-v301.js?v=1.0.121-guild-telemetry';
const HOST_SESSION_SRC='/app/host-node-session-v1.js?v=1.0.137-mobile-guild-quota';
const GUILD_USAGE_SRC='/app/guild-chat-usage-v1.js?v=1.0.2-mobile-session-upgrade';
let pendingTimer=0;
let hardTimer=0;
let readinessTimer=0;
let trackerTimer=0;
let usageRefreshPromise=null;
let usageRefreshAt=0;
let lastDecision=null;

function clearTimers(){clearTimeout(pendingTimer);clearTimeout(hardTimer);pendingTimer=0;hardTimer=0}
function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
#${ROOT_ID}{grid-template-rows:auto auto auto auto minmax(0,1fr) auto!important}
#${ROOT_ID} [${STRIP_ATTR}]{display:flex;align-items:center;gap:7px;min-width:0;padding:6px 10px;border-bottom:1px solid #ffffff12;background:#020814;color:#aebfd3;font:750 10px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.01em}
#${ROOT_ID} [${STRIP_ATTR}]::before{content:'';flex:0 0 auto;width:7px;height:7px;border-radius:50%;background:#7b8797;box-shadow:0 0 8px #7b879788}
#${ROOT_ID} [${STRIP_ATTR}][data-state="pending"]::before{background:#e7bd5d;box-shadow:0 0 9px #e7bd5daa}
#${ROOT_ID} [${STRIP_ATTR}][data-state="minilm"]::before{background:#6bd6a0;box-shadow:0 0 9px #6bd6a0aa}
#${ROOT_ID} [${STRIP_ATTR}][data-state="fallback"]::before{background:#e3a35c;box-shadow:0 0 9px #e3a35caa}
#${ROOT_ID} [${STRIP_ATTR}][data-state="error"]::before{background:#ff6b7a;box-shadow:0 0 9px #ff6b7aaa}
#${ROOT_ID} [${STRIP_ATTR}] [${LABEL_ATTR}]{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#${ROOT_ID} [${STRIP_ATTR}] [${TRACKER_ATTR}]{flex:0 0 auto;max-width:52%;min-width:0;padding-left:8px;border-left:1px solid #ffffff1f;color:#8df0c6;font-weight:850;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#${ROOT_ID} [${STRIP_ATTR}] [${TRACKER_ATTR}][hidden]{display:none!important}
@media(max-width:720px){#${ROOT_ID}{grid-template-rows:auto auto auto auto minmax(0,1fr) auto!important}#${ROOT_ID} [${STRIP_ATTR}]{padding:5px 8px;font-size:9px;gap:5px}#${ROOT_ID} [${STRIP_ATTR}] [${TRACKER_ATTR}]{max-width:58%;padding-left:6px}}
`;
  document.head?.append(style);
}
function parse(value,fallback=null){try{return JSON.parse(value)??fallback}catch{return fallback}}
function floorFinite(value){const n=Number(value);return Number.isFinite(n)&&n>=0?Math.floor(n):null}
function mobileGuildState(){try{const value=parse(localStorage.getItem(MOBILE_GUILD_STATE_KEY),null);return value&&typeof value==='object'&&!Array.isArray(value)?value:null}catch{return null}}
function hostSession(){try{return globalThis.CivweaveHostNodeSessionV1?.sessionFor?.()||null}catch{return null}}
function hostPublicSession(){
  try{
    const api=globalThis.CivweaveHostNodeSessionV1,status=api?.publicStatus?.(),selected=api?.selectedOrigin?.()||'',sessions=Array.isArray(status?.sessions)?status.sessions:[];
    return sessions.find(row=>row?.active&&selected&&row.origin===selected)||sessions.find(row=>row?.active)||null;
  }catch{return null}
}
function mobileGuildSession(){try{return globalThis.CivweaveServerAIRouterV301?.mobileGuildCapacitySession?.()||null}catch{return null}}
function joinedCapacitySession(){
  const canonical=hostPublicSession();if(canonical?.nodeId)return canonical;
  try{
    const rows=parse(sessionStorage.getItem(CAPACITY_SESSION_KEY),'{}'),values=Object.values(rows&&typeof rows==='object'&&!Array.isArray(rows)?rows:{}),preferred=String(document.documentElement?.dataset?.civweaveNodeId||'');
    const active=values.filter(row=>row?.nodeId&&row?.token&&row?.origin&&(!row.expiresAt||Date.parse(row.expiresAt)>Date.now()));
    return active.find(row=>preferred&&String(row.nodeId)===preferred)||active[0]||null;
  }catch{return null}
}
function guildContext(){
  const host=hostSession();if(host?.nodeId)return{kind:'host-session',nodeId:String(host.nodeId||''),guildId:String(host.guildId||''),session:host};
  const joined=joinedCapacitySession();if(joined?.nodeId)return{kind:'joined-guild-capacity',nodeId:String(joined.nodeId||''),guildId:String(joined.guildId||''),session:joined};
  const mobile=mobileGuildSession();if(mobile?.nodeId||mobile?.guildId)return{kind:'mobile-guild-capacity',nodeId:String(mobile.nodeId||''),guildId:String(mobile.guildId||''),session:mobile};
  const state=mobileGuildState();if(state?.guildId)return{kind:'mobile-guild-state',nodeId:String(state?.cloudFabric?.starterNodes?.[0]?.nodeId||''),guildId:String(state.guildId),session:null};
  const nodeId=String(document.documentElement?.dataset?.civweaveNodeId||''),origin=String(document.documentElement?.dataset?.civweaveGuildOrigin||'');
  if(nodeId)return{kind:'human-chat-guild-context',nodeId,guildId:'',session:{nodeId,origin}};
  return null;
}
function sharedUsageSnapshot(){
  try{
    const value=globalThis.CivweaveGuildChatUsageV1?.snapshot?.();
    if(value?.known)return{remainingNeurons:value.remainingNeurons,approximateTurnsLeft:value.approximateTurnsLeft,averageNeuronsPerTurn:null,source:value.source||'guild-chat-usage'};
  }catch{}
  return null;
}
function exactPathScript(src){const path=new URL(src,location.href).pathname;return[...document.scripts].find(script=>{try{return new URL(script.src,location.href).pathname===path}catch{return false}})||null}
function ensureBalanceRuntime(){
  const hostVersion=String(globalThis.CivweaveHostNodeSessionV1?.version||'');
  if(!hostVersion.startsWith('1.0.137-')){
    const prior=exactPathScript(HOST_SESSION_SRC);if(!prior||prior.dataset.civweaveBalanceRepair!=='true'){const script=document.createElement('script');script.src=`${HOST_SESSION_SRC}&repair=${Date.now()}`;script.async=false;script.dataset.civweaveBalanceRepair='true';document.head?.append(script)}
  }
  const usageVersion=String(globalThis.CivweaveGuildChatUsageV1?.version||'');
  if(!usageVersion.startsWith('1.0.2-')){
    const prior=exactPathScript(GUILD_USAGE_SRC);if(!prior||prior.dataset.civweaveBalanceRepair!=='true'){const script=document.createElement('script');script.src=`${GUILD_USAGE_SRC}&repair=${Date.now()}`;script.async=false;script.dataset.civweaveBalanceRepair='true';document.head?.append(script)}
  }
}
function requestGuildUsageRefresh({force=false}={}){
  ensureBalanceRuntime();
  const api=globalThis.CivweaveGuildChatUsageV1;
  if(!api?.refresh)return null;
  const now=Date.now();if(usageRefreshPromise||(!force&&now-usageRefreshAt<15000))return usageRefreshPromise;
  usageRefreshAt=now;
  usageRefreshPromise=Promise.resolve(api.refresh({network:true})).catch(()=>null).finally(()=>{usageRefreshPromise=null;queueMicrotask(refreshTracker)});
  return usageRefreshPromise;
}
function trackerTelemetry(context){
  if(!context)return null;
  const shared=sharedUsageSnapshot();if(shared)return shared;
  if(context.session?.telemetry)return context.session.telemetry;
  if(['host-session','joined-guild-capacity','human-chat-guild-context'].includes(context.kind)){
    try{const telemetry=globalThis.CivweaveHostNodeSessionV1?.telemetryFor?.(context.nodeId)||globalThis.CivweaveHostNodeSessionV1?.telemetryFor?.();if(telemetry)return telemetry}catch{}
  }
  try{return globalThis.CivweaveServerAIRouterV301?.guildTelemetry?.(context.guildId||context.nodeId)||globalThis.CivweaveServerAIRouterV301?.guildTelemetry?.()||null}catch{return null}
}
function trackerText(){
  const context=guildContext();if(!context)return'';
  const telemetry=trackerTelemetry(context),remaining=floorFinite(telemetry?.remainingNeurons),charged=floorFinite(telemetry?.chargedNeurons),average=Number(telemetry?.averageNeuronsPerTurn);
  let conversations=floorFinite(telemetry?.approximateTurnsLeft);if(conversations===null&&remaining!==null&&Number.isFinite(average)&&average>0)conversations=Math.max(0,Math.floor(remaining/average));
  if(remaining===null||conversations===null)requestGuildUsageRefresh();
  const neuronText=remaining!==null?`${remaining.toLocaleString()} neurons left`:charged!==null&&charged>0?`${charged.toLocaleString()} neurons last turn`:'neurons syncing';
  const conversationText=conversations!==null?`≈${conversations.toLocaleString()} conversations left`:'conversations syncing';
  return`${neuronText} · ${conversationText}`;
}
function ensureStripParts(node){
  let label=node.querySelector(`[${LABEL_ATTR}]`);if(!label){label=node.querySelector('span:not(['+TRACKER_ATTR+'])')||document.createElement('span');label.setAttribute(LABEL_ATTR,'');if(!label.isConnected)node.prepend(label)}
  let tracker=node.querySelector(`[${TRACKER_ATTR}]`);if(!tracker){tracker=document.createElement('span');tracker.setAttribute(TRACKER_ATTR,'');tracker.setAttribute('aria-label','Guild neuron and conversation tracker');tracker.hidden=true;node.append(tracker)}
  return{label,tracker}
}
function renderTracker(node){if(!node)return false;const{tracker}=ensureStripParts(node),text=trackerText(),visible=Boolean(text);if(tracker.textContent!==text)tracker.textContent=text;if(tracker.hidden===visible)tracker.hidden=!visible;node.dataset.guildTelemetry=visible?'visible':'hidden';node.dataset.guildContext=guildContext()?.kind||'none';return visible}
function strip(){
  const root=document.getElementById(ROOT_ID);if(!root)return null;
  let node=root.querySelector(`[${STRIP_ATTR}]`);if(node){ensureStripParts(node);renderTracker(node);return node}
  node=document.createElement('div');node.setAttribute(STRIP_ATTR,'');node.setAttribute('role','status');node.setAttribute('aria-live','polite');node.dataset.state='pending';node.innerHTML=`<span ${LABEL_ATTR}>MiniLM · router loading…</span><span ${TRACKER_ATTR} aria-label="Guild neuron and conversation tracker" hidden></span>`;
  const context=root.querySelector('[data-context]');if(context)root.insertBefore(node,context);else root.append(node);renderTracker(node);return node
}
function refreshTracker(){const node=document.getElementById(ROOT_ID)?.querySelector(`[${STRIP_ATTR}]`)||strip();return renderTracker(node)}
function setStatus(text,state='pending'){installStyle();const node=strip();if(!node)return false;node.dataset.state=state;const{label}=ensureStripParts(node);label.textContent=String(text||'');renderTracker(node);return true}
function pct(value){const n=Number(value);return Number.isFinite(n)?`${Math.round(n*100)}%`:''}
function sourceKind(source=''){const value=String(source||'').toLowerCase();if(value.startsWith('minilm'))return'minilm';if(value.includes('deterministic')||value.includes('fallback'))return'fallback';if(value.startsWith('declared')||value.startsWith('explicit'))return'minilm';return'minilm'}
function decisionText(route={}){
  const source=String(route.source||route.routeSource||'unknown'),task=String(route.taskClass||'unknown'),artifact=route.artifactClass?` · ${route.artifactClass}`:'',length=route.lengthClass?` · ${route.lengthClass}`:'',network=route.networkRequired?' · network required':' · network optional',confidence=pct(route.confidence),confidenceText=confidence?` · confidence ${confidence}`:'',semantic=route.semantic&&Number.isFinite(Number(route.semantic.score))?` · semantic ${Number(route.semantic.score).toFixed(3)} / margin ${Number(route.semantic.margin||0).toFixed(3)}`:'',fallback=route.semanticFallback?` · MiniLM ${route.semanticFallback}`:'';
  return`MiniLM route · ${task}${artifact}${length}${network}${confidenceText}${semantic} · source ${source}${fallback}`
}
function publish(route={}){clearTimers();lastDecision={...route,at:new Date().toISOString()};setStatus(decisionText(route),sourceKind(route.source||route.routeSource));try{dispatchEvent(new CustomEvent('civweave:minilm-decision-visible',{detail:{version:VERSION,...lastDecision}}))}catch{}}
function onResponseRoute(event){if(event?.detail)publish(event.detail)}
function onOrchestrator(event){
  const detail=event?.detail||{};
  if(detail.type==='MINILM_ROUTE_FAILED'){clearTimers();setStatus(`MiniLM route · failed · ${String(detail.message||'classifier unavailable')}`,'error');return}
  if(detail.type==='MINILM_LOCAL_FAST_PATH'||detail.type==='MINILM_CANONICAL_ROUTE')publish({taskClass:detail.taskClass,artifactClass:detail.artifactClass||null,networkRequired:Boolean(detail.networkRequired),lengthClass:detail.lengthClass,source:detail.routeSource||'minilm-orchestrator'})
}
function exactScript(src){const target=new URL(src,location.href).href;return[...document.scripts].find(script=>{try{return new URL(script.src,location.href).href===target}catch{return false}})||null}
function appendScript(src,marker){const script=document.createElement('script');script.src=src;script.async=false;script.dataset[marker]='true';document.head?.append(script);return script}
function ensureMiniLMRouter(){if(globalThis.CivweaveResponseRouterV347?.classify)return true;if(!exactScript(MINILM_ROUTER_SRC))appendScript(MINILM_ROUTER_SRC,'civweaveMiniLMRouterRepair');return false}
function currentServerRouter(){return globalThis.CivweaveServerAIRouterV301}
function serverRouterCurrent(){return String(currentServerRouter()?.version||'').startsWith('1.0.121-')}
function ensureServerRouter(){if(serverRouterCurrent())return true;const exact=exactScript(SERVER_ROUTER_SRC);if(!exact)appendScript(SERVER_ROUTER_SRC,'civweaveServerRouterRepair');else if(exact.dataset.civweaveRepairRetried!=='true'){exact.dataset.civweaveRepairRetried='true';setTimeout(()=>{if(!serverRouterCurrent())appendScript(`${SERVER_ROUTER_SRC}&repair=1`,'civweaveServerRouterRepair')},700)}return false}
function watchReadiness(){
  clearInterval(readinessTimer);let attempts=0;readinessTimer=setInterval(()=>{attempts+=1;ensureServerRouter();if(ensureMiniLMRouter()){clearInterval(readinessTimer);readinessTimer=0;const node=strip();if(node?.dataset.state==='pending'&&node.querySelector(`[${LABEL_ATTR}]`)?.textContent?.includes('router loading'))setStatus('MiniLM · ready · awaiting next message','pending');return}if(attempts>=40){clearInterval(readinessTimer);readinessTimer=0;setStatus('MiniLM · router unavailable','error')}},250)
}
function onSubmit(event){
  const form=event.target instanceof HTMLFormElement?event.target:null;if(!form?.matches?.(`#${ROOT_ID} [data-persistent-form]`))return;
  clearTimers();setStatus('MiniLM route · classifying…','pending');
  pendingTimer=setTimeout(()=>setStatus('MiniLM route · classification still in progress…','pending'),2200);
  hardTimer=setTimeout(()=>setStatus('MiniLM route · response router has not emitted a decision','error'),12000)
}
function initialStatus(){ensureServerRouter();if(ensureMiniLMRouter())setStatus('MiniLM · ready · awaiting next message','pending');else{setStatus('MiniLM · router loading…','pending');watchReadiness()}}
function install(){installStyle();ensureBalanceRuntime();strip();initialStatus();refreshTracker();requestGuildUsageRefresh({force:true});if(!trackerTimer)trackerTimer=setInterval(refreshTracker,1500)}
addEventListener('civweave:response-route',onResponseRoute);
addEventListener('civweave:experience-orchestrator',onOrchestrator);
addEventListener('civweave:minilm-response-router-ready',()=>{if(readinessTimer){clearInterval(readinessTimer);readinessTimer=0}setStatus('MiniLM · ready · awaiting next message','pending')});
for(const eventName of ['civweave:host-node-session-ready','civweave:capacity-session-ready','civweave:host-node-logged-in','civweave:host-node-health','civweave:ai-neuron-usage','civweave:guild-ai-telemetry','civweave:guild-chat-usage-refreshed','civweave:capacity-session-cleared','civweave:host-node-selected','civweave:legacy-mobile-guild-selected','civweave:mobile-guild-attached','civweave:mobile-guild-fabric-refreshed','civweave:mobile-guild-directory-registered','civweave:human-chat-guild-context'])addEventListener(eventName,()=>{queueMicrotask(refreshTracker);if(eventName==='civweave:host-node-selected'||eventName==='civweave:legacy-mobile-guild-selected'||eventName==='civweave:host-node-session-ready')requestGuildUsageRefresh({force:true})});
addEventListener('submit',onSubmit,true);
addEventListener('pageshow',()=>queueMicrotask(install));
addEventListener('pagehide',()=>{clearTimers();if(readinessTimer)clearInterval(readinessTimer);if(trackerTimer)clearInterval(trackerTimer);readinessTimer=0;trackerTimer=0},{once:true});
new MutationObserver(()=>strip()).observe(document.documentElement,{childList:true,subtree:true});
install();
globalThis.CivweaveMiniLMDecisionStripV1=Object.freeze({version:VERSION,install,lastDecision:()=>lastDecision,refreshTracker,guildContext,requestGuildUsageRefresh,visibleDecision:true,guildNeuronTracker:true,trackerPlacement:'same-horizontal-strip',guildResolver:'host-or-joined-or-mobile-capacity-or-human-context',guildTelemetry:'live-guild-usage-or-host-session-or-server-router',routerSelfHeal:true,balanceRuntimeSelfHeal:true,serverRouterVersion:'1.0.121',hostSessionVersion:'1.0.137',guildUsageVersion:'1.0.2',actualRouteEventsOnly:true,noPreviewClassification:true,slowRouteWarningMs:2200,missingRouteErrorMs:12000});
})();
