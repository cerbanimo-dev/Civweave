import assert from 'node:assert/strict';
import test from 'node:test';
import {Worker} from 'node:worker_threads';

// The timeout lives outside the DOM worker: a browser event-loop regression
// must fail this test even when the page cannot run its own timers anymore.
function page(entry,staleModel){return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./helpers/guide-full-dom-worker-v1.mjs',import.meta.url),{
    execArgv:['--experimental-vm-modules'],workerData:{entry,staleModel},
  });
  const timeout=setTimeout(()=>{worker.terminate();reject(new Error(`Full DOM page stopped responding: ${entry}`))},30000);
  worker.once('message',result=>{clearTimeout(timeout);resolve(result)});
  worker.once('error',error=>{clearTimeout(timeout);reject(error)});
  worker.once('exit',code=>{clearTimeout(timeout);if(code)reject(new Error(`Full DOM worker exited with ${code}`))});
})}

for(const entry of ['/app/working-campus-v440.html','/app/persistent-system-shell-v1.html'])test(`full canonical page settles and approves a real Ollama Manifest: ${entry}`,{timeout:35000},async()=>{
  const result=await page(entry,'qwen35-4b-litert-web');
  assert.equal(result.ok,true,result.error);
  assert.deepEqual(result.blocked,[],'startup must not exhaust a mutation or microtask budget');
  assert.deepEqual(result.errors,[],'all classic and module owners must execute successfully');
  assert.ok(result.heartbeat>5,'ordinary timer work remains responsive');
  assert.ok(result.resources.length>100,'exercise the complete page graph instead of isolated wrappers');
  for(const owner of ['guide-chat-surface-v350.js','gemma4-structured-task-authority-v1.js','gemma4-litert-request-authority-v1.js','local-provider-authority-v1.js','guide-contracts-v141.js','shared-review-surface-v234.js','moss-learning-plan-approval-button-v1.js'])
    assert.ok(result.resources.some(resource=>resource.endsWith('/'+owner)),`missing real owner ${owner}`);
  assert.equal(result.inference,1,'one selected-provider request creates the draft; review and approval need no second generation');
  assert.equal(result.requestAuthorityReady,true,'registry readiness must agree with the loaded request authority version');
  assert.equal(result.requestAuthorityVersion,'1.2.34-local-litert-request-authority-v1-idempotent-tracker');
  assert.equal(result.state.busy,false);
  assert.equal(result.state.selectedLocalModel,'','a stale downloaded choice must not override Ollama');
  assert.equal(result.actions.length,1);assert.equal(result.actions[0].state,'review');
  assert.equal(result.actions[0].canonicalArtifact,'Manifest');
  assert.equal(result.actions[0].fields.quantity,'2 notebooks');
  assert.equal(result.actions[0].fields.area,'Albany, NY');
  assert.ok(result.gateButtons.some(button=>button.action==='open-action'&&button.id===result.actions[0].id));
  assert.match(result.reviewText,/Albany, NY/);
  assert.equal(result.finalActions[0].state,'published');
  assert.equal(result.published.length,1);
  assert.equal(result.published[0].civweaveActionId,result.actions[0].id);
  assert.equal(result.stableBubble,true,'opening and approving a saved draft must retain the final answer bubble');
  assert.ok((result.events['civweave:structured-task-authority-ready']||0)<40,'ready events only describe changed installations');
});
