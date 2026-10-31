import test from 'node:test';
import assert from 'node:assert/strict';
import {createVerifiedOpenSimMovementBridge,OPENSIM_MOTION_ACK} from '../public/app/shared/worldweaver-opensim-motion-bridge-v1.mjs';
import {createPersonaMotionScene,personaMotionRegion} from '../public/app/shared/worldweaver-persona-motion-v1.mjs';
const coords=(x,y,z=0)=>({x,y,z});
const req={regionId:'trusted:region',instanceId:'world:scene',objectId:'actor:landry',
 from:coords(10,13),to:coords(12,13),expectedRevision:0,requestId:'move:one'};
const snapshot=(x,revision,source='opensim-region-module')=>{
 const room=createPersonaMotionScene({roomId:'room:secure',instanceId:'world:scene',characters:['landry','delia']});
 const region=personaMotionRegion(room);region.regionId='trusted:region';
 region.revision=revision;region.source=source;
 region.objects.find(o=>o.id==='actor:landry').position=coords(x,13);
 return region;
};
function mk({before=snapshot(10,0),after=snapshot(12,1),attested=true,ack}={}){
 let reads=0,sends=0;
 const adapter=createVerifiedOpenSimMovementBridge({
  readRegion:async()=>reads++===0?before:after,
  sendMove:async x=>{sends++;return ack||{
   schema:OPENSIM_MOTION_ACK,requestId:x.requestId,regionId:x.regionId,
   instanceId:x.instanceId,objectId:x.objectId,outcome:'succeeded',revision:1
  }},
  verifyAttestation:async()=>attested
 });
 return {adapter,get calls(){return {reads,sends}}};
}
test('real native OpenSimulator movement requires signed acknowledgment and subsequent independent region position',async()=>{
 const h=mk(),result=await h.adapter.move(req);
 assert.equal(result.attested,true);
 assert.equal(result.provider,'opensim-region-module');
 assert.equal(result.simulatedOnly,false);
 assert.equal(result.beforeRevision,0);
 assert.equal(result.afterRevision,1);
 assert.deepEqual(h.calls,{reads:2,sends:1});
});
test('untrusted/provisional, forged, stale or incomplete region observations cannot attest movement',async()=>{
 const invalid=[
  mk({before:snapshot(10,0,'provisional-or-imported')}),
  mk({before:snapshot(12,0)}),
  mk({after:snapshot(10,1)}),
  mk({after:snapshot(12,1,'provisional-or-imported')}),
  mk({after:snapshot(12,0)}),
  mk({attested:false}),
  mk({ack:{schema:OPENSIM_MOTION_ACK,requestId:'move:other',regionId:'trusted:region',
    instanceId:'world:scene',objectId:'actor:landry',outcome:'succeeded',revision:1}})
 ];
 for(const h of invalid)await assert.rejects(()=>h.adapter.move(req),/unverified/i);
});
test('native bridge rejects teleportation and prevents a false verified receipt',async()=>{
 const h=mk();
 await assert.rejects(()=>h.adapter.move({...req,to:coords(30,13)}),/Invalid bounded/);
 assert.equal(h.calls.sends,0);
 await assert.rejects(()=>h.adapter.move({...req,to:coords(0,0)}),/Invalid bounded/);
 assert.equal(h.calls.sends,0);
});
test('unconfigured native OpenSimulator transport fails closed',()=>{
 assert.throws(()=>createVerifiedOpenSimMovementBridge({readRegion:async()=>snapshot(10,0)}),/trusted native/);
});
