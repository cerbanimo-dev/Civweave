import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../public/app/local-provider-authority-v1.js',import.meta.url),'utf8');
class MemoryStorage{
  constructor(seed={}){this.values=new Map(Object.entries(seed))}
  getItem(key){return this.values.has(key)?this.values.get(key):null}
  setItem(key,value){this.values.set(key,String(value))}
  removeItem(key){this.values.delete(key)}
}
const localStorage=new MemoryStorage({
  'civweave-model-profiles-v1':JSON.stringify({interactive:{provider:'downloaded-local',route:'downloaded-local',model:'smollm2-135m-instruct-q8-wasm'}}),
  'civweave.local-ai.selection.v266':JSON.stringify({active:true,id:'smollm2-135m-instruct-q8-wasm'})
});
let localCalls=0,assistantPriorCalls=0,serverCalls=0,localFailure=false;
const sandbox={
  console,Date,Math,Object,Array,String,Number,Boolean,RegExp,JSON,Promise,Set,Map,URL,
  localStorage,
  location:{href:'https://staging.example.test/app/working-campus-v156.html',pathname:'/app/working-campus-v156.html'},
  document:{scripts:[],head:{append(){}},createElement(){return{}},querySelector(){return null}},
  CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail}},
  dispatchEvent(){return true},addEventListener(){},queueMicrotask,setTimeout,clearTimeout,
  setInterval(){return 1},clearInterval(){},
  globalThis:null
};
sandbox.globalThis=sandbox;
sandbox.CivweaveLocalChatRuntimeV295={
  async generate(request){
    localCalls+=1;
    assert.match(request.systemPrompt,/downloaded local AI model/);
    assert.equal(request.messages.at(-1)?.content,'Can you make a plan to teach people to love themselves?');
    if(localFailure)throw Object.assign(new Error('local executor failed'),{code:'LOCAL_EXECUTOR_FAILED'});
    return{status:'success',outputText:'Local-only answer from the downloaded model.',usage:{outputTokens:9}};
  }
};
sandbox.CivweaveAssistantV141={
  async respond(){assistantPriorCalls+=1;return{response:{answer:'prior assistant route'},provider:'cloudflare-workers-ai',model:'@cf/zai-org/glm-4.7-flash'}}
};
sandbox.CivweaveServerAIRouterV301={
  async handle(){serverCalls+=1;return{handled:true,result:{actual:{provider:'cloudflare-workers-ai',model:'@cf/zai-org/glm-4.7-flash'},outputText:'cloud'}}},
  status(){return{registered:true}}
};

vm.createContext(sandbox);
vm.runInContext(source,sandbox,{filename:'local-provider-authority-v1.js'});
const api=sandbox.CivweaveLocalProviderAuthorityV1;
assert.ok(api,'authority API should install');
assert.equal(api.localPinned(),true);
assert.equal(api.localProviderPinned,true);
assert.equal(api.cloudFallbackWhenLocal,false);
assert.equal(api.deterministicFallbackWhenLocal,false);
assert.equal(api.gemma4MobileRuntimeFloor,'4.3.0');
assert.equal(api.bundledTransformersV4,'4.2.0');

const prompt='Can you make a plan to teach people to love themselves?';
const result=await sandbox.CivweaveAssistantV141.respond({text:prompt,systemId:'civweave',history:[]});
assert.equal(localCalls,1,'downloaded-local must execute the local runtime directly');
assert.equal(assistantPriorCalls,0,'downloaded-local must bypass prior planner/cloud wrappers');
assert.equal(result.requestedProvider,'downloaded-local');
assert.equal(result.provider,'downloaded-local');
assert.equal(result.model,'smollm2-135m-instruct-q8-wasm');
assert.equal(result.response.answer,'Local-only answer from the downloaded model.');
assert.equal(result.responseRouting?.networkRequired,false);

let latePlannerCalls=0;
const latePrior=sandbox.CivweaveAssistantV141.respond;
const latePlanner=async args=>{latePlannerCalls+=1;if(String(args?.text||'').toLowerCase()==='activate')return latePrior(args);return{response:{answer:'late planner cloud route'},provider:'cloudflare-workers-ai',model:'@cf/zai-org/glm-4.7-flash'}};
latePlanner.__prior=latePrior;
sandbox.CivweaveAssistantV141.respond=latePlanner;
sandbox.CivweaveWeavelingPlanJsonV190={install(){return true}};
await Promise.resolve();
await Promise.resolve();
const afterLatePlanner=await sandbox.CivweaveAssistantV141.respond({text:prompt,systemId:'civweave',history:[]});
assert.equal(afterLatePlanner.provider,'downloaded-local','authority must rewrap above a late Weaveling planner install');
assert.equal(latePlannerCalls,0,'late planner wrapper must not run before the local provider authority');

const blocked=await sandbox.CivweaveServerAIRouterV301.handle({purpose:'civweave-weaveling-intention-json-v190',__civweaveNetworkRequired:true,config:{provider:'server-auto',route:'server-auto'}});
assert.equal(blocked.blocked,true,'automatic structured guide network route must be blocked under downloaded-local');
assert.equal(blocked.reason,'LOCAL_PROVIDER_PINNED');
assert.equal(serverCalls,0,'blocked automatic guide route must never reach the server router implementation');

await sandbox.CivweaveServerAIRouterV301.handle({purpose:'civweave-guide-guild-handoff',guildOnly:true,config:{provider:'server-auto',externalConsent:true}});
assert.equal(serverCalls,1,'explicit Send to Guild must remain available');

localFailure=true;
const failed=await sandbox.CivweaveAssistantV141.respond({text:prompt,systemId:'civweave',history:[]});
assert.equal(failed.provider,'local-ai-unavailable');
assert.equal(failed.requestedProvider,'downloaded-local');
assert.match(failed.response.answer,/did not contact a Guild or Cloudflare AI/);
assert.match(failed.response.answer,/Local runtime detail: local executor failed/);
assert.equal(assistantPriorCalls,0,'local failure must not fall through to prior/cloud wrappers');
assert.equal(serverCalls,1,'local failure must not contact the server router');

localFailure=false;
await sandbox.CivweaveAssistantV141.respond({text:'Activate',systemId:'civweave',history:[]});
assert.equal(assistantPriorCalls,1,'safe local app controls must still reach the existing control layer');
assert.equal(localCalls,3,'control actions must not be sent to the local language model');

// Exact regression: the new Gemma 4 Q2F16 mobile graph requires Transformers.js 4.3.0,
// while Civweave currently vendors 4.2.0. It must stay local and use only an already-installed
// compatible local model, never server-auto/Cloudflare.
let liveSelection={active:true,id:'gemma4-e2b-it-q2f16-mobile'};
const registryModels=[
  {id:'gemma4-e2b-it-q2f16-mobile',label:'Gemma 4 E2B IT',runtime:'transformers-js-v4',installable:true,status:'device-test',fallbackIds:['qwen3-0.6b-q8-wasm']},
  {id:'gemma3-1b-it-q4f16',label:'Gemma 3 1B IT',runtime:'transformers-js-v4',installable:true,status:'stable',fallbackIds:[]},
  {id:'qwen3-1.7b-q4f16',label:'Qwen 3 1.7B',runtime:'transformers-js-v3',installable:true,status:'stable',fallbackIds:[]},
  {id:'qwen3-0.6b-q4f16',label:'Qwen 3 0.6B',runtime:'transformers-js-v3',installable:true,status:'stable',fallbackIds:[]},
  {id:'smollm2-360m-instruct-q4f16',label:'SmolLM2 360M',runtime:'transformers-js-v3',installable:true,status:'stable',fallbackIds:[]},
  {id:'smollm2-135m-instruct-q8-wasm',label:'SmolLM2 135M',runtime:'transformers-js-v3',installable:true,status:'stable',fallbackIds:[]}
];
const registryMap=new Map(registryModels.map(model=>[model.id,model]));
sandbox.CivweaveLocalModelRegistryV266={
  version:'test-registry',models:registryModels,runtimeModels:registryModels,
  byId:id=>registryMap.get(id)||null,
  fallbacks:modelOrId=>{const model=typeof modelOrId==='string'?registryMap.get(modelOrId):modelOrId;return(model?.fallbackIds||[]).map(id=>registryMap.get(id)).filter(Boolean)},
  installable:()=>registryModels.filter(model=>model.installable),experimental:()=>[],capable:()=>registryModels
};
sandbox.CivweaveLocalModelDownloadV266={
  selection:()=>({...liveSelection}),
  select(id){liveSelection=id?{active:true,id}:{active:false,id:null};localStorage.setItem('civweave.local-ai.selection.v266',JSON.stringify(liveSelection));return liveSelection},
  async status(id){return{available:id==='gemma3-1b-it-q4f16'}}
};
sandbox.CivweaveLocalChatRuntimeV295.ready=async()=>true;
sandbox.CivweaveLocalChatRuntimeV295.generate=async request=>{
  localCalls+=1;
  assert.equal(request.messages.at(-1)?.content,prompt);
  const active=sandbox.CivweaveLocalModelDownloadV266.selection();
  if(active.id==='gemma4-e2b-it-q2f16-mobile')throw Object.assign(new Error('2-bit gather unsupported'),{code:'LOCAL_MODEL_FAILED'});
  return{status:'success',outputText:`Fallback local answer from ${active.id}.`,id:active.id,executionId:active.id,usage:{outputTokens:8}};
};
localStorage.setItem('civweave-model-profiles-v1',JSON.stringify({interactive:{provider:'downloaded-local',route:'downloaded-local',model:'gemma4-e2b-it-q2f16-mobile'}}));
localStorage.setItem('civweave.local-ai.selection.v266',JSON.stringify(liveSelection));
api.install();
const patchedGemma=sandbox.CivweaveLocalModelRegistryV266.byId('gemma4-e2b-it-q2f16-mobile');
assert.equal(patchedGemma.status,'runtime-blocked');
assert.equal(patchedGemma.runtimeRequirement.minimumVersion,'4.3.0');
assert.ok(patchedGemma.fallbackIds.includes('gemma3-1b-it-q4f16'),'Gemma 4 must have a real installed-local fallback candidate');
assert.ok(!patchedGemma.fallbackIds.includes('qwen3-0.6b-q8-wasm'),'retired/nonexistent q8 fallback ID must be removed');

const localFallback=await sandbox.CivweaveAssistantV141.respond({text:prompt,systemId:'civweave',history:[]});
assert.equal(localFallback.provider,'downloaded-local');
assert.equal(localFallback.requestedProvider,'downloaded-local');
assert.equal(localFallback.model,'gemma3-1b-it-q4f16');
assert.equal(localFallback.response.answer,'Fallback local answer from gemma3-1b-it-q4f16.');
assert.equal(localFallback.fallbackFrom?.provider,'downloaded-local');
assert.equal(localFallback.fallbackFrom?.model,'gemma4-e2b-it-q2f16-mobile');
assert.match(localFallback.fallbackFrom?.reason||'',/Transformers\.js 4\.3\.0/);
assert.equal(sandbox.CivweaveLocalModelDownloadV266.selection().id,'gemma4-e2b-it-q2f16-mobile','temporary local fallback must restore the Hero-selected model after generation');
assert.equal(serverCalls,1,'Gemma 4 compatibility fallback must never contact the server router');

sandbox.CivweaveLocalModelDownloadV266.status=async()=>({available:false});
const runtimeBlocked=await sandbox.CivweaveAssistantV141.respond({text:prompt,systemId:'civweave',history:[]});
assert.equal(runtimeBlocked.provider,'local-ai-unavailable');
assert.equal(runtimeBlocked.providerRouteFailure?.code,'LOCAL_MODEL_RUNTIME_TOO_OLD');
assert.equal(runtimeBlocked.providerRouteFailure?.requiredRuntime,'4.3.0');
assert.equal(runtimeBlocked.providerRouteFailure?.bundledRuntime,'4.2.0');
assert.match(runtimeBlocked.response.answer,/requires Transformers\.js 4\.3\.0 or newer/);
assert.match(runtimeBlocked.response.answer,/currently bundles Transformers\.js 4\.2\.0/);
assert.equal(serverCalls,1,'runtime-floor failure must remain entirely local');

sandbox.CivweaveLocalModelDownloadV266.select(null);
localStorage.removeItem('civweave.local-ai.selection.v266');
localStorage.setItem('civweave-model-profiles-v1',JSON.stringify({interactive:{provider:'server-auto',route:'server-auto'}}));
assert.equal(api.localPinned(),false);
const priorLatePlannerCalls=latePlannerCalls;
const serverAutoResult=await sandbox.CivweaveAssistantV141.respond({text:'ordinary cloud-configured request',systemId:'civweave',history:[]});
assert.equal(latePlannerCalls,priorLatePlannerCalls+1,'server-auto must retain the existing provider stack when local is not selected');
assert.equal(serverAutoResult.provider,'cloudflare-workers-ai');

console.log(JSON.stringify({ok:true,revision:'local-provider-authority-v1-gemma4-runtime-floor',downloadedLocalDirect:true,automaticGuideCloudBlocked:true,explicitGuildAllowed:true,localFailureStaysLocal:true,gemma4RuntimeFloor:true,gemma4InstalledLocalFallback:true,gemma4NoCloudFallback:true,serverAutoUnchanged:true},null,2));
