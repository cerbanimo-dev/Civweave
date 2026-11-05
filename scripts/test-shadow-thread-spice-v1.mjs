import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createStoryReplay,SHADOW_THREAD_REPLAY,encodeReplayTrail,decodeReplayTrail} from '../public/app/shared/worldweaver-story-replay-v1.mjs';

const walk=(replay,ids)=>{for(const id of ids)replay.choose(id);return replay;};
const route=['listen-to-fruitfly','follow-zip','audit-the-docket'];
const proof=['conflicting discharge dates','no present-tense signatures','missing CURRENT register'];

test('caseboard is a private evidence puzzle, unavailable without discovered clues',()=>{
 const game=createStoryReplay();
 assert.deepEqual(game.view().caseboard,null);
 assert.throws(()=>game.solveCase(proof),/not available/i);
 walk(game,route);
 assert.equal(game.view().nodeId,'audit-hatch-docket');
 assert.equal(game.view().caseboard?.title,'The Signature That Never Happened');
 assert.ok(game.view().clues.length>=proof.length);
 assert.ok(proof.every(x=>game.view().caseboard.choices.includes(x)));
 assert.equal(game.view().choices.some(c=>c.id==='reconcile-evidence'),false);
 assert.throws(()=>game.choose('reconcile-evidence'),/caseboard|evidence|unavailable/i);
});

test('caseboard rejects bad evidence without mutating saved history and reveals a hidden bigfixer resolution',()=>{
 const game=walk(createStoryReplay(),route);
 const before=game.snapshot();
 assert.throws(()=>game.solveCase(['missing CURRENT register']),/evidence|finding/i);
 assert.deepEqual(game.snapshot(),before);
 assert.throws(()=>game.solveCase([...proof,'invented evidence']),/evidence|finding/i);
 assert.deepEqual(game.snapshot(),before);
 const scene=game.solveCase([...proof].reverse());
 assert.equal(scene.nodeId,'bigfixer-accord');
 assert.ok(scene.beats.some(b=>b.speaker==='Zip'));
 assert.ok(scene.beats.some(b=>b.canonicalId==='lari'));
 assert.ok(scene.ending);
 assert.ok(scene.clues.includes('present-tense consent audit established'));
 assert.equal(game.snapshot().history.at(-1).choiceId,'reconcile-evidence');
 assert.throws(()=>game.choose('reconcile-evidence'),/unavailable|final/i);
});

test('old saved choices still restore and a forged hidden ending cannot be imported',()=>{
 const game=walk(createStoryReplay(),route);
 const old=game.snapshot();
 const resumed=createStoryReplay({initialState:old});
 assert.deepEqual(resumed.snapshot(),old);
 const forged=structuredClone(old);forged.history.push({from:'audit-hatch-docket',choiceId:'reconcile-evidence',to:'bigfixer-accord'});
 assert.throws(()=>createStoryReplay({initialState:forged}),/caseboard|evidence|unavailable/i);
 const real=createStoryReplay();walk(real,route);real.solveCase(proof);
 const restored=createStoryReplay({initialState:real.snapshot()});
 assert.equal(restored.view().nodeId,'bigfixer-accord');
 assert.equal(restored.view().ending,real.view().ending);
});

test('what-if mirror previews alternative scene but never mutates the main route',()=>{
 const game=walk(createStoryReplay(),route);
 const before=game.snapshot();
 const options=game.alternativesAt(0);
 assert.ok(options.some(c=>c.id==='inspect-discharge-records'));
 const preview=game.forkAt(0,'inspect-discharge-records');
 assert.equal(preview.nodeId,'inspect-discharge-records');
 assert.equal(preview.history.length,1);
 assert.deepEqual(game.snapshot(),before);
 assert.throws(()=>game.forkAt(0,'challenge-contract'),/unavailable/i);
 assert.throws(()=>game.alternativesAt(-1),/step/i);
 assert.throws(()=>game.alternativesAt(100),/step/i);
});

test('what-if mirror adopts a chosen alternative only on explicit action and remains exportable',()=>{
 const game=walk(createStoryReplay(),route);
 const view=game.adoptFork(1,'inspect-contract');
 assert.equal(view.nodeId,'inspect-contract');
 assert.equal(view.history.length,2);
 assert.equal(view.history[0].choiceId,'listen-to-fruitfly');
 assert.equal(view.history[1].choiceId,'inspect-contract');
 assert.deepEqual(createStoryReplay({initialState:game.snapshot()}).snapshot(),game.snapshot());
 assert.equal(game.view().caseboard,null);
});

test('share trail is only story choices; never includes model text, clues, personal data or hints',()=>{
 const game=walk(createStoryReplay(),route);
 game.setAngelIntimation(true);
 const code=encodeReplayTrail(game);
 assert.match(code,/^v1:/);
 assert.match(code,/listen-to-fruitfly/);
 assert.doesNotMatch(code,/Raven|Nell|model|hint|clues|signature|name/i);
 const restored=decodeReplayTrail(code);
 assert.equal(restored.view().nodeId,game.view().nodeId);
 assert.equal(restored.view().angelIntimation.enabled,false);
 assert.deepEqual(restored.view().history,game.view().history);
 assert.throws(()=>decodeReplayTrail('v1:../../other'),/invalid|unavailable/i);
 assert.throws(()=>decodeReplayTrail('v2:listen-to-fruitfly'),/version|invalid/i);
 assert.throws(()=>decodeReplayTrail('v1:reconcile-evidence'),/unavailable|evidence/i);
 assert.throws(()=>decodeReplayTrail('v1:'+('x'.repeat(1500))),/long|invalid/i);
});

test('bigfixer ending remains optional; established opt-out route is always available',()=>{
 const exit=createStoryReplay().choose('decline-and-exit');
 assert.equal(exit.ending,'voluntary-exit');
 const replay=walk(createStoryReplay(),route);
 assert.ok(replay.view().choices.some(x=>x.id==='decline-and-exit'));
 assert.ok(replay.view().choices.some(x=>x.id==='challenge-contract'));
 assert.equal(replay.view().angelIntimation.enabled,false);
});

test('player page offers evidence, mirror and share-link actions without second chat or automatic AI',async()=>{
 const html=await readFile(new URL('../public/app/tools/shadow-thread-replay.html',import.meta.url),'utf8');
 for(const id of ['caseboard','case-choices','solve-case','mirror','fork-step','fork-choice','fork-preview','fork-adopt','share-path','shared-trail'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/encodeReplayTrail/);
 assert.match(html,/decodeReplayTrail/);
 assert.match(html,/prefers-reduced-motion/);
 assert.match(html,/data-mood/);
 assert.doesNotMatch(html,/<iframe/i);
 assert.doesNotMatch(html,/innerHTML\s*=/);
});

test('solved secret ending can be shared as a clean choice-only trail',()=>{
 const game=walk(createStoryReplay(),route);
 game.solveCase(proof);
 const token=encodeReplayTrail(game);
 assert.match(token,/reconcile-evidence$/);
 const reconstructed=decodeReplayTrail(token);
 assert.equal(reconstructed.view().ending,'bigfixer-first-accord');
 assert.deepEqual(reconstructed.view().clues,game.view().clues);
 assert.deepEqual(reconstructed.view().history,game.view().history);
});

test('restoring a solved puzzle strips untrusted proof metadata',()=>{
 const game=walk(createStoryReplay(),route);
 game.solveCase(proof);
 const saved=game.snapshot();
 saved.caseProof.privateNotes='not part of this scene';
 const restored=createStoryReplay({initialState:saved});
 assert.equal(restored.view().ending,'bigfixer-first-accord');
 assert.equal(restored.snapshot().caseProof.privateNotes,undefined);
});
