import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

class MemoryStorage{
  constructor(){this.map=new Map()}
  getItem(key){return this.map.get(key)??null}
  setItem(key,value){this.map.set(key,String(value))}
  removeItem(key){this.map.delete(key)}
}

globalThis.localStorage=new MemoryStorage();
try{Object.defineProperty(globalThis,'navigator',{value:{userAgent:'Mozilla/5.0 (Linux; Android 15; Mobile)',maxTouchPoints:5,onLine:false},configurable:true})}catch{}
globalThis.matchMedia=()=>({matches:true});

const objects=[];
const configured=[];
const credential={id:'device:founder',fingerprint:'founder'};
globalThis.CivweaveLocalMeshV146={
  async credential(){return credential},
  configure(value){configured.push(structuredClone(value));return true},
  async deviceId(){return credential.id},
  async createObject(input){const object={...structuredClone(input),revisionHash:`signed:${input.id}`,signature:'test-signature'};objects.push(object);return object},
  async getObject(id){return objects.find(object=>object.id===id)||null},
  async listObjects(){return objects},
  async listOutbox(){return[]},
  async ingest(){return{status:'duplicate'}},
  subscribe(){return()=>{}},
  status(){return{sessions:[]}},
};

const {createMobileGuild,attachCloudflareEdge,mobileGuildStatus,prepareCloudflareEdge,cloudflareDeployUrl}=await import('../public/app/mobile-guild-create-v1.mjs');
const {CivweavePocketGuildNodeV1}=await import('../public/app/pocket-guild-node-v1.mjs');
const {CivweaveEmergencyAiMeshV1}=await import('../public/app/emergency-ai-mesh-v1.mjs');

const result=await createMobileGuild({displayName:'Northside Repair Guild',guildId:'northside-repair'});
assert.equal(result.guildId,'northside-repair');
assert.equal(result.route,'pocket-node');
assert.equal(result.cloudAttached,false);
assert.equal(result.workerCreated,false);
assert.equal(result.cloudStage,'ready-to-connect');
assert.equal(result.downloadOriginUsedAsBackend,false);
assert.equal(result.deviceId,'device:founder');
assert.match(result.membershipKey,/^[A-Za-z0-9_-]{40,200}$/);
assert.match(result.cloudPairingCode,/^[A-Za-z0-9_-]{40,200}$/);
assert.match(result.deployUrl,/^https:\/\/deploy\.workers\.cloudflare\.com\/\?url=/);
assert.equal(localStorage.getItem('civweave.host-steward.v1'),'1');
assert.deepEqual(configured.at(-1),{groups:['guild:northside-repair']});

const pocket=CivweavePocketGuildNodeV1.status();
assert.equal(pocket.enrolled,true);
assert.equal(pocket.guildId,'northside-repair');
assert.equal(pocket.primaryOrigin,null);
assert.equal(pocket.cloudAttached,false);
assert.equal(CivweavePocketGuildNodeV1.state().membershipKey,result.membershipKey);
assert.equal((await CivweavePocketGuildNodeV1.syncPrimary()).status,'no-primary-gateway');

const genesis=objects.find(object=>object.kind==='civweave.guild-genesis.v1');
assert.ok(genesis,'Mobile Guild creation must persist a signed Guild genesis object.');
assert.equal(genesis.payload.guildId,'northside-repair');
assert.equal(genesis.payload.cloudAttached,false);
assert.equal(genesis.payload.workerCreated,false);
assert.equal(genesis.payload.downloadOriginUsedAsBackend,false);
assert.deepEqual(genesis.audience,['guild:northside-repair']);
assert.ok(!JSON.stringify(genesis).includes(result.membershipKey),'The signed Guild genesis object must not publish the cloud synchronization key.');
assert.ok(!JSON.stringify(genesis).includes(result.cloudPairingCode),'The signed Guild genesis object must not publish the one-time pairing code.');

const prepared=prepareCloudflareEdge();
assert.equal(prepared.guildId,'northside-repair');
assert.equal(prepared.cloudPairingCode,result.cloudPairingCode);
assert.equal(prepared.membershipKey,result.membershipKey);
assert.equal(prepared.deployUrl,cloudflareDeployUrl());

const claimCalls=[];
globalThis.fetch=async(url,init={})=>{
  const target=new URL(String(url));
  if(target.pathname==='/api/guild/claim'&&init.method==='POST'){
    const body=JSON.parse(init.body);claimCalls.push({url:target.href,body});
    return new Response(JSON.stringify({ok:true,claimed:true,guildId:'northside-repair',primaryOrigin:target.origin,primaryGateway:target.origin}),{status:200,headers:{'content-type':'application/json'}});
  }
  throw new Error(`Unexpected fetch in mobile Guild test: ${target.href}`);
};

const attached=await attachCloudflareEdge({primaryOrigin:'https://northside-edge.example'});
assert.equal(claimCalls.length,1);
assert.equal(claimCalls[0].body.guildId,'northside-repair');
assert.equal(claimCalls[0].body.displayName,'Northside Repair Guild');
assert.equal(claimCalls[0].body.foundingDeviceId,'device:founder');
assert.equal(claimCalls[0].body.claimToken,result.cloudPairingCode);
assert.equal(claimCalls[0].body.membershipKey,result.membershipKey);
assert.equal(attached.cloudAttached,true);
assert.equal(attached.workerCreated,true);
assert.equal(attached.cloudStage,'online');
assert.equal(attached.primaryOrigin,'https://northside-edge.example');
assert.equal(attached.cloudPairingCode,null);
assert.equal(CivweavePocketGuildNodeV1.status().primaryOrigin,'https://northside-edge.example/');
assert.equal(CivweavePocketGuildNodeV1.state().membershipKey,result.membershipKey);

const attachment=objects.find(object=>object.kind==='civweave.guild-edge-attachment.v1');
assert.ok(attachment,'Cloudflare pairing must create a signed Guild edge attachment object.');
assert.equal(attachment.payload.guildId,'northside-repair');
assert.equal(attachment.payload.primaryOrigin,'https://northside-edge.example');
assert.equal(attachment.payload.workerCreated,true);
assert.deepEqual(attachment.audience,['guild:northside-repair']);
assert.ok(!JSON.stringify(attachment).includes(result.membershipKey),'The edge attachment object must not publish the synchronization key.');

const saved=mobileGuildStatus();
assert.equal(saved.guildId,'northside-repair');
assert.equal(saved.workerCreated,true);
assert.equal(saved.cloudAttached,true);
assert.equal(saved.downloadOriginUsedAsBackend,false);
assert.equal(saved.cloudPairingCode,null);
assert.ok(!JSON.stringify(saved).includes('guild-A.example'));

const templateSource=readFileSync(new URL('../cloudflare/mobile-guild-edge/src/index.mjs',import.meta.url),'utf8');
const templateConfig=readFileSync(new URL('../cloudflare/mobile-guild-edge/wrangler.jsonc',import.meta.url),'utf8');
const templatePackage=readFileSync(new URL('../cloudflare/mobile-guild-edge/package.json',import.meta.url),'utf8');
const templateSecrets=readFileSync(new URL('../cloudflare/mobile-guild-edge/.dev.vars.example',import.meta.url),'utf8');
assert.match(templateSource,/\/api\/guild\/claim/);
assert.match(templateSource,/\/api\/envelopes/);
assert.match(templateSource,/membershipKeyHash/);
assert.match(templateSource,/crypto\.subtle\.verify/);
assert.doesNotMatch(templateSource,/from ['"]\.\.\//,'Deploy template must not import outside its subdirectory.');
assert.match(templateConfig,/CivweaveGuildEdgeState/);
assert.match(templateConfig,/GUILD_STATE/);
assert.match(templatePackage,/CIVWEAVE_GUILD_CLAIM_TOKEN/);
assert.match(templateSecrets,/CIVWEAVE_GUILD_CLAIM_TOKEN=/);

CivweavePocketGuildNodeV1.stopPrimarySync();
CivweaveEmergencyAiMeshV1.stop();

console.log(JSON.stringify({ok:true,schema:'civweave.mobile-guild-create.test.v2',guildId:result.guildId,route:result.route,localFirst:true,cloudAttached:true,workerCreated:true,downloadOriginInherited:false,genesisObject:true,edgeAttachmentObject:true,deployTemplate:true}));
