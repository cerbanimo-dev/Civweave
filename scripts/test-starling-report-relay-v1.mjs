import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CivweavePocketGuildNodeV1} from '../public/app/pocket-guild-node-v1.mjs';

class MemoryStorage{
  map=new Map();
  getItem(k){return this.map.get(k)??null}
  setItem(k,v){this.map.set(k,String(v))}
  removeItem(k){this.map.delete(k)}
}
const REMOTE=Array.from({length:450},(_,index)=>({
  seq:index+1,
  envelope:{schema:'civweave.community-object-envelope.v1',payload:{
    id:'report-event-'+(index+1),kind:'civweave.starling-report-event.v1',
    consent:'group',audience:['guild:garden'],payload:{guildId:'garden'}
  }}
}));
test('Pocket Guild receives 450 signed relay envelopes across cursor pages and saves recovery offset',async()=>{
  const store=new MemoryStorage(),seen=[],requests=[];
  globalThis.localStorage=store;
  Object.defineProperty(globalThis,'navigator',{value:{onLine:false},configurable:true});
  globalThis.CivweaveLocalMeshV146={
    credential:async()=>({id:'device:founder'}),
    deviceId:async()=> 'device:founder',
    configure:()=>true,
    listOutbox:async()=>[],
    ingest:async object=>{seen.push(object.id);return {status:'accepted'}},
    status:()=>({sessions:[]})
  };
  globalThis.fetch=async url=>{
    const parsed=new URL(url);
    const cursor=Number(parsed.searchParams.get('after')),limit=Number(parsed.searchParams.get('limit'));
    requests.push({cursor,limit});
    const page=REMOTE.filter(x=>x.seq>cursor).slice(0,limit);
    return Response.json({ok:true,guildId:'garden',
      envelopes:page.map(x=>x.envelope),
      nextCursor:page.at(-1)?.seq??cursor,
      hasMore:REMOTE.some(x=>x.seq>(page.at(-1)?.seq??cursor))
    });
  };
  await CivweavePocketGuildNodeV1.enroll({guildId:'garden',
    primaryOrigin:'https://guild.example',membershipKey:'a'.repeat(64)});
  Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
  const outcome=await CivweavePocketGuildNodeV1.syncPrimary();
  assert.equal(outcome.ok,true);
  assert.equal(outcome.received,450);
  assert.equal(outcome.reportReceived,450);
  assert.match(CivweavePocketGuildNodeV1.status().lastReportSyncAt,/^2026-/);
  assert.equal(new Set(seen).size,450);
  assert.deepEqual(requests.map(x=>x.cursor),[0,200,400]);
  assert.equal(CivweavePocketGuildNodeV1.state().primaryCursor,450);
  assert.equal(CivweavePocketGuildNodeV1.status().primaryCursor,450);
  const second=await CivweavePocketGuildNodeV1.syncPrimary();
  assert.equal(second.received,0);
  assert.equal(requests.at(-1).cursor,450);
  CivweavePocketGuildNodeV1.stopPrimarySync();
});
test('Cloud Guild relay retains authenticated legacy endpoint and exposes ordered cursor API',()=>{
  const text=readFileSync(new URL('../cloudflare/mobile-guild-edge/src/index.mjs',import.meta.url),'utf8');
  assert.match(text,/listEnvelopesSince\(after=0,limit=200\)/);
  assert.match(text,/WHERE seq > \? ORDER BY seq ASC LIMIT \?/);
  assert.match(text,/nextCursor:page\.length/);
  assert.match(text,/hasMore:rows\.length>take/);
  assert.match(text,/await authenticate\(request,guildState\)/);
  assert.match(text,/after===null\?\{envelopes:await guildState\.listEnvelopes\(limit\)\}/);
});
