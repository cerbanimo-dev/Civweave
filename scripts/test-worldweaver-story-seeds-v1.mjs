import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD_SEED_SCHEMA,WORLD_SEEDS,WORLD_SEED_COUNT,getWorldSeed,worldsByLayer,buildStoryWorldStart} from '../public/app/shared/worldweaver-story-seeds-v1.mjs';

test('Part III includes exactly sixteen unique named worlds split nine and seven',()=>{
 assert.equal(WORLD_SEED_SCHEMA,'civweave.worldweaver-story-seeds.v1');
 assert.equal(WORLD_SEED_COUNT,16);
 assert.equal(WORLD_SEEDS.length,16);
 assert.equal(new Set(WORLD_SEEDS.map(x=>x.id)).size,16);
 assert.equal(worldsByLayer('in-between').length,9);
 assert.equal(worldsByLayer('physical').length,7);
 assert.equal(WORLD_SEEDS.filter(x=>x.provenance==='recovered').length,9);
 assert.equal(WORLD_SEEDS.filter(x=>x.provenance==='new-proposal').length,7);
});
test('all recovered world names survive the classification unchanged',()=>{
 const expected=['The City Between Panels','The Orchard of Moving Castles','The Starship Commons',
 'The Department of Unfinished Lessons','Monsters After Midnight','The Neon Afterimage',
 'The Kingdom of Side Quests','The Kaiju Garden','The Gentle Apocalypse'];
 for(const title of expected)assert.ok(WORLD_SEEDS.some(s=>s.title===title&&s.provenance==='recovered'),title);
});
test('each seed is playable as an auditable single persistent world with bounded POV and image reference',()=>{
 for(const seed of WORLD_SEEDS){
  assert.ok(seed.premise.length>=40&&seed.settingLaw.length>=30&&seed.incitingIncident.length>=30,seed.id);
  assert.ok(seed.centralChoice.length>=20&&seed.firstScene.length>=50&&seed.storyArc.length===4,seed.id);
  assert.ok(seed.cast.length>=2&&seed.conflicts.length>=2&&seed.continuity.length>=2,seed.id);
  assert.ok(seed.visual?.reference?.startsWith('/app/assets/world/'),seed.id);
  assert.equal(seed.visual.referenceKind,'existing-civweave-moodboard-not-world-art');
  assert.ok(seed.viewpoints.every(v=>['landry-delia','magnus-maggie'].includes(v)),seed.id);
  const start=buildStoryWorldStart(seed.id);
  assert.equal(start.schema,'civweave.story-world-start.v1');
  assert.equal(start.seedId,seed.id);
  assert.equal(start.continuityPolicy,'one-canonical-history-per-world');
  assert.deepEqual(start.canonicalEvents,[]);
  assert.deepEqual(start.uncommittedMultiversePossibilities,[]);
  assert.notEqual(start.storyClock,'synchronized-earth-clock');
  assert.equal(start.activation,'not-activated');
  assert.equal(start.networkAccess,'none');
  assert.equal(start.simulatorStatus,'seed-only');
 }
});
test('all worlds have safe independent starts and no automatic crossings',()=>{
 const a=buildStoryWorldStart('city-between-panels');
 const b=buildStoryWorldStart('city-between-panels');
 a.canonicalEvents.push({id:'e1',text:'a proposed test edit'});
 assert.equal(b.canonicalEvents.length,0);
 assert.throws(()=>getWorldSeed('unknown'),/Unknown world seed/);
 assert.throws(()=>worldsByLayer('unknown'),/Unknown world layer/);
 for(const s of WORLD_SEEDS){
  assert.equal(s.crossingPolicy,'explicit-consent-review-and-material-cost');
  assert.ok(s.guardrails.length>=2);
 }
});
