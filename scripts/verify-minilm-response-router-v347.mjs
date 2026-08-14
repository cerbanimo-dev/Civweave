import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const read=path=>fs.readFileSync(path,'utf8');
const routerPath='public/app/minilm-response-router-v347.js';
const loaderPath='public/app/shared-guide-surface-v236.js';
const source=read(routerPath),loader=read(loaderPath);
for(const path of [routerPath,loaderPath])execFileSync(process.execPath,['--check',path],{stdio:'inherit'});
for(const marker of [
  "maxWords:50",
  "minWords:100,maxWords:200",
  "minWords:250,maxWords:800",
  "minWords:900,maxWords:null",
  "gemma3-1b-it-q4f16",
  "qwen3-0.6b-q4f16",
  "qwen3-1.7b-q4f16",
  "smollm3-3b-q4f16",
  "gemma4-e2b-it-q2f16-mobile",
  "gemma4-e4b-it-q2f16-mobile",
  "reviewRequired:true",
  "purpose:'civweave-high-tier-review'",
  "__civweaveSkipResponseRouter:true",
  "installIfMissing:false",
  "settingsAutostart:false"
])assert.ok(source.includes(marker),`missing response-router marker: ${marker}`);
assert.ok(loader.includes('/app/minilm-response-router-v347.js?v=1.0.0-response-router-v347'),'shared guide loader must install the response router');
const context={
  globalThis:null,
  document:{scripts:[],head:{append(){}},createElement(){return{dataset:{},addEventListener(){}}}},
  location:{href:'https://example.test/app/'},navigator:{},
  CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  dispatchEvent(){return true},addEventListener(){},setInterval(){return 1},clearInterval(){},setTimeout,clearTimeout,structuredClone,URL,console,
};
context.globalThis=context;vm.createContext(context);vm.runInContext(source,context,{filename:routerPath});
const api=context.CivweaveResponseRouterV347;assert.ok(api,'response router API missing');
assert.equal(api.fallbackLength('Answer in 50 words or less.'),'short');
assert.equal(api.fallbackLength('Give me 100-200 words on this.'),'medium');
assert.equal(api.fallbackLength('Write 250-800 words on this.'),'fast');
assert.equal(api.fallbackLength('Write at least 900 words on this.'),'smart');
assert.equal(api.hardTaskClass('Fix this JavaScript race condition and merge the PR.'),'programming');
assert.equal(api.hardTaskClass('Go ahead and implement this and monitor it.'),'agentic');
assert.equal(api.hardTaskClass('What is a fox?'),'ordinary');
assert.deepEqual([...api.tiers.short.preferredModelIds].slice(0,2),['gemma3-1b-it-q4f16','qwen3-0.6b-q4f16']);
assert.deepEqual([...api.tiers.medium.preferredModelIds],['qwen3-1.7b-q4f16','smollm3-3b-q4f16']);
assert.equal(api.tiers.fast.preferredModelIds[0],'gemma4-e2b-it-q2f16-mobile');
assert.equal(api.tiers.smart.preferredModelIds[0],'gemma4-e4b-it-q2f16-mobile');
console.log('PASS MiniLM response-length and task-tier router v347.');
