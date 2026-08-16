(()=>{
'use strict';

const VERSION='1.2.0-lud-guild-party-chat-v1';
const CHANNEL_KEY='civweave.lud-chat.channels.v1';
const MESSAGE_KEY='civweave.lud-chat.messages.v1';
const RELAY_KEY='civweave.lud-chat.relay.v1';
const SERVER_OUTBOX_KEY='civweave.lud-chat.guild-outbox.v1';
const GUILD_CURSOR_KEY='civweave.lud-chat.guild-cursors.v1';
const INTENTIONS_KEY='civweave.intentions.v127';
const MESH_SRC='/app/local-object-mesh-v146.js';
const MESH_KIND='civweave.lud-chat.message.v1';
const MESH_GROUP_PACKET='civweave-lud-chat-groups-v1';
const CHAT_SCHEMA='civweave.lud-chat.envelope.v1';
const INVITE_SCHEMA='civweave.lud-chat.invite.v1';
const INVITE_PREFIX='cwlud1.';
const GATEWAY_INTERVAL_MS=6000;
const MAX_MESSAGES_PER_CHANNEL=500;
const MAX_SERVER_OUTBOX=500;
let meshPromise=null;
let meshUnsubscribe=null;
let gatewayTimer=0;
let gatewayBusy=false;
let outboxBusy=false;
let bound=false;
const boundMeshChannels=new WeakSet();
const dynamicPeerGroups=new Map();

if(globalThis.CivweaveLudGuildPartyChatV1?.version===VERSION)return;

const now=()=>new Date().toISOString();
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const clone=value=>{try{return structuredClone(value)}catch{return JSON.parse(JSON.stringify(value))}};
const read=(key,fallback)=>{try{return parse(localStorage.getItem(key),fallback)}catch{return fallback}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};
function b64(bytes){let binary='';for(const byte of new Uint8Array(bytes))binary+=String.fromCharCode(byte);return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function unb64(value){const raw=String(value||'').replace(/-/g,'+').replace(/_/g,'/'),padded=raw+'='.repeat((4-raw.length%4)%4),binary=atob(padded);return Uint8Array.from(binary,char=>char.charCodeAt(0))}
function randomToken(bytes=24){return b64(crypto.getRandomValues(new Uint8Array(bytes)))}
function passport(){const api=globalThis.CivweavePassportIdentityV1;if(!api?.chatPublicIdentity||!api?.signChatValue||!api?.verifyChatValue)throw new Error('The canonical Passport chat-key runtime is unavailable.');return api}
async function publicIdentity(){return clone(await passport().chatPublicIdentity())}
async function cyclePassportKey(){return clone(await passport().rotateChatKey())}
async function passportHistory(){return clone(await passport().chatHistory())}
async function verifyPassportHistory(){return passport().verifyChatHistory()}

function channelStore(){const value=read(CHANNEL_KEY,{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}
function saveChannels(value){write(CHANNEL_KEY,value);return value}
function channels(){return Object.values(channelStore()).sort((a,b)=>String(a.joinedAt||'').localeCompare(String(b.joinedAt||'')))}
function channel(channelId){return channelStore()[clean(channelId,300)]||null}
function chatGroupIds(){return channels().map(row=>row.id).filter(Boolean).slice(0,64)}
function joinChannel(input={}){
  const id=clean(input.id||input.channelId,300);if(!id)throw new TypeError('channel id is required');
  const store=channelStore(),prior=store[id]||{};
  const row={schema:'civweave.lud-chat.channel.v1',id,kind:input.kind||prior.kind||'party',title:clean(input.title||prior.title||(input.kind==='guild'?'Guild Hall':'Party'),180),guildId:clean(input.guildId||prior.guildId,180)||null,partyId:clean(input.partyId||prior.partyId,180)||null,access:input.access||prior.access||'member',joinedAt:prior.joinedAt||now(),updatedAt:now()};
  store[id]=row;saveChannels(store);void configureMeshGroups();try{dispatchEvent(new CustomEvent('civweave:lud-chat-channel-joined',{detail:clone(row)}))}catch{}return clone(row)
}
function leaveChannel(channelId){const id=clean(channelId,300),store=channelStore();if(!store[id])return false;delete store[id];saveChannels(store);void configureMeshGroups();try{dispatchEvent(new CustomEvent('civweave:lud-chat-channel-left',{detail:{channelId:id}}))}catch{}return true}
function currentGuild(){
  try{const session=globalThis.CivweaveHostNodeSessionV1?.sessionFor?.();if(session?.nodeId)return session}catch{}
  const sessions=parse(sessionStorage.getItem('civweave.host-capacity.sessions.v1'),{});return Object.values(sessions||{}).find(row=>row?.nodeId&&row?.origin&&row?.token&&(!row.expiresAt||Date.parse(row.expiresAt)>Date.now()))||null
}
function ensureGuildChannel(session=currentGuild()){
  if(!session?.nodeId)return null;return joinChannel({id:`guild:${session.nodeId}`,kind:'guild',title:'Guild Hall',guildId:session.nodeId,access:'member'})
}
function intentionPlans(){const rows=read(INTENTIONS_KEY,[]);return(Array.isArray(rows)?rows:[]).map(row=>row?.plan&&typeof row.plan==='object'?row.plan:row).filter(Boolean)}
function ensurePartyChannels(){const guild=currentGuild();const out=[];for(const plan of intentionPlans()){const party=plan?.party;if(!party?.shared||!party?.groupId)continue;out.push(joinChannel({id:`party:${party.groupId}`,kind:'party',title:clean(plan?.title||plan?.wish||'Party',180),partyId:party.groupId,guildId:guild?.nodeId||null,access:'member'}))}return out}

function messageStore(){const value=read(MESSAGE_KEY,{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}
function rememberMessage(envelope,transport='local'){
  const store=messageStore(),id=envelope.channelId,rows=Array.isArray(store[id])?store[id]:[];
  if(rows.some(row=>row?.messageId===envelope.messageId))return false;
  rows.push({...clone(envelope),receivedVia:transport,receivedAt:now()});store[id]=rows.slice(-MAX_MESSAGES_PER_CHANNEL);write(MESSAGE_KEY,store);
  try{dispatchEvent(new CustomEvent('civweave:lud-chat-message',{detail:{channel:channel(id),message:clone(envelope),transport}}))}catch{}return true
}
function messages(channelId){const rows=messageStore()[clean(channelId,300)];return Array.isArray(rows)?clone(rows):[]}
function signableMessage(envelope){return{schema:envelope.schema,messageId:envelope.messageId,channelId:envelope.channelId,channelKind:envelope.channelKind,guildId:envelope.guildId||null,partyId:envelope.partyId||null,author:envelope.author,body:envelope.body,createdAt:envelope.createdAt}}
async function makeMessage(channelId,body){
  const room=channel(channelId);if(!room)throw new Error('Join the chat before sending to it.');const text=clean(body,8000);if(!text)throw new TypeError('message body is required');
  const owner=await publicIdentity(),envelope={schema:CHAT_SCHEMA,messageId:`msg:${crypto.randomUUID?.()||randomToken(16)}`,channelId:room.id,channelKind:room.kind,guildId:room.guildId||null,partyId:room.partyId||null,author:{generation:owner.generation,keyId:owner.keyId,publicName:owner.publicName,publicKey:owner.publicKey},body:text,createdAt:now()};
  envelope.signature=await passport().signChatValue(signableMessage(envelope));return envelope
}
async function verifyMessage(envelope){
  if(envelope?.schema!==CHAT_SCHEMA||!envelope.messageId||!envelope.channelId||!envelope.author?.keyId||!envelope.author?.publicName||!envelope.author?.publicKey||!envelope.signature)return false;
  const expectedName=await passport().publicNameForKey(envelope.author.publicKey);if(expectedName!==envelope.author.publicName)return false;
  return passport().verifyChatValue(envelope.author.publicKey,signableMessage(envelope),envelope.signature)
}

function loadScript(src){return new Promise(resolve=>{if(globalThis.CivweaveLocalMeshV146)return resolve(globalThis.CivweaveLocalMeshV146);const path=new URL(src,location.href).pathname,existing=[...document.scripts].find(script=>{try{return new URL(script.src,location.href).pathname===path}catch{return false}}),done=()=>resolve(globalThis.CivweaveLocalMeshV146||null);if(existing){existing.addEventListener('load',done,{once:true});existing.addEventListener('error',()=>resolve(null),{once:true});return}const script=document.createElement('script');script.src=src;script.async=false;script.onload=done;script.onerror=()=>resolve(null);document.head?.append(script)})}
async function mesh(){if(globalThis.CivweaveLocalMeshV146)return globalThis.CivweaveLocalMeshV146;if(!meshPromise)meshPromise=loadScript(MESH_SRC);return meshPromise}
function parseMeshPacket(data){try{return JSON.parse(typeof data==='string'?data:new TextDecoder().decode(data))}catch{return null}}
function sessionValues(runtime){try{return runtime?.sessions instanceof Map?[...runtime.sessions.values()]:[]}catch{return[]}}
function bindMeshSessions(runtime){
  for(const session of sessionValues(runtime)){
    const dataChannel=session?.channel;if(!dataChannel||boundMeshChannels.has(dataChannel))continue;boundMeshChannels.add(dataChannel);
    dataChannel.addEventListener('message',event=>{const packet=parseMeshPacket(event.data);if(packet?.type!==MESH_GROUP_PACKET||!session.peerVerified||!session.peerId||!Array.isArray(packet.groups))return;dynamicPeerGroups.set(session.peerId,new Set(packet.groups.map(value=>clean(value,300)).filter(Boolean).slice(0,64)))});
    dataChannel.addEventListener('close',()=>{if(session.peerId)dynamicPeerGroups.delete(session.peerId)},{once:true});
  }
}
function announceChatGroups(runtime){
  bindMeshSessions(runtime);const packet=JSON.stringify({type:MESH_GROUP_PACKET,groups:chatGroupIds(),at:now()});let sent=0;
  for(const session of sessionValues(runtime)){if(!session?.peerVerified||session.channel?.readyState!=='open')continue;try{session.channel.send(packet);sent++}catch{}}
  return sent
}
async function configureMeshGroups(){const runtime=await mesh();if(!runtime?.configure)return null;const status=runtime.configure({groups:chatGroupIds()});bindMeshSessions(runtime);announceChatGroups(runtime);return status}
function peerGroupsFor(peerId,staticGroups=[]){const dynamic=dynamicPeerGroups.get(peerId);return new Set([...(Array.isArray(staticGroups)?staticGroups:[]),...(dynamic?[...dynamic]:[])])}
async function sendMesh(envelope){
  const runtime=await mesh();if(!runtime?.createObject)return{ok:false,reason:'mesh-unavailable'};await configureMeshGroups();
  const peers=(runtime.status?.().sessions||[]).filter(row=>row?.peerId&&row?.peerVerified&&peerGroupsFor(row.peerId,row.peerClaimedGroups).has(envelope.channelId)).map(row=>row.peerId);
  if(!peers.length)return{ok:false,reason:'no-chat-peer'};
  const object=await runtime.createObject({kind:MESH_KIND,purpose:'Lud Mode Guild/Party chat',audience:[...new Set(peers)],consent:'direct',payload:envelope,hopLimit:1,priority:85});runtime.flushAll?.().catch(()=>{});return{ok:true,objectId:object.id,peers:peers.length}
}

function relayStore(){const value=read(RELAY_KEY,{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}
function relaySeen(messageId,guildId){return Boolean(relayStore()[`${guildId}|${messageId}`])}
function markRelayed(messageId,guildId){const value=relayStore();value[`${guildId}|${messageId}`]=now();const entries=Object.entries(value).sort((a,b)=>String(a[1]).localeCompare(String(b[1]))).slice(-1500);write(RELAY_KEY,Object.fromEntries(entries))}
function serverOutbox(){const value=read(SERVER_OUTBOX_KEY,[]);return Array.isArray(value)?value:[]}
function saveServerOutbox(rows){write(SERVER_OUTBOX_KEY,rows.slice(-MAX_SERVER_OUTBOX));return rows}
function outboxId(guildId,messageId){return`${guildId}|${messageId}`}
function queueGuild(envelope,{relayedFromMesh=false,error=null}={}){
  const room=channel(envelope?.channelId),guildId=clean(envelope?.guildId||room?.guildId,180);if(!guildId||room?.access!=='member')return false;
  const rows=serverOutbox(),id=outboxId(guildId,envelope.messageId),prior=rows.find(row=>row.id===id),attempts=Number(prior?.attempts||0);
  const next={id,guildId,envelope:clone(envelope),relayedFromMesh:Boolean(relayedFromMesh||prior?.relayedFromMesh),attempts,createdAt:prior?.createdAt||now(),updatedAt:now(),nextAttemptAt:prior?.nextAttemptAt||now(),lastError:error?clean(error,1000):prior?.lastError||null};
  const filtered=rows.filter(row=>row.id!==id);filtered.push(next);saveServerOutbox(filtered);try{dispatchEvent(new CustomEvent('civweave:lud-chat-guild-queued',{detail:{messageId:envelope.messageId,guildId}}))}catch{}return true
}
function removeQueued(guildId,messageId){const id=outboxId(guildId,messageId),rows=serverOutbox(),next=rows.filter(row=>row.id!==id);if(next.length!==rows.length)saveServerOutbox(next)}
function guildOutboxStatus(){const rows=serverOutbox();return{pending:rows.length,rows:clone(rows)}}
function guildOuter(envelope,session,relayedFromMesh){return{schema:'civweave.community-object-envelope.v1',from:envelope.author.keyId,to:`group:${envelope.channelId}`,kind:'civweave-lud-chat-v1',subject:envelope.channelId,payload:envelope,correlationId:envelope.messageId,relay:relayedFromMesh?{via:'mesh-guild-member',guildId:session.nodeId}:undefined}}
async function postGuild(session,envelope,{relayedFromMesh=false}={}){
  const response=await fetch(new URL('/api/envelopes',session.origin),{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${session.token}`},body:JSON.stringify(guildOuter(envelope,session,relayedFromMesh))});
  if(!response.ok)throw new Error(`Guild chat submission returned HTTP ${response.status}`);markRelayed(envelope.messageId,session.nodeId);removeQueued(session.nodeId,envelope.messageId);return{ok:true,status:response.status}
}
async function submitGuild(envelope,{relayedFromMesh=false,queueOnFailure=true}={}){
  const room=channel(envelope?.channelId),session=currentGuild(),guildId=clean(envelope?.guildId||room?.guildId,180);
  if(!guildId)return{ok:false,reason:'no-guild-route'};
  if(!session?.nodeId||!session?.origin){const queued=queueOnFailure&&queueGuild(envelope,{relayedFromMesh,error:'Guild session unavailable'});return{ok:false,reason:'no-guild-session',queued}};
  if(guildId!==session.nodeId)return{ok:false,reason:'different-guild'};
  if(relaySeen(envelope.messageId,session.nodeId)){removeQueued(session.nodeId,envelope.messageId);return{ok:true,deduped:true}};
  try{return await postGuild(session,envelope,{relayedFromMesh})}catch(error){const queued=queueOnFailure&&queueGuild(envelope,{relayedFromMesh,error:error.message});return{ok:false,error:error.message,queued}}
}
async function flushGuildOutbox(){
  if(outboxBusy)return guildOutboxStatus();const session=currentGuild();if(!session?.nodeId||!session?.origin)return guildOutboxStatus();outboxBusy=true;
  try{const rows=serverOutbox();for(const row of rows){if(row.guildId!==session.nodeId||Date.parse(row.nextAttemptAt||0)>Date.now())continue;try{await postGuild(session,row.envelope,{relayedFromMesh:row.relayedFromMesh})}catch(error){const current=serverOutbox(),entry=current.find(item=>item.id===row.id);if(!entry)continue;entry.attempts=Number(entry.attempts||0)+1;entry.updatedAt=now();entry.lastError=clean(error.message,1000);entry.nextAttemptAt=new Date(Date.now()+Math.min(60000,1000*2**Math.min(entry.attempts,6))).toISOString();saveServerOutbox(current)}}return guildOutboxStatus()}finally{outboxBusy=false}
}
async function send(channelId,body){const envelope=await makeMessage(channelId,body);rememberMessage(envelope,'local');const [meshResult,guildResult]=await Promise.all([sendMesh(envelope).catch(error=>({ok:false,error:error.message})),submitGuild(envelope)]);return{message:clone(envelope),mesh:meshResult,guild:guildResult}}
async function ingestEnvelope(envelope,transport='mesh'){
  if(!channel(envelope?.channelId)||!await verifyMessage(envelope))return{ok:false,reason:'not-authorized-or-invalid'};
  const fresh=rememberMessage(envelope,transport);if(transport==='mesh'&&fresh&&envelope.guildId&&currentGuild()?.nodeId===envelope.guildId)await submitGuild(envelope,{relayedFromMesh:true});return{ok:true,fresh}
}
async function onMeshEvent(event){
  const runtime=await mesh();if(['peer-open','peer-identified','peer-verified'].includes(event?.type)){bindMeshSessions(runtime);if(event.type==='peer-verified')announceChatGroups(runtime);return}
  if(event?.type!=='object-received'||!event.detail?.id)return;let object=null;try{object=await runtime?.getObject?.(event.detail.id)}catch{}if(object?.kind===MESH_KIND&&object?.payload)await ingestEnvelope(object.payload,'mesh')
}

function cursorStore(){const value=read(GUILD_CURSOR_KEY,{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}
function guildCursorKey(session){return`${session.origin}|${session.nodeId}`}
function guildCursor(session){return clean(cursorStore()[guildCursorKey(session)],220)||null}
function setGuildCursor(session,cursor){if(!cursor)return;const store=cursorStore();store[guildCursorKey(session)]=cursor;write(GUILD_CURSOR_KEY,store)}
async function pollGuild(){
  if(gatewayBusy||document.visibilityState==='hidden')return false;const session=currentGuild();if(!session?.nodeId||!session?.origin)return false;gatewayBusy=true;
  try{const endpoint=new URL('/api/envelopes',session.origin),cursor=guildCursor(session);endpoint.searchParams.set('limit','200');if(cursor)endpoint.searchParams.set('cursor',cursor);const response=await fetch(endpoint,{cache:'no-store',headers:{authorization:`Bearer ${session.token}`}});if(!response.ok)return false;const payload=await response.json().catch(()=>({}));for(const row of payload.envelopes||[]){if(row?.kind!=='civweave-lud-chat-v1'||!row?.payload)continue;const envelope=row.payload;if(channel(envelope.channelId))await ingestEnvelope(envelope,'guild')}setGuildCursor(session,payload.cursor);return true}catch{return false}finally{gatewayBusy=false}
}
function startGateway(){if(gatewayTimer)return;gatewayTimer=setInterval(()=>{void flushGuildOutbox();void pollGuild()},GATEWAY_INTERVAL_MS);void flushGuildOutbox();void pollGuild()}

function signableInvite(invite){return{schema:invite.schema,inviteId:invite.inviteId,channel:invite.channel,inviter:invite.inviter,createdAt:invite.createdAt,expiresAt:invite.expiresAt,nonce:invite.nonce}}
async function createInvite(channelId,{expiresInMs=7*24*60*60*1000}={}){
  const room=channel(channelId);if(!room)throw new Error('Join the chat before inviting someone.');const owner=await publicIdentity();
  const invite={schema:INVITE_SCHEMA,inviteId:`invite:${crypto.randomUUID?.()||randomToken(16)}`,channel:{id:room.id,kind:room.kind,title:room.title,guildId:room.guildId||null,partyId:room.partyId||null},inviter:{generation:owner.generation,keyId:owner.keyId,publicName:owner.publicName,publicKey:owner.publicKey},createdAt:now(),expiresAt:new Date(Date.now()+Math.max(60000,Number(expiresInMs)||0)).toISOString(),nonce:randomToken(16)};
  invite.signature=await passport().signChatValue(signableInvite(invite));return INVITE_PREFIX+b64(new TextEncoder().encode(JSON.stringify(invite)))
}
async function acceptInvite(token){
  const raw=clean(token,30000);if(!raw.startsWith(INVITE_PREFIX))throw new Error('Unsupported chat invite.');const invite=JSON.parse(new TextDecoder().decode(unb64(raw.slice(INVITE_PREFIX.length))));
  if(invite?.schema!==INVITE_SCHEMA||Date.parse(invite.expiresAt)<=Date.now())throw new Error('This chat invite is invalid or expired.');const expectedName=await passport().publicNameForKey(invite.inviter?.publicKey);if(expectedName!==invite.inviter?.publicName||!await passport().verifyChatValue(invite.inviter.publicKey,signableInvite(invite),invite.signature))throw new Error('This chat invite signature is invalid.');
  const joined=joinChannel({...invite.channel,access:'invited'});await configureMeshGroups();try{dispatchEvent(new CustomEvent('civweave:lud-chat-invite-accepted',{detail:{channel:clone(joined),inviter:{keyId:invite.inviter.keyId,publicName:invite.inviter.publicName}}}))}catch{}return joined
}

function bind(){
  if(bound)return;bound=true;
  const guildEvents=['civweave:host-node-logged-in','civweave:capacity-session-ready','civweave:guild-host-ready','civweave:guildkeeper-joined','civweave:guildkeeper-hosted'];
  for(const name of guildEvents)addEventListener(name,()=>{ensureGuildChannel();ensurePartyChannels();void configureMeshGroups();void flushGuildOutbox();void pollGuild()});
  for(const name of ['civweave:intentions-changed','civweave:party-thread-changed','civweave:tavern-joined','civweave:party-join-requested','civweave:shared-intention-party-ready'])addEventListener(name,()=>{ensurePartyChannels();void configureMeshGroups()});
  addEventListener('online',()=>{void flushGuildOutbox();void pollGuild()});addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){void flushGuildOutbox();void pollGuild()}});
}
async function boot(){await publicIdentity();ensureGuildChannel();ensurePartyChannels();const runtime=await mesh();if(runtime?.subscribe&&!meshUnsubscribe)meshUnsubscribe=runtime.subscribe(onMeshEvent);await configureMeshGroups();bind();startGateway();try{dispatchEvent(new CustomEvent('civweave:lud-chat-ready',{detail:{version:VERSION,channels:channels(),identity:await publicIdentity(),outbox:guildOutboxStatus()}}))}catch{}return true}

const api={version:VERSION,schemas:{message:CHAT_SCHEMA,invite:INVITE_SCHEMA},publicIdentity,cyclePassportKey,passportHistory,verifyPassportHistory,channels,channel,joinChannel,leaveChannel,ensureGuildChannel,ensurePartyChannels,messages,send,createInvite,acceptInvite,ingestEnvelope,pollGuild,flushGuildOutbox,guildOutboxStatus,configureMeshGroups,boot};
globalThis.CivweaveLudGuildPartyChatV1=Object.freeze(api);
boot().catch(error=>{console.warn('[Civweave Lud chat] bootstrap failed:',error);try{dispatchEvent(new CustomEvent('civweave:lud-chat-error',{detail:{message:String(error?.message||error)}}))}catch{}});
})();