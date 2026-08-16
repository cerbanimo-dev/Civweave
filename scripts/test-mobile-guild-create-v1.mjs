import assert from 'node:assert/strict';

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
  async getObject(){return null},
  async listObjects(){return objects},
  subscribe(){return()=>{}},
  status(){return{sessions:[]}},
};

const {createMobileGuild,mobileGuildStatus}=await import('../public/app/mobile-guild-create-v1.mjs');
const {CivweavePocketGuildNodeV1}=await import('../public/app/pocket-guild-node-v1.mjs');
const {CivweaveEmergencyAiMeshV1}=await import('../public/app/emergency-ai-mesh-v1.mjs');

const result=await createMobileGuild({displayName:'Northside Repair Guild',guildId:'northside-repair'});
assert.equal(result.guildId,'northside-repair');
assert.equal(result.route,'pocket-node');
assert.equal(result.cloudAttached,false);
assert.equal(result.workerCreated,false);
assert.equal(result.downloadOriginUsedAsBackend,false);
assert.equal(result.deviceId,'device:founder');
assert.equal(localStorage.getItem('civweave.host-steward.v1'),'1');
assert.deepEqual(configured.at(-1),{groups:['guild:northside-repair']});

const pocket=CivweavePocketGuildNodeV1.status();
assert.equal(pocket.enrolled,true);
assert.equal(pocket.guildId,'northside-repair');
assert.equal(pocket.primaryOrigin,null);
assert.equal(pocket.cloudAttached,false);
assert.equal((await CivweavePocketGuildNodeV1.syncPrimary()).status,'no-primary-gateway');

const genesis=objects.find(object=>object.kind==='civweave.guild-genesis.v1');
assert.ok(genesis,'Mobile Guild creation must persist a signed Guild genesis object.');
assert.equal(genesis.payload.guildId,'northside-repair');
assert.equal(genesis.payload.cloudAttached,false);
assert.equal(genesis.payload.workerCreated,false);
assert.equal(genesis.payload.downloadOriginUsedAsBackend,false);
assert.deepEqual(genesis.audience,['guild:northside-repair']);

const saved=mobileGuildStatus();
assert.equal(saved.guildId,'northside-repair');
assert.equal(saved.workerCreated,false);
assert.equal(saved.downloadOriginUsedAsBackend,false);
assert.ok(!JSON.stringify(saved).includes('guild-A.example'));
CivweaveEmergencyAiMeshV1.stop();

console.log(JSON.stringify({ok:true,schema:'civweave.mobile-guild-create.test.v1',guildId:result.guildId,route:result.route,cloudAttached:false,workerCreated:false,downloadOriginInherited:false,genesisObject:true}));