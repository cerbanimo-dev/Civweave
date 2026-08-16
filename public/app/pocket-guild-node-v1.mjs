import {POCKET_NODE_POLICY,selectPocketSyncWindow} from './shared/guild-host-resilience-v1.mjs';

const VERSION='1.2.0-pocket-guild-node-v1-cloud-primary';
const STATE_KEY='civweave.pocket-guild-node.v1';
const PRIMARY_SYNC_INTERVAL_MS=60_000;
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
const now=()=>new Date().toISOString();
const read=()=>{try{return JSON.parse(localStorage.getItem(STATE_KEY)||'null')}catch{return null}};
const write=value=>{localStorage.setItem(STATE_KEY,JSON.stringify(value));return value};
const mesh=()=>{const api=globalThis.CivweaveLocalMeshV146;if(!api?.credential||!api?.configure)throw new Error('Civweave local mesh is not ready.');return api};
let primarySyncTimer=null,primarySyncListenersBound=false;
function normalizeGateway(value){if(value==null||value==='')return null;const url=new URL(value);if(!['http:','https:'].includes(url.protocol))throw new TypeError('primaryOrigin must use http or https.');url.hash='';url.search='';if(!url.pathname.endsWith('/'))url.pathname=`${url.pathname}/`;return url.href}
function normalizeMembershipKey(value,{required=false}={}){const key=clean(value,220);if(!key&&!required)return null;if(!/^[A-Za-z0-9_-]{40,200}$/.test(key))throw new TypeError('A valid Guild cloud sync key is required.');return key}
function state(){const value=read();return value?.schema==='civweave.pocket-guild-node.v1'?value:null}
function cloudObjectForGuild(object,guildId){if(!object)return false;if(['public','federated'].includes(object.consent))return true;return object.consent==='group'&&Array.isArray(object.audience)&&object.audience.includes(`guild:${guildId}`)}
async function syncCloudPrimary(value,api){
  if(globalThis.navigator?.onLine===false)return Object.freeze({ok:false,attached:true,status:'offline',sent:0,received:0});
  const endpoint=new URL('api/envelopes',value.primaryOrigin),headers={'content-type':'application/json','authorization':`Bearer ${value.membershipKey}`};
  let sent=0,received=0;
  const pending=typeof api.listOutbox==='function'?await api.listOutbox('pending'):[];
  for(const delivery of pending){
    const object=await api.getObject?.(delivery.objectId);if(!cloudObjectForGuild(object,value.guildId))continue;
    try{
      const response=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify({schema:'civweave.community-object-envelope.v1',from:await api.deviceId(),to:`guild:${value.guildId}`,kind:'community-object',subject:object.kind,payload:object,correlationId:object.id})});
      if(!response.ok)throw new Error(`Guild cloud primary returned ${response.status}`);sent++;
    }catch(error){return Object.freeze({ok:false,attached:true,status:'sync-error',sent,received,error:String(error?.message||error)})}
  }
  try{
    const readUrl=new URL(endpoint);readUrl.searchParams.set('limit','200');
    const response=await fetch(readUrl,{headers:{authorization:`Bearer ${value.membershipKey}`},cache:'no-store'});if(!response.ok)throw new Error(`Guild cloud primary returned ${response.status}`);
    const payload=await response.json();
    for(const envelope of payload.envelopes||[]){const object=envelope?.payload;if(!cloudObjectForGuild(object,value.guildId))continue;try{const result=await api.ingest(object,{fromPeer:`cloud:${value.guildId}`,localNodeId:await api.deviceId()});if(result?.status==='accepted')received++}catch{}}
  }catch(error){return Object.freeze({ok:false,attached:true,status:'sync-error',sent,received,error:String(error?.message||error)})}
  const current=state();if(current?.guildId===value.guildId){current.lastPrimarySyncAt=now();current.updatedAt=now();write(current)}
  return Object.freeze({ok:true,attached:true,status:'synced',sent,received,primaryGateway:value.primaryOrigin,lastPrimarySyncAt:now()});
}
async function enroll({guildId,primaryOrigin=null,membershipKey=null}={}){
  const id=clean(guildId,180);if(!id)throw new TypeError('guildId is required.');const api=mesh(),credential=await api.credential(),prior=state(),origin=normalizeGateway(primaryOrigin),key=normalizeMembershipKey(membershipKey,{required:Boolean(origin)});
  const next={schema:'civweave.pocket-guild-node.v1',version:VERSION,guildId:id,primaryOrigin:origin,membershipKey:key,cloudAttached:Boolean(origin),deviceId:credential.id,role:'guild-host',route:'pocket-node',authorizedPeers:prior?.guildId===id?prior.authorizedPeers||{}:{},lastPrimarySyncAt:prior?.guildId===id?prior.lastPrimarySyncAt||null:null,createdAt:prior?.guildId===id?prior.createdAt||now():now(),updatedAt:now()};
  api.configure({groups:[`guild:${id}`]});write(next);if(origin)startPrimarySync();return status();
}
function requireState(){const value=state();if(!value)throw new Error('This device has not been enrolled as a Pocket Guild Node.');return value}
function authorizePeer(peerId,metadata={}){const value=requireState(),id=clean(peerId,500);if(!id)throw new TypeError('peerId is required.');value.authorizedPeers[id]={...(value.authorizedPeers[id]||{}),peerId:id,authorized:true,label:clean(metadata.label,180)||value.authorizedPeers[id]?.label||'',priority:Number(metadata.priority??value.authorizedPeers[id]?.priority??0)||0,lastSeenAt:metadata.lastSeenAt||value.authorizedPeers[id]?.lastSeenAt||null,lastSyncedAt:metadata.lastSyncedAt||value.authorizedPeers[id]?.lastSyncedAt||null,pendingCount:Math.max(0,Number(metadata.pendingCount??value.authorizedPeers[id]?.pendingCount??0)||0),updatedAt:now()};value.updatedAt=now();write(value);return rotationPlan()}
function revokePeer(peerId){const value=requireState(),id=clean(peerId,500);if(value.authorizedPeers[id]){value.authorizedPeers[id].authorized=false;value.authorizedPeers[id].updatedAt=now();value.updatedAt=now();write(value)}return rotationPlan()}
function markPeerSynced(peerId,{pendingCount=0}={}){const value=requireState(),id=clean(peerId,500),row=value.authorizedPeers[id];if(!row)return false;row.lastSyncedAt=now();row.pendingCount=Math.max(0,Number(pendingCount)||0);row.updatedAt=now();value.updatedAt=now();write(value);return true}
function rotationPlan(){const value=requireState();return selectPocketSyncWindow(Object.values(value.authorizedPeers||{}),{limit:POCKET_NODE_POLICY.maxActiveSyncPeers})}
async function rotateNow(){const api=mesh(),plan=rotationPlan(),activeIds=new Set(plan.active.map(peer=>peer.peerId));for(const session of api.sessions?.values?.()||[]){if(!session?.peerId)continue;if(!activeIds.has(session.peerId)){try{session.channel?.close?.()}catch{}try{session.connection?.close?.()}catch{}}}
  const flushed=[];for(const session of api.sessions?.values?.()||[]){if(session?.peerId&&activeIds.has(session.peerId)&&session.channel?.readyState==='open'){try{flushed.push({peerId:session.peerId,...await api.flushSession(session)});markPeerSynced(session.peerId)}catch(error){flushed.push({peerId:session.peerId,error:String(error?.message||error)})}}}
  return Object.freeze({plan,flushed:Object.freeze(flushed)});
}
async function attachPrimary(primaryOrigin,{membershipKey=null}={}){const value=requireState(),origin=normalizeGateway(primaryOrigin);if(!origin)throw new TypeError('A public/cloud gateway is required to attach a primary.');value.primaryOrigin=origin;value.membershipKey=normalizeMembershipKey(membershipKey||value.membershipKey,{required:true});value.cloudAttached=true;value.updatedAt=now();write(value);startPrimarySync();return status()}
function detachPrimary(){const value=requireState();value.primaryOrigin=null;value.membershipKey=null;value.cloudAttached=false;value.updatedAt=now();write(value);stopPrimarySync();return status()}
async function syncPrimary(){const value=requireState();if(!value.primaryOrigin)return Object.freeze({ok:false,attached:false,status:'no-primary-gateway'});const api=mesh();if(value.membershipKey)return syncCloudPrimary(value,api);if(typeof api.syncGateway!=='function')throw new Error('Civweave gateway synchronization is unavailable.');return api.syncGateway(value.primaryOrigin)}
function bindPrimarySyncListeners(){if(primarySyncListenersBound||typeof globalThis.addEventListener!=='function')return;primarySyncListenersBound=true;globalThis.addEventListener('online',()=>{if(state()?.primaryOrigin)syncPrimary().catch(()=>{})});globalThis.addEventListener('visibilitychange',()=>{if(globalThis.document?.visibilityState==='visible'&&state()?.primaryOrigin)syncPrimary().catch(()=>{})})}
function startPrimarySync({intervalMs=PRIMARY_SYNC_INTERVAL_MS}={}){stopPrimarySync();bindPrimarySyncListeners();primarySyncTimer=setInterval(()=>{if(state()?.primaryOrigin)syncPrimary().catch(()=>{})},Math.max(15_000,Number(intervalMs)||PRIMARY_SYNC_INTERVAL_MS));primarySyncTimer?.unref?.();queueMicrotask(()=>syncPrimary().catch(()=>{}));return true}
function stopPrimarySync(){if(primarySyncTimer!=null){clearInterval(primarySyncTimer);primarySyncTimer=null}return true}
function status(){const value=state(),meshStatus=globalThis.CivweaveLocalMeshV146?.status?.()||null;if(!value)return Object.freeze({version:VERSION,enrolled:false,policy:POCKET_NODE_POLICY,mesh:meshStatus});const plan=selectPocketSyncWindow(Object.values(value.authorizedPeers||{}),{limit:POCKET_NODE_POLICY.maxActiveSyncPeers});return Object.freeze({version:VERSION,enrolled:true,guildId:value.guildId,primaryOrigin:value.primaryOrigin||null,cloudAttached:Boolean(value.primaryOrigin),deviceId:value.deviceId,role:value.role,route:value.route,lastPrimarySyncAt:value.lastPrimarySyncAt||null,policy:POCKET_NODE_POLICY,authorizedPeers:plan.authorizedCount,activePeerTarget:plan.active.length,standbyPeers:plan.standby.length,mesh:meshStatus})}

export const CivweavePocketGuildNodeV1=Object.freeze({version:VERSION,policy:POCKET_NODE_POLICY,enroll,state,status,authorizePeer,revokePeer,markPeerSynced,rotationPlan,rotateNow,attachPrimary,detachPrimary,syncPrimary,startPrimarySync,stopPrimarySync});
globalThis.CivweavePocketGuildNodeV1=CivweavePocketGuildNodeV1;
