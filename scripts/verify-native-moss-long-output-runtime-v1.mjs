#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('public/app/shared/civweave-model-runtime.js','utf8');
new vm.Script(source);
const wire=[];
function sse(text,finish='stop'){
 const frames=[
  'data: '+JSON.stringify({choices:[{delta:{content:text}}]})+'\n\n',
  'data: '+JSON.stringify({choices:[{delta:{},finish_reason:finish}],usage:{completion_tokens:5}})+'\n\n',
  'data: [DONE]\n\n'
 ].join('');
 const bytes=new TextEncoder().encode(frames);
 return new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=11)c.enqueue(bytes.slice(i,i+11));c.close()}});
}
let nextText='Hello',nextReason='length';
const storage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
const ctx={
 console,Math,Date,URL,JSON,Object,Array,Promise,TextEncoder,TextDecoder,
 AbortController,DOMException,ReadableStream,setTimeout,clearTimeout,
 localStorage:storage,sessionStorage:storage,
 fetch:async(url,options)=>{
  wire.push({url:String(url),body:JSON.parse(options.body)});
  return{ok:true,status:200,headers:{get:()=>'text/event-stream'},body:sse(nextText,nextReason)};
 }
};
ctx.globalThis=ctx;
vm.createContext(ctx);
vm.runInContext(source,ctx);
const runtime=ctx.CivweaveModelRuntime;
const conf={provider:'openai-compatible',model:'qwen35-4b-native',
 endpoint:'http://127.0.0.1:8080/v1',stream:true,maxTokens:1500,timeoutMs:10000};
const call=opts=>runtime.generate({
 purpose:'verify-native-sse-finish',
 config:conf,messages:[{role:'user',content:'A small test prompt'}],
 maxRepairAttempts:0,...opts
});
const incomplete=await call();
assert.equal(incomplete.status,'incomplete');
assert.equal(incomplete.outputText,'Hello');
assert.equal(incomplete.finishReason,'length');
assert.equal(incomplete.error.code,'NATIVE_OUTPUT_TOKEN_LIMIT');
assert.equal(incomplete.actual.model,'qwen35-4b-native');
assert.equal(wire[0].body.max_tokens,1500);
assert.equal(wire[0].body.stream,true);
assert.equal(wire.length,1,'A token-limited stream must not trigger an unrequested second model call');

nextReason='stop';
nextText=JSON.stringify({
 title:'Learn Tarot',capability:'memorize tarot',
 level:'Beginner',mode:'Self-paced study',assumptions:'I have a tarot deck',
 proof:'Perform an independent card reading',
 modules:[{title:'Major Arcana',focus:'Study tarot cards',outcome:'Recall the cards'},
 {title:'Minor Arcana',focus:'Review suits',outcome:'Name the suits'},
 {title:'Spreads',focus:'Practice tarot reading',outcome:'Read a spread'}]
});
const schema={type:'object',required:['level','mode','assumptions','modules'],properties:{
 level:{type:'string',enum:['beginner','intermediate','advanced']},
 mode:{type:'string',enum:['guided','browse','just-in-time']},
 assumptions:{type:'array',items:{type:'string'}},
 modules:{type:'array',minItems:3,items:{type:'object'}}
}};
const invalid=await call({responseFormat:'json',schema});
assert.equal(invalid.status,'invalid-response','Valid JSON with bad enums must remain invalid until safe downstream normalization');
assert.equal(invalid.actual.model,'qwen35-4b-native',
 'A failed schema check must still identify the model that actually produced the text');
assert.equal(invalid.actual.provider,'openai-compatible');
assert.equal(invalid.finishReason,'stop');
assert.equal(JSON.parse(invalid.outputText).assumptions,'I have a tarot deck');
assert.equal(wire.length,2,'Runtime must not silently repair invalid JSON when caller set maxRepairAttempts=0');

nextText='A complete native response';
const complete=await call();
assert.equal(complete.status,'success');
assert.equal(complete.finishReason,'stop');
assert.equal(complete.outputText,nextText);
assert.equal(wire.length,3);
console.log('PASS: actual SSE finish reason stops partial drafts, invalid schema retains Qwen attribution for bounded normalization, and complete streams remain valid');
