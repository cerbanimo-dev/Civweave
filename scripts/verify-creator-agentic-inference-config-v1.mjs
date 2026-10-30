#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const runtimeSource=fs.readFileSync('public/app/shared/civweave-model-runtime.js','utf8');
const codeSource=fs.readFileSync('public/creator-suite/shared/code-inference-route-v1.mjs','utf8');
const documentSource=fs.readFileSync('public/creator-suite/document-agent-v1.js','utf8');
const loaderSource=fs.readFileSync('public/creator-suite/shared/creator-inference-loaders-v1.mjs','utf8');
for(const source of [runtimeSource,documentSource])new vm.Script(source);
assert.match(codeSource,/purpose='creator-code-agent-v1'/);
assert.match(documentSource,/purpose:'creator-document-agent-v1'/);
assert.match(documentSource,/runCodeInference\(value,/);
assert.match(documentSource,/activeController\?\.abort/);
assert.match(loaderSource,/loadCreatorLocalRuntime/);
const native={provider:'openai-compatible',model:'qwen35-4b-native',
  endpoint:'http://127.0.0.1:8080/v1',timeoutMs:90000,maxTokens:4096,stream:false};
const profiles={interactive:native,agentic:native,agenticEnabled:true};
const storage=new Map([['civweave-model-profiles-v1',JSON.stringify(profiles)]]);
const sent=[],delays=[];
const sandbox={console,URL,Date,Math,JSON,Map,Set,Object,Array,Promise,
 TextEncoder,TextDecoder,ReadableStream,Response,AbortController,DOMException,
 localStorage:{getItem:key=>storage.get(key)||null,setItem:(k,v)=>storage.set(k,v)},
 sessionStorage:{getItem:()=>null,setItem:()=>{}},
 location:{href:'https://civweave-staging.pages.dev/creator-suite/code.html',origin:'https://civweave-staging.pages.dev'},
 setTimeout:(fn,ms)=>{delays.push(ms);return delays.length;},clearTimeout:()=>{},
 CustomEvent:class{constructor(name,options){this.name=name;this.detail=options.detail}},
 dispatchEvent:()=>{},
 fetch:async(url,options)=>{
  const body=JSON.parse(options.body);
  sent.push({url,body,options});
  assert.equal(url,'http://127.0.0.1:8080/v1/chat/completions');
  assert.equal(options.method,'POST');
  assert.equal(body.stream,true,'Saved agentic profile must not reset SSE to false');
  assert.equal(body.max_tokens,512,'Saved agentic profile must not reset bounded output to 4096');
  assert.equal(body.response_format,undefined,'Never force blocking grammar on native tool chunks');
  assert.equal(body.chat_template_kwargs.enable_thinking,false);
  const line='data: '+JSON.stringify({choices:[{delta:{content:'{"type":"done"}'},finish_reason:'stop'}]})+'\n\n';
  return new Response(line+'data: [DONE]\n\n',{status:200,headers:{'content-type':'text/event-stream'}});
 }
};
sandbox.globalThis=sandbox;
vm.runInNewContext(runtimeSource,sandbox,{filename:'civweave-model-runtime.js'});
for(const purpose of ['creator-code-agent-v1','creator-document-agent-v1']){
 const result=await sandbox.CivweaveModelRuntime.generate({
  purpose,executionProfile:'agentic',taskTier:'complex',responseFormat:'text',maxRepairAttempts:0,
  config:{...native,stream:true,timeoutMs:480000,maxTokens:512,temperature:0.2},
  messages:[{role:'system',content:'One JSON tool call only'},{role:'user',content:'Write one small edit'}]
 });
 assert.equal(result.status,'success',JSON.stringify(result.error));
 assert.equal(result.outputText,'{"type":"done"}');
 assert.equal(result.stream.used,true);
}
assert.equal(sent.length,2,'One bounded POST per code/document tool call');
assert.ok(delays.filter(ms=>ms===480000).length>=2,'Explicit 8-minute budget must take precedence');
const chat=await sandbox.CivweaveModelRuntime.generate({
 purpose:'ordinary-chat-test',executionProfile:'interactive',
 config:native,messages:[{role:'user',content:'ready'}]
});
assert.equal(chat.status,'provider-error','Mock intentionally enforces creator-only options; ordinary chat stays untouched');
console.log('PASS: creator code and structured documents preserve SSE, output limit, thinking-off and deadline despite saved agentic override');
