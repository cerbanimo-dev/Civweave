#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const routePath='public/app/living-school-runtime-route-v2.js';
const normalizerPath='public/app/server-ai-output-normalizer-v1.js';
const swPath='public/service-worker-living-school-cleanroom-v218.js';
for(const path of [routePath,normalizerPath,swPath]){
  const check=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});
  assert.equal(check.status,0,check.stderr||check.stdout);
}
const routeSource=fs.readFileSync(routePath,'utf8');
const normalizerSource=fs.readFileSync(normalizerPath,'utf8');
const swSource=fs.readFileSync(swPath,'utf8');

for(const selection of [
  {provider:'server-auto',route:'server-auto',model:'civweave-server-auto-v1'},
  {provider:'cloudflare-workers-ai',route:'cloudflare-workers-ai',model:'@cf/zai-org/glm-4.7-flash'},
  {provider:'gemini',route:'gemini',model:'gemini-3.7-flash'},
  {provider:'downloaded-local',route:'downloaded-local',model:'gemma4-e2b-it-litert-web'}
]){
  const registrations=[];let installs=0;
  const context={
    console,Date,Math,Object,Array,String,Number,Boolean,RegExp,JSON,Promise,Set,Map,URL,
    localStorage:{getItem:()=>null},
    location:{href:'https://civweave-staging.pages.dev/app/cabinets/living-school/index.html'},
    document:{scripts:[],head:{append(){}},createElement(){return{addEventListener(){}}}},
    queueMicrotask:fn=>fn(),setTimeout:fn=>{fn();return 1},clearTimeout(){},
    addEventListener(){},dispatchEvent(){return true},CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
    CivweaveSelectedProviderAuthorityV1:{persistedInteractive:()=>selection,install:()=>{installs+=1}},
    CivweaveModelRuntime:{readSharedConfig:()=>null,generate:async()=>({status:'success'})},
    CivweaveFastInteractiveV192:{unregister(){},register:(id,middleware,priority)=>registrations.push({id,middleware,priority})}
  };
  context.globalThis=context;vm.createContext(context);vm.runInContext(routeSource,context,{filename:routePath});
  const resolved=context.CivweaveModelRuntime.readSharedConfig('interactive');
  assert.equal(resolved.provider,selection.provider,`${selection.provider} was not recovered into the shared runtime config`);
  assert.equal(resolved.model,selection.model,`${selection.provider} model was not recovered`);
  assert.equal(context.CivweaveModelRuntime.__livingSchoolProviderConfigBridgeV1,'2.4.0-living-school-runtime-route-v2-provider-handoff');
  assert.ok(registrations.some(row=>row.id==='living-school-runtime-route-v2'&&row.priority===190),'Living School middleware was not registered');
  assert.ok(installs>0,'selected-provider authority was not reinstalled after the shared-config bridge');
}

assert.match(normalizerSource,/AUTHORITY_VERSION='1\.1\.0-selected-provider-authority-v1-all-routes'/,'server output normalizer still expects the retired provider-authority version');
for(const path of ['/app/family-ai-loader-v105.js','/app/shared/civweave-model-runtime.js','/app/selected-provider-authority-v1.js','/app/server-ai-router-v301.js','/app/server-ai-output-normalizer-v1.js'])assert.ok(swSource.includes(path),`Living School fresh-runtime policy is missing ${path}`);
assert.match(swSource,/providerHandoffFresh:true/,'Living School service-worker policy does not expose provider-handoff freshness');
console.log('PASS Living School provider handoff: selected AI routes survive empty shared-runtime state, provider authority reattaches, and installed-PWA AI bootstrap assets are forced fresh.');
