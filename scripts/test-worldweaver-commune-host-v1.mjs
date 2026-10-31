import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommuneWorldHost,COMMUNE_WORLD_KIND} from '../public/app/shared/worldweaver-commune-host-v1.mjs';
import {projectWorld2D} from '../public/app/shared/worldweaver-map-2d-v1.mjs';

function fixture({founderDevice='founder',reader=()=>true}={}){
 const guildId='commune-test',objects=new Map(),subscribers=new Set();
 objects.set('guild-genesis:'+guildId,{
   kind:'civweave.guild-genesis.v1',origin:{nodeId:'founder'},
   payload:{guildId,foundingDeviceId:'founder'},consent:'group'
 });
 let counter=0;
 const mesh={
  getObject:async key=>objects.get(key)||null,
  validateObject:async row=>({ok:row?.invalid!==true}),
  deviceId:async()=>founderDevice,
  createObject:async input=>{
   if(objects.has(input.id))throw new Error('Duplicate object');
   const obj={...structuredClone(input),origin:{nodeId:'founder'}};
   objects.set(input.id,obj);
   for(const fn of subscribers)fn({type:'object-created',detail:{kind:input.kind}});
   return obj;
  },
  subscribe:fn=>{subscribers.add(fn);return()=>subscribers.delete(fn)}
 };
 const host=createCommuneWorldHost({guildId,mesh,founder:()=>({guildId,deviceId:founderDevice}),
    verifyReader:reader,id:()=>`room-${++counter}`});
 return {host,objects,mesh,guildId};
}
test('Guild creator provisions one signed, canonical Worldweaver manifest after both render projections exist',async()=>{
 const {host,objects,guildId}=fixture();
 try{
  assert.equal(await host.refresh(),null);
  assert.equal(host.status,'unprovisioned');
  let renderChecks=0;
  const packet=await host.provision({rendererReady:async({geometry,projection,snapshot})=>{
    renderChecks++;
    assert.ok(geometry.faces.length>0);
    assert.ok(projection.nodes.some(node=>node.type==='space'));
    assert.equal(snapshot.instances.length,4);
    return true;
  }});
  assert.equal(renderChecks,1);
  assert.equal(packet.schema,COMMUNE_WORLD_KIND);
  assert.equal(packet.guildId,guildId);
  assert.equal(packet.backend,'local-renderer');
  assert.equal(packet.geometrySource,'provisional');
  assert.equal(packet.snapshot.instances.length,4);
  assert.ok(packet.snapshot.instances.every(room=>room.status==='live'&&room.world?.backend==='local-renderer'));
  const signed=objects.get('worldweaver-commune:'+guildId);
  assert.equal(signed.origin.nodeId,'founder');
  assert.deepEqual(signed.audience,['guild:'+guildId]);
  assert.equal(signed.consent,'group');
  const projection=projectWorld2D(host.getSnapshot(),{worldRef:host.worldRef(),layout:host.getLayout()});
  assert.ok(projection.nodes.some(node=>node.type==='building'));
  assert.equal(host.getLayout(),host.getLayout(),'geometry stays stable across perspective redraws');
  const second=packet.snapshot.instances[1];
  assert.equal(host.selectRoom(second.id).id,second.id);
  assert.equal(host.worldRef(),second.id);
  const otherProjection=projectWorld2D(host.getSnapshot(),{worldRef:host.worldRef(),layout:host.getLayout()});
  assert.ok(otherProjection.nodes.some(node=>node.type==='building'));
  assert.ok(otherProjection.nodes.every(node=>node.type!=='building'||node.instanceId===second.id));
  assert.notEqual(host.getLayout().sceneGeometry.regionId,'');
  assert.throws(()=>host.selectRoom('outside-guild'),/unavailable/);
  host.selectRoom(packet.worldRef);
  assert.equal(host.status,'live-local');
  await host.provision({rendererReady:()=>{throw Error('Should not provision twice')}});
  assert.equal(objects.size,2,'one signed world object and the genesis');
 }finally{host.close()}
});
test('Failed or rejected local renderer never claims a live world',async()=>{
 const {host,objects,guildId}=fixture();
 try{
  await assert.rejects(host.provision({rendererReady:()=>false}),/could not be verified/);
  assert.equal(objects.has('worldweaver-commune:'+guildId),false);
  assert.equal(host.status,'unprovisioned');
 }finally{host.close()}
});
test('Unverified Guild readers and nonfounder devices cannot provision',async()=>{
 const other=fixture({founderDevice:'impostor'});
 try{await assert.rejects(other.host.provision({rendererReady:()=>true}),/founding device/)}finally{other.host.close()}
 const unreadable=fixture({reader:()=>false});
 try{await assert.rejects(unreadable.host.refresh(),/membership/)}finally{unreadable.host.close()}
});
test('Tampered or wrong-signer commune records fail closed',async()=>{
 const {host,objects,guildId}=fixture();
 objects.set('worldweaver-commune:'+guildId,{
   kind:COMMUNE_WORLD_KIND,origin:{nodeId:'other'},
   payload:{schema:COMMUNE_WORLD_KIND,guildId,snapshot:{schema:'civweave.worldweaver.v1',revision:1,instances:[]}},
   consent:'group',audience:['guild:'+guildId]
 });
 try{await assert.rejects(host.refresh(),/invalid or not signed/)}finally{host.close()}
});
