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
 await h.mesh.createObject({id:'starling-work-receipt:garden:run1:started',kind:'civweave.starling-collective-work-receipt.v1',consent:'group',audience:['guild:garden'],payload:{schema:'civweave.starling-work-receipt.v1',guildId:'garden',policyRevision:1,runId:'run1',status:'started',at:new Date(h.nowRef.value).toISOString()}});
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

test('automatic scan produces a reviewable offer linked to a verified published Quest beat, not a task claim',async()=>{
 const h=harness();
 const offer={guildId:'garden',questId:'q1',publicationId:'pub-1',beatId:'beat-1',beatTitle:'Write a volunteer schedule',matchingCapabilities:['writing'],action:'suggest-offer-only',requiresCanonicalClaim:true};
 const worker=createStarlingGuildWorker({mesh:h.mesh,turnService:h.model,founder:()=>({guildId:'garden',deviceId:'device:founder'}),now:()=>h.nowRef.value,randomId:()=>String(h.signed.length+1),readTaskOpportunities:async()=>[offer]});
 await worker.enable('garden',{confirmConsent:()=>true});
 const run=await worker.tick('garden');
 assert.equal(run.status,'completed');
 assert.equal(h.calls[0].questId,'q1');
 assert.match(h.calls[0].taskPrompt,/volunteer schedule/);
 assert.match(h.calls[0].taskPrompt,/not claim/i);
 assert.equal(h.signed.at(-1).payload.beatId,'beat-1');
 assert.equal(typeof worker.claimTask,'undefined');
});

test('a Quest beat already offered to is not repeatedly offered every automatic cycle',async()=>{
 const h=harness();const beat={guildId:'garden',questId:'q1',beatId:'b1',beatTitle:'Write an accessibility guide',action:'suggest-offer-only',requiresCanonicalClaim:true};
 const worker=createStarlingGuildWorker({mesh:h.mesh,turnService:h.model,founder:()=>({guildId:'garden',deviceId:'device:founder'}),now:()=>h.nowRef.value,randomId:()=>String(h.signed.length+1),readTaskOpportunities:async()=>[beat]});
 await worker.enable('garden',{confirmConsent:()=>true,intervalMinutes:15,dailyLimit:3});
 await worker.tick('garden');h.nowRef.value+=16*60000;
 await worker.tick('garden');
 assert.match(h.calls[0].taskPrompt,/accessibility guide/);
 assert.doesNotMatch(h.calls[1].taskPrompt,/accessibility guide/);
});

const generatedPlan=JSON.stringify({title:'Neighborhood anti-litter content kit',outcome:'Draft educational copy and an accessible action guide for human review',tasks:[
 {assignee:'ai',kind:'writing',title:'Draft neighborhood litter explainer',deliverable:'Draft outreach article text'},
 {assignee:'human',requiredSkill:'sanitation',title:'Collect litter in neighborhood',deliverable:'Clean a street'},
 {assignee:'ai',kind:'storyboard',title:'Draft visual campaign storyboard',deliverable:'Draft storyboard script and image notes'}
]});
test('Guildkeeper main goal immediately creates a signed, self-initiated AI-only project',async()=>{
 const h=harness();
 h.model.runOneTurn=async input=>{h.calls.push(input);return{id:'turn-'+h.calls.length,payload:{personaId:input.personaId,text:generatedPlan}}};
 const activated=await h.worker.enable('garden',{confirmConsent:()=>true,goal:'Reduce litter in our town and develop useful outreach materials.',siloMode:false,intervalMinutes:15,dailyLimit:12});
 assert.equal(activated.goal.includes('Reduce litter'),true);
 const result=await h.worker.tick('garden');
 assert.equal(result.status,'project-created');assert.equal(result.aiTasks,2);
 const board=await h.worker.readProjects('garden');
 assert.equal(board.projects.length,1);
 assert.equal(board.projects[0].tasks.length,2);
 assert.equal(board.projects[0].aiOnly,true);
 assert.equal(board.projects[0].canonicalQuestId,null);
 assert.match(h.calls[0].taskPrompt,/Reply ONLY valid compact JSON/);
});
test('next autonomous cycle produces actual signed AI draft for task, never marks Quest completed',async()=>{
 const h=harness();
 h.model.runOneTurn=async input=>{h.calls.push(input);return{id:'turn-'+h.calls.length,payload:{personaId:input.personaId,text:h.calls.length===1?generatedPlan:'Here is a draft outline for outreach: keep litter out of streams.'}}};
 await h.worker.enable('garden',{confirmConsent:()=>true,goal:'Reduce litter in our town and develop useful outreach materials.',siloMode:true,intervalMinutes:15,dailyLimit:12});
 await h.worker.tick('garden');
 h.nowRef.value+=16*60000;
 const result=await h.worker.tick('garden');
 assert.equal(result.status,'task-drafted');
 const board=await h.worker.readProjects('garden');
 assert.equal(board.outputs.length,1);assert.match(board.outputs[0].text,/draft outline/);
 assert.equal(board.outputs[0].completed,false);
 assert.equal(board.outputs[0].canonicalProof,false);
 assert.equal(board.projects[0].tasks.every(x=>x.assignee==='ai'),true);
});
test('silo mode and unknown skills never allow AI to assign human physical work',async()=>{
 const h=harness();
 h.model.runOneTurn=async()=>({id:'turn',payload:{text:generatedPlan}});
 await h.worker.enable('garden',{confirmConsent:()=>true,goal:'Organize humane solutions to the local stray cat crisis.',siloMode:true});
 await h.worker.tick('garden');
 const board=await h.worker.readProjects('garden');
 assert.equal(board.projects[0].tasks.some(t=>t.assignee==='human'),false);
});
test('malformed autonomous project does not mint a project and is recorded as failed',async()=>{
 const h=harness();h.model.runOneTurn=async()=>({id:'turn',payload:{text:'Not parseable structured JSON'}});
 await h.worker.enable('garden',{confirmConsent:()=>true,goal:'Develop a range of community outreach draft materials.'});
 await assert.rejects(()=>h.worker.tick('garden'));
 assert.equal((await h.worker.readProjects('garden')).projects.length,0);
 assert.equal(h.signed.at(-1).payload.status,'failed');
});

test('signed main goal and project backlog survive disabling and resuming autonomous work',async()=>{
 const h=harness();
 h.model.runOneTurn=async()=>({id:'turn:project',payload:{text:generatedPlan}});
 const goal='Create a neighborhood litter education and outreach program.';
 await h.worker.enable('garden',{confirmConsent:()=>true,goal,siloMode:true});
 await h.worker.tick('garden');
 const first=await h.worker.readProjects('garden');
 assert.equal(first.projects.length,1);
 await h.worker.disable('garden');
 await h.worker.enable('garden',{confirmConsent:()=>true,goal,siloMode:true});
 const second=await h.worker.readProjects('garden');
 assert.equal(second.projects.length,1);
 assert.equal(first.goalId,second.goalId);
});
