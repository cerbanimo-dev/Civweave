import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import worker,{CivweaveCloudNode} from '../cloudflare/node-cloud/src/server-ai-entry-v7.mjs';
import {GUILD_PERSONA_ROUTE} from '../cloudflare/mobile-guild-edge/src/guild-persona-campaign-v1.mjs';
class Storage {
 rows=new Map();pending=Promise.resolve();
 async get(k){return structuredClone(this.rows.get(k));}
 async put(k,v){this.rows.set(k,structuredClone(v));}
 async delete(k){return this.rows.delete(k);}
 async list({prefix='',limit=1000}={}){return new Map([...this.rows].filter(([k])=>k.startsWith(prefix)).slice(0,limit));}
 transaction(run){
  const job=this.pending.then(async()=>{const old=structuredClone(this.rows);
   try{return await run(this)}catch(error){this.rows=old;throw error}});
  this.pending=job.catch(()=>{});return job;
 }
}
const secret='fictional-persona-guild-sessions-secret';
const token=(user='alice',node='arcadia')=>{
 const raw=Buffer.from(JSON.stringify({v:1,nodeId:node,userId:user,exp:Math.floor(Date.now()/1000)+300})).toString('base64url');
 const key=createHash('sha256').update('civweave.capacity-session.v1\0'+secret).digest();
 return raw+'.'+createHmac('sha256',key).update('civweave.capacity-session.v1\n'+raw).digest('base64url');
};
function harness(){
 const stores=new Map();const env={NODE_FABRIC_SESSION_SECRET:secret,NODE_DOMAIN:'nodes.example.invalid'};
 env.CAPACITY={idFromName:id=>id,get:()=>({fetch:async(_url,opts)=>Response.json({member:{...JSON.parse(opts.body),seatClass:'community'},quota:{}})})};
 env.NODES={idFromName:id=>id,get:id=>{
   if(!stores.has(id))stores.set(id,new Storage());
   const node=new CivweaveCloudNode({storage:stores.get(id)},env);
   return{fetch:(url,opts)=>node.fetch(new Request(url,opts))};
 }};
 return {env,stores,async request(action,{user='alice',node='arcadia',input,auth=token(user,node),method}={}){
  const route=action==='create'?'':action==='snapshot'?'/snapshot':'/dispatch';
  const target=new URL('https://guild.example.test'+GUILD_PERSONA_ROUTE+route);
  target.searchParams.set('nodeId',node);
  if(action==='snapshot')target.searchParams.set('campaignId',input?.campaignId||'');
  const req=new Request(target,{method:method|| (action==='snapshot'?'GET':'POST'),
   headers:{authorization:'Bearer '+auth,'content-type':'application/json'},
   ...(action==='snapshot'?{}:{body:JSON.stringify(input||{})})});
  const response=await worker.fetch(req,env,{});
  return {status:response.status,data:await response.json().catch(()=>({})),headers:response.headers};
 }};
}
const starting={
 packId:'mirror-author-private',packVersion:3,
 characters:[{id:'landry',name:'Landry'},{id:'delia',name:'Delia'}],
 cast:['landry','delia'],stage:1,
 title:'Private split-mind exploration',scenario:'Two voices disagree about a visitor.'
};
test('authenticated real Guild HTTP route creates a private room inside node Durable Object',async()=>{
 const h=harness();
 const created=await h.request('create',{input:starting});
 assert.equal(created.status,201,JSON.stringify(created.data));
 assert.equal(created.data.room.ownerId,'member:alice');
 assert.equal(created.data.room.branchId.startsWith('what-if:'),true);
 assert.equal(created.data.room.events.length,0);
 assert.equal(created.data.room.packId,'mirror-author-private');
 const id=created.data.room.id;
 assert.equal((await h.request('snapshot',{input:{campaignId:id}})).status,200);
 assert.equal((await h.request('snapshot',{user:'bob',input:{campaignId:id}})).status,404);
 assert.equal((await h.request('snapshot',{node:'elsewhere',input:{campaignId:id}})).status,404);
 const anon=await h.request('snapshot',{input:{campaignId:id},auth:'invalid'});
 assert.equal(anon.status,401);
});
test('seat assignment admits a second Guild member; concurrent turns reject stale revisions',async()=>{
 const h=harness(),created=await h.request('create',{input:starting}),id=created.data.room.id;
 const grant=await h.request('dispatch',{input:{campaignId:id,expectedRevision:0,
  command:{type:'assign-player',playerId:'member:bob',roleId:'delia'}}});
 assert.equal(grant.status,200,JSON.stringify(grant.data));
 assert.equal((await h.request('snapshot',{user:'bob',input:{campaignId:id}})).status,200);
 const forbidden=await h.request('dispatch',{user:'bob',input:{campaignId:id,expectedRevision:1,
  command:{type:'stage-set',stage:100}}});
 assert.equal(forbidden.status,403);
 const simultaneous=await Promise.all([
   h.request('dispatch',{user:'alice',input:{campaignId:id,expectedRevision:1,command:{type:'player-cue',text:'I hear a door.'}}}),
   h.request('dispatch',{user:'bob',input:{campaignId:id,expectedRevision:1,command:{type:'player-cue',text:'I reach for the handle.'}}})
 ]);
 assert.equal(simultaneous.filter(x=>x.status===200).length,1,JSON.stringify(simultaneous));
 assert.equal(simultaneous.filter(x=>x.status===409).length,1,JSON.stringify(simultaneous));
 const state=await h.request('snapshot',{input:{campaignId:id}});
 assert.equal(state.data.room.revision,2);
 assert.equal(state.data.room.turn,1);
});
test('forged actor principal, model proposal, and runtime receipts cannot enter human endpoint',async()=>{
 const h=harness(),created=await h.request('create',{input:starting}),id=created.data.room.id;
 const forged=await h.request('dispatch',{user:'bob',input:{campaignId:id,expectedRevision:0,
  actor:{kind:'human',principalId:'member:alice',verified:true},
  command:{type:'stage-set',stage:17}}});
 assert.equal(forged.status,404);
 const receipt=await h.request('dispatch',{input:{campaignId:id,expectedRevision:0,
  command:{type:'resolve-proposal',proposalId:'event-1',outcome:'succeeded',worldReceiptId:'fake'}}});
 assert.equal(receipt.status,403);
 const proposal=await h.request('dispatch',{input:{campaignId:id,expectedRevision:0,
  command:{type:'npc-proposal',characterId:'landry',speech:'I speak',proposedActions:[]}}});
 assert.equal(proposal.status,403);
});
test('internal Durable Object route rejects forged member records without shared secret',async()=>{
 const h=harness(),node=h.env.NODES.get('arcadia');
 const reply=await node.fetch('https://node.internal/internal/guild-persona?nodeId=arcadia',{
  method:'POST',headers:{'x-civweave-node-id':'arcadia','content-type':'application/json'},
  body:JSON.stringify({member:{nodeId:'arcadia',userId:'alice'},action:'create',input:starting})
 });
 assert.equal(reply.status,403);
 const options=await worker.fetch(new Request('https://guild.example.test'+GUILD_PERSONA_ROUTE+'/dispatch',
  {method:'OPTIONS'}),h.env,{});
 assert.equal(options.status,204);
});

test('host approves one bounded NPC line: queued Worldweaver speak becomes a real server-verified receipt',async()=>{
 const h=harness(),made=await h.request('create',{input:starting}),roomId=made.data.room.id;
 assert.equal(made.status,201);
 const stage=await h.request('draft',{input:{campaignId:roomId,expectedRevision:0,
  characterId:'landry',speech:'The door is moving.',
  actions:[{tool:'speak',args:{text:'The door is moving.'}}],
  actor:{kind:'runtime',principalId:'server:spoof'}}});
 assert.equal(stage.status,200,JSON.stringify(stage.data));
 assert.equal(stage.data.draft.origin,'untrusted-player-submitted');
 const before=await h.request('snapshot',{input:{campaignId:roomId}});
 assert.equal(before.data.world,null);
 assert.equal(before.data.pendingDrafts.length,1);
 assert.equal(before.data.room.revision,0);
 const approved=await h.request('approve',{input:{campaignId:roomId,expectedRevision:0,draftId:stage.data.draft.id}});
 assert.equal(approved.status,200,JSON.stringify(approved.data));
 assert.match(approved.data.worldReceiptId,/^world:/);
 assert.equal(approved.data.world.simulatedOnly,true);
 assert.deepEqual(approved.data.room.events.map(e=>e.type),
  ['bind-pilot','npc-proposal','resolve-proposal']);
 assert.equal(approved.data.room.events.at(-1).worldChanged,true);
 const after=await h.request('snapshot',{input:{campaignId:roomId}});
 assert.equal(after.status,200,JSON.stringify(after.data));
 assert.equal(after.data.room.revision,3);
 assert.equal(after.data.world.speeches.length,1);
 assert.equal(after.data.world.speeches[0].status,'succeeded');
 assert.equal(after.data.world.speeches[0].text,'The door is moving.');
 assert.equal(after.data.pendingDrafts.length,0);
 const again=await h.request('approve',{input:{campaignId:roomId,expectedRevision:3,draftId:stage.data.draft.id}});
 assert.equal(again.status,404);
});
test('unseated members cannot submit draft, members cannot self-approve, movement is rejected',async()=>{
 const h=harness(),made=await h.request('create',{input:starting}),campaignId=made.data.room.id;
 const unauth=await h.request('draft',{user:'mallory',input:{campaignId,expectedRevision:0,
   characterId:'landry',speech:'Impersonation'}});
 assert.equal(unauth.status,403);
 const seat=await h.request('dispatch',{input:{campaignId,expectedRevision:0,
   command:{type:'assign-player',playerId:'member:bob',roleId:'delia'}}});
 assert.equal(seat.status,200);
 const illegal=await h.request('draft',{user:'bob',input:{campaignId,expectedRevision:1,
   characterId:'landry',speech:'Not mine'}});
 assert.equal(illegal.status,403);
 const badMove=await h.request('draft',{user:'bob',input:{campaignId,expectedRevision:1,
   characterId:'delia',speech:'Move',actions:[{tool:'move',args:{direction:'north'}}]}});
 assert.equal(badMove.status,400);
 const legal=await h.request('draft',{user:'bob',input:{campaignId,expectedRevision:1,
   characterId:'delia',speech:'I disagree!'}});
 assert.equal(legal.status,200,JSON.stringify(legal.data));
 const wrongApprover=await h.request('approve',{user:'bob',input:{campaignId,expectedRevision:1,
   draftId:legal.data.draft.id}});
 assert.equal(wrongApprover.status,403);
 const bobRead=await h.request('snapshot',{user:'bob',input:{campaignId}});
 assert.equal(bobRead.status,200);
 assert.equal(bobRead.data.pendingDrafts.length,0);
});

test('dual override is atomic and records both speech receipts without suppressing either voice',async()=>{
 const h=harness(),made=await h.request('create',{input:starting}),campaignId=made.data.room.id;
 const a=await h.request('draft',{input:{campaignId,expectedRevision:0,
   characterId:'landry',speech:'I want to open the door.'}});
 const b=await h.request('draft',{input:{campaignId,expectedRevision:0,
   characterId:'delia',speech:'Wait. We need a plan.'}});
 assert.equal(a.status,200,JSON.stringify(a.data));
 assert.equal(b.status,200,JSON.stringify(b.data));
 const result=await h.request('approve-both',{input:{campaignId,expectedRevision:0,
   draftIds:[b.data.draft.id,a.data.draft.id]}});
 assert.equal(result.status,200,JSON.stringify(result.data));
 assert.equal(result.data.bothSpoke,true);
 assert.equal(result.data.room.willpower.points,0);
 assert.equal(result.data.worldReceiptIds.length,2);
 assert.match(result.data.speech,/Landry: I want to open the door\./);
 assert.match(result.data.speech,/Delia: Wait\. We need a plan\./);
 assert.deepEqual(result.data.room.events.slice(0,2).map(e=>e.characterId),['landry','delia']);
 assert.deepEqual(result.data.room.events.slice(0,2).map(e=>e.type),['willpower-spend','willpower-spend']);
 assert.equal(result.data.room.events.filter(e=>e.type==='resolve-proposal'&&e.worldChanged).length,2);
 const latest=await h.request('snapshot',{input:{campaignId}});
 assert.equal(latest.data.world.speeches.length,2);
 assert.equal(latest.data.world.speeches.every(x=>x.status==='succeeded'),true);
 assert.equal(latest.data.pendingDrafts.length,0);
});
test('dual override cannot spend one voice when total willpower insufficient',async()=>{
 const h=harness(),made=await h.request('create',{input:starting}),campaignId=made.data.room.id;
 const a=await h.request('draft',{input:{campaignId,expectedRevision:0,characterId:'landry',speech:'First'}});
 const b=await h.request('draft',{input:{campaignId,expectedRevision:0,characterId:'delia',speech:'Second'}});
 const single=await h.request('approve',{input:{campaignId,expectedRevision:0,draftId:a.data.draft.id}});
 assert.equal(single.status,200);
 const next=await h.request('approve-both',{input:{campaignId,expectedRevision:single.data.room.revision,
   draftIds:[a.data.draft.id,b.data.draft.id]}});
 assert.equal(next.status,409);
 const snapshot=await h.request('snapshot',{input:{campaignId}});
 assert.equal(snapshot.data.room.events.filter(x=>x.type==='willpower-spend').length,0);
 assert.equal(snapshot.data.world.speeches.length,1);
});
