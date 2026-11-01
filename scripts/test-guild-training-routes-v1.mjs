import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {register} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import worker,{CivweaveCloudNode} from '../cloudflare/node-cloud/src/server-ai-entry-v7.mjs';

class MemoryStorage {
  rows=new Map();pending=Promise.resolve();
  async get(key){return structuredClone(this.rows.get(key))}
  async put(key,value){if(typeof key==='object'){for(const [entry,item]of Object.entries(key))this.rows.set(entry,structuredClone(item));return}this.rows.set(key,structuredClone(value))}
  async delete(key){this.rows.delete(key)}
  async list({prefix='',startAfter='',limit=Infinity}={}){return new Map([...this.rows].filter(([key])=>key.startsWith(prefix)&&key>startAfter).sort(([a],[b])=>a.localeCompare(b)).slice(0,limit).map(([key,value])=>[key,structuredClone(value)]))}
  transaction(run){const operation=this.pending.then(async()=>{const before=structuredClone(this.rows);try{return await run(this)}catch(error){this.rows=before;throw error}});this.pending=operation.catch(()=>{});return operation}
}
const author='fictional-training-author',reader='fictional-training-reader',guild='fictional-training-guild',secret='fictional-training-route-test-secret-only';
const contribution=(idempotencyKey='contribute-1')=>({idempotencyKey,purposeId:'purpose:synthetic-writing',purposeRevision:2,consent:{training:true,rights:'owned',rightsRef:'declaration:synthetic',policyRevision:'policy:v1',visibleOnly:true,privateDataExcluded:true},sample:{instruction:'Revise this synthetic phrase.',input:'A synthetic draft.',output:'A clearer synthetic draft.',editorPatches:[],toolReceiptRefs:['receipt:synthetic-1']}});
function session(userId,nodeId=guild){const encoded=Buffer.from(JSON.stringify({v:1,nodeId,userId,exp:Math.floor(Date.now()/1000)+600})).toString('base64url'),material=createHash('sha256').update(`civweave.capacity-session.v1\0${secret}`).digest();return `${encoded}.${createHmac('sha256',material).update(`civweave.capacity-session.v1\n${encoded}`).digest('base64url')}`}
function nodeHarness(){
  const members=new Set([author,reader]),stores=new Map(),env={NODE_DOMAIN:'nodes.example.invalid',NODE_FABRIC_SESSION_SECRET:secret};
  env.CAPACITY={idFromName:name=>name,get:()=>({fetch:async(url,init)=>{assert.equal(new URL(url).pathname,'/members/status');const input=JSON.parse(init.body);return members.has(input.userId)?Response.json({member:{...input,seatClass:'community'},quota:{}}):Response.json({error:'Not a current member.'},{status:404})}})};
  env.NODES={idFromName:name=>name,get:nodeId=>{if(!stores.has(nodeId))stores.set(nodeId,new MemoryStorage());const node=new CivweaveCloudNode({storage:stores.get(nodeId)},env);return {fetch:(url,init)=>node.fetch(new Request(url,init))}}};
  const call=async(path='',{userId=author,nodeId=guild,token=session(userId,nodeId),body,method=body?'POST':'GET'}={})=>{const url=new URL(`https://node.example.test/api/node/training${path}`);url.searchParams.set('nodeId',nodeId);const response=await worker.fetch(new Request(url,{method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json','x-civweave-node-id':nodeId},...(body?{body:JSON.stringify(body)}:{})}),env,{});return {status:response.status,headers:response.headers,data:await response.json()}};
  return {call,env,members,stores};
}

test('node fabric training route authenticates exact host membership and rejects principal spoof fields',async()=>{
  const h=nodeHarness();assert.equal((await h.call('',{token:''})).status,401);assert.equal((await h.call('',{token:'invalid'})).status,401);
  assert.equal((await h.call('',{nodeId:'other-guild',token:session(author)})).status,403);
  const forged=await h.call('/contribute',{body:{...contribution(),member:{userId:reader},contributorUserId:reader,guildId:'forged'}});assert.equal(forged.status,400);
  const saved=await h.call('/contribute',{body:contribution()});assert.equal(saved.status,201);assert.equal(saved.data.contribution.contributorUserId,author);assert.equal(saved.data.contribution.guildId,guild);assert.equal(saved.data.contribution.nodeId,guild);assert.equal(saved.data.contribution.status,'quarantined');assert.equal(saved.headers.get('cache-control'),'no-store');
  assert.equal((await h.call()).data.contributions.length,1);assert.deepEqual((await h.call('',{userId:reader})).data.contributions,[]);
  const id=saved.data.contribution.id;assert.equal((await h.call(`/${encodeURIComponent(id)}`)).data.contribution.id,id);assert.equal((await h.call(`/${encodeURIComponent(id)}`,{userId:reader})).status,404);
  assert.equal((await h.call(`/${encodeURIComponent(id)}/withdraw`,{userId:reader,body:{expectedRevision:1}})).status,403);
  const withdrawn=await h.call(`/${encodeURIComponent(id)}/withdraw`,{body:{expectedRevision:1}});assert.equal(withdrawn.status,200);assert.equal(withdrawn.data.contribution.status,'withdrawn');assert.equal(withdrawn.data.contribution.sample,undefined);
  const replay=await h.call('/contribute',{body:contribution()});assert.equal(replay.data.contribution.status,'withdrawn');assert.equal(replay.data.idempotent,true);
  h.members.delete(author);assert.equal((await h.call()).status,404);
});

test('node routes never convert custody into training release, governance agreement, or settlement',async()=>{
  const h=nodeHarness(),created=await h.call('/contribute',{body:contribution()}),id=created.data.contribution.id;
  assert.equal((await h.call(`/${encodeURIComponent(id)}/release`,{body:{expectedRevision:1}})).status,403);
  assert.equal((await h.call(`/${encodeURIComponent(id)}/release`,{body:{expectedRevision:1,agreed:true,isGuildkeeper:true}})).status,400);
  assert.equal((await h.call('/dataset?purposeId=purpose:synthetic-writing&purposeRevision=2')).status,403);
  assert.equal((await h.call(`/${encodeURIComponent(id)}/terms`,{body:{expectedRevision:1,terms:{mode:'civweave-fulfillment-burn',reference:'intent:1',summary:'A proposed arrangement.'}}})).status,403);
  assert.equal((await h.call(`/${encodeURIComponent(id)}`)).data.contribution.status,'quarantined');
  const node=new CivweaveCloudNode({storage:new MemoryStorage()},h.env),response=await node.fetch(new Request('https://node.internal/internal/guild-training?nodeId='+guild,{method:'POST',headers:{'content-type':'application/json','x-civweave-node-id':guild},body:JSON.stringify({member:{nodeId:guild,userId:author},action:'contribute',input:contribution()})}));assert.equal(response.status,403);
});

async function mobileHarness(){
  register(`data:text/javascript,${encodeURIComponent("export async function resolve(specifier,context,next){if(specifier==='cloudflare:workers')return{url:'data:text/javascript,export class DurableObject { constructor(ctx,env){this.ctx=ctx;this.env=env;} }',shortCircuit:true};return next(specifier,context)}")}`,import.meta.url);
  const mobile=await import('../cloudflare/mobile-guild-edge/src/creator-provenance-entry.mjs'),database=new DatabaseSync(':memory:'),storage=new MemoryStorage();storage.sql={exec(query,...args){return database.prepare(query).all(...args)}};
  const env={},capacity=new mobile.CivweaveGuildCapacityState({storage},env);env.CAPACITY={idFromName:value=>value,get:()=>capacity};capacity.bootstrap({guildId:guild,displayName:'Synthetic Training Guild',origin:'https://mobile.example.test'});
  const alice=await capacity.joinResident({requestedNodeId:guild+'-a',userId:author,credentialHash:'fictional-training-author-hash',origin:'https://mobile.example.test'}),bob=await capacity.joinResident({requestedNodeId:guild+'-b',userId:reader,credentialHash:'fictional-training-reader-hash',origin:'https://mobile.example.test'});
  const call=async(path='',member=alice,body)=>{const url=new URL(`https://mobile.example.test/api/node/training${path}`);url.searchParams.set('nodeId',member.nodeId);const response=await mobile.default.fetch(new Request(url,{method:body?'POST':'GET',headers:{authorization:`Bearer ${member.token||''}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env,{});return {status:response.status,data:await response.json()}};
  return {call,alice,bob,database,capacity};
}

test('standalone mobile Guild uses the real resident session and canonical custody owner across starter nodes',async()=>{
  const h=await mobileHarness();try{
    assert.equal((await h.call('',{...h.alice,token:''})).status,401);assert.equal((await h.call('',{...h.alice,token:'x'.repeat(48)})).status,401);assert.equal((await h.call('',{...h.alice,nodeId:'another-guild'})).status,403);
    const forged=await h.call('/contribute',h.alice,{...contribution(),member:{userId:reader},contributorUserId:reader});assert.equal(forged.status,400);
    const first=await h.call('/contribute',h.alice,contribution());assert.equal(first.status,201);assert.equal(first.data.guildId,guild);assert.equal(first.data.contribution.guildId,guild);assert.equal(first.data.contribution.contributorUserId,author);assert.equal(first.data.contribution.nodeId,h.alice.nodeId);assert.equal(first.data.contribution.status,'quarantined');
    assert.equal((await h.call()).data.contributions.length,1);assert.deepEqual((await h.call('',h.bob)).data.contributions,[]);
    const id=first.data.contribution.id;assert.equal((await h.call(`/${encodeURIComponent(id)}`,h.bob)).status,404);assert.equal((await h.call(`/${encodeURIComponent(id)}/withdraw`,h.bob,{expectedRevision:1})).status,403);
    assert.equal((await h.call(`/${encodeURIComponent(id)}/release`,h.alice,{expectedRevision:1})).status,403);assert.equal((await h.call('/dataset?purposeId=purpose:synthetic-writing&purposeRevision=2')).status,403);
    const gone=await h.call(`/${encodeURIComponent(id)}/withdraw`,h.alice,{expectedRevision:1});assert.equal(gone.status,200);assert.equal(gone.data.contribution.status,'withdrawn');assert.equal(gone.data.contribution.sample,undefined);
    assert.equal((await h.call('/contribute',h.alice,contribution())).data.contribution.status,'withdrawn');
  }finally{h.database.close()}
});
