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
