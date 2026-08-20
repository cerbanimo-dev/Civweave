(()=>{
'use strict';

const VERSION='1.0.117-local-chat-runtime-v305-mobile-bootstrap-recovery';
const REVISION='v312-runtime-first-bootstrap';
const SEL='civweave.local-ai.selection.v266';
const HEALTH='civweave.local-ai.health.v286';
const BOOT='/app/local-ai/bootstrap-v266.js?v=1.0.130-v325-inference-core-first';
const BOOT_REVISION='1.0.115-local-ai-bootstrap-v302-session-handoff';
const CORE_LOAD_TIMEOUT_MS=18000;
const BOOT_READY_TIMEOUT_MS=45000;
const CORE=Object.freeze([
  Object.freeze({
    name:'CivweaveLocalModelRegistryV266',
    src:'/app/local-ai/model-registry-v266.js?v=1.0.121-v307-gemma3-q4&chatcore=v325',
    ready:()=>Boolean(globalThis.CivweaveLocalModelRegistryV266?.byId&&globalThis.CivweaveLocalModelRegistryV266?.installable&&globalThis.CivweaveLocalModelRegistryV266?.directUrl)
  }),
  Object.freeze({
    name:'CivweaveLocalModelDownloadV266',
    src:'/app/local-ai/download-manager-v267.js?v=1.0.68-v322-explicit-sync&chatcore=v325',
    ready:()=>Boolean(globalThis.CivweaveLocalModelDownloadV266?.status&&globalThis.CivweaveLocalModelDownloadV266?.selection&&globalThis.CivweaveLocalModelDownloadV266?.select)
  }),
  Object.freeze({
    name:'CivweaveLocalModelRuntimeV266',
    src:'/app/local-ai/runtime-v266.js?v=1.0.121-v307-coherence-reload&chatcore=v325',
    ready:()=>runtimeReady()
  })
]);

if(globalThis.CivweaveLocalChatRuntimeV295?.version===VERSION&&
   globalThis.CivweaveLocalChatRuntimeV295?.revision===REVISION&&
   globalThis.CivweaveLocalChatRuntimeV295?.inferenceCoreFirst===true)return;

let coreFlight=null;
let auxiliaryBootstrapFlight=null;

const parse=(v,d)=>{try{return JSON.parse(v)??d}catch{return d}};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));

function selected(){
  const live=globalThis.CivweaveLocalModelDownloadV266?.selection?.();
  if(live?.active&&live.id)return live;
  const x=parse(localStorage.getItem(SEL),{});
  return x?.active&&x.id?x:null;
}
function health(id){
  const all=globalThis.CivweaveLocalModelTestPulseV269?.health?.()||parse(localStorage.getItem(HEALTH),{});
  return all?.[id]||{};
}
function budget(id){
  const m=health(id).metrics||{};
  const tps=Math.max(0,Number(m.tokensPerSecond||m.benchmarkTokensPerSecond||0));
  const maxNewTokens=tps?Math.round(clamp(tps*30,48,128)):64;
  const cold=Math.max(0,Number(m.coldStartMs||0));
  const timeoutMs=Math.round(clamp(Math.max(90000,cold*1.5+60000),90000,180000));
  return{maxNewTokens,timeoutMs,tps,coldStartMs:cold};
}
function runtimeReady(){
  const runtime=globalThis.CivweaveLocalModelRuntimeV266;
  return Boolean(
    runtime?.version==='1.0.115-local-ai-runtime-v302-session-handoff'&&
    runtime?.generate&&
    runtime?.freshWorkerFallback===true&&
    runtime?.phaseAwareErrors===true&&
    runtime?.promptBudgetEnforced===true&&
    runtime?.terminalCancellation===true&&
    runtime?.settingsTeardown===true&&
    runtime?.adaptiveResidency===true&&
    runtime?.adaptiveWasmThreads===true&&
    runtime?.intentPrewarm===true&&
    runtime?.compatibilityPromptCap===true&&
    globalThis.CivweaveLocalModelDownloadV266?.selection
  );
}
function evictComponent(name,ready){
  if(!name||ready?.())return false;
  const value=globalThis[name];
  if(name==='CivweaveLocalModelRuntimeV266')try{value?.shutdown?.({reason:'chat-inference-core-reload'})}catch{}
  try{delete globalThis[name]}catch{try{globalThis[name]=undefined}catch{}}
  return Boolean(value);
}
function removeStaleScript(path){
  for(const node of [...(document.scripts||[])]){
    try{
      if(new URL(node.src,location.href).pathname===path)node.remove?.();
    }catch{}
  }
}
function loadCoreComponent(component,attempt=0){
  if(component.ready())return Promise.resolve(true);
  const path=new URL(component.src,location.href).pathname;
  evictComponent(component.name,component.ready);
  removeStaleScript(path);
  return new Promise((resolve,reject)=>{
    let settled=false;
    const script=document.createElement('script');
    const finish=(ok,error)=>{
      if(settled)return;
      settled=true;
      clearTimeout(timer);
      ok?resolve(true):reject(error);
    };
    const timer=setTimeout(
      ()=>finish(false,Object.assign(new Error(`${path} did not satisfy the inference-core contract within ${Math.round(CORE_LOAD_TIMEOUT_MS/1000)} seconds.`),{code:'LOCAL_INFERENCE_CORE_LOAD_TIMEOUT',component:component.name,phase:'loading-runtime'})),
      CORE_LOAD_TIMEOUT_MS
    );
    script.src=`${component.src}&attempt=${attempt}&ts=${Date.now()}`;
    script.async=false;
    script.dataset.civweaveLocalChatCore='v325';
    script.onload=()=>finish(
      component.ready(),
      Object.assign(new Error(`${path} loaded without satisfying the inference-core contract.`),{code:'LOCAL_INFERENCE_CORE_CONTRACT_FAILED',component:component.name,phase:'loading-runtime'})
    );
    script.onerror=()=>finish(false,Object.assign(new Error(`Could not load ${path} for local inference.`),{code:'LOCAL_INFERENCE_CORE_LOAD_FAILED',component:component.name,phase:'loading-runtime'}));
    const head=document.head;
    if(!head?.isConnected){
      finish(false,Object.assign(new Error(`${path} could not mount because the document is leaving.`),{code:'LOCAL_INFERENCE_CORE_LOAD_FAILED',component:component.name,phase:'loading-runtime'}));
      return;
    }
    head.append(script);
  });
}
async function ensureInferenceCore(onProgress){
  if(runtimeReady())return true;
  if(coreFlight)return coreFlight;
  coreFlight=(async()=>{
    for(let attempt=0;attempt<2;attempt++){
      try{
        for(let index=0;index<CORE.length;index++){
          const component=CORE[index];
          onProgress?.({
            phase:'loading-runtime',
            stage:'inference-core',
            component:component.name,
            componentIndex:index+1,
            componentCount:CORE.length,
            attempt:attempt+1,
            progress:index/CORE.length
          });
          await loadCoreComponent(component,attempt);
        }
        if(!runtimeReady())throw Object.assign(new Error('The inference core loaded, but the local model runtime still does not satisfy the chat contract.'),{code:'LOCAL_INFERENCE_CORE_CONTRACT_FAILED',component:'CivweaveLocalModelRuntimeV266',phase:'loading-runtime'});
        onProgress?.({phase:'loading-runtime',stage:'inference-core-ready',progress:1,inferenceCoreFirst:true});
        return true;
      }catch(error){
        if(attempt===0){
          onProgress?.({phase:'loading-runtime',stage:'recovering-inference-core',component:error?.component||'',message:String(error?.message||error),attempt:1});
          continue;
        }
        throw error;
      }
    }
    return false;
  })().finally(()=>{coreFlight=null});
  return coreFlight;
}
function reportAuxiliaryBootstrap(boot,onProgress){
  Promise.resolve(boot?.ready).then(full=>{
    if(full)return;
    const detail={
      phase:'loading-runtime',
      stage:'runtime-ready-bootstrap-auxiliary-degraded',
      runtimeReady:runtimeReady(),
      bootstrapFullReady:false,
      bootstrapComponent:boot?.lastComponent||'',
      bootstrapMessage:boot?.lastError||'',
      revision:REVISION
    };
    try{onProgress?.(detail)}catch{}
    try{dispatchEvent(new CustomEvent('civweave:local-ai-auxiliary-bootstrap-degraded',{detail}))}catch{}
  }).catch(()=>{});
}
function startAuxiliaryBootstrap(onProgress){
  const existing=globalThis.CivweaveLocalAIBootstrapV266;
  if(existing?.revision===BOOT_REVISION&&existing?.ready){
    reportAuxiliaryBootstrap(existing,onProgress);
    return Promise.resolve(existing);
  }
  if(auxiliaryBootstrapFlight)return auxiliaryBootstrapFlight;
  auxiliaryBootstrapFlight=new Promise(resolve=>{
    const script=document.createElement('script');
    const finish=()=>{
      const boot=globalThis.CivweaveLocalAIBootstrapV266;
      if(boot?.ready)reportAuxiliaryBootstrap(boot,onProgress);
      resolve(boot||null);
    };
    script.src=`${BOOT}&aux=1&ts=${Date.now()}`;
    script.async=false;
    script.dataset.civweaveLocalChatBootstrap='v325-auxiliary';
    script.onload=finish;
    script.onerror=()=>resolve(null);
    const head=document.head;
    if(!head?.isConnected){resolve(null);return}
    head.append(script);
    setTimeout(finish,BOOT_READY_TIMEOUT_MS);
  }).finally(()=>{auxiliaryBootstrapFlight=null});
  return auxiliaryBootstrapFlight;
}
async function ready(onProgress){
  if(runtimeReady()){
    void startAuxiliaryBootstrap(onProgress);
    return true;
  }
  const started=performance.now();
  onProgress?.({phase:'loading-runtime',stage:'inference-core-start',elapsedMs:0,timeoutMs:CORE_LOAD_TIMEOUT_MS*CORE.length,inferenceCoreFirst:true});
  try{
    await ensureInferenceCore(onProgress);
    if(!runtimeReady())throw Object.assign(new Error('The local inference core did not become compatible.'),{code:'LOCAL_INFERENCE_CORE_UNAVAILABLE',phase:'loading-runtime'});
    onProgress?.({phase:'loading-runtime',stage:'ready',elapsedMs:performance.now()-started,progress:1,inferenceCoreFirst:true,bootstrapRequired:false});
    void startAuxiliaryBootstrap(onProgress);
    return true;
  }catch(error){
    const component=String(error?.component||'local inference core');
    const message=String(error?.message||error);
    throw Object.assign(
      new Error(`The local inference core could not start at ${component}: ${message}`),
      {code:error?.code||'LOCAL_INFERENCE_CORE_UNAVAILABLE',phase:error?.phase||'loading-runtime',component,cause:error}
    );
  }
}
function idleLimit(phase){
  const p=String(phase||'');
  if(p==='loading-model')return 240000;
  if(p==='loading-tokenizer'||p==='warming-model'||p==='benchmarking-model')return 150000;
  if(p.includes('download')||p==='backend-fallback'||p==='backend-quarantined')return 360000;
  if(p==='generating'||p==='preparing-prompt')return 120000;
  return 150000;
}
async function generate({systemPrompt,messages,onToken,onProgress}){
  const pick=selected();
  if(!pick)throw Object.assign(new Error('No downloaded local model is selected.'),{code:'LOCAL_MODEL_NOT_SELECTED'});
  await ready(onProgress);
  const runtime=globalThis.CivweaveLocalModelRuntimeV266;
  const spec=globalThis.CivweaveLocalModelRegistryV266?.byId?.(pick.id)||runtime.activeSpec?.()||{};
  const b=budget(pick.id);
  const absoluteMs=Math.round(clamp(Math.max(900000,b.timeoutMs,Number(spec.healthTimeoutMs||0)),300000,900000));
  let idleTimer=0,hardTimer=0,watchReject=null,lastPhase='starting',stalled=false;
  const arm=phase=>{
    lastPhase=String(phase||lastPhase||'working');
    clearTimeout(idleTimer);
    idleTimer=setTimeout(()=>{
      stalled=true;
      try{runtime.shutdown?.({reason:'chat-stage-stalled'})}catch{}
      watchReject?.(Object.assign(new Error(`Local model stopped because ${lastPhase} made no progress for ${Math.round(idleLimit(lastPhase)/1000)} seconds.`),{code:'LOCAL_CHAT_STAGE_STALLED',phase:lastPhase}));
    },idleLimit(lastPhase));
  };
  const watchdog=new Promise((_,reject)=>{watchReject=reject;arm('starting')});
  const progress=p=>{
    arm(p?.phase||lastPhase);
    try{onProgress?.({...p,watchdogMs:idleLimit(p?.phase||lastPhase),absoluteTimeoutMs:absoluteMs,runtimeFallbackOwned:Boolean(runtime?.stalledWebGPUFallback)})}catch{}
  };
  const token=t=>{arm('generating');try{onToken?.(t)}catch{}};
  const request=runtime.generate({
    messages:[{role:'system',content:systemPrompt},...messages],
    maxNewTokens:b.maxNewTokens,
    promptTokenBudget:Math.min(1024,Math.max(640,Number(spec.workingContextTokens||1024))),
    temperature:spec.generation?.nonThinkingTemperature??.7,
    thinking:false,
    timeoutMs:absoluteMs,
    stream:true,
    executionProfile:'interactive',
    onToken:token,
    onProgress:progress
  });
  const hardTimeout=new Promise((_,reject)=>{
    hardTimer=setTimeout(()=>{
      stalled=true;
      try{runtime.shutdown?.({reason:'chat-absolute-timeout'})}catch{}
      reject(Object.assign(new Error(`Local interactive generation exceeded its ${Math.round(absoluteMs/1000)} second overall recovery budget.`),{code:'LOCAL_CHAT_ABSOLUTE_TIMEOUT',phase:lastPhase}));
    },absoluteMs+2000);
  });
  try{
    return await Promise.race([request,watchdog,hardTimeout]);
  }catch(error){
    if(stalled||error?.code==='LOCAL_MODEL_TIMEOUT'||error?.code==='LOCAL_CHAT_STAGE_STALLED'||error?.code==='LOCAL_CHAT_ABSOLUTE_TIMEOUT'){
      try{runtime.shutdown?.({reason:error?.code||'chat-recovery'})}catch{}
    }
    throw error;
  }finally{
    clearTimeout(idleTimer);
    clearTimeout(hardTimer);
    watchReject=null;
  }
}

globalThis.CivweaveLocalChatRuntimeV295=Object.freeze({
  version:VERSION,
  revision:REVISION,
  downloadedLocalDirect:true,
  thinkingDisabled:true,
  streaming:true,
  boundedRecovery:true,
  boundedStartup:true,
  startupProgress:true,
  inferenceCoreFirst:true,
  inferenceCoreComponents:Object.freeze(CORE.map(row=>row.name)),
  fullBootstrapBlocking:false,
  bootstrapAuxiliaryFailureNonFatal:true,
  runtimeFirstBootstrap:true,
  stageAwareWatchdog:true,
  runtimeOwnedWebGPUFallback:true,
  progressExtendsColdStart:true,
  coldStartBenchmarkOptOut:true,
  windowsWebGPUGrace:true,
  freshWorkerFallback:true,
  phaseAwareErrors:true,
  promptBudgetEnforced:true,
  terminalCancellation:true,
  settingsTeardown:true,
  smoothFitRuntime:true,
  adaptiveResidency:true,
  adaptiveWasmThreads:true,
  intentPrewarm:true,
  selected,
  budget,
  runtimeReady,
  ensureInferenceCore,
  ready,
  generate
});
})();
