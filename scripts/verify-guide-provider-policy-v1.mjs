import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

const path='public/app/guide-provider-policy-v1.js';
const source=fs.readFileSync(path,'utf8');
execFileSync(process.execPath,['--check',path],{stdio:'inherit'});
for(const marker of ['serverAutoPreservesSelectedLocal:true','serverAutoFailureIsExplicit:true','deterministicFailureMasking:false',"['device-local','server-local','cloudflare-workers-ai']",'normalizeGuideRequest'])assert.ok(source.includes(marker),`missing provider-policy marker: ${marker}`);

function makeContext({route='deterministic',local=true,runtimeResult=null,runtimeError=null,assistantResult=null,assistantError=null}={}){
  const localStore=new Map([
    ['civweave-model-profiles-v1',JSON.stringify({interactive:{provider:route,route,model:route==='server-auto'?'civweave-server-auto-v1':'',externalConsent:route==='server-auto'}})],
    ['civweave.universal-ai.v127',JSON.stringify({provider:route,route,model:route==='server-auto'?'civweave-server-auto-v1':'',consent:route==='server-auto'})],
    ['civweave.local-ai.selection.v266',JSON.stringify(local?{active:true,id:'smollm2-135m-instruct-q8-wasm'}:{active:false,id:''})]
  ]);
  const calls=[];
  const runtime={
    version:'test-runtime',
    readSharedConfig(){return JSON.parse(localStore.get('civweave-model-profiles-v1')).interactive},
    async generate(request){calls.push(request);if(runtimeError)throw runtimeError;return runtimeResult||{status:'success',actual:{provider:request.config?.provider||'downloaded-local',model:'test'},outputText:'ok'}}
  };
  const assistant={
    async respond(args){if(assistantError)throw assistantError;return assistantResult||{response:{answer:'ok',choice:{mode:'Reflect',system:args.systemId||'civweave',room:'',nextAction:''}},requestedProvider:route,provider:route==='server-auto'?'downloaded-local':'downloaded-local',model:'smollm2-135m-instruct-q8-wasm'}},
    selectedConfig(){return local?{provider:'downloaded-local',route:'downloaded-local',model:'smollm2-135m-instruct-q8-wasm'}:{provider:route,route}}
  };
  const listeners=new Map();
  const context={
    globalThis:null,localStorage:{getItem:key=>localStore.get(key)||null,setItem:(key,value)=>localStore.set(key,String(value))},
    CivweaveModelRuntime:runtime,CivweaveAssistantV141:assistant,
    CivweaveLocalModelDownloadV266:{selection:()=>local?{active:true,id:'smollm2-135m-instruct-q8-wasm'}:{active:false,id:''}},
    CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
    dispatchEvent(){return true},addEventListener(name,fn){listeners.set(name,fn)},queueMicrotask,console,setTimeout,clearTimeout,Date,Object,Array,Set,JSON,String,Boolean,Number
  };
  context.globalThis=context;vm.createContext(context);vm.runInContext(source,context,{filename:path});
  return{context,calls,localStore};
}

{
  const {context}=makeContext({route:'deterministic',local:true});
  const request={purpose:'civweave-guide-response-v141',executionProfile:'interactive',config:{provider:'downloaded-local',route:'downloaded-local',model:'smollm2-135m-instruct-q8-wasm'}};
  const normalized=context.CivweaveGuideProviderPolicyV1.normalizeGuideRequest(request);
  assert.equal(normalized,request,'local-only mode must not be rewritten to server-auto');
}
{
  const {context}=makeContext({route:'server-auto',local:true});
  const request={purpose:'civweave-guide-response-v141',executionProfile:'interactive',config:{provider:'downloaded-local',route:'downloaded-local',model:'smollm2-135m-instruct-q8-wasm'}};
  const normalized=context.CivweaveGuideProviderPolicyV1.normalizeGuideRequest(request);
  assert.notEqual(normalized,request);
  assert.equal(normalized.config.provider,'server-auto');
  assert.equal(normalized.config.route,'server-auto');
  assert.equal(normalized.config.model,'civweave-server-auto-v1');
  assert.equal(normalized.providerPolicy.selectedLocalModel,'smollm2-135m-instruct-q8-wasm');
  assert.deepEqual(Array.from(normalized.config.serverOrder),['device-local','server-local','cloudflare-workers-ai']);
}
{
  const {context,calls}=makeContext({route:'server-auto',local:true});
  await context.CivweaveModelRuntime.generate({purpose:'civweave-guide-response-v141',config:{provider:'downloaded-local',route:'downloaded-local',model:'smollm2-135m-instruct-q8-wasm'}});
  assert.equal(calls.length,1);
  assert.equal(calls[0].config.provider,'server-auto','runtime wrapper must preserve the server-auto failover policy');
}
{
  const error=Object.assign(new Error('No active host-capacity session.'),{code:'SERVER_AI_EXHAUSTED'});
  const {context}=makeContext({route:'server-auto',local:true,assistantError:error});
  const result=await context.CivweaveAssistantV141.respond({text:'Can you help me make a plan to build a community garden in my area?',systemId:'civweave',history:[]});
  assert.equal(result.provider,'server-auto-unavailable');
  assert.equal(result.requestedProvider,'server-auto');
  assert.equal(result.providerRouteFailure.code,'SERVER_AI_EXHAUSTED');
  assert.match(result.response.answer,/not replaced with a deterministic answer/i);
  assert.notEqual(result.provider,'deterministic-local');
}

console.log('PASS guide provider policy: local-only remains local, server-auto preserves device-first failover, and provider exhaustion is explicit.');
