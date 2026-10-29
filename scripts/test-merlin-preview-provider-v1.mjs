import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

const source=fs.readFileSync(new URL('../public/app/anarchadia-console-v158.js',import.meta.url),'utf8');
const reviewSource=fs.readFileSync(new URL('../public/app/anarchadia-change-review-v165.js',import.meta.url),'utf8');
const sharedSources=['shared/civweave-model-runtime.js','fast-interactive-runtime-v192.js','minilm-response-router-v347.js','civweave-basic-value-model-v1.js'].map(file=>({file,source:fs.readFileSync(new URL(`../public/app/${file}`,import.meta.url),'utf8')}));
const key='civweave.anarchadia.citizen-console.v139';
const fixture=()=>({id:'qa-preview',kind:'feature',title:'QA READY note',problem:'The fictional QA note is empty.',expected:'Show a button that writes READY into this sandbox note.',area:'Civweave',acceptance:['Clicking the button displays READY.'],risk:'Local fictional preview only.',approval:{state:'approved'},status:'approved',stage:'intake',pipeline:[],createdAt:new Date().toISOString()});
const patch={summary:'A working READY note.',preview:{html:'<button id="ready">Write READY</button><output id="note"></output>',css:'',js:'document.querySelector("#ready").onclick=()=>{document.querySelector("#note").textContent="READY"};'}};
const expectedFiles=preview=>[{path:'preview/index.html',content:preview.html},{path:'preview/styles.css',content:preview.css},{path:'preview/app.js',content:preview.js}];

function harness(runtime,{parentRuntime,loader,proposal=fixture()}={}){
  const dom=new JSDOM('<main id="ac-app" data-screen="home"></main><div id="ac-passport-id"></div><div id="ac-proposal-count"></div><div id="ac-participation"></div><div id="ac-momentum"></div><div id="ac-pipeline-list"></div><div id="ac-merlin-log"></div><form id="ac-request-form"></form><dialog id="ac-preview-dialog"></dialog><form id="ac-merlin-form"></form><div id="ac-toast" hidden></div>',{url:'https://civweave.test/app/anarchadia-console-v139.html',runScripts:'outside-only'});
  const {window}=dom;
  const nativeTimeout=window.setTimeout.bind(window);
  window.setTimeout=(callback,ms,...args)=>nativeTimeout(callback,ms>=1000?ms:0,...args);
  window.scrollTo=()=>{};
  window.CSS={escape:value=>String(value).replace(/["\\]/g,'\\$&')};
  const frames=[];
  window.requestAnimationFrame=callback=>{frames.push(callback);return frames.length};
  window.HTMLDialogElement.prototype.close=function(){this.open=false};
  if(runtime)window.CivweaveModelRuntime=runtime;
  if(loader)window.CivweaveFamilyAILoaderV105=loader;
  if(parentRuntime)Object.defineProperty(window,'parent',{value:{CivweaveModelRuntime:parentRuntime},configurable:true});
  window.localStorage.setItem(key,JSON.stringify({schema:'civweave.anarchadia-console.v1',passportId:'QA',proposals:[proposal],ledger:[],settings:{autoRun:false}}));
  window.eval(source);
  return{window,close:()=>window.close(),stored:()=>JSON.parse(window.localStorage.getItem(key)),run:()=>window.AnarchadiaCitizenConsoleV158.runPipeline('qa-preview'),flush:async()=>{for(let pass=0;pass<8;pass++){while(frames.length)frames.shift()(0);await Promise.resolve()}}};
}

test('Merlin opens the current review-only feature form without a removed auto-run control',()=>{
  const env=harness(null),errors=[];
  try{
    const document=env.window.document;
    document.querySelector('#ac-request-form').innerHTML='<input name="kind" type="hidden"><input name="title">';
    document.body.insertAdjacentHTML('beforeend','<div id="ac-request-kicker"></div><h2 id="ac-request-title"></h2><button data-request-kind="feature">Feature request</button>');
    env.window.addEventListener('error',event=>{errors.push(event.error);event.preventDefault()});
    document.querySelector('[data-request-kind]').click();
    assert.equal(errors.length,0,'Opening the current form must not reference removed controls.');
    assert.equal(document.querySelector('#ac-app').dataset.screen,'request');
    assert.equal(document.querySelector('#ac-request-form').elements.namedItem('kind').value,'feature');
    assert.equal(env.stored().proposals.length,1,'Opening intake does not generate or submit a proposal.');
  }finally{env.close()}
});

test('Merlin uses the selected interactive Ollama model when an agentic profile is absent',async()=>{
  const selected={provider:'ollama',model:'qa-ollama',endpoint:'http://127.0.0.1:11434/api/chat'},calls=[];
  const env=harness({readSharedConfig:profile=>profile==='interactive'?selected:null,generate:async request=>{calls.push(request);return{status:'success',actual:selected,outputJson:structuredClone(patch)}}});
  try{await env.run();assert.equal(calls.length,1,'one explicit preview request reaches the selected provider');assert.deepEqual(calls[0].config,selected);assert.equal(calls[0].executionProfile,'agentic');const item=env.stored().proposals[0];assert.equal(item.status,'preview-ready');assert.equal(item.preview.generator,'configured-provider');assert.match(item.preview.srcdoc,/Write READY/);assert.doesNotMatch(item.preview.srcdoc,/Record local proof/)}finally{env.close()}
});

test('a configured agentic profile remains authoritative for Merlin previews',async()=>{
  const selected={provider:'ollama',model:'qa-agentic'},calls=[];
  const env=harness({readSharedConfig:profile=>profile==='agentic'?selected:{provider:'ollama',model:'qa-interactive'},generate:async request=>{calls.push(request);return{status:'success',outputJson:structuredClone(patch)}}});
  try{await env.run();assert.equal(calls.length,1);assert.deepEqual(calls[0].config,selected);assert.equal(env.stored().proposals[0].status,'preview-ready')}finally{env.close()}
});

function installActualSharedPipeline(window,{failure=false}={}){
  const calls=[],selected={provider:'ollama',route:'ollama',model:'qa-actual-agentic',endpoint:'http://127.0.0.1:11434/api/chat',timeoutMs:300000,maxTokens:4096};
  window.localStorage.setItem('civweave-model-profiles-v1',JSON.stringify({interactive:{...selected,model:'qa-actual-interactive'},agentic:selected,agenticEnabled:true}));
  window.TextEncoder=TextEncoder;window.TextDecoder=TextDecoder;
  window.setInterval=()=>0;window.clearInterval=()=>{};
  window.fetch=async(url,init)=>{
    calls.push({url:String(url),body:JSON.parse(init.body)});
    if(failure)return new Response(JSON.stringify({error:'QA actual Ollama unavailable'}),{status:503,headers:{'content-type':'application/json'}});
    const output=structuredClone(patch);
    if(calls.length>1)output.preview.html='<p>Unrequested replacement from the automatic assistant reviewer.</p>';
    return new Response(JSON.stringify({model:'qa-actual-agentic',message:{role:'assistant',content:JSON.stringify(output)},done:true,done_reason:'stop'}),{headers:{'content-type':'application/json'}});
  };
  for(const entry of sharedSources)window.eval(`${entry.source}\n//# sourceURL=${entry.file}`);
  return{calls,selected};
}

test('native structured preview uses one actual shared-runtime HTTP call and preserves the compiled candidate',async()=>{
  const proposal={...fixture(),patch:{files:[{path:'OLD_INVALID_CANDIDATE',content:'OLD_INVALID_CANDIDATE'}]},pipeline:[{message:'PRIOR_FAILED_RUN_HISTORY'}],error:'PRIOR_FAILED_RUN_HISTORY'};
  const env=harness(null,{proposal});
  try{
    const {calls}=installActualSharedPipeline(env.window);
    await env.run();
    assert.equal(calls.length,1,'The native structured artifact must not start an additional generic assistant review job.');
    assert.equal(calls[0].body.model,'qa-actual-agentic','The configured agentic profile remains authoritative.');
    assert.equal(calls[0].body.think,false,'Only this explicit Ollama authoring request disables optional reasoning.');
    assert.equal(calls[0].body.format.properties.files,undefined,'The model must author code once rather than duplicating it in a second file array.');
    assert.deepEqual(calls[0].body.format.required,['summary','preview']);
    assert.deepEqual(calls[0].body.format.properties.preview.required,['html','css','js']);
    assert.equal(calls[0].body.format.properties.valuation,undefined,'Compiled preview source files are not economic valuation records.');
    assert.doesNotMatch(calls[0].body.messages.map(row=>row.content).join('\n'),/CIVWEAVE BASIC VALUE GUIDE/,'An unrelated economic system contract must not replace the code authoring instructions.');
    assert.doesNotMatch(calls[0].body.messages.map(row=>row.content).join('\n'),/OLD_INVALID_CANDIDATE|PRIOR_FAILED_RUN_HISTORY/,'A preview retry authors from the intake, without replaying old invalid source or pipeline history.');
    const item=env.stored().proposals[0];
    assert.equal(item.status,'preview-ready');
    assert.equal(item.patch.preview.html,patch.preview.html);
    assert.equal(item.patch.preview.js,patch.preview.js);
    assert.deepEqual(item.patch.files,expectedFiles(patch.preview),'Persisted export files must contain the exact rendered preview sources.');
    assert.match(item.preview.srcdoc,/Write READY/);
    assert.doesNotMatch(item.preview.srcdoc,/Unrequested replacement/);
    assert.equal(item.validation.valid,true,'Native sandbox validation still runs before preview installation.');
    assert.equal(item.approval.state,'approved');
    env.window.eval(reviewSource);
    assert.equal(env.window.AnarchadiaChangeReviewV165.selectPreview('qa-preview').ok,true);
    assert.equal(env.stored().proposals[0].previewDecision.state,'accepted');
    assert.equal(env.window.AnarchadiaChangeReviewV165.revertPreview('qa-preview').ok,true);
    assert.equal(env.stored().proposals[0].status,'review');
    assert.equal(env.stored().proposals[0].preview,undefined);
  }finally{env.close()}
});

test('one canonical preview source replaces contradictory provider file content before validation and persistence',async()=>{
  const output={...structuredClone(patch),files:[{path:'unrequested/OLD_FILE.bin',content:'OLD_BENIGN_BUT_DIFFERENT_CODE'}]},env=harness({readSharedConfig:()=>({provider:'ollama',model:'qa-source'}),generate:async()=>({status:'success',outputJson:output})});
  try{await env.run();const item=env.stored().proposals[0];assert.equal(item.status,'preview-ready');assert.deepEqual(item.patch.files,expectedFiles(output.preview));assert.doesNotMatch(JSON.stringify(item.patch),/OLD_BENIGN_BUT_DIFFERENT_CODE|OLD_FILE/);assert.equal(item.preview.srcdoc.includes(output.preview.html),true)}finally{env.close()}
});

for(const [field,code,path] of [['html','<script>document.cookie</script>','preview/index.html'],['css','</style><script>document.cookie</script><style>','preview/styles.css'],['js','fetch("https://example.test/forbidden")','preview/app.js']])test(`forbidden rendered ${field} is rejected even when old provider files are benign`,async()=>{
  const output={...structuredClone(patch),files:[{path:'preview/index.html',content:'<p>Benign old file</p>'}]};output.preview[field]=code;
  const env=harness({readSharedConfig:()=>({provider:'ollama',model:'qa-source'}),generate:async()=>({status:'success',outputJson:output})});
  try{await env.run();const item=env.stored().proposals[0];assert.equal(item.status,'failed');assert.equal(item.failedStage,'validation');assert.equal(item.preview,undefined);assert.equal(item.validation.valid,false);assert.ok(item.validation.errors.some(error=>error.includes(path)&&error.includes('Forbidden code pattern')));assert.deepEqual(item.patch.files,expectedFiles(output.preview))}finally{env.close()}
});

test('larger valid preview sources remain intact within the existing per-file bound',async()=>{
  const output=structuredClone(patch);output.preview.html='<main>'+('A'.repeat(100000))+'</main>';output.preview.css='/*'+('B'.repeat(50000))+'*/';output.preview.js='/*'+('C'.repeat(70000))+'*/';
  const env=harness({readSharedConfig:()=>({provider:'ollama',model:'qa-source'}),generate:async()=>({status:'success',outputJson:output})});
  try{await env.run();const item=env.stored().proposals[0];assert.equal(item.status,'preview-ready');assert.deepEqual(item.patch.files,expectedFiles(output.preview));assert.equal(item.patch.preview.html.length,output.preview.html.length);assert.equal(item.preview.srcdoc.includes(output.preview.js),true)}finally{env.close()}
});

test('oversized rendered code is rejected at the existing preview limit',async()=>{
  const output={...structuredClone(patch),files:[{path:'preview/index.html',content:'small old file'}]};output.preview.html='A'.repeat(120001);
  const env=harness({readSharedConfig:()=>({provider:'ollama',model:'qa-source'}),generate:async()=>({status:'success',outputJson:output})});
  try{await env.run();const item=env.stored().proposals[0];assert.equal(item.status,'failed');assert.equal(item.failedStage,'validation');assert.ok(item.validation.errors.some(error=>error.includes('File exceeds preview limit: preview/index.html')));assert.equal(item.preview,undefined)}finally{env.close()}
});

test('actual shared-runtime provider rejection remains visible without a reviewer or replacement preview',async()=>{
  const env=harness(null);
  try{
    const {calls}=installActualSharedPipeline(env.window,{failure:true});
    await env.run();
    assert.equal(calls.length,1);
    const item=env.stored().proposals[0];
    assert.equal(item.status,'failed');assert.equal(item.failedStage,'code-generation');
    assert.match(item.lastError,/503|QA actual Ollama unavailable/);
    assert.equal(item.patch,undefined);assert.equal(item.preview,undefined);
    assert.match(env.window.document.querySelector('#ac-toast').textContent,/failed/i);
  }finally{env.close()}
});

test('non-Ollama native authoring keeps its provider policy and uses the explicit structured caller bypass',async()=>{
  const calls=[],env=harness({readSharedConfig:()=>({provider:'openai-compatible',model:'qa-compatible'}),generate:async request=>{calls.push(request);return{status:'success',outputJson:structuredClone(patch)}}});
  try{await env.run();assert.equal(calls.length,1);assert.equal(calls[0].__civweaveSkipResponseRouter,true);assert.equal(Object.hasOwn(calls[0],'think'),false);assert.equal(calls[0].config.provider,'openai-compatible')}finally{env.close()}
});

for(const [label,generate] of [['provider rejection',async()=>{throw new Error('QA Ollama is offline')}],['failed provider result',async()=>({status:'failed',error:{message:'QA model rejected this request'}})],['invalid provider document',async()=>({status:'success',outputJson:{summary:'No preview artifact'}})]])test(`Merlin preserves ${label} visibly without a replacement scaffold`,async()=>{
  const env=harness({readSharedConfig:()=>({provider:'ollama',model:'qa-ollama'}),generate});
  try{await env.run();const item=env.stored().proposals[0];assert.equal(item.status,'failed');assert.equal(item.failedStage,'code-generation');assert.equal(item.preview,undefined);assert.equal(item.patch,undefined);assert.match(item.pipeline.at(-1).note,/QA|preview|provider/i);assert.match(env.window.document.querySelector('#ac-toast').textContent,/could not|failed|unavailable/i);env.window.eval(reviewSource);env.window.AnarchadiaCitizenConsoleV158.setScreen('automation');await env.flush();const card=env.window.document.querySelector('#ac-pipeline-list article');assert.match(card.querySelector('[data-ac165-state]').textContent,/failed/i);assert.doesNotMatch(card.textContent,/APPROVED · GENERATING/);assert.equal(card.querySelector('[data-ac165-failure]').textContent,item.lastError)}finally{env.close()}
});

test('Merlin reports a missing provider instead of claiming the generic scaffold fulfilled the request',async()=>{
  const env=harness(null);
  try{await env.run();const item=env.stored().proposals[0];assert.equal(item.status,'failed');assert.equal(item.preview,undefined);assert.match(item.pipeline.at(-1).note,/model|provider|runtime/i)}finally{env.close()}
});

test('Merlin can explicitly use the selected bundled scaffold while identifying its limited result',async()=>{
  let generated=0;
  const env=harness({readSharedConfig:()=>({provider:'bundled'}),generate:async()=>{generated++;throw new Error('Bundled scaffold must not invoke an unavailable model')}});
  try{await env.run();const item=env.stored().proposals[0];assert.equal(generated,0);assert.equal(item.status,'preview-ready');assert.equal(item.preview.generator,'civweave-safe-scaffolder');assert.match(item.patch.summary,/scaffold|request summary/i);assert.match(item.pipeline.at(-1).note,/scaffold|request summary/i)}finally{env.close()}
});

test('embedded Merlin uses the parent shared runtime without a second model path',async()=>{
  let generated=0;
  const env=harness(null,{parentRuntime:{readSharedConfig:()=>({provider:'ollama',model:'qa-parent'}),generate:async()=>{generated++;return{status:'success',outputJson:structuredClone(patch)}}}});
  try{await env.run();assert.equal(generated,1);assert.equal(env.stored().proposals[0].preview.generator,'configured-provider')}finally{env.close()}
});

test('a partial local runtime cannot hide the ready parent shared model runtime',async()=>{
  let generated=0;
  const env=harness({readSharedConfig:()=>({provider:'ollama',model:'qa-partial'})},{parentRuntime:{readSharedConfig:()=>({provider:'ollama',model:'qa-parent'}),generate:async request=>{assert.equal(request.config.model,'qa-parent');generated++;return{status:'success',outputJson:structuredClone(patch)}}}});
  try{await env.run();assert.equal(generated,1);assert.equal(env.stored().proposals[0].status,'preview-ready')}finally{env.close()}
});

test('explicit preview generation waits for the existing shared loader only when the runtime is absent',async()=>{
  let ensured=0,generated=0,env;
  const loader={ensure:async()=>{ensured++;env.window.CivweaveModelRuntime={readSharedConfig:()=>({provider:'ollama',model:'qa-lazy'}),generate:async()=>{generated++;return{status:'success',outputJson:structuredClone(patch)}}}}};
  env=harness(null,{loader});
  try{assert.equal(ensured,0,'page startup does not start inference readiness');await env.run();assert.equal(ensured,1);assert.equal(generated,1);assert.equal(env.stored().proposals[0].status,'preview-ready')}finally{env.close()}
});

test('Merlin approval reports a failed generation instead of claiming a preview exists',async()=>{
  const env=harness({readSharedConfig:()=>({provider:'ollama',model:'qa-ollama'}),generate:async()=>{throw new Error('QA Ollama is offline')}});
  try{env.window.eval(reviewSource);const result=await env.window.AnarchadiaChangeReviewV165.approveAndRun('qa-preview');assert.equal(result.ok,false);assert.match(result.error,/QA Ollama is offline/);assert.equal(env.stored().proposals[0].status,'failed')}finally{env.close()}
});

test('a failed explicit rerun cannot keep or present an earlier preview as the new result',async()=>{
  let generated=0;
  const env=harness({readSharedConfig:()=>({provider:'ollama',model:'qa-ollama'}),generate:async()=>{if(++generated===1)return{status:'success',outputJson:structuredClone(patch)};throw new Error('QA retry failed')}});
  try{await env.run();assert.ok(env.stored().proposals[0].preview);await env.run();const item=env.stored().proposals[0];assert.equal(item.status,'failed');assert.equal(item.preview,undefined);assert.equal(item.patch,undefined);env.window.eval(reviewSource);assert.equal(env.window.AnarchadiaChangeReviewV165.selectPreview('qa-preview').ok,false)}finally{env.close()}
});
