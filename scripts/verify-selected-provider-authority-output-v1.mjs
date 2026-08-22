#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const authorityPath='public/app/selected-provider-authority-v1.js';
const sanitizerPath='public/app/assistant-output-sanitizer-v1.js';
for(const path of [authorityPath,sanitizerPath]){
  const check=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});
  assert.equal(check.status,0,check.stderr||check.stdout);
}
const authoritySource=fs.readFileSync(authorityPath,'utf8');
const sanitizerSource=fs.readFileSync(sanitizerPath,'utf8');

function contextFor({route='gemini',model='gemini-3.1-flash-lite',localId='' }={}){
  const store=new Map([
    ['civweave-model-profiles-v1',JSON.stringify({interactive:{provider:route,route,model}})],
    ['civweave.universal-ai.v127',JSON.stringify({provider:route,route,model})],
    ['civweave.local-ai.selection.v266',JSON.stringify(localId?{active:true,id:localId}:{active:false,id:''})]
  ]);
  let serverCalls=0;const runtimeCalls=[];
  const listeners=new Map();
  const context={
    console,Date,Math,Object,Array,String,Number,Boolean,RegExp,JSON,Promise,Set,Map,URL,
    localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,String(value))},
    document:{scripts:[],head:{append(){}},createElement(){return{addEventListener(){}}}},location:{href:'https://civweave-staging.pages.dev/app/realm-console-v140.html'},
    addEventListener:(name,fn)=>{const rows=listeners.get(name)||[];rows.push(fn);listeners.set(name,rows)},dispatchEvent:event=>{for(const fn of listeners.get(event.type)||[])fn(event);return true},CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},queueMicrotask:fn=>fn(),setInterval:()=>1,clearInterval(){},setTimeout:fn=>{fn();return 1},
    CivweaveSettingsV320:{readState:()=>({provider:route,route,model})},
    CivweaveModelRuntime:{readSharedConfig:()=>({provider:'server-auto',route:'server-auto',model:'civweave-server-auto-v1'}),generate:async request=>{runtimeCalls.push(request);return{status:'success',actual:{provider:request.config?.provider,model:request.config?.model},outputText:'ok'}}},
    CivweaveAssistantV141:{selectedConfig:()=>({provider:'server-auto',route:'server-auto',model:'civweave-server-auto-v1'}),respond:async()=>({response:{answer:'ok'},provider:'server-auto'})},
    CivweaveServerAIRouterV301:{handle:async()=>{serverCalls+=1;return{status:'success',actual:{provider:'cloudflare-workers-ai',model:'@cf/zai-org/glm-4.7-flash'},outputText:'paid cloud',usage:{chargedNeurons:42}}}}
  };
  if(localId)context.CivweaveLocalModelDownloadV266={selection:()=>({active:true,id:localId})};
  context.globalThis=context;vm.createContext(context);
  vm.runInContext(authoritySource,context,{filename:authorityPath});
  vm.runInContext(sanitizerSource,context,{filename:sanitizerPath});
  return{context,runtimeCalls,get serverCalls(){return serverCalls}};
}

{
  const fixture=contextFor({route:'gemini',model:'gemini-3.1-flash-lite'}),{context}=fixture;
  assert.equal(context.CivweaveSelectedProviderAuthorityV1.authority().kind,'gemini');
  assert.equal(context.CivweaveAssistantV141.selectedConfig().provider,'gemini','stale server-auto selectedConfig overrode saved Gemini');
  await context.CivweaveModelRuntime.generate({purpose:'cerbanimo-endeavor-authoring-v3',executionProfile:'interactive',config:{provider:'cloudflare-workers-ai',route:'cloudflare-workers-ai',model:'@cf/zai-org/glm-4.7-flash'}});
  assert.equal(fixture.runtimeCalls[0].config.provider,'gemini','runtime request escaped saved Gemini authority');
  const blocked=await context.CivweaveServerAIRouterV301.handle({purpose:'cerbanimo-endeavor-authoring-v3',executionProfile:'interactive',config:{provider:'server-auto'}});
  assert.equal(fixture.serverCalls,0,'server router was invoked under Gemini authority');
  assert.equal(blocked.error.code,'SELECTED_PROVIDER_AUTHORITY_BLOCKED_NETWORK');
  assert.equal(blocked.usage.chargedNeurons,0);
}

{
  const fixture=contextFor({route:'downloaded-local',model:'gemma4-e2b-it-litert-web',localId:'gemma4-e2b-it-litert-web'}),{context}=fixture;
  assert.equal(context.CivweaveSelectedProviderAuthorityV1.authority().kind,'local');
  assert.equal(context.CivweaveAssistantV141.selectedConfig().provider,'downloaded-local');
  await context.CivweaveModelRuntime.generate({purpose:'civweave-guide-response-v141',executionProfile:'interactive',config:{provider:'server-auto',route:'server-auto'}});
  assert.equal(fixture.runtimeCalls[0].config.provider,'downloaded-local');
  const blocked=await context.CivweaveServerAIRouterV301.handle({purpose:'civweave-guide-response-v141',executionProfile:'interactive'});
  assert.equal(fixture.serverCalls,0,'server router was invoked under local-only authority');
  assert.equal(blocked.usage.chargedNeurons,0);
}

{
  const {context}=contextFor({route:'server-auto',model:'civweave-server-auto-v1'});
  const envelope={id:'chatcmpl-test',object:'chat.completion',model:'@cf/zai-org/glm-4.7-flash',choices:[{message:{role:'assistant',content:'Clean assistant content',reasoning:'private chain',reasoning_content:'private chain'}}],usage:{neurons:47.2}};
  const packet=context.CivweaveAssistantOutputSanitizerV1.sanitizePacket({response:{answer:JSON.stringify(envelope)},provider:'cloudflare-workers-ai',reasoning:'leak',reasoning_content:'leak'});
  assert.equal(packet.response.answer,'Clean assistant content');
  assert.equal('reasoning' in packet,false);assert.equal('reasoning_content' in packet,false);
  assert.doesNotMatch(packet.response.answer,/chatcmpl|reasoning|reasoning_content/);
  const modelResult=context.CivweaveAssistantOutputSanitizerV1.sanitizeModelResult({status:'success',outputText:JSON.stringify(envelope),outputJson:envelope});
  assert.equal(modelResult.outputText,'Clean assistant content');assert.equal('outputJson' in modelResult,false);
}

console.log('PASS selected-provider authority: saved Gemini/local-only blocks neuron-backed routing, while genuine Cloudflare output is normalized and reasoning never reaches the guide UI.');
