import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const [source,tracker,loader,settings]=await Promise.all([
  readFile('public/app/shared/civweave-model-runtime.js','utf8'),
  readFile('public/app/guide-generation-tracker-v1.js','utf8'),
  readFile('public/app/family-ai-loader-v105.js','utf8'),
  readFile('public/app/settings-gateway-v317.js','utf8')
]);
assert.match(source,/GGUF_BROWSER_MIN_TIMEOUT_MS = 480000/);
assert.match(source,/selectedEmbeddedGGUF\(config\)/);
assert.match(source,/config\.timeoutMs = Math\.max\(config\.timeoutMs, GGUF_BROWSER_MIN_TIMEOUT_MS\)/);
assert.match(source,/onPhase:\(stage,details=\{\}\)=>emit\(context,'gguf-browser-phase'/);
assert.match(tracker,/async function browserGGUFProbe\(/);
assert.match(tracker,/embeddedGGUFSelection\(\)\?browserGGUFProbe/);
assert.match(tracker,/Test selected GGUF inference/);
assert.match(tracker,/addEventListener\('civweave:model-event'/);
assert.match(tracker,/state\.runtimePhase='GGUF · '/);
assert.match(tracker,/does not apply to the imported GGUF/);
assert.match(loader,/1\.0\.7-gguf-prefill-observer/);
assert.match(settings,/data-embedded-gguf-selected-note/);
assert.match(settings,/internal browser runtime|internal runtime|internal.*routing key/);

let fetched=0;
const events=[],timeouts=[],key='qwen35-4b-imported-gguf',sentinel='http://127.0.0.1:8080/v1';
const stored=new Map([
  ['civweave.mobile.gguf-primary.v2',JSON.stringify({enabled:true,engine:'wllama',model:key,source:'file',importId:'file-saved-test',url:'civweave-gguf-import:file-saved-test'})],
  ['civweave-model-profiles-v1',JSON.stringify({interactive:{provider:'openai-compatible',model:key,endpoint:sentinel,externalConsent:false}})]
]);
const sandbox={
  localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)},
  sessionStorage:{getItem:()=>null,setItem:()=>{}},
  URL,Date,Math,JSON,AbortController,TextDecoder,TextEncoder,
  setTimeout(_callback,ms){timeouts.push(ms);return timeouts.length},
  clearTimeout(){},CustomEvent:class{constructor(name,options){this.type=name;this.detail=options?.detail}},
  dispatchEvent(event){events.push(event)},
  fetch(){fetched++;throw Error('Browser GGUF requested network inference!')},
  __testWllama:{async generate(args){
    assert.equal(args.model,key);
    assert.ok(args.signal instanceof AbortSignal);
    args.onPhase('loading',{backend:'webgpu'});
    args.onPhase('ready',{backend:'webgpu'});
    args.onToken('READY','READY');
    return{text:'READY',model:key,streamed:true,backend:'browser-wllama'};
  }}
};
sandbox.globalThis=sandbox;
const dynamic=/await import\('\/app\/local-ai\/browser-gguf-v1\.js\?v=[^']+'\)/;
assert.match(source,dynamic);
vm.runInNewContext(source.replace(dynamic,'global.__testWllama'),sandbox,{filename:'civweave-model-runtime.js'});
const runtime=sandbox.CivweaveModelRuntime;
const config={provider:'openai-compatible',model:key,endpoint:sentinel,timeoutMs:90000};
const result=await runtime.generate({purpose:'living-school-learning-plan-review-v2',executionProfile:'interactive',config,messages:[{role:'user',content:'Say READY.'}]});
if(result.status!=='success')console.error('GGUF test-model error:',JSON.stringify(result.error));
assert.equal(result.status,'success');
assert.equal(result.outputText,'READY');
assert.equal(result.actual.model,key);
assert.ok(timeouts.includes(480000),'Imported GGUF must not be aborted at the legacy 90-second server deadline.');
assert.ok(!timeouts.includes(90000),'Legacy HTTP timeout must not be applied to imported GGUF.');
assert.equal(fetched,0,'GGUF route must never contact the fake localhost endpoint.');
assert.ok(events.some(row=>row.type==='civweave:model-event'&&row.detail.phase==='gguf-browser-phase'&&row.detail.backend==='webgpu'));
const caps=await runtime.detectCapabilities(config,{probe:true});
assert.equal(caps.probe,'embedded-gguf-selection');
assert.equal(fetched,0,'Probing a saved GGUF must not GET /v1/models on localhost.');
await assert.rejects(runtime.generate({
  config:{...config,endpoint:'https://another-provider.example/v1'},
  messages:[{role:'user',content:'Say READY.'}]
}),/internal runtime route was changed/);
assert.equal(fetched,0,'A mismatched selected-GGUF endpoint must fail closed before any network call.');
console.log('Moss browser GGUF integration regression passed: 8-minute timeout, stage events, exact selection, localhost-free inference, fail-closed routing and GGUF-specific probe.');
