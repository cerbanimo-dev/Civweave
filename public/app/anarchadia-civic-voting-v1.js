import {canonicalJson,sha256,signPayload,verifySignature} from './anarchadia-governance-kernel-v145.js';

export const DELEGATION_SCHEMA='civweave.anarchadia.vote-delegation.v1';
export const QUADRATIC_BALLOT_SCHEMA='civweave.anarchadia.quadratic-policy-ballot.v1';
export const QUADRATIC_ALLOCATION_SCHEMA='civweave.anarchadia.quadratic-allocation.v1';
const now=()=>new Date().toISOString();
const id=p=>`${p}-${globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
const clean=(v,n=300)=>String(v??'').trim().slice(0,n);
const active=d=>d?.status==='active'&&(!d.expiresAt||Date.parse(d.expiresAt)>Date.now());

export async function createVoteDelegation(input,credential,privateKey){
  const payload={schema:DELEGATION_SCHEMA,id:input.id||id('delegation'),fromActorId:credential.id,toActorId:clean(input.toActorId,180),scope:clean(input.scope||'general',120),regionId:clean(input.regionId,180)||null,createdAt:now(),expiresAt:input.expiresAt||null,status:'active'};
  if(!payload.toActorId||payload.toActorId===payload.fromActorId)throw new Error('Delegation requires a different recipient.');
  return {...payload,publicKey:credential.publicKey,signature:await signPayload(privateKey,payload)};
}
export async function verifyVoteDelegation(d){const {signature,publicKey,...payload}=d||{};return Boolean(signature&&publicKey&&await verifySignature(publicKey,payload,signature))}
export function revokeVoteDelegation(d){return {...d,status:'revoked',revokedAt:now()}}
export function resolveDelegate(actorId,delegations,{scope='general',regionId=null,maxDepth=12}={}){
  const seen=new Set([actorId]);let current=actorId;
  for(let i=0;i<maxDepth;i++){
    const next=(delegations||[]).filter(active).filter(d=>d.fromActorId===current&&(d.scope===scope||d.scope==='general')&&(!d.regionId||!regionId||d.regionId===regionId)).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0];
    if(!next)return {actorId:current,delegated:current!==actorId,path:[...seen]};
    if(seen.has(next.toActorId))return {actorId,delegated:false,cycle:true,path:[...seen,next.toActorId]};
    current=next.toActorId;seen.add(current);
  }
  return {actorId,delegated:false,depthExceeded:true,path:[...seen]};
}

export async function openQuadraticPolicyBallot(subject,input={}){
  const electorate=(input.electorate||[]).map(x=>({actorId:x.id||x.actorId,publicKey:x.publicKey,label:x.label||x.name||x.id,credits:Math.max(1,Math.floor(Number(x.credits??input.creditsPerVoter??25)))})).filter(x=>x.actorId&&x.publicKey);
  const options=[...new Set((input.options||[]).map(x=>clean(typeof x==='string'?x:x.id,120)).filter(Boolean))];
  if(!electorate.length||options.length<2)throw new Error('Quadratic policy voting requires an electorate and at least two options.');
  return {schema:QUADRATIC_BALLOT_SCHEMA,id:input.id||id('qv'),subjectId:clean(subject.id||subject.subjectId,180),subjectRevisionHash:clean(subject.revisionHash||subject.subjectRevisionHash,180),scope:clean(input.scope||'policy',120),electorate,options,snapshotHash:await sha256(canonicalJson(electorate)),procedure:{quorum:Math.max(0,Math.min(1,Number(input.quorum??0.5)))},allocations:[],status:'open',openedAt:now(),closedAt:null,outcome:null};
}
function allocationPayload(ballot,actorId,allocations,castAt){return {schema:QUADRATIC_ALLOCATION_SCHEMA,ballotId:ballot.id,subjectId:ballot.subjectId,subjectRevisionHash:ballot.subjectRevisionHash,snapshotHash:ballot.snapshotHash,actorId,allocations,castAt}}
export async function castQuadraticAllocation(ballot,credential,privateKey,allocation={}){
  if(ballot.status!=='open')throw new Error('Quadratic ballot is closed.');
  const voter=ballot.electorate.find(x=>x.actorId===credential.id);if(!voter)throw new Error('Credential is outside the electorate.');
  const rows=ballot.options.map(optionId=>({optionId,votes:Math.trunc(Number(allocation[optionId]||0))})).filter(x=>x.votes!==0);
  const cost=rows.reduce((sum,x)=>sum+x.votes*x.votes,0);if(cost>voter.credits)throw new Error(`Quadratic credit budget exceeded: ${cost}/${voter.credits}.`);
  const castAt=now(),payload=allocationPayload(ballot,credential.id,rows,castAt),record={...payload,cost,publicKey:credential.publicKey,signature:await signPayload(privateKey,payload)};
  ballot.allocations=ballot.allocations.filter(x=>x.actorId!==credential.id);ballot.allocations.push(record);return record;
}
export function tallyQuadraticPolicyBallot(ballot,delegations=[]){
  const totals=Object.fromEntries(ballot.options.map(x=>[x,0])),represented=[];
  const direct=new Map(ballot.allocations.map(x=>[x.actorId,x]));
  for(const voter of ballot.electorate){
    let record=direct.get(voter.actorId),representedBy=voter.actorId;
    if(!record){const resolved=resolveDelegate(voter.actorId,delegations,{scope:ballot.scope});representedBy=resolved.actorId;record=direct.get(resolved.actorId)}
    if(!record)continue;
    for(const row of record.allocations||[])if(row.optionId in totals)totals[row.optionId]+=row.votes;
    represented.push({actorId:voter.actorId,representedBy});
  }
  const participation=ballot.electorate.length?represented.length/ballot.electorate.length:0;
  const winner=Object.entries(totals).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0]||null;
  return {totals,represented,participation,quorumMet:participation>=ballot.procedure.quorum,winner};
}
