(()=>{
'use strict';
const VERSION='1.0.65-ai-capability-broker-v269-diagnostics';
if(globalThis.CivweaveAICapabilityBrokerV268?.version===VERSION)return;
const SETTINGS_KEY='civweave.universal-ai.v127';
const PROFILES_KEY='civweave-model-profiles-v1';
const root=globalThis;
const LOCAL_SEMANTIC=new Set(['bundled','packaged','reflex','minilm','local-reflex','semantic','semantic-local']);
const GENERATIVE_LOCAL=new Set(['downloaded-local','smollm2','smollm3','qwen','browser']);
const state={lastDecision:null,decisions:[]};
const parse=(value,fallback={})=>{try{const parsed=JSON.parse(value);return parsed&&typeof parsed==='object'?parsed:fallback}catch{return fallback}};
const clean=value=>String(value??'').trim().toLowerCase();
function canonicalProvider(value){
  const raw=clean(value||'deterministic');
  if(!raw||raw==='deterministic')return'deterministic';
  if(LOCAL_SEMANTIC.has(raw))return'semantic-local';
  if(GENERATIVE_LOCAL.has(raw))return'generative-local';
  if(['openai','compatible','openai-compatible','gguf'].includes(raw))return'openai-compatible';
  if(raw==='local-api')return'ollama';
  return['gemini','ollama','hosted','manual'].includes(raw)?raw:raw;
}
function selectedConfig(profile='interactive'){
  const profiles=parse(root.localStorage?.getItem?.(PROFILES_KEY),{});
  const settings=parse(root.localStorage?.getItem?.(SETTINGS_KEY),{});
  const selected=profiles[profile]&&typeof profiles[profile]==='object'?profiles[profile]:profiles.interactive&&typeof profiles.interactive==='object'?profiles.interactive:settings;
  return selected&&typeof selected==='object'?selected:{};
}
function selectedProvider(profile='interactive'){
  const selected=selectedConfig(profile);
  return canonicalProvider(selected.provider||selected.route);
}
function requestText(request={}){
  const messages=Array.isArray(request.messages)?request.messages:[];
  const text=messages.map(item=>typeof item==='string'?item:item?.content??item?.text??'').join('\n');
  return clean([request.purpose,request.task,request.instructions,request.systemId,request.realm,request.context?.userMessage,text].filter(Boolean).join('\n'));
}
function explicitCapabilities(request={}){
  const explicit=request.capabilityRequirements&&typeof request.capabilityRequirements==='object'?request.capabilityRequirements:{};
  return{
    profile:clean(explicit.profile||''),
    requiresTools:explicit.requiresTools===true,
    externalResearch:explicit.externalResearch===true,
    code:explicit.code===true,
    structuredOutput:explicit.structuredOutput===true,
    vision:explicit.vision===true,
    planning:explicit.planning===true,
  };
}
function requirements(request={}){
  const explicit=explicitCapabilities(request);
  const explicitProfile=clean(request.executionProfile||request.profile||explicit.profile||'interactive');
  const profile=explicitProfile==='agentic'||request.agentic===true||request.background===true?'agentic':'interactive';
  const text=requestText(request);
  const requiresTools=Boolean(explicit.requiresTools||request.requiresTools||request.toolUse||request.webSearch||request.youtubeSearch||request.background&&/\b(search|research|browse|url|web|youtube|external source)\b/.test(text));
  const externalResearch=Boolean(explicit.externalResearch||request.externalResearch||request.webSearch||request.youtubeSearch||/\b(live research|current web|web search|internet search|open urls?|youtube search)\b/.test(text));
  const code=Boolean(explicit.code||request.code||/\b(code|software|javascript|typescript|python|react|node|api|database|sql|debug|refactor|patch|pull request)\b/.test(text));
  const structuredOutput=Boolean(explicit.structuredOutput||request.schema||request.responseFormat==='json'||request.responseFormat==='structured');
  const vision=Boolean(explicit.vision||request.vision||request.imageInput||request.multimodal);
  const planning=Boolean(explicit.planning||/\b(plan|planning|roadmap|milestone|architecture|work breakdown|curriculum|quest draft|reviewable weave)\b/.test(text));
  return Object.freeze({profile,requiresTools,externalResearch,code,structuredOutput,vision,planning});
}
function activeLocalSpec(){
  const selection=root.CivweaveLocalModelDownloadV266?.selection?.();
  if(!selection?.active||!selection.id)return null;
  return root.CivweaveLocalModelRegistryV266?.byId?.(selection.id)||null;
}
function supportsLocalRequest(spec,request={}){
  if(!spec)return{ok:false,reason:'no downloaded local model is active',requirements:requirements(request)};
  const need=requirements(request),cap=spec.capabilities||{};
  if(need.vision&&!cap.vision)return{ok:false,reason:'active local model has no vision capability',requirements:need};
  if(need.externalResearch&&!cap.externalResearch)return{ok:false,reason:'request needs live external research',requirements:need};
  if(need.requiresTools&&!cap.tools)return{ok:false,reason:'request needs tools the active local model does not expose',requirements:need};
  if(need.structuredOutput&&cap.structuredOutput===false)return{ok:false,reason:'request needs structured output',requirements:need};
  if(need.code&&cap.code===false)return{ok:false,reason:'request needs code capability',requirements:need};
  if(need.profile==='agentic'&&cap.agenticReasoning!==true)return{ok:false,reason:'active local model is not qualified for agentic reasoning',requirements:need};
  if(need.profile==='interactive'&&cap.interactive===false)return{ok:false,reason:'active local model is not qualified for interactive generation',requirements:need};
  return{ok:true,reason:need.profile==='agentic'?'qualified local agentic reasoning':'qualified local interactive generation',requirements:need};
}
function remember(decision){
  state.lastDecision=decision;
  state.decisions=[decision,...state.decisions].slice(0,20);
  return decision;
}
function decide(request={}){
  const spec=activeLocalSpec();
  const local=supportsLocalRequest(spec,request);
  const decision=Object.freeze({
    schema:'civweave.ai-capability-decision.v1',version:VERSION,
    route:local.ok?'downloaded-local':'base-runtime',
    provider:local.ok?'downloaded-local':selectedProvider(local.requirements.profile),
    model:local.ok?spec?.id||'':'',
    reason:local.reason,
    requirements:local.requirements,
    authority:'deterministic-contracts',
    at:new Date().toISOString(),
  });
  remember(decision);
  try{root.dispatchEvent?.(new root.CustomEvent('civweave:ai-capability-decision',{detail:decision}))}catch{}
  return decision;
}
const authority=Object.freeze({
  interpretation:'model-advisory',
  drafts:'model-or-deterministic',
  consequentialActions:'deterministic-contracts',
  approvals:'deterministic-contracts',
  ledgerSettlement:'deterministic-contracts',
  rewards:'deterministic-contracts',
  note:'Locality does not imply determinism. Determinism governs authority and consequences, not conversational intelligence.'
});
function diagnostics(){return Object.freeze({version:VERSION,lastDecision:state.lastDecision,decisions:[...state.decisions],authority});}
const api=Object.freeze({version:VERSION,canonicalProvider,selectedConfig,selectedProvider,requirements,activeLocalSpec,supportsLocalRequest,decide,diagnostics,get lastDecision(){return state.lastDecision},authority});
root.CivweaveAICapabilityBrokerV268=api;
try{root.dispatchEvent?.(new root.CustomEvent('civweave:ai-capability-broker-ready',{detail:{version:VERSION,authority,diagnostics:true}}))}catch{}
})();
