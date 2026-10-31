import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
import {DatabaseSync} from 'node:sqlite';

// Same browser-free Cloudflare DO shim used by existing Guild transport tests.
register(`data:text/javascript,${encodeURIComponent("export async function resolve(s,c,n){if(s==='cloudflare:workers')return{url:'data:text/javascript,export class DurableObject { constructor(ctx,env){this.ctx=ctx;this.env=env;} }',shortCircuit:true};return n(s,c)}")}`,import.meta.url);
const mobile=await import('../cloudflare/mobile-guild-edge/src/creator-provenance-entry.mjs');
class Storage{
 rows=new Map();pending=Promise.resolve();
 async get(k){return structuredClone(this.rows.get(k));}
 async put(k,v){this.rows.set(k,structuredClone(v));}
 async delete(k){return this.rows.delete(k);}
 async list({prefix='',limit=1000}={}){return new Map([...this.rows].filter(([k])=>k.startsWith(prefix)).slice(0,limit));}
 transaction(fn){
  const job=this.pending.then(async()=>{const copy=structuredClone(this.rows);
    try{return await fn(this)}catch(err){this.rows=copy;throw err}});
  this.pending=job.catch(()=>{});return job;
 }
}
test('mobile-owned Guild Cloud authenticates persona room, shared turns and actual Worldweaver speech',async()=>{
 const db=new DatabaseSync(':memory:'),store=new Storage();
 store.sql={exec:(sql,...args)=>db.prepare(sql).all(...args)};
 try{
  const env={},capacity=new mobile.CivweaveGuildCapacityState({storage:store},env);
  env.CAPACITY={idFromName:id=>id,get:()=>capacity};
  capacity.bootstrap({guildId:'magic-mobile',displayName:'Magical Guild',origin:'https://mobile.example.test'});
  const alice=await capacity.joinResident({requestedNodeId:'magic-mobile-a',userId:'alice',
   credentialHash:'alice-persona-test-key',origin:'https://mobile.example.test'});
  const bob=await capacity.joinResident({requestedNodeId:'magic-mobile-b',userId:'bob',
   credentialHash:'bob-persona-test-key',origin:'https://mobile.example.test'});
  const call=async(member,action,input)=>{
   const path={create:'',snapshot:'/snapshot',dispatch:'/dispatch',draft:'/draft',approve:'/approve'}[action];
   const url=new URL('https://mobile.example.test/api/node/persona-campaigns'+path);
   url.searchParams.set('nodeId',member.nodeId);
   if(action==='snapshot')url.searchParams.set('campaignId',input.campaignId);
   const res=await mobile.default.fetch(new Request(url,{method:action==='snapshot'?'GET':'POST',
    headers:{authorization:'Bearer '+member.token,'content-type':'application/json'},
    ...(action==='snapshot'?{}:{body:JSON.stringify(input)})}),env,{});
   return{status:res.status,body:await res.json()};
  };
  const created=await call(alice,'create',{packId:'mobile-private',packVersion:1,
    characters:[{id:'landry',name:'Landry'},{id:'delia',name:'Delia'}],
    cast:['landry','delia'],stage:1,scenario:'In the foyer'});
  assert.equal(created.status,201,JSON.stringify(created.body));
  const id=created.body.room.id;
  assert.equal((await call(bob,'snapshot',{campaignId:id})).status,404);
  const seat=await call(alice,'dispatch',{campaignId:id,expectedRevision:0,
    command:{type:'assign-player',playerId:'member:bob',roleId:'delia'}});
  assert.equal(seat.status,200,JSON.stringify(seat.body));
  // Both starter nodes are in one verified Guild, so an invited member on
  // another node can join without copying any private manuscript source data.
  const crossNode=await call(bob,'snapshot',{campaignId:id});
  assert.equal(crossNode.status,200,JSON.stringify(crossNode.body));
  const cue=await call(bob,'dispatch',{campaignId:id,expectedRevision:1,
    command:{type:'player-cue',text:'I will stay near the door.'}});
  assert.equal(cue.status,200,JSON.stringify(cue.body));
  const staged=await call(alice,'draft',{campaignId:id,expectedRevision:2,
    characterId:'landry',speech:'The outside world is changing.'});
  assert.equal(staged.status,200,JSON.stringify(staged.body));
  const done=await call(alice,'approve',{campaignId:id,expectedRevision:2,draftId:staged.body.draft.id});
  assert.equal(done.status,200,JSON.stringify(done.body));
  assert.match(done.body.worldReceiptId,/^world:/);
  assert.equal(done.body.world.simulatedOnly,true);
  const latest=await call(alice,'snapshot',{campaignId:id});
  assert.equal(latest.body.world.speeches[0].status,'succeeded');
 }finally{db.close();}
});
