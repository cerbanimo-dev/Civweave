import {canonicalJson,sha256,signPayload,verifySignature} from './anarchadia-governance-kernel-v145.js';

export const CONSENSUS_SCHEMA='civweave.anarchadia-signed-consensus-round.v1';
export const CONSENSUS_POSITION_SCHEMA='civweave.anarchadia-signed-consensus-position.v1';
export const CONSENSUS_CHOICES=Object.freeze(['support','oppose','abstain','amend']);

const now=()=>new Date().toISOString();
const id=prefix=>`${prefix}-${globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
const clamp=value=>Math.min(1,Math.max(0,Number(value)||0));

function frozenElectorate(input=[]){
  const seen=new Set();
  const rows=[];
  for(const actor of input){
    const actorId=String(actor?.id||actor?.actorId||'').trim();
    if(!actorId||!actor?.publicKey)continue;
    if(seen.has(actorId))throw new Error(`Duplicate consensus credential: ${actorId}`);
    seen.add(actorId);
    rows.push(Object.freeze({
      actorId,
      label:String(actor.label||actor.name||actorId).slice(0,160),
      kind:String(actor.kind||'member').slice(0,80),
      publicKey:actor.publicKey
    }));
  }
  rows.sort((a,b)=>a.actorId.localeCompare(b.actorId));
  if(!rows.length)throw new Error('A signed consensus round requires at least one credentialed participant.');
  return Object.freeze(rows);
}

function subjectIdentity(subject={}){
  const subjectId=String(subject.id||subject.subjectId||'').trim();
  const subjectRevisionHash=String(subject.revisionHash||subject.subjectRevisionHash||'').trim();
  if(!subjectId)throw new Error('Consensus subject id is required.');
  if(!subjectRevisionHash)throw new Error('Consensus subject revision hash is required.');
  return {subjectId,subjectRevisionHash};
}

export async function openSignedConsensusRound(subject,input={}){
  const {subjectId,subjectRevisionHash}=subjectIdentity(subject);
  const electorate=frozenElectorate(input.electorate||[]);
  const snapshotHash=await sha256(canonicalJson(electorate));
  return {
    schema:CONSENSUS_SCHEMA,
    id:String(input.id||id('consensus')),
    subjectId,
    subjectRevisionHash,
    authorityLevel:String(input.authorityLevel||input.level||'unspecified').slice(0,120),
    electorate,
    snapshotHash,
    procedure:Object.freeze({quorum:clamp(input.quorum??0.6),threshold:clamp(input.threshold??0.67)}),
    choices:CONSENSUS_CHOICES,
    positions:[],
    status:'open',
    openedAt:now(),
    closedAt:null,
    outcome:null
  };
}

function positionPayload(round,actorId,choice,sequence,castAt,note=''){
  return {
    schema:CONSENSUS_POSITION_SCHEMA,
    roundId:round.id,
    subjectId:round.subjectId,
    subjectRevisionHash:round.subjectRevisionHash,
    snapshotHash:round.snapshotHash,
    authorityLevel:round.authorityLevel,
    actorId,
    choice,
    sequence,
    castAt,
    note
  };
}

export async function castSignedConsensusPosition(round,credential,privateKey,choice,note=''){
  if(round?.schema!==CONSENSUS_SCHEMA||round.status!=='open')throw new Error('This signed consensus round is not open.');
  if(!CONSENSUS_CHOICES.includes(choice))throw new Error('Unsupported consensus position.');
  const actorId=String(credential?.id||credential?.actorId||'').trim();
  const eligible=round.electorate.find(actor=>actor.actorId===actorId);
  if(!eligible)throw new Error('This credential is not in the frozen electorate.');
  if(canonicalJson(eligible.publicKey)!==canonicalJson(credential.publicKey))throw new Error('The credential key does not match the frozen electorate.');
  const prior=round.positions.find(position=>position.actorId===actorId);
  const castAt=now(),sequence=Number(prior?.sequence||0)+1;
  const cleanNote=String(note||'').slice(0,2000);
  const payload=positionPayload(round,actorId,choice,sequence,castAt,cleanNote);
  const position={...payload,publicKey:credential.publicKey,signature:await signPayload(privateKey,payload)};
  round.positions=round.positions.filter(item=>item.actorId!==actorId);
  round.positions.push(position);
  return position;
}

export async function verifySignedConsensusPosition(round,position){
  if(round?.schema!==CONSENSUS_SCHEMA||!position)return false;
  if(!CONSENSUS_CHOICES.includes(position.choice))return false;
  const eligible=round.electorate.find(actor=>actor.actorId===position.actorId);
  if(!eligible||canonicalJson(eligible.publicKey)!==canonicalJson(position.publicKey))return false;
  return verifySignature(
    position.publicKey,
    positionPayload(round,position.actorId,position.choice,position.sequence,position.castAt,position.note),
    position.signature
  );
}

export function tallySignedConsensusRound(round){
  const totals=Object.fromEntries(CONSENSUS_CHOICES.map(choice=>[choice,0]));
  for(const position of round?.positions||[])if(totals[position.choice]!==undefined)totals[position.choice]+=1;
  const eligible=round?.electorate?.length||0;
  const cast=round?.positions?.length||0;
  const remaining=Math.max(0,eligible-cast);
  const participation=eligible?cast/eligible:0;
  const decisive=totals.support+totals.oppose+totals.amend;
  const approval=decisive?totals.support/decisive:0;
  const quorum=clamp(round?.procedure?.quorum??0.6);
  const threshold=clamp(round?.procedure?.threshold??0.67);
  const quorumMet=participation>=quorum;
  const thresholdMet=approval>=threshold;
  const neededForQuorum=Math.max(0,Math.ceil(eligible*quorum)-cast);
  const denominator=1-threshold;
  const neededForThreshold=thresholdMet?0:denominator<=0?remaining+1:Math.max(0,Math.ceil((threshold*decisive-totals.support)/denominator));
  const plausible=cast<eligible&&neededForQuorum<=remaining&&neededForThreshold<=remaining;
  const outcome=quorumMet&&thresholdMet?'ready-to-adopt':cast===eligible?(quorumMet?'not-adopted':'no-quorum'):plausible?'forming':'stalled';
  return {eligible,cast,remaining,participation,approval,quorumMet,thresholdMet,neededForQuorum,neededForThreshold,plausible,totals,outcome};
}

export async function closeSignedConsensusRound(round,subject){
  if(round?.schema!==CONSENSUS_SCHEMA)throw new Error('A valid signed consensus round is required.');
  if(round.status!=='open')return round.outcome;
  const {subjectId,subjectRevisionHash}=subjectIdentity(subject);
  if(subjectId!==round.subjectId||subjectRevisionHash!==round.subjectRevisionHash)throw new Error('The consensus subject changed after this round opened.');
  for(const position of round.positions){
    if(!await verifySignedConsensusPosition(round,position))throw new Error(`Invalid consensus signature for ${position.actorId}.`);
  }
  const tally=tallySignedConsensusRound(round);
  const outcome=tally.quorumMet&&tally.thresholdMet?'adopted':tally.quorumMet?'not-adopted':'no-quorum';
  const closedAt=now();
  const outcomeHash=await sha256(canonicalJson({
    roundId:round.id,
    subjectId:round.subjectId,
    subjectRevisionHash:round.subjectRevisionHash,
    snapshotHash:round.snapshotHash,
    authorityLevel:round.authorityLevel,
    tally,
    outcome,
    closedAt
  }));
  round.status='closed';
  round.closedAt=closedAt;
  round.outcome={...tally,outcome,hash:outcomeHash};
  return round.outcome;
}
