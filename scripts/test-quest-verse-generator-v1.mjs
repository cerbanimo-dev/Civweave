import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const coreSource=fs.readFileSync(new URL('../public/app/quest-arc-chronicle-v1.js',import.meta.url),'utf8');
const adapterSource=fs.readFileSync(new URL('../public/app/quest-verse-generator-v1.js',import.meta.url),'utf8');
const calls=[],store=new Map();
class CustomEventStub{constructor(type,init={}){this.type=type;this.detail=init.detail}}
const context={
  console,Date,Math,JSON,TextEncoder,structuredClone,crypto:webcrypto,CustomEvent:CustomEventStub,
  localStorage:{getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,String(value))},
  dispatchEvent:()=>true,addEventListener:()=>{},queueMicrotask:handler=>handler(),
  CivweaveFamilyAILoaderV105:{ensure:async()=>true},
  CivweaveModelRuntime:{
    readSharedConfig:()=>({provider:'gemini',model:'whatever',timeoutMs:60000,maxTokens:9000}),
    generate:async request=>{calls.push(request);return{status:'success',outputText:'A lantern marks the road\nThe trial is carried through\nA waymark stands behind\nThe Hero travels on'}}
  }
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(coreSource,context,{filename:'quest-arc-chronicle-v1.js'});
vm.runInContext(adapterSource,context,{filename:'quest-verse-generator-v1.js'});
const api=context.CivweaveQuestVerseGeneratorV1;
assert.ok(api,'Quest Verse adapter must install.');
const verse=await api.generate({publicQuestName:'Garden',publicQuestBrief:'Grow tomatoes',beatId:'first-trial',outcome:'CLEARED'});
assert.equal(verse.kind,'VERSE');
assert.equal(calls.length,1);
const request=calls[0];
assert.equal(request.taskTier,'small','Network routing must explicitly request the small task tier.');
assert.equal(request.complexity,'small');
assert.equal(request.config.maxTokens,160);
assert.equal(request.config.stream,false);
assert.equal(request.config.timeoutMs,12000);
assert.equal(request.context.publicOnly,true);
assert.equal(request.executionProfile,'interactive');
context.CivweaveLudModeV1={isEnabled:()=>true};
const before=calls.length;
const projection=await api.createProjection({publicQuestName:'Garden',beatId:'snare',outcome:'SETBACK'});
assert.equal(calls.length,before,'Lud Mode must not invoke a model for Quest Verse generation.');
assert.equal(projection.mode,'BEAT');
assert.equal(projection.displayText,'The Snare — Setback');
assert.match(adapterSource,/taskTier:'small'/);
assert.doesNotMatch(coreSource,/CivweaveModelRuntime|CivweaveFamilyAILoaderV105|runtime\.generate/,'The Lud-packaged core must remain independent from the model runtime.');
console.log('Quest Verse adapter low-tier routing and Lud no-model boundary checks passed.');
