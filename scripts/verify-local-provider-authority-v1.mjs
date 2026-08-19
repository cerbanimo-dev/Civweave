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

const result=await sandbox.CivweaveAssistantV141.respond({text:'Can you make a plan to teach people to love themselves?',systemId:'civweave',history:[]});
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
const afterLatePlanner=await sandbox.CivweaveAssistantV141.respond({text:'Can you make a plan to teach people to love themselves?',systemId:'civweave',history:[]});
assert.equal(afterLatePlanner.provider,'downloaded-local','authority must rewrap above a late Weaveling planner install');
assert.equal(latePlannerCalls,0,'late planner wrapper must not run before the local provider authority');

const blocked=await sandbox.CivweaveServerAIRouterV301.handle({purpose:'civweave-weaveling-intention-json-v190',__civweaveNetworkRequired:true,config:{provider:'server-auto',route:'server-auto'}});
assert.equal(blocked.blocked,true,'automatic structured guide network route must be blocked under downloaded-local');
assert.equal(blocked.reason,'LOCAL_PROVIDER_PINNED');
assert.equal(serverCalls,0,'blocked automatic guide route must never reach the server router implementation');

await sandbox.CivweaveServerAIRouterV301.handle({purpose:'civweave-guide-guild-handoff',guildOnly:true,config:{provider:'server-auto',externalConsent:true}});
assert.equal(serverCalls,1,'explicit Send to Guild must remain available');

localFailure=true;
const failed=await sandbox.CivweaveAssistantV141.respond({text:'Can you make a plan to teach people to love themselves?',systemId:'civweave',history:[]});
assert.equal(failed.provider,'local-ai-unavailable');
assert.equal(failed.requestedProvider,'downloaded-local');
assert.match(failed.response.answer,/did not contact a Guild or Cloudflare AI/);
assert.equal(assistantPriorCalls,0,'local failure must not fall through to prior/cloud wrappers');
assert.equal(serverCalls,1,'local failure must not contact the server router');

localFailure=false;
await sandbox.CivweaveAssistantV141.respond({text:'Activate',systemId:'civweave',history:[]});
assert.equal(assistantPriorCalls,1,'safe local app controls must still reach the existing control layer');
assert.equal(localCalls,3,'control actions must not be sent to the local language model');

localStorage.removeItem('civweave.local-ai.selection.v266');
localStorage.setItem('civweave-model-profiles-v1',JSON.stringify({interactive:{provider:'server-auto',route:'server-auto'}}));
assert.equal(api.localPinned(),false);
const priorLatePlannerCalls=latePlannerCalls;
const serverAutoResult=await sandbox.CivweaveAssistantV141.respond({text:'ordinary cloud-configured request',systemId:'civweave',history:[]});
assert.equal(latePlannerCalls,priorLatePlannerCalls+1,'server-auto must retain the existing provider stack when local is not selected');
assert.equal(serverAutoResult.provider,'cloudflare-workers-ai');

console.log(JSON.stringify({ok:true,revision:'local-provider-authority-v1',downloadedLocalDirect:true,automaticGuideCloudBlocked:true,explicitGuildAllowed:true,localFailureStaysLocal:true,serverAutoUnchanged:true},null,2));
