(()=>{
'use strict';

const VERSION='1.0.0';
const SCHEMA='civweave.content-provenance.v1';
const GENERATION_SCHEMA='civweave.generation-provenance.v1';
const METADATA_KEY='civweaveProvenance';
const ORIGINS=new Set(['human-authored','ai-generated','deterministic-generated','unknown']);
const now=()=>new Date().toISOString();
const clean=(value,max=1200)=>String(value??'').trim().slice(0,max);
const clone=value=>{
  if(value==null)return value;
  if(typeof structuredClone==='function')try{return structuredClone(value)}catch{}
  try{return JSON.parse(JSON.stringify(value))}catch{return value}
};
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};

function normalizeOrigin(value){
  const origin=clean(value,40).toLowerCase();
  return ORIGINS.has(origin)?origin:'unknown';
}

function read(record){
  const metadata=object(record?.metadata);
  const source=object(metadata[METADATA_KEY]);
  if(!Object.keys(source).length)return null;
  const origin=normalizeOrigin(source.origin);
  return{
    ...clone(source),
    schema:SCHEMA,
    origin,
    aiGenerated:origin==='ai-generated',
    humanValidations:Array.isArray(source.humanValidations)?clone(source.humanValidations):[]
  };
}

function generationFromResult(result){
  const explicit=object(result?.metadata?.generation);
  if(explicit.schema===GENERATION_SCHEMA||typeof explicit.aiGenerated==='boolean'){
    return{
      schema:GENERATION_SCHEMA,
      kind:clean(explicit.kind,60)|| (explicit.aiGenerated?'ai-generated':'deterministic-generated'),
      aiGenerated:Boolean(explicit.aiGenerated),
      provider:clean(explicit.provider||result?.actual?.provider,120),
      model:clean(explicit.model||result?.actual?.model,240),
      requestId:clean(explicit.requestId||result?.requestId,180),
      purpose:clean(explicit.purpose||result?.purpose,180),
      generatedAt:clean(explicit.generatedAt||result?.timing?.completedAt,80)||now()
    };
  }
  const provider=clean(result?.actual?.provider||result?.requested?.provider,120).toLowerCase();
  const deterministicFallback=Boolean(result?.fallback?.used&&result?.fallback?.provider==='deterministic');
  const aiGenerated=Boolean(provider&&!['deterministic','manual'].includes(provider)&&!deterministicFallback);
  return{
    schema:GENERATION_SCHEMA,
    kind:aiGenerated?'ai-generated':provider==='manual'?'manual':'deterministic-generated',
    aiGenerated,
    provider,
    model:clean(result?.actual?.model||result?.requested?.model,240),
    requestId:clean(result?.requestId,180),
    purpose:clean(result?.purpose,180),
    generatedAt:clean(result?.timing?.completedAt,80)||now()
  };
}

function fromModelResult(result,details={}){
  const generation=generationFromResult(result);
  const origin=generation.aiGenerated?'ai-generated':'deterministic-generated';
  return{
    schema:SCHEMA,
    origin,
    aiGenerated:generation.aiGenerated,
    createdAt:generation.generatedAt||now(),
    sourceSystem:clean(details.sourceSystem||details.system,120),
    artifactType:clean(details.artifactType||details.kind,120),
    generation,
    humanValidations:[]
  };
}

function humanAuthored(details={}){
  return{
    schema:SCHEMA,
    origin:'human-authored',
    aiGenerated:false,
    createdAt:clean(details.createdAt,80)||now(),
    sourceSystem:clean(details.sourceSystem||details.system,120),
    artifactType:clean(details.artifactType||details.kind,120),
    authorId:clean(details.authorId,240),
    declaration:clean(details.declaration,400)||'Authored through a human-controlled Civweave creation surface.',
    humanValidations:[]
  };
}

function unknown(details={}){
  return{
    schema:SCHEMA,
    origin:'unknown',
    aiGenerated:false,
    createdAt:clean(details.createdAt,80)||now(),
    sourceSystem:clean(details.sourceSystem||details.system,120),
    artifactType:clean(details.artifactType||details.kind,120),
    reason:clean(details.reason,600)||'Reliable creation provenance was not recorded.',
    humanValidations:[]
  };
}

function stamp(record,provenance){
  const target=object(record);
  const metadata=object(target.metadata);
  const existing=read(target);
  const incoming=object(provenance);
  const incomingOrigin=normalizeOrigin(incoming.origin);
  const lockedOrigin=existing?.origin&&existing.origin!=='unknown'?existing.origin:incomingOrigin;
  const base=existing?{...existing}:{...incoming};
  const merged={
    ...clone(incoming),
    ...base,
    schema:SCHEMA,
    origin:lockedOrigin,
    aiGenerated:lockedOrigin==='ai-generated',
    createdAt:clean(existing?.createdAt||incoming.createdAt,80)||now(),
    humanValidations:Array.isArray(existing?.humanValidations)?clone(existing.humanValidations):Array.isArray(incoming.humanValidations)?clone(incoming.humanValidations):[]
  };
  if(existing?.origin&&existing.origin!=='unknown'&&incomingOrigin!==existing.origin){
    merged.originChangeRejected={requested:incomingOrigin,at:now()};
  }
  return{...clone(target),metadata:{...clone(metadata),[METADATA_KEY]:merged}};
}

function addHumanValidation(record,review={}){
  const target=read(record)?clone(record):stamp(record,unknown({reason:'Validation was recorded for an artifact without creation provenance.'}));
  const provenance=read(target)||unknown();
  const validation={
    schema:'civweave.human-validation.v1',
    status:clean(review.status||review.decision,40)||'reviewed',
    validatorId:clean(review.validatorId||review.reviewerId,240),
    validatedAt:clean(review.validatedAt,80)||now(),
    note:clean(review.note||review.reason,1200),
    evidenceId:clean(review.evidenceId||review.receiptId,240)
  };
  const validations=[...(provenance.humanValidations||[]),validation].slice(-100);
  return stamp(target,{...provenance,humanValidations:validations});
}

function isAiGenerated(record){return read(record)?.origin==='ai-generated'}
function isHumanAuthored(record){return read(record)?.origin==='human-authored'}
function isLudditeVisible(record){return isHumanAuthored(record)}
function filterLuddite(rows){return(Array.isArray(rows)?rows:[]).filter(isLudditeVisible)}

const api=Object.freeze({
  version:VERSION,
  schema:SCHEMA,
  generationSchema:GENERATION_SCHEMA,
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
  isLudditeVisible,
  filterLuddite
});

globalThis.CivweaveContentProvenanceV1=api;
try{dispatchEvent(new CustomEvent('civweave:content-provenance-ready',{detail:{version:VERSION,schema:SCHEMA}}))}catch{}
})();
