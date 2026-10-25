import assert from 'node:assert/strict';
import test from 'node:test';
import {Worker} from 'node:worker_threads';

function preview({failure=false,forbiddenPreview=false}={}){return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./helpers/guide-full-dom-worker-v1.mjs',import.meta.url),{execArgv:['--experimental-vm-modules'],workerData:{entry:'/app/persistent-system-shell-v1.html',system:'anarchadia',scenario:'native-preview',staleModel:'qwen35-4b-litert-web',httpDelayMs:250,failure,forbiddenPreview}});
  const timer=setTimeout(()=>{worker.terminate();reject(new Error('Full native Merlin preview stopped responding.'))},40000);
  worker.once('message',result=>{clearTimeout(timer);resolve(result)});
  worker.once('error',error=>{clearTimeout(timer);reject(error)});
  worker.once('exit',code=>{clearTimeout(timer);if(code)reject(new Error(`Full native Merlin worker exited with ${code}`))});
})}

function assertStack(result){
  assert.equal(result.ok,true,JSON.stringify({error:result.error,errors:result.errors,inference:result.inference,resources:result.resources?.slice(-12),proposal:result.proposal},null,2));
  assert.deepEqual(result.blocked,[]);assert.deepEqual(result.errors,[]);
  assert.ok(result.storageEvents.every(event=>!event.trusted||event.url!==event.source),'The Node fixture must honor the browser rule that storage events exclude their writer.');
  assert.ok(result.resources.length>100,'Exercise the parent, child and complete shared loader graph.');
  for(const owner of ['anarchadia-console-v158.js','anarchadia-change-review-v165.js','civweave-model-runtime.js','fast-interactive-runtime-v192.js','minilm-response-router-v347.js','civweave-basic-value-model-v1.js','gemma4-structured-task-authority-v1.js','gemma4-litert-request-authority-v1.js','local-provider-authority-v1.js'])
    assert.ok(result.resources.some(resource=>resource.endsWith('/'+owner)),`Missing actual owner ${owner}`);
  assert.equal(result.inference,1,'The approved native request must produce one HTTP call, with no generic reviewer or substitute request.');
  assert.equal(result.http.length,1);const call=result.http[0];
  assert.equal(call.body.model,'qwen3.5:4b');assert.equal(call.body.think,false);
  assert.equal(call.body.format.properties.files,undefined,'Code has one authored source in the actual provider schema.');
  assert.deepEqual(call.body.format.required,['summary','preview']);
  assert.deepEqual(call.body.format.properties.preview.required,['html','css','js']);
  assert.equal(call.body.format.properties.valuation,undefined);
  assert.doesNotMatch(call.body.messages.map(item=>item.content).join('\n'),/CIVWEAVE BASIC VALUE GUIDE/);
  assert.equal(call.aborted,false,'No wrapper may abort the provider after the HTTP result has completed.');
  const budgets=result.requestTimers.filter(item=>item.owner.includes('makeController'));
  assert.ok(budgets.some(item=>item.ms===300000),'The actual base provider controller must retain the selected 300 second budget.');
  assert.ok(budgets.every(item=>item.ms===300000),'No extra base provider controller may silently impose a smaller deadline.');
  return call;
}

test('full parent and native Merlin preserve the Qwen preview request, budget, and candidate',{timeout:45000},async()=>{
  const result=await preview();assertStack(result);
  assert.equal(result.proposal.status,'preview-ready');assert.equal(result.proposal.approval.state,'approved');
  assert.equal(result.proposal.validation.valid,true);assert.equal(result.proposal.preview.generator,'configured-provider');
  assert.match(result.proposal.preview.srcdoc,/QA READY badge/);assert.match(result.proposal.patch.preview.js,/READY/);
  assert.equal(result.proposal.patch.files.length,3);
  const source=result.proposal.patch.preview;
  assert.deepEqual(result.proposal.patch.files,[{path:'preview/index.html',content:source.html},{path:'preview/styles.css',content:source.css},{path:'preview/app.js',content:source.js}]);
  assert.equal(result.reviewState,'review','The normal intake must persist a review before approval.');
  assert.equal(result.inferenceBeforeApproval,0,'Creating and opening review must not start generation.');
});

test('full native Merlin persists the actual HTTP rejection without a substitute preview',{timeout:45000},async()=>{
  const result=await preview({failure:true});assertStack(result);
  assert.equal(result.proposal.status,'failed');assert.equal(result.proposal.failedStage,'code-generation');
  assert.match(result.proposal.lastError,/503|QA native provider rejection/);
  assert.equal(result.proposal.preview,undefined);assert.equal(result.proposal.patch,undefined);
});

test('full native Merlin validates the exact source returned for the sandbox',{timeout:45000},async()=>{
  const result=await preview({forbiddenPreview:true});assertStack(result);
  assert.equal(result.proposal.status,'failed');assert.equal(result.proposal.failedStage,'validation');
  assert.equal(result.proposal.preview,undefined);assert.equal(result.proposal.validation.valid,false);
  assert.ok(result.proposal.validation.errors.some(error=>error.includes('Forbidden code pattern in preview/app.js')));
  assert.equal(result.proposal.patch.files.find(file=>file.path==='preview/app.js').content,result.proposal.patch.preview.js);
});
