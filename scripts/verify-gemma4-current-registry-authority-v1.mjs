import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const path='public/app/local-ai/gemma4-phone-performance-core-v1.js';
const source=fs.readFileSync(path,'utf8');
new vm.Script(source,{filename:path});

const FAST_E2='gemma4-e2b-it-litert-web';
const FAST_E4='gemma4-e4b-it-litert-web';
const LEGACY_E2='gemma4-e2b-it-q4f16';
const LEGACY_E4='gemma4-e4b-it-q4f16';

function registry(ids){
  const models=ids.map(id=>({id}));
  return{
    models,
    runtimeModels:[],
    byId:id=>models.find(model=>model.id===id)||null,
  };
}

const storage=new Map([
  ['civweave.local-ai.downloads.v266',JSON.stringify({
    [FAST_E2]:{status:'ready'},
    [FAST_E4]:{status:'ready'},
  })],
  ['civweave.local-ai.packs.v1',JSON.stringify({
    'premier-phone':{status:'ready',installedAt:'2026-09-03T00:00:00.000Z'},
  })],
]);
const listeners=new Map();
const sandbox={
  globalThis:null,
  console,
  Date,
  Object,
  Array,
  Set,
  JSON,
  String,
  Boolean,
  Number,
  Promise,
  localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value))},
  CivweaveLocalModelRegistryV266:registry([FAST_E2,FAST_E4]),
  CivweaveLocalModelDownloadV266:{
    selection:()=>({active:true,id:FAST_E4}),
    status:async id=>({available:id===FAST_E2||id===FAST_E4}),
  },
  addEventListener:(name,fn)=>listeners.set(name,fn),
  dispatchEvent:()=>true,
  CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  queueMicrotask:fn=>fn(),
  setTimeout:()=>0,
  clearTimeout:()=>{},
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(source,sandbox,{filename:path});

const api=sandbox.CivweaveGemma4PhonePerformanceCoreV1;
assert.ok(api,'phone performance authority did not install');
const current=sandbox.CivweaveLocalModelRegistryV266;
assert.equal(current.gemma4PhonePerformanceRegistryComplete,true,'current LiteRT E2B/E4B should be a complete phone registry');
assert.deepEqual(Array.from(current.gemma4PhonePerformanceRegistryMissing||[]),[],'retired Q4 aliases must not be required for current runtime readiness');
assert.deepEqual(Array.from(current.gemma4PhoneCompatibilityRegistryMissing||[]),[LEGACY_E2,LEGACY_E4],'missing retired Q4 aliases should be diagnostics only');
assert.equal(current.gemma4PhoneLegacyRegistrationRequired,false,'legacy Q4 registration must be explicitly non-required');
assert.equal(api.assertSelectedPerformance(),true,'selected E4B LiteRT must not be blocked by absent retired Q4 aliases');

const missingCurrent=api.patchRegistry(registry([FAST_E2]));
assert.equal(missingCurrent.gemma4PhonePerformanceRegistryComplete,false,'missing current E4B must still fail readiness');
assert.deepEqual(Array.from(missingCurrent.gemma4PhonePerformanceRegistryMissing||[]),[FAST_E4],'current model registration failures must still be surfaced');

assert.match(source,/const missing=\[FAST_E2,FAST_E4\]\.filter/,'current registry gate must only require current LiteRT models');
assert.match(source,/gemma4PhoneCompatibilityRegistryMissing/,'legacy compatibility diagnostics must remain visible');
assert.match(source,/gemma4PhoneLegacyRegistrationRequired:false/,'legacy registration policy marker is missing');

console.log('PASS Gemma 4 current phone registry: E2B/E4B LiteRT are authoritative; retired Q4 aliases are optional diagnostics and cannot block selected E4B generation.');
