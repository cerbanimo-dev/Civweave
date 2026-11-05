import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldweaver,SPACE_GUIDES} from '../public/app/shared/worldweaver-core-v1.mjs';
import {
  COMMONS_BETWEEN,
  COMMONS_BETWEEN_ID,
  UNIVERSE_SCHEMA,
  buildCommonsBetween,
  validateCommonsNavigation
} from '../public/app/shared/worldweaver-universe-v1.mjs';

test('commons-between blueprint composes current world catalogs without inventing authority',()=>{
  assert.equal(COMMONS_BETWEEN.schema,UNIVERSE_SCHEMA);
  assert.equal(COMMONS_BETWEEN.id,COMMONS_BETWEEN_ID);
  assert.equal(COMMONS_BETWEEN.topology.districts.length,13);
  assert.equal(COMMONS_BETWEEN.storyPortals.count,16);
  assert.equal(COMMONS_BETWEEN.storyPortals.layers['in-between'].count,9);
  assert.equal(COMMONS_BETWEEN.storyPortals.layers.physical.count,7);
  assert.deepEqual(COMMONS_BETWEEN.convergence.milestones,[
    'book-meets-cerbanimo',
    'book-meets-collective',
    'civweave-public-opening'
  ]);
  assert.ok(COMMONS_BETWEEN.pve.defaultPilotCapabilities.includes('facilitate'));
  assert.ok(COMMONS_BETWEEN.pve.forbiddenAuthorities.includes('cast-vote'));
  assert.ok(COMMONS_BETWEEN.rooms.every(room=>SPACE_GUIDES[room.guide]));
  assert.equal(validateCommonsNavigation(COMMONS_BETWEEN),true);
  assert.ok(COMMONS_BETWEEN.rooms.some(room=>room.id==='anarchadia-forum'&&room.title==='Anarchadia'));
  assert.deepEqual(COMMONS_BETWEEN.navigation.intentionHighway.lanes.map(lane=>lane.system),['living-school','cerbanimo','fellowfare']);
  assert.equal(COMMONS_BETWEEN.navigation.intentionHighway.interchange.system,'anarchadia');
});

test('builder creates one canonical draft universe and stops before provisioning',()=>{
  let seq=0;
  const human=Object.freeze({kind:'human',principalId:'human:test-builder'});
  const world=createWorldweaver({
    id:()=>`universe-id-${++seq}`,
    clock:()=>`2026-11-05T00:00:${String(seq).padStart(2,'0')}.000Z`,
    authorize:({actor,command})=>actor===human&&['create','add-station','create-screen'].includes(command.type)
  });
  const result=buildCommonsBetween({worldweaver:world,actor:human,guildId:'guild:test-universe'});
  assert.equal(result.schema,UNIVERSE_SCHEMA);
  assert.equal(result.status,'draft');
  assert.equal(result.provisioning,'not-requested');
  assert.equal(result.scope,'guild-map');
  assert.equal(result.guildId,'guild:test-universe');
  assert.equal(result.rooms.length,COMMONS_BETWEEN.rooms.length);
  assert.equal(result.snapshot.instances.length,COMMONS_BETWEEN.rooms.length);
  assert.ok(result.snapshot.instances.every(row=>row.status==='draft'&&row.world===null&&row.guildId==='guild:test-universe'));
  assert.equal(result.snapshot.intents.length,0);
  assert.ok(result.snapshot.stations.length>=10);
  assert.equal(result.snapshot.screens.length,COMMONS_BETWEEN.rooms.length);
  for(const room of result.rooms)assert.equal(room.kind,SPACE_GUIDES[room.guide]);
});

test('standalone build does not require or synthesize a Guild identity',()=>{
  let seq=0;
  const human=Object.freeze({kind:'human',principalId:'human:solo'});
  const world=createWorldweaver({
    id:()=>`solo-${++seq}`,
    authorize:({actor,command})=>actor===human&&['create','add-station','create-screen'].includes(command.type)
  });
  const result=buildCommonsBetween({worldweaver:world,actor:human});
  assert.equal(result.scope,'standalone');
  assert.equal(result.guildId,null);
  assert.ok(result.snapshot.instances.every(row=>row.scope==='standalone'&&row.guildId===null));
});


test('universe navigation keeps threshold, 3D carousel and three-lane highway wired to real rooms',()=>{
  const nav=COMMONS_BETWEEN.navigation;
  const roomIds=new Set(COMMONS_BETWEEN.rooms.map(room=>room.id));
  assert.equal(nav.nexus.id,'threshold');
  assert.equal(nav.carousel.mode,'3d-ring');
  assert.equal(nav.carousel.roomOrder.length,COMMONS_BETWEEN.rooms.length);
  assert.ok(nav.carousel.roomOrder.every(id=>roomIds.has(id)));
  assert.equal(nav.intentionHighway.lanes.length,3);
  assert.equal(nav.intentionHighway.interchange.roomId,'anarchadia-forum');
  for(const lane of nav.intentionHighway.lanes){
    assert.ok(nav.portals.some(portal=>portal.from===nav.nexus.roomId&&portal.to===lane.roomId));
    assert.ok(nav.portals.some(portal=>portal.from===lane.roomId&&portal.to===nav.intentionHighway.interchange.roomId));
  }
});

test('universe implementation stays static-source and injection-free',async()=>{
  const [moduleSource,labSource]=await Promise.all([
    readFile(new URL('../public/app/shared/worldweaver-universe-v1.mjs',import.meta.url),'utf8'),
    readFile(new URL('../public/app/tools/worldweaver-universe-lab.html',import.meta.url),'utf8')
  ]);
  const combined=moduleSource+'\n'+labSource;
  assert.doesNotMatch(combined,/createElement\s*\(\s*['"]script['"]/i);
  assert.doesNotMatch(combined,/\beval\s*\(/);
  assert.doesNotMatch(combined,/\bnew\s+Function\s*\(/);
  assert.doesNotMatch(combined,/javascript\s*:/i);
  assert.doesNotMatch(combined,/contentWindow|contentDocument|postMessage\s*\(/);
});
