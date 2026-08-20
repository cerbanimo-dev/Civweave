(()=>{
'use strict';

const VERSION='1.2.0-minilm-decision-strip-guild-neuron-tracker';
const ROOT_ID='cw-persistent-guide-chat-v215';
const STYLE_ID='cw-minilm-decision-strip-v1-style';
const STRIP_ATTR='data-minilm-decision-strip';
const LABEL_ATTR='data-minilm-label';
const TRACKER_ATTR='data-guild-neuron-tracker';
let pendingTimer=0;
let hardTimer=0;
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
#${ROOT_ID} [${STRIP_ATTR}] [${TRACKER_ATTR}]{flex:0 0 auto;max-width:48%;min-width:0;padding-left:8px;border-left:1px solid #ffffff1f;color:#8df0c6;font-weight:850;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#${ROOT_ID} [${STRIP_ATTR}] [${TRACKER_ATTR}][hidden]{display:none!important}
@media(max-width:720px){#${ROOT_ID}{grid-template-rows:auto auto auto auto minmax(0,1fr) auto!important}#${ROOT_ID} [${STRIP_ATTR}]{padding:5px 8px;font-size:9px;gap:5px}#${ROOT_ID} [${STRIP_ATTR}] [${TRACKER_ATTR}]{max-width:54%;padding-left:6px}}
`;
  document.head?.append(style);
}
function floorFinite(value){const n=Number(value);return Number.isFinite(n)&&n>=0?Math.floor(n):null}
function guildSession(){try{return globalThis.CivweaveHostNodeSessionV1?.sessionFor?.()||null}catch{return null}}
function trackerText(){
  const session=guildSession();if(!session)return'';
  let telemetry=null;try{telemetry=globalThis.CivweaveHostNodeSessionV1?.telemetryFor?.(session.nodeId)||globalThis.CivweaveHostNodeSessionV1?.telemetryFor?.()||null}catch{}
  const remaining=floorFinite(telemetry?.remainingNeurons),charged=floorFinite(telemetry?.chargedNeurons),average=Number(telemetry?.averageNeuronsPerTurn);
  let conversations=floorFinite(telemetry?.approximateTurnsLeft);if(conversations===null&&remaining!==null&&Number.isFinite(average)&&average>0)conversations=Math.max(0,Math.floor(remaining/average));
  const neuronText=remaining!==null?`${remaining.toLocaleString()} neurons left`:charged!==null&&charged>0?`${charged.toLocaleString()} neurons last turn`:'neurons syncing';
  const conversationText=conversations!==null?`≈${conversations.toLocaleString()} conversations left`:'conversations syncing';
  return`${neuronText} · ${conversationText}`
}
function ensureStripParts(node){
  let label=node.querySelector(`[${LABEL_ATTR}]`);if(!label){label=node.querySelector('span:not(['+TRACKER_ATTR+'])')||document.createElement('span');label.setAttribute(LABEL_ATTR,'');if(!label.isConnected)node.prepend(label)}
  let tracker=node.querySelector(`[${TRACKER_ATTR}]`);if(!tracker){tracker=document.createElement('span');tracker.setAttribute(TRACKER_ATTR,'');tracker.setAttribute('aria-label','Guild neuron and conversation tracker');tracker.hidden=true;node.append(tracker)}
  return{label,tracker}
}
function renderTracker(node){if(!node)return false;const{tracker}=ensureStripParts(node),text=trackerText(),visible=Boolean(text);if(tracker.textContent!==text)tracker.textContent=text;if(tracker.hidden===visible)tracker.hidden=!visible;node.dataset.guildTelemetry=visible?'visible':'hidden';return visible}
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
function onSubmit(event){
  const form=event.target instanceof HTMLFormElement?event.target:null;if(!form?.matches?.(`#${ROOT_ID} [data-persistent-form]`))return;
  clearTimers();setStatus('MiniLM route · classifying…','pending');
  pendingTimer=setTimeout(()=>setStatus('MiniLM route · classification still in progress…','pending'),2200);
  hardTimer=setTimeout(()=>setStatus('MiniLM route · response router has not emitted a decision','error'),12000)
}
function initialStatus(){if(globalThis.CivweaveResponseRouterV347?.classify)setStatus('MiniLM · ready · awaiting next message','pending');else setStatus('MiniLM · router loading…','pending')}
function install(){installStyle();strip();initialStatus();refreshTracker()}
addEventListener('civweave:response-route',onResponseRoute);
addEventListener('civweave:experience-orchestrator',onOrchestrator);
addEventListener('civweave:minilm-response-router-ready',()=>setStatus('MiniLM · ready · awaiting next message','pending'));
for(const eventName of ['civweave:host-node-session-ready','civweave:capacity-session-ready','civweave:host-node-logged-in','civweave:host-node-health','civweave:ai-neuron-usage','civweave:capacity-session-cleared'])addEventListener(eventName,()=>queueMicrotask(refreshTracker));
addEventListener('submit',onSubmit,true);
addEventListener('pageshow',()=>queueMicrotask(install));
new MutationObserver(()=>strip()).observe(document.documentElement,{childList:true,subtree:true});
install();
globalThis.CivweaveMiniLMDecisionStripV1=Object.freeze({version:VERSION,install,lastDecision:()=>lastDecision,refreshTracker,visibleDecision:true,guildNeuronTracker:true,trackerPlacement:'same-horizontal-strip',actualRouteEventsOnly:true,noPreviewClassification:true,slowRouteWarningMs:2200,missingRouteErrorMs:12000});
})();
