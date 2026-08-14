import {canonicalJson,sha256} from './anarchadia-governance-kernel-v145.js';
import {openQuadraticPolicyBallot,tallyQuadraticPolicyBallot} from './anarchadia-civic-voting-v1.js';
import {DEFAULT_TRIBUNAL_PROCEDURE,JURY_REWARD_ACORNS} from './anarchadia-tribunal-v1.js';

export const TRIBUNAL_POLICY_SCHEMA='civweave.anarchadia.tribunal-policy.v1';
export const TRIBUNAL_POLICY_PROPOSAL_SCHEMA='civweave.anarchadia.tribunal-policy-proposal.v1';
export const TRIBUNAL_POLICY_STORE_KEY='civweave.anarchadia.tribunal-policies.v1';
const now=()=>new Date().toISOString();
const clean=(v,n=500)=>String(v??'').trim().slice(0,n);
const clone=v=>globalThis.structuredClone?structuredClone(v):JSON.parse(JSON.stringify(v));
const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)));
const uid=p=>`${p}-${globalThis.crypto?.randomUUID?.()||Date.now().toString(36)}`;
const zeroBand=()=>({buttonFine:0,acornRestitution:0,publicChatBanMinutes:0});

export function defaultTribunalPolicy(regionId='local'){
  return {
    schema:TRIBUNAL_POLICY_SCHEMA,
    id:`tribunal-policy:${clean(regionId,180)||'local'}`,
    regionId:clean(regionId,180)||'local',
    revision:1,
    moderationThreshold:0.82,
    procedure:{...DEFAULT_TRIBUNAL_PROCEDURE},
    sanctions:{1:zeroBand(),2:zeroBand(),3:zeroBand(),4:zeroBand()},
    invariants:{juryRewardAcorns:JURY_REWARD_ACORNS,classifiersCannotConvict:true,quadraticGuiltVoting:false,appealUsesFreshJury:true},
    updatedAt:now(),
    adoptedBy:null
  };
}
function number(value,fallback){return Number.isFinite(Number(value))?Number(value):fallback}
export function normalizeTribunalPolicy(input={},regionId=input.regionId||'local'){
  const base=defaultTribunalPolicy(regionId),p=input&&typeof input==='object'?input:{};
  const sanctions={};
  for(let level=1;level<=4;level++){
    const row=p.sanctions?.[level]||p.sanctions?.[String(level)]||{};
    sanctions[level]={buttonFine:Math.max(0,number(row.buttonFine,0)),acornRestitution:Math.max(0,number(row.acornRestitution,0)),publicChatBanMinutes:Math.max(0,Math.floor(number(row.publicChatBanMinutes,0)))};
  }
  return {...base,...p,schema:TRIBUNAL_POLICY_SCHEMA,id:p.id||base.id,regionId:clean(p.regionId||regionId,180)||'local',revision:Math.max(1,Math.floor(number(p.revision,1))),moderationThreshold:clamp(number(p.moderationThreshold,base.moderationThreshold),0.5,0.99),procedure:{...base.procedure,...p.procedure,panelSize:Math.max(3,Math.min(25,Math.floor(number(p.procedure?.panelSize,base.procedure.panelSize)))),quorum:clamp(number(p.procedure?.quorum,base.procedure.quorum),0.5,1),guiltThreshold:clamp(number(p.procedure?.guiltThreshold,base.procedure.guiltThreshold),0.5,1),secondaryReviewRate:clamp(number(p.procedure?.secondaryReviewRate,base.procedure.secondaryReviewRate),0,0.5),maxElevatedSelectionsPer30Days:Math.max(1,Math.min(100,Math.floor(number(p.procedure?.maxElevatedSelectionsPer30Days,base.procedure.maxElevatedSelectionsPer30Days))))},sanctions,invariants:base.invariants,updatedAt:p.updatedAt||now(),adoptedBy:p.adoptedBy||null};
}
function readStore(storage=globalThis.localStorage){try{const value=JSON.parse(storage?.getItem?.(TRIBUNAL_POLICY_STORE_KEY)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch{return {}}}
function writeStore(value,storage=globalThis.localStorage){storage?.setItem?.(TRIBUNAL_POLICY_STORE_KEY,JSON.stringify(value));return value}
export function loadTribunalPolicy(regionId='local',{storage=globalThis.localStorage}={}){const store=readStore(storage),key=clean(regionId,180)||'local';return normalizeTribunalPolicy(store[key]||{},key)}
export function saveTribunalPolicy(policy,{storage=globalThis.localStorage}={}){const next=normalizeTribunalPolicy(policy),store=readStore(storage);store[next.regionId]=next;writeStore(store,storage);return next}
export async function proposeTribunalPolicyChange(current,changes={},input={}){
  const base=normalizeTribunalPolicy(current),candidate=normalizeTribunalPolicy({...clone(base),...clone(changes),procedure:{...base.procedure,...clone(changes.procedure||{})},sanctions:{...base.sanctions,...clone(changes.sanctions||{})},revision:base.revision+1,updatedAt:now(),adoptedBy:null},base.regionId);
  const proposal={schema:TRIBUNAL_POLICY_PROPOSAL_SCHEMA,id:input.id||uid('tribunal-policy-proposal'),regionId:base.regionId,basePolicyId:base.id,baseRevision:base.revision,candidate,reason:clean(input.reason,4000),createdAt:now(),status:'proposed'};
  proposal.proposalHash=await sha256(canonicalJson({...proposal,proposalHash:undefined}));return proposal;
}
export async function openTribunalPolicyBallot(proposal,electorate,input={}){
  if(proposal?.schema!==TRIBUNAL_POLICY_PROPOSAL_SCHEMA)throw new Error('A tribunal policy proposal is required.');
  return openQuadraticPolicyBallot({id:proposal.id,revisionHash:proposal.proposalHash},{scope:`tribunal-policy:${proposal.regionId}`,electorate,options:['adopt','reject'],creditsPerVoter:input.creditsPerVoter??25,quorum:input.quorum??proposal.candidate.procedure.quorum});
}
export function tribunalPolicyBallotDecision(proposal,ballot,delegations=[]){
  if(ballot?.status!=='closed')return {adopted:false,reason:'ballot-not-closed'};
  if(ballot?.subjectId!==proposal?.id||ballot?.subjectRevisionHash!==proposal?.proposalHash)return {adopted:false,reason:'proposal-hash-mismatch'};
  const tally=tallyQuadraticPolicyBallot(ballot,delegations);if(!tally.quorumMet)return {adopted:false,reason:'quorum-not-met',tally};
  const adopt=Number(tally.totals.adopt||0),reject=Number(tally.totals.reject||0);return {adopted:adopt>reject,reason:adopt>reject?'adopted':'rejected-or-tied',tally};
}
export function adoptTribunalPolicy(proposal,ballot,delegations=[],{storage=globalThis.localStorage}={}){
  const decision=tribunalPolicyBallotDecision(proposal,ballot,delegations);if(!decision.adopted)throw new Error(`Tribunal policy was not adopted: ${decision.reason}.`);
  const policy=normalizeTribunalPolicy({...proposal.candidate,updatedAt:now(),adoptedBy:{ballotId:ballot.id,proposalHash:proposal.proposalHash,tally:decision.tally}},proposal.regionId);saveTribunalPolicy(policy,{storage});proposal.status='adopted';proposal.adoptedAt=policy.updatedAt;return policy;
}
