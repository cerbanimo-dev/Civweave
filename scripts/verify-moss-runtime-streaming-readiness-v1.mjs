#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const runtime=readFileSync('public/app/shared/civweave-model-runtime.js','utf8');
const fast=readFileSync('public/app/local-ai/native-server-guide-fastpath-v1.js','utf8')
  .replace(/\bexport\s+(?=(?:const|async function|function)\b)/g,'');
const campus=readFileSync('public/app/working-campus-v440.html','utf8');
const loader=readFileSync('public/app/family-ai-loader-v105.js','utf8');

new vm.Script(runtime);
new vm.Script(fast);
assert.match(runtime,/nativeDirectTermuxStreamV2:\s*true/);
assert.doesNotMatch(runtime,/compatibility\\n\s*nativeDirectTermuxStreamV2/,
  'Literal backslash-n inside a // comment hides the critical runtime export');
assert.match(campus,/1\.0\.182-moss-topic-grounding/);
assert.match(loader,/1\.0\.11-native-sse-export-capability-fix/);

let loads=0;
const storage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
const ctx={console,Date,Math,JSON,Object,Array,Promise,URL,AbortController,TextEncoder,TextDecoder,
  localStorage:storage,sessionStorage:storage,
  setTimeout,clearTimeout,CustomEvent:class{},dispatchEvent:()=>{},
  CivweaveSettingsV320:{readState:()=>({provider:'openai-compatible',model:'qwen35-4b-native',endpoint:'http://127.0.0.1:8080/v1'})},
  CivweaveUnifiedChatSystemV1:{
    version:'1.2.5-unified-chat-system-v1-topic-grounded-plan',
    handleNativeLivingSchoolRequest:async()=>({response:{answer:'REVIEW'}})
  }};
ctx.globalThis=ctx;
ctx.document={
  createElement:tag=>{assert.equal(tag,'script');return{remove(){}}},
  head:{append(script){
    loads++;
    assert.match(script.src,/1\.0\.11-native-sse-export-capability-fix/);
    vm.runInContext(runtime,context,{filename:'civweave-model-runtime.js'});
    script.onload?.();
  }}
};
const context=vm.createContext(ctx);
vm.runInContext(runtime,context,{filename:'shared-runtime'});
assert.equal(ctx.CivweaveModelRuntime.nativeDirectTermuxStreamV2,true,
  'The REAL executable runtime must expose streaming capability');
assert.equal(typeof ctx.CivweaveModelRuntime.generate,'function');
assert.equal(Object.isFrozen(ctx.CivweaveModelRuntime),true);

// Browser session may already have an older runtime from another subsystem.
ctx.CivweaveModelRuntime={version:'old-runtime',generate:async()=>({})};
vm.runInContext(fast+'\n;globalThis.__loadPlanner=ensurePlanner;',context,{filename:'native-fastpath'});
const planner=await ctx.__loadPlanner();
assert.equal(planner.version,'1.2.5-unified-chat-system-v1-topic-grounded-plan');
assert.equal(ctx.CivweaveModelRuntime.nativeDirectTermuxStreamV2,true);
assert.equal(loads,1,'The older runtime should be upgraded exactly once');
await ctx.__loadPlanner();
assert.equal(loads,1,'A ready runtime must not be repeatedly loaded');
console.log('PASS: actual native SSE runtime exports capability, old session runtime upgrades, Moss planner becomes ready, no duplicate load');
