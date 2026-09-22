(()=>{
'use strict';
const VERSION='1.0.0-living-school-provider-run-bridge-v1';
const MODEL_EVENT='civweave:model-event';
const RAIL_ID='lsc-living-school-generation-run-rail';
let queued=false;
let lastProvider='';
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
const isLivingSchoolPurpose=value=>/^living-school-/.test(clean(value,220).toLowerCase());
const ui=()=>globalThis.CivweaveLivingSchoolActiveRunUIV1||null;
function generationActive(){
  const root=document.documentElement,session=ui()?.session;
  return root.dataset.livingSchoolGenerationActive==='true'||root.dataset.livingSchoolRunRailActive==='true'||session?.status==='running';
}
function providerLabel(value){
  const provider=clean(value,120).toLowerCase();
  if(provider==='cloudflare-workers-ai'||provider==='workers-ai')return'Cloudflare Workers AI';
  if(provider==='hosted')return'Cloud inference';
  if(provider==='openai-compatible')return'OpenAI-compatible';
  if(provider==='ollama')return'Ollama';
  if(provider==='browser')return'Browser model';
  return clean(value,120)||'Selected provider';
}
function eventTime(value){
  const parsed=Date.parse(clean(value,120));
  return Number.isFinite(parsed)?parsed:Date.now();
}
function routeTier(detail){
  const phase=clean(detail?.phase,80).toLowerCase(),reason=clean(detail?.reason,180).toLowerCase();
  if(phase==='repairing'&&reason.includes('fallback'))return'fallback';
  return clean(detail?.executionProfile,80).toLowerCase()==='agentic'?'complex':'small';
}
function scheduleUiSync(){
  if(queued)return;
  queued=true;
  queueMicrotask(()=>{
    queued=false;
    const bridgeUi=ui(),session=bridgeUi?.session,rail=document.getElementById(RAIL_ID);
    if(!rail||!session)return;
    if(session.status==='ended'&&!session.stage&&!(session.runs||[]).length){
      rail.hidden=true;
      document.documentElement.dataset.livingSchoolRunSuppressed='preflight-validation';
      return;
    }
    delete document.documentElement.dataset.livingSchoolRunSuppressed;
    if(!lastProvider)return;
    const legend=rail.querySelector('.lsc-run-legend');
    if(!legend)return;
    legend.replaceChildren();
    const provider=document.createElement('span');provider.textContent=`Provider: ${providerLabel(lastProvider)}`;
    const dots=document.createElement('span');dots.textContent='Dots = model calls';
    legend.append(provider,dots);
  });
}
function onModelEvent(event){
  const detail=event?.detail||{},provider=clean(detail.provider,120).toLowerCase(),purpose=clean(detail.purpose,220),phase=clean(detail.phase,80).toLowerCase(),requestId=clean(detail.requestId,180);
  if(!requestId||provider==='gemini'||!isLivingSchoolPurpose(purpose)||!generationActive())return;
  const bridgeUi=ui();if(!bridgeUi)return;
  lastProvider=provider||lastProvider;
  const terminal=['completed','failed','cancelled'].includes(phase);
  if(terminal){
    const status=phase==='completed'?clean(detail.status,80)||'success':phase==='cancelled'?'cancelled':clean(detail.status,80)||'provider-error';
    bridgeUi.onRouteCompleted?.({detail:{callId:requestId,status,errorCode:clean(detail.error?.code||detail.errorCode,160),completedAtMs:eventTime(detail.at)}});
    scheduleUiSync();
    return;
  }
  if(!['generating','connecting','background','validating','repairing','partial'].includes(phase))return;
  bridgeUi.onRouteSelected?.({detail:{callId:requestId,tier:routeTier(detail),model:clean(detail.model,180)||providerLabel(provider),provider,purpose,reason:`${providerLabel(provider)} runtime`,startedAtMs:eventTime(detail.at),at:clean(detail.at,120)}});
  scheduleUiSync();
}
function install(){
  if(globalThis.CivweaveLivingSchoolProviderRunBridgeV1?.version===VERSION)return;
  addEventListener(MODEL_EVENT,onModelEvent);
  const observer=new MutationObserver(scheduleUiSync);
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-busy','disabled','hidden']});
  globalThis.CivweaveLivingSchoolProviderRunBridgeV1=Object.freeze({version:VERSION,onModelEvent,scheduleUiSync,providerLabel});
  scheduleUiSync();
}
if(document.readyState==='loading')addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
