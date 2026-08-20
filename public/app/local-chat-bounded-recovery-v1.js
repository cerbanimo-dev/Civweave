(()=>{
'use strict';

const VERSION='1.0.0-local-chat-bounded-recovery-v1';
const KEY='CivweaveLocalChatRuntimeV295';
const SEL='civweave.local-ai.selection.v266';
const PROFILES='civweave-model-profiles-v1';
const LEGACY='civweave.universal-ai.v127';
const HEALTH='civweave.local-ai.health.v286';
const GEMMA4_IDS=new Set(['gemma4-e2b-it-q2f16-mobile','gemma4-e4b-it-q2f16-mobile']);
const RECOVERY_IDS=Object.freeze([
  'smollm2-360m-instruct-q4f16',
  'qwen3-0.6b-q4f16',
  'gemma3-1b-it-q4f16',
  'qwen3-1.7b-q4f16'
]);

const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
const clean=(value,max=240)=>String(value??'').trim().slice(0,max);

function selected(){
  try{const live=globalThis.CivweaveLocalModelDownloadV266?.selection?.();if(live?.active&&live.id)return live}catch{}
  const saved=parse(localStorage.getItem(SEL),{});
  return saved?.active&&saved.id?saved:null;
}
function configuredModel(){
  try{
    const shared=globalThis.CivweaveModelRuntime?.readSharedConfig?.('interactive');
    const value=shared&&typeof shared==='object'?shared:null;
    if(value)return clean(value.model||value.selectedLocalModel||'',240);
  }catch{}
  const profiles=parse(localStorage.getItem(PROFILES),{});
  const profile=profiles?.interactive&&typeof profiles.interactive==='object'?profiles.interactive:null;
  if(profile)return clean(profile.model||profile.selectedLocalModel||'',240);
  const legacy=parse(localStorage.getItem(LEGACY),{});
  return clean(legacy?.model||legacy?.selectedLocalModel||'',240);
}
function health(id){
  try{return parse(localStorage.getItem(HEALTH),{})?.[id]||{}}catch{return{}}
}
function healthScore(spec){
  const row=health(spec?.id),metrics=row?.metrics||{},ok=row?.ok===true?1:0,tps=Math.max(0,Number(metrics.tokensPerSecond||metrics.benchmarkTokensPerSecond||0));
  return{ok,tps,bytes:Math.max(0,Number(spec?.estimatedBytes||0))};
}
function recoveryCandidates(registry,pick){
  const rows=RECOVERY_IDS.map(id=>registry?.byId?.(id)).filter(spec=>spec&&spec.id!==pick?.id&&spec.device==='webgpu');
  return rows.sort((a,b)=>{
    const A=healthScore(a),B=healthScore(b);
    if(A.ok!==B.ok)return B.ok-A.ok;
    if(A.ok&&B.ok&&A.tps!==B.tps)return B.tps-A.tps;
    return A.bytes-B.bytes;
  });
}
function recoveryContext(pick){
  const requested=configuredModel();
  return{requested,recovering:Boolean(GEMMA4_IDS.has(requested)&&pick?.id&&pick.id!==requested)};
}
function setDecisionStrip(text,state='local'){
  try{
    const node=document.querySelector?.('#cw-persistent-guide-chat-v215 [data-minilm-decision-strip]');
    if(!node)return;
    node.dataset.state=state;
    const label=node.querySelector?.('span')||node;
    label.textContent=text;
  }catch{}
}
function emit(type,detail={}){
  try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,at:new Date().toISOString(),...detail}}))}catch{}
}
function patchRegistryForRecovery(registry,pick,recovering){
  if(!recovering||!registry?.fallbacks||!registry?.byId)return{registry,patched:null};
  const ordered=recoveryCandidates(registry,pick);
  if(!ordered.length)return{registry,patched:null};
  const originalFallbacks=registry.fallbacks.bind(registry);
  const fallbacks=modelOrId=>{
    const model=typeof modelOrId==='string'?registry.byId(modelOrId):modelOrId;
    if(model?.id===pick.id)return ordered;
    return originalFallbacks(modelOrId)||[];
  };
  const patched=Object.freeze({...registry,fallbacks,__civweaveBoundedRecoveryV1:true});
  try{globalThis.CivweaveLocalModelRegistryV266=patched}catch{return{registry,patched:null}}
  return{registry,patched};
}
function restoreRegistry(original,patched){
  if(!patched)return;
  try{if(globalThis.CivweaveLocalModelRegistryV266===patched)globalThis.CivweaveLocalModelRegistryV266=original}catch{}
}
function stageLimit(phase){
  const p=String(phase||'');
  if(p==='loading-model')return 270000;
  if(p==='loading-tokenizer'||p==='warming-model'||p==='benchmarking-model')return 150000;
  if(p.includes('download')||p==='backend-fallback'||p==='backend-quarantined'||p==='tier-fallback')return 330000;
  if(p==='generating'||p==='preparing-prompt')return 150000;
  return 180000;
}
function attemptBudget(spec,recovering,requested){
  if(Number(requested)>0)return Math.round(clamp(requested,60000,300000));
  if(recovering)return 120000;
  const healthTimeout=Math.max(0,Number(spec?.healthTimeoutMs||0));
  return Math.round(clamp(healthTimeout||180000,120000,300000));
}
function totalBudget(attemptMs,recovering,requested){
  if(Number(requested)>0)return Math.round(clamp(requested,attemptMs+30000,600000));
  return recovering?300000:Math.round(clamp(attemptMs*2,attemptMs+60000,600000));
}
function coreGenerate(base){
  return async function generate({systemPrompt,messages=[],onToken,onProgress,timeoutMs,totalTimeoutMs,maxNewTokens,promptTokenBudget}={}){
    const pick=selected();
    if(!pick)throw Object.assign(new Error('No downloaded local model is selected.'),{code:'LOCAL_MODEL_NOT_SELECTED'});
    await base.ready?.(onProgress);
    const runtime=globalThis.CivweaveLocalModelRuntimeV266;
    const registry=globalThis.CivweaveLocalModelRegistryV266;
    if(!runtime?.generate||!registry?.byId)throw Object.assign(new Error('The inference core is not ready for bounded local recovery.'),{code:'LOCAL_INFERENCE_CORE_UNAVAILABLE'});
    const spec=registry.byId(pick.id)||runtime.activeSpec?.()||{};
    const context=recoveryContext(pick);
    const attemptMs=attemptBudget(spec,context.recovering,timeoutMs);
    const totalMs=totalBudget(attemptMs,context.recovering,totalTimeoutMs);
    const b=base.budget?.(pick.id)||{};
    const registryPatch=patchRegistryForRecovery(registry,pick,context.recovering);
    let idleTimer=0,hardTimer=0,watchReject=null,lastPhase='starting';
    const arm=phase=>{
      lastPhase=String(phase||lastPhase||'working');
      clearTimeout(idleTimer);
      const wait=stageLimit(lastPhase);
      idleTimer=setTimeout(()=>{
        const error=Object.assign(new Error(`Local model stopped because ${lastPhase} made no progress for ${Math.round(wait/1000)} seconds.`),{code:'LOCAL_CHAT_STAGE_STALLED',phase:lastPhase,model:pick.id,requestedModel:context.requested||pick.id});
        watchReject?.(error);
        queueMicrotask(()=>{try{runtime.shutdown?.({reason:'chat-stage-stalled'})}catch{}});
      },wait);
    };
    const progress=value=>{
      const phase=value?.phase||lastPhase;
      arm(phase);
      const actual=clean(value?.model||value?.executionModel||pick.id,240)||pick.id;
      if(context.recovering&&['tier-fallback','backend-fallback','worker-released'].includes(String(phase))){
        setDecisionStrip(`Local route · ${actual} · recovering locally from ${context.requested}`,'local');
      }
      try{onProgress?.({...value,watchdogMs:stageLimit(phase),attemptTimeoutMs:attemptMs,totalTimeoutMs:totalMs,boundedLocalRecovery:true,requestedModel:context.requested||pick.id})}catch{}
    };
    const token=value=>{arm('generating');try{onToken?.(value)}catch{}};
    const watchdog=new Promise((_,reject)=>{watchReject=reject;arm('starting')});
    const request=runtime.generate({
      messages:[{role:'system',content:String(systemPrompt||'')},...(Array.isArray(messages)?messages:[])],
      maxNewTokens:Number(maxNewTokens)||Number(b.maxNewTokens)||64,
      promptTokenBudget:Number(promptTokenBudget)||Math.min(1024,Math.max(640,Number(spec.workingContextTokens||1024))),
      temperature:spec.generation?.nonThinkingTemperature??.7,
      thinking:false,
      timeoutMs:attemptMs,
      stream:true,
      executionProfile:'interactive',
      onToken:token,
      onProgress:progress
    });
    const hardTimeout=new Promise((_,reject)=>{
      hardTimer=setTimeout(()=>{
        const error=Object.assign(new Error(`Local recovery exhausted its ${Math.round(totalMs/1000)} second on-device budget while ${lastPhase}.`),{code:'LOCAL_CHAT_TOTAL_TIMEOUT',phase:lastPhase,model:pick.id,requestedModel:context.requested||pick.id,totalTimeoutMs:totalMs});
        reject(error);
        queueMicrotask(()=>{try{runtime.shutdown?.({reason:'chat-total-timeout'})}catch{}});
      },totalMs);
    });
    if(context.recovering){
      emit('civweave:local-bounded-recovery-start',{requestedModel:context.requested,model:pick.id,attemptTimeoutMs:attemptMs,totalTimeoutMs:totalMs,candidates:recoveryCandidates(registry,pick).map(row=>row.id)});
    }
    try{
      const result=await Promise.race([request,watchdog,hardTimeout]);
      if(context.recovering)emit('civweave:local-bounded-recovery-complete',{requestedModel:context.requested,model:result?.executionId||result?.id||pick.id,fallbackChain:result?.fallbackChain||[]});
      return result;
    }catch(error){
      if(['LOCAL_CHAT_STAGE_STALLED','LOCAL_CHAT_TOTAL_TIMEOUT'].includes(error?.code)){
        try{runtime.shutdown?.({reason:error.code})}catch{}
      }
      throw error;
    }finally{
      clearTimeout(idleTimer);
      clearTimeout(hardTimer);
      watchReject=null;
      restoreRegistry(registryPatch.registry,registryPatch.patched);
    }
  };
}
function wrap(runtime){
  if(!runtime||typeof runtime!=='object')return runtime;
  if(runtime.__civweaveBoundedRecoveryV1)return runtime;
  if(typeof runtime.generate!=='function'||typeof runtime.ready!=='function')return runtime;
  const wrapped=Object.freeze({...runtime,generate:coreGenerate(runtime),__civweaveBoundedRecoveryV1:true,boundedFallbackRecovery:true,stallReasonPreserved:true,fifteenMinuteChatFloorRetired:true,localRecoveryAttemptMaxMs:300000,localRecoveryTotalMaxMs:600000});
  emit('civweave:local-chat-bounded-recovery-installed',{revision:runtime.revision||'',runtimeVersion:runtime.version||''});
  return wrapped;
}
function installWatcher(){
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,KEY);
  if(descriptor&&!descriptor.configurable){
    try{globalThis[KEY]=wrap(globalThis[KEY])}catch{}
    return Boolean(globalThis[KEY]?.__civweaveBoundedRecoveryV1);
  }
  let value=wrap(globalThis[KEY]);
  try{
    Object.defineProperty(globalThis,KEY,{configurable:true,enumerable:true,get(){return value},set(next){value=wrap(next)}});
    return true;
  }catch{
    try{globalThis[KEY]=wrap(globalThis[KEY])}catch{}
    return Boolean(globalThis[KEY]?.__civweaveBoundedRecoveryV1);
  }
}

installWatcher();
for(const name of ['pageshow','civweave:local-model-runtime-ready','civweave:local-ai-ready','civweave:assistant-runtime-ready'])addEventListener(name,()=>queueMicrotask(installWatcher));

globalThis.CivweaveLocalChatBoundedRecoveryV1=Object.freeze({version:VERSION,wrap,installWatcher,boundedFallbackRecovery:true,stallReasonPreserved:true,fifteenMinuteChatFloorRetired:true,localOnly:true});
})();
