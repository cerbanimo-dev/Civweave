import assert from 'node:assert/strict';
import {createQuestInteraction,pinchActive,stickMove,distance3,VR_ACTIONS} from '../public/app/shared/starling-quest-interaction-v1.mjs';
assert.equal(pinchActive({x:0,y:0,z:0},{x:0.01,y:0,z:0}),true);
assert.equal(pinchActive({x:0,y:0,z:0},{x:0.1,y:0,z:0}),false);
assert.equal(distance3(null,{x:0,y:0,z:0}),Infinity);
assert.deepEqual(stickMove([0.05,0.02]),{x:0,y:0});
assert.equal(stickMove([1,0]).x,1);
const listeners=new Map();
const session={
 inputSources:[],
 addEventListener(name,fn){listeners.set(name,fn)},
 removeEventListener(name,fn){if(listeners.get(name)===fn)listeners.delete(name)}
};
const actions=[],source={
 targetRayMode:'tracked-pointer',handedness:'right',targetRaySpace:{},
 gamepad:{axes:[0,0,1,0]}
};
session.inputSources=[source];
const pose={transform:{position:{x:0,y:1.5,z:0},orientation:{x:0,y:0,z:0,w:1}}};
let clock=500;
const controller=createQuestInteraction({
 hitTest:()=>({id:'moss'}),onAction:action=>actions.push(action),now:()=>clock
});
controller.attach(session,{});
assert.equal(controller.state.inputCount,1);
const frame={getPose:()=>pose};
listeners.get('select')({frame,inputSource:source});
assert.equal(actions[0].type,VR_ACTIONS.SELECT);
assert.equal(actions[0].targetId,'moss');
assert.equal(controller.ray(frame,source).direction.z,-1);
listeners.get('select')({frame,inputSource:source});
assert.equal(actions.filter(a=>a.type===VR_ACTIONS.SELECT).length,1,'debounce repeated triggers');
controller.update(frame,0.016);
assert.ok(actions.some(a=>a.type===VR_ACTIONS.MOVE));
assert.equal(controller.toggleMenu(),true);
assert.ok(actions.some(a=>a.type===VR_ACTIONS.MENU));
controller.recenter();
assert.ok(actions.some(a=>a.type===VR_ACTIONS.RECENTER));
const joints=new Map([['thumb-tip',{}],['index-finger-tip',{}]]);
const handSource={hand:{get:key=>joints.get(key)},targetRaySpace:{},handedness:'left'};
session.inputSources=[handSource];listeners.get('inputsourceschange')();
let thumb=0.005;
const handFrame={getPose:()=>pose,getJointPose:joint=>({transform:{position:{x:joint===joints.get('thumb-tip')?thumb:0,y:0,z:0}}})};
clock+=300;controller.update(handFrame,0.016);
assert.equal(actions.filter(a=>a.method==='pinch').length,1);
controller.update(handFrame,0.016);
assert.equal(actions.filter(a=>a.method==='pinch').length,1);
thumb=0.06;controller.update(handFrame,0.016);
thumb=0.004;clock+=300;controller.update(handFrame,0.016);
assert.equal(actions.filter(a=>a.method==='pinch').length,2);
listeners.get('end')();
assert.equal(controller.state.attached,false);
controller.dispose();
console.log('Quest interaction bridge tests passed');
