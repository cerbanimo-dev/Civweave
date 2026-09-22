(()=>{
'use strict';

const VERSION='1.0.0-gemma4-route-integrity-v1-post-loader-original-text';
const SYSTEMS=new Set(['civweave','living-school']);
const LEARNING=/\b(?:teach\s+me|learn|learning|memorize|memorise|study|master|practice|understand|learning\s+journey|curriculum|course|syllabus|learning\s+path|learning\s+plan|study\s+plan|lesson\s+plan|skill\s+tree)\b/i;

if(globalThis.CivweaveGemma4RouteIntegrityV1?.version===VERSION){
  globalThis.CivweaveGemma4RouteIntegrityV1.repair?.('duplicate-load');
  return;
}

let scheduled=false;
let lastPendingId='';
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
function emit(phase,detail={}){try{dispatchEvent(new CustomEvent('civweave:gemma4-route-integrity',{detail:{version:VERSION,phase,at:new Date().toISOString(),...detail}}))}catch{}}
function systemFor(args={}){return clean(args.systemId||args?.context?.guide?.system||'civweave',80).toLowerCase()||'civweave'}
function bridge(){return globalThis.CivweaveGemma4FirstRequestIntakeBridgeV1||null}
function selectedGemma(){try{return Boolean(bridge()?.selectedGemma?.())}catch{return false}}
function eligible(args={}){
  if(!selectedGemma()||!clean(args.text,12000))return false;
  const system=systemFor(args);
  if(!SYSTEMS.has(system))return false;
  return system==='civweave'||(system==='living-school'&&LEARNING.test(clean(args.text,12000)));
}
async function direct(args={}){
  const api=bridge();
  if(typeof api?.directIntake!=='function')return{handled:false,result:null};
  return api.directIntake(args);
}
function copyFlags(target,source){for(const key of Object.keys(source||{}))try{target[key]=source[key]}catch{};return target}
function installAssistantGuard(){
  const api=globalThis.CivweaveAssistantV141,current=api?.respond;
  if(!api||typeof current!=='function')return false;
  if(current.__civweaveGemma4RouteIntegrityV1===VERSION)return true;
  const prior=current;
  const respond=async args=>{
    if(eligible(args)){
      const routed=await direct(args||{});
      if(routed?.handled){emit('direct-intake',{system:systemFor(args),model:routed.result?.model||''});return routed.result}
    }
    return prior.call(api,args);
  };
  copyFlags(respond,current);
  respond.__civweaveGemma4RouteIntegrityV1=VERSION;
  respond.__civweaveOriginalUserTextAuthorityV1=true;
  respond.__prior=current;
  const next={...api,respond,gemma4RouteIntegrity:VERSION,originalUserTextRouting:true};
  try{globalThis.CivweaveAssistantV141=next;return globalThis.CivweaveAssistantV141?.respond===respond}catch{return false}
}
function repairRuntime(){
  if(!selectedGemma())return false;
  try{globalThis.CivweaveGemma4WeaveDraftPipelineV1?.install?.()}catch{}
  try{globalThis.CivweaveGemma4WeaveDraftPipelineV1?.installRuntime?.()}catch{}
  try{globalThis.CivweaveGemma4StructuredTaskAuthorityV1?.install?.()}catch{}
  try{bridge()?.install?.()}catch{}
  const installed=installAssistantGuard();
  emit('runtime-repaired',{assistant:installed,pipeline:Boolean(globalThis.CivweaveGemma4WeaveDraftPipelineV1),bridge:Boolean(bridge())});
  return installed;
}
function installLoaderGuard(){
  const loader=globalThis.CivweaveFamilyAILoaderV105,current=loader?.ensure;
  if(!loader||typeof current!=='function')return false;
  if(current.__civweaveGemma4RouteIntegrityLoaderV1===VERSION)return true;
  const prior=current.bind(loader);
  const ensure=async(...args)=>{
    const result=await prior(...args);
    repairRuntime();
    return result;
  };
  ensure.__civweaveGemma4RouteIntegrityLoaderV1=VERSION;
  ensure.__prior=current;
  try{loader.ensure=ensure;if(loader.ensure===ensure)return true}catch{}
  try{globalThis.CivweaveFamilyAILoaderV105={...loader,ensure};return globalThis.CivweaveFamilyAILoaderV105?.ensure===ensure}catch{return false}
}
function latestAssistant(thread){const rows=Array.isArray(thread?.messages)?thread.messages:[];for(let i=rows.length-1;i>=0;i-=1)if(rows[i]?.role==='assistant')return rows[i];return null}
function resetTrackerOnNewPending(event){
  const row=latestAssistant(event?.detail?.thread);if(!row?.pending)return;
  const id=clean(row.id,180);if(!id||id===lastPendingId)return;lastPendingId=id;
  const tracker=globalThis.CivweaveGuideGenerationTrackerV1;
  try{tracker?.resetForRequest?.();tracker?.ensurePanel?.()}catch{}
  emit('tracker-reset',{pendingId:id});
}
function repair(reason='schedule'){
  installLoaderGuard();
  repairRuntime();
  emit('repair',{reason,selectedGemma:selectedGemma()});
  return true;
}
function schedule(reason='event'){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;repair(reason)})}

addEventListener?.('civweave:realm-guide-thread-changed',resetTrackerOnNewPending);
for(const name of ['civweave:assistant-runtime-ready','civweave:unified-chat-system-ready','civweave:structured-task-authority-ready','civweave:gemma4-litert-first-request-ready','civweave:guide-loader-reset','civweave:guide-chat-ready','pageshow'])addEventListener?.(name,()=>schedule(name));
for(const delay of [0,60,220,700,1800,4200,9000,16000])setTimeout(()=>schedule(`timer-${delay}`),delay);

globalThis.CivweaveGemma4RouteIntegrityV1=Object.freeze({version:VERSION,eligible,direct,installAssistantGuard,installLoaderGuard,repairRuntime,repair,schedule,resetTrackerOnNewPending,originalUserTextRouting:true,postLoaderRepair:true,trackerFreshPerPending:true});
schedule('startup');
})();
