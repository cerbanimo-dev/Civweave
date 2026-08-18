(()=>{
'use strict';

const VERSION='1.1.0';
const SCHEMA='civweave.content-provenance.v1';
const GENERATION_SCHEMA='civweave.generation-provenance.v1';
const CREATION_SESSION_SCHEMA='civweave.creation-session.v1';
const CREATION_EVENT_SCHEMA='civweave.creation-event.v1';
const CREATION_PACKET_SCHEMA='civweave.creation-packet.v1';
const CREATION_RECEIPT_SCHEMA='civweave.creation-receipt.v1';
const METADATA_KEY='civweaveProvenance';
const ORIGINS=new Set(['human-authored','ai-generated','deterministic-generated','unknown']);
const ACTOR_KINDS=new Set(['human','civweave-ai','deterministic','external']);
const PRIVATE_PAYLOAD_KEYS=new Set(['content','text','raw','bytes','blob','prompt','output','source','data']);
const now=()=>new Date().toISOString();
const clean=(value,max=1200)=>String(value??'').trim().slice(0,max);
const clone=value=>{if(value==null)return value;if(typeof structuredClone==='function')try{return structuredClone(value)}catch{}try{return JSON.parse(JSON.stringify(value))}catch{return value}};
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};

function normalizeOrigin(value){const origin=clean(value,40).toLowerCase();return ORIGINS.has(origin)?origin:'unknown'}
function normalizeActorKind(value){const kind=clean(value,40).toLowerCase();return ACTOR_KINDS.has(kind)?kind:'external'}

function read(record){
  const metadata=object(record?.metadata),source=object(metadata[METADATA_KEY]);
  if(!Object.keys(source).length)return null;
  const origin=normalizeOrigin(source.origin);
  return{...clone(source),schema:SCHEMA,origin,aiGenerated:origin==='ai-generated',humanValidations:Array.isArray(source.humanValidations)?clone(source.humanValidations):[]};
}

function generationFromResult(result){
  const explicit=object(result?.metadata?.generation);
  if(explicit.schema===GENERATION_SCHEMA||typeof explicit.aiGenerated==='boolean')return{schema:GENERATION_SCHEMA,kind:clean(explicit.kind,60)||(explicit.aiGenerated?'ai-generated':'deterministic-generated'),aiGenerated:Boolean(explicit.aiGenerated),provider:clean(explicit.provider||result?.actual?.provider,120),model:clean(explicit.model||result?.actual?.model,240),requestId:clean(explicit.requestId||result?.requestId,180),purpose:clean(explicit.purpose||result?.purpose,180),generatedAt:clean(explicit.generatedAt||result?.timing?.completedAt,80)||now()};
  const provider=clean(result?.actual?.provider||result?.requested?.provider,120).toLowerCase(),deterministicFallback=Boolean(result?.fallback?.used&&result?.fallback?.provider==='deterministic'),aiGenerated=Boolean(provider&&!['deterministic','manual'].includes(provider)&&!deterministicFallback);
  return{schema:GENERATION_SCHEMA,kind:aiGenerated?'ai-generated':provider==='manual'?'manual':'deterministic-generated',aiGenerated,provider,model:clean(result?.actual?.model||result?.requested?.model,240),requestId:clean(result?.requestId,180),purpose:clean(result?.purpose,180),generatedAt:clean(result?.timing?.completedAt,80)||now()};
}

function fromModelResult(result,details={}){const generation=generationFromResult(result),origin=generation.aiGenerated?'ai-generated':'deterministic-generated';return{schema:SCHEMA,origin,aiGenerated:generation.aiGenerated,createdAt:generation.generatedAt||now(),sourceSystem:clean(details.sourceSystem||details.system,120),artifactType:clean(details.artifactType||details.kind,120),generation,humanValidations:[]}}
function humanAuthored(details={}){return{schema:SCHEMA,origin:'human-authored',aiGenerated:false,createdAt:clean(details.createdAt,80)||now(),sourceSystem:clean(details.sourceSystem||details.system,120),artifactType:clean(details.artifactType||details.kind,120),authorId:clean(details.authorId,240),declaration:clean(details.declaration,400)||'Authored through a human-controlled Civweave creation surface.',humanValidations:[]}}
function unknown(details={}){return{schema:SCHEMA,origin:'unknown',aiGenerated:false,createdAt:clean(details.createdAt,80)||now(),sourceSystem:clean(details.sourceSystem||details.system,120),artifactType:clean(details.artifactType||details.kind,120),reason:clean(details.reason,600)||'Reliable creation provenance was not recorded.',humanValidations:[]}}

function stamp(record,provenance){
  const target=object(record),metadata=object(target.metadata),existing=read(target),incoming=object(provenance),incomingOrigin=normalizeOrigin(incoming.origin),lockedOrigin=existing?.origin&&existing.origin!=='unknown'?existing.origin:incomingOrigin,base=existing?{...existing}:{...incoming};
  const merged={...clone(incoming),...base,schema:SCHEMA,origin:lockedOrigin,aiGenerated:lockedOrigin==='ai-generated',createdAt:clean(existing?.createdAt||incoming.createdAt,80)||now(),humanValidations:Array.isArray(existing?.humanValidations)?clone(existing.humanValidations):Array.isArray(incoming.humanValidations)?clone(incoming.humanValidations):[]};
  if(existing?.origin&&existing.origin!=='unknown'&&incomingOrigin!==existing.origin)merged.originChangeRejected={requested:incomingOrigin,at:now()};
  return{...clone(target),metadata:{...clone(metadata),[METADATA_KEY]:merged}};
}

function addHumanValidation(record,review={}){
  const target=read(record)?clone(record):stamp(record,unknown({reason:'Validation was recorded for an artifact without creation provenance.'})),provenance=read(target)||unknown(),validation={schema:'civweave.human-validation.v1',status:clean(review.status||review.decision,40)||'reviewed',validatorId:clean(review.validatorId||review.reviewerId,240),validatedAt:clean(review.validatedAt,80)||now(),note:clean(review.note||review.reason,1200),evidenceId:clean(review.evidenceId||review.receiptId,240)},validations=[...(provenance.humanValidations||[]),validation].slice(-100);
  return stamp(target,{...provenance,humanValidations:validations});
}

function isAiGenerated(record){return read(record)?.origin==='ai-generated'}
function isHumanAuthored(record){return read(record)?.origin==='human-authored'}
function isLudVisible(record){return isHumanAuthored(record)}
function filterLud(rows){return(Array.isArray(rows)?rows:[]).filter(isLudVisible)}

function randomId(prefix='cw'){
  if(globalThis.crypto?.randomUUID)return`${prefix}:${globalThis.crypto.randomUUID()}`;
  const bytes=new Uint8Array(16);
  if(globalThis.crypto?.getRandomValues)globalThis.crypto.getRandomValues(bytes);
  else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);
  return`${prefix}:${Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')}`;
}

function canonicalValue(value){
  if(value===null||typeof value==='string'||typeof value==='boolean')return value;
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  if(Array.isArray(value))return value.map(canonicalValue);
  if(value&&typeof value==='object'){
    const out={};
    for(const key of Object.keys(value).sort()){
      const item=value[key];
      if(item===undefined||typeof item==='function'||typeof item==='symbol')continue;
      out[key]=canonicalValue(item);
    }
    return out;
  }
  return String(value??'');
}

function canonicalize(value){return JSON.stringify(canonicalValue(value))}

async function sha256(value){
  if(!globalThis.crypto?.subtle)throw new Error('WebCrypto is required for creation provenance hashing.');
  const bytes=new TextEncoder().encode(typeof value==='string'?value:canonicalize(value));
  const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}

function sanitizePayload(value,depth=0){
  if(depth>6)return'[depth-limit]';
  if(value===null||typeof value==='boolean')return value;
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  if(typeof value==='string')return clean(value,600);
  if(Array.isArray(value))return value.slice(0,128).map(item=>sanitizePayload(item,depth+1));
  if(value&&typeof value==='object'){
    const out={};
    for(const [key,item] of Object.entries(value).slice(0,128)){
      if(PRIVATE_PAYLOAD_KEYS.has(key.toLowerCase()))continue;
      out[clean(key,80)]=sanitizePayload(item,depth+1);
    }
    return out;
  }
  return clean(value,240);
}

function normalizeActor(value={}){
  const actor=object(value),kind=normalizeActorKind(actor.kind||actor.type);
  return{kind,id:clean(actor.id||actor.actorId||actor.guideId,240),provider:kind==='civweave-ai'?clean(actor.provider,120):'',model:kind==='civweave-ai'?clean(actor.model,240):'',requestId:kind==='civweave-ai'?clean(actor.requestId,180):''};
}

function createSession(details={}){
  const startedAt=clean(details.startedAt,80)||now();
  return{schema:CREATION_SESSION_SCHEMA,version:1,id:clean(details.id,240)||randomId('creation'),mediaType:clean(details.mediaType||details.medium,60)||'unknown',artifactType:clean(details.artifactType||details.kind,120),sourceSystem:clean(details.sourceSystem||details.system,120),startedAt,updatedAt:startedAt,finalizedAt:'',eventCount:0,headHash:'',events:[]};
}

function validateSessionShape(session){
  return Boolean(session&&session.schema===CREATION_SESSION_SCHEMA&&Array.isArray(session.events)&&clean(session.id,240));
}

async function recordEvent(session,event={}){
  if(!validateSessionShape(session))throw new Error('Invalid creation session.');
  if(session.finalizedAt)throw new Error('Finalized creation sessions are immutable.');
  const prior=clone(session),events=prior.events.slice(),seq=events.length+1,previousHash=clean(prior.headHash,128),timestamp=clean(event.timestamp||event.at,80)||now(),type=clean(event.type,120).toLowerCase();
  if(!type)throw new Error('Creation event type is required.');
  const core={schema:CREATION_EVENT_SCHEMA,id:clean(event.id,240)||randomId('event'),seq,timestamp,type,actor:normalizeActor(event.actor),payload:sanitizePayload(event.payload||event.operation||{}),previousHash};
  const hash=await sha256(core),appended={...core,hash};
  events.push(appended);
  return{...prior,updatedAt:timestamp,eventCount:events.length,headHash:hash,events};
}

async function verifySession(session){
  if(!validateSessionShape(session))return{valid:false,reason:'invalid-session',eventCount:0,headHash:''};
  let previousHash='';
  for(let index=0;index<session.events.length;index++){
    const event=object(session.events[index]),expectedSeq=index+1;
    if(Number(event.seq)!==expectedSeq)return{valid:false,reason:'sequence-mismatch',eventCount:session.events.length,headHash:clean(session.headHash,128),index};
    if(clean(event.previousHash,128)!==previousHash)return{valid:false,reason:'previous-hash-mismatch',eventCount:session.events.length,headHash:clean(session.headHash,128),index};
    const core={schema:CREATION_EVENT_SCHEMA,id:clean(event.id,240),seq:expectedSeq,timestamp:clean(event.timestamp,80),type:clean(event.type,120).toLowerCase(),actor:normalizeActor(event.actor),payload:sanitizePayload(event.payload||{}),previousHash};
    const expectedHash=await sha256(core);
    if(clean(event.hash,128)!==expectedHash)return{valid:false,reason:'event-hash-mismatch',eventCount:session.events.length,headHash:clean(session.headHash,128),index};
    previousHash=expectedHash;
  }
  if(Number(session.eventCount)!==session.events.length)return{valid:false,reason:'event-count-mismatch',eventCount:session.events.length,headHash:clean(session.headHash,128)};
  if(clean(session.headHash,128)!==previousHash)return{valid:false,reason:'head-hash-mismatch',eventCount:session.events.length,headHash:clean(session.headHash,128)};
  return{valid:true,reason:'verified',eventCount:session.events.length,headHash:previousHash};
}

function summarizeSession(session){
  const events=Array.isArray(session?.events)?session.events:[],actorCounts={human:0,'civweave-ai':0,deterministic:0,external:0},eventTypeCounts={};
  let firstAi=null;
  for(const raw of events){
    const event=object(raw),actor=normalizeActor(event.actor),kind=actor.kind;
    actorCounts[kind]=(actorCounts[kind]||0)+1;
    const type=clean(event.type,120).toLowerCase()||'unknown';
    eventTypeCounts[type]=(eventTypeCounts[type]||0)+1;
    if(!firstAi&&(kind==='civweave-ai'||type.startsWith('ai.')))firstAi={...actor,timestamp:clean(event.timestamp,80)};
  }
  const aiUsed=actorCounts['civweave-ai']>0||Object.keys(eventTypeCounts).some(type=>type.startsWith('ai.'));
  let origin='unknown';
  if(aiUsed)origin='ai-generated';
  else if(actorCounts.external>0)origin='unknown';
  else if(actorCounts.human>0)origin='human-authored';
  else if(actorCounts.deterministic>0)origin='deterministic-generated';
  return{schema:'civweave.creation-summary.v1',sessionId:clean(session?.id,240),mediaType:clean(session?.mediaType,60),artifactType:clean(session?.artifactType,120),sourceSystem:clean(session?.sourceSystem,120),origin,aiUsed,eventCount:events.length,actorCounts,eventTypeCounts,ai:firstAi?{provider:firstAi.provider,model:firstAi.model,requestId:firstAi.requestId,firstUsedAt:firstAi.timestamp}:null,headHash:clean(session?.headHash,128),startedAt:clean(session?.startedAt,80),updatedAt:clean(session?.updatedAt,80)};
}

function provenanceFromSummary(session,summary,receipt){
  if(summary.origin==='human-authored')return{...humanAuthored({createdAt:session.startedAt,sourceSystem:session.sourceSystem,artifactType:session.artifactType,authorId:session.events.find(event=>normalizeActor(event.actor).kind==='human')?.actor?.id}),creationReceipt:clone(receipt)};
  if(summary.origin==='ai-generated')return{schema:SCHEMA,origin:'ai-generated',aiGenerated:true,createdAt:clean(session.startedAt,80)||now(),sourceSystem:clean(session.sourceSystem,120),artifactType:clean(session.artifactType,120),generation:{schema:GENERATION_SCHEMA,kind:'ai-generated',aiGenerated:true,provider:clean(summary.ai?.provider,120),model:clean(summary.ai?.model,240),requestId:clean(summary.ai?.requestId,180),purpose:'creation-session',generatedAt:clean(summary.ai?.firstUsedAt,80)||clean(session.startedAt,80)||now()},creationReceipt:clone(receipt),humanValidations:[]};
  if(summary.origin==='deterministic-generated')return{schema:SCHEMA,origin:'deterministic-generated',aiGenerated:false,createdAt:clean(session.startedAt,80)||now(),sourceSystem:clean(session.sourceSystem,120),artifactType:clean(session.artifactType,120),creationReceipt:clone(receipt),humanValidations:[]};
  return{...unknown({createdAt:session.startedAt,sourceSystem:session.sourceSystem,artifactType:session.artifactType,reason:'Creation history contains external or otherwise unverifiable origin events.'}),creationReceipt:clone(receipt)};
}

async function finalizeSession(session,artifact={}){
  const verification=await verifySession(session);
  if(!verification.valid)throw new Error(`Creation session verification failed: ${verification.reason}`);
  const summary=summarizeSession(session),finalizedAt=now(),receiptBase={schema:CREATION_RECEIPT_SCHEMA,sessionId:session.id,mediaType:session.mediaType,artifactType:session.artifactType,sourceSystem:session.sourceSystem,eventCount:session.events.length,headHash:session.headHash,origin:summary.origin,aiUsed:summary.aiUsed,summary,finalizedAt},receipt={...receiptBase,receiptHash:await sha256(receiptBase)},provenance=provenanceFromSummary(session,summary,receipt),stampedArtifact=stamp(artifact,provenance);
  return{session:{...clone(session),finalizedAt,updatedAt:finalizedAt},artifact:stampedArtifact,receipt,provenance,verification};
}

async function makePacket(session,options={}){
  const verification=await verifySession(session);
  if(!verification.valid)throw new Error(`Creation session verification failed: ${verification.reason}`);
  const summary=summarizeSession(session),includeEvents=options.includeEvents!==false,packetBase={schema:CREATION_PACKET_SCHEMA,sessionId:session.id,mediaType:session.mediaType,artifactType:session.artifactType,sourceSystem:session.sourceSystem,startedAt:session.startedAt,updatedAt:session.updatedAt,eventCount:session.events.length,headHash:session.headHash,summary,events:includeEvents?clone(session.events):[]};
  return{...packetBase,packetHash:await sha256(packetBase)};
}

const api=Object.freeze({
  version:VERSION,
  schema:SCHEMA,
  generationSchema:GENERATION_SCHEMA,
  creationSessionSchema:CREATION_SESSION_SCHEMA,
  creationEventSchema:CREATION_EVENT_SCHEMA,
  creationPacketSchema:CREATION_PACKET_SCHEMA,
  creationReceiptSchema:CREATION_RECEIPT_SCHEMA,
  metadataKey:METADATA_KEY,
  read,
  generationFromResult,
  fromModelResult,
  humanAuthored,
  unknown,
  stamp,
  addHumanValidation,
  isAiGenerated,
  isHumanAuthored,
  isLudVisible,
  filterLud,
  createSession,
  recordEvent,
  verifySession,
  summarizeSession,
  finalizeSession,
  makePacket
});

globalThis.CivweaveContentProvenanceV1=api;
try{dispatchEvent(new CustomEvent('civweave:content-provenance-ready',{detail:{version:VERSION,schema:SCHEMA,creationSessionSchema:CREATION_SESSION_SCHEMA}}))}catch{}
})();
