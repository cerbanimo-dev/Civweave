import {POCKET_NODE_POLICY,selectPocketSyncWindow} from './shared/guild-host-resilience-v1.mjs';

const VERSION='1.1.0-pocket-guild-node-v1-independent-origin';
const STATE_KEY='civweave.pocket-guild-node.v1';
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
const now=()=>new Date().toISOString();
const read=()=>{try{return JSON.parse(localStorage.getItem(STATE_KEY)||'null')}catch{return null}};
const write=value=>{localStorage.setItem(STATE_KEY,JSON.stringify(value));return value};
const mesh=()=>{const api=globalThis.CivweaveLocalMeshV146;if(!api?.credential||!api?.configure)throw new Error('Civweave local mesh is not ready.');return api};
function normalizeOrigin(value){if(value==null||value==='')return null;const url=new URL(value);if(!['http:','https:'].includes(url.protocol))throw new TypeError('primaryOrigin must use http or https.');return url.origin}
function state(){const value=read();return value?.schema==='civweave.pocket-guild-node.v1'?value:null}
async function enroll({guildId,primaryOrigin=null}={}){
  const id=clean(guildId,180);if(!id)throw new TypeError('guildId is required.');const api=mesh(),credential=await api.credential(),prior=state(),origin=normalizeOrigin(primaryOrigin);
  const next={schema:'civweave.pocket-guild-node.v1',version:VERSION,guildId:id,primaryOrigin:origin,cloudAttached:Boolean(origin),deviceId:credential.id,role:'guild-host',route:'pocket-node',authorizedPeers:prior?.guildId===id?prior.authorizedPeers||{}:{},createdAt:prior?.guildId===id?prior.createdAt||now():now(),updatedAt:now()};
  api.configure({groups:[`guild:${id}`]});write(next);return status();
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
async function attachPrimary(primaryOrigin){const value=requireState(),origin=normalizeOrigin(primaryOrigin);if(!origin)throw new TypeError('A public/cloud origin is required to attach a primary gateway.');value.primaryOrigin=origin;value.cloudAttached=true;value.updatedAt=now();write(value);return status()}
function detachPrimary(){const value=requireState();value.primaryOrigin=null;value.cloudAttached=false;value.updatedAt=now();write(value);return status()}
async function syncPrimary(){const value=requireState();if(!value.primaryOrigin)return Object.freeze({ok:false,attached:false,status:'no-primary-gateway'});const api=mesh();if(typeof api.syncGateway!=='function')throw new Error('Civweave gateway synchronization is unavailable.');return api.syncGateway(value.primaryOrigin)}
function status(){const value=state(),meshStatus=globalThis.CivweaveLocalMeshV146?.status?.()||null;if(!value)return Object.freeze({version:VERSION,enrolled:false,policy:POCKET_NODE_POLICY,mesh:meshStatus});const plan=selectPocketSyncWindow(Object.values(value.authorizedPeers||{}),{limit:POCKET_NODE_POLICY.maxActiveSyncPeers});return Object.freeze({version:VERSION,enrolled:true,guildId:value.guildId,primaryOrigin:value.primaryOrigin||null,cloudAttached:Boolean(value.primaryOrigin),deviceId:value.deviceId,role:value.role,route:value.route,policy:POCKET_NODE_POLICY,authorizedPeers:plan.authorizedCount,activePeerTarget:plan.active.length,standbyPeers:plan.standby.length,mesh:meshStatus})}

export const CivweavePocketGuildNodeV1=Object.freeze({version:VERSION,policy:POCKET_NODE_POLICY,enroll,state,status,authorizePeer,revokePeer,markPeerSynced,rotationPlan,rotateNow,attachPrimary,detachPrimary,syncPrimary});
globalThis.CivweavePocketGuildNodeV1=CivweavePocketGuildNodeV1;