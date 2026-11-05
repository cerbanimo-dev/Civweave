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
