import test from 'node:test';
import assert from 'node:assert/strict';
import {NATIVE_SCENE_SCHEMA,normalizeNativeScene,projectNativeScene,pickNativeObject} from '../public/app/shared/worldweaver-native-3d-client-v1.mjs';

const input={schema:NATIVE_SCENE_SCHEMA,roomId:'starling-commons',revision:4,objects:[
 {id:'commons:table',position:{x:0,y:0,z:0},size:{x:4,y:4,z:2},label:'Talking Circle',color:'#78c9ba'}
]};
test('native renderer projects a canonical snapshot without OpenSim',()=>{
 const scene=normalizeNativeScene(input),view=projectNativeScene(scene);
 assert.equal(scene.roomId,'starling-commons');assert.equal(view.revision,4);assert.equal(view.faces.length,6);
 assert.equal(pickNativeObject(view,360,230),'commons:table');
});
test('renderer rejects duplicate ids and malformed authority-free snapshots',()=>{
 assert.throws(()=>normalizeNativeScene({...input,objects:[input.objects[0],input.objects[0]]}),/Invalid scene object/);
 assert.throws(()=>normalizeNativeScene({...input,objects:[{...input.objects[0],size:{x:-1,y:2,z:3}}]}),/Invalid scene object/);
 assert.throws(()=>normalizeNativeScene({...input,schema:'opensim'}),/Invalid canonical scene snapshot/);
});
test('snapshot copy does not mutate authoritative caller state',()=>{
 const scene=normalizeNativeScene(input);
 assert.notStrictEqual(scene.objects[0].position,input.objects[0].position);
 assert.ok(Object.isFrozen(scene.objects[0].position));
 assert.equal(input.objects[0].label,'Talking Circle');
});
