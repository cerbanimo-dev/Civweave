(()=>{
'use strict';
const VERSION='1.3.3-generation-lifecycle-v2-preserve-stream-text';
const HISTORY_KEY='civweave.generation-lifecycle.v1.history';
const MAX_HISTORY=220;
const STOP_GRACE_MS=120000;
const IDLE_WAIT_MS=90000;
const SOURCE_EVENTS=Object.freeze([
  'civweave:weaveling-intake-progress',
  'civweave:weave-pipeline',
  'civweave:litert-gemma4-progress',
  'civweave:local-model-stage-progress',
  'civweave:litert-gemma4-failed',
  'civweave:litert-gemma4-complete',
  'civweave:generation-stop-requested',
  'civweave:generation-cancelled'
]);
if(globalThis.CivweaveGenerationLifecycleV1?.version===VERSION){globalThis.CivweaveGenerationLifecycleV1.install?.();return}
const clean=(value,max=50000)=>String(value??'').trim().slice(0,max);
const now=()=>Date.now();
let history=[];
let installed=false;
let lastStopAt=0;
const boundWindows=new WeakSet();
const patchedWindows=new WeakMap();
const wiredFrames=new WeakSet();
function plain(value){try{return JSON.parse(JSON.stringify(value??{}))}catch{return{}}}
function readHistory(){try{const rows=JSON.parse(sessionStorage.getItem(HISTORY_KEY)||'[]');return Array.isArray(rows)?rows.slice(-MAX_HISTORY):[]}catch{return[]}}
history=readHistory();
function save(){try{sessionStorage.setItem(HISTORY_KEY,JSON.stringify(history.slice(-MAX_HISTORY)))}catch{}}
function artifactKey(set={}){return ['learningPlan','endeavour','manifest','proposal'].filter(key=>set[key]).map(key=>({learningPlan:'L',endeavour:'E',manifest:'M',proposal:'P'}[key])).join('')}
const ARTIFACT_NAMES=Object.freeze({
  L:'Learning Plan',E:'Endeavour',M:'Manifest',P:'Proposal',
  LE:'Practicum',LM:'Study Kit',LP:'Learning Proposal',EM:'Expedition',EP:'Project Proposal',MP:'Resource Proposal',
  LEP:'Civic Practicum',LMP:'Learning Charter',EMP:'Initiative',LEM:'Quest',LEMP:'Quest'
});
function artifactName(set={}){return ARTIFACT_NAMES[artifactKey(set)]||'Generation'}
function inferArtifacts(text='',route=''){
  const source=clean(text,12000).toLowerCase();
  const set={learningPlan:false,endeavour:false,manifest:false,proposal:false};
  if(/\b(?:learn|learning|teach|study|memor(?:ize|ise)|practice|master|curriculum|course|syllabus|lesson|skill tree|learning plan|study plan)\b/.test(source))set.learningPlan=true;
  if(/\b(?:endeavou?r|project|build|make|create|produce|launch|organize|organise|finish|accomplish|implement|develop)\b/.test(source))set.endeavour=true;
  if(/\b(?:manifest|resource|resources|materials|supplies|equipment|tools|budget|procure|procurement|parts|ingredients)\b/.test(source))set.manifest=true;
  if(/\b(?:proposal|vote|voting|governance|approval|approve|policy|consent|collective decision|motion)\b/.test(source))set.proposal=true;
  if(!Object.values(set).some(Boolean)){
    if(route==='learning')set.learningPlan=true;
    else if(route==='quest'){set.learningPlan=true;set.endeavour=true;set.manifest=true}
  }
  return set;
}
function mergeArtifacts(base={},extra={}){return{
  learningPlan:Boolean(base.learningPlan||extra.learningPlan),
  endeavour:Boolean(base.endeavour||extra.endeavour),
  manifest:Boolean(base.manifest||extra.manifest),
  proposal:Boolean(base.proposal||extra.proposal)
}}
function normalizeArtifacts(value){
  if(!value)return{learningPlan:false,endeavour:false,manifest:false,proposal:false};
  if(Array.isArray(value))return value.reduce((set,item)=>mergeArtifacts(set,normalizeArtifacts(item)),{});
  if(typeof value==='string'){
    const v=value.toLowerCase();
    return{learningPlan:/learning|plan/.test(v),endeavour:/endeavou?r|project|work/.test(v),manifest:/manifest|resource/.test(v),proposal:/proposal|govern|vote/.test(v)};
  }
  return{learningPlan:Boolean(value.learningPlan||value.learning||value.plan),endeavour:Boolean(value.endeavour||value.endeavor||value.project),manifest:Boolean(value.manifest||value.resources),proposal:Boolean(value.proposal||value.governance||value.vote)};
}
function record(type,detail={},source='window'){
  const row={id:`life-${now().toString(36)}-${Math.random().toString(36).slice(2,7)}`,at:now(),type,source,detail:plain(detail)};
  history.push(row);if(history.length>MAX_HISTORY)history=history.slice(-MAX_HISTORY);save();
  try{globalThis.dispatchEvent(new CustomEvent('civweave:generation-lifecycle',{detail:row}))}catch{}
  return row;
}
function latest(type=''){for(let i=history.length-1;i>=0;i-=1)if(!type||history[i].type===type)return history[i];return null}
function inferRuntimeStage(args={},forcedModelId=''){
  const explicit=clean(args.__civweaveStage||args.stage||args.stageLabel,180);
  if(explicit)return explicit;
  const prompt=clean(args.systemPrompt,16000).toLowerCase();
  if(/intake|route_civweave_request|classify this intake/.test(prompt))return'Intake';
  if(/targeted repair|repair this payload/.test(prompt))return'Targeted repair';
  if(/compiler|convert a completed weave draft|compile this payload/.test(prompt))return'JSON compile';
  if(/draft|planning artifact/.test(prompt))return'Plan draft';
  return'Local generation';
}
function stageId(label=''){
  const value=clean(label,220).toLowerCase();
  if(value.includes('intake'))return'intake';
  if(value.includes('repair'))return'repair';
  if(value.includes('compile')||value.includes('json'))return'compile';
  return'draft';
}
function windows(){
  const rows=[globalThis];
  try{for(const frame of document.querySelectorAll('iframe')){const win=frame.contentWindow;if(win&&win.location?.origin===location.origin)rows.push(win)}}catch{}
  return rows;
}
async function waitIdle(api,timeout=IDLE_WAIT_MS){
  const started=now();
  while(now()-started<timeout){let active=false;try{active=Boolean(api?.state?.().generationActive)}catch{}if(!active)return true;await new Promise(resolve=>setTimeout(resolve,80))}
  return false;
}
function patchRuntime(win=globalThis){
  try{
    const api=win.CivweaveLiteRTGemma4FastRuntimeV1;
    if(!api?.runFast)return false;
    const existing=patchedWindows.get(win);
    if(existing===api||api.__civweaveGenerationLifecycleV1===VERSION)return true;
    const baseRunFast=api.runFast.bind(api),baseUnload=typeof api.unload==='function'?api.unload.bind(api):null;
    const runFast=async(args={},forcedModelId='')=>{
      const label=inferRuntimeStage(args,forcedModelId),stage=stageId(label),model=clean(forcedModelId||win.CivweaveLocalModelDownloadV266?.selection?.()?.id,180);
      let active=false;try{active=Boolean(api.state?.().generationActive)}catch{}
      if(active&&now()-lastStopAt<STOP_GRACE_MS){
        try{void baseUnload?.()}catch{}
        const idle=await waitIdle(api);
        if(!idle)throw Object.assign(new Error('The previous local generation is still shutting down after Stop. Retry once shutdown completes.'),{code:'CIVWEAVE_PREVIOUS_GENERATION_STOPPING'});
      }
      const priorToken=args?.onToken;
      const nextArgs={...args,onToken:token=>{const text=String(token?.text??token??'').slice(0,12000);if(!args.__civweaveProbe)record('runtime-token',{stage,label,model,text,state:'streaming'},'litert');try{priorToken?.(token)}catch{}}};
      if(!args.__civweaveProbe)record('runtime-stage',{stage,label,model,state:'start'},'litert');
      try{
        const result=await baseRunFast(nextArgs,forcedModelId);
        if(!args.__civweaveProbe)record('runtime-stage',{stage,label,model,state:'complete'},'litert');
        return result;
      }catch(error){
        const stopped=error?.cancelled||error?.code==='CIVWEAVE_GENERATION_STOPPED'||now()-lastStopAt<3000;
        if(!args.__civweaveProbe)record('runtime-stage',{stage,label,model,state:stopped?'stopped':'failed',code:error?.code||'',message:clean(error?.message||error,1200)},'litert');
        throw error;
      }
    };
    const unload=async(...args)=>{lastStopAt=now();record('runtime-stop',{state:'requested'},'litert');return baseUnload?baseUnload(...args):true};
    const next=Object.freeze({...api,runFast,unload,__civweaveGenerationLifecycleV1:VERSION});
    win.CivweaveLiteRTGemma4FastRuntimeV1=next;patchedWindows.set(win,next);return true;
  }catch{return false}
}
async function probeLocalModel({timeoutMs=90000}={}){
  const target=globalThis.CivweaveLocalGenerationModelPolicyV1?.resolve?.('deep')||'';
  const candidates=windows().map(win=>({win,api:win?.CivweaveLiteRTGemma4FastRuntimeV1})).filter(row=>typeof row.api?.runFast==='function');
  const picked=candidates.find(row=>row.api?.state?.()?.engineModelId===target)||candidates.find(row=>row.api?.state?.()?.engineReady)||candidates[0];
  if(!target||!picked){
    const result={ok:false,model:target,code:'LOCAL_INFERENCE_PROBE_NOT_READY',message:'The configured local runtime is not loaded.'};
    record('runtime-probe',result,'probe');return result;
  }
  const health=picked.api?.state?.();
  if(health?.gpuQuarantine){
    const result={ok:false,model:target,code:'CIVWEAVE_LOCAL_GPU_RESTART_REQUIRED',phase:health.gpuQuarantine.phase,message:'The prior inference timed out or the WebGPU queue failed. Restart the full Civweave runtime before testing again.',restartRequired:true};
    record('runtime-probe',result,'probe');return result;
  }
  if(health?.generationActive){
    const result={ok:false,model:target,code:'LOCAL_INFERENCE_PROBE_ENGINE_BUSY',message:'The previous inference has not released its GPU session. Restart the local runtime to recover.'};
    record('runtime-probe',result,'probe');return result;
  }
  let timer=null,completed=false,phase='loading-engine',started=now(),firstTokenAt=0,output='';
  const errorFor=()=>Object.assign(new Error(`The minimal local inference probe did not return a token within its deadline (last phase: ${phase}).`),{code:'LOCAL_INFERENCE_PROBE_TIMEOUT',executionModel:target,runtimePhase:phase});
  const watchdog=new Promise((_,reject)=>{
    timer=setTimeout(()=>{if(completed)return;try{picked.api.cancel?.()}catch{};reject(errorFor())},Math.max(20000,Math.min(150000,Number(timeoutMs)||90000)));
  });
  try{
    const generation=picked.api.runFast({
      __civweaveStage:'Local inference probe',__civweaveProbe:true,systemPrompt:'Reply with the single word READY. No explanation.',
      messages:[{role:'user',content:'Reply READY.'}],maxNewTokens:24,structuredTool:null,
      onProgress:detail=>{phase=clean(detail?.phase||phase,120)},
      onToken:detail=>{if(!firstTokenAt)firstTokenAt=now();output+=String(detail?.text??'')}
    },target);
    const answer=await Promise.race([generation,watchdog]);
    completed=true;clearTimeout(timer);
    const text=clean(answer?.outputText||output,200);
    const result={ok:Boolean(text),model:answer?.model?.id||target,code:text?'OK':'LOCAL_INFERENCE_PROBE_EMPTY',phase,firstTokenMs:firstTokenAt?firstTokenAt-started:null,elapsedMs:now()-started,output:text};
    record('runtime-probe',result,'probe');return result;
  }catch(error){
    completed=true;clearTimeout(timer);
    const result={ok:false,model:error?.executionModel||target,code:error?.code||'LOCAL_INFERENCE_PROBE_FAILED',phase:error?.runtimePhase||phase,message:clean(error?.message||error,400),elapsedMs:now()-started,restartRequired:Boolean(error?.restartRequired)};
    record('runtime-probe',result,'probe');return result;
  }
}
function releaseWindow(win){try{const api=win.CivweaveLiteRTGemma4FastRuntimeV1;if(api?.unload)void api.unload()}catch{}}
function handleStop(){lastStopAt=now();for(const win of windows())releaseWindow(win)}
function bindWindow(win=globalThis,source='window'){
  if(!win||boundWindows.has(win))return false;
  try{
    for(const type of SOURCE_EVENTS)win.addEventListener(type,event=>{if(type==='civweave:generation-stop-requested')handleStop();record(type,event?.detail||{},source)});
    boundWindows.add(win);patchRuntime(win);return true;
  }catch{return false}
}
function bindFrame(frame){
  if(!frame||wiredFrames.has(frame))return false;
  wiredFrames.add(frame);
  const attach=()=>{try{const win=frame.contentWindow;if(win&&win.location?.origin===location.origin){bindWindow(win,`frame:${frame.id||'realm'}`);patchRuntime(win)}}catch{}};
  frame.addEventListener('load',()=>setTimeout(attach,0),{passive:true});
  attach();
  return true;
}
function bindFrames(){
  try{for(const frame of document.querySelectorAll('iframe'))bindFrame(frame)}catch{}
}
function refreshBindings(){bindFrames();for(const win of windows())patchRuntime(win)}
function install(){
  if(!installed){
    installed=true;bindWindow(globalThis,'shell');bindFrames();
    document.addEventListener('click',event=>{const button=event.target?.closest?.('[data-generation-stop="true"]');if(!button)return;lastStopAt=now();handleStop()},true);
    for(const type of ['civweave:local-model-runtime-ready','civweave:gemma4-litert-fast-extension-ready','civweave:litert-structured-tool-adapter-ready','civweave:gemma4-litert-first-request-ready','civweave:guide-loader-reset','pageshow'])addEventListener(type,()=>queueMicrotask(refreshBindings));
    for(const delay of [0,100,500,1500,4000,9000])setTimeout(refreshBindings,delay);
  }else refreshBindings();
  return true;
}
const api=Object.freeze({version:VERSION,install,record,history:()=>history.map(plain),latest,artifactName,inferArtifacts,normalizeArtifacts,mergeArtifacts,artifactKey,stageId,patchRuntime,probeLocalModel,lastStopAt:()=>lastStopAt});
globalThis.CivweaveGenerationLifecycleV1=api;
globalThis.CivweaveGenerationLifecycleV2=api;
install();
})();
