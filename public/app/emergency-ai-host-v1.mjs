import {EMERGENCY_AI_HOST_POLICY,evaluateEmergencyAiEligibility} from './shared/guild-host-resilience-v1.mjs';
const VERSION='1.0.0-emergency-ai-host-v1',OPT_IN='civweave.emergency-ai-host.opt-in.v1',HEALTH='civweave.local-ai.health.v286';
const readJson=key=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}};
const optedIn=()=>localStorage.getItem(OPT_IN)==='1';
const setOptIn=value=>{value?localStorage.setItem(OPT_IN,'1'):localStorage.removeItem(OPT_IN);return status()};
const tiers=()=>globalThis.CivweaveResponseRouterV347?.tiers||{};
const health=()=>readJson(HEALTH)||{};
function status(){return Object.freeze({version:VERSION,policy:EMERGENCY_AI_HOST_POLICY,...evaluateEmergencyAiEligibility({optedIn:optedIn(),tierCatalog:tiers(),speedChecks:health()})})}
let tail=Promise.resolve(),queueDepth=0,sequence=0;
function submit(request={}){const eligibility=status();if(!eligibility.eligible){const error=new Error(`Emergency AI hosting is unavailable: ${eligibility.failures.join(', ')}`);error.code='EMERGENCY_AI_HOST_INELIGIBLE';return Promise.reject(error)}const runtime=globalThis.CivweaveModelRuntime;if(typeof runtime?.generate!=='function')return Promise.reject(new Error('Civweave model runtime is unavailable.'));const seq=++sequence;queueDepth++;const run=()=>runtime.generate({...request,purpose:request.purpose||'guild-emergency-ai-share',emergencyAi:{scheduler:'fifo',sequence:seq}});const result=tail.then(run,run);tail=result.catch(()=>{});return result.finally(()=>{queueDepth=Math.max(0,queueDepth-1)})}
function queueStatus(){return Object.freeze({...status(),queueDepth})}
export const CivweaveEmergencyAiHostV1=Object.freeze({version:VERSION,policy:EMERGENCY_AI_HOST_POLICY,optedIn,setOptIn,status:queueStatus,submit});
globalThis.CivweaveEmergencyAiHostV1=CivweaveEmergencyAiHostV1;
