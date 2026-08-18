import { normalizeProvenanceFinding } from './creator-provenance-review-v1.mjs';

const clean=(value,max=2400)=>String(value??'').trim().slice(0,max);
const list=value=>Array.isArray(value)?value:[];
const ALLOWED_OUTCOMES=new Set(['verified','verified-with-ai','unknown-origin','broken-chain','anomalous','needs-human-review']);

export function addTribunalVote(state={},input={},context={}){
  const request=context.request||{},reviewerId=clean(context.reviewerId,240),creatorUserId=clean(request.creatorUserId,240),votes=list(state.votes);
  if(!reviewerId)throw new TypeError('Human provenance review requires an authenticated Guild member.');
  if(creatorUserId&&reviewerId===creatorUserId)throw new Error('The creator may not review their own sampled provenance request.');
  if(votes.some(vote=>vote.reviewerId===reviewerId))throw new Error('This Guild member already voted on the provenance review.');
  const outcome=ALLOWED_OUTCOMES.has(clean(input.outcome,60))?clean(input.outcome,60):'needs-human-review';
  const finding=normalizeProvenanceFinding({...input,outcome},{reviewId:request?.reviewRequest?.reviewId||input.reviewId,sampleId:request.sampleId||input.sampleId,reviewerKind:'human',reviewerId,reviewedAt:context.reviewedAt});
  const vote=Object.freeze({...finding,schema:'civweave.creator-provenance-tribunal-vote.v1',creatorExcluded:true});
  return Object.freeze({...state,schema:'civweave.creator-provenance-tribunal-state.v1',votes:Object.freeze([...votes,vote]),updatedAt:new Date().toISOString()});
}

function aggregateFinding(votes,outcome){
  const supporting=votes.filter(vote=>vote.outcome===outcome),confidence=supporting.length?supporting.reduce((sum,vote)=>sum+Number(vote.confidence||0),0)/supporting.length:0;
  return normalizeProvenanceFinding({outcome,confidence,rationale:`Independent Guild tribunal reached ${supporting.length} matching vote${supporting.length===1?'':'s'} for ${outcome}.`,findings:supporting.map(vote=>({code:'tribunal-vote',status:'supported',detail:`${vote.reviewerId}: ${clean(vote.rationale,800)}`}))},{reviewId:supporting[0]?.reviewId,sampleId:supporting[0]?.sampleId,reviewerKind:'human',reviewerId:`tribunal:${supporting.map(vote=>vote.reviewerId).sort().join(',')}`});
}

export function tribunalDecision(inputVotes=[]){
  const votes=list(inputVotes).slice(0,3),counts=new Map();
  for(const vote of votes)counts.set(vote.outcome,(counts.get(vote.outcome)||0)+1);
  const ranked=[...counts.entries()].sort((a,b)=>b[1]-a[1]||String(a[0]).localeCompare(String(b[0]))),winner=ranked[0];
  if(winner?.[1]>=2){const finding=aggregateFinding(votes,winner[0]);return Object.freeze({schema:'civweave.creator-provenance-tribunal-decision.v1',status:'reviewed',outcome:winner[0],voteCount:votes.length,requiredVotes:votes.length===1?2:votes.length,finding,originImmutable:true});}
  if(votes.length<2)return Object.freeze({schema:'civweave.creator-provenance-tribunal-decision.v1',status:'pending-human-review',outcome:'needs-human-review',voteCount:votes.length,requiredVotes:2,finding:null,originImmutable:true});
  if(votes.length<3)return Object.freeze({schema:'civweave.creator-provenance-tribunal-decision.v1',status:'pending-human-review',outcome:'needs-human-review',voteCount:votes.length,requiredVotes:3,finding:null,originImmutable:true});
  return Object.freeze({schema:'civweave.creator-provenance-tribunal-decision.v1',status:'needs-escalation',outcome:'needs-human-review',voteCount:votes.length,requiredVotes:3,finding:null,originImmutable:true});
}

export {ALLOWED_OUTCOMES};
