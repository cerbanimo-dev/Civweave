import {canonicalJson,sha256} from './anarchadia-governance-kernel-v145.js';

export const TRIBUNAL_CASE_SCHEMA='civweave.anarchadia.tribunal-case.v1';
export const JURY_SUBMISSION_SCHEMA='civweave.anarchadia.jury-submission.v1';
export const JURY_REWARD_SCHEMA='civweave.anarchadia.jury-acorn-mint.v1';
export const APPEAL_SCHEMA='civweave.anarchadia.regional-appeal.v1';
export const TRIBUNAL_GOSSIP_SCHEMA='civweave.anarchadia.tribunal-gossip.v1';
export const JURY_REWARD_ACORNS=2;
export const DEFAULT_TRIBUNAL_PROCEDURE=Object.freeze({panelSize:5,quorum:0.6,guiltThreshold:0.67,secondaryReviewRate:0.15,maxElevatedSelectionsPer30Days:12});
export const DEFAULT_SANCTION_BANDS=Object.freeze({
  1:{buttonFine:0,acornRestitution:0,publicChatBanMinutes:0},
  2:{buttonFine:0,acornRestitution:0,publicChatBanMinutes:0},
  3:{buttonFine:0,acornRestitution:0,publicChatBanMinutes:0},
  4:{buttonFine:0,acornRestitution:0,publicChatBanMinutes:0}
});
const now=()=>new Date().toISOString();
const uid=p=>`${p}-${globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,Number(v)||0));
const clean=(v,n=4000)=>String(v??'').trim().slice(0,n);
const clone=v=>globalThis.structuredClone?structuredClone(v):JSON.parse(JSON.stringify(v));
const secureRandom=()=>{try{const a=new Uint32Array(1);globalThis.crypto?.getRandomValues?.(a);if(a[0]||globalThis.crypto?.getRandomValues)return a[0]/4294967296}catch{}return Math.random()};

export function newJurorProfile(actorId,input={}){return {actorId:String(actorId),baselineWeight:1,selectionBonus:Math.max(0,Number(input.selectionBonus||0)),validatedReviews:Math.max(0,Number(input.validatedReviews||0)),failedReviews:Math.max(0,Number(input.failedReviews||0)),servedAt:Array.isArray(input.servedAt)?input.servedAt:[],dismissedAt:Array.isArray(input.dismissedAt)?input.dismissedAt:[]}}
export function jurorSelectionWeight(profile){return Math.max(1,Number(profile?.baselineWeight||1)+Math.max(0,Number(profile?.selectionBonus||0)))}
export function dismissJuryInvitation(profile,at=now()){const next=clone(profile);next.dismissedAt=[...(next.dismissedAt||[]),at].slice(-50);next.selectionBonus=Math.max(0,Number(next.selectionBonus||0)-1);return next}
export function recordJurorReview(profile,{valid=true,at=now()}={}){const next=clone(profile);if(valid){next.validatedReviews=Number(next.validatedReviews||0)+1;next.selectionBonus=Math.min(4,Number(next.selectionBonus||0)+0.25)}else{next.failedReviews=Number(next.failedReviews||0)+1;next.selectionBonus=Math.max(0,Number(next.selectionBonus||0)-1)}next.lastReviewedAt=at;return next}
function servedRecently(profile,days=30){const since=Date.now()-days*86400000;return (profile.servedAt||[]).filter(x=>Date.parse(x)>=since).length}
function weightedPick(rows,rng){let total=rows.reduce((s,x)=>s+x.weight,0),r=rng()*total;for(const row of rows){r-=row.weight;if(r<=0)return row}return rows.at(-1)}
export function selectRandomJury(candidates,{panelSize=DEFAULT_TRIBUNAL_PROCEDURE.panelSize,excludeActorIds=[],rng=secureRandom,maxElevatedSelectionsPer30Days=DEFAULT_TRIBUNAL_PROCEDURE.maxElevatedSelectionsPer30Days}={}){
  const excluded=new Set(excludeActorIds.map(String)),pool=[];
  for(const c of candidates||[]){const actorId=String(c.actorId||c.id||'');if(!actorId||excluded.has(actorId))continue;const profile=c.profile||newJurorProfile(actorId);const capHit=servedRecently(profile)>=maxElevatedSelectionsPer30Days;pool.push({actorId,profile,weight:capHit?1:jurorSelectionWeight(profile)})}
  const out=[];while(pool.length&&out.length<panelSize){const picked=weightedPick(pool,rng);out.push(picked);pool.splice(pool.indexOf(picked),1)}return out;
}

export async function openTribunalCase(input={}){
  if(!input.assessment?.tribunalEligible)throw new Error('A classifier may open a tribunal only after the configured accusation threshold is crossed.');
  const evidence=(input.evidence||[]).map(x=>({id:String(x.id||uid('evidence')),kind:clean(x.kind||'message',80),hash:clean(x.hash,180),contextHash:clean(x.contextHash,180)||null,access:'tribunal-only'}));
  const caseRecord={schema:TRIBUNAL_CASE_SCHEMA,id:input.id||uid('tribunal'),accusedActorId:clean(input.accusedActorId,180),affectedActorIds:[...new Set((input.affectedActorIds||[]).map(String))],regionId:clean(input.regionId||'local',180),charge:'hate-speech',assessment:{confidence:Number(input.assessment.confidence),threshold:Number(input.assessment.threshold),matchedEntryIds:(input.assessment.matches||[]).map(x=>x.id)},evidence,procedure:{...DEFAULT_TRIBUNAL_PROCEDURE,...input.procedure},status:'jury-selection',jury:[],submissions:[],outcome:null,rewards:[],appeals:[],openedAt:now(),updatedAt:now()};
  caseRecord.caseHash=await sha256(canonicalJson({...caseRecord,caseHash:undefined}));return caseRecord;
}
export function assignJury(caseRecord,candidates,{rng=secureRandom}={}){
  if(caseRecord.status!=='jury-selection')throw new Error('Case is not selecting a jury.');
  const selected=selectRandomJury(candidates,{panelSize:caseRecord.procedure.panelSize,excludeActorIds:[caseRecord.accusedActorId,...caseRecord.affectedActorIds],rng,maxElevatedSelectionsPer30Days:caseRecord.procedure.maxElevatedSelectionsPer30Days});
  if(selected.length<Math.ceil(caseRecord.procedure.panelSize*caseRecord.procedure.quorum))throw new Error('Not enough conflict-free jurors to satisfy quorum.');
  caseRecord.jury=selected.map(x=>({actorId:x.actorId,assignedAt:now(),status:'assigned',selectionWeight:x.weight}));caseRecord.status='deliberating';caseRecord.updatedAt=now();return caseRecord.jury;
}
export async function submitJuryVerdict(caseRecord,input={}){
  if(caseRecord.status!=='deliberating')throw new Error('Case is not deliberating.');
  const juror=caseRecord.jury.find(x=>x.actorId===input.actorId);if(!juror)throw new Error('Actor is not assigned to this jury.');
  const verdict=['guilty','not-guilty','abstain'].includes(input.verdict)?input.verdict:null;if(!verdict)throw new Error('Unsupported tribunal verdict.');
  const explanation=clean(input.explanation,8000),evidenceRefs=[...new Set((input.evidenceRefs||[]).map(String))].filter(id=>caseRecord.evidence.some(x=>x.id===id));
  const structurallyValid=verdict==='abstain'||(explanation.length>=40&&evidenceRefs.length>0);if(!structurallyValid)throw new Error('A decisive verdict requires a reasoned explanation and at least one case evidence reference.');
  const severity=verdict==='guilty'?Math.max(1,Math.min(4,Math.round(Number(input.severity||1)))):0;
  const submission={schema:JURY_SUBMISSION_SCHEMA,id:uid('jury'),caseId:caseRecord.id,caseHash:caseRecord.caseHash,actorId:String(input.actorId),verdict,severity,explanation,evidenceRefs,submittedAt:now(),validation:{structurallyValid:true,secondaryReview:'not-selected',rewardEligible:false}};
  caseRecord.submissions=caseRecord.submissions.filter(x=>x.actorId!==submission.actorId);caseRecord.submissions.push(submission);juror.status='submitted';caseRecord.updatedAt=now();return submission;
}
export function tallyTribunal(caseRecord){
  const decisive=caseRecord.submissions.filter(x=>x.verdict!=='abstain'),guilty=decisive.filter(x=>x.verdict==='guilty'),cast=caseRecord.submissions.length,eligible=caseRecord.jury.length,participation=eligible?cast/eligible:0,guiltRatio=decisive.length?guilty.length/decisive.length:0;
  const quorumMet=participation>=caseRecord.procedure.quorum,thresholdMet=guiltRatio>=caseRecord.procedure.guiltThreshold;
  const severity=guilty.length?Math.max(1,Math.min(4,Math.round(guilty.reduce((s,x)=>s+x.severity,0)/guilty.length))):0;
  return {eligible,cast,decisive:decisive.length,guilty:guilty.length,participation,guiltRatio,quorumMet,thresholdMet,severity,outcome:quorumMet?(thresholdMet?'guilty':'not-guilty'):'no-quorum'};
}
function randomAudit(rate,rng){return rng()<clamp(rate)}
export async function closeTribunal(caseRecord,{rng=secureRandom,secondaryReviewRate=caseRecord.procedure.secondaryReviewRate??DEFAULT_TRIBUNAL_PROCEDURE.secondaryReviewRate,sanctionBands=DEFAULT_SANCTION_BANDS}={}){
  if(caseRecord.status!=='deliberating')return caseRecord.outcome;const tally=tallyTribunal(caseRecord);if(!tally.quorumMet)throw new Error('Tribunal quorum has not been reached.');
  const closedAt=now(),outcomeHash=await sha256(canonicalJson({caseId:caseRecord.id,caseHash:caseRecord.caseHash,tally,closedAt}));
  for(const submission of caseRecord.submissions){const audit=randomAudit(secondaryReviewRate+(submission.verdict!=='abstain'&&submission.verdict!==tally.outcome?0.10:0),rng);submission.validation.rewardEligible=true;submission.validation.secondaryReview=audit?'pending':'not-selected';submission.validation.outcomeHash=outcomeHash}
  const sanctions=tally.outcome==='guilty'?clone(sanctionBands[tally.severity]||sanctionBands[1]):{buttonFine:0,acornRestitution:0,publicChatBanMinutes:0};
  caseRecord.status=tally.outcome==='guilty'?'guilty':'closed';caseRecord.closedAt=closedAt;caseRecord.outcome={...tally,hash:outcomeHash,sanctions};caseRecord.updatedAt=closedAt;return caseRecord.outcome;
}
export function validateSecondaryReview(caseRecord,actorId,{valid,reviewerActorId,note=''}={}){const s=caseRecord.submissions.find(x=>x.actorId===actorId);if(!s||s.validation.secondaryReview!=='pending')throw new Error('No pending secondary review for this juror.');s.validation.secondaryReview=valid?'validated':'rejected';s.validation.reviewedBy=String(reviewerActorId||'human-reviewer');s.validation.reviewNote=clean(note,2000);s.validation.reviewedAt=now();s.validation.rewardEligible=Boolean(valid);return s.validation}
export async function mintReadyJuryRewards(caseRecord,{accountForActor=id=>`passport:${id}`,ledger=globalThis.CivweaveCanonicalRewardsV2||null}={}){
  if(!caseRecord.outcome)throw new Error('Close the tribunal before minting jury rewards.');const minted=[];
  for(const s of caseRecord.submissions){
    if(!s.validation.rewardEligible||s.validation.secondaryReview==='pending'||s.validation.secondaryReview==='rejected')continue;
    if(caseRecord.rewards.some(x=>x.actorId===s.actorId))continue;
    const reward={schema:JURY_REWARD_SCHEMA,id:uid('jury-reward'),caseId:caseRecord.id,actorId:s.actorId,amount:JURY_REWARD_ACORNS,asset:'acorn',operation:'mint',reason:'tribunal_jury_reward',outcomeHash:caseRecord.outcome.hash,createdAt:now()};
    if(ledger?.appendEntry){await ledger.appendEntry({accountId:accountForActor(s.actorId),assetType:'acorn',amount:JURY_REWARD_ACORNS,sourceSystem:'anarchadia',sourceKind:'validation',sourceId:caseRecord.id,sourceKey:`tribunal:${caseRecord.id}:juror:${s.actorId}`,evidenceHash:caseRecord.outcome.hash,validatorIds:[s.actorId],metadata:{operation:'mint',reason:'tribunal_jury_reward',jurySubmissionId:s.id}});reward.ledgerSettled=true}else reward.ledgerSettled=false;
    caseRecord.rewards.push(reward);minted.push(reward);
  }
  return minted;
}
export function createSanctionEvents(caseRecord){if(caseRecord.outcome?.outcome!=='guilty')return [];const s=caseRecord.outcome.sanctions||{},events=[];if(s.buttonFine>0)events.push({kind:'button-fine',actorId:caseRecord.accusedActorId,amount:s.buttonFine});if(s.acornRestitution>0)events.push({kind:'acorn-restitution',from:'system-mint',toActorIds:caseRecord.affectedActorIds,amount:s.acornRestitution});if(s.publicChatBanMinutes>0)events.push({kind:'public-chat-restriction',actorId:caseRecord.accusedActorId,until:new Date(Date.now()+s.publicChatBanMinutes*60000).toISOString()});return events}
export async function createRegionalAppeal(caseRecord,{appellantActorId,regionId,reason}={}){if(!caseRecord.outcome)throw new Error('Only a decided case can be appealed.');const appeal={schema:APPEAL_SCHEMA,id:uid('appeal'),caseId:caseRecord.id,priorOutcomeHash:caseRecord.outcome.hash,appellantActorId:String(appellantActorId||caseRecord.accusedActorId),regionId:String(regionId||caseRecord.regionId),reason:clean(reason,8000),excludeJurorIds:caseRecord.jury.map(x=>x.actorId),status:'jury-selection',createdAt:now()};appeal.appealHash=await sha256(canonicalJson({...appeal,appealHash:undefined}));caseRecord.appeals.push(appeal);return appeal}
export function tribunalGossipEnvelope(caseRecord){return {schema:TRIBUNAL_GOSSIP_SCHEMA,id:`gossip:${caseRecord.id}`,caseId:caseRecord.id,caseHash:caseRecord.caseHash,regionId:caseRecord.regionId,status:caseRecord.status,charge:caseRecord.charge,assessment:{confidence:caseRecord.assessment.confidence,threshold:caseRecord.assessment.threshold},evidence:caseRecord.evidence.map(x=>({id:x.id,hash:x.hash,contextHash:x.contextHash,access:'tribunal-only'})),juryActorIds:caseRecord.jury.map(x=>x.actorId),outcome:caseRecord.outcome?{outcome:caseRecord.outcome.outcome,severity:caseRecord.outcome.severity,hash:caseRecord.outcome.hash}:null,appealIds:caseRecord.appeals.map(x=>x.id),updatedAt:caseRecord.updatedAt,rawAbusiveContentIncluded:false}}
export async function publishTribunalToMesh(caseRecord,{mesh=globalThis.CivweaveObjectMeshV146||null,consent='federated'}={}){const payload=tribunalGossipEnvelope(caseRecord);if(!mesh?.createObject)return {published:false,payload};const object=await mesh.createObject({kind:'anarchadia.tribunal-event',purpose:'federated tribunal status and hash gossip',consent,payload,priority:75});return {published:true,payload,object}}
