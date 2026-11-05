import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createStoryReplay,SHADOW_THREAD_REPLAY} from '../public/app/shared/worldweaver-story-replay-v1.mjs';
import {resolveShadowThreadActors,improviseShadowThreadActor,improviseShadowThreadRound} from '../public/app/shared/worldweaver-shadow-thread-actors-v1.mjs';

test('fresh second turn opens the continuity docket with all three actor IDs',async()=>{
 const fixture=JSON.parse(await readFile(new URL('../examples/worldweaver/shadow-thread-playtest-002.json',import.meta.url),'utf8'));
 const replay=createStoryReplay();
 for(const id of ['listen-to-fruitfly','follow-zip','audit-the-docket'])replay.choose(id);
 const view=replay.view();
 assert.equal(view.nodeId,'audit-hatch-docket');
 assert.deepEqual(view.beats,fixture.beats);
 assert.deepEqual(view.clues.filter(c=>fixture.result.clues.includes(c)),fixture.result.clues);
 assert.deepEqual(view.beats.filter(b=>b.canonicalId).map(b=>b.canonicalId),['raven','erin','lari','raven','erin']);
 assert.equal(view.complete,false);
 replay.choose('challenge-contract');
 assert.equal(replay.view().ending,'challenge-accepted');
});

test('original avatar binds only reviewed known assets or reviewed cast packet',()=>{
 const actors=resolveShadowThreadActors();
 assert.deepEqual(actors.map(x=>x.canonicalId),['raven','erin','lari']);
 assert.equal(actors[0].avatarRef,null);
 assert.equal(actors[1].avatarRef,null);
 assert.equal(actors[2].avatarRef,'/app/assets/ai/lari-review-sprites-v1.png');
 assert.equal(actors[2].avatarResolved,true);
 assert.notEqual(actors[2].worldName,actors[2].canonicalName);
 assert.throws(()=>resolveShadowThreadActors({castPacket:{characters:[{id:'raven',avatarRef:'/bad'}]}}),/Unrecognized|Invalid/);
});

test('model rehearsal calls existing runtime on user request, never changes scripted history',async()=>{
 const replay=createStoryReplay();
 replay.choose('listen-to-fruitfly');
 const before=JSON.stringify(replay.snapshot());
 const calls=[];
 const runtime={async generate(request){
  calls.push(request);
  return {status:'success',actual:{provider:'browser',model:'test-local-model'},outputText:'I see the register, Nell. What do you choose to challenge?'};
 }};
 const output=await improviseShadowThreadActor({replay,actorId:'raven',modelRuntime:runtime,playerPrompt:'Ask about the hidden register'});
 assert.equal(output.canonicalId,'raven');
 assert.equal(output.liveActorDeployed,false);
 assert.equal(output.canonicalHistoryChanged,false);
 assert.equal(output.requiresAuthorReview,true);
 assert.equal(output.source,'model-generated-private-rehearsal');
 assert.equal(output.modelProvider,'browser');
 assert.equal(calls.length,1);
 assert.equal(calls[0].requireExternalConsent,true);
 assert.equal(calls[0].executionProfile,'interactive');
 assert.equal(calls[0].purpose,'worldweaver-shadow-thread-actor-rehearsal-v1');
 assert.equal(calls[0].config.maxTokens,220);
 assert.match(calls[0].messages[0].content,/fictional/);
 assert.equal(JSON.stringify(replay.snapshot()),before);
});

test('three-actor round runs sequentially and keeps each actor distinct',async()=>{
 const calls=[];
 const replay=createStoryReplay();
 const runtime={async generate(req){
  calls.push(req);
  return {status:'success',actual:{provider:'ollama',model:'qwen3.5:4b'},outputText:'This document is not consent. We must ask Nell what she wants.'};
 }};
 const round=await improviseShadowThreadRound({replay,modelRuntime:runtime});
 assert.deepEqual(round.map(t=>t.canonicalId),['raven','erin','lari']);
 assert.equal(calls.length,3);
 assert.match(calls[1].messages[1].content,/Earlier noncanonical actor proposals/);
 assert.match(calls[2].messages[1].content,/Dr. Raven Vale/);
 assert.equal(replay.snapshot().revision,0);
});

test('no model, synthetic deterministic response, invalid actors, or remote consent failure are accepted',async()=>{
 const replay=createStoryReplay();
 await assert.rejects(improviseShadowThreadActor({replay,actorId:'erin'}),/existing selected/);
 await assert.rejects(improviseShadowThreadActor({replay,actorId:'ghost',modelRuntime:{generate(){}}}),/Unknown story actor/);
 const bad={generate:async()=>({status:'manual-required',actual:{provider:'manual'},outputText:'Please run me'})};
 await assert.rejects(improviseShadowThreadActor({replay,actorId:'lari',modelRuntime:bad}),/No successful authorized/);
 const synthetic={generate:async()=>({status:'success',actual:{provider:'deterministic'},outputText:'a made-up test transcript'})};
 await assert.rejects(improviseShadowThreadActor({replay,actorId:'lari',modelRuntime:synthetic}),/No successful authorized/);
 const remote={generate:async()=>({status:'provider-error',actual:{provider:'hosted'},outputText:'not authorized'})};
 await assert.rejects(improviseShadowThreadActor({replay,actorId:'raven',modelRuntime:remote}),/No successful authorized/);
});

test('replay page exposes opt-in human action, locally linked model runtime, and no automatic inference',async()=>{
 const html=await readFile(new URL('../public/app/tools/shadow-thread-replay.html',import.meta.url),'utf8');
 assert.match(html,/src="\.\.\/shared\/civweave-model-runtime\.js"/);
 assert.match(html,/id="actor-one"/);
 assert.match(html,/id="actor-round"/);
 assert.match(html,/id="cast-file"/);
 assert.match(html,/actor-one'\)\.addEventListener\('click'/);
 assert.match(html,/actor-round'\)\.addEventListener\('click'/);
 assert.match(html,/img\.src=actor\.avatarRef/);
 assert.match(html,/private proposals/);
 assert.doesNotMatch(html,/<iframe/i);
});
