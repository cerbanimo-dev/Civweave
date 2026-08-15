import assert from 'node:assert/strict';

class WebStorage{
  constructor(){this.map=new Map()}
  getItem(key){return this.map.get(key)??null}
  setItem(key,value){this.map.set(key,String(value))}
  removeItem(key){this.map.delete(key)}
}

globalThis.localStorage=new WebStorage();
try{Object.defineProperty(globalThis,'navigator',{value:{onLine:false},configurable:true})}catch{}
globalThis.CivweaveResponseRouterV347={tiers:{
  fast:{id:'fast',maxTokens:1400,preferredModelIds:['gemma4-fast','gemma4-smart']},
  smart:{id:'smart',maxTokens:3072,preferredModelIds:['gemma4-smart','gemma4-fast']},
}};
localStorage.setItem('civweave.local-ai.health.v286',JSON.stringify({
  'gemma4-fast':{ok:true,metrics:{tokensPerSecond:8,ttftMs:2500,coldStartMs:30000},fallbackUsed:false},
  'gemma4-smart':{ok:false,metrics:{tokensPerSecond:2,ttftMs:8000,coldStartMs:60000},fallbackUsed:false},
}));

let currentDeviceId='provider-1';
const objects=new Map(),listeners=new Set();
globalThis.CivweaveLocalMeshV146={
  async deviceId(){return currentDeviceId},
  async getObject(id){return objects.get(id)||null},
  async listObjects(){return [...objects.values()]},
  async createObject(input){const object={...structuredClone(input),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),revisionHash:`rev-${input.id}-${input.revision}`};objects.set(object.id,object);for(const listener of listeners)listener({type:'object-received',object});return object},
  status(){return{sessions:[]}},
  subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener)},
  async syncGateway(){return{sent:0,received:0}},
};

let generatedRequest=null;
globalThis.CivweaveModelRuntime={async generate(request){generatedRequest=structuredClone(request);return{status:'success',outputText:`reply from ${request.config.model}`,actual:{provider:'downloaded-local',model:request.config.model},usage:{tokens:42}}}};

const {CivweaveEmergencyAiHostV1}=await import('../public/app/emergency-ai-host-v1.mjs');
const {CivweaveEmergencyAiMeshV1,EMERGENCY_AI_CAPABILITY_KIND,EMERGENCY_AI_REQUEST_KIND,EMERGENCY_AI_RESULT_KIND}=await import('../public/app/emergency-ai-mesh-v1.mjs');

assert.equal(CivweaveEmergencyAiHostV1.status().eligible,false);
assert.equal(CivweaveEmergencyAiHostV1.readiness().eligible,false);
assert.throws(()=>CivweaveEmergencyAiHostV1.setOptIn(true),error=>error?.code==='EMERGENCY_AI_BENCHMARK_REQUIRED');
assert.equal(CivweaveEmergencyAiHostV1.optedIn(),false);

localStorage.setItem('civweave.local-ai.health.v286',JSON.stringify({
  'gemma4-fast':{ok:true,metrics:{tokensPerSecond:8,ttftMs:2500,coldStartMs:30000},fallbackUsed:false},
  'gemma4-smart':{ok:true,metrics:{tokensPerSecond:5,ttftMs:5000,coldStartMs:70000},fallbackUsed:false},
}));
assert.equal(CivweaveEmergencyAiHostV1.readiness().eligible,true);
CivweaveEmergencyAiHostV1.setOptIn(true);
assert.equal(CivweaveEmergencyAiHostV1.status().eligible,true);
assert.equal(CivweaveEmergencyAiHostV1.tierExecution({tierId:'fast'}).modelId,'gemma4-fast');
assert.equal(CivweaveEmergencyAiHostV1.tierExecution({tierId:'smart'}).modelId,'gemma4-smart');

await CivweaveEmergencyAiMeshV1.start({guildId:'guild-1',baseUrl:''});
CivweaveEmergencyAiMeshV1.stop();
const adverts=[...objects.values()].filter(row=>row.kind===EMERGENCY_AI_CAPABILITY_KIND);
assert.equal(adverts.length,1);
assert.equal(adverts[0].payload.available,true);
assert.deepEqual(adverts[0].payload.tiers.map(row=>row.tierId),['fast','smart']);

currentDeviceId='requester-1';
const queued=await CivweaveEmergencyAiMeshV1.requestEmergencyInference({messages:[{role:'user',content:'Give me the emergency answer.'}]},{tierId:'fast',guildId:'guild-1'});
assert.equal(queued.status,'queued');
assert.equal(queued.provider.providerDeviceId,'provider-1');
const requests=[...objects.values()].filter(row=>row.kind===EMERGENCY_AI_REQUEST_KIND);
assert.equal(requests.length,1);
assert.deepEqual(requests[0].audience,['provider-1']);

currentDeviceId='provider-1';
const handled=await CivweaveEmergencyAiMeshV1.processIncoming();
assert.equal(handled.handled,1);
assert.equal(generatedRequest.__civweaveSkipResponseRouter,true);
assert.equal(generatedRequest.config.provider,'downloaded-local');
assert.equal(generatedRequest.config.model,'gemma4-fast');
assert.equal(generatedRequest.emergencyAi.tierId,'fast');

currentDeviceId='requester-1';
const results=await CivweaveEmergencyAiMeshV1.incomingResults();
assert.equal(results.length,1);
assert.equal(results[0].kind,EMERGENCY_AI_RESULT_KIND);
assert.equal(results[0].payload.status,'success');
assert.equal(results[0].payload.actual.model,'gemma4-fast');

CivweaveEmergencyAiHostV1.setOptIn(false);
assert.equal(CivweaveEmergencyAiHostV1.status().eligible,false);
console.log(JSON.stringify({ok:true,schema:'civweave.emergency-ai-mesh.test.v1',provider:'provider-1',requester:'requester-1',scheduler:'fifo',requiredTiers:['fast','smart'],healthStorage:'model-id-keyed',benchmarkGate:true,executedModel:'gemma4-fast'}));
