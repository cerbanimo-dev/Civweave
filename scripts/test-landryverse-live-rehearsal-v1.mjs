import test from 'node:test';
import assert from 'node:assert/strict';
import {loadLandryverseInputs} from './build-landryverse-story-v1.mjs';
import {
 planLandryverseRehearsal,
 runLandryverseRehearsal,
 validateLandryverseBinding
} from './run-landryverse-live-rehearsal-v1.mjs';

const inputs=await loadLandryverseInputs();
const localBinding={provider:'ollama',model:'qwen3.5:4b',endpoint:'http://127.0.0.1:11434'};

test('a live rehearsal plan is noncanonical, bounded and sequential',()=>{
 const plan=planLandryverseRehearsal(inputs);
 assert.equal(plan.length,8);
 assert.deepEqual(plan.map(x=>x.actor),['landry','delia','maggie','magnus','merlin','gaia-kami','diner-child','landry']);
 assert.ok(plan.every(x=>x.scene==='diner'&&x.mode==='private-preview'));
 assert.ok(plan.every(x=>!JSON.stringify(x).match(/Other Landry|counterpart-landry|Auction Registrar/i)));
});

test('default execution cannot send any story context without an explicit inference adapter',async()=>{
 await assert.rejects(runLandryverseRehearsal({inputs,bindings:{default:localBinding}}),/invokeModel|model adapter/i);
});

test('per-character model prompts do not reveal another actor private knowledge',async()=>{
 const requests=[];
 const invokeModel=async(binding,messages)=>{
  requests.push({binding,messages});
  return {text:'I can only respond to what I have heard.',elapsedMs:15,tokens:16};
 };
 const out=await runLandryverseRehearsal({
  inputs,
  bindings:{default:localBinding,characters:{'landry':{model:'qwen3.5:2b'}}},
  invokeModel
 });
 assert.equal(requests.length,8);
 assert.equal(out.modelCalls,8);
 assert.equal(out.status,'completed-model-invocations');
 assert.equal(out.canonChanges,0);
 assert.equal(out.worldWrites,0);
 assert.equal(out.authorApproval,'pending');
 assert.equal(out.turns.length,8);
 assert.equal(out.turns[0].model,'qwen3.5:2b');
 assert.equal(out.turns[1].model,'qwen3.5:4b');
 assert.equal(out.turns.at(-1).actor,'landry');
 assert.deepEqual(out.turns.map(x=>x.actor),['landry','delia','maggie','magnus','merlin','gaia-kami','diner-child','landry']);
 for(const r of requests){
  assert.equal(r.messages.length,2);
  assert.equal(r.messages[0].role,'system');
  assert.equal(r.messages[1].role,'user');
  assert.doesNotMatch(JSON.stringify(r.messages),/Other Landry|counterpart-landry|Auction Registrar|benevolent architect/i);
  assert.match(r.messages[0].content,/private preview/i);
  assert.match(r.messages[0].content,/no tool authority/i);
 }
});

test('rehearsal fails closed on a model failure, without inventing a completed scene',async()=>{
 let calls=0;
 await assert.rejects(runLandryverseRehearsal({
  inputs,bindings:{default:localBinding},
  invokeModel:async()=>{calls++;if(calls===3)throw Error('model unavailable');return {text:'Known.',elapsedMs:1};}
 }),/model unavailable/);
 assert.equal(calls,3);
});

test('rehearsal rejects empty or unbounded generated text',async()=>{
 await assert.rejects(runLandryverseRehearsal({
  inputs,bindings:{default:localBinding},
  invokeModel:async()=>({text:'   '})
 }),/Empty model response/);
 await assert.rejects(runLandryverseRehearsal({
  inputs,bindings:{default:localBinding},
  invokeModel:async()=>({text:'z'.repeat(3000)})
 }),/long model response/i);
});

test('model binding rejects unapproved provider or missing selected model',()=>{
 assert.throws(()=>validateLandryverseBinding({provider:'unknown',model:'foo',endpoint:'http://127.0.0.1:11434'}),/provider/);
 assert.throws(()=>validateLandryverseBinding({provider:'ollama',endpoint:'http://127.0.0.1:11434'}),/model/);
 assert.doesNotThrow(()=>validateLandryverseBinding(localBinding));
});
