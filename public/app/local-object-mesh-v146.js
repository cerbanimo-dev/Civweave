(()=>{
'use strict';

const DB_NAME='civweave-community-objects-v146';
const DB_VERSION=3;
const OBJECT_SCHEMA='civweave.community-object.v1';
const DELIVERY_SCHEMA='civweave.community-delivery.v1';
const RECEIPT_SCHEMA='civweave.community-receipt.v1';
const CONFLICT_SCHEMA='civweave.community-conflict.v1';
const PROTOCOL='civweave.foreground-phone-mesh.v1';
const CREDENTIAL_KEY='device-credential';
const CHANNEL_LABEL='civweave-objects';
const CHUNK_BYTES=24*1024;
const MAX_OBJECT_BYTES=64*1024*1024;
const BUFFER_HIGH=512*1024;
const BUFFER_LOW=128*1024;
const sessions=new Map();
const encoder=new TextEncoder();
const decoder=new TextDecoder();
const listeners=new Set();
const allowedConsent=new Set(['private','direct','group','public','federated']);
let configuredIceServers=[];
let configuredGroups=[];

const now=()=>new Date().toISOString();
const uid=prefix=>`${prefix}:${crypto.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
const clone=value=>structuredClone(value);
const list=value=>Array.isArray(value)?value:[];
const clean=(value,max=1000)=>String(value??'').trim().slice(0,max);
const randomNonce=()=>b64(crypto.getRandomValues(new Uint8Array(24)));

function emit(type,detail={}){
  const event={type,detail,at:now()};
  for(const listener of listeners)try{listener(event)}catch{}
  try{dispatchEvent(new CustomEvent('civweave:mesh',{detail:event}))}catch{}
}
function b64(bytes){let binary='';for(const byte of new Uint8Array(bytes))binary+=String.fromCharCode(byte);return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function unb64(value){const raw=String(value||'').replace(/-/g,'+').replace(/_/g,'/'),padded=raw+'='.repeat((4-raw.length%4)%4),binary=atob(padded);return Uint8Array.from(binary,char=>char.charCodeAt(0))}
function normalized(value){if(Array.isArray(value))return value.map(normalized);if(value&&typeof value==='object'){const out={};for(const key of Object.keys(value).sort())if(value[key]!==undefined)out[key]=normalized(value[key]);return out}return value}
const canonical=value=>JSON.stringify(normalized(value));
async function sha256(value){const bytes=typeof value==='string'?encoder.encode(value):value;return b64(await crypto.subtle.digest('SHA-256',bytes))}

function openDb(){return new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB_NAME,DB_VERSION);
  request.onupgradeneeded=()=>{
    const db=request.result;
    if(!db.objectStoreNames.contains('objects')){const store=db.createObjectStore('objects',{keyPath:'id'});store.createIndex('updatedAt','updatedAt');store.createIndex('kind','kind');store.createIndex('consent','consent')}
    if(!db.objectStoreNames.contains('outbox')){const store=db.createObjectStore('outbox',{keyPath:'id'});store.createIndex('status','status');store.createIndex('createdAt','createdAt')}
    if(!db.objectStoreNames.contains('receipts'))db.createObjectStore('receipts',{keyPath:'id'});
    if(!db.objectStoreNames.contains('peers'))db.createObjectStore('peers',{keyPath:'id'});
    if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'});
    if(!db.objectStoreNames.contains('incoming'))db.createObjectStore('incoming',{keyPath:'transferId'});
    if(!db.objectStoreNames.contains('acks')){const store=db.createObjectStore('acks',{keyPath:'id'});store.createIndex('peerId','peerId');store.createIndex('objectId','objectId')}
    if(!db.objectStoreNames.contains('transit'))db.createObjectStore('transit',{keyPath:'id'});
    if(!db.objectStoreNames.contains('priorities'))db.createObjectStore('priorities',{keyPath:'objectId'});
    if(!db.objectStoreNames.contains('conflicts')){const store=db.createObjectStore('conflicts',{keyPath:'id'});store.createIndex('objectId','objectId');store.createIndex('detectedAt','detectedAt')}
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
})}
function req(request){return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
async function tx(storeNames,mode,work){const db=await openDb();return new Promise((resolve,reject)=>{
  const transaction=db.transaction(storeNames,mode),stores=Object.fromEntries(storeNames.map(name=>[name,transaction.objectStore(name)]));
  let result;try{result=work(stores,transaction)}catch(error){transaction.abort();reject(error);return}
  transaction.oncomplete=()=>resolve(result);transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error||new Error('Local object transaction aborted'));
})}

async function credential(){
  let record=await tx(['meta'],'readonly',stores=>req(stores.meta.get(CREDENTIAL_KEY)));
  if(record?.privateKey&&record?.publicKey)return record;
  const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
  const publicKey=await crypto.subtle.exportKey('jwk',pair.publicKey);
  const fingerprint=(await sha256(canonical(publicKey))).slice(0,24);
  record={key:CREDENTIAL_KEY,id:`device:${fingerprint}`,fingerprint,publicKey,privateKey:pair.privateKey,createdAt:now()};
  await tx(['meta'],'readwrite',stores=>stores.meta.put(record));
  return record;
}
function signableObject(object){return{schema:object.schema,id:object.id,revision:object.revision,kind:object.kind,purpose:object.purpose,audience:object.audience,consent:object.consent,payload:object.payload,payloadHash:object.payloadHash,parentIds:object.parentIds,createdAt:object.createdAt,updatedAt:object.updatedAt,expiresAt:object.expiresAt,origin:object.origin,hopLimit:object.hopLimit}}
async function sign(privateKey,value){return b64(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},privateKey,encoder.encode(canonical(value))))}
async function verify(publicKey,value,signature){try{const key=await crypto.subtle.importKey('jwk',publicKey,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);return crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,unb64(signature),encoder.encode(canonical(value)))}catch{return false}}

function defaultPriority(object){if(object.consent==='direct')return 80;if(object.consent==='group')return 65;if(/receipt|validation|settlement/i.test(object.kind||''))return 60;if(object.consent==='public')return 40;return 30}
async function storedPriority(object){const row=await tx(['priorities'],'readonly',stores=>req(stores.priorities.get(object.id))).catch(()=>null);return Number.isFinite(row?.priority)?row.priority:defaultPriority(object)}
async function setPriority(objectId,priority=50){const id=clean(objectId,500);if(!id)throw new TypeError('objectId is required');const value=Math.max(0,Math.min(100,Math.round(Number(priority)||0)));await tx(['priorities'],'readwrite',stores=>stores.priorities.put({objectId:id,priority:value,updatedAt:now()}));await tx(['outbox'],'readwrite',stores=>{const request=stores.outbox.getAll();request.onsuccess=()=>{for(const row of request.result||[])if(row.objectId===id){row.priority=value;row.updatedAt=now();stores.outbox.put(row)}}});flushAll().catch(()=>{});return value}

async function createObject(input={}){
  const owner=await credential(),consent=allowedConsent.has(input.consent)?input.consent:'private',createdAt=now(),payload=clone(input.payload??{});
  const object={schema:OBJECT_SCHEMA,id:input.id||uid('object'),revision:Number(input.revision||1),kind:clean(input.kind||'civweave.record',160),purpose:clean(input.purpose||'local work',500),audience:Array.isArray(input.audience)?[...new Set(input.audience.map(String))].slice(0,100):[],consent,payload,payloadHash:await sha256(canonical(payload)),parentIds:Array.isArray(input.parentIds)?[...new Set(input.parentIds.map(String))].slice(0,50):[],createdAt,updatedAt:createdAt,expiresAt:input.expiresAt||null,origin:{nodeId:owner.id,credential:owner.publicKey,fingerprint:owner.fingerprint},hopLimit:Math.max(0,Math.min(16,Number(input.hopLimit??4))),visited:[owner.id]};
  object.revisionHash=await sha256(canonical(signableObject(object)));
  object.signature=await sign(owner.privateKey,signableObject(object));
  await tx(['objects'],'readwrite',stores=>stores.objects.put(object));
  await saveTransit(object,{hopsUsed:0,visited:[owner.id],receivedFrom:null});
  if(input.publish!==false&&consent!=='private')await queue(object,{destinations:input.destinations,priority:input.priority});
  emit('object-created',{id:object.id,kind:object.kind,consent});
  return object;
}
async function queue(object,options={}){
  const delivery={schema:DELIVERY_SCHEMA,id:`delivery:${object.id}:${object.revisionHash}`,objectId:object.id,revisionHash:object.revisionHash,destinations:Array.isArray(options.destinations)?options.destinations.map(String):object.audience,status:'pending',priority:Number.isFinite(options.priority)?Math.max(0,Math.min(100,Math.round(options.priority))):await storedPriority(object),attempts:0,createdAt:now(),updatedAt:now(),nextAttemptAt:now(),lastError:null};
  await tx(['outbox'],'readwrite',stores=>stores.outbox.put(delivery));
  emit('queued',{deliveryId:delivery.id,objectId:object.id,priority:delivery.priority});
  requestBackgroundSync().catch(()=>{});
  flushAll().catch(()=>{});
  return delivery;
}
const getObject=id=>tx(['objects'],'readonly',stores=>req(stores.objects.get(id)));
const listObjects=()=>tx(['objects'],'readonly',stores=>req(stores.objects.getAll()));
const listConflicts=()=>tx(['conflicts'],'readonly',stores=>req(stores.conflicts.getAll()));
async function listOutbox(status='pending'){const rows=await tx(['outbox'],'readonly',stores=>status?req(stores.outbox.index('status').getAll(status)):req(stores.outbox.getAll()));return rows.sort((a,b)=>(Number(b.priority)||0)-(Number(a.priority)||0)||Date.parse(a.createdAt||0)-Date.parse(b.createdAt||0))}
async function markDelivery(id,status,error=null){return tx(['outbox'],'readwrite',stores=>{const request=stores.outbox.get(id);request.onsuccess=()=>{const row=request.result;if(!row)return;row.status=status;row.updatedAt=now();row.attempts=Number(row.attempts||0)+1;row.lastError=error?clean(error,1000):null;row.nextAttemptAt=status==='pending'?new Date(Date.now()+Math.min(3600000,1000*2**Math.min(row.attempts,10))).toISOString():null;stores.outbox.put(row)}})}

function intendedFor(object,peerId,groups=[]){if(object.consent==='public'||object.consent==='federated')return true;if(object.consent==='direct')return object.audience.includes(peerId);if(object.consent==='group')return object.audience.some(id=>groups.includes(id));return false}
const mayRelay=object=>object.consent==='public'||object.consent==='federated';
async function validateObject(object){if(object?.schema!==OBJECT_SCHEMA||!object.id||!object.revisionHash||!object.signature)return{ok:false,error:'invalid object envelope'};if(!object.origin?.credential||await peerIdForCredential(object.origin.credential)!==object.origin.nodeId)return{ok:false,error:'origin identity mismatch'};if(object.origin.fingerprint&&`device:${object.origin.fingerprint}`!==object.origin.nodeId)return{ok:false,error:'origin fingerprint mismatch'};if(await sha256(canonical(object.payload))!==object.payloadHash)return{ok:false,error:'payload hash mismatch'};if(await sha256(canonical(signableObject(object)))!==object.revisionHash)return{ok:false,error:'revision hash mismatch'};if(!await verify(object.origin?.credential,signableObject(object),object.signature))return{ok:false,error:'signature rejected'};if(object.expiresAt&&Date.parse(object.expiresAt)<=Date.now())return{ok:false,error:'object expired'};return{ok:true}}
function chooseCanonicalRevision(local,incoming){
  const localRevision=Number(local?.revision)||0,incomingRevision=Number(incoming?.revision)||0;
  if(localRevision>incomingRevision)return{relation:'older',winner:'local'};
  if(incomingRevision>localRevision)return{relation:'newer',winner:'incoming'};
  if(local?.revisionHash===incoming?.revisionHash)return{relation:'duplicate',winner:'local'};
  const localHash=String(local?.revisionHash||''),incomingHash=String(incoming?.revisionHash||'');
  return{relation:'conflict',winner:incomingHash.localeCompare(localHash)<0?'incoming':'local'};
}
async function recordConflict(local,incoming,context={},winner='local'){
  const hashes=[clean(local?.revisionHash,500),clean(incoming?.revisionHash,500)].sort(),canonicalRevisionHash=winner==='incoming'?incoming.revisionHash:local.revisionHash,alternateRevisionHash=winner==='incoming'?local.revisionHash:incoming.revisionHash;
  const conflict={schema:CONFLICT_SCHEMA,id:`conflict:${clean(incoming?.id,500)}:${Number(incoming?.revision)||1}:${hashes.join(':')}`,objectId:incoming.id,revision:Number(incoming.revision)||1,canonicalRevisionHash,alternateRevisionHash,resident:clone(local),incoming:clone(incoming),fromPeer:context.fromPeer||null,detectedAt:now(),resolution:'deterministic-revision-hash-tiebreak'};
  await tx(['conflicts'],'readwrite',stores=>stores.conflicts.put(conflict));
  emit('object-conflict',{id:conflict.id,objectId:conflict.objectId,revision:conflict.revision,canonicalRevisionHash,alternateRevisionHash,fromPeer:conflict.fromPeer});
  return conflict;
}
async function ingest(object,context={}){
  const validation=await validateObject(object);if(!validation.ok)throw new Error(validation.error);
  const local=await getObject(object.id);
  if(local){
    const decision=chooseCanonicalRevision(local,object);
    if(decision.relation==='duplicate')return{status:'duplicate',object:local};
    if(decision.relation==='older')return{status:'older',object:local};
    if(decision.relation==='conflict'){
      const conflict=await recordConflict(local,object,context,decision.winner),winner=decision.winner==='incoming'?{...clone(object),visited:[...new Set([...(object.visited||[]),context.fromPeer].filter(Boolean))],receivedAt:now()}:local;
      if(decision.winner==='incoming')await tx(['objects'],'readwrite',stores=>stores.objects.put(winner));
      const receipt={schema:RECEIPT_SCHEMA,id:`receipt:${object.id}:${object.revisionHash}:${context.localNodeId||'local'}`,objectId:object.id,revisionHash:object.revisionHash,fromPeer:context.fromPeer||null,status:'conflict',createdAt:now()};
      await tx(['receipts'],'readwrite',stores=>stores.receipts.put(receipt));
      return{status:'conflict',object:winner,conflict,receipt};
    }
  }
  const next={...clone(object),visited:[...new Set([...(object.visited||[]),context.fromPeer].filter(Boolean))],receivedAt:now()};
  await tx(['objects'],'readwrite',stores=>stores.objects.put(next));
  const receipt={schema:RECEIPT_SCHEMA,id:`receipt:${object.id}:${object.revisionHash}:${context.localNodeId||'local'}`,objectId:object.id,revisionHash:object.revisionHash,fromPeer:context.fromPeer||null,status:'accepted',createdAt:now()};
  await tx(['receipts'],'readwrite',stores=>stores.receipts.put(receipt));
  emit('object-received',{id:object.id,kind:object.kind,fromPeer:context.fromPeer||null});
  return{status:'accepted',object:next,receipt};
}
const deviceId=async()=> (await credential()).id;

async function transitFor(object){const id=`${object.id}|${object.revisionHash}`;return await tx(['transit'],'readonly',stores=>req(stores.transit.get(id))).catch(()=>null)||{id,objectId:object.id,revisionHash:object.revisionHash,hopsUsed:0,visited:list(object.visited),receivedFrom:null,updatedAt:now()}}
async function saveTransit(object,state={}){const id=`${object.id}|${object.revisionHash}`,row={id,objectId:object.id,revisionHash:object.revisionHash,hopsUsed:Math.max(0,Number(state.hopsUsed)||0),visited:[...new Set(list(state.visited).map(String))].slice(-64),receivedFrom:state.receivedFrom||null,updatedAt:now()};await tx(['transit'],'readwrite',stores=>stores.transit.put(row));return row}
async function acked(peerId,object){const id=`${peerId}|${object.id}|${object.revisionHash}`;return Boolean(await tx(['acks'],'readonly',stores=>req(stores.acks.get(id))).catch(()=>null))}
async function recordAck(peerId,objectId,revisionHash){const id=`${peerId}|${objectId}|${revisionHash}`;await tx(['acks'],'readwrite',stores=>stores.acks.put({id,peerId,objectId,revisionHash,at:now()}))}

function encodeSignal(description){return b64(encoder.encode(JSON.stringify(description)))}
function decodeSignal(value){return JSON.parse(decoder.decode(unb64(value)))}
function waitIce(connection){if(connection.iceGatheringState==='complete')return Promise.resolve();return new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;connection.removeEventListener('icegatheringstatechange',change);clearTimeout(timer);resolve()},change=()=>connection.iceGatheringState==='complete'&&finish(),timer=setTimeout(finish,6000);connection.addEventListener('icegatheringstatechange',change)})}
function newConnection(){if(!('RTCPeerConnection'in globalThis))throw new Error('WebRTC is unavailable in this browser');return new RTCPeerConnection({iceServers:clone(configuredIceServers)})}
function makeSession(connection,role,groups=[]){const session={id:uid('session'),connection,channel:null,peerId:null,peerGroups:[],peerClaimedGroups:[],peerCapabilities:null,peerProtocol:null,peerVerified:false,peerCredential:null,peerNonce:null,localNonce:randomNonce(),role,groups:[...new Set(groups.map(String))].slice(0,64),openedAt:null,lastSyncAt:null};sessions.set(session.id,session);connection.addEventListener('connectionstatechange',()=>emit('peer-state',{sessionId:session.id,peerId:session.peerId,state:connection.connectionState}));return session}
async function sendJson(session,message){const channel=session.channel;if(!channel||channel.readyState!=='open')throw new Error('Peer channel is not open');if(channel.bufferedAmount>BUFFER_HIGH){channel.bufferedAmountLowThreshold=BUFFER_LOW;await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{cleanup();reject(new Error('Peer channel remained backpressured'))},10000),ready=()=>{cleanup();resolve()},closed=()=>{cleanup();reject(new Error('Peer channel closed'))},cleanup=()=>{clearTimeout(timeout);channel.removeEventListener('bufferedamountlow',ready);channel.removeEventListener('close',closed)};channel.addEventListener('bufferedamountlow',ready,{once:true});channel.addEventListener('close',closed,{once:true})})}channel.send(JSON.stringify(message))}
async function peerIdForCredential(publicKey){return `device:${(await sha256(canonical(publicKey))).slice(0,24)}`}
function identityProofValue(from,to,challenge){return{schema:`${PROTOCOL}.identity-proof`,protocol:PROTOCOL,from,to,challenge}}
async function sendHello(session){const owner=await credential();await sendJson(session,{type:'hello',protocol:PROTOCOL,nodeId:owner.id,credential:owner.publicKey,nonce:session.localNonce,groups:session.groups,schemas:[OBJECT_SCHEMA],capabilities:{foregroundOnly:true,sleepingPhones:false,nativeCompanion:false,wifiDirect:false,resumableChunks:true,priorities:true,storeForwardPublic:true,directRelay:false,verifiedGroupDelivery:false,chunkBytes:CHUNK_BYTES,transportEncryption:'webrtc-dtls'}})}
async function sendIdentityProof(session){if(!session.peerId||!session.peerNonce)return;const owner=await credential(),value=identityProofValue(owner.id,session.peerId,session.peerNonce);await sendJson(session,{type:'identity-proof',from:owner.id,to:session.peerId,challenge:session.peerNonce,signature:await sign(owner.privateKey,value)})}
function bindChannel(session,channel){session.channel=channel;channel.binaryType='arraybuffer';channel.addEventListener('open',()=>{session.openedAt=now();emit('peer-open',{sessionId:session.id});sendHello(session).catch(error=>emit('peer-error',{sessionId:session.id,error:error.message}))});channel.addEventListener('message',event=>handleMessage(session,event.data).catch(error=>emit('peer-error',{sessionId:session.id,peerId:session.peerId,error:error.message})));channel.addEventListener('close',()=>emit('peer-close',{sessionId:session.id,peerId:session.peerId}));channel.addEventListener('error',()=>emit('peer-error',{sessionId:session.id,error:'data channel error'}))}
async function createOffer(options={}){const connection=newConnection(),session=makeSession(connection,'offerer',options.groups||configuredGroups);bindChannel(session,connection.createDataChannel(CHANNEL_LABEL,{ordered:true}));await connection.setLocalDescription(await connection.createOffer());await waitIce(connection);return{sessionId:session.id,offer:encodeSignal(connection.localDescription),protocol:PROTOCOL}}
async function acceptOffer(encoded,options={}){const connection=newConnection(),session=makeSession(connection,'answerer',options.groups||configuredGroups);connection.addEventListener('datachannel',event=>event.channel.label===CHANNEL_LABEL&&bindChannel(session,event.channel));await connection.setRemoteDescription(decodeSignal(encoded));await connection.setLocalDescription(await connection.createAnswer());await waitIce(connection);return{sessionId:session.id,answer:encodeSignal(connection.localDescription),protocol:PROTOCOL}}
async function acceptAnswer(sessionId,encoded){const session=sessions.get(sessionId);if(!session)throw new Error('Pairing session not found');await session.connection.setRemoteDescription(decodeSignal(encoded));return{sessionId,status:'connecting'}}

async function candidateRows(session){const pending=await listOutbox('pending'),byKey=new Map();for(const delivery of pending){const object=await getObject(delivery.objectId).catch(()=>null);if(object)byKey.set(`${object.id}|${object.revisionHash}`,object)}for(const object of await listObjects())if(mayRelay(object))byKey.set(`${object.id}|${object.revisionHash}`,object);const rows=[];for(const object of byKey.values()){if(!intendedFor(object,session.peerId,session.peerGroups))continue;if(['direct','group'].includes(object.consent)&&!session.peerVerified)continue;if(await acked(session.peerId,object))continue;if(object.expiresAt&&Date.parse(object.expiresAt)<=Date.now())continue;const transit=await transitFor(object),hopLimit=Math.max(0,Number(object.hopLimit)||0);if(transit.visited.includes(session.peerId)||transit.hopsUsed>=hopLimit||transit.hopsUsed>0&&!mayRelay(object))continue;const bytes=encoder.encode(JSON.stringify(object));if(bytes.byteLength>MAX_OBJECT_BYTES)continue;rows.push({object,transit,bytes,priority:await storedPriority(object),serializedHash:await sha256(bytes)})}rows.sort((a,b)=>b.priority-a.priority||Date.parse(a.object.createdAt||0)-Date.parse(b.object.createdAt||0));return rows}
async function flushSession(session){if(!session?.channel||session.channel.readyState!=='open'||!session.peerId)return{sent:0};if(session.peerProtocol==='legacy'){const pending=await listOutbox('pending'),items=[];for(const delivery of pending){const object=await getObject(delivery.objectId).catch(()=>null);if(!object||!mayRelay(object)||!intendedFor(object,session.peerId,session.peerGroups)||await acked(session.peerId,object))continue;const transit=await transitFor(object);if(transit.visited.includes(session.peerId)||transit.hopsUsed>=Math.max(0,Number(object.hopLimit)||0))continue;items.push(object)}if(items.length)await sendJson(session,{type:'objects',items});session.lastSyncAt=now();emit('peer-flush',{peerId:session.peerId,count:items.length,protocol:'legacy'});return{sent:items.length}}if(session.peerProtocol!==PROTOCOL)return{sent:0,incompatible:true};const rows=await candidateRows(session),entries=rows.map(({object,transit,bytes,priority,serializedHash})=>({objectId:object.id,revisionHash:object.revisionHash,revision:Number(object.revision)||1,kind:object.kind,consent:object.consent,priority,bytes:bytes.byteLength,chunks:Math.max(1,Math.ceil(bytes.byteLength/CHUNK_BYTES)),serializedHash,hopLimit:Number(object.hopLimit)||0,hopsUsed:transit.hopsUsed,visited:transit.visited,expiresAt:object.expiresAt||null}));await sendJson(session,{type:'manifest',schema:`${PROTOCOL}.manifest`,entries});session.lastSyncAt=now();emit('peer-flush',{peerId:session.peerId,count:entries.length,protocol:PROTOCOL});return{sent:entries.length}}
async function flushAll(){const out=[];for(const session of sessions.values())if(session.peerId&&session.channel?.readyState==='open')try{out.push({sessionId:session.id,...await flushSession(session)})}catch(error){out.push({sessionId:session.id,error:error.message})}return out}

async function prepareIncoming(entry,peerId){const transferId=`${entry.objectId}|${entry.revisionHash}`,existing=await tx(['incoming'],'readonly',stores=>req(stores.incoming.get(transferId))).catch(()=>null);if(existing?.serializedHash===entry.serializedHash&&existing.totalChunks===entry.chunks)return existing;const row={transferId,objectId:entry.objectId,revisionHash:entry.revisionHash,serializedHash:entry.serializedHash,totalChunks:entry.chunks,bytes:entry.bytes,chunks:{},peerId,hopsUsed:Math.max(0,Number(entry.hopsUsed)||0),visited:list(entry.visited),createdAt:now(),updatedAt:now()};await tx(['incoming'],'readwrite',stores=>stores.incoming.put(row));return row}
function missing(row){const indexes=[];for(let i=0;i<row.totalChunks;i++)if(!row.chunks?.[i])indexes.push(i);return indexes}
async function handleManifest(session,message){const entries=Array.isArray(message.entries)?message.entries.slice(0,500):[];for(const entry of entries){if(!entry?.objectId||!entry?.revisionHash||!Number.isSafeInteger(entry.chunks)||entry.chunks<1||entry.chunks>4096||!Number.isFinite(entry.bytes)||entry.bytes<0||entry.bytes>MAX_OBJECT_BYTES)continue;const local=await getObject(entry.objectId).catch(()=>null);if(local?.revisionHash===entry.revisionHash){await sendJson(session,{type:'receipt',objectId:entry.objectId,revisionHash:entry.revisionHash,status:'have'});continue}const row=await prepareIncoming(entry,session.peerId),indexes=missing(row);for(let offset=0;offset<indexes.length;offset+=256)await sendJson(session,{type:'want',objectId:entry.objectId,revisionHash:entry.revisionHash,indexes:indexes.slice(offset,offset+256)})}}
async function sendChunks(session,message){if(session.peerProtocol!==PROTOCOL)return;const object=await getObject(message.objectId).catch(()=>null);if(!object||object.revisionHash!==message.revisionHash||!intendedFor(object,session.peerId,session.peerGroups)||(['direct','group'].includes(object.consent)&&!session.peerVerified))return;const transit=await transitFor(object);if(transit.visited.includes(session.peerId)||transit.hopsUsed>=Math.max(0,Number(object.hopLimit)||0)||transit.hopsUsed>0&&!mayRelay(object))return;const bytes=encoder.encode(JSON.stringify(object)),total=Math.max(1,Math.ceil(bytes.byteLength/CHUNK_BYTES)),indexes=[...new Set(list(message.indexes).map(Number).filter(index=>Number.isSafeInteger(index)&&index>=0&&index<total))];for(const index of indexes){const start=index*CHUNK_BYTES,chunk=bytes.slice(start,Math.min(bytes.byteLength,start+CHUNK_BYTES));await sendJson(session,{type:'chunk',objectId:object.id,revisionHash:object.revisionHash,index,total,data:b64(chunk)})}}
async function handleChunk(session,message){const transferId=`${message.objectId}|${message.revisionHash}`;let complete=null;await tx(['incoming'],'readwrite',stores=>{const request=stores.incoming.get(transferId);request.onsuccess=()=>{const row=request.result,index=Number(message.index);if(!row||row.peerId!==session.peerId||!Number.isSafeInteger(index)||index<0||index>=row.totalChunks||Number(message.total)!==row.totalChunks)return;row.chunks=row.chunks||{};row.chunks[index]=clean(message.data,CHUNK_BYTES*2);row.updatedAt=now();stores.incoming.put(row);if(Object.keys(row.chunks).length===row.totalChunks)complete=row}});if(complete)await finalizeIncoming(session,complete)}
async function finalizeIncoming(session,row){const parts=[];let total=0;for(let i=0;i<row.totalChunks;i++){const part=unb64(row.chunks[i]);parts.push(part);total+=part.byteLength}if(total!==row.bytes)throw new Error('transfer length mismatch');const bytes=new Uint8Array(total);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength}if(await sha256(bytes)!==row.serializedHash)throw new Error('transfer hash mismatch');const object=JSON.parse(decoder.decode(bytes));if(object.id!==row.objectId||object.revisionHash!==row.revisionHash)throw new Error('transfer identity mismatch');const localId=await deviceId();if(!intendedFor(object,localId,configuredGroups))throw new Error('object is outside this device audience');const result=await ingest(object,{fromPeer:session.peerId,localNodeId:localId}),transit={hopsUsed:row.hopsUsed+1,visited:[...new Set([...row.visited,session.peerId,localId].filter(Boolean))],receivedFrom:session.peerId};await saveTransit(result.object||object,transit);await tx(['incoming'],'readwrite',stores=>stores.incoming.delete(row.transferId));await sendJson(session,{type:'receipt',objectId:object.id,revisionHash:object.revisionHash,status:result.status||'accepted'});if(mayRelay(result.object||object)&&transit.hopsUsed<Math.max(0,Number((result.object||object).hopLimit)||0))queueMicrotask(()=>flushAll().catch(()=>{}))}
async function handleReceipt(session,message){const receipt=message.receipt;if(receipt?.id){const object=await getObject(receipt.objectId).catch(()=>null);if(object&&['direct','group'].includes(object.consent)&&!session.peerVerified)return;await tx(['receipts'],'readwrite',stores=>stores.receipts.put(receipt));if(receipt.status==='accepted')await markDelivery(`delivery:${receipt.objectId}:${receipt.revisionHash}`,'delivered');emit('receipt',{receipt});return}if(!message.objectId||!message.revisionHash)return;const object=await getObject(message.objectId).catch(()=>null);if(object&&['direct','group'].includes(object.consent)&&!session.peerVerified)return;await recordAck(session.peerId,message.objectId,message.revisionHash);const delivery=await tx(['outbox'],'readonly',stores=>req(stores.outbox.get(`delivery:${message.objectId}:${message.revisionHash}`))).catch(()=>null),destinations=list(delivery?.destinations).map(String);if(delivery&&destinations.length===1&&destinations[0]===session.peerId)await markDelivery(delivery.id,'delivered');emit('receipt',{peerId:session.peerId,objectId:message.objectId,status:message.status||'accepted'})}
async function handleLegacyObjects(session,message){const localId=await deviceId();for(const object of message.items||[])try{if(!intendedFor(object,localId,configuredGroups))throw new Error('object is outside this device audience');const result=await ingest(object,{fromPeer:session.peerId,localNodeId:localId});await saveTransit(result.object||object,{hopsUsed:1,visited:[...new Set([...(object.visited||[]),session.peerId,localId].filter(Boolean))],receivedFrom:session.peerId});if(result.receipt)await sendJson(session,{type:'receipt',receipt:result.receipt})}catch(error){await sendJson(session,{type:'rejection',objectId:object?.id,error:error.message})}}
async function handleMessage(session,data){let message;try{message=JSON.parse(typeof data==='string'?data:decoder.decode(data))}catch{return}if(message.type==='hello'){const declaredProtocol=clean(message.protocol,160);if(declaredProtocol&&declaredProtocol!==PROTOCOL){session.peerProtocol=declaredProtocol;emit('peer-incompatible',{sessionId:session.id,protocol:declaredProtocol,supported:PROTOCOL});try{session.channel?.close()}catch{}return}session.peerId=clean(message.nodeId||session.id,500);session.peerClaimedGroups=[...new Set(list(message.groups).map(String))].slice(0,64);session.peerGroups=[];session.peerCapabilities=clone(message.capabilities||{});session.peerProtocol=declaredProtocol||'legacy';session.peerVerified=false;if(session.peerProtocol===PROTOCOL){const derived=message.credential&&typeof message.credential==='object'?await peerIdForCredential(message.credential):'',nonce=clean(message.nonce,200);if(!derived||derived!==session.peerId||!nonce){emit('peer-rejected',{sessionId:session.id,peerId:session.peerId,reason:'peer identity mismatch'});try{session.channel?.close()}catch{}throw new Error('peer identity mismatch')}session.peerCredential=clone(message.credential);session.peerNonce=nonce;await sendIdentityProof(session)}await tx(['peers'],'readwrite',stores=>stores.peers.put({id:session.peerId,lastSeenAt:now(),transport:'webrtc',protocol:session.peerProtocol,verified:false,capabilities:session.peerCapabilities,status:session.peerProtocol===PROTOCOL?'proving':'connected'}));emit('peer-identified',{sessionId:session.id,peerId:session.peerId,protocol:session.peerProtocol,verified:false});await flushSession(session);return}if(!session.peerId)return;if(message.type==='identity-proof'){if(session.peerProtocol!==PROTOCOL||!session.peerCredential)return;const localId=await deviceId(),value=identityProofValue(session.peerId,localId,session.localNonce),matches=message.from===session.peerId&&message.to===localId&&message.challenge===session.localNonce&&await verify(session.peerCredential,value,message.signature);if(!matches){emit('peer-rejected',{sessionId:session.id,peerId:session.peerId,reason:'peer proof rejected'});try{session.channel?.close()}catch{}throw new Error('peer proof rejected')}session.peerVerified=true;await tx(['peers'],'readwrite',stores=>stores.peers.put({id:session.peerId,lastSeenAt:now(),transport:'webrtc',protocol:session.peerProtocol,verified:true,capabilities:session.peerCapabilities,status:'connected'}));emit('peer-verified',{sessionId:session.id,peerId:session.peerId});await flushSession(session);return}if(['manifest','want','chunk'].includes(message.type)&&session.peerProtocol!==PROTOCOL)return;if(message.type==='manifest')return handleManifest(session,message);if(message.type==='want')return sendChunks(session,message);if(message.type==='chunk')return handleChunk(session,message);if(message.type==='receipt')return handleReceipt(session,message);if(message.type==='objects')return handleLegacyObjects(session,message);if(message.type==='rejection')emit('rejection',message)}

async function syncGateway(baseUrl){const base=new URL(baseUrl||location.origin),pending=await listOutbox('pending');let sent=0,received=0;for(const delivery of pending){const object=await getObject(delivery.objectId);if(!object||!mayRelay(object))continue;try{const response=await fetch(new URL('/api/envelopes',base),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({schema:'civweave.community-object-envelope.v1',from:await deviceId(),to:object.audience.length===1?object.audience[0]:'*',kind:'community-object',subject:object.kind,payload:object,correlationId:object.id})});if(!response.ok)throw new Error(`gateway returned ${response.status}`);await markDelivery(delivery.id,'delivered');sent++}catch(error){await markDelivery(delivery.id,'pending',error.message)}}try{const endpoint=new URL('/api/envelopes',base);endpoint.searchParams.set('limit','200');const response=await fetch(endpoint,{cache:'no-store'});if(response.ok){const payload=await response.json();for(const envelope of payload.envelopes||[]){if(envelope.kind!=='community-object'||!envelope.payload)continue;try{const object=envelope.payload;if(!mayRelay(object)||!intendedFor(object,await deviceId(),configuredGroups))continue;const result=await ingest(object,{fromPeer:envelope.from,localNodeId:await deviceId()});if(result.status==='accepted'||result.status==='conflict')received++}catch{}}}}catch{}emit('gateway-sync',{base:base.origin,sent,received});return{sent,received}}
async function requestBackgroundSync(){try{const registration=await navigator.serviceWorker?.ready;if(registration?.sync)await registration.sync.register('civweave-community-outbox')}catch{}}
async function exportBundle(){const owner=await credential();return{schema:'civweave.community-bundle.v1',createdAt:now(),node:{id:owner.id,publicKey:owner.publicKey},objects:await listObjects(),receipts:await tx(['receipts'],'readonly',stores=>req(stores.receipts.getAll())),conflicts:await listConflicts()}}
async function importBundle(bundle){if(bundle?.schema!=='civweave.community-bundle.v1'||!Array.isArray(bundle.objects))throw new Error('Unsupported community bundle');const results=[];for(const object of bundle.objects)try{results.push(await ingest(object,{fromPeer:bundle.node?.id,localNodeId:await deviceId()}))}catch(error){results.push({status:'rejected',id:object?.id,error:error.message})}if(Array.isArray(bundle.conflicts)&&bundle.conflicts.length)await tx(['conflicts'],'readwrite',stores=>{for(const conflict of bundle.conflicts)if(conflict?.schema===CONFLICT_SCHEMA&&conflict?.id&&conflict?.objectId)stores.conflicts.put(clone(conflict))});return results}
function configure(options={}){if(options.iceServers!==undefined){if(!Array.isArray(options.iceServers))throw new TypeError('iceServers must be an array');configuredIceServers=clone(options.iceServers).slice(0,8)}if(options.groups!==undefined){if(!Array.isArray(options.groups))throw new TypeError('groups must be an array');configuredGroups=[...new Set(options.groups.map(String))].slice(0,64)}return status()}
function status(){return{protocol:PROTOCOL,foregroundOnly:true,sleepingPhones:false,nativeCompanion:false,wifiDirect:false,transport:'webrtc-datachannel',transportEncryption:'webrtc-dtls',chunkBytes:CHUNK_BYTES,conflictPolicy:'same-revision-hash-tiebreak-preserve-both',sessions:[...sessions.values()].map(session=>({id:session.id,peerId:session.peerId,role:session.role,state:session.channel?.readyState||null,peerProtocol:session.peerProtocol,peerVerified:session.peerVerified,peerClaimedGroups:session.peerClaimedGroups,proofPending:session.peerProtocol===PROTOCOL&&!session.peerVerified,lastSyncAt:session.lastSyncAt}))}}
function subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener)}

addEventListener('focus',()=>{if(!document.hidden)flushAll().catch(()=>{})});
addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')flushAll().catch(()=>{})});
addEventListener('online',()=>flushAll().catch(()=>{}));

globalThis.CivweaveLocalMeshV146={DB_NAME,OBJECT_SCHEMA,DELIVERY_SCHEMA,RECEIPT_SCHEMA,CONFLICT_SCHEMA,PROTOCOL,deviceId,credential,createObject,queue,getObject,listObjects,listConflicts,listOutbox,ingest,validateObject,createOffer,acceptOffer,acceptAnswer,flushSession,flushAll,syncGateway,exportBundle,importBundle,requestBackgroundSync,setPriority,configure,status,subscribe,sessions};
})();
