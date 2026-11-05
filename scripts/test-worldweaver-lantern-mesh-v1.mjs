import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldweaver} from '../public/app/shared/worldweaver-core-v1.mjs';
import {LANTERN_MESH,LANTERN_MESH_SCHEMA,installLanternMesh} from '../public/app/shared/worldweaver-lantern-mesh-v1.mjs';

const human={kind:'human',principalId:'test:human'};
const runtime={kind:'runtime',principalId:'test:runtime'};

function make(){
  let n=0;
  return createWorldweaver({id:()=>`lm-${++n}`,clock:()=>`2026-11-05T00:00:${String(n).padStart(2,'0')}Z`,authorize:()=>true});
}

test('Lantern Mesh is a four-district Worldweaver universe with explicit sovereignty rules',()=>{
  assert.equal(LANTERN_MESH.schema,LANTERN_MESH_SCHEMA);
  assert.equal(LANTERN_MESH.id,'lantern-mesh');
  assert.equal(LANTERN_MESH.districts.length,4);
  assert.deepEqual(LANTERN_MESH.districts.map(x=>x.guide),['moss','kamiya','rook','merlin']);
  assert.equal(LANTERN_MESH.crossingPolicy,'explicit-human-review');
  assert.equal(LANTERN_MESH.conflictModel,'pve-story-environment-first');
  assert.ok(LANTERN_MESH.principles.some(x=>x.includes('no hidden sovereign')));
});

test('installer uses the canonical owner and produces four live local-demo districts when explicitly provisioned',()=>{
  const world=make();
  const receipt=installLanternMesh(world,{human,runtime,guildId:'guild:test',provision:true});
  const state=world.snapshot();
  assert.equal(receipt.schema,LANTERN_MESH_SCHEMA);
  assert.equal(state.instances.length,4);
  assert.equal(state.stations.length,4);
  assert.equal(state.screens.length,4);
  assert.equal(state.npcs.length,4);
  assert.ok(state.instances.every(x=>x.scope==='guild-map'&&x.guildId==='guild:test'&&x.status==='live'));
  assert.ok(state.instances.every(x=>x.world.backend==='local-renderer'));
  assert.deepEqual(new Set(state.npcs.map(x=>x.personaRef)),new Set(['starling:moss','starling:kamiya','starling:rook','starling:merlin']));
});

test('default install does not pretend a renderer exists',()=>{
  const world=make();
  installLanternMesh(world,{human,guildId:'guild:offline'});
  const state=world.snapshot();
  assert.ok(state.instances.every(x=>x.status==='draft'&&x.world===null));
  assert.equal(state.intents.length,0);
  assert.equal(state.placements.length,0);
});
