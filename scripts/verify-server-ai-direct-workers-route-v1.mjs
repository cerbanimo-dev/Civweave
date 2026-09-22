import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('public/app/server-ai-router-v301.js','utf8');
const events=[];
const calls=[];
let registered=null;

const makeStorage=()=>{
  const values=new Map();
  return{
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,value)=>values.set(key,String(value)),
    removeItem:key=>values.delete(key),
  };
};

const localStorage=makeStorage();
const sessionStorage=makeStorage();
const context=vm.createContext({
  console,
  structuredClone,
  URL,
  crypto:globalThis.crypto,
  location:{href:'https://civweave.example/app/',origin:'https://civweave.example',protocol:'https:',pathname:'/app/'},
  localStorage,
  sessionStorage,
  CustomEvent:class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}},
  dispatchEvent:event=>{events.push(event);return true},
  addEventListener:()=>{},
  fetch:async(url,options)=>{
    calls.push({url:String(url),options});
    return{
      ok:true,
      status:200,
      json:async()=>({text:'generated curriculum',model:'@cf/zai-org/glm-4.7-flash',usage:{chargedNeurons:4},quota:{includedRemainingNeurons:96}}),
    };
  },
  CivweaveFastInteractiveV192:{register:(id,hooks,priority)=>{registered={id,hooks,priority};return()=>{};}},
  CivweaveHostNodeSessionV1:{
    sessionFor:()=>({nodeId:'node-a',token:'test-session-token',origin:'https://node.example',generateUrl:'https://node.example/api/ai/node/generate',source:'capacity-session'}),
    recordUsage:()=>({remainingNeurons:96,approximateTurnsLeft:8}),
  },
  CivweaveModelRuntime:{readSharedConfig:()=>null},
});
context.globalThis=context;
vm.runInContext(source,context,{filename:'server-ai-router-v301.js'});

assert.ok(registered,'server AI middleware must register');
assert.equal(context.CivweaveServerAIRouterV301.isDirectWorkersAI({config:{provider:'cloudflare-workers-ai'}}),true,'canonical Workers AI must be handled directly');
assert.equal(context.CivweaveServerAIRouterV301.isDirectWorkersAI({config:{provider:'workers-ai'}}),true,'Workers AI alias must be handled directly');
assert.equal(context.CivweaveServerAIRouterV301.isDirectWorkersAI({config:{provider:'cloudflare'}}),true,'Cloudflare alias must be handled directly');
assert.equal(context.CivweaveServerAIRouterV301.isServerAuto({config:{provider:'server-auto'}}),true,'server-auto routing must remain supported');

const result=await registered.hooks.handle({
  purpose:'living-school-research-grounded-curriculum-v218.1',
  executionProfile:'interactive',
  config:{provider:'cloudflare-workers-ai',model:'@cf/zai-org/glm-4.7-flash'},
  messages:[{role:'user',content:'Build the curriculum.'}],
});

assert.equal(result.handled,true,'explicit Workers AI must be handled before the shared runtime unsupported-provider path');
assert.equal(result.result.status,'success');
assert.equal(result.result.requested.provider,'cloudflare-workers-ai');
assert.equal(result.result.actual.provider,'cloudflare-workers-ai');
assert.equal(result.result.outputText,'generated curriculum');
assert.equal(calls.length,1,'direct Workers AI must not probe server-local before Cloudflare');
assert.equal(calls[0].url,'https://node.example/api/ai/node/generate');
const payload=JSON.parse(calls[0].options.body);
assert.equal(payload.model,'@cf/zai-org/glm-4.7-flash');
assert.equal(payload.purpose,'living-school-research-grounded-curriculum-v218.1');

const modelEvents=events.filter(event=>event.type==='civweave:model-event').map(event=>event.detail);
assert.deepEqual(modelEvents.map(event=>event.phase),['generating','completed'],'middleware-handled Cloudflare calls must be visible to the shared run telemetry');
assert.ok(modelEvents[0].requestId,'model events must carry a stable request id');
assert.equal(modelEvents[0].requestId,modelEvents[1].requestId,'start and completion events must refer to the same call');
assert.equal(modelEvents[0].provider,'cloudflare-workers-ai');

console.log(JSON.stringify({ok:true,directWorkersAI:true,provider:result.result.actual.provider,model:result.result.actual.model,cloudRequests:calls.length,modelEventPhases:modelEvents.map(event=>event.phase),livingSchoolPurpose:result.result.purpose},null,2));
