import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('public/app/shared/civweave-model-runtime.js','utf8');
const render=fs.readFileSync('public/app/cabinets/living-school/living-school-cleanroom-render-v218.mjs','utf8');
const controller=fs.readFileSync('public/app/cabinets/living-school/living-school-cleanroom-v218.mjs','utf8');
assert.match(render,/resume-companion-generation/);
assert.match(controller,/civweave\.termux-companion\.resume-once\.v1/);
assert.match(controller,/generateCurriculumFromChat\(job\.request/);
assert.match(controller,/civweave\.termux-companion\.curriculum-job\.v1/);
assert.match(source,/invokeDurableCompanion\(body,request,context,signal,config\)/);
assert.match(source,/COMPANION_JOB_KEY/);
assert.match(source,/companionPaired\(\)/);

const pendingKey='civweave.termux-companion.curriculum-job.v1';
const resumeKey='civweave.termux-companion.resume-once.v1';
const pairKey='civweave.termux-companion.session-pairing.v1';
const localMap=new Map(),sessionMap=new Map([[pairKey,'a'.repeat(64)]]);
const storage=map=>({
  getItem:key=>map.get(key)||null,
  setItem:(key,value)=>map.set(key,String(value)),
  removeItem:key=>map.delete(key)
});
const sent=[],observed=[],finishedText='## Module 1: Foundations\nObjective: Learn the subject.';
let generationPostCount=0,firstBrowser=true,observerAbort;
const mockFetch=async(url,options={})=>{
  sent.push({url,method:options.method||'GET'});
  assert.match(url,/^http:\/\/127\.0\.0\.1:8766\/v1\/generations/);
  assert.equal(options.headers['X-Civweave-Token'],'a'.repeat(64));
  if(url.endsWith('/v1/generations')){
    generationPostCount++;
    assert.equal(options.method,'POST');
    const body=JSON.parse(options.body);
    assert.equal(body.messages.length,2);
    assert.equal(body.max_tokens,8192);
    assert.equal(body.model,'qwen35-4b-native');
    assert.match(body.client_key,/^[0-9a-f]{32}$/);
    return{ok:true,status:202,json:async()=>({accepted:true,job_id:'f'.repeat(32),reused:false})};
  }
  assert.equal(url.split('/').at(-1),'f'.repeat(32));
  if(firstBrowser){
    observerAbort.abort();
    throw new DOMException('Browser observer was suspended','AbortError');
  }
  return{ok:true,status:200,json:async()=>({
    id:'f'.repeat(32),state:'completed',model:'qwen35-4b-native',
    text:finishedText,characters:finishedText.length,finish_reason:'stop',
    usage:{completion_tokens:17,prompt_tokens:180}
  })};
};
function context(){
  const sandbox={console,URL,Date,Math,JSON,Map,Set,Object,Array,Promise,
    TextEncoder,TextDecoder,ReadableStream,AbortController,DOMException,
    setTimeout,clearTimeout,
    crypto:{getRandomValues(bytes){for(let i=0;i<bytes.length;i++)bytes[i]=i+1;return bytes}},
    localStorage:storage(localMap),sessionStorage:storage(sessionMap),
    fetch:mockFetch,CustomEvent:class{constructor(name,args){this.name=name;this.detail=args.detail}},
    dispatchEvent:()=>{},
  };
  sandbox.globalThis=sandbox;
  vm.runInNewContext(source,sandbox,{filename:'civweave-model-runtime.js'});
  return sandbox;
}
const request=(signal,onEvent)=>({
  purpose:'living-school-research-grounded-curriculum-v218.1',signal,
  executionProfile:'interactive',
  config:{provider:'openai-compatible',model:'qwen35-4b-native',
    endpoint:'http://127.0.0.1:8080/v1',timeoutMs:90000,maxTokens:8192,stream:true},
  context:{title:'Tarot Course',capability:'read and memorize the tarot',moduleCount:4,
    level:'beginner',mode:'guided',proofContract:'Independent reading',sources:[]},
  messages:[{role:'system',content:'Long wrapper will be discarded'},
    {role:'user',content:'Generate meaningful lessons'}],
  maxRepairAttempts:0,onEvent
});
let app=context();
observerAbort=new AbortController();
const first=await app.CivweaveModelRuntime.generate(request(observerAbort.signal,event=>observed.push(event)));
assert.ok(['cancelled','provider-error','timeout'].includes(first.status),
  'Suspending browser should end its observer but not erase Termux job');
const pending=JSON.parse(localMap.get(pendingKey));
assert.equal(pending.jobId,'f'.repeat(32));
assert.equal(pending.request.capability,'read and memorize the tarot');
assert.equal(generationPostCount,1);
firstBrowser=false;
sessionMap.set(resumeKey,JSON.stringify({jobId:pending.jobId,purpose:pending.purpose,capability:pending.capability}));
app=context();
const recovered=await app.CivweaveModelRuntime.generate(request(undefined,event=>observed.push(event)));
assert.equal(recovered.status,'success',JSON.stringify(recovered.error));
assert.equal(recovered.outputText,finishedText);
assert.equal(generationPostCount,1,'Recovery must never resubmit the inference task');
assert.ok(observed.some(event=>event.phase==='partial'&&event.accumulatedText===finishedText));
assert.ok(observed.some(event=>event.phase==='native-background-submitted'));
assert.equal(sessionMap.has(resumeKey),false,'Consume only explicit matching resume marker');
assert.equal(JSON.parse(localMap.get(pendingKey)).state,'completed');
console.log('PASS: Detached Termux job persists after browser abort, resumes exact job on a fresh page, restores model output without duplicate generation.');

// Run the canonical native click owner with isolated storage and transport. The
// foreground generation/resume keeps this owner busy until observation ends.
const clickStart=controller.indexOf('async function handleLivingSchoolClick(event){');
const clickEnd=controller.indexOf('\nfunction chatCurriculumData(',clickStart);
assert.ok(clickStart>=0&&clickEnd>clickStart,'Find the canonical native click owner');
const clickOwner=controller.slice(clickStart,clickEnd);
function clickFixture({busy=false,retryStarting=false,jobId='f'.repeat(32),pairing='a'.repeat(64),
  confirmed=true,disabled=false,action='cancel-companion-generation'}={}){
  const job={jobId,capability:'Learn note taking',clientKey:'c'.repeat(32),purpose:'living-school-research-grounded-curriculum-v218.1',state:'running'};
  const calls=[],writes=[],toasts=[];
  let confirmations=0,ordinaryActions=0;
  const target={disabled,dataset:{lsAction:action,jobId:'e'.repeat(32)}};
  const sandbox={busy,retryStarting,console,
    readJson:key=>{assert.equal(key,pendingKey);return job;},
    sessionStorage:{getItem:key=>{assert.equal(key,pairKey);return pairing;},
      setItem:(...args)=>writes.push(args),removeItem:(...args)=>writes.push(args)},
    localStorage:{removeItem:(...args)=>writes.push(args),setItem:(...args)=>writes.push(args)},
    confirm:()=>{confirmations++;return confirmed;},
    fetch:async(url,options)=>{calls.push({url,options});return{ok:true,status:200};},
    toastMessage:message=>toasts.push(message),
    actions:{'generate-curriculum':async()=>ordinaryActions++},
    markDispatch:()=>ordinaryActions++,generateCurriculumFromChat:async()=>ordinaryActions++,
    renderEnhanced:()=>ordinaryActions++,
  };
  vm.runInNewContext(clickOwner+'\nglobalThis.click=handleLivingSchoolClick;',sandbox,
    {filename:'living-school-cleanroom-v218.mjs:native-click-owner'});
  return{calls,writes,toasts,get confirmations(){return confirmations;},get ordinaryActions(){return ordinaryActions;},
    click:()=>sandbox.click({target:{closest:selector=>{assert.equal(selector,'[data-ls-action]');return target;}},
      preventDefault(){},stopImmediatePropagation(){}})};
}
for(const active of [{busy:true},{retryStarting:true},{busy:true,retryStarting:true}]){
  const fixture=clickFixture(active);
  await fixture.click();
  assert.equal(fixture.calls.length,1,'Explicit native cancellation must reach the accepted job while '+JSON.stringify(active));
  const {url,options}=fixture.calls[0];
  assert.equal(url,'http://127.0.0.1:8766/v1/generations/'+'f'.repeat(32)+'/cancel',
    'Cancel the current accepted job from storage, never an arbitrary control job ID');
  assert.equal(options.method,'POST');
  assert.equal(options.headers['X-Civweave-Token'],'a'.repeat(64));
  assert.equal(options.credentials,'omit');
  assert.equal(options.mode,'cors');
  assert.equal(options.body,'{}');
  assert.equal(fixture.confirmations,1);
  assert.equal(fixture.writes.length,0,'Cancellation must not dismiss the saved job or submit/resume inference');
  assert.equal(fixture.ordinaryActions,0);
  assert.match(fixture.toasts[0],/cancellation requested/);
  for(const action of ['generate-curriculum','resume-companion-generation','dismiss-companion-generation']){
    const blocked=clickFixture({...active,action});
    await blocked.click();
    assert.equal(blocked.calls.length+blocked.writes.length+blocked.ordinaryActions+blocked.confirmations,0,
      action+' must remain blocked while '+JSON.stringify(active));
  }
}
for(const options of [{disabled:true},{confirmed:false}]){
  const fixture=clickFixture({busy:true,...options});
  await fixture.click();
  assert.equal(fixture.calls.length,0,'Disabled or declined cancellation must not reach Termux');
}
for(const [options,message] of [[{jobId:''},/No accepted Companion job ID/],[{jobId:'../another-job'},/No accepted Companion job ID/],
  [{pairing:''},/Pair Termux Companion/],[{pairing:'not-a-pairing-key'},/Pair Termux Companion/]]){
  const fixture=clickFixture({busy:true,...options});
  await assert.rejects(fixture.click(),message);
  assert.equal(fixture.calls.length+fixture.confirmations,0,'Invalid job or pairing must fail before confirmation/transport');
}
console.log('PASS: Native cancellation bypasses only the busy/retry guard, authenticates the exact accepted Termux job, and preserves ordinary-action blocking.');
