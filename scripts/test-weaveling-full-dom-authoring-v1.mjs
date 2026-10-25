import assert from 'node:assert/strict';
import test from 'node:test';
import {Worker} from 'node:worker_threads';

test('the full browser graph sends one bounded Qwen Quest request and retains the final bubble',{timeout:65000},async()=>{
  const result=await new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./helpers/guide-full-dom-worker-v1.mjs',import.meta.url),{execArgv:['--experimental-vm-modules'],workerData:{entry:'/app/persistent-system-shell-v1.html',scenario:'quest'}});
    const timeout=setTimeout(()=>{worker.terminate();reject(new Error('Full Quest DOM fixture stopped responding.'))},60000);
    worker.once('message',value=>{clearTimeout(timeout);resolve(value)});worker.once('error',error=>{clearTimeout(timeout);reject(error)});
    worker.once('exit',code=>{clearTimeout(timeout);if(code)reject(new Error(`Quest worker exited ${code}`))});
  });
  assert.equal(result.ok,true,result.error);assert.deepEqual(result.errors,[]);assert.deepEqual(result.blocked,[]);
  assert.ok(result.resources.length>100);assert.equal(result.inference,1,'Structured authoring must not trigger a second generic answer/review.');
  const request=result.http[0].body;assert.equal(request.model,'qwen3.5:4b');assert.equal(request.think,false,'The real full-stack transport must preserve explicit non-thinking authoring.');
  assert.doesNotMatch(request.messages.map(row=>row.content).join('\n'),/Civweave guide planning contract v1/,'The canonical Quest schema must own its step counts and prerequisites without a competing prose-planning contract.');
  assert.ok(request.options.num_predict>=2200&&request.options.num_predict<=4096);assert.equal(request.options.num_ctx,8192);
  const saved=result.plans.find(item=>item.kind==='weave-plan');assert.ok(saved,result.text);assert.equal(saved.state,'review');
  assert.deepEqual(saved.plan.paths.map(path=>path.realm),['anarchadia','fellowfare','living-school','cerbanimo']);
  assert.equal(saved.plan.requiresExplicitActivation,true);assert.equal(result.stableBubble,true);
});
