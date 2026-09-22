#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {webcrypto} from 'node:crypto';

const routerPath='public/app/server-ai-router-v301.js';
const meshPath='public/app/node-ai-mesh-v1.js';
const livingSchoolBudgetPath='public/app/living-school-generation-budget-v3.js';
for(const path of [routerPath,meshPath,livingSchoolBudgetPath]){
  const check=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});
  assert.equal(check.status,0,check.stderr||check.stdout);
}

const router=fs.readFileSync(routerPath,'utf8');
const mesh=fs.readFileSync(meshPath,'utf8');
const livingSchoolBudget=fs.readFileSync(livingSchoolBudgetPath,'utf8');

assert.match(router,/1\.0\.124-server-ai-router-v301-explicit-long-deadlines/);
assert.match(router,/CLOUDFLARE_REQUEST_TIMEOUT_MS=90_000/);
assert.match(router,/MAX_EXPLICIT_REQUEST_TIMEOUT_MS=360_000/);
assert.match(router,/Math\.min\(MAX_EXPLICIT_REQUEST_TIMEOUT_MS,Math\.floor\(raw\)\)/);
assert.match(router,/new AbortController\(\)/);
assert.match(router,/SERVER_AI_CLOUDFLARE_TIMEOUT/);
assert.match(router,/fetchJsonWithTimeout\(endpointUrl/);
assert.match(router,/let node=null;\s*try\{node=await serverLocal\(next,trace\)\}catch\(error\)/);
assert.match(router,/route:'server-local',status:'failed'/);
assert.match(router,/const edge=await cloudflare\(next,trace\)/);

assert.match(livingSchoolBudget,/3\.0\.1-living-school-generation-budget-v3-design-transport-deadline/);
assert.match(livingSchoolBudget,/const DESIGN_TIMEOUT_MS=360000/);
assert.match(livingSchoolBudget,/const DESIGN_MAX_TOKENS=16384/);
assert.match(livingSchoolBudget,/config\.timeoutMs=Math\.max\(Number\(config\.timeoutMs\)\|\|0,DESIGN_TIMEOUT_MS\)/);
assert.match(livingSchoolBudget,/const MIN_LESSON_WORDS=120/,'longer transport budget must not weaken the curriculum depth gate');

assert.match(mesh,/1\.2\.5-node-ai-mesh-v1-request-deadlines/);
assert.match(mesh,/CAPABILITY_TIMEOUT_MS=8_000,INFERENCE_TIMEOUT_MS=90_000/);
assert.match(mesh,/new AbortController\(\)/);
assert.match(mesh,/Node capability request/);
assert.match(mesh,/Node inference/);

const store=new Map([
  ['civweave.host-capacity.sessions.v1',JSON.stringify({nodeA:{nodeId:'node-a',token:'test-token',origin:'https://node.example'}})],
  ['civweave.node-ai-marketplace.sessions.v1','{}'],
  ['civweave.node-ai-marketplace.preferences.v1','{}']
]);
const events=[];
const timerDurations=[];
const storage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,String(value))};
const context={
  console,Date,Math,Object,Array,String,Number,Boolean,RegExp,JSON,Promise,Set,Map,URL,
  AbortController,structuredClone,crypto:webcrypto,
  localStorage:storage,sessionStorage:storage,location:{href:'https://civweave-staging.pages.dev/app/',origin:'https://civweave-staging.pages.dev'},
  addEventListener(){},dispatchEvent:event=>{events.push(event);return true},CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  setTimeout:(fn,ms)=>{timerDurations.push(ms);fn();return timerDurations.length},clearTimeout(){},
  fetch:async(_url,options={})=>new Promise((resolve,reject)=>{
    const rejectAbort=()=>{const error=new Error('Aborted');error.name='AbortError';reject(error)};
    if(options.signal?.aborted)return rejectAbort();
    options.signal?.addEventListener?.('abort',rejectAbort,{once:true});
  })
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(router,context,{filename:routerPath});

await assert.rejects(
  context.CivweaveServerAIRouterV301.handle({purpose:'ordinary-interactive-request',executionProfile:'interactive',config:{provider:'cloudflare-workers-ai',route:'cloudflare-workers-ai',model:'@cf/zai-org/glm-4.7-flash'}}),
  error=>error?.code==='SERVER_AI_CLOUDFLARE_TIMEOUT'&&error?.timeoutMs===90_000
);
assert.ok(timerDurations.includes(90_000),'ordinary Cloudflare requests must retain the 90-second default deadline');

timerDurations.length=0;
await assert.rejects(
  context.CivweaveServerAIRouterV301.handle({purpose:'living-school-research-grounded-curriculum-v218.1',executionProfile:'interactive',config:{provider:'cloudflare-workers-ai',route:'cloudflare-workers-ai',model:'@cf/zai-org/glm-4.7-flash',timeoutMs:360_000}}),
  error=>error?.code==='SERVER_AI_CLOUDFLARE_TIMEOUT'&&error?.timeoutMs===360_000
);
assert.ok(timerDurations.includes(360_000),'explicit Living School curriculum design requests must be allowed the full 360-second bounded transport deadline');
const failed=events.filter(event=>event.type==='civweave:model-event').map(event=>event.detail).filter(detail=>detail?.phase==='failed').at(-1);
assert.equal(failed?.error?.code,'SERVER_AI_CLOUDFLARE_TIMEOUT','timed-out Cloudflare request must terminate the shared runtime call with a visible failed event');

console.log('PASS server AI request deadlines: ordinary calls stay at 90 seconds, explicit Living School design calls may use 360 seconds, and all Cloudflare/host requests remain abortable and bounded.');
