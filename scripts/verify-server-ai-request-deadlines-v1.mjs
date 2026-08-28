#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {webcrypto} from 'node:crypto';

const routerPath='public/app/server-ai-router-v301.js';
const meshPath='public/app/node-ai-mesh-v1.js';
for(const path of [routerPath,meshPath]){
  const check=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});
  assert.equal(check.status,0,check.stderr||check.stdout);
}

const router=fs.readFileSync(routerPath,'utf8');
const mesh=fs.readFileSync(meshPath,'utf8');

assert.match(router,/1\.0\.123-server-ai-router-v301-route-deadlines/);
assert.match(router,/CLOUDFLARE_REQUEST_TIMEOUT_MS=90_000/);
assert.match(router,/new AbortController\(\)/);
assert.match(router,/SERVER_AI_CLOUDFLARE_TIMEOUT/);
assert.match(router,/fetchJsonWithTimeout\(endpointUrl/);
assert.match(router,/let node=null;\s*try\{node=await serverLocal\(next,trace\)\}catch\(error\)/);
assert.match(router,/route:'server-local',status:'failed'/);
assert.match(router,/const edge=await cloudflare\(next,trace\)/);

assert.match(mesh,/1\.2\.5-node-ai-mesh-v1-request-deadlines/);
assert.match(mesh,/CAPABILITY_TIMEOUT_MS=8_000,INFERENCE_TIMEOUT_MS=90_000/);
assert.match(mesh,/new AbortController\(\)/);
assert.match(mesh,/Node capability request/);
assert.match(mesh,/Node inference/);
assert.match(mesh,/server-ai-router-v301\.js\?v=1\.0\.123-route-deadlines/);

const store=new Map([
  ['civweave.host-capacity.sessions.v1',JSON.stringify({nodeA:{nodeId:'node-a',token:'test-token',origin:'https://node.example'}})],
  ['civweave.node-ai-marketplace.sessions.v1','{}'],
  ['civweave.node-ai-marketplace.preferences.v1','{}']
]);
const events=[];
const storage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,String(value))};
const context={
  console,Date,Math,Object,Array,String,Number,Boolean,RegExp,JSON,Promise,Set,Map,URL,
  AbortController,structuredClone,crypto:webcrypto,
  localStorage:storage,sessionStorage:storage,location:{href:'https://civweave-staging.pages.dev/app/',origin:'https://civweave-staging.pages.dev'},
  addEventListener(){},dispatchEvent:event=>{events.push(event);return true},CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  setTimeout:fn=>{fn();return 1},clearTimeout(){},
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
  context.CivweaveServerAIRouterV301.handle({purpose:'living-school-research-grounded-curriculum-v218.1',executionProfile:'interactive',config:{provider:'cloudflare-workers-ai',route:'cloudflare-workers-ai',model:'@cf/zai-org/glm-4.7-flash'}}),
  error=>error?.code==='SERVER_AI_CLOUDFLARE_TIMEOUT'
);
const failed=events.filter(event=>event.type==='civweave:model-event').map(event=>event.detail).find(detail=>detail?.phase==='failed');
assert.equal(failed?.error?.code,'SERVER_AI_CLOUDFLARE_TIMEOUT','timed-out Cloudflare request must terminate the shared runtime call with a visible failed event');

console.log('PASS server AI request deadlines: paired-host requests are bounded, Cloudflare generation aborts instead of remaining active forever, and host failures retain Cloudflare failover.');
