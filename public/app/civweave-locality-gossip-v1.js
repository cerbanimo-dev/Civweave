(()=>{
'use strict';

const VERSION='civweave-locality-gossip-v1.0.0';
const ENTRY_KIND='civweave.locality-ledger-entry.v1';
const ENTRY_SCHEMA='civweave.locality-ledger-entry.v1';
const HUBS_KEY='civweave.locality-gossip.hubs.v1';
const PEERS_KEY='civweave.locality-gossip.peers.v1';
const LAST_PASS_KEY='civweave.locality-gossip.last-pass.v1';
const DEFAULT_RADIUS_METERS=750;
const PASS_COOLDOWN_MS=15*60*1000;
const PEER_RELEVANCE_MS=14*24*60*60*1000;
const ENTRY_TYPES=new Set(['need','offering','idea']);
let meshPromise=null;
let subscribed=false;

const now=()=>new Date().toISOString();
const clean=(value,max=1000)=>String(value??'').trim().slice(0,max);
const clone=value=>value==null?value:structuredClone(value);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const load=(key,fallback)=>{try{return parse(localStorage.getItem(key),fallback)}catch{return fallback}};
const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};
const list=value=>Array.isArray(value)?value:[];
const finite=value=>Number.isFinite(Number(value))?Number(value):null;

function safeOrigin(value){try{const url=new URL(clean(value,4000));return url.protocol==='https:'&&!url.username&&!url.password?url.origin:''}catch{return''}}
function entryType(object){
  if(object?.kind===ENTRY_KIND&&ENTRY_TYPES.has(clean(object?.payload?.type,40).toLowerCase()))return clean(object.payload.type,40).toLowerCase();
  const hints=[object?.payload?.type,object?.payload?.category,object?.payload?.kind,object?.kind].map(value=>clean(value,160).toLowerCase());
  if(hints.some(value=>/(^|[.\-_ ])need(s)?($|[.\-_ ])/.test(value)))return'need';
  if(hints.some(value=>/(^|[.\-_ ])offer(ing)?s?($|[.\-_ ])/.test(value)))return'offering';
  if(hints.some(value=>/(^|[.\-_ ])idea(s)?($|[.\-_ ])/.test(value)))return'idea';
  return'';
}
function hubTags(object){
  const payload=object?.payload||{},scope=payload.scope||{};
  return [...new Set([
    payload.hubNodeId,scope.hubNodeId,
    ...list(payload.hubNodeIds),...list(scope.hubNodeIds),
  ].map(value=>clean(value,180)).filter(Boolean))];
}
function ensureMesh(){
  if(globalThis.CivweaveLocalMeshV146)return Promise.resolve(globalThis.CivweaveLocalMeshV146);
  if(meshPromise)return meshPromise;
  meshPromise=new Promise((resolve,reject)=>{
    const path='/app/local-object-mesh-v146.js';
    const existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname===path);
    if(existing){let ticks=0;const timer=setInterval(()=>{if(globalThis.CivweaveLocalMeshV146){clearInterval(timer);resolve(globalThis.CivweaveLocalMeshV146)}else if(++ticks>200){clearInterval(timer);reject(new Error('Local object mesh did not become ready.'))}},40);return}
    const script=document.createElement('script');script.src=`${path}?v=locality-gossip-v1`;script.async=false;script.onload=()=>globalThis.CivweaveLocalMeshV146?resolve(globalThis.CivweaveLocalMeshV146):reject(new Error('Local object mesh loaded without its API.'));script.onerror=()=>reject(new Error('Could not load local object mesh.'));document.head.append(script);
  }).then(mesh=>{subscribeMesh(mesh);return mesh}).catch(error=>{meshPromise=null;throw error});
  return meshPromise;
}
function recordPeer(peerId,reason='foreground-gossip'){
  const id=clean(peerId,500);if(!id)return false;
  const peers=load(PEERS_KEY,{});const prior=peers[id]||{};
  peers[id]={peerId:id,firstSeenAt:prior.firstSeenAt||now(),lastSeenAt:now(),encounters:Number(prior.encounters||0)+1,reason:clean(reason,80)};
  const rows=Object.values(peers).sort((a,b)=>Date.parse(b.lastSeenAt||0)-Date.parse(a.lastSeenAt||0)).slice(0,256);
  save(PEERS_KEY,Object.fromEntries(rows.map(row=>[row.peerId,row])));return true
}
function subscribeMesh(mesh){
  if(subscribed||typeof mesh?.subscribe!=='function')return;subscribed=true;
  mesh.subscribe(event=>{
    const peerId=event?.detail?.fromPeer||event?.detail?.peerId;
    if(peerId&&['object-received','peer-identified','peer-verified'].includes(event?.type))recordPeer(peerId,event.type);
    if(['object-received','object-created','gateway-sync'].includes(event?.type))dispatchEvent(new CustomEvent('civweave:locality-ledger-changed',{detail:{cause:event.type,at:now()}}));
  });
}
function rememberHub(node={},reason='map'){
  const nodeId=clean(node.nodeId||node.id,180);if(!nodeId)return null;
  const hubs=load(HUBS_KEY,{}),prior=hubs[nodeId]||{};
  const row={
    nodeId,
    displayName:clean(node.displayName||node.name||prior.displayName||nodeId,180),
    publicOrigin:safeOrigin(node.publicOrigin||node.endpoint||node.website||prior.publicOrigin),
    firstSeenAt:prior.firstSeenAt||now(),lastSeenAt:now(),
    visits:Number(prior.visits||0)+1,
    physicalPasses:Number(prior.physicalPasses||0)+(reason==='physical'?1:0),
    virtualPasses:Number(prior.virtualPasses||0)+(reason==='virtual'?1:0),
    reason:clean(reason,80),
  };
  hubs[nodeId]=row;
  const rows=Object.values(hubs).sort((a,b)=>Date.parse(b.lastSeenAt||0)-Date.parse(a.lastSeenAt||0)).slice(0,128);
  save(HUBS_KEY,Object.fromEntries(rows.map(item=>[item.nodeId,item])));return row
}
function frequentHubs(limit=16){return Object.values(load(HUBS_KEY,{})).sort((a,b)=>(Number(b.visits||0)-Number(a.visits||0))||Date.parse(b.lastSeenAt||0)-Date.parse(a.lastSeenAt||0)).slice(0,Math.max(1,Math.min(64,Number(limit)||16)))}
function recentPeers(){const cutoff=Date.now()-PEER_RELEVANCE_MS;return new Set(Object.values(load(PEERS_KEY,{})).filter(row=>Date.parse(row.lastSeenAt||0)>=cutoff).map(row=>row.peerId))}

async function publishEntry(input={}){
  const mesh=await ensureMesh(),type=clean(input.type,40).toLowerCase();if(!ENTRY_TYPES.has(type))throw new TypeError('Locality ledger type must be need, offering, or idea.');
  const title=clean(input.title,220),summary=clean(input.summary||input.description,2400);if(!title&&!summary)throw new TypeError('Locality ledger entry requires a title or summary.');
  const hubNodeIds=[...new Set(list(input.hubNodeIds||[input.hubNodeId]).map(value=>clean(value,180)).filter(Boolean))].slice(0,16);
  const expiresAt=input.expiresAt||new Date(Date.now()+Math.max(1,Math.min(180,Number(input.ttlDays)||30))*24*60*60*1000).toISOString();
  return mesh.createObject({
    id:input.id||undefined,
    revision:Number(input.revision||1),
    kind:ENTRY_KIND,
    purpose:`Share a locality ${type} through Civweave's offline-first signed gossip ledger.`,
    consent:input.consent==='public'?'public':'federated',
    audience:[],hopLimit:Math.max(1,Math.min(16,Number(input.hopLimit)||8)),expiresAt,publish:true,
    payload:{schema:ENTRY_SCHEMA,type,title,summary,tags:[...new Set(list(input.tags).map(value=>clean(value,80)).filter(Boolean))].slice(0,24),scope:{hubNodeIds},authorLabel:clean(input.authorLabel,180),createdAt:input.createdAt||now(),updatedAt:now(),sourceRealm:clean(input.sourceRealm||'',80),sourceRecordId:clean(input.sourceRecordId||'',300)},
  });
}
function relevanceFor(object,hubNodeId,partners,peers){
  const tags=hubTags(object),origin=clean(object?.origin?.nodeId,500);
  if(hubNodeId&&tags.includes(hubNodeId))return'hub';
  if(tags.some(id=>partners.has(id)))return'partner';
  if(origin&&peers.has(origin))return'passerby';
  return'';
}
async function listRecent({hubNodeId='',limit=80,maxAgeDays=45,includePassersby=true}={}){
  const mesh=await ensureMesh(),objects=await mesh.listObjects(),cutoff=Date.now()-Math.max(1,Math.min(365,Number(maxAgeDays)||45))*24*60*60*1000;
  const partners=new Set(frequentHubs(32).map(row=>row.nodeId)),peers=includePassersby?recentPeers():new Set();
  const rows=[];
  for(const object of objects){
    if(!['public','federated'].includes(object?.consent))continue;if(object?.expiresAt&&Date.parse(object.expiresAt)<=Date.now())continue;
    const type=entryType(object);if(!type)continue;const timestamp=Date.parse(object?.updatedAt||object?.createdAt||object?.payload?.updatedAt||object?.payload?.createdAt||0);if(Number.isFinite(timestamp)&&timestamp<cutoff)continue;
    const relevance=relevanceFor(object,clean(hubNodeId,180),partners,peers);if(hubNodeId&&!relevance)continue;
    rows.push({id:object.id,revision:object.revision,type,title:clean(object?.payload?.title||object?.payload?.name||type,300),summary:clean(object?.payload?.summary||object?.payload?.description||object?.purpose||'',2400),updatedAt:object?.payload?.updatedAt||object?.updatedAt||object?.createdAt||null,createdAt:object?.payload?.createdAt||object?.createdAt||null,hubNodeIds:hubTags(object),originNodeId:clean(object?.origin?.nodeId,500),relevance:relevance||'ledger',sourceRealm:clean(object?.payload?.sourceRealm,80),offline:true,signed:Boolean(object?.signature&&object?.revisionHash)});
  }
  rows.sort((a,b)=>Date.parse(b.updatedAt||b.createdAt||0)-Date.parse(a.updatedAt||a.createdAt||0));return rows.slice(0,Math.max(1,Math.min(300,Number(limit)||80)))
}
async function summaryForHub(hubNodeId,options={}){const rows=await listRecent({hubNodeId,...options});return{hubNodeId:clean(hubNodeId,180),entries:rows,counts:{need:rows.filter(row=>row.type==='need').length,offering:rows.filter(row=>row.type==='offering').length,idea:rows.filter(row=>row.type==='idea').length},generatedAt:now(),storage:'signed IndexedDB community-object ledger'}}

async function passByHub(node={},options={}){
  const hub=rememberHub(node,options.physical?'physical':'virtual');if(!hub)return{ok:false,reason:'missing-hub-id'};
  const mesh=await ensureMesh();let targetResult=null,meshResult=null;
  if(navigator.onLine!==false&&hub.publicOrigin){try{targetResult=await mesh.syncGateway(hub.publicOrigin)}catch{targetResult=null}}
  try{meshResult=await globalThis.CivweaveMapMeshV276?.sync?.()}catch{meshResult=null}
  try{await mesh.flushAll()}catch{}
  dispatchEvent(new CustomEvent('civweave:locality-hub-pass',{detail:{hub,physical:Boolean(options.physical),targetResult,meshResult,at:now()}}));
  return{ok:true,hub,targetResult,meshResult,summary:await summaryForHub(hub.nodeId)}
}
function distanceMeters(a,b){const lat1=finite(a?.latitude??a?.lat),lon1=finite(a?.longitude??a?.lon),lat2=finite(b?.latitude??b?.lat),lon2=finite(b?.longitude??b?.lon);if([lat1,lon1,lat2,lon2].some(value=>value==null))return Infinity;const rad=value=>value*Math.PI/180,dLat=rad(lat2-lat1),dLon=rad(lon2-lon1),x=Math.sin(dLat/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLon/2)**2;return 6371000*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
async function proximityUpdate(position,nodes=[],options={}){
  const point={latitude:finite(position?.coords?.latitude??position?.latitude),longitude:finite(position?.coords?.longitude??position?.longitude)};if(point.latitude==null||point.longitude==null)return[];
  const last=load(LAST_PASS_KEY,{}),hits=[];
  for(const node of list(nodes)){
    const nodeId=clean(node?.nodeId||node?.id,180),location=node?.location||node?.publicLocation||{};if(!nodeId)continue;
    const precision=Math.max(0,finite(location.precisionMeters)||0),radius=Math.max(100,Number(options.radiusMeters)||DEFAULT_RADIUS_METERS,precision+100),distance=distanceMeters(point,location);if(distance>radius)continue;
    const prior=Date.parse(last[nodeId]||0);if(Number.isFinite(prior)&&Date.now()-prior<PASS_COOLDOWN_MS)continue;
    last[nodeId]=now();save(LAST_PASS_KEY,last);hits.push({nodeId,distanceMeters:Math.round(distance),radiusMeters:Math.round(radius),result:await passByHub(node,{physical:true})});
  }
  return hits
}
function status(){return{version:VERSION,entryKind:ENTRY_KIND,entryTypes:[...ENTRY_TYPES],defaultRadiusMeters:DEFAULT_RADIUS_METERS,passCooldownMs:PASS_COOLDOWN_MS,frequentHubs:frequentHubs(12),recentPeerCount:recentPeers().size,privacy:'roaming coordinates are evaluated in-memory and never written by this module'}}

const api=Object.freeze({version:VERSION,ENTRY_KIND,ENTRY_SCHEMA,ensureMesh,publishEntry,listRecent,summaryForHub,passByHub,proximityUpdate,rememberHub,frequentHubs,recordPeer,status,distanceMeters});
globalThis.CivweaveLocalityGossipV1=api;ensureMesh().catch(()=>{});dispatchEvent(new CustomEvent('civweave:locality-gossip-ready',{detail:{version:VERSION,at:now()}}));
})();
