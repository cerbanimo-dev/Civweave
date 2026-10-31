import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommuneWorldHost} from '../public/app/shared/worldweaver-commune-host-v1.mjs';
import {createSimulatorToolBridge} from '../public/app/shared/worldweaver-simulator-tools-v1.mjs';
import {localFleetProjection,guildFleetProjection} from '../public/app/shared/civweave-fleet-scopes-v1.mjs';

function fixture({signedBy='founder',reader=()=>true}={}){
 const guildId='fleet-guild',objects=new Map(),listeners=new Set();
 objects.set('guild-genesis:'+guildId,{
  kind:'civweave.guild-genesis.v1',origin:{nodeId:'founder'},
  payload:{guildId,foundingDeviceId:'founder'}
 });
 let sequence=0;
 const mesh={
  getObject:async id=>objects.get(id)||null,
  validateObject:async object=>({ok:!!object&&object.invalid!==true}),
  deviceId:async()=>signedBy,
  createObject:async input=>{
   const existing=objects.get(input.id);
   if(existing&&input.revision!==existing.revision+1)throw Error('Stale Worldweaver revision');
   const result={...structuredClone(input),origin:{nodeId:signedBy}};
   objects.set(input.id,result);
   for(const fn of listeners)fn({type:'object-created',detail:{kind:input.kind}});
   return result;
  },
  subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)}
 };
 const host=createCommuneWorldHost({guildId,mesh,founder:()=>({guildId,deviceId:signedBy}),
  verifyReader:reader,id:()=>`fleet-obj-${++sequence}`});
 return {host,guildId,objects,mesh};
}
const start=host=>host.provision({rendererReady:async({geometry,projection})=>
 geometry.faces.length>0&&projection.nodes.length>0});
test('Local roles never publish into Guild fleet state',()=>{
 const local=localFleetProjection({
  catalogue:[{role:'swift',modelId:'private-gguf',name:'Swift',purpose:'Everyday'}],
  chosen:{swift:{modelId:'private-gguf'}},
  bindings:{schema:'civweave.ai.fleet.bindings.v1',roles:{swift:{
   model:'private-gguf',importId:'private-opfs',quantization:'Q4'}}}
 });
 assert.equal(local.scope,'local');
 assert.equal(local.roles.length,5);
 assert.equal(local.roles[0].status,'verified-local-import');
 assert.equal(local.roles[0].installedModelId,'private-gguf');
 const guild=guildFleetProjection({guildId:'fleet-guild',worldSnapshot:null});
 assert.equal(guild.available,false);
 assert.equal(guild.registered.length,0);
 assert.doesNotMatch(JSON.stringify(guild),/private-gguf|private-opfs/);
});
test('Signed Guild pilots live in canonical Worldweaver state, not private model bindings',async()=>{
 const {host,objects,guildId}=fixture();
 try{
  await start(host);
  const npc=await host.registerPilot({personaId:'aphra',modelId:'qwen3.5:4b'});
  assert.equal(npc.personaRef,'starling:aphra');
  assert.equal(npc.modelId,'qwen3.5:4b');
  assert.equal(npc.instanceId,host.worldRef());
  assert.equal(host.getSnapshot().npcs.length,1);
  assert.equal(host.getSnapshot().revision>1,true);
  const saved=objects.get('worldweaver-commune:'+guildId);
  assert.equal(saved.revision,2);
  assert.equal(saved.origin.nodeId,'founder');
  const fleet=guildFleetProjection({guildId,worldSnapshot:host.getSnapshot(),turns:[{guildId,personaId:'aphra'}]});
  assert.equal(fleet.registered.length,1);
  assert.equal(fleet.registered[0].status,'registered-pilot-not-executing');
  assert.equal(fleet.signedTurns,1);
  await assert.rejects(host.registerPilot({personaId:'aphra',modelId:'qwen3.5:4b'}),/already registered/);
  await assert.rejects(host.registerPilot({personaId:'unknown',modelId:'qwen3.5:4b'}),/Unknown Starling/);
 }finally{host.close()}
});
test('World observation and model tool proposals never acknowledge their own actions',async()=>{
 const {host}=fixture();
 try{
  await start(host);
  const tools=createSimulatorToolBridge({getSnapshot:host.getSnapshot,getLayout:host.getLayout,getWorldRef:host.worldRef});
  const observation=tools.observe();
  assert.equal(observation.tool,'observe');
  assert.ok(observation.entities.length>0);
  assert.equal(observation.pilotId,null);
  assert.throws(()=>tools.prepare({personaId:'aphra',tool:'move',args:{x:10,y:10}}),/no registered/);
  await host.registerPilot({personaId:'aphra',modelId:'qwen3.5:4b'});
  assert.equal(tools.observe({personaId:'aphra'}).pilotId,host.getSnapshot().npcs[0].id);
  const proposal=tools.prepare({personaId:'aphra',tool:'move',args:{x:80,y:120,z:0}});
  assert.equal(proposal.status,'pending-verified-model-pilot');
  assert.equal(host.getSnapshot().intents.length,0);
  assert.throws(()=>tools.prepare({personaId:'aphra',tool:'move',args:{x:999,y:10}}),/bounded/);
  assert.throws(()=>tools.prepare({personaId:'aphra',tool:'speak',args:{text:''}}),/Speech requires/);
  assert.throws(()=>tools.prepare({personaId:'aphra',tool:'cast-screen',args:{screenId:'other-room'}}),/capability/);
  host.selectRoom(host.getSnapshot().instances[1].id);
  assert.throws(()=>tools.prepare({personaId:'aphra',tool:'move',args:{x:10,y:10}}),/no registered/);
 }finally{host.close()}
});
test('No access when Guild membership or founder authority fails',async()=>{
 const guest=fixture({reader:()=>false});
 try{await assert.rejects(start(guest.host),/membership/)}finally{guest.host.close()}
 const nonFounder=fixture({signedBy:'other'});
 try{await assert.rejects(start(nonFounder.host),/founding device/)}finally{nonFounder.host.close()}
});
test('Fleet UI never claims unsigned actors are physically in the Worldweaver region',async()=>{
 const fs=await import('node:fs/promises');
 const src=await fs.readFile(new URL('../public/app/starling-lounge-v1.mjs',import.meta.url),'utf8');
 assert.match(src,/data-sl-fleet="local"/);
 assert.match(src,/data-sl-fleet="guild"/);
 assert.match(src,/data-sl-action="fleet-settings"/);
 assert.match(src,/data-sl-action="world-observe"/);
 assert.match(src,/data-sl-action="world-move-proposal"/);
 assert.match(src,/drawSignedPilots/);
 assert.match(src,/registered NPC pilot/);
 assert.match(src,/worldObservationPrompt/);
 assert.doesNotMatch(src,/createWorldweaver\(\{authorize:\s*\(\)\s*=>\s*true/);
});
