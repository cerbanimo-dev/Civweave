import {newJurorProfile,dismissJuryInvitation,recordJurorReview,assignJury,validateSecondaryReview} from './anarchadia-tribunal-v1.js';

export const JUROR_REGISTRY_SCHEMA='civweave.anarchadia.juror-registry.v1';
export const JUROR_REGISTRY_KEY='civweave.anarchadia.juror-registry.v1';
const now=()=>new Date().toISOString();
const clean=(v,n=220)=>String(v??'').trim().slice(0,n);
const clone=v=>globalThis.structuredClone?structuredClone(v):JSON.parse(JSON.stringify(v));
const parse=(v,f)=>{try{return JSON.parse(v)??f}catch{return f}};

function readRegistry(storage=globalThis.localStorage){
  const value=parse(storage?.getItem?.(JUROR_REGISTRY_KEY)||'null',null);
  if(value?.schema===JUROR_REGISTRY_SCHEMA&&value.profiles&&typeof value.profiles==='object')return value;
  return {schema:JUROR_REGISTRY_SCHEMA,version:1,profiles:{},updatedAt:now()};
}
function writeRegistry(registry,storage=globalThis.localStorage){registry.updatedAt=now();storage?.setItem?.(JUROR_REGISTRY_KEY,JSON.stringify(registry));return registry}
export function loadJurorProfile(actorId,{storage=globalThis.localStorage}={}){const id=clean(actorId);if(!id)throw new Error('Juror actor ID is required.');const registry=readRegistry(storage);return clone(registry.profiles[id]||newJurorProfile(id))}
export function saveJurorProfile(profile,{storage=globalThis.localStorage}={}){const id=clean(profile?.actorId);if(!id)throw new Error('Juror profile requires actorId.');const registry=readRegistry(storage),next={...newJurorProfile(id),...clone(profile),actorId:id};registry.profiles[id]=next;writeRegistry(registry,storage);return clone(next)}
export function jurorCandidates(actorIds,{storage=globalThis.localStorage}={}){return [...new Set((actorIds||[]).map(String).map(x=>x.trim()).filter(Boolean))].map(actorId=>({actorId,profile:loadJurorProfile(actorId,{storage})}))}
export function recordJuryAssignment(actorId,{storage=globalThis.localStorage,at=now()}={}){const profile=loadJurorProfile(actorId,{storage});profile.servedAt=[...(profile.servedAt||[]),at].slice(-100);profile.lastAssignedAt=at;return saveJurorProfile(profile,{storage})}
export function recordJuryDismissal(actorId,{storage=globalThis.localStorage,at=now()}={}){return saveJurorProfile(dismissJuryInvitation(loadJurorProfile(actorId,{storage}),at),{storage})}
export function recordSecondaryReview(actorId,{valid=true,storage=globalThis.localStorage,at=now()}={}){return saveJurorProfile(recordJurorReview(loadJurorProfile(actorId,{storage}),{valid,at}),{storage})}
export function assignJuryFromRegistry(caseRecord,eligibleActorIds,{storage=globalThis.localStorage,rng}={}){
  const jury=assignJury(caseRecord,jurorCandidates(eligibleActorIds,{storage}),{rng});
  for(const row of jury)recordJuryAssignment(row.actorId,{storage,at:row.assignedAt});
  return jury;
}
export function validateSecondaryReviewAndRecord(caseRecord,actorId,{valid,reviewerActorId,note='',storage=globalThis.localStorage}={}){
  const validation=validateSecondaryReview(caseRecord,actorId,{valid,reviewerActorId,note});
  const profile=recordSecondaryReview(actorId,{valid:Boolean(valid),storage,at:validation.reviewedAt});
  return {validation,profile};
}
export function registrySnapshot({storage=globalThis.localStorage}={}){return clone(readRegistry(storage))}
