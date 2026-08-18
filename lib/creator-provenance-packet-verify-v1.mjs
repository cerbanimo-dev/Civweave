const EVENT_SCHEMA='civweave.creation-event.v1',PACKET_SCHEMA='civweave.creation-packet.v1';
const ACTOR_KINDS=new Set(['human','civweave-ai','deterministic','external']);
const PRIVATE_PAYLOAD_KEYS=new Set(['content','text','raw','bytes','blob','prompt','output','source','data']);
const enc=new TextEncoder();
const clean=(value,max=1200)=>String(value??'').trim().slice(0,max);
function canonicalValue(value){if(value===null||typeof value==='string'||typeof value==='boolean')return value;if(typeof value==='number')return Number.isFinite(value)?value:null;if(Array.isArray(value))return value.map(canonicalValue);if(value&&typeof value==='object'){const out={};for(const key of Object.keys(value).sort()){const item=value[key];if(item===undefined||typeof item==='function'||typeof item==='symbol')continue;out[key]=canonicalValue(item)}return out}return String(value??'')}
const canonicalize=value=>JSON.stringify(canonicalValue(value));
async function sha256(value){const bytes=enc.encode(typeof value==='string'?value:canonicalize(value)),digest=await crypto.subtle.digest('SHA-256',bytes);return[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('')}
function sanitizePayload(value,depth=0){if(depth>6)return'[depth-limit]';if(value===null||typeof value==='boolean')return value;if(typeof value==='number')return Number.isFinite(value)?value:null;if(typeof value==='string')return clean(value,600);if(Array.isArray(value))return value.slice(0,128).map(item=>sanitizePayload(item,depth+1));if(value&&typeof value==='object'){const out={};for(const[key,item]of Object.entries(value).slice(0,128)){if(PRIVATE_PAYLOAD_KEYS.has(key.toLowerCase()))continue;out[clean(key,80)]=sanitizePayload(item,depth+1)}return out}return clean(value,240)}
function normalizeActor(value={}){const actor=value&&typeof value==='object'&&!Array.isArray(value)?value:{},raw=clean(actor.kind||actor.type,40).toLowerCase(),kind=ACTOR_KINDS.has(raw)?raw:'external';return{kind,id:clean(actor.id||actor.actorId||actor.guideId,240),provider:kind==='civweave-ai'?clean(actor.provider,120):'',model:kind==='civweave-ai'?clean(actor.model,240):'',requestId:kind==='civweave-ai'?clean(actor.requestId,180):''}}
function eventCore(event,index,previousHash){return{schema:EVENT_SCHEMA,id:clean(event?.id,240),seq:index+1,timestamp:clean(event?.timestamp,80),type:clean(event?.type,120).toLowerCase(),actor:normalizeActor(event?.actor),payload:sanitizePayload(event?.payload||{}),previousHash}}
export async function verifyCreationPacket(packet={}){
  if(packet?.schema!==PACKET_SCHEMA||!Array.isArray(packet.events))return{valid:false,reason:'invalid-packet',eventCount:0,headHash:''};
  if(Number(packet.eventCount)!==packet.events.length)return{valid:false,reason:'event-count-mismatch',eventCount:packet.events.length,headHash:clean(packet.headHash,128)};
  let previousHash='';
  for(let index=0;index<packet.events.length;index++){
    const event=packet.events[index];if(Number(event?.seq)!==index+1)return{valid:false,reason:'sequence-mismatch',index,eventCount:packet.events.length,headHash:clean(packet.headHash,128)};
    if(clean(event?.previousHash,128)!==previousHash)return{valid:false,reason:'previous-hash-mismatch',index,eventCount:packet.events.length,headHash:clean(packet.headHash,128)};
    const expected=await sha256(eventCore(event,index,previousHash));if(clean(event?.hash,128)!==expected)return{valid:false,reason:'event-hash-mismatch',index,eventCount:packet.events.length,headHash:clean(packet.headHash,128)};previousHash=expected;
  }
  if(clean(packet.headHash,128)!==previousHash)return{valid:false,reason:'head-hash-mismatch',eventCount:packet.events.length,headHash:clean(packet.headHash,128)};
  const packetBase={schema:PACKET_SCHEMA,sessionId:clean(packet.sessionId,240),mediaType:clean(packet.mediaType,60),artifactType:clean(packet.artifactType,120),sourceSystem:clean(packet.sourceSystem,120),startedAt:clean(packet.startedAt,80),updatedAt:clean(packet.updatedAt,80),eventCount:packet.events.length,headHash:clean(packet.headHash,128),summary:packet.summary,events:packet.events};
  const expectedPacketHash=await sha256(packetBase);if(clean(packet.packetHash,128)!==expectedPacketHash)return{valid:false,reason:'packet-hash-mismatch',eventCount:packet.events.length,headHash:previousHash,expectedPacketHash};
  return{valid:true,reason:'verified',eventCount:packet.events.length,headHash:previousHash,packetHash:expectedPacketHash};
}
export{canonicalize,normalizeActor,sanitizePayload,sha256};
