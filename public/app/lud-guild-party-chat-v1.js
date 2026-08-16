(()=>{
'use strict';

const VERSION='1.3.0-lud-guild-party-chat-v1';
const CHANNEL_KEY='civweave.lud-chat.channels.v1';
const MESSAGE_KEY='civweave.lud-chat.messages.v1';
const INTENTIONS_KEY='civweave.intentions.v127';
const TRANSPORT_SRC='/app/shared-human-group-transport-v1.js';
const CHAT_SCHEMA='civweave.lud-chat.envelope.v1';
const PACKET_SCHEMA='civweave.lud-chat.encrypted-packet.v1';
const INVITE_SCHEMA='civweave.lud-chat.invite.v1';
const INVITE_PREFIX='cwlud1.';
const MAX_MESSAGES_PER_CHANNEL=500;
const encoder=new TextEncoder();
const decoder=new TextDecoder();
let transportPromise=null;
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

function loadTransport(){return new Promise(resolve=>{
  if(globalThis.CivweaveHumanGroupTransportV1)return resolve(globalThis.CivweaveHumanGroupTransportV1);
  const existing=[...document.scripts].find(script=>{try{return new URL(script.src,location.href).pathname===TRANSPORT_SRC}catch{return false}}),done=()=>resolve(globalThis.CivweaveHumanGroupTransportV1||null);
  if(existing){existing.addEventListener('load',done,{once:true});existing.addEventListener('error',()=>resolve(null),{once:true});return}
  const script=document.createElement('script');script.src=TRANSPORT_SRC;script.async=false;script.addEventListener('load',done,{once:true});script.addEventListener('error',()=>resolve(null),{once:true});document.head?.append(script)
})}
async function transport(){if(globalThis.CivweaveHumanGroupTransportV1)return globalThis.CivweaveHumanGroupTransportV1;if(!transportPromise)transportPromise=loadTransport();const api=await transportPromise;if(!api)throw new Error('Human group transport is unavailable.');return api}

function channelStore(){const value=read(CHANNEL_KEY,{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}
function saveChannels(value){write(CHANNEL_KEY,value);return value}
function channels(){return Object.values(channelStore()).sort((a,b)=>String(a.joinedAt||'').localeCompare(String(b.joinedAt||'')))}
function channel(channelId){return channelStore()[clean(channelId,300)]||null}
async function registerTransport(row){try{const api=await transport();api.registerChannel({id:row.id,guildId:row.guildId,access:row.access,kind:row.kind});return true}catch{return false}}
function joinChannel(input={}){
  const id=clean(input.id||input.channelId,300);if(!id)throw new TypeError('channel id is required');const store=channelStore(),prior=store[id]||{};
  const row={schema:'civweave.lud-chat.channel.v1',id,kind:input.kind||prior.kind||'party',title:clean(input.title||prior.title||(input.kind==='guild'?'Guild Hall':'Party'),180),guildId:clean(input.guildId||prior.guildId,180)||null,partyId:clean(input.partyId||prior.partyId,180)||null,access:input.access||prior.access||'member',secret:clean(input.secret||prior.secret,300)||null,joinedAt:prior.joinedAt||now(),updatedAt:now()};
  store[id]=row;saveChannels(store);void registerTransport(row);try{dispatchEvent(new CustomEvent('civweave:lud-chat-channel-joined',{detail:{...clone(row),secret:undefined}}))}catch{}return clone(row)
}
function leaveChannel(channelId){const id=clean(channelId,300),store=channelStore();if(!store[id])return false;delete store[id];saveChannels(store);void transport().then(api=>api.unregisterChannel(id)).catch(()=>{});try{dispatchEvent(new CustomEvent('civweave:lud-chat-channel-left',{detail:{channelId:id}}))}catch{}return true}
function currentGuild(){try{return globalThis.CivweaveHostNodeSessionV1?.sessionFor?.()||null}catch{return null}}
function guildHeaders(session){return{accept:'application/json',authorization:`Bearer ${session.token}`,'x-civweave-node-id':session.nodeId}}
async function ensureGuildKey(session=currentGuild()){
  if(!session?.nodeId||!session?.origin)return null;const id=`guild:${session.nodeId}`,saved=channel(id);if(saved?.secret)return saved;
  const endpoint=new URL('/api/chat/channel-key',session.origin);endpoint.searchParams.set('channelId',id);const response=await fetch(endpoint,{cache:'no-store',headers:guildHeaders(session)}),payload=await response.json().catch(()=>({}));
  if(!response.ok||!payload?.key?.key)throw new Error(clean(payload?.error||`Guild key registry returned HTTP ${response.status}.`,1000));return joinChannel({id,kind:'guild',title:'Guild Hall',guildId:session.nodeId,access:'member',secret:payload.key.key})
}
function ensureGuildChannel(session=currentGuild()){
  if(!session?.nodeId)return null;const row=joinChannel({id:`guild:${session.nodeId}`,kind:'guild',title:'Guild Hall',guildId:session.nodeId,access:'member'});void ensureGuildKey(session).catch(()=>{});return row
}
function intentionPlans(){const rows=read(INTENTIONS_KEY,[]);return(Array.isArray(rows)?rows:[]).map(row=>row?.plan&&typeof row.plan==='object'?row.plan:row).filter(Boolean)}
function ensurePartyChannels(){const guild=currentGuild(),out=[];for(const plan of intentionPlans()){const party=plan?.party;if(!party?.shared||!party?.groupId||!party?.key)continue;out.push(joinChannel({id:`party:${party.groupId}`,kind:'party',title:clean(plan?.title||plan?.wish||'Party',180),partyId:party.groupId,guildId:guild?.nodeId||null,access:'member',secret:party.key}))}return out}

function messageStore(){const value=read(MESSAGE_KEY,{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}
function rememberMessage(envelope,transportName='local'){
  const store=messageStore(),id=envelope.channelId,rows=Array.isArray(store[id])?store[id]:[];if(rows.some(row=>row?.messageId===envelope.messageId))return false;
  rows.push({...clone(envelope),receivedVia:transportName,receivedAt:now()});store[id]=rows.slice(-MAX_MESSAGES_PER_CHANNEL);write(MESSAGE_KEY,store);try{dispatchEvent(new CustomEvent('civweave:lud-chat-message',{detail:{channel:{...channel(id),secret:undefined},message:clone(envelope),transport:transportName}}))}catch{}return true
}
function messages(channelId){const rows=messageStore()[clean(channelId,300)];return Array.isArray(rows)?clone(rows):[]}
function signableMessage(envelope){return{schema:envelope.schema,messageId:envelope.messageId,channelId:envelope.channelId,channelKind:envelope.channelKind,guildId:envelope.guildId||null,partyId:envelope.partyId||null,author:envelope.author,body:envelope.body,createdAt:envelope.createdAt}}
async function makeMessage(channelId,body){
  let room=channel(channelId);if(!room)throw new Error('Join the chat before sending to it.');if(room.kind==='guild'&&!room.secret)room=await ensureGuildKey();if(!room?.secret)throw new Error('This chat does not have its access key on this device.');
  const text=clean(body,8000);if(!text)throw new TypeError('message body is required');const owner=await publicIdentity(),envelope={schema:CHAT_SCHEMA,messageId:`msg:${crypto.randomUUID?.()||randomToken(16)}`,channelId:room.id,channelKind:room.kind,guildId:room.guildId||null,partyId:room.partyId||null,author:{generation:owner.generation,keyId:owner.keyId,publicName:owner.publicName,publicKey:owner.publicKey},body:text,createdAt:now()};envelope.signature=await passport().signChatValue(signableMessage(envelope));return envelope
}
async function verifyMessage(envelope){if(envelope?.schema!==CHAT_SCHEMA||!envelope.messageId||!envelope.channelId||!envelope.author?.keyId||!envelope.author?.publicName||!envelope.author?.publicKey||!envelope.signature)return false;const expectedName=await passport().publicNameForKey(envelope.author.publicKey);return expectedName===envelope.author.publicName&&passport().verifyChatValue(envelope.author.publicKey,signableMessage(envelope),envelope.signature)}
async function importAes(secret){return crypto.subtle.importKey('raw',unb64(secret),{name:'AES-GCM'},false,['encrypt','decrypt'])}
async function encryptMessage(room,envelope){const iv=crypto.getRandomValues(new Uint8Array(12)),key=await importAes(room.secret),cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(room.id)},key,encoder.encode(JSON.stringify(envelope)));return{schema:PACKET_SCHEMA,channelId:room.id,messageId:envelope.messageId,iv:b64(iv),ciphertext:b64(cipher)}}
async function decryptMessage(room,packet){if(packet?.schema!==PACKET_SCHEMA||packet.channelId!==room.id||!room.secret)return null;try{const key=await importAes(room.secret),plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(packet.iv),additionalData:encoder.encode(room.id)},key,unb64(packet.ciphertext));return JSON.parse(decoder.decode(plain))}catch{return null}}
async function send(channelId,body){const envelope=await makeMessage(channelId,body),room=channel(channelId),packet=await encryptMessage(room,envelope);rememberMessage(envelope,'local');const result=await(await transport()).publish({channelId:room.id,messageId:envelope.messageId,guildId:room.guildId,payload:packet});return{message:clone(envelope),mesh:result.mesh,guild:result.guild}}
async function ingestTransport(detail){const outer=detail?.envelope,room=outer&&channel(outer.channelId);if(!room||outer?.payload?.schema!==PACKET_SCHEMA)return false;const envelope=await decryptMessage(room,outer.payload);if(!envelope||!await verifyMessage(envelope))return false;return rememberMessage(envelope,detail.transport||'transport')}

function signableInvite(invite){return{schema:invite.schema,inviteId:invite.inviteId,channel:invite.channel,inviter:invite.inviter,createdAt:invite.createdAt,expiresAt:invite.expiresAt,nonce:invite.nonce}}
async function createInvite(channelId,{expiresInMs=7*24*60*60*1000}={}){
  let room=channel(channelId);if(!room)throw new Error('Join the chat before inviting someone.');if(room.kind==='guild'&&!room.secret)room=await ensureGuildKey();if(!room?.secret)throw new Error('This chat access key is unavailable.');const owner=await publicIdentity();
  const invite={schema:INVITE_SCHEMA,inviteId:`invite:${crypto.randomUUID?.()||randomToken(16)}`,channel:{id:room.id,kind:room.kind,title:room.title,guildId:room.guildId||null,partyId:room.partyId||null,secret:room.secret},inviter:{generation:owner.generation,keyId:owner.keyId,publicName:owner.publicName,publicKey:owner.publicKey},createdAt:now(),expiresAt:new Date(Date.now()+Math.max(60000,Number(expiresInMs)||0)).toISOString(),nonce:randomToken(16)};invite.signature=await passport().signChatValue(signableInvite(invite));return INVITE_PREFIX+b64(encoder.encode(JSON.stringify(invite)))
}
async function acceptInvite(token){
  const raw=clean(token,50000);if(!raw.startsWith(INVITE_PREFIX))throw new Error('Unsupported chat invite.');const invite=JSON.parse(decoder.decode(unb64(raw.slice(INVITE_PREFIX.length))));if(invite?.schema!==INVITE_SCHEMA||Date.parse(invite.expiresAt)<=Date.now()||!invite?.channel?.secret)throw new Error('This chat invite is invalid or expired.');const expectedName=await passport().publicNameForKey(invite.inviter?.publicKey);if(expectedName!==invite.inviter?.publicName||!await passport().verifyChatValue(invite.inviter.publicKey,signableInvite(invite),invite.signature))throw new Error('This chat invite signature is invalid.');
  const joined=joinChannel({...invite.channel,access:'invited'});try{dispatchEvent(new CustomEvent('civweave:lud-chat-invite-accepted',{detail:{channel:{...clone(joined),secret:undefined},inviter:{keyId:invite.inviter.keyId,publicName:invite.inviter.publicName}}}))}catch{}return joined
}

function bind(){if(bound)return;bound=true;addEventListener('civweave:human-group-packet',event=>void ingestTransport(event.detail));const guildEvents=['civweave:host-node-logged-in','civweave:capacity-session-ready','civweave:guild-host-ready','civweave:guildkeeper-joined','civweave:guildkeeper-hosted'];for(const name of guildEvents)addEventListener(name,()=>{const session=currentGuild();ensureGuildChannel(session);ensurePartyChannels();void ensureGuildKey(session).catch(()=>{})});for(const name of ['civweave:intentions-changed','civweave:party-thread-changed','civweave:tavern-joined','civweave:party-join-requested','civweave:shared-intention-party-ready'])addEventListener(name,ensurePartyChannels)}
async function boot(){await publicIdentity();const api=await transport();for(const room of channels())api.registerChannel({id:room.id,guildId:room.guildId,access:room.access,kind:room.kind});const session=currentGuild();ensureGuildChannel(session);ensurePartyChannels();if(session)void ensureGuildKey(session).catch(()=>{});bind();try{dispatchEvent(new CustomEvent('civweave:lud-chat-ready',{detail:{version:VERSION,channels:channels().map(row=>({...row,secret:undefined})),identity:await publicIdentity(),outbox:api.outboxStatus()}}))}catch{}return true}

const api=Object.freeze({version:VERSION,schemas:{message:CHAT_SCHEMA,packet:PACKET_SCHEMA,invite:INVITE_SCHEMA},publicIdentity,cyclePassportKey,passportHistory,verifyPassportHistory,channels,channel,joinChannel,leaveChannel,ensureGuildChannel,ensureGuildKey,ensurePartyChannels,messages,send,createInvite,acceptInvite,pollGuild:async()=>{const t=await transport();return t.pollServer()},flushGuildOutbox:async()=>{const t=await transport();return t.flushServer()},guildOutboxStatus:()=>globalThis.CivweaveHumanGroupTransportV1?.outboxStatus?.()||{pending:0,rows:[]},configureMeshGroups:async()=>{const t=await transport();return t.announceChannels()},boot});
globalThis.CivweaveLudGuildPartyChatV1=api;
boot().catch(error=>{console.warn('[Civweave Lud chat] bootstrap failed:',error);try{dispatchEvent(new CustomEvent('civweave:lud-chat-error',{detail:{message:clean(error?.message||error,1000)}}))}catch{}});
})();