import {EMERGENCY_AI_HOST_POLICY,evaluateEmergencyAiEligibility} from './shared/guild-host-resilience-v1.mjs';
const VERSION='1.1.1-emergency-ai-host-v1-tier-bound',OPT_IN='civweave.emergency-ai-host.opt-in.v1',HEALTH='civweave.local-ai.health.v286';
const readJson=key=>{try{return JSON.parse(globalThis.localStorage?.getItem(key)||'null')}catch{return null}};
const optedIn=()=>{try{return globalThis.localStorage?.getItem(OPT_IN)==='1'}catch{return false}};
const tiers=()=>globalThis.CivweaveResponseRouterV347?.tiers||{};
const health=()=>readJson(HEALTH)||{};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function status(){return Object.freeze({version:VERSION,policy:EMERGENCY_AI_HOST_POLICY,...evaluateEmergencyAiEligibility({optedIn:optedIn(),tierCatalog:tiers(),speedChecks:health()})})}
const setOptIn=value=>{try{value?globalThis.localStorage?.setItem(OPT_IN,'1'):globalThis.localStorage?.removeItem(OPT_IN)}catch{}const next=status();if(typeof globalThis.CustomEvent==='function')globalThis.dispatchEvent?.(new CustomEvent('civweave:emergency-ai-host-opt-in',{detail:next}));return next};
function tierExecution(request={}){
  const tierId=String(request.emergencyTier||request.tierId||'fast').trim().toLowerCase();
  if(!EMERGENCY_AI_HOST_POLICY.requiredTierIds.includes(tierId))throw Object.assign(new RangeError(`Emergency AI tier must be one of: ${EMERGENCY_AI_HOST_POLICY.requiredTierIds.join(', ')}.`),{code:'EMERGENCY_AI_TIER_UNSUPPORTED'});
  const tier=tiers()[tierId],modelId=String(tier?.preferredModelIds?.[0]||tier?.primaryModelId||'').trim();
  if(!tier||!modelId)throw Object.assign(new Error(`The current ${tierId} tier has no primary local model.`),{code:'EMERGENCY_AI_TIER_UNAVAILABLE'});
  return Object.freeze({tierId,tier,modelId});
}
async function activateModel(modelId){
  const manager=globalThis.CivweaveLocalModelDownloadV266;if(!manager?.selection||!manager?.select)return{restore:()=>{},active:false};
  const previous=manager.selection();if(previous?.active&&previous.id===modelId)return{restore:()=>{},active:true};
  manager.select(modelId);const start=Date.now();while(Date.now()-start<15000){if(globalThis.CivweaveLocalModelRuntimeV266?.activeSpec?.()?.id===modelId)return{active:true,restore:()=>{try{if(previous?.active&&previous.id)manager.select(previous.id);else manager.select(null)}catch{}}};await sleep(100)}
  try{if(previous?.active&&previous.id)manager.select(previous.id);else manager.select(null)}catch{}
  throw Object.assign(new Error(`The eligible emergency model ${modelId} did not become active.`),{code:'EMERGENCY_AI_MODEL_ACTIVATION_FAILED'});
}
let tail=Promise.resolve(),queueDepth=0,sequence=0;
function submit(request={}){
  const eligibility=status();if(!eligibility.eligible){const error=new Error(`Emergency AI hosting is unavailable: ${eligibility.failures.join(', ')}`);error.code='EMERGENCY_AI_HOST_INELIGIBLE';return Promise.reject(error)}
  const runtime=globalThis.CivweaveModelRuntime;if(typeof runtime?.generate!=='function')return Promise.reject(new Error('Civweave model runtime is unavailable.'));
  let execution;try{execution=tierExecution(request)}catch(error){return Promise.reject(error)}
  const seq=++sequence;queueDepth++;
  const run=async()=>{const activation=await activateModel(execution.modelId);try{return await runtime.generate({...request,__civweaveSkipResponseRouter:true,purpose:request.purpose||'guild-emergency-ai-share',config:{...(request.config||{}),provider:'downloaded-local',model:execution.modelId,responseLengthClass:execution.tierId,maxTokens:Math.min(Number(request?.config?.maxTokens||execution.tier.maxTokens)||execution.tier.maxTokens,execution.tier.maxTokens)},emergencyAi:{scheduler:'fifo',sequence:seq,tierId:execution.tierId,modelId:execution.modelId}})}finally{activation.restore()}};
  const result=tail.then(run,run);tail=result.catch(()=>{});return result.finally(()=>{queueDepth=Math.max(0,queueDepth-1)})
}
function queueStatus(){return Object.freeze({...status(),queueDepth})}
export const CivweaveEmergencyAiHostV1=Object.freeze({version:VERSION,policy:EMERGENCY_AI_HOST_POLICY,optedIn,setOptIn,status:queueStatus,tierExecution,submit});
globalThis.CivweaveEmergencyAiHostV1=CivweaveEmergencyAiHostV1;
