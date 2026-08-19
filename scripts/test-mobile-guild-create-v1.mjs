import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

class MemoryStorage{
  constructor(){this.map=new Map()}
  getItem(key){return this.map.get(key)??null}
  setItem(key,value){this.map.set(key,String(value))}
  removeItem(key){this.map.delete(key)}
}

globalThis.localStorage=new MemoryStorage();
let currentGeo={latitude:44.123456,longitude:-71.234567,accuracy:35};
const geolocation={
  watchPosition(success){const snapshot={coords:{...currentGeo},timestamp:Date.now()};queueMicrotask(()=>success(snapshot));return 1},
  clearWatch(){},
};
try{Object.defineProperty(globalThis,'navigator',{value:{userAgent:'Mozilla/5.0 (Linux; Android 15; Mobile)',maxTouchPoints:5,onLine:false,geolocation},configurable:true})}catch{}
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

const {createMobileGuild,attachCloudflareEdge,updateMobileGuildLocation,mobileGuildStatus,prepareCloudflareEdge,cloudflareDeployUrl}=await import('../public/app/mobile-guild-create-v1.mjs');
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
assert.equal(result.location.schema,'civweave.hub-location.v1');
assert.equal(result.location.coordinateDecimals,3);
assert.equal(result.location.latitude,44.123);
assert.equal(result.location.longitude,-71.235);
assert.equal(result.location.precisionMeters,100);

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
assert.equal(genesis.payload.location.latitude,44.123);
assert.equal(genesis.payload.location.longitude,-71.235);
assert.deepEqual(genesis.audience,['guild:northside-repair']);
assert.ok(!JSON.stringify(genesis).includes(result.membershipKey),'The signed Guild genesis object must not publish the cloud synchronization key.');
assert.ok(!JSON.stringify(genesis).includes(result.cloudPairingCode),'The signed Guild genesis object must not publish the one-time pairing code.');

const prepared=prepareCloudflareEdge();
assert.equal(prepared.guildId,'northside-repair');
assert.equal(prepared.cloudPairingCode,result.cloudPairingCode);
assert.equal(prepared.membershipKey,result.membershipKey);
assert.equal(prepared.deployUrl,cloudflareDeployUrl());
assert.equal(prepared.location.latitude,44.123);

const starterNodes=['northside-repair-a','northside-repair-b','northside-repair-c'].map(nodeId=>({
  nodeId,
  publicOrigin:`https://northside-edge.example/nodes/${nodeId}`,
  runtime:'cloudflare-workers-ai',
}));
const claimCalls=[];
const locationCalls=[];
globalThis.fetch=async(url,init={})=>{
  const target=new URL(String(url));
  if(target.pathname==='/api/guild/claim'&&init.method==='POST'){
    const body=JSON.parse(init.body);claimCalls.push({url:target.href,body,headers:new Headers(init.headers)});
    return new Response(JSON.stringify({
      ok:true,
      claimed:true,
      guildId:'northside-repair',
      location:body.location,
      primaryOrigin:target.origin,
      primaryGateway:target.origin,
      infrastructure:{
        schema:'civweave.guild-cloud-fabric.v1',
        status:'ready',
        capacityOrigin:`${target.origin}/api/fabric/capacity`,
        aiEnabled:true,
        starterNodes,
      },
    }),{status:200,headers:{'content-type':'application/json'}});
  }
  if(target.pathname==='/api/fabric/location'&&init.method==='POST'){
    const body=JSON.parse(init.body),headers=new Headers(init.headers);locationCalls.push({url:target.href,body,headers});
    const location={schema:'civweave.hub-location.v1',latitude:body.latitude,longitude:body.longitude,precisionMeters:Math.max(100,Number(body.accuracyMeters)||100),coordinateDecimals:body.publicPrecision==='precise'?6:3,source:'guildkeeper-browser-geolocation',capturedAt:body.capturedAt,syncedAt:new Date().toISOString()};
    return new Response(JSON.stringify({schema:'civweave.hub-location-sync.v1',ok:true,guildId:'northside-repair',nodeIds:starterNodes.map(node=>node.nodeId),location,nodes:starterNodes.map(node=>({nodeId:node.nodeId,location}))}),{status:200,headers:{'content-type':'application/json'}});
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
assert.equal(claimCalls[0].body.location.latitude,44.123);
assert.equal(claimCalls[0].body.location.longitude,-71.235);
assert.equal(attached.cloudAttached,true);
assert.equal(attached.workerCreated,true);
assert.equal(attached.cloudStage,'online');
assert.equal(attached.primaryOrigin,'https://northside-edge.example');
assert.equal(attached.cloudPairingCode,null);
assert.equal(attached.cloudFabric.status,'ready');
assert.equal(attached.cloudFabric.aiEnabled,true);
assert.deepEqual(attached.cloudFabric.starterNodes.map(node=>node.nodeId),['northside-repair-a','northside-repair-b','northside-repair-c']);
assert.equal(CivweavePocketGuildNodeV1.status().primaryOrigin,'https://northside-edge.example/');
assert.equal(CivweavePocketGuildNodeV1.state().membershipKey,result.membershipKey);

const attachment=objects.find(object=>object.kind==='civweave.guild-edge-attachment.v1');
assert.ok(attachment,'Cloudflare pairing must create a signed Guild edge attachment object.');
assert.equal(attachment.payload.guildId,'northside-repair');
assert.equal(attachment.payload.primaryOrigin,'https://northside-edge.example');
assert.equal(attachment.payload.workerCreated,true);
assert.equal(attachment.payload.cloudFabric.status,'ready');
assert.equal(attachment.payload.cloudFabric.starterNodes.length,3);
assert.equal(attachment.payload.location.latitude,44.123);
assert.deepEqual(attachment.audience,['guild:northside-repair']);
assert.ok(!JSON.stringify(attachment).includes(result.membershipKey),'The edge attachment object must not publish the synchronization key.');

currentGeo={latitude:44.223456,longitude:-71.334567,accuracy:42};
const moved=await updateMobileGuildLocation();
assert.equal(locationCalls.length,1);
assert.equal(locationCalls[0].headers.get('authorization'),`Bearer ${result.membershipKey}`);
assert.equal(locationCalls[0].body.latitude,44.223);
assert.equal(locationCalls[0].body.longitude,-71.335);
assert.equal(locationCalls[0].body.publicPrecision,'rounded');
assert.equal(moved.location.latitude,44.223);
assert.equal(moved.location.longitude,-71.335);
assert.ok(objects.some(object=>object.kind==='civweave.guild-location-update.v1'&&object.payload.location.latitude===44.223),'A Guildkeeper location move must be recorded in the signed local mesh.');

const saved=mobileGuildStatus();
assert.equal(saved.guildId,'northside-repair');
assert.equal(saved.workerCreated,true);
assert.equal(saved.cloudAttached,true);
assert.equal(saved.downloadOriginUsedAsBackend,false);
assert.equal(saved.cloudPairingCode,null);
assert.equal(saved.cloudFabric.status,'ready');
assert.equal(saved.cloudFabric.starterNodes.length,3);
assert.equal(saved.location.latitude,44.223);
assert.ok(!JSON.stringify(saved).includes('guild-A.example'));

const templateSource=readFileSync(new URL('../cloudflare/mobile-guild-edge/src/index.mjs',import.meta.url),'utf8');
const templateEntry=readFileSync(new URL('../cloudflare/mobile-guild-edge/src/creator-provenance-entry.mjs',import.meta.url),'utf8');
const templateConfig=readFileSync(new URL('../cloudflare/mobile-guild-edge/wrangler.jsonc',import.meta.url),'utf8');
const templatePackage=readFileSync(new URL('../cloudflare/mobile-guild-edge/package.json',import.meta.url),'utf8');
const templateSecrets=readFileSync(new URL('../cloudflare/mobile-guild-edge/.dev.vars.example',import.meta.url),'utf8');
assert.match(templateSource,/\/api\/guild\/claim/);
assert.match(templateSource,/\/api\/envelopes/);
assert.match(templateSource,/\/api\/fabric\/capacity/);
assert.match(templateSource,/\/api\/fabric\/manifest/);
assert.match(templateSource,/\/api\/fabric\/location/);
assert.match(templateSource,/normalizeHubLocation/);
assert.match(templateSource,/guild-map-location/);
assert.match(templateSource,/\/nodes\//);
assert.match(templateSource,/membershipKeyHash/);
assert.match(templateSource,/crypto\.subtle\.verify/);
assert.match(templateSource,/CivweaveGuildCapacityState/);
assert.match(templateSource,/CivweaveGuildNodeState/);
assert.match(templateSource,/env\.AI\.run/);
assert.match(templateSource,/Civweave Guild Cloud is online/);
assert.doesNotMatch(templateSource,/from ['"]\.\.\//,'Deploy template must not import outside its subdirectory.');
assert.match(templateEntry,/CivweaveGuildCapacityState/);
assert.match(templateEntry,/CivweaveGuildNodeState/);
assert.match(templateConfig,/CivweaveGuildEdgeState/);
assert.match(templateConfig,/CivweaveGuildCapacityState/);
assert.match(templateConfig,/CivweaveGuildNodeState/);
assert.match(templateConfig,/GUILD_STATE/);
assert.match(templateConfig,/CAPACITY/);
assert.match(templateConfig,/NODES/);
assert.match(templateConfig,/"ai"\s*:/);
assert.match(templatePackage,/CIVWEAVE_GUILD_CLAIM_TOKEN/);
assert.match(templatePackage,/"build"\s*:\s*"wrangler deploy --dry-run/);
assert.match(templateSecrets,/CIVWEAVE_GUILD_CLAIM_TOKEN=/);

CivweavePocketGuildNodeV1.stopPrimarySync();
CivweaveEmergencyAiMeshV1.stop();

console.log(JSON.stringify({ok:true,schema:'civweave.mobile-guild-create.test.v4',guildId:result.guildId,route:result.route,localFirst:true,locationRequired:true,guildMapLocationUpdates:true,cloudAttached:true,workerCreated:true,downloadOriginInherited:false,genesisObject:true,edgeAttachmentObject:true,locationUpdateObject:true,deployTemplate:true,fullCloudFabric:true,starterNodes:3,workersAi:true}));
