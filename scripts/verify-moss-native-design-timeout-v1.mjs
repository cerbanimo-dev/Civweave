import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const core=fs.readFileSync('public/app/cabinets/living-school/living-school-cleanroom-core-v218.mjs','utf8');
const budget=fs.readFileSync('public/app/living-school-generation-budget-v3.js','utf8');
const runtimeSource=fs.readFileSync('public/app/shared/civweave-model-runtime.js','utf8');
const index=fs.readFileSync('public/app/cabinets/living-school/index.html','utf8');
assert.match(core,/NATIVE_QWEN_DESIGN_TIMEOUT_MS=1200000/);
assert.match(core,/withNativeMossStream\([^\n]*,'design'\)/);
assert.match(core,/compactDesignEvidence\(sources\)/,'Bounded excerpts must enter the actual messages sent to Qwen');
assert.match(budget,/configuredTimeout\(config,DESIGN_TIMEOUT_MS\)/,'Budget must preserve design-specific requested deadline');
assert.match(index,/living-school-cleanroom-v218\.mjs\?v=structured-single-v221-boot-first-v9-qwen-design-prefill/);

const helpers=core.slice(core.indexOf('const NATIVE_QWEN_DESIGN_TIMEOUT_MS='),core.indexOf('function resultText('));
const scope={clean:(x,n=9999)=>String(x??'').slice(0,n),providerName:c=>String(c?.provider||c?.route||'').toLowerCase()};
const scoped=vm.runInNewContext(helpers+'\nwithNativeMossStream',scope);
const local={provider:'openai-compatible',model:'qwen35-4b-native',endpoint:'http://127.0.0.1:8080/v1',timeoutMs:90000,stream:false};
assert.equal(scoped(local,'design').timeoutMs,1200000);
assert.equal(scoped(local,'design').stream,true);
assert.equal(scoped(local,'').timeoutMs,90000);
assert.equal(scoped({...local,model:'other'},'design').timeoutMs,90000);
assert.equal(scoped({...local,endpoint:'http://192.168.1.5:8080/v1'},'design').timeoutMs,90000);
assert.equal(local.timeoutMs,90000,'Must not mutate saved settings');
const briefSource=core.slice(core.indexOf('function compactDesignEvidence('),core.indexOf('function requestedData('));
const brief=vm.runInNewContext(briefSource+'\ncompactDesignEvidence',scope);
const rows=Array.from({length:8},(_,i)=>({id:'ref-'+i,title:'Tarot '+i,notes:'description '.repeat(120),provenance:'knowledge-school-downloaded'}));
const shown=brief(rows);
assert.ok(shown.includes('SOURCE_ID ref-0')&&!shown.includes('SOURCE_ID ref-4'));
assert.ok(shown.length<5000,'Mobile prefill must not transmit entire downloaded archive');

const frames=[
  'data: '+JSON.stringify({choices:[{delta:{content:'Tarot lesson in progress'},finish_reason:null}]})+'\n\n',
  'data: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}],usage:{completion_tokens:5}})+'\n\n',
  'data: [DONE]\n\n'
].join('');
const bytes=new TextEncoder().encode(frames);
const calls=[],events=[];
const storage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
const ctx={console,Math,Date,URL,JSON,Object,Array,Promise,TextEncoder,TextDecoder,
  AbortController,DOMException,ReadableStream,setTimeout,clearTimeout,
  localStorage:storage,sessionStorage:storage,
  fetch:async(url,options)=>{
    calls.push({url,body:JSON.parse(options.body)});
    return{ok:true,status:200,headers:{get:()=> 'text/event-stream'},
      body:new ReadableStream({start(controller){
        for(let i=0;i<bytes.length;i+=20)controller.enqueue(bytes.slice(i,i+20));
        controller.close();
      }})};
  }
};
ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(runtimeSource,ctx);
async function checkPurpose(purpose,timeout){
  events.length=0;
  const response=await ctx.CivweaveModelRuntime.generate({
    purpose,executionProfile:'interactive',
    config:{...local,stream:true,timeoutMs:90000},
    messages:[{role:'user',content:'Draft a lesson.'}],
    onEvent:e=>events.push(e),
    maxRepairAttempts:0
  });
  assert.equal(response.status,'success');
  const connecting=events.find(e=>e.phase==='connecting');
  assert.equal(connecting.deadlineMs,timeout,'Incorrect deadline applied to '+purpose);
  assert.equal(connecting.promptCharacters,'Draft a lesson.'.length);
  assert.ok(events.some(e=>e.phase==='awaiting-first-token'),'Need explicit successful HTTP / prompt evaluation wait');
  assert.ok(events.some(e=>e.phase==='partial'&&e.accumulatedText.includes('Tarot lesson')));
  assert.ok(response.events.some(e=>e.phase==='partial'&&!e.accumulatedText),'Do not retain repeated full draft strings in event history');
}
await checkPurpose('living-school-research-grounded-curriculum-v218.1',1200000);
await checkPurpose('ordinary-chat',90000);
assert.equal(calls.length,2,'No hidden retry');
console.log('PASS: Local Qwen curriculum design overrides 90s to 20m; other prompts preserve deadlines, sources stay bounded, and native SSE gives first-token state.');
