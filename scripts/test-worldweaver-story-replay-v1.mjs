import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SHADOW_THREAD_REPLAY,STORY_REPLAY_SCHEMA,createStoryReplay} from '../public/app/shared/worldweaver-story-replay-v1.mjs';

const fixture=JSON.parse(await readFile(new URL('../examples/worldweaver/shadow-thread-playtest-001.json',import.meta.url),'utf8'));
const actors=JSON.parse(await readFile(new URL('../examples/worldweaver/shadow-thread-raven-team-v1.json',import.meta.url),'utf8'));

test('original first-turn transcript is preserved beat for beat',()=>{
 const runner=createStoryReplay();
 const opening=runner.view();
 assert.equal(opening.nodeId,'third-discharge');
 assert.equal(opening.universeId,'shadow-and-thread');
 assert.match(opening.fictionNotice,/fiction/i);
 assert.equal(opening.liveActors,false);
 runner.choose('listen-to-fruitfly');
 const scene=runner.view();
 assert.equal(scene.beats.length,7);
 assert.deepEqual(scene.beats.map(x=>x.text),fixture.beats.map(x=>x.text));
 assert.deepEqual(scene.beats.map(x=>x.action),fixture.beats.map(x=>x.action));
 assert.deepEqual(scene.choices.map(x=>x.id),fixture.nextChoices.map(x=>x.id));
 assert.deepEqual(scene.clues,fixture.result.clues);
 assert.equal(scene.ending,null);
});

test('actors keep canonical identity, in-world aliases and avatar boundaries',()=>{
 const view=createStoryReplay().view();
 assert.deepEqual(view.actors.map(x=>x.canonicalId),actors.actors.map(x=>x.canonicalId));
 for(const persona of actors.actors){
  const mapped=view.actors.find(x=>x.canonicalId===persona.canonicalId);
  assert.equal(mapped.worldName,persona.worldName);
  assert.equal(mapped.avatarPolicy,'reuse-original-canonical');
  assert.equal(mapped.avatarResolved,false);
 }
 assert.equal(view.worldProvisioned,false);
 assert.equal(view.avatarBindingsResolved,false);
});

test('fresh player may decline; no contract, timeline mutation or model call exists in replay state',()=>{
 const replay=createStoryReplay();
 replay.choose('decline-and-exit');
 assert.equal(replay.view().complete,true);
 assert.equal(replay.view().ending,'voluntary-exit');
 assert.deepEqual(Object.keys(replay.snapshot()).sort(),['angelIntimationEnabled','clues','currentNodeId','ending','history','revision','scenarioId','schema'].sort());
 assert.throws(()=>replay.choose('challenge-contract'),/unavailable|final/i);
 assert.equal(replay.view().history.length,1);
});

test('the original path reaches real evidence and an authored challenge ending',()=>{
 const runner=createStoryReplay();
 for(const choice of ['listen-to-fruitfly','inspect-contract','challenge-contract'])runner.choose(choice);
 assert.equal(runner.view().ending,'challenge-accepted');
 assert.equal(runner.view().complete,true);
 assert.ok(runner.view().clues.includes('unadvertised contract challenge option'));
 assert.equal(runner.snapshot().revision,3);
 const second=createStoryReplay();
 assert.equal(second.view().revision,0,'each player gets a clean instance');
});

test('hint system requires explicit opt-in, discloses fiction and can be turned off',()=>{
 const runner=createStoryReplay();
 assert.equal(runner.view().angelIntimation.enabled,false);
 assert.equal(runner.view().angelIntimation.hint,null);
 runner.setAngelIntimation(true);
 assert.match(runner.view().angelIntimation.disclosure,/fictional/i);
 assert.ok(runner.view().angelIntimation.hint.length>10);
 runner.setAngelIntimation(false);
 assert.equal(runner.view().angelIntimation.hint,null);
 assert.throws(()=>runner.setAngelIntimation('yes'),/boolean/);
 runner.setAngelIntimation(true);
 runner.restart();
 assert.equal(runner.view().angelIntimation.enabled,false);
});

test('saved game restores by replaying choices, refusing forged progress or transitions',()=>{
 const runner=createStoryReplay();
 runner.choose('listen-to-fruitfly');runner.choose('follow-zip');
 runner.setAngelIntimation(true);
 const snapshot=runner.snapshot();
 const resume=createStoryReplay({initialState:snapshot});
 assert.deepEqual(resume.snapshot(),snapshot);
 const forged=structuredClone(snapshot);
 forged.currentNodeId='challenge-contract';forged.ending='challenge-accepted';forged.clues=['invented proof'];
 const verified=createStoryReplay({initialState:forged});
 assert.equal(verified.view().nodeId,'follow-zip');
 assert.equal(verified.view().ending,null);
 assert.ok(!verified.view().clues.includes('invented proof'));
 const invalid=structuredClone(snapshot);invalid.history[0].choiceId='challenge-contract';
 assert.throws(()=>createStoryReplay({initialState:invalid}),/unavailable/);
 const wrongScenario=structuredClone(snapshot);wrongScenario.scenarioId='elsewhere';
 assert.throws(()=>createStoryReplay({initialState:wrongScenario}),/Invalid saved/);
});

test('every authored choice links to a scene, and every path has a safe exit',()=>{
 const nodes=SHADOW_THREAD_REPLAY.nodes;
 for(const [id,node] of Object.entries(nodes)){
  for(const option of node.choices)assert.ok(nodes[option.next],id+' missing '+option.next);
  const queue=[id],seen=new Set();
  let reachesEnding=false;
  while(queue.length){
   const current=queue.shift();
   if(seen.has(current))continue;
   seen.add(current);
   if(nodes[current].ending)reachesEnding=true;
   for(const option of nodes[current].choices)queue.push(option.next);
  }
  assert.equal(reachesEnding,true,'Unfinishable route at '+id);
  if(!node.ending)assert.ok(node.choices.length>0,'No choice in '+id);
 }
 assert.equal(new Set(SHADOW_THREAD_REPLAY.actors.map(a=>a.canonicalId)).size,3);
 assert.equal(SHADOW_THREAD_REPLAY.angelIntimation.enabledByDefault,false);
 assert.equal(STORY_REPLAY_SCHEMA,'civweave.worldweaver.story-replay.v1');
});

test('a discoverable first-party player links from Commons Between and Starling Lounge',async()=>{
 const [ui,commons,lounge]=await Promise.all([
  readFile(new URL('../public/app/tools/shadow-thread-replay.html',import.meta.url),'utf8'),
  readFile(new URL('../public/app/tools/worldweaver-universe-lab.html',import.meta.url),'utf8'),
  readFile(new URL('../public/app/starling-lounge-v1.mjs',import.meta.url),'utf8')
 ]);
 assert.match(ui,/createStoryReplay/);
 assert.match(ui,/worldweaver-story-replay-v1\.mjs/);
 assert.match(ui,/localStorage/);
 assert.match(ui,/add\(article,'p',beat\.text\)/);
 assert.doesNotMatch(ui,/innerHTML\s*=/);
 assert.match(commons,/shadow-thread-replay\.html/);
 assert.match(lounge,/shadow-thread-replay\.html/);
});
