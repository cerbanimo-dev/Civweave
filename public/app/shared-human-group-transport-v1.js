(()=>{
'use strict';

const VERSION='1.0.0-human-group-transport-v1';
const CHANNEL_KEY='civweave.human-group-transport.channels.v1';
const OUTBOX_KEY='civweave.human-group-transport.outbox.v1';
const CURSOR_KEY='civweave.human-group-transport.cursors.v1';
const SEEN_KEY='civweave.human-group-transport.seen.v1';
const MESH_SRC='/app/local-object-mesh-v146.js';
const MESH_PACKET='civweave-human-group-transport-v1';
const MESH_CHANNELS='civweave-human-group-channels-v1';
const SERVER_SCHEMA='civweave.human-group.transport-envelope.v1';
const SERVER_PATH='/api/chat/envelopes';
const POLL_MS=6000;
const MAX_OUTBOX=600;
const MAX_SEEN=2400;
const decoder=new TextDecoder();
let meshPromise=null;
let meshUnsubscribe=null;
let timer=0;
let polling=false;
let flushing=false;
let bound=false;
const boundDataChannels=new WeakSet();
const peerChannels=new Map();

if(globalThis.CivweaveHumanGroupTransportV1?.version===VERSION)return;

const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const clone=value=>{try{return structuredClone(value)}catch{return JSON.parse(JSON.stringify(value))}};
const read=(key,fallback)=>{try{return parse(localStorage.getItem(key),fallback)}catch{return fallback}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};
const now=()=>new Date().toISOString();

function channelStore(){const value=read(CHANNEL_KEY,{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}
function channels(){return Object.values(channelStore())}
function channel(id){return channelStore()[clean(id,300)]||null}
function saveChannel(input={}){
  const id=clean(input.id||input.channelId,300);if(!id)throw new TypeError('Human group transport channel id is required.');
  const store=channelStore(),prior=store[id]||{};
  const row={schema:'civweave.human-group.transport-channel.v1',id,guildId:clean(input.guildId||prior.guildId,180)||null,access:input.access||prior.access||'member',kind:clean(input.kind||prior.kind,80)||'group',updatedAt:now()};
  store[id]=row;write(CHANNEL_KEY,store);void announceChannels();return clone(row)
}
function unregisterChannel(id){const key=clean(id,300),store=channelStore();if(!store[key])return false;delete store[key];write(CHANNEL_KEY,store);void announceChannels();return true}

function currentGuild(){try{return globalThis.CivweaveHostNodeSessionV1?.sessionFor?.()||null}catch{return null}}
function sessionForGuild(guildId){const session=currentGuild();return session?.nodeId===guildId?session:null}
function parseMeshPacket(data){try{return JSON.parse(typeof data==='string'?data:decoder.decode(data))}catch{return null}}
function sessionValues(runtime){try{return runtime?.sessions instanceof Map?[...runtime.sessions.values()]:[]}catch{return[]}}

function loadMesh(){return new Promise(resolve=>{
  if(globalThis.CivweaveLocalMeshV146)return resolve(globalThis.CivweaveLocalMeshV146);
  const existing=[...document.scripts].find(script=>{try{return new URL(script.src,location.href).pathname===MESH_SRC}catch{return false}}),done=()=>resolve(globalThis.CivweaveLocalMeshV146||null);
  if(existing){existing.addEventListener('load',done,{once:true});existing.addEventListener('error',()=>resolve(null),{once:true});return}
  const script=document.createElement('script');script.src=MESH_SRC;script.async=true;script.addEventListener('load',done,{once:true});script.addEventListener('error',()=>resolve(null),{once:true});document.head?.append(script)
})}
async function mesh(){if(globalThis.CivweaveLocalMeshV146)return globalThis.CivweaveLocalMeshV146;if(!meshPromise)meshPromise=loadMesh();return meshPromise}

function bindDataChannels(runtime){
  for(const session of sessionValues(runtime)){
    const dataChannel=session?.channel;if(!dataChannel||boundDataChannels.has(dataChannel))continue;boundDataChannels.add(dataChannel);
    dataChannel.addEventListener('message',event=>{
      const packet=parseMeshPacket(event.data);
      if(packet?.type===MESH_CHANNELS&&session.peerVerified&&session.peerId&&Array.isArray(packet.channels)){
        peerChannels.set(session.peerId,new Set(packet.channels.map(value=>clean(value,300)).filter(Boolean).slice(0,96)));return;
      }
      if(packet?.type===MESH_PACKET&&packet.envelope)void ingest(packet.envelope,'mesh');
    });
    dataChannel.addEventListener('close',()=>{if(session.peerId)peerChannels.delete(session.peerId)},{once:true});
  }
}
async function announceChannels(){
  const runtime=await mesh();if(!runtime)return 0;bindDataChannels(runtime);
  const packet=JSON.stringify({type:MESH_CHANNELS,channels:channels().map(row=>row.id).slice(0,96),at:now()});let sent=0;
  for(const session of sessionValues(runtime)){if(!session?.peerVerified||session.channel?.readyState!=='open')continue;try{session.channel.send(packet);sent++}catch{}}
  return sent
}
function peerHasChannel(session,channelId){const dynamic=peerChannels.get(session.peerId);return Boolean(dynamic?.has(channelId)||(Array.isArray(session.peerClaimedGroups)&&session.peerClaimedGroups.includes(channelId)))}
async function sendMesh(envelope){
  const runtime=await mesh();if(!runtime)return{ok:false,reason:'mesh-unavailable'};bindDataChannels(runtime);await announceChannels();let sent=0;
  const packet=JSON.stringify({type:MESH_PACKET,envelope});
  for(const session of sessionValues(runtime)){if(!session?.peerVerified||session.channel?.readyState!=='open'||!peerHasChannel(session,envelope.channelId))continue;try{session.channel.send(packet);sent++}catch{}}
  return sent?{ok:true,peers:sent}:{ok:false,reason:'no-channel-peer'}
}

function seenStore(){const value=read(SEEN_KEY,{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}
function hasSeen(messageId){return Boolean(seenStore()[clean(messageId,300)])}
function markSeen(messageId){const id=clean(messageId,300);if(!id)return;const store=seenStore();store[id]=now();const rows=Object.entries(store).sort((a,b)=>String(a[1]).localeCompare(String(b[1]))).slice(-MAX_SEEN);write(SEEN_KEY,Object.fromEntries(rows))}
function outbox(){const rows=read(OUTBOX_KEY,[]);return Array.isArray(rows)?rows:[]}
function saveOutbox(rows){write(OUTBOX_KEY,(Array.isArray(rows)?rows:[]).slice(-MAX_OUTBOX));return rows}
function queueServer(envelope){
  const room=channel(envelope?.channelId),guildId=clean(envelope?.guildId||room?.guildId,180);if(!room||room.access!=='member'||!guildId)return false;
  const rows=outbox(),id=`${guildId}|${envelope.messageId}`,prior=rows.find(row=>row.id===id);
  if(prior)return true;
  rows.push({id,guildId,envelope:clone(envelope),attempts:0,nextAttemptAt:now(),createdAt:now(),lastError:null});saveOutbox(rows);return true
}
function dropQueued(guildId,messageId){const id=`${guildId}|${messageId}`,rows=outbox(),next=rows.filter(row=>row.id!==id);if(next.length!==rows.length)saveOutbox(next)}
function outboxStatus(){const rows=outbox();return{pending:rows.length,rows:clone(rows)}}

function serverHeaders(session,withBody=false){return{accept:'application/json',authorization:`Bearer ${session.token}`,'x-civweave-node-id':session.nodeId,...(withBody?{'content-type':'application/json'}:{})}}
async function postServer(session,envelope){
  const response=await fetch(new URL(SERVER_PATH,session.origin),{method:'POST',headers:serverHeaders(session,true),body:JSON.stringify(envelope)});
  const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(clean(payload?.error||`Guild relay returned HTTP ${response.status}.`,1000));dropQueued(session.nodeId,envelope.messageId);return{ok:true,status:response.status}
}
async function flushServer(){
  if(flushing)return outboxStatus();flushing=true;
  try{for(const row of outbox()){const session=sessionForGuild(row.guildId);if(!session||Date.parse(row.nextAttemptAt||0)>Date.now())continue;try{await postServer(session,row.envelope)}catch(error){const rows=outbox(),current=rows.find(item=>item.id===row.id);if(!current)continue;current.attempts=Number(current.attempts||0)+1;current.lastError=clean(error?.message||error,1000);current.nextAttemptAt=new Date(Date.now()+Math.min(60000,1000*2**Math.min(current.attempts,6))).toISOString();saveOutbox(rows)}}return outboxStatus()}finally{flushing=false}
}
function cursorStore(){const value=read(CURSOR_KEY,{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}
function cursorKey(session){return`${session.origin}|${session.nodeId}`}
function getCursor(session){return clean(cursorStore()[cursorKey(session)],300)||null}
function setCursor(session,value){if(!value)return;const store=cursorStore();store[cursorKey(session)]=value;write(CURSOR_KEY,store)}
async function pollServer(){
  if(polling||document.visibilityState==='hidden')return false;const session=currentGuild();if(!session?.nodeId||!session?.origin)return false;polling=true;
  try{const endpoint=new URL(SERVER_PATH,session.origin),cursor=getCursor(session);if(cursor)endpoint.searchParams.set('cursor',cursor);endpoint.searchParams.set('limit','200');const response=await fetch(endpoint,{cache:'no-store',headers:serverHeaders(session)});if(!response.ok)return false;const payload=await response.json().catch(()=>({}));for(const envelope of payload.envelopes||[])await ingest(envelope,'guild');setCursor(session,payload.cursor);return true}catch{return false}finally{polling=false}
}

function normalizedEnvelope(input={}){
  const channelId=clean(input.channelId,300),messageId=clean(input.messageId,300),guildId=clean(input.guildId,180)||null;if(!channelId||!messageId)return null;
  return{schema:SERVER_SCHEMA,channelId,messageId,guildId,payload:clone(input.payload),createdAt:input.createdAt||now()}
}
async function publish(input={}){
  const envelope=normalizedEnvelope(input);if(!envelope)throw new TypeError('Human group transport requires channelId and messageId.');const room=channel(envelope.channelId);if(!room)throw new Error('Register the human group channel before publishing.');
  markSeen(envelope.messageId);const meshResult=await sendMesh(envelope).catch(error=>({ok:false,error:clean(error?.message||error,1000)}));let guildResult={ok:false,reason:'no-guild-route'};
  if(room.access==='member'&&envelope.guildId){queueServer(envelope);await flushServer();guildResult=outbox().some(row=>row.id===`${envelope.guildId}|${envelope.messageId}`)?{ok:false,queued:true}:{ok:true}}
  return{envelope:clone(envelope),mesh:meshResult,guild:guildResult}
}
async function ingest(input,transport='mesh'){
  const envelope=normalizedEnvelope(input),room=envelope&&channel(envelope.channelId);if(!envelope||!room||hasSeen(envelope.messageId))return false;markSeen(envelope.messageId);
  try{dispatchEvent(new CustomEvent('civweave:human-group-packet',{detail:{transport,envelope:clone(envelope)}}))}catch{}
  if(transport==='mesh'&&room.access==='member'&&envelope.guildId===room.guildId&&sessionForGuild(room.guildId)){queueServer(envelope);void flushServer()}
  return true
}
function bind(){
  if(bound)return;bound=true;
  addEventListener('online',()=>{void flushServer();void pollServer()});
  addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){void flushServer();void pollServer();void announceChannels()}});
  addEventListener('civweave:capacity-session-ready',()=>{void flushServer();void pollServer();void announceChannels()});
  addEventListener('civweave:mesh',event=>{if(['peer-open','peer-identified','peer-verified'].includes(event?.detail?.type)){void announceChannels();const runtime=globalThis.CivweaveLocalMeshV146;if(runtime)bindDataChannels(runtime)}})
}
async function boot(){const runtime=await mesh();if(runtime?.subscribe&&!meshUnsubscribe)meshUnsubscribe=runtime.subscribe(event=>{if(['peer-open','peer-identified','peer-verified'].includes(event?.type)){bindDataChannels(runtime);void announceChannels()}});if(runtime)bindDataChannels(runtime);bind();if(!timer)timer=setInterval(()=>{void flushServer();void pollServer()},POLL_MS);await announceChannels();void flushServer();void pollServer();return true}

const api=Object.freeze({version:VERSION,serverPath:SERVER_PATH,registerChannel:saveChannel,unregisterChannel,channels,channel,publish,ingest,announceChannels,flushServer,pollServer,outboxStatus,boot});
globalThis.CivweaveHumanGroupTransportV1=api;
boot().catch(error=>{console.warn('[Civweave human group transport] bootstrap failed:',error);try{dispatchEvent(new CustomEvent('civweave:human-group-transport-error',{detail:{message:clean(error?.message||error,1000)}}))}catch{}});
})();