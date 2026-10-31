import test from 'node:test';
import assert from 'node:assert/strict';
import {createPersonaMotionScene,movePersonaBody,personaMotionRegion,validatePersonaMotionScene} from '../public/app/shared/worldweaver-persona-motion-v1.mjs';
import {buildOpenSimGeometry,projectOpenSimPolygons3Dto2D} from '../public/app/shared/worldweaver-opensim-geometry-v1.mjs';
import {projectOpenSimFaces3D} from '../public/app/shared/worldweaver-3d-preview-v1.mjs';
const make=()=>createPersonaMotionScene({roomId:'room:test',instanceId:'world:test',
 characters:['landry','delia']});
test('3D cast uses one verified OpenSim-compatible region geometry for 3D and 2D',()=>{
 const source=make(),region=personaMotionRegion(source),geometry=buildOpenSimGeometry(region);
 assert.equal(region.regionId,'rehearsal:room:test');
 assert.equal(region.source,'provisional-or-imported');
 assert.equal(region.objects.filter(o=>o.kind==='actor-marker').length,2);
 const view=projectOpenSimFaces3D(geometry,{width:640,height:360});
 assert.ok(view.faces.length>0);
 const two=projectOpenSimPolygons3Dto2D(geometry);
 assert.ok(two.projectedFaces.length>0);
 assert.equal(two.revision,view.revision);
});
test('an approved 2-metre move changes the server world revision and the exact same 3D actor transform',()=>{
 const base=make();
 const moved=movePersonaBody(base,{characterId:'landry',to:{x:12,y:13,z:0},expectedRevision:0});
 assert.equal(base.revision,0);
 assert.equal(moved.scene.revision,1);
 assert.equal(moved.movement.distance,2);
 assert.deepEqual(moved.movement.from,{x:10,y:13,z:0});
 assert.deepEqual(moved.movement.to,{x:12,y:13,z:0});
 const region=personaMotionRegion(moved.scene);
 assert.equal(region.revision,1);
 assert.deepEqual(region.objects.find(o=>o.id==='actor:landry').position,{x:12,y:13,z:0});
 assert.equal(region.objects.find(o=>o.id==='actor:delia').position.x,21);
 const geometry=buildOpenSimGeometry(region);
 assert.equal(projectOpenSimPolygons3Dto2D(geometry).revision,1);
 assert.equal(projectOpenSimFaces3D(geometry,{width:640,height:360}).revision,1);
});
test('no teleportation, boundary escape, free-flight, wrong revision or colliding with another body',()=>{
 const world=make();
 assert.throws(()=>movePersonaBody(world,{characterId:'landry',to:{x:20,y:13,z:0},expectedRevision:0}),/0.05–2.5/);
 assert.throws(()=>movePersonaBody(world,{characterId:'landry',to:{x:0,y:13,z:0},expectedRevision:0}),/boundary/);
 assert.throws(()=>movePersonaBody(world,{characterId:'landry',to:{x:11,y:13,z:1},expectedRevision:0}),/Vertical/);
 assert.throws(()=>movePersonaBody(world,{characterId:'landry',to:{x:11,y:13,z:0},expectedRevision:3}),/Stale/);
 const near=structuredClone(world);
 near.actors[1].position={x:11.5,y:13,z:0};
 assert.throws(()=>movePersonaBody(near,{characterId:'landry',to:{x:11,y:13,z:0},expectedRevision:0}),/another character/);
 assert.equal(world.revision,0);
 assert.equal(world.actors[0].position.x,10);
});
test('a swept collision stops an actor from tunneling through a pillar',()=>{
 const world=make();
 world.actors[0].position={x:30,y:23,z:0};
 assert.throws(()=>movePersonaBody(world,{characterId:'landry',to:{x:32,y:23,z:0},expectedRevision:0}),/collision geometry/);
 assert.equal(world.revision,0);
});
test('3D region snapshots reject invalid transform, duplicated roles and malformed scene',()=>{
 const s=make();
 assert.throws(()=>validatePersonaMotionScene({...s,revision:-1}),/Invalid/);
 assert.throws(()=>validatePersonaMotionScene({...s,actors:[s.actors[0],s.actors[0]]}),/Duplicate/);
 assert.throws(()=>movePersonaBody(s,{characterId:'landry',to:{x:12,y:13,z:NaN},expectedRevision:0}),/Invalid/);
 assert.throws(()=>movePersonaBody(s,{characterId:'unseated',to:{x:12,y:13,z:0},expectedRevision:0}),/Unknown/);
});
