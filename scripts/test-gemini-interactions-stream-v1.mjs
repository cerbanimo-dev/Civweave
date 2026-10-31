import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../public/extensions/civweave-gemini-interactions-v159.js',import.meta.url),'utf8');
const encoder=new TextEncoder();
const event=value=>'data: '+JSON.stringify(value)+'\n\n';
const candidate=(text,finishReason,index=0)=>({candidates:[{index,content:{parts:[{text}]},...(finishReason?{finishReason}:{})}]});
function response(text,{split=0,type='text/event-stream',status=200}={}){
  const bytes=encoder.encode(text);let cancelled=false;
  const body=new ReadableStream({start(controller){
    if(split)for(let at=0;at<bytes.length;at+=split)controller.enqueue(bytes.slice(at,at+split));
    else controller.enqueue(bytes);
    controller.close();
  },cancel(){cancelled=true}});
  return {value:new Response(body,{status,headers:{'content-type':type}}),cancelled:()=>cancelled};
}
function kit(fetcher,config={}){
  const calls=[],tokens=[],events=[];
  const selected={provider:'gemini',model:'gemini-test-flash',stream:true,apiKey:'test-session-key',externalConsent:true,...config};
  const original={version:'test',readSharedConfig:()=>selected,normalizeConfig:value=>value,
    resolveExecutionProfile:request=>request.executionProfile||'interactive',
    validateSchema:(value,schema)=>schema?.required?.filter(key=>!(key in value)).map(key=>`${key} required`)||[],
    generate:async()=>({status:'delegated',stream:{used:false}})};
  const context={console,TextEncoder,TextDecoder,Response,Headers,ReadableStream,AbortController,DOMException,URLSearchParams,
    setTimeout,clearTimeout,structuredClone,URL,CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}},
    location:{href:'https://civweave.test/creator-suite/index.html'},navigator:{},
    localStorage:{getItem:()=>null},dispatchEvent:event=>{events.push(event);return true},CivweaveModelRuntime:original,
    fetch:async(url,options)=>{calls.push({url,options});return fetcher(url,options)}};
  context.globalThis=context;vm.runInNewContext(source,context,{filename:'civweave-gemini-interactions-v159.js'});
  const generate=request=>context.CivweaveModelRuntime.generate({purpose:'creation-draft',messages:[{role:'user',content:'Write an original scene.'}],onToken:(text,meta)=>tokens.push({text,meta}),...request});
  return{calls,tokens,generate,original,context,events};
}

test('Gemini streams actual chunks before completion, preserves split UTF-8, and finishes once',async()=>{
  let finish;
  const pending=new Promise(resolve=>{finish=resolve});
  const first=event(candidate('First 🌿 '));
  const k=kit(()=>new Response(new ReadableStream({start(controller){
    const bytes=encoder.encode(first);for(const byte of bytes)controller.enqueue(Uint8Array.of(byte));
    pending.then(()=>{controller.enqueue(encoder.encode(event(candidate('second.','STOP'))+event({usageMetadata:{promptTokenCount:2,candidatesTokenCount:4,totalTokenCount:6}})));controller.close()});
  }}),{headers:{'content-type':'text/event-stream; charset=utf-8'}}));
  const generation=k.generate();await new Promise(setImmediate);
  assert.equal(k.tokens.filter(row=>!row.meta.done).map(row=>row.text).join(''),'First 🌿 ');
  assert.equal(k.tokens.filter(row=>row.meta.done).length,0);
  finish();const result=await generation;
  assert.equal(k.calls.length,1);assert.match(k.calls[0].url,/:streamGenerateContent\?alt=sse$/);
  assert.equal(k.calls[0].options.headers.accept,'text/event-stream');
  assert.equal(result.status,'success');assert.equal(result.outputText,'First 🌿 second.');
  assert.equal(result.stream.used,true);assert.equal(result.finishReason,'STOP');assert.equal(result.usage.totalTokens,6);
  assert.equal(k.tokens.filter(row=>row.meta.done).length,1);assert.equal(k.tokens.at(-1).text,'');
  assert.equal(k.tokens.at(-1).meta.status,'success');
});

test('only candidate zero visible text is emitted; thought parts and other candidates stay private',async()=>{
  const payload={candidates:[
    {index:1,content:{parts:[{text:'Other answer'}]},finishReason:'STOP'},
    {index:0,content:{parts:[{text:'Hidden deliberation',thought:true},{text:'Visible answer'}]},finishReason:'STOP'},
  ]};
  const k=kit(()=>response(': keepalive\r\n\r\n'+event(payload),{split:3}).value);
  const result=await k.generate();assert.equal(result.status,'success');assert.equal(result.outputText,'Visible answer');
  assert.ok(!JSON.stringify(k.tokens).includes('Hidden deliberation'));assert.ok(!JSON.stringify(k.tokens).includes('Other answer'));
  assert.equal(JSON.parse(k.calls[0].options.body).generationConfig.candidateCount,1);
});

test('structured streaming validates the same requested schema with zero repair generation',async()=>{
  const schema={type:'object',required:['title']};
  const k=kit(()=>response(event(candidate('{"other":1}','STOP'))).value);
  const result=await k.generate({schema});
  assert.equal(result.status,'invalid-response');assert.equal(result.structured.valid,false);
  assert.match(result.structured.errors.join(' '),/title/);assert.equal(k.calls.length,1);
  assert.deepEqual(JSON.parse(k.calls[0].options.body).generationConfig.responseFormat.text.schema,schema);
  assert.equal(k.tokens.at(-1).meta.status,'invalid-response');
});

test('missing schema validator fails closed and callback exceptions cannot fabricate transport failure',async()=>{
  const k=kit(()=>response(event(candidate('{"title":"A scene"}','STOP'))).value);
  delete k.original.validateSchema;
  const result=await k.generate({schema:{type:'object',required:['title']},onToken:()=>{throw new Error('UI callback failed')}});
  assert.equal(result.status,'invalid-response');assert.equal(result.stream.used,true);
  assert.match(result.structured.errors.join(' '),/validator.*unavailable/i);assert.equal(k.calls.length,1);
});

test('aborting from a fragment callback prevents later events in the same HTTP chunk',async()=>{
  const controller=new AbortController(),visible=[];
  const k=kit(()=>response(event(candidate('First'))+event(candidate('Do not emit','STOP'))).value);
  const result=await k.generate({signal:controller.signal,onToken:(text,meta)=>{if(!meta.done){visible.push(text);controller.abort()}}});
  assert.equal(result.status,'cancelled');assert.equal(visible.join(''),'First');assert.equal(result.outputText,'First');
});

test('higher-order content validation is reflected in the terminal callback',async()=>{
  const k=kit(()=>response(event(candidate('{"module":{}}','STOP'))).value);
  const result=await k.generate({purpose:'living-school-structure-single-v221',schema:{type:'object'}});
  assert.equal(result.status,'invalid-response');assert.equal(k.tokens.at(-1).meta.status,'invalid-response');
  assert.equal(k.tokens.filter(row=>row.meta.done).length,1);
});

for(const [name,wire,code] of [
  ['empty','',/empty|no.*text/i],
  ['malformed',event(candidate('Partial '))+'data: {broken}\n\n',/json|malformed/i],
  ['truncated',event(candidate('Partial without finish')),/finish|truncat|terminal/i],
  ['unfinished event',event(candidate('Partial '))+'data: {"candidates":',/truncat|event|json/i],
])test(`${name} stream fails visibly, preserves partial output and never retries inference`,async()=>{
  const k=kit(()=>response(wire,{split:5}).value),result=await k.generate();
  assert.notEqual(result.status,'success');assert.match(result.error.message,code);
  assert.equal(k.calls.length,1);assert.equal(k.tokens.filter(row=>row.meta.done).length,1);
  if(name!=='empty')assert.match(result.outputText,/Partial/);
  assert.equal(result.stream.used,name!=='empty');
});

test('token limits and safety blocks cannot look like successful completed drafts',async()=>{
  for(const [payload,finish] of [[candidate('Incomplete','MAX_TOKENS'),'MAX_TOKENS'],[{promptFeedback:{blockReason:'SAFETY'}},'']]){
    const k=kit(()=>response(event(payload)).value),result=await k.generate();
    assert.notEqual(result.status,'success');assert.equal(result.finishReason,finish);
    assert.match(result.error.code,/LIMIT|BLOCK|FINISH/);assert.equal(k.calls.length,1);
    assert.equal(k.tokens.at(-1).meta.done,true);
  }
});

test('HTTP failures and non-SSE responses do not create fake streamed callbacks or retry calls',async()=>{
  for(const value of [new Response(JSON.stringify({error:{message:'Rate limited',status:'RESOURCE_EXHAUSTED'}}),{status:429,headers:{'content-type':'application/json'}}),response(JSON.stringify(candidate('Whole response','STOP')),{type:'application/json'}).value]){
    const k=kit(()=>value),result=await k.generate();
    assert.equal(result.status,'provider-error');assert.equal(result.stream.used,false);
    assert.equal(result.outputText,'');assert.equal(k.calls.length,1);
    assert.equal(k.tokens.length,1);assert.equal(k.tokens[0].meta.done,true);
  }
});

test('cancellation stops a pending read, preserves text, and emits one terminal cancellation',async()=>{
  let cancelled=false;
  const controller=new AbortController(),k=kit(()=>new Response(new ReadableStream({
    start(target){target.enqueue(encoder.encode(event(candidate('Saved partial'))))},
    cancel(){cancelled=true},
  }),{headers:{'content-type':'text/event-stream'}}));
  const generation=k.generate({signal:controller.signal});await new Promise(setImmediate);controller.abort();
  const result=await generation;
  assert.equal(result.status,'cancelled');assert.equal(result.outputText,'Saved partial');
  assert.equal(result.stream.used,true);assert.equal(cancelled,true);
  assert.equal(k.tokens.filter(row=>row.meta.done).length,1);assert.equal(k.tokens.at(-1).meta.status,'cancelled');
});

test('pre-cancelled requests and missing consent never reach fetch',async()=>{
  const controller=new AbortController();controller.abort();
  const cancelled=kit(()=>{throw new Error('Must not fetch')});
  assert.equal((await cancelled.generate({signal:controller.signal})).status,'cancelled');assert.equal(cancelled.calls.length,0);
  for(const config of [{apiKey:''},{externalConsent:false}]){
    const k=kit(()=>{throw new Error('Must not fetch')},config),result=await k.generate();
    assert.equal(result.status,'provider-error');assert.equal(k.calls.length,0);assert.equal(result.stream.used,false);
  }
});

test('stream and event bounds cancel untrusted oversized responses without replay',async()=>{
  for(const wire of ['data: '+JSON.stringify({padding:'x'.repeat(270000)})+'\n\n',
    Array.from({length:9},()=>event(candidate('x'.repeat(64000)))).join('')]){
    const k=kit(()=>response(wire,{split:4096}).value),result=await k.generate();
    assert.equal(result.status,'provider-error');assert.match(result.error.code,/LIMIT/);
    assert.equal(k.calls.length,1);assert.ok(result.outputText.length<=524288);
  }
});

test('nonstream interactions remain compatible and agentic profile remains delegated',async()=>{
  const k=kit(()=>new Response(JSON.stringify({id:'interaction-1',status:'completed',output_text:'Complete text'}),{headers:{'content-type':'application/json'}}),{stream:false});
  const result=await k.generate();assert.equal(result.status,'success');assert.equal(result.stream.used,false);
  assert.match(k.calls[0].url,/\/interactions$/);
  const agentic=await k.generate({executionProfile:'agentic'});assert.equal(agentic.status,'delegated');assert.equal(k.calls.length,1);
});

test('actual SSE requests pass through the canonical Gemini rate governor',async()=>{
  const k=kit(()=>response(event(candidate('Paced visible draft','STOP'))).value);
  vm.runInNewContext(readFileSync(new URL('../public/app/gemini-rate-governor-v1.js',import.meta.url),'utf8'),k.context,{filename:'gemini-rate-governor-v1.js'});
  const result=await k.generate();
  assert.equal(result.status,'success');assert.equal(k.calls.length,1);
  const reservation=k.events.find(event=>event.type==='civweave:gemini-rate-governor');
  assert.ok(reservation,'Streaming bypassed the canonical provider budget.');
  assert.equal(reservation.detail.model,'gemini-test-flash');assert.equal(reservation.detail.rpm,5);
});

test('Creator Suite installs the canonical Gemini owners in the required load order',()=>{
  const html=readFileSync(new URL('../public/creator-suite/index.html',import.meta.url),'utf8');
  const scripts=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(match=>match[1].split('?')[0]);
  const owners=['/app/shared/civweave-model-runtime.js','/app/gemini-rate-governor-v1.js','/app/gemini-device-direct-v257.js','/extensions/civweave-gemini-interactions-v159.js'];
  let prior=-1;
  for(const owner of owners){const index=scripts.indexOf(owner);assert.ok(index>prior,`Creator Suite must load ${owner} after its canonical dependencies.`);prior=index;}
});
