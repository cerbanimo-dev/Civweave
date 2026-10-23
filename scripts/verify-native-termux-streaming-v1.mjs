#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const native=readFileSync('public/app/local-ai/native-server-guide-fastpath-v1.js','utf8')
  .replace(/\bexport\s+(?=(?:const|async function|function)\b)/g,'');
const guide=readFileSync('public/app/guide-chat-surface-v350.js','utf8');
const moss=readFileSync('public/app/unified-chat-system-v1.js','utf8');
const runtime=readFileSync('public/app/shared/civweave-model-runtime.js','utf8');
new vm.Script(native);
new vm.Script(guide);
new vm.Script(moss);
new vm.Script(runtime);
const memory=new Map(),storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
const selected={provider:'openai-compatible',route:'openai-compatible',model:'qwen35-4b-native',endpoint:'http://127.0.0.1:8080/v1'};
const g={CivweaveSettingsV320:{readState:()=>selected}};
const scope={globalThis:g,localStorage:storage,Date,JSON,String,Object,Array,Error,Promise,AbortController,DOMException,TextDecoder,
  setTimeout,clearTimeout,fetch:null};
const api=vm.runInNewContext(native+';({respondNative,readNativeStream})',scope);
const frames=[
  'data: {"choices":[{"delta":{"content":"Tar"}}]}\r\n\r\n',
  'data: {"choices":[{"delta":{"content":"ot"}}]}\n\n',
  'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"completion_tokens":2}}\n\n',
  'data: [DONE]\n\n'
].join('');
function chunkStream(text,width=7){
  const bytes=new TextEncoder().encode(text),chunks=[];
  for(let i=0;i<bytes.length;i+=width)chunks.push(bytes.slice(i,i+width));
  return new ReadableStream({start(controller){for(const value of chunks)controller.enqueue(value);controller.close()}});
}
let deltas=[],request=null;
const fetcher=async(_url,options)=>{
  request=JSON.parse(options.body);
  return{ok:true,status:200,headers:{get:()=> 'text/event-stream; charset=utf-8'},
    body:chunkStream(frames)};
};
const result=await api.respondNative({
  text:'Reply with Tarot',system:'civweave',fetcher,
  onToken:(delta,all)=>{deltas.push([delta,all])}
});
assert.equal(request.stream,true);
assert.equal(request.stream_options.include_usage,true);
assert.equal(request.max_tokens,512);
assert.equal(result.response.answer,'Tarot');
assert.equal(deltas.length,2);
assert.deepEqual(deltas.map(row=>row[0]),['Tar','ot']);
assert.equal(deltas.at(-1)[1],'Tarot');
assert.equal(JSON.parse(memory.get('civweave.native-server.last-request.v1')).stage,'native-text-complete');
assert.match(guide,/function paintNativeStream/);
assert.match(guide,/nativeAbortController\.abort\(\)/);
assert.match(guide,/paintTimer=setTimeout\(paint,80\)/);
assert.match(guide,/onToken,signal:requestAbort\?\.signal/);
assert.match(moss,/planConfig\.stream=true/);
assert.match(moss,/signal:options\.signal/);
assert.match(moss,/options\.onProgress/);
assert.match(runtime,/nativeDirectTermuxStreamV2: true/);
assert.match(runtime,/NATIVE_HTTP_TRANSPORT_FAILED/);
assert.match(runtime,/nativeDirect\?transport\(payload\):fetchOptions/);
assert.match(runtime,/pendingText\s*\+=\s*delta/,'native stream must preserve incoming visible token deltas');
assert.match(runtime,/backend:'native-server',text:pendingText,accumulatedText:output/,'native progress event must include raw generated text, not merely a character count');
assert.match(runtime,/backend:'native-server'[^}]*complete:true/,'native stream must flush trailing text on completion');
assert.match(guide,/ensureTracker\?\.\(\)/,'native chat must start the one canonical tracker before inference');
const cancelled=new AbortController();
cancelled.abort();
await assert.rejects(api.readNativeStream({
  headers:{get:()=> 'text/event-stream'},body:chunkStream(frames)
},{signal:cancelled.signal}),/cancel/i);
const invalid='data: {"choices":[{"delta":{"content":"hello"}}]}\n\n';
await assert.rejects(api.readNativeStream({
  headers:{get:()=> 'text/event-stream'},body:chunkStream(invalid)
}),/ended before a finish reason/i);
console.log('PASS: chunk-split SSE first tokens, cumulative deltas, finish marker, Stop abort, no incomplete stream acceptance, Moss draft progress and no heavy UI rerender');
