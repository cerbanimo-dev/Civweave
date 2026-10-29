import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { register } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import worker, { CivweaveCloudNode } from '../cloudflare/node-cloud/src/server-ai-entry-v7.mjs';

class Storage {
  rows=new Map(); pending=Promise.resolve();
  async get(k){return structuredClone(this.rows.get(k));}
  async put(k,v){this.rows.set(k,structuredClone(v));}
  async delete(k){return this.rows.delete(k);}
  async list({prefix='',limit=1000}={}){return new Map([...this.rows].filter(([k])=>k.startsWith(prefix)).slice(0,limit));}
  transaction(run){const p=this.pending.then(async()=>{const before=structuredClone(this.rows);try{return await run(this)}catch(e){this.rows=before;throw e}});this.pending=p.catch(()=>{});return p;}
}
const secret='fictional-starling-transport-session-secret';
function token(user='fictional-member',nodeId='fictional-guild'){
  const raw=Buffer.from(JSON.stringify({v:1,nodeId,userId:user,exp:Math.floor(Date.now()/1000)+600})).toString('base64url');
  const key=createHash('sha256').update(`civweave.capacity-session.v1\0${secret}`).digest();
  return raw+'.'+createHmac('sha256',key).update(`civweave.capacity-session.v1\n${raw}`).digest('base64url');
}
function harness(){
  const stores=new Map(),env={NODE_FABRIC_SESSION_SECRET:secret,NODE_DOMAIN:'nodes.example.invalid'};
  env.CAPACITY={idFromName:n=>n,get:()=>({fetch:async(_u,i)=>Response.json({member:{...JSON.parse(i.body),seatClass:'community'},quota:{}})})};
  env.NODES={idFromName:n=>n,get:n=>{if(!stores.has(n))stores.set(n,new Storage());const owner=new CivweaveCloudNode({storage:stores.get(n)},env);return{fetch:(u,i)=>owner.fetch(new Request(u,i))}}};
  return {env,async call(action='',input,auth=token()){
    const r=await worker.fetch(new Request('https://guild.example.test/api/node/starling'+(action?'/'+action:'')+'?nodeId=fictional-guild',{method:input?'POST':'GET',headers:{authorization:'Bearer '+auth,'content-type':'application/json'},...(input?{body:JSON.stringify(input)}:{})}),env,{});
    return {status:r.status,headers:r.headers,data:await r.json()};
  }};
}
test('authenticated Starling transport enforces three slots across concurrent members and refuses forged completion',async()=>{
 const h=harness(); assert.equal((await h.call()).status,200);
 const made=await Promise.all(Array.from({length:4},(_,i)=>h.call('reserve',{idempotencyKey:'test:'+i,title:'Test '+i,mode:'autonomous'},token('fictional-member-'+i))));
 assert.equal(made.filter(x=>x.status===201).length,3); assert.equal(made.filter(x=>x.status===409).length,1);
 const first=made[0].data.line;
 const forged=await h.call('complete',{id:first.id,expectedRevision:first.revision,verifiedCompletion:{authority:'canonical-quest-proof',state:'completed',receiptId:'forged'}},token('fictional-member-0'));
 assert.equal(forged.status,403);
 assert.equal((await h.call()).data.activeCount,3);
});
test('Starling routes reject unauthenticated and internal-forged requests while preflight remains accessible',async()=>{
 const h=harness(); assert.equal((await h.call('',undefined,'invalid')).status,401);
 const node=new CivweaveCloudNode({storage:new Storage()},h.env);
 const r=await node.fetch(new Request('https://node.internal/internal/guild-starling',{method:'POST',body:JSON.stringify({member:{nodeId:'fictional-guild',userId:'fictional-member'},action:'status'})}));
 assert.equal(r.status,403);
 const pre=await worker.fetch(new Request('https://guild.example.test/api/node/starling/reserve',{method:'OPTIONS'}),h.env,{});
 assert.equal(pre.status,204); assert.equal(pre.headers.get('access-control-allow-origin'),'*');
});
test('mobile starter nodes share the same authenticated Guild reservations and reported Passport context',async()=>{
 register(`data:text/javascript,${encodeURIComponent("export async function resolve(s,c,n){if(s==='cloudflare:workers')return{url:'data:text/javascript,export class DurableObject { constructor(ctx,env){this.ctx=ctx;this.env=env;} }',shortCircuit:true};return n(s,c)}")}`,import.meta.url);
 const mobile=await import('../cloudflare/mobile-guild-edge/src/creator-provenance-entry.mjs');
 const database=new DatabaseSync(':memory:'),storage=new Storage();storage.sql={exec:(q,...args)=>database.prepare(q).all(...args)};
 try{
  const env={},capacity=new mobile.CivweaveGuildCapacityState({storage},env);env.CAPACITY={idFromName:n=>n,get:()=>capacity};
  capacity.bootstrap({guildId:'fictional-mobile-guild',displayName:'Fictional Guild',origin:'https://mobile.example.test'});
  const a=await capacity.joinResident({requestedNodeId:'fictional-mobile-guild-a',userId:'fictional-alice',credentialHash:'fictional-alice-credential',origin:'https://mobile.example.test'});
  const b=await capacity.joinResident({requestedNodeId:'fictional-mobile-guild-b',userId:'fictional-bobby',credentialHash:'fictional-bobby-credential',origin:'https://mobile.example.test'});
  const call=async(member,action='',input)=>{const r=await mobile.default.fetch(new Request('https://mobile.example.test/api/node/starling'+(action?'/'+action:'')+'?nodeId='+member.nodeId,{method:input?'POST':'GET',headers:{authorization:'Bearer '+member.token,'content-type':'application/json'},...(input?{body:JSON.stringify(input)}:{})}),env,{});return{status:r.status,data:await r.json()}};
  for(let i=0;i<3;i++)assert.equal((await call(i%2?a:b,'reserve',{idempotencyKey:'mobile:'+i,title:'Line '+i,mode:'autonomous'})).status,201);
  assert.equal((await call(b,'reserve',{idempotencyKey:'mobile:4',title:'Fourth',mode:'autonomous'})).status,409);
  await call(a,'passport',{passportId:'AC-FICTIONAL-A',skills:[{skillId:'repair',name:'Repair',xp:12}],consent:'guild-planning'});
  const snapshot=await call(b);assert.equal(snapshot.data.activeCount,3);assert.equal(snapshot.data.guildId,'fictional-mobile-guild');
  assert.equal(snapshot.data.context.knownMemberCount,2);assert.equal(snapshot.data.context.reportedPassportHeroes,1);assert.equal(snapshot.data.context.heroCount,null);
  assert.equal((await call({...b,nodeId:'unrelated-guild'})).status,403);
 }finally{database.close()}
});
