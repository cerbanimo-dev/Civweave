import test from 'node:test';
import assert from 'node:assert/strict';
import {recordStarlingCloudGeneration} from '../public/app/shared/starling-cloud-report-bridge-v1.mjs';
const DAY='2026-11-03T14:00:00.000Z';
function harness(){
  const objects=new Map(),calls=[];
  objects.set('guild-genesis:garden',{id:'guild-genesis:garden',
    kind:'civweave.guild-genesis.v1',origin:{nodeId:'device:founder'},
    payload:{guildId:'garden',foundingDeviceId:'device:founder'},signature:'ok'});
  const mesh={
    deviceId:async()=> 'device:founder',
    getObject:async id=> objects.get(id)||null,
    validateObject:async value=>({ok:value?.signature==='ok'}),
    createObject:async row=>{const obj={...row,signature:'ok',origin:{nodeId:'device:founder'}};objects.set(row.id,obj);calls.push(obj);return obj}
  };
  const session={guildId:'garden',nodeId:'garden-a',source:'mobile-guild-owned-cloud'};
  const request={guildId:'garden',purpose:'starling-collective-cloud-turn-v1',requestId:'generation-17',
    messages:[{role:'user',content:'SECRET PROMPT'}]};
  const response={ok:true,usage:{chargedNeurons:12},text:'PRIVATE GENERATED OUTPUT'};
  return {mesh,session,request,response,calls};
}
test('cloud reports never log non-Starling calls, mismatched Guilds or failures',async()=>{
  const h=harness();
  assert.equal((await recordStarlingCloudGeneration({...h,request:{...h.request,purpose:'normal-guide-chat'},now:()=>new Date(DAY)})).recorded,false);
  assert.equal((await recordStarlingCloudGeneration({...h,request:{...h.request,guildId:'another'},now:()=>new Date(DAY)})).recorded,false);
  assert.equal((await recordStarlingCloudGeneration({...h,response:{ok:false},now:()=>new Date(DAY)})).recorded,false);
  assert.equal(h.calls.length,0);
});
test('post-success cloud reporting is signed, idempotent and excludes private texts',async()=>{
  const h=harness(),input={mesh:h.mesh,session:h.session,request:h.request,response:h.response,model:'@cf/example/preview',
    now:()=>new Date(DAY)};
  const a=await recordStarlingCloudGeneration(input),b=await recordStarlingCloudGeneration(input);
  assert.equal(a.recorded,true);assert.equal(b.eventId,a.eventId);
  assert.equal(h.calls.length,1);
  const record=h.calls[0];
  assert.equal(record.kind,'civweave.starling-report-event.v1');
  assert.equal(record.payload.source,'cloud-ai');
  assert.equal(record.payload.status,'completed');
  assert.equal(record.payload.referenceId,'generation-17');
  assert.match(record.payload.summary,/12 recorded neurons/);
  assert.doesNotMatch(JSON.stringify(record),/SECRET PROMPT|PRIVATE GENERATED OUTPUT/);
});
test('cloud response without usage is honestly labeled as unreported consumption',async()=>{
  const h=harness();
  const result=await recordStarlingCloudGeneration({mesh:h.mesh,session:h.session,request:h.request,
    response:{ok:true},now:()=>new Date(DAY)});
  assert.equal(result.recorded,true);
  assert.match(h.calls[0].payload.summary,/usage not supplied/);
});
