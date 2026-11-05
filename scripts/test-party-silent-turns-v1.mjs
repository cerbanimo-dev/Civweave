import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const file=new URL('../public/app/shared-intention-party-chat-v1.js',import.meta.url);
const source=readFileSync(file,'utf8');
function policy(){
  const match=source.match(/function partyTurnTargets\(\{prompt,mentions\}\)\{[^\n]+\}/);
  assert.ok(match,'Party must expose a deterministic silent-by-default target policy');
  return new Function('SYSTEMS','return ('+match[0]+')')(['civweave','living-school','cerbanimo','fellowfare','anarchadia']);
}
test('AI remains silent when the human has not enabled prompting',()=>{
  const targets=policy();
  assert.deepEqual(targets({prompt:false,mentions:['civweave']}),[]);
});
test('AI remains silent without an explicit @guide address',()=>{
  const targets=policy();
  assert.deepEqual(targets({prompt:true,mentions:[]}),[]);
});
test('explicit mentions are de-duplicated with bounded turns',()=>{
  const targets=policy();
  assert.deepEqual(targets({prompt:true,mentions:['civweave','civweave','living-school']}),['civweave','living-school']);
  assert.deepEqual(targets({prompt:true,mentions:['civweave','living-school','cerbanimo','fellowfare','anarchadia']}),['civweave','living-school']);
});
test('one shared in-flight turn owner prevents overlapping prompts',()=>{
  assert.match(source,/const partyTurnBusy=new Set\(\)/);
  assert.match(source,/partyTurnBusy\.has\(plan\.id\)/);
  assert.match(source,/partyTurnBusy\.add\(plan\.id\)/);
  assert.match(source,/partyTurnBusy\.delete\(plan\.id\)/);
});
test('incoming network packets never prompt a model',()=>{
  const ingest=source.slice(source.indexOf('async function ingestPacket('),source.indexOf('async function sendWebRtc('));
  assert.doesNotMatch(ingest,/aiReply\(|assistant\.respond\(/);
});

test('Party interruption uses abort signal and prevents a cancelled response from being published',()=>{
  assert.match(source,/const partyTurnControllers=new Map\(\)/);
  assert.match(source,/function cancelPartyTurn\(planId\)/);
  assert.match(source,/controller\.abort\(\)/);
  assert.match(source,/signal:controller\.signal/);
  assert.match(source,/if\(controller\.signal\.aborted\)return null/);
});
test('a visible Stop reply control only exists while an AI turn runs',()=>{
  assert.match(source,/data-party-stop/);
  assert.match(source,/partyTurnBusy\.has\(plan\.id\)/);
  assert.match(source,/target\.closest\('\[data-party-stop\]'\)/);
});
test('turn cleanup and prompt-off discard stale replies',()=>{
  assert.match(source,/partyTurnControllers\.delete\(plan\.id\)/);
  assert.match(source,/partyTurnBusy\.delete\(plan\.id\)/);
  assert.match(source,/if\(!value\)cancelPartyTurn\(planId\)/);
});

function replyHarness(){
  const match=source.match(/async function aiReply\(plan,system,text,sourceMessage,controller\)\{[^\n]+\}/);
  assert.ok(match,'Canonical AI reply function must be found');
  const writes=[],broadcasts=[];
  let finish;
  const response=new Promise(resolve=>{finish=resolve});
  const assistant={respond:()=>response};
  const globals={CivweaveFamilyAILoaderV105:{ensure:async()=>{}},CivweaveAssistantV141:assistant};
  const fn=new Function('globalThis','currentSystem','historyForParty','clean','GUIDE','MESSAGE_SCHEMA','uid','now','readParty','writeParty','broadcastPayload','Number','return ('+match[0]+')')(
    globals,()=> 'civweave',()=>[],(value,max=12000)=>String(value||'').slice(0,max),
    {civweave:{name:'Weaveling'}},'test-schema',()=> 'response-1',()=> '2026-11-05T00:00:00Z',
    ()=>({messages:[]}),(_id,party)=>writes.push(party),
    async(_plan,data)=>{broadcasts.push(data)},Number
  );
  return {fn,finish,writes,broadcasts};
}
test('interrupted slow providers cannot persist or broadcast a late reply',async()=>{
  const harness=replyHarness(),controller=new AbortController();
  const pending=harness.fn({id:'p1'},'civweave','hello',{id:'h1'},controller);
  await Promise.resolve();
  controller.abort();
  harness.finish({response:{answer:'stale answer'}});
  assert.equal(await pending,null);
  assert.equal(harness.writes.length,0);
  assert.equal(harness.broadcasts.length,0);
});
test('uncancelled replies still enter the existing Party transcript and transport',async()=>{
  const harness=replyHarness(),controller=new AbortController();
  const pending=harness.fn({id:'p1'},'civweave','hello',{id:'h1'},controller);
  await Promise.resolve();
  harness.finish({response:{answer:'permitted answer'}});
  const result=await pending;
  assert.equal(result.text,'permitted answer');
  assert.equal(harness.writes.length,1);
  assert.equal(harness.broadcasts.length,1);
});
