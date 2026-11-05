import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldweaver} from '../public/app/shared/worldweaver-core-v1.mjs';
import {
  CIVWEAVE_SEED_UNIVERSE_V1,
  UNIVERSE_SCHEMA,
  createUniverseScene,
  seedUniverse,
  validateUniverse
} from '../public/app/shared/worldweaver-universe-v1.mjs';

const clone=value=>JSON.parse(JSON.stringify(value));

test('canonical Civweave seed universe validates',()=>{
  assert.equal(validateUniverse(CIVWEAVE_SEED_UNIVERSE_V1),true);
  assert.equal(CIVWEAVE_SEED_UNIVERSE_V1.schema,UNIVERSE_SCHEMA);
  assert.deepEqual(
    CIVWEAVE_SEED_UNIVERSE_V1.realms.map(realm=>realm.system).sort(),
    ['anarchadia','cerbanimo','fellowfare','living-school']
  );
  assert.deepEqual(
    CIVWEAVE_SEED_UNIVERSE_V1.highway.lanes.map(lane=>lane.system),
    ['living-school','cerbanimo','fellowfare']
  );
  assert.equal(
    CIVWEAVE_SEED_UNIVERSE_V1.realms.find(realm=>realm.id===CIVWEAVE_SEED_UNIVERSE_V1.highway.interchangeRealmId)?.system,
    'anarchadia'
  );
});

test('universe validator rejects topology and guide drift',()=>{
  const duplicateLane=clone(CIVWEAVE_SEED_UNIVERSE_V1);
  duplicateLane.highway.lanes[2].realmId=duplicateLane.highway.lanes[1].realmId;
  assert.throws(()=>validateUniverse(duplicateLane),/distinct realms/);

  const badGuide=clone(CIVWEAVE_SEED_UNIVERSE_V1);
  badGuide.realms[0].guide='rook';
  assert.throws(()=>validateUniverse(badGuide),/guide\/kind mismatch/);

  const badPortal=clone(CIVWEAVE_SEED_UNIVERSE_V1);
  badPortal.portals[0].to='realm:missing';
  assert.throws(()=>validateUniverse(badPortal),/Portal endpoints/);
});

test('scene exposes one threshold, four realms, three highway lanes, and explicit portals',()=>{
  const scene=createUniverseScene();
  assert.equal(scene.nexus.id,'threshold');
  assert.equal(scene.realms.length,4);
  assert.equal(scene.highway.lanes.length,3);
  assert.equal(scene.portals.length,6);
  assert.ok(scene.realms.every(realm=>Number.isFinite(realm.position.x)&&Number.isFinite(realm.position.z)));
});

test('seedUniverse builds the four realms through the existing Worldweaver authority and is idempotent',()=>{
  let next=0;
  const world=createWorldweaver({
    authorize:()=>true,
    id:()=>`universe-${++next}`,
    clock:()=>`2026-11-05T05:00:${String(next).padStart(2,'0')}Z`
  });
  const actor={kind:'human',principalId:'hero:cami'};

  const first=seedUniverse(world,{actor});
  assert.equal(Object.keys(first.instances).length,4);
  assert.equal(first.snapshot.instances.length,4);
  assert.equal(first.snapshot.stations.length,13);
  assert.equal(first.snapshot.revision,17);

  const second=seedUniverse(world,{actor});
  assert.deepEqual(second.instances,first.instances);
  assert.equal(second.snapshot.instances.length,4);
  assert.equal(second.snapshot.stations.length,13);
  assert.equal(second.snapshot.revision,17);

  for(const realm of CIVWEAVE_SEED_UNIVERSE_V1.realms){
    const instance=second.snapshot.instances.find(row=>row.id===second.instances[realm.id]);
    assert.equal(instance.guide,realm.guide);
    assert.equal(instance.kind,realm.kind);
    assert.equal(instance.status,'draft');
  }
});

test('Guild map seeding requires an explicit Guild and preserves scope',()=>{
  let next=0;
  const world=createWorldweaver({authorize:()=>true,id:()=>`guild-universe-${++next}`});
  const actor={kind:'human',principalId:'guildkeeper:test'};

  assert.throws(()=>seedUniverse(world,{actor,scope:'guild-map'}),/Guild ID/);
  const seeded=seedUniverse(world,{actor,scope:'guild-map',guildId:'guild:test'});
  assert.ok(seeded.snapshot.instances.every(row=>row.scope==='guild-map'&&row.guildId==='guild:test'));
});
