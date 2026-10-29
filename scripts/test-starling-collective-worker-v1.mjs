import test from 'node:test';
import assert from 'node:assert/strict';
import {createStarlingGuildWorker} from '../public/app/shared/starling-collective-worker-v1.mjs';

function harness(){
 const nowRef={value:Date.parse('2026-10-28T15:00:00.000Z')},rows=new Map(),signed=[],turns=[],calls=[];
 const model={
   async runOneTurn(input){calls.push(input); const obj={id:'turn-'+calls.length,payload:{personaId:input.personaId,text:'Draft outcome '+calls.length}};turns.push({id:obj.id,at:new Date(nowRef.value).toISOString(),personaId:input.personaId});return obj},
   async readTurns(){return turns}
 };
 const mesh={
   async deviceId(){return 'device:founder'},
   async getObject(id){return id==='guild-genesis:garden'?{id,kind:'civweave.guild-genesis.v1',signature:'good',origin:{nodeId:'device:founder'},payload:{guildId:'garden',foundingDeviceId:'device:founder',foundingIntention:{text:'Start an accessible garden'} }}:rows.get(id)||null},
   async createObject(input){const rec={...input,origin:{nodeId:'device:founder'},signature:'good',revisionHash:'sha'+signed.length,createdAt:new Date(nowRef.value).toISOString()};rows.set(input.id,rec);signed.push(rec);return rec},
   async listObjects(){return signed},
   async validateObject(row){return{ok:row?.signature==='good'}}
 };
 const founder=()=>({guildId:'garden',deviceId:'device:founder'});
 const worker=createStarlingGuildWorker({mesh,turnService:model,founder,now:()=>nowRef.value,randomId:()=>String(signed.length+1)});
 return {worker,rows,signed,calls,turns,nowRef,mesh,model};
}
test('requires explicit Guildkeeper opt-in; read/open never runs a model',async()=>{
 const h=harness();const status=await h.worker.status('garden');
 assert.equal(status.enabled,false);assert.equal(h.calls.length,0);
 assert.deepEqual(await h.worker.tick('garden'),{status:'disabled',executed:0});
});
test('opt-in persists signed device-local policy, with bounded cadence',async()=>{
 const h=harness();
 await assert.rejects(()=>h.worker.enable('garden',{confirmConsent:()=>false}),/consent/);
 const enabled=await h.worker.enable('garden',{confirmConsent:()=>true,intervalMinutes:30,dailyLimit:3});
 assert.equal(enabled.enabled,true);
 assert.equal(enabled.intervalMinutes,30);
 assert.equal(h.rows.get('starling-worker-policy:garden').consent,'private');
 assert.equal((await h.worker.status('garden')).enabled,true);
});
test('scheduler writes a durable started receipt before model call and a completed receipt after',async()=>{
 const h=harness();await h.worker.enable('garden',{confirmConsent:()=>true,intervalMinutes:30,dailyLimit:3});
 h.model.runOneTurn=async input=>{
   assert.equal(h.signed.at(-1).payload.status,'started');
   h.calls.push(input);
   return {id:'turn-1',payload:{personaId:input.personaId}};
 };
 const outcome=await h.worker.tick('garden');
 assert.equal(outcome.status,'completed');assert.equal(outcome.executed,1);
 assert.equal(h.signed.filter(r=>r.kind==='civweave.starling-collective-work-receipt.v1').length,2);
 assert.equal(h.signed.at(-1).payload.turnId,'turn-1');
 assert.equal((await h.worker.tick('garden')).status,'cooldown');
});
test('after process restart, signed receipt prevents repeated work',async()=>{
 const h=harness();await h.worker.enable('garden',{confirmConsent:()=>true,intervalMinutes:30,dailyLimit:2});
 await h.worker.tick('garden');
 const second=createStarlingGuildWorker({mesh:h.mesh,turnService:h.model,founder:()=>({guildId:'garden',deviceId:'device:founder'}),now:()=>h.nowRef.value,randomId:()=>String(h.signed.length+1)});
 assert.equal((await second.tick('garden')).status,'cooldown');
 h.nowRef.value+=30*60000;
 assert.equal((await second.tick('garden')).status,'completed');
 assert.equal(h.calls.length,2);
});
test('signed daily generation cap is enforced even across restarts',async()=>{
 const h=harness();await h.worker.enable('garden',{confirmConsent:()=>true,intervalMinutes:15,dailyLimit:2});
 assert.equal((await h.worker.tick('garden')).status,'completed');
 h.nowRef.value+=16*60000;assert.equal((await h.worker.tick('garden')).status,'completed');
 h.nowRef.value+=16*60000;assert.equal((await h.worker.tick('garden')).status,'daily-limit');
 assert.equal(h.calls.length,2);
});
test('unfinished durable started receipt blocks automatic retry after interruption',async()=>{
 const h=harness();await h.worker.enable('garden',{confirmConsent:()=>true,intervalMinutes:15,dailyLimit:2});
 await h.mesh.createObject({id:'starling-work-receipt:garden:run1:started',kind:'civweave.starling-collective-work-receipt.v1',consent:'group',audience:['guild:garden'],payload:{schema:'civweave.starling-work-receipt.v1',guildId:'garden',runId:'run1',status:'started',at:new Date(h.nowRef.value).toISOString()}});
 assert.equal((await h.worker.tick('garden')).status,'interrupted-review-required');
 assert.equal(h.calls.length,0);
});
test('failed inference records failure without claiming success',async()=>{
 const h=harness();await h.worker.enable('garden',{confirmConsent:()=>true});
 h.model.runOneTurn=async()=>{throw new Error('Local model unavailable')};
 await assert.rejects(()=>h.worker.tick('garden'),/Local model unavailable/);
 assert.equal(h.signed.at(-1).payload.status,'failed');
 assert.equal((await h.worker.tick('garden')).status,'failed-review-required');
});
test('opt out is durable; stops the next automatic run',async()=>{
 const h=harness();await h.worker.enable('garden',{confirmConsent:()=>true});
 await h.worker.disable('garden');
 assert.equal((await h.worker.tick('garden')).status,'disabled');
 assert.equal(h.calls.length,0);
});
test('foreign signer and invalid policy signatures fail closed',async()=>{
 const h=harness();await h.worker.enable('garden',{confirmConsent:()=>true});
 h.rows.get('starling-worker-policy:garden').origin.nodeId='device:other';
 assert.equal((await h.worker.status('garden')).enabled,false);
 assert.equal((await h.worker.tick('garden')).status,'disabled');
});
test('never issues task claims, reward payments or external tool actions implicitly',async()=>{
 const h=harness();await h.worker.enable('garden',{confirmConsent:()=>true});
 await h.worker.tick('garden');
 assert.equal(h.calls.length,1);
 assert.equal(typeof h.worker.claimTask,'undefined');
});
test('task discovery requires current authenticated board and separately verified human publisher',async()=>{
 const h=harness();
 const packet={guildId:'garden',quests:[{schema:'civweave.guild-quest-publication.v1',status:'published',id:'p1',guildId:'garden',authorUserId:'human1',revision:1,quest:{id:'q1',kind:'weave-plan',plan:{schema:'civweave.intention-weave.v1',title:'Test',paths:[{realm:'cerbanimo',steps:[{id:'beat1',title:'Write event description',status:'ready'}]}]}}}]};
 const src={sessionForGuild:()=>({userId:'viewer'}),list:async()=>packet};
 const all=await h.worker.discover('garden',{guild:{id:'garden'},questClient:src,capabilities:[{id:'writing',enabled:true}],verifyHumanPublisher:()=>true});
 assert.equal(all.length,1);assert.equal(all[0].action,'suggest-offer-only');
 const denied=await h.worker.discover('garden',{guild:{id:'garden'},questClient:src,capabilities:[{id:'writing',enabled:true}],verifyHumanPublisher:()=>false});
 assert.equal(denied.length,0);
 assert.deepEqual(await h.worker.discover('garden',{guild:{id:'garden'},questClient:{...src,sessionForGuild:()=>null},verifyHumanPublisher:()=>true}),[]);
});
