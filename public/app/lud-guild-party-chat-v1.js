(()=>{
'use strict';

const VERSION='1.1.0-lud-guild-party-chat-v1';
const CHANNEL_KEY='civweave.lud-chat.channels.v1';
const MESSAGE_KEY='civweave.lud-chat.messages.v1';
const RELAY_KEY='civweave.lud-chat.relay.v1';
const INTENTIONS_KEY='civweave.intentions.v127';
const MESH_SRC='/app/local-object-mesh-v146.js';
const MESH_KIND='civweave.lud-chat.message.v1';
const CHAT_SCHEMA='civweave.lud-chat.envelope.v1';
const INVITE_SCHEMA='civweave.lud-chat.invite.v1';
const INVITE_PREFIX='cwlud1.';
const GATEWAY_INTERVAL_MS=6000;
const MAX_MESSAGES_PER_CHANNEL=500;
let meshPromise=null;
let meshUnsubscribe=null;
let gatewayTimer=0;
let gatewayBusy=false;
let bound=false;

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
async function configureMeshGroups(){const runtime=await mesh();if(!runtime?.configure)return null;return runtime.configure({groups:channels().map(row=>row.id)})}
async function sendMesh(envelope){
  const runtime=await mesh();if(!runtime?.createObject)return{ok:false,reason:'mesh-unavailable'};await configureMeshGroups();
  const peers=(runtime.status?.().sessions||[]).filter(row=>row?.peerId&&row?.peerVerified&&Array.isArray(row.peerClaimedGroups)&&row.peerClaimedGroups.includes(envelope.channelId)).map(row=>row.peerId);
  if(!peers.length)return{ok:false,reason:'no-chat-peer'};
  const object=await runtime.createObject({kind:MESH_KIND,purpose:'Lud Mode Guild/Party chat',audience:[...new Set(peers)],consent:'direct',payload:envelope,hopLimit:1,priority:85});runtime.flushAll?.().catch(()=>{});return{ok:true,objectId:object.id,peers:peers.length}
}

function relayStore(){const value=read(RELAY_KEY,{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}
function relaySeen(messageId,guildId){return Boolean(relayStore()[`${guildId}|${messageId}`])}
function markRelayed(messageId,guildId){const value=relayStore();value[`${guildId}|${messageId}`]=now();const entries=Object.entries(value).sort((a,b)=>String(a[1]).localeCompare(String(b[1]))).slice(-1500);write(RELAY_KEY,Object.fromEntries(entries))}
async function submitGuild(envelope,{relayedFromMesh=false}={}){
  const session=currentGuild();if(!session?.nodeId||!session?.origin)return{ok:false,reason:'no-guild-session'};
  if(envelope.guildId&&envelope.guildId!==session.nodeId)return{ok:false,reason:'different-guild'};
  if(relaySeen(envelope.messageId,session.nodeId))return{ok:true,deduped:true};
  const outer={schema:'civweave.community-object-envelope.v1',from:envelope.author.keyId,to:`group:${envelope.channelId}`,kind:'civweave-lud-chat-v1',subject:envelope.channelId,payload:envelope,correlationId:envelope.messageId,relay:relayedFromMesh?{via:'mesh-guild-member',guildId:session.nodeId}:undefined};
  const response=await fetch(new URL('/api/envelopes',session.origin),{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${session.token}`,'x-civweave-node-id':session.nodeId},body:JSON.stringify(outer)});
  if(!response.ok)throw new Error(`Guild chat submission returned HTTP ${response.status}`);markRelayed(envelope.messageId,session.nodeId);return{ok:true,status:response.status}
}
async function send(channelId,body){const envelope=await makeMessage(channelId,body);rememberMessage(envelope,'local');const [meshResult,guildResult]=await Promise.all([sendMesh(envelope).catch(error=>({ok:false,error:error.message})),submitGuild(envelope).catch(error=>({ok:false,error:error.message}))]);return{message:clone(envelope),mesh:meshResult,guild:guildResult}}
async function ingestEnvelope(envelope,transport='mesh'){
  if(!channel(envelope?.channelId)||!await verifyMessage(envelope))return{ok:false,reason:'not-authorized-or-invalid'};
  const fresh=rememberMessage(envelope,transport);if(transport==='mesh'&&fresh&&envelope.guildId&&currentGuild()?.nodeId===envelope.guildId)await submitGuild(envelope,{relayedFromMesh:true}).catch(()=>{});return{ok:true,fresh}
}
async function onMeshEvent(event){if(event?.type!=='object-received'||!event.detail?.id)return;const runtime=await mesh();let object=null;try{object=await runtime?.getObject?.(event.detail.id)}catch{}if(object?.kind===MESH_KIND&&object?.payload)await ingestEnvelope(object.payload,'mesh')}

async function pollGuild(){
  if(gatewayBusy||document.visibilityState==='hidden')return false;const session=currentGuild();if(!session?.nodeId||!session?.origin)return false;gatewayBusy=true;
  try{const endpoint=new URL('/api/envelopes',session.origin);endpoint.searchParams.set('limit','200');const response=await fetch(endpoint,{cache:'no-store',headers:{authorization:`Bearer ${session.token}`,'x-civweave-node-id':session.nodeId}});if(!response.ok)return false;const payload=await response.json().catch(()=>({}));for(const row of payload.envelopes||[]){if(row?.kind!=='civweave-lud-chat-v1'||!row?.payload)continue;const envelope=row.payload;if(channel(envelope.channelId))await ingestEnvelope(envelope,'guild')}return true}catch{return false}finally{gatewayBusy=false}
}
function startGateway(){if(gatewayTimer)return;gatewayTimer=setInterval(()=>pollGuild().catch(()=>{}),GATEWAY_INTERVAL_MS);pollGuild().catch(()=>{})}

function signableInvite(invite){return{schema:invite.schema,inviteId:invite.inviteId,channel:invite.channel,inviter:invite.inviter,createdAt:invite.createdAt,expiresAt:invite.expiresAt,nonce:invite.nonce}}
async function createInvite(channelId,{expiresInMs=7*24*60*60*1000}={}){
  const room=channel(channelId);if(!room)throw new Error('Join the chat before inviting someone.');const owner=await publicIdentity();
  const invite={schema:INVITE_SCHEMA,inviteId:`invite:${crypto.randomUUID?.()||randomToken(16)}`,channel:{id:room.id,kind:room.kind,title:room.title,guildId:room.guildId||null,partyId:room.partyId||null},inviter:{generation:owner.generation,keyId:owner.keyId,publicName:owner.publicName,publicKey:owner.publicKey},createdAt:now(),expiresAt:new Date(Date.now()+Math.max(60000,Number(expiresInMs)||0)).toISOString(),nonce:randomToken(16)};
  invite.signature=await passport().signChatValue(signableInvite(invite));return INVITE_PREFIX+b64(new TextEncoder().encode(JSON.stringify(invite)))
}
async function acceptInvite(token){
  const raw=clean(token,30000);if(!raw.startsWith(INVITE_PREFIX))throw new Error('Unsupported chat invite.');const invite=JSON.parse(new TextDecoder().decode(unb64(raw.slice(INVITE_PREFIX.length))));
  if(invite?.schema!==INVITE_SCHEMA||Date.parse(invite.expiresAt)<=Date.now())throw new Error('This chat invite is invalid or expired.');const expectedName=await passport().publicNameForKey(invite.inviter?.publicKey);if(expectedName!==invite.inviter?.publicName||!await passport().verifyChatValue(invite.inviter.publicKey,signableInvite(invite),invite.signature))throw new Error('This chat invite signature is invalid.');
  const joined=joinChannel({...invite.channel,access:'invited'});try{dispatchEvent(new CustomEvent('civweave:lud-chat-invite-accepted',{detail:{channel:clone(joined),inviter:{keyId:invite.inviter.keyId,publicName:invite.inviter.publicName}}}))}catch{}return joined
}

function bind(){
  if(bound)return;bound=true;
  const guildEvents=['civweave:host-node-logged-in','civweave:capacity-session-ready','civweave:guild-host-ready','civweave:guildkeeper-joined','civweave:guildkeeper-hosted'];
  for(const name of guildEvents)addEventListener(name,()=>{ensureGuildChannel();ensurePartyChannels();void configureMeshGroups();void pollGuild()});
  for(const name of ['civweave:intentions-changed','civweave:party-thread-changed','civweave:tavern-joined','civweave:party-join-requested','civweave:shared-intention-party-ready'])addEventListener(name,()=>{ensurePartyChannels();void configureMeshGroups()});
  addEventListener('online',()=>void pollGuild());addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void pollGuild()});
}
async function boot(){await publicIdentity();ensureGuildChannel();ensurePartyChannels();const runtime=await mesh();if(runtime?.subscribe&&!meshUnsubscribe)meshUnsubscribe=runtime.subscribe(onMeshEvent);await configureMeshGroups();bind();startGateway();try{dispatchEvent(new CustomEvent('civweave:lud-chat-ready',{detail:{version:VERSION,channels:channels(),identity:await publicIdentity()}}))}catch{}return true}

const api={version:VERSION,schemas:{message:CHAT_SCHEMA,invite:INVITE_SCHEMA},publicIdentity,cyclePassportKey,passportHistory,verifyPassportHistory,channels,channel,joinChannel,leaveChannel,ensureGuildChannel,ensurePartyChannels,messages,send,createInvite,acceptInvite,ingestEnvelope,pollGuild,configureMeshGroups,boot};
globalThis.CivweaveLudGuildPartyChatV1=Object.freeze(api);
boot().catch(error=>{console.warn('[Civweave Lud chat] bootstrap failed:',error);try{dispatchEvent(new CustomEvent('civweave:lud-chat-error',{detail:{message:String(error?.message||error)}}))}catch{}});
})();