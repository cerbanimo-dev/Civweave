(()=>{
'use strict';

const VERSION='1.1.0-minilm-decision-strip-router-watch';
const ROOT_ID='cw-persistent-guide-chat-v215';
const STYLE_ID='cw-minilm-decision-strip-v1-style';
const STRIP_ATTR='data-minilm-decision-strip';
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
#${ROOT_ID} [${STRIP_ATTR}] span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media(max-width:720px){#${ROOT_ID}{grid-template-rows:auto auto auto auto minmax(0,1fr) auto!important}#${ROOT_ID} [${STRIP_ATTR}]{padding:5px 8px;font-size:9px}}
`;
  document.head?.append(style);
}
function strip(){
  const root=document.getElementById(ROOT_ID);if(!root)return null;
  let node=root.querySelector(`[${STRIP_ATTR}]`);if(node)return node;
  node=document.createElement('div');node.setAttribute(STRIP_ATTR,'');node.setAttribute('role','status');node.setAttribute('aria-live','polite');node.dataset.state='pending';node.innerHTML='<span>MiniLM · router loading…</span>';
  const context=root.querySelector('[data-context]');if(context)root.insertBefore(node,context);else root.append(node);return node
}
function setStatus(text,state='pending'){installStyle();const node=strip();if(!node)return false;node.dataset.state=state;const label=node.querySelector('span')||node;label.textContent=String(text||'');return true}
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
function install(){installStyle();strip();initialStatus()}
addEventListener('civweave:response-route',onResponseRoute);
addEventListener('civweave:experience-orchestrator',onOrchestrator);
addEventListener('civweave:minilm-response-router-ready',()=>setStatus('MiniLM · ready · awaiting next message','pending'));
addEventListener('submit',onSubmit,true);
addEventListener('pageshow',()=>queueMicrotask(install));
new MutationObserver(()=>strip()).observe(document.documentElement,{childList:true,subtree:true});
install();
globalThis.CivweaveMiniLMDecisionStripV1=Object.freeze({version:VERSION,install,lastDecision:()=>lastDecision,visibleDecision:true,actualRouteEventsOnly:true,noPreviewClassification:true,slowRouteWarningMs:2200,missingRouteErrorMs:12000});
})();
