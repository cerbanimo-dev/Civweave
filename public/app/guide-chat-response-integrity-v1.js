(()=>{
'use strict';

const VERSION='1.0.0-guide-chat-response-integrity-v1';
const ROUTER_PATH='/app/minilm-response-router-v347.js';
const ROUTER_VERSION_PREFIX='1.3.0-';
const TEST=/^(?:test|testing|ping|check|mic check)[.!?]*$/i;
const SYSTEMS=new Set(['civweave','living-school','cerbanimo','fellowfare','anarchadia']);
const GUIDE=Object.freeze({
  civweave:{name:'Weaveling',role:'Quest guide and central orchestrator',artifact:'Quest'},
  'living-school':{name:'Moss',role:'Learning Journey guide',artifact:'Learning Journey'},
  cerbanimo:{name:'Kamiya',role:'Endeavor guide',artifact:'Endeavor'},
  fellowfare:{name:'Rook',role:'Manifest guide and Quartermaster',artifact:'Manifest'},
  anarchadia:{name:'Merlin',role:'Civic and automation guide',artifact:'governance proposal'}
});
let patchedAssistant=null;
let routerRepairPending=false;

const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
function systemFor(args={}){
  const value=clean(args.systemId||args?.context?.guide?.system,80).toLowerCase();
  return SYSTEMS.has(value)?value:'civweave';
}
function guideFor(system){return GUIDE[system]||GUIDE.civweave}
function publishRoute(detail={}){
  try{dispatchEvent(new CustomEvent('civweave:response-route',{detail:{schema:'civweave.response-route.v1',lengthClass:'short',taskClass:'ordinary',artifactClass:null,networkRequired:false,confidence:1,source:'guide-chat-response-integrity',...detail}}))}catch{}
}
function decodeEscapedString(value){
  try{return JSON.parse(`"${String(value||'').replace(/"/g,'\\"')}"`)}catch{return String(value||'').replace(/\\n/g,'\n').replace(/\\r/g,'\r').replace(/\\t/g,'\t').replace(/\\"/g,'"').replace(/\\\\/g,'\\')}
}
function extractAnswerField(text){
  const source=clean(text,20000).replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const match=/["']answer["']\s*:\s*"/i.exec(source);if(!match)return'';
  let out='',escaped=false;
  for(let index=match.index+match[0].length;index<source.length;index++){
    const char=source[index];
    if(escaped){out+=`\\${char}`;escaped=false;continue}
    if(char==='\\'){escaped=true;continue}
    if(char==='"')break;
    out+=char;
  }
  return clean(decodeEscapedString(out),12000);
}
function visibleText(value){
  const raw=clean(value,20000);if(!raw)return'';
  const stripped=raw.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
  if(!/^[{[]/.test(stripped))return raw;
  try{
    const parsed=JSON.parse(stripped);
    if(parsed&&typeof parsed==='object')return clean(parsed.answer||parsed.text||parsed.message,12000)||raw;
  }catch{}
  return extractAnswerField(stripped)||'The model response ended before Civweave could finish parsing it. Your message was preserved; retry to continue.';
}
function sanitizeResult(result,system){
  if(!result||typeof result!=='object')return result;
  const response=result.response&&typeof result.response==='object'?{...result.response}:null;
  if(!response)return result;
  response.answer=visibleText(response.answer);
  if(response.choice&&typeof response.choice==='object')response.choice={...response.choice,nextAction:visibleText(response.choice.nextAction)};
  return{...result,response,context:{...(result.context||{}),guideChatIntegrity:{version:VERSION,system,rawJsonHidden:true}}};
}
function testResult(system){
  const guide=guideFor(system);
  publishRoute({system,source:'deterministic-test-integrity'});
  return{response:{answer:`Test received. I’m ${guide.name}, ${guide.role}. I did not create or activate a ${guide.artifact}.`,choice:{mode:system==='living-school'?'Learn':system==='cerbanimo'?'Build':system==='fellowfare'?'Acquire':system==='anarchadia'?'Govern':'Reflect',system,room:'',nextAction:''},assumptions:[],requiresConsent:false,confidence:1},provider:'chat-integrity-local',model:VERSION,context:{guide:{system,name:guide.name},capability:'test'},fallbackFrom:null};
}
async function learningJourneyResult(args,system){
  const unified=globalThis.CivweaveUnifiedChatSystemV1,text=clean(args?.text),history=Array.isArray(args?.history)?args.history:[];
  if(system!=='living-school'||typeof unified?.curriculumIntent!=='function'||typeof unified?.runLivingSchoolCurriculum!=='function'||!unified.curriculumIntent(text,history))return null;
  publishRoute({system,taskClass:'structured-artifact',artifactClass:'curriculum',lengthClass:'fast',networkRequired:true,source:'canonical-learning-journey-capability'});
  try{return sanitizeResult(await unified.runLivingSchoolCurriculum({...args,systemId:'living-school'}),system)}catch(error){
    return{response:{answer:`Moss could not materialize the Learning Journey: ${clean(error?.message||error,900)} Nothing was marked generated.`,choice:{mode:'Learn',system:'living-school',room:'',nextAction:'Retry the Learning Journey request after the learning engine is available.'},assumptions:[],requiresConsent:false,confidence:.99},provider:'learning-journey-integrity-error',model:VERSION,context:{guide:{system:'living-school',name:'Moss'},capability:'curriculum'},fallbackFrom:null};
  }
}
function copyFlags(target,source){for(const key of ['__cwUnifiedChatSystemV1','__weavelingPlanJsonV190','__guideIdentityIntegrityV216','__deterministicModeV175','__cwGuideCapabilityPassoverV1'])if(source?.[key])target[key]=source[key]}
function installAssistantPatch(){
  const api=globalThis.CivweaveAssistantV141,priorFn=api?.respond;if(!priorFn)return false;
  if(priorFn.__cwGuideChatResponseIntegrityV1){patchedAssistant=api;return true}
  const prior=priorFn.bind(api),respond=async args=>{
    const system=systemFor(args||{}),text=clean(args?.text);
    if(TEST.test(text))return testResult(system);
    const learning=await learningJourneyResult(args||{},system);if(learning)return learning;
    const result=await prior(args);return sanitizeResult(result,system);
  };
  respond.__cwGuideChatResponseIntegrityV1=true;respond.__prior=priorFn;copyFlags(respond,priorFn);
  try{api.respond=respond;patchedAssistant=api.respond===respond?api:null}catch{}
  if(!patchedAssistant){try{globalThis.CivweaveAssistantV141={...api,respond};patchedAssistant=globalThis.CivweaveAssistantV141}catch{}}
  if(patchedAssistant)try{dispatchEvent(new CustomEvent('civweave:guide-chat-response-integrity-ready',{detail:{version:VERSION,assistantPatched:true}}))}catch{}
  return Boolean(patchedAssistant);
}
function signalRouterReady(){
  const router=globalThis.CivweaveResponseRouterV347;if(typeof router?.classify!=='function')return false;
  try{dispatchEvent(new CustomEvent('civweave:minilm-response-router-ready',{detail:{version:router.version||VERSION,recoveredBy:VERSION}}))}catch{}
  return true;
}
function ensureRouter(){
  const router=globalThis.CivweaveResponseRouterV347,version=clean(router?.version,160);
  if(typeof router?.classify==='function'&&version.startsWith(ROUTER_VERSION_PREFIX))return signalRouterReady();
  if(routerRepairPending)return false;routerRepairPending=true;
  const stale=[...document.scripts].filter(script=>{try{return new URL(script.src,location.href).pathname===ROUTER_PATH}catch{return false}});
  stale.forEach(script=>{if(script.dataset.guideChatRouterRepair!=='true')script.remove()});
  const script=document.createElement('script');script.src=`${ROUTER_PATH}?v=1.3.0-chat-integrity-repair`;script.async=false;script.dataset.guideChatRouterRepair='true';
  script.onload=()=>{routerRepairPending=false;if(!signalRouterReady())try{dispatchEvent(new CustomEvent('civweave:minilm-route-failed',{detail:{version:VERSION,reason:'Response router loaded without classify().'}}))}catch{}};
  script.onerror=()=>{routerRepairPending=false;try{dispatchEvent(new CustomEvent('civweave:minilm-route-failed',{detail:{version:VERSION,reason:'Response router repair load failed.'}}))}catch{}};
  document.head?.append(script);return true;
}
function synchronize(){installAssistantPatch();ensureRouter();return true}
function start(){
  synchronize();
  for(const name of ['civweave:assistant-runtime-ready','civweave:guide-loader-reset','civweave:unified-chat-system-ready','civweave:guide-capability-passover-ready','civweave:runtime-spine-ready','pageshow'])addEventListener(name,()=>queueMicrotask(synchronize));
  setTimeout(synchronize,400);setTimeout(synchronize,1800);
}

globalThis.CivweaveGuideChatResponseIntegrityV1=Object.freeze({version:VERSION,visibleText,sanitizeResult,testResult,learningJourneyResult,installAssistantPatch,ensureRouter,synchronize,rawJsonHidden:true,canonicalLearningJourneyBypass:true,testMemoryIsolation:true});
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
