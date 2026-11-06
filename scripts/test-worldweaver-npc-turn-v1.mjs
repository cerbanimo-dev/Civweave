import assert from 'node:assert/strict';
import {parseNpcTurn,runNpcTurn} from '../public/app/shared/worldweaver-npc-turn-v1.mjs';

const actor={kind:'model',principalId:'pilot:1',modelId:'qwen3.5:4b',personaRef:'starling:kami'};
const npc={id:'npc:1',instanceId:'world:1',pilotPrincipalId:actor.principalId,
 modelId:actor.modelId,personaRef:actor.personaRef,name:'Kami',
 pilotPrompt:'Improvise fictional PvE play.',capabilities:['speak','move']};
const instance={id:'world:1',status:'live'};
let invocations=0,dispatches=0;
const world={
 snapshot:()=>({npcs:[{...npc}],instances:[instance]}),
 dispatch:(command,suppliedActor)=>{
   dispatches++;
   assert.equal(suppliedActor,actor);
   assert.equal(command.type,'queue-actions');
   return {intents:command.actions.map((a,i)=>({id:'intent:'+i,status:'queued',tool:a.tool}))};
 }
};
const input={world,npcId:npc.id,actor,verifyPilot:()=>true,allowInference:()=>true,
 invokeModel:async()=>{invocations++;return {actions:[{tool:'speak',args:{text:'The door is locked.'}}]}}};
assert.deepEqual(parseNpcTurn('{"actions":[{"tool":"move","args":{"to":"gate"}}]}'),
 [{tool:'move',args:{to:'gate'}}]);
assert.throws(()=>parseNpcTurn('{"actions":[{"tool":"speak","args":{}},{"tool":"move","args":{}},{"tool":"speak","args":{}},{"tool":"move","args":{}}]}'),/one to three/);
assert.deepEqual(await runNpcTurn(input),[{id:'intent:0',status:'queued',tool:'speak'}]);
assert.equal(invocations,1);assert.equal(dispatches,1);
await assert.rejects(runNpcTurn({...input,allowInference:()=>false}),/not authorized/);
assert.equal(invocations,1);assert.equal(dispatches,1);
await assert.rejects(runNpcTurn({...input,actor:{...actor,personaRef:'starling:aphra'}}),/identity mismatch/);
assert.equal(invocations,1);
await assert.rejects(runNpcTurn({...input,invokeModel:async()=>({actions:[{tool:'purchase',args:{}}]})}),/unauthorized tool/);
assert.equal(dispatches,1);
await assert.rejects(runNpcTurn({...input,invokeModel:async()=>({content:'not json'})}),/must be JSON/);
assert.equal(dispatches,1);
await assert.rejects(runNpcTurn({...input,context:'x'.repeat(6001)}),/bounded text/);
assert.equal(dispatches,1);
let first=true;
await assert.rejects(runNpcTurn({...input,verifyPilot:()=>first?(first=false,true):false}),/revoked/);
assert.equal(dispatches,1);
console.log('Worldweaver NPC turn adapter: PASS');
