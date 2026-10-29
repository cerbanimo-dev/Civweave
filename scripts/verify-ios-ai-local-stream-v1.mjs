#!/usr/bin/env node
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {TextDecoder, TextEncoder} from 'node:util';

const setup=readFileSync('public/app/local-ai/ios-ai-local-server-setup-v1.js','utf8');
const settings=readFileSync('public/app/settings-gateway-v317.js','utf8');
const runtime=readFileSync('public/app/shared/civweave-model-runtime.js','utf8');
const expectedLegacy=readFileSync('public/app/local-ai/litert-gemma4-fast-runtime-v1.js','utf8');
for(const [name,src] of [['setup',setup],['settings',settings],['runtime',runtime],['LiteRT',expectedLegacy]]){
  assert.doesNotThrow(()=>new Function(src),'invalid JavaScript: '+name);
}
assert.match(settings,/data-ios-ai-local-server/);
assert.match(settings,/ios-ai-local-server-setup-v1\.js/);
assert.match(settings,/localApiFlavor:'ai\.local',stream:true/);
assert.match(settings,/api\.mount\(target,\{activate/);
assert.match(runtime,/const aiLocal=config\.provider==='openai-compatible'&&config\.localApiFlavor==='ai\.local'/);
assert.match(runtime,/const useStream = aiLocal \|\| Boolean\(config\.stream \|\| lineup\)/);
assert.match(runtime,/useStream && !aiLocal \? \{ stream_options/);
assert.match(runtime,/structured && !aiLocal \? \{ response_format/);
assert.match(runtime,/!aiLocal&&config\.apiKey/);
assert.match(runtime,/bodyMessages\.unshift\(\{role:'system',content:jsonContract\}\)/);
assert.match(expectedLegacy,/LOCAL_LITERT_STREAMING_EXECUTOR_METADATA_UNSUPPORTED/);
assert.match(expectedLegacy,/if\(unsupportedExecutorMetadata\(standardError\)\)throw executorMetadataFailure/);
assert.doesNotMatch(setup,/\/api\/chat'\s*,\s*body:/);
assert.match(setup,/data-ai-local-activate disabled/,'do not activate before explicit test');
const sandbox={URL,AbortController,TextDecoder,console,setTimeout,clearTimeout,fetch:()=>{throw Error('Unexpected network request')}};
sandbox.globalThis=sandbox;
vm.runInNewContext(setup,sandbox);
const api=sandbox.CivweaveIOSAiLocalSetupV1;
assert.ok(api?.discover&&api?.streamTest&&api?.mount);
assert.equal(api.normalizeBase('http://127.0.0.1:11434/v1'), 'http://127.0.0.1:11434');
assert.equal(api.normalizeBase('http://192.168.1.44:11434/v1/chat/completions'), 'http://192.168.1.44:11434');
assert.equal(api.normalizeBase('http://iphone.local:11434'), 'http://iphone.local:11434');
for(const bad of ['https://evil.com:11434','http://8.8.8.8:11434','http://127.0.0.1:8080','http://user:pass@127.0.0.1:11434','http://127.0.0.1:11434/admin']){
  assert.throws(()=>api.normalizeBase(bad),'unsafe or invalid ai.local destination: '+bad);
}
const discovered=await api.discover('http://127.0.0.1:11434',{
  fetcher:async (url,init)=>{
    assert.equal(url,'http://127.0.0.1:11434/v1/models');
    assert.equal(init.credentials,'omit');
    return{ok:true,json:async()=>({data:[
      {id:'qwen3.5-4b-mlx-4bit',owned_by:'local-ai-server'},
      {id:'apple-foundation-model',owned_by:'apple'}
    ]})};
  }
});
assert.deepEqual(Array.from(discovered.models,x=>x.id),['qwen3.5-4b-mlx-4bit','apple-foundation-model']);

const encoder=new TextEncoder();
const sse='data: {"choices":[{"delta":{"content":"REA"}}]}\n\n'+
          'data: {"choices":[{"delta":{"content":"DY"}}]}\n\n'+
          'data: [DONE]\n\n';
const chunks=[sse.slice(0,41),sse.slice(41,70),sse.slice(70)].map(s=>encoder.encode(s));
const received=[];
const streamed=await api.streamTest('http://127.0.0.1:11434','qwen3.5-4b-mlx-4bit',{
  onToken:(piece)=>received.push(piece),
  fetcher:async(url,init)=>{
    assert.equal(url,'http://127.0.0.1:11434/v1/chat/completions');
    assert.equal(init.method,'POST');
    const body=JSON.parse(init.body);
    assert.equal(body.model,'qwen3.5-4b-mlx-4bit');
    assert.equal(body.stream,true);
    assert.equal(body.messages[0].content,'Reply with exactly READY.');
    assert.equal(body.response_format,undefined);
    assert.equal(body.stream_options,undefined);
    let index=0;
    return{ok:true,headers:{get:()=> 'text/event-stream'},
      body:{getReader:()=>({
        read:async()=>index<chunks.length?{value:chunks[index++],done:false}:{done:true},
        releaseLock(){},cancel:async()=>{}
      })}};
  }
});
assert.equal(streamed.streamed,true);
assert.equal(streamed.answer,'READY');
assert.equal(streamed.deltas,2);
assert.deepEqual(received,['REA','DY']);

await assert.rejects(()=>api.streamTest('http://127.0.0.1:11434','qwen3.5-4b-mlx-4bit',{
  fetcher:async()=>({ok:true,headers:{get:()=> 'application/json'},
    body:{getReader:()=>({read:async()=>({done:true}),releaseLock(){}})}})
}),/text\/event-stream/);
console.log('PASS: ai.local URL safety, explicit model discovery, true split-SSE token streaming, no premature activation, and Civweave /v1 runtime routing.');
