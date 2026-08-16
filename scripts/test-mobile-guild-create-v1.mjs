import assert from 'node:assert/strict';

class MemoryStorage{
  constructor(){this.map=new Map()}
  getItem(key){return this.map.get(key)??null}
  setItem(key,value){this.map.set(key,String(value))}
  removeItem(key){this.map.delete(key)}
}

globalThis.localStorage=new MemoryStorage();
try{Object.defineProperty(globalThis,'navigator',{value:{userAgent:'Mozilla/5.0 (Linux; Android 15; Mobile)',maxTouchPoints:5,onLine:true},configurable:true})}catch{}
globalThis.matchMedia=()=>({matches:true});

const objects=[];
const configured=[];
const cloudEnvelopes=[];
const credential={id:'device:founder',fingerprint:'founder'};
globalThis.CivweaveLocalMeshV146={
  async credential(){return credential},
  configure(value){configured.push(structuredClone(value));return true},
  async deviceId(){return credential.id},
  async createObject(input){const object={schema:'civweave.community-object.v1',...structuredClone(input),revisionHash:`signed:${input.id}`,signature:'test-signature',origin:{nodeId:credential.id,credential:{kty:'EC'}}};objects.push(object);return object},
  async getObject(id){return objects.find(object=>object.id===id)||null},
  async listObjects(){return objects},
  async listOutbox(){return objects.map(object=>({objectId:object.id}))},
  async ingest(object){return objects.some(row=>row.id===object.id)?{status:'duplicate',object}:{status:'accepted',object}},
  subscribe(){return()=>{}},
  status(){return{sessions:[]}},
};

globalThis.fetch=async(input,init={})=>{
  const url=new URL(input);
  if(url.pathname==='/api/fabric/guilds/bootstrap'){
    const body=JSON.parse(init.body||'{}');
    assert.equal(body.guildId,'northside-repair');
    assert.equal(body.foundingDeviceId,'device:founder');
    assert.match(body.syncKey,/^[A-Za-z0-9_-]{40,200}$/);
    return Response.json({ok:true,schema:'civweave.mobile-guild-cloud-bootstrap.v1',guildId:body.guildId,displayName:body.displayName,primaryOrigin:url.origin,primaryGateway:`${url.origin}/n/${body.guildId}/`,cloudAttached:true,cloudRuntime:'cloudflare-durable-object',capacityGranted:false},{status:201});
  }
  if(url.pathname==='/n/northside-repair/api/envelopes'&&String(init.method||'GET').toUpperCase()==='POST'){
    assert.match(String(init.headers?.authorization||''),/^Bearer [A-Za-z0-9_-]{40,200}$/);
    cloudEnvelopes.push(JSON.parse(init.body||'{}'));
    return Response.json({ok:true},{status:201});
  }
  if(url.pathname==='/n/northside-repair/api/envelopes')return Response.json({ok:true,envelopes:cloudEnvelopes});
  throw new Error(`Unexpected fetch ${url.href}`);
};

const {createMobileGuild,mobileGuildStatus}=await import('../public/app/mobile-guild-create-v1.mjs');
const {CivweavePocketGuildNodeV1}=await import('../public/app/pocket-guild-node-v1.mjs');
const {CivweaveEmergencyAiMeshV1}=await import('../public/app/emergency-ai-mesh-v1.mjs');

const result=await createMobileGuild({displayName:'Northside Repair Guild',guildId:'northside-repair'});
assert.equal(result.guildId,'northside-repair');
assert.equal(result.route,'pocket-node');
assert.equal(result.cloudAttached,true);
assert.equal(result.cloudPrimaryProvisioned,true);
assert.equal(result.cloudRuntime,'cloudflare-durable-object');
assert.equal(result.workerCreated,false,'Mobile Guilds share the existing Cloudflare fabric rather than provisioning a Worker per phone.');
assert.equal(result.downloadOriginUsedAsBackend,false);
assert.equal(result.deviceId,'device:founder');
assert.match(result.primaryGateway,/\/n\/northside-repair\/$/);
assert.equal(localStorage.getItem('civweave.host-steward.v1'),'1');
assert.deepEqual(configured.at(-1),{groups:['guild:northside-repair']});

const pocket=CivweavePocketGuildNodeV1.status();
assert.equal(pocket.enrolled,true);
assert.equal(pocket.guildId,'northside-repair');
assert.match(pocket.primaryOrigin,/\/n\/northside-repair\/$/);
assert.equal(pocket.cloudAttached,true);
const sync=await CivweavePocketGuildNodeV1.syncPrimary();
assert.equal(sync.ok,true);
assert.ok(cloudEnvelopes.some(envelope=>envelope.payload?.id==='guild-genesis:northside-repair'),'Signed Guild genesis must reach the Cloudflare primary.');

const genesis=objects.find(object=>object.kind==='civweave.guild-genesis.v1');
assert.ok(genesis,'Mobile Guild creation must persist a signed Guild genesis object.');
assert.equal(genesis.payload.guildId,'northside-repair');
assert.equal(genesis.payload.cloudAttached,true);
assert.equal(genesis.payload.cloudPrimaryProvisioned,true);
assert.equal(genesis.payload.cloudRuntime,'cloudflare-durable-object');
assert.equal(genesis.payload.workerCreated,false);
assert.equal(genesis.payload.downloadOriginUsedAsBackend,false);
assert.deepEqual(genesis.audience,['guild:northside-repair']);

const saved=mobileGuildStatus();
assert.equal(saved.guildId,'northside-repair');
assert.equal(saved.cloudAttached,true);
assert.match(saved.primaryGateway,/\/n\/northside-repair\/$/);
assert.equal(saved.workerCreated,false);
assert.equal(saved.downloadOriginUsedAsBackend,false);
CivweavePocketGuildNodeV1.stopPrimarySync();
CivweaveEmergencyAiMeshV1.stop();

console.log(JSON.stringify({ok:true,schema:'civweave.mobile-guild-create.test.v1',guildId:result.guildId,route:result.route,cloudAttached:true,cloudPrimaryProvisioned:true,cloudRuntime:result.cloudRuntime,workerCreated:false,downloadOriginInherited:false,genesisObject:true,cloudGenesisSynced:true}));