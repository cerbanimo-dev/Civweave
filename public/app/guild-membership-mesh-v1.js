(()=>{
'use strict';
const VERSION='1.0.1-guild-membership-mesh-pm-ready';
const KIND='civweave.guild-membership.v1';
const PAYLOAD_SCHEMA='civweave.guild-membership.claim.v1';
const GROUPS_KEY='civweave.human-groups.v1';
const CONTACTS_KEY='civweave.human-contacts.v1';
const MESH_GROUPS_KEY='civweave.mesh-groups.v1';
const HEARTBEAT_MS=6*60*60*1000;
const TTL_MS=8*24*60*60*1000;
const MAX_DISCOVERED=64;
if(globalThis.CivweaveGuildMembershipMeshV1?.version===VERSION)return;
const clean=(value,max=1000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const now=()=>new Date().toISOString();
let meshPromise=null,timer=0,busy=false,lastPublishedKey='';
function readObject(key,fallback={}){try{const value=parse(localStorage.getItem(key),fallback);return value&&typeof value==='object'&&!Array.isArray(value)?value:fallback}catch{return fallback}}
function writeObject(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}return value}
async function ensureMesh(){
  if(globalThis.CivweaveLocalMeshV146)return globalThis.CivweaveLocalMeshV146;
  if(meshPromise)return meshPromise;
  meshPromise=new Promise((resolve,reject)=>{
    const path='/app/local-object-mesh-v146.js',existing=[...document.scripts].find(script=>{try{return new URL(script.src,location.href).pathname===path}catch{return false}});
    const finish=()=>globalThis.CivweaveLocalMeshV146?resolve(globalThis.CivweaveLocalMeshV146):reject(new Error('Local mesh loaded without its API.'));
    if(existing){if(globalThis.CivweaveLocalMeshV146)finish();else{existing.addEventListener('load',finish,{once:true});setTimeout(finish,1800)}return}
    const script=document.createElement('script');script.src=path+'?v=guild-membership-mesh-v1';script.async=false;script.onload=finish;script.onerror=()=>reject(new Error('Local mesh could not load.'));document.head?.append(script);
  }).catch(error=>{meshPromise=null;throw error});
  return meshPromise;
}
function currentGuild(){
  const nodeId=clean(document.documentElement?.dataset?.civweaveNodeId,180),origin=clean(document.documentElement?.dataset?.civweaveGuildOrigin,500);
  if(nodeId)return{nodeId,origin,audience:`guild:${nodeId}`,groupId:`guild:${nodeId}`};
  try{
    const api=globalThis.CivweaveHostNodeSessionV1,status=api?.publicStatus?.(),selected=api?.selectedOrigin?.()||'',sessions=Array.isArray(status?.sessions)?status.sessions:[],session=sessions.find(row=>row?.active&&selected&&row.origin===selected)||sessions.find(row=>row?.active)||null;
    if(session?.nodeId)return{nodeId:clean(session.nodeId,180),origin:clean(session.origin||selected,500),audience:`guild:${clean(session.nodeId,180)}`,groupId:`guild:${clean(session.nodeId,180)}`};
  }catch{}
  return null
}
async function pmIdentity(){try{return await globalThis.CivweavePrivateMessagingV1?.identity?.()||null}catch{return null}}
function knownMeshGroups(){const value=readObject(MESH_GROUPS_KEY,{groups:[]});return Array.isArray(value.groups)?value.groups.map(String):[]}
function joinMeshGroup(mesh,group){const groups=[...new Set([...knownMeshGroups(),group].filter(Boolean))].slice(0,64);writeObject(MESH_GROUPS_KEY,{schema:'civweave.mesh-groups.v1',groups,updatedAt:now()});try{mesh.configure?.({groups})}catch{}return groups}
function objectId(guild,identity){const fingerprint=clean(identity?.fingerprint||identity?.username,96).replace(/[^a-zA-Z0-9._-]/g,'_');return`guild-member:${guild.nodeId}:${fingerprint}`}
async function publish(force=false){
  if(busy)return null;busy=true;
  try{
    const guild=currentGuild(),identity=await pmIdentity();if(!guild||!identity?.username||!identity?.fingerprint)return null;
    const mesh=await ensureMesh();joinMeshGroup(mesh,guild.audience);
    const id=objectId(guild,identity);let prior=null;try{prior=await mesh.getObject?.(id)||null}catch{}
    const lastAt=Date.parse(prior?.payload?.presenceAt||0)||0;if(!force&&Date.now()-lastAt<HEARTBEAT_MS)return prior;
    const revision=Math.max(1,Number(prior?.revision||0)+1),presenceAt=now(),expiresAt=new Date(Date.now()+TTL_MS).toISOString();
    const object=await mesh.createObject({id,revision,kind:KIND,purpose:'Discover end-to-end encrypted human-chat recipients who currently share this Guild.',consent:'group',audience:[guild.audience],hopLimit:4,expiresAt,publish:true,priority:76,payload:{schema:PAYLOAD_SCHEMA,guildId:guild.nodeId,guildAudience:guild.audience,username:clean(identity.username,32),pmFingerprint:clean(identity.fingerprint,96),presenceAt,expiresAt,claim:'active-session-self-attestation',authority:'Guild session remains authoritative; this signed object is discovery metadata only.'}});
    lastPublishedKey=`${guild.nodeId}:${identity.fingerprint}:${revision}`;await rebuildRoster(mesh,guild);return object
  }finally{busy=false}
}
function activeMembership(object,guild){return object?.kind===KIND&&object?.payload?.schema===PAYLOAD_SCHEMA&&object.payload.guildId===guild.nodeId&&object.payload.guildAudience===guild.audience&&object.payload.username&&(!object.expiresAt||Date.parse(object.expiresAt)>Date.now())}
function mergeGuildGroup(guild,members){
  const store=readObject(GROUPS_KEY,{schema:'civweave.human-groups.store.v1',groups:{}});store.groups=store.groups&&typeof store.groups==='object'?store.groups:{};const id=guild.groupId,existing=store.groups[id]||{};
  store.groups[id]={...existing,schema:'civweave.human-chat.group.v1',id,kind:'guild',title:existing.title||'Guild chat',members:[...new Set(members)].slice(0,32),managed:true,source:'signed-guild-membership-mesh',guild:{...(existing.guild||{}),nodeId:guild.nodeId,host:guild.origin},createdAt:existing.createdAt||now(),updatedAt:now()};
  writeObject(GROUPS_KEY,{...store,schema:'civweave.human-groups.store.v1',updatedAt:now()});return store.groups[id]
}
function mergeContacts(guild,claims){
  const store=readObject(CONTACTS_KEY,{schema:'civweave.human-contacts.store.v1',contacts:{}});store.contacts=store.contacts&&typeof store.contacts==='object'?store.contacts:{};
  for(const claim of claims){const username=clean(claim.payload.username,32).toLowerCase(),existing=store.contacts[username]||{};store.contacts[username]={...existing,schema:'civweave.human-chat.contact.v1',username,alias:existing.alias||'',fingerprint:clean(claim.payload.pmFingerprint||existing.fingerprint,96),trust:existing.trust==='directory-verified'?existing.trust:'guild-signed-discovery',guildIds:[...new Set([...(existing.guildIds||[]),guild.nodeId])].slice(0,20),addedAt:existing.addedAt||now(),lastSeenAt:claim.payload.presenceAt||now(),updatedAt:now()}}
  writeObject(CONTACTS_KEY,{...store,schema:'civweave.human-contacts.store.v1',updatedAt:now()});return store
}
async function rebuildRoster(meshArg=null,guildArg=null){
  const mesh=meshArg||await ensureMesh(),guild=guildArg||currentGuild();if(!guild)return null;joinMeshGroup(mesh,guild.audience);
  const objects=await mesh.listObjects?.()||[],claims=objects.filter(object=>activeMembership(object,guild)).sort((a,b)=>String(b.payload?.presenceAt||'').localeCompare(String(a.payload?.presenceAt||'')));
  const latestByUsername=new Map();for(const claim of claims)if(!latestByUsername.has(claim.payload.username))latestByUsername.set(claim.payload.username,claim);
  const selected=[...latestByUsername.values()].slice(0,MAX_DISCOVERED),identity=await pmIdentity(),members=selected.map(claim=>clean(claim.payload.username,32).toLowerCase()).filter(username=>username&&username!==identity?.username);
  const group=mergeGuildGroup(guild,members);mergeContacts(guild,selected.filter(claim=>claim.payload.username!==identity?.username));
  try{dispatchEvent(new CustomEvent('civweave:guild-roster-discovered',{detail:{guildId:guild.nodeId,count:selected.length,members:[...members],source:'signed-local-mesh'}}));dispatchEvent(new CustomEvent('civweave:human-chat-roster-changed',{detail:{groupId:group.id,count:members.length}}))}catch{}
  return{guild,claims:selected,members,group}
}
function schedule(delay=300){clearTimeout(timer);timer=setTimeout(()=>void publish(false).catch(()=>{}),Math.max(50,delay))}
async function start(){
  const mesh=await ensureMesh().catch(()=>null);if(!mesh)return false;
  mesh.subscribe?.(event=>{if(['object-received','gateway-sync','object-created'].includes(event?.type))void rebuildRoster(mesh).catch(()=>{})});
  for(const name of ['civweave:human-chat-guild-context','civweave:private-messaging-ready','civweave:private-messaging-identity','civweave:host-node-logged-in','civweave:capacity-session-ready','online','pageshow'])addEventListener(name,()=>schedule(150));
  addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')schedule(150)});
  await publish(true).catch(()=>null);await rebuildRoster(mesh).catch(()=>null);timer=setInterval(()=>void publish(false).catch(()=>{}),HEARTBEAT_MS);return true
}
function status(){const guild=currentGuild();return{version:VERSION,kind:KIND,guildId:guild?.nodeId||null,group:guild?.audience||null,lastPublishedKey,heartbeatMs:HEARTBEAT_MS,ttlMs:TTL_MS,authority:'active-guild-session',claimTrust:'device-signed-self-attestation'}}
const api=Object.freeze({version:VERSION,kind:KIND,publish,rebuildRoster,status,joinMeshGroup,discoveryOnly:true,authoritativeAdmission:false});globalThis.CivweaveGuildMembershipMeshV1=api;
if(document.readyState==='loading')addEventListener('DOMContentLoaded',()=>void start(),{once:true});else void start();
})();