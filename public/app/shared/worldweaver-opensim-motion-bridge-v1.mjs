/**
 * Future native OpenSimulator region-module movement bridge.
 *
 * This adapter deliberately makes NO direct HTTP requests and has no browser
 * credentials. A deployment's trusted server supplies a pinned region module
 * transport, independent receipt verification and an authorized scene reader.
 * It never treats a Cloudflare rehearsal move as an actual OpenSim movement.
 */
import {validateOpenSimRegion} from './worldweaver-opensim-geometry-v1.mjs';
export const OPENSIM_MOTION_ACK='civweave.opensim-motion-ack.v1';
const bound=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9:_./-]{0,179}$/.test(x);
const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z)&&
 p.x>=0&&p.y>=0&&p.z>=-1024&&p.z<=4096&&
 Object.keys(p).every(k=>['x','y','z'].includes(k));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const close=(a,b)=>distance(a,b)<=.035;
const fail=m=>{throw new Error('Native OpenSimulator movement unverified: '+m)};
export function createVerifiedOpenSimMovementBridge({readRegion,sendMove,verifyAttestation}={}){
 if(typeof readRegion!=='function'||typeof sendMove!=='function'||
    typeof verifyAttestation!=='function')throw new TypeError('A trusted native region reader, mover and receipt verifier are required.');
 return Object.freeze({
  async move({regionId,instanceId,objectId,from,to,expectedRevision,requestId}={}){
   if(![regionId,instanceId,objectId,requestId].every(bound)||!point(from)||!point(to)||
      !Number.isSafeInteger(expectedRevision)||expectedRevision<0||
      !(distance(from,to)>=.05&&distance(from,to)<=2.5))
     throw new TypeError('Invalid bounded native OpenSimulator move request.');
   // Region snapshots must come from a privileged operator/region module, not
   // a user-supplied provisional mesh or Cast browser JSON.
   const before=validateOpenSimRegion(await readRegion({regionId,instanceId}));
   if(before.regionId!==regionId||before.revision!==expectedRevision||
      before.source!=='opensim-region-module')fail('before-state lacks genuine region-module authority');
   const object=before.objects.find(o=>o.id===objectId&&o.instanceId===instanceId);
   if(!object||!close(object.position,from))fail('object is absent or its position is stale');
   if(to.x<1||to.x>before.size.x-1||to.y<1||to.y>before.size.y-1)
     fail('target crosses authenticated region boundary');
   // Network failure after this call is INDETERMINATE: never blindly retry.
   // The caller must retrieve and reconcile the region's actual snapshot.
   const response=await sendMove({regionId,instanceId,objectId,
     expectedRevision,from,to,requestId});
   if(response?.schema!==OPENSIM_MOTION_ACK||response.requestId!==requestId||
      response.regionId!==regionId||response.objectId!==objectId||
      response.instanceId!==instanceId||response.outcome!=='succeeded'||
      !Number.isSafeInteger(response.revision)||response.revision<=expectedRevision)
     fail('provider did not acknowledge this exact move');
   if(await verifyAttestation({requestId,regionId,instanceId,objectId,
      response})!==true)fail('region-module attestation did not verify');
   const after=validateOpenSimRegion(await readRegion({regionId,instanceId}));
   if(after.source!=='opensim-region-module'||after.regionId!==regionId||
      after.revision!==response.revision||after.revision<=before.revision)
     fail('region revision was not independently observed');
   const moved=after.objects.find(o=>o.id===objectId&&o.instanceId===instanceId);
   if(!moved||!close(moved.position,to))fail('position was not actually reached');
   return {provider:'opensim-region-module',simulatedOnly:false,requestId,
     regionId,instanceId,objectId,
     beforeRevision:before.revision,afterRevision:after.revision,
     from:structuredClone(object.position),to:structuredClone(moved.position),
     attested:true};
  }
 });
}
