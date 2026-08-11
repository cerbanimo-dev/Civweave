/* confidence-weighted-validation-v1 */
(()=>{
'use strict';
if(globalThis.CivweaveValidationConfidenceV1)return;
const VERSION='civweave.validation-confidence.v1';
const POLICY=Object.freeze({
  passThreshold:.88,
  failThreshold:.12,
  minEvidenceFamilies:2,
  contributionScale:2.2,
  maxExpressedConfidence:.95,
  minMaterialContribution:.05,
  minCrossDeviceContribution:.18,
  weights:Object.freeze({
    'deterministic-test':.98,
    'deterministic-rubric':.92,
    'artifact-inspection':.84,
    'human-review':.88,
    'model-rubric':.80,
    'semantic-model':.74,
    'peer-model':.76,
    unknown:.55,
  }),
});
const clamp01=value=>Math.max(0,Math.min(1,Number(value)||0));
const sigmoid=value=>1/(1+Math.exp(-value));
const clean=value=>String(value??'').trim();
const familyFor=evidence=>{
  const explicit=clean(evidence.family||evidence.evidenceFamily).toLowerCase();
  if(explicit)return explicit;
  const provenance=clean(evidence.provenance||evidence.authority||evidence.type).toLowerCase();
  if(/deterministic.*test|objective|unit|integration|test-result/.test(provenance))return'deterministic-test';
  if(/deterministic.*rubric|rubric-assisted|rubric/.test(provenance)&&!/model/.test(provenance))return'deterministic-rubric';
  if(/artifact|evidence-check|proof|inspection/.test(provenance))return'artifact-inspection';
  if(/human|witness|manual-review/.test(provenance))return'human-review';
  if(/model.*rubric|rubric.*model/.test(provenance))return'model-rubric';
  if(/peer/.test(provenance)&&/model|ai/.test(provenance))return'peer-model';
  if(/model|ai|gemini|openai|ollama|local-model/.test(provenance))return'semantic-model';
  return'unknown';
};
const weightFor=(evidence,policy=POLICY)=>policy.weights[familyFor(evidence)]??policy.weights.unknown;
function normalizedScore(value){
  const score=Number(value);
  if(!Number.isFinite(score))return null;
  return clamp01(score>1?score/100:score);
}
function calibrationFor(evidence){
  const explicit=Number(evidence.calibrationWeight??evidence.sourceReliability??evidence.reliability);
  return Number.isFinite(explicit)?Math.max(.2,Math.min(1,explicit)):1;
}
function rubricStrength(evidence){
  const score=normalizedScore(evidence.rubricScore??evidence.score);
  const threshold=normalizedScore(evidence.rubricThreshold??evidence.threshold);
  if(score===null)return .55;
  const target=threshold===null?.6:threshold;
  const span=Math.max(.001,target,1-target);
  const distance=Math.abs(score-target)/span;
  const margin=Math.tanh(3.5*distance);
  const stated=String(evidence.verdict||evidence.decision||'').toLowerCase();
  const scoreDirection=score>=target?'pass':'fail';
  const consistent=!stated||stated===scoreDirection||stated==='accepted'&&scoreDirection==='pass'||stated==='rejected'&&scoreDirection==='fail';
  return (.2+.8*margin)*(consistent?1:.2);
}
function verdictSign(evidence){
  const verdict=String(evidence.verdict||evidence.decision||'').toLowerCase();
  if(evidence.pass===true||['pass','accepted','approve','approved','verified-pass'].includes(verdict))return 1;
  if(evidence.pass===false||['fail','rejected','reject','denied','verified-fail'].includes(verdict))return -1;
  const score=normalizedScore(evidence.rubricScore??evidence.score);
  const threshold=normalizedScore(evidence.rubricThreshold??evidence.threshold)??.6;
  if(score!==null)return score>=threshold?1:-1;
  return 0;
}
function aggregate(evidenceRows=[],options={}){
  const policy={...POLICY,...(options.policy||{}),weights:{...POLICY.weights,...(options.policy?.weights||{})}};
  const contributorDeviceId=clean(options.contributorDeviceId);
  const seenPrincipals=new Set(),familyCounts=new Map(),deviceCounts=new Map(),groupCounts=new Map(),families=new Set(),positiveDevices=new Set();
  const contributions=[];
  let signedEvidence=0;
  for(const [index,raw] of (Array.isArray(evidenceRows)?evidenceRows:[]).entries()){
    const evidence=raw&&typeof raw==='object'?raw:{};
    const sign=verdictSign(evidence);
    if(!sign)continue;
    const principal=clean(evidence.validatorId||evidence.identityId||evidence.principalId||evidence.sourceId||`anonymous:${index}`);
    const family=familyFor(evidence),deviceId=clean(evidence.deviceId||evidence.validatorDeviceId||evidence.originDeviceId),correlationId=clean(evidence.correlationId||evidence.sourceGroup||evidence.dependencyGroup);
    const duplicatePrincipal=principal&&!principal.startsWith('anonymous:')&&seenPrincipals.has(principal);
    if(principal&&!principal.startsWith('anonymous:'))seenPrincipals.add(principal);
    const sameFamily=familyCounts.get(family)||0,sameDevice=deviceId?(deviceCounts.get(deviceId)||0):0,sameGroup=correlationId?(groupCounts.get(correlationId)||0):0;
    familyCounts.set(family,sameFamily+1);if(deviceId)deviceCounts.set(deviceId,sameDevice+1);if(correlationId)groupCounts.set(correlationId,sameGroup+1);
    const expressed=Math.max(.05,Math.min(policy.maxExpressedConfidence,Number(evidence.confidence??evidence.expressedConfidence??.65)||.65));
    const provenanceWeight=weightFor(evidence,policy),calibrationWeight=calibrationFor(evidence);
    const margin=rubricStrength(evidence);
    const independence=duplicatePrincipal?0:(1/(1+.45*sameFamily))*(deviceId?1/(1+.25*sameDevice):.92)*(correlationId?1/(1+.35*sameGroup):1);
    const contribution=sign*provenanceWeight*calibrationWeight*expressed*margin*independence;
    if(Math.abs(contribution)>=policy.minMaterialContribution)families.add(family);
    if(sign>0&&deviceId&&contribution>=policy.minCrossDeviceContribution)positiveDevices.add(deviceId);
    signedEvidence+=contribution;
    contributions.push({
      id:clean(evidence.id)||`evidence:${index+1}`,family,principal:principal||null,deviceId:deviceId||null,correlationId:correlationId||null,verdict:sign>0?'pass':'fail',
      provider:clean(evidence.provider)||null,model:clean(evidence.model)||null,provenance:clean(evidence.provenance||evidence.authority||evidence.type)||null,
      provenanceWeight:Number(provenanceWeight.toFixed(4)),calibrationWeight:Number(calibrationWeight.toFixed(4)),expressedConfidence:Number(expressed.toFixed(4)),rubricStrength:Number(margin.toFixed(4)),
      independence:Number(independence.toFixed(4)),contribution:Number(contribution.toFixed(6)),duplicatePrincipal,
    });
  }
  const passConfidence=clamp01(sigmoid(signedEvidence*policy.contributionScale));
  const diversity={families:[...families],familyCount:families.size,required:policy.minEvidenceFamilies,satisfied:families.size>=policy.minEvidenceFamilies};
  const verifiedPass=passConfidence>=policy.passThreshold&&diversity.satisfied;
  const verifiedFail=passConfidence<=policy.failThreshold&&diversity.satisfied;
  const decision=verifiedPass?'verified-pass':verifiedFail?'verified-fail':passConfidence>=.5?'provisional-pass':'provisional-fail';
  const crossDeviceSatisfied=contributorDeviceId?([...positiveDevices].some(id=>id!==contributorDeviceId)):false;
  return{
    schema:VERSION,decision,passConfidence:Number(passConfidence.toFixed(6)),failConfidence:Number((1-passConfidence).toFixed(6)),
    signedEvidence:Number(signedEvidence.toFixed(6)),verifiedPass,verifiedFail,diversity,crossDeviceSatisfied,
    contributorDeviceId:contributorDeviceId||null,positiveDeviceIds:[...positiveDevices],contributions,
  };
}
function payoutEligibility(result,{requireCrossDevice=true}={}){
  const validation=result||{};
  return{claimVerified:Boolean(validation.verifiedPass),crossDeviceSatisfied:Boolean(validation.crossDeviceSatisfied),eligible:Boolean(validation.verifiedPass&&(!requireCrossDevice||validation.crossDeviceSatisfied))};
}
globalThis.CivweaveValidationConfidenceV1=Object.freeze({VERSION,POLICY,aggregate,payoutEligibility,familyFor,rubricStrength,verdictSign,calibrationFor});
})();
(()=>{
'use strict';
const VERSION='1.0.4-v156-post-pr56';
const KEYS={
  campus:'civweave.working-campus.v1',intentions:'civweave.intentions.v127',inbox:'civweave.realm-inbox.v1',
  domain:'civweave.domain.v156',rewards:'civweave.rewards.v156',living:'civweave.living-school.cabinet.v151',
  cerbanimo:'cerbanimo.quest-engine.v144',fellowfare:'fellowfare.mvp.state.v3',
  cerbanimoReviews:'cerbanimo.ai-reviews.v156',peerReviews:'civweave.cerbanimo.peer-reviews.v156'
};
const SCHEMAS={domain:'civweave.domain.v156',learning:'civweave.learning-request.v156',task:'civweave.task-request.v156',materials:'civweave.materials-request.v156',passport:'civweave.passport.v156',rewardLedger:'civweave.reward-ledger.v156',rewardEvent:'civweave.reward-event.v156',peerReview:'civweave.peer-ai-review.v156'};
const SOURCE_KEYS=new Set([KEYS.campus,KEYS.intentions,KEYS.living,KEYS.cerbanimo,KEYS.fellowfare]);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const read=(key,fallback)=>parse(localStorage.getItem(key),fallback);
const write=(key,value)=>(localStorage.setItem(key,JSON.stringify(value)),value);
const list=value=>Array.isArray(value)?value:[];
const clean=(value,max=5000)=>String(value??'').trim().slice(0,max);
const now=()=>new Date().toISOString();
const hash=text=>{let h=2166136261;for(const c of String(text))h=(h^c.charCodeAt(0))*16777619>>>0;return h.toString(36)};
function event(type,detail={}){try{dispatchEvent(new CustomEvent(type,{detail:{...detail,at:now(),version:VERSION}}))}catch{}}
function planFromCampus(){const campus=read(KEYS.campus,null);if(campus?.plan)return campus.plan;const active=list(read(KEYS.intentions,[])).find(item=>item?.state==='active'||item?.plan?.state==='active');return active?.plan||null}
function profileFromCampus(){const campus=read(KEYS.campus,{}),profile=campus.profile||{};return{
  aptitude:profile.skillLevel||profile.aptitude||campus.skillLevel||campus.aptitude||'not specified',
  learningMode:profile.learningMode||campus.learningMode||'guided',
  collaborationMode:profile.collaborationMode||profile.collaboration||campus.collaborationMode||'solo or unspecified',
  weeklyHours:profile.weeklyHours||campus.weeklyHours||'not specified',
  constraints:clean(profile.constraints||campus.constraints||'',3000)
}}
function pathFor(plan,realm){return list(plan?.paths).find(path=>path?.realm===realm)||null}
function normalizeRequest(plan,realm,kind){const path=pathFor(plan,realm);if(!path)return null;return{
  schema:SCHEMAS[kind],id:`${kind}:${plan.id||hash(plan.title)}:${hash(path.title||realm)}`,intentionId:plan.id,
  source:'working-campus-v156',realm,title:clean(path.title||plan.title,240),purpose:clean(path.purpose||plan.outcome||plan.wish,3000),
  steps:list(path.steps).map(step=>clean(step,600)).filter(Boolean),completionCriteria:clean(path.completionCriteria||plan.completionCriteria,2000),
  evidence:list(path.evidence).map(item=>clean(item,500)).filter(Boolean),learnerProfile:profileFromCampus(),state:plan.state||'review',
  updatedAt:plan.updatedAt||plan.activatedAt||plan.createdAt||null
}}
function canonicalSnapshot(){const plan=planFromCampus();if(!plan)return{schema:SCHEMAS.domain,version:VERSION,activeIntentionId:null,intentions:[],requests:{learning:[],tasks:[],materials:[]},passport:null,updatedAt:null};const learning=normalizeRequest(plan,'living-school','learning'),tasks=normalizeRequest(plan,'cerbanimo','task'),materials=normalizeRequest(plan,'fellowfare','materials'),updatedAt=plan.updatedAt||plan.activatedAt||plan.createdAt||null;return{
  schema:SCHEMAS.domain,version:VERSION,activeIntentionId:plan.id,
  intentions:[{id:plan.id,title:clean(plan.title,240),wish:clean(plan.wish,4000),outcome:clean(plan.outcome,4000),state:plan.state||'review',profile:profileFromCampus(),governance:plan.governance||null,updatedAt}],
  requests:{learning:learning?[learning]:[],tasks:tasks?[tasks]:[],materials:materials?[materials]:[]},
  passport:{schema:SCHEMAS.passport,intentionId:plan.id,consent:plan.governance?.consent||'review required',constraints:profileFromCampus().constraints,paths:list(plan.paths).map(path=>({realm:path.realm,title:path.title,state:path.state||'ready'}))},updatedAt
}}
function syncCampus(){const next=canonicalSnapshot(),before=read(KEYS.domain,null);if(JSON.stringify(before)!==JSON.stringify(next)){write(KEYS.domain,next);event('civweave:domain-synced',{snapshot:next})}return next}
function rewardId(system,source,currency,skill=''){return `reward:${system}:${source}:${currency}:${hash(skill)}`}
function rewardLedger(){const value=read(KEYS.rewards,{schema:SCHEMAS.rewardLedger,events:[]});value.schema=SCHEMAS.rewardLedger;value.events=list(value.events);return value}
function appendReward(input){const ledger=rewardLedger(),row={schema:SCHEMAS.rewardEvent,id:input.id||rewardId(input.system,input.sourceId,input.currency,input.skill),system:input.system,sourceId:input.sourceId,currency:input.currency,amount:Number(input.amount)||0,skill:clean(input.skill,180)||null,validator:input.validator||null,phase:input.phase||null,createdAt:input.createdAt||now()};if(row.amount<=0||ledger.events.some(item=>item.id===row.id))return null;ledger.events.push(row);ledger.updatedAt=now();write(KEYS.rewards,ledger);event('civweave:rewards-changed',{event:row,balances:balances(ledger.events)});return row}
function balances(events=rewardLedger().events){const out={acorns:0,buttons:0,cotokens:0,xp:{}};for(const row of events){const amount=Number(row.amount)||0;if(row.currency==='xp')out.xp[row.skill||'general']=(out.xp[row.skill||'general']||0)+amount;else if(row.currency==='acorn')out.acorns+=amount;else if(row.currency==='button')out.buttons+=amount;else if(row.currency==='cotoken')out.cotokens+=amount}return out}
function reviewStore(){const value=read(KEYS.cerbanimoReviews,{schema:'cerbanimo.ai-review-store.v156',byTask:{}});value.byTask=value.byTask&&typeof value.byTask==='object'?value.byTask:{};return value}
function reviewKey(questId,taskId){return `${questId}:${taskId}`}
function captureReviewMetadata(state){const store=reviewStore();let changed=false;for(const quest of list(state?.quests))for(const task of list(quest?.tasks)){const review=task?.review;if(!review||!review.validator&&!review.provider&&!review.requestId)continue;const key=reviewKey(quest.id,task.id),next={...(store.byTask[key]||{}),...review,questId:quest.id,taskId:task.id,capturedAt:now()};if(JSON.stringify(store.byTask[key])!==JSON.stringify(next)){store.byTask[key]=next;changed=true}}if(changed){store.updatedAt=now();write(KEYS.cerbanimoReviews,store)}return changed}
function mergeReviewMetadata(state){const store=reviewStore();for(const quest of list(state?.quests))for(const task of list(quest?.tasks)){const saved=store.byTask[reviewKey(quest.id,task.id)];if(saved)task.review={...(task.review||{}),...saved}}return state}
function validationConfidenceApi(){const api=globalThis.CivweaveValidationConfidenceV1;if(!api)throw new Error('Weighted validation confidence runtime is unavailable.');return api}
function reviewVerdict(review={}){if(review.state==='accepted'||review.decision==='pass'||review.pass===true||review.accepted===true)return'pass';if(review.state==='rejected'||review.decision==='fail'||review.pass===false||review.accepted===false)return'fail';return''}
function reviewEvidenceFamily(review={},peer=false){const explicit=clean(review.evidenceFamily||'',80);if(explicit)return explicit;const authority=clean(review.authority||review.provenance||'',120).toLowerCase(),provider=clean(review.provider||'',80).toLowerCase();if(/deterministic.*test|unit|integration/.test(authority))return'deterministic-test';if(/deterministic|rubric-assisted/.test(authority)||provider==='deterministic')return'deterministic-rubric';if(/rubric/.test(authority))return'model-rubric';return peer?'peer-model':'semantic-model'}
function reviewEvidenceEligible(review={}){const verdict=reviewVerdict(review);if(!verdict)return false;const authority=clean(review.authority||review.provenance||'',120).toLowerCase(),provider=clean(review.provider||'',80).toLowerCase(),hasRequest=Boolean(review.requestId),deterministic=/deterministic|rubric|test/.test(authority)||provider==='deterministic';if(review.fallbackUsed&&!deterministic)return false;return deterministic||hasRequest&&Boolean(provider)&&!['bundled','reflex','manual'].includes(provider)}
function taskProofItems(task={}){return[...list(task.proofs),...list(task.evidence),...list(task.artifacts),...list(task.receipts),...list(task.submissions)]}
function taskValidationStatus(quest,task){const store=peerReviewStore(),key=reviewKey(quest.id,task.id),rows=list(store.byTask[key]),localId=clean(store.localDeviceId,200),evidence=[];if(reviewEvidenceEligible(task.review||{})){const review=task.review||{},verdict=reviewVerdict(review);evidence.push({id:`local-review:${key}`,validatorId:`local-review:${clean(review.requestId||key,180)}`,deviceId:localId,family:reviewEvidenceFamily(review,false),provenance:review.authority||review.provenance||review.provider||'local-model-review',provider:review.provider,model:review.model,verdict,confidence:Number(review.confidence)||.65,score:Number(review.score??review.rubricScore??(verdict==='pass'?1:0)),threshold:Number(review.rubricThreshold??review.threshold??.6),calibrationWeight:review.calibrationWeight??review.sourceReliability,correlationId:clean(review.requestId||key,180)})}if(taskProofItems(task).length)evidence.push({id:`task-artifact:${key}`,validatorId:`task-artifact:${key}`,deviceId:localId,family:'artifact-inspection',provenance:'task-proof-artifact',verdict:'pass',confidence:.9,score:1,threshold:.6,calibrationWeight:.9,correlationId:`artifact:${key}`});for(const row of rows)evidence.push({id:row.objectId||`peer:${row.validatorId}`,validatorId:row.validatorId,deviceId:row.deviceId||row.validatorId,family:row.evidenceFamily||reviewEvidenceFamily(row,true),provenance:row.authority||row.provenance||'peer-model-validation',provider:row.provider,model:row.model,verdict:row.verdict||(row.pass?'pass':'fail'),confidence:Number(row.confidence)||.65,score:Number(row.score??row.rubricScore??(row.pass?1:0)),threshold:Number(row.rubricThreshold??.6),calibrationWeight:row.calibrationWeight??row.sourceReliability,correlationId:row.requestId||row.objectId});return validationConfidenceApi().aggregate(evidence,{contributorDeviceId:localId})}
function livingValidationFor(module,progress){if(progress?.validationConfidence?.schema==='civweave.validation-confidence.v1')return progress.validationConfidence;const latest=list(progress?.attempts).slice(-1)[0];if(!latest)return null;const evidence=[];for(const result of list(latest.results))evidence.push({id:`living:${module.id}:${result.questionId}`,validatorId:`living:${module.id}:${result.questionId}`,family:result.authority==='deterministic-test'?'deterministic-test':/model/.test(String(result.authority||''))?'model-rubric':'deterministic-rubric',provenance:result.authority||'deterministic-rubric',verdict:result.passed?'pass':'fail',confidence:Number(result.confidence)||.8,score:Number(result.score||0)/100,threshold:Number(result.rubricThreshold??.6),correlationId:latest.id});if(progress.lessonComplete&&progress.note)evidence.push({id:`living-note:${module.id}`,validatorId:`living-note:${module.id}`,family:'artifact-inspection',provenance:'learner-lesson-artifact',verdict:'pass',confidence:.82,score:1,threshold:.6,correlationId:`lesson:${module.id}`});return validationConfidenceApi().aggregate(evidence)}
function qualifiedProvider(review={}){return reviewVerdict(review)==='pass'&&reviewEvidenceEligible(review)}
function taskSkills(quest,task){const skills=list(task.skillTags||task.skills||quest.skillTags||quest.skills).map(value=>clean(value,180)).filter(Boolean);return skills.length?skills:['skilled labor']}
function peerReviewStore(){const value=read(KEYS.peerReviews,{schema:'civweave.peer-ai-review-store.v156',byTask:{}});value.byTask=value.byTask&&typeof value.byTask==='object'?value.byTask:{};return value}
function peerReviewStatus(questId,taskId){const rows=list(peerReviewStore().byTask[reviewKey(questId,taskId)]),validators=new Set(rows.filter(row=>row.pass).map(row=>row.validatorId)),result=validationConfidenceApi().aggregate(rows.map(row=>({id:row.objectId,validatorId:row.validatorId,deviceId:row.deviceId||row.validatorId,family:row.evidenceFamily||reviewEvidenceFamily(row,true),provenance:row.authority||row.provenance||'peer-model-validation',provider:row.provider,model:row.model,verdict:row.verdict||(row.pass?'pass':'fail'),confidence:row.confidence,score:row.score??row.rubricScore??(row.pass?1:0),threshold:row.rubricThreshold??.6,calibrationWeight:row.calibrationWeight??row.sourceReliability,correlationId:row.requestId||row.objectId})));return{reviews:rows,passingValidators:[...validators],passingCount:validators.size,threshold:'weighted-confidence',qualified:result.verifiedPass,validation:result}}
async function localDeviceId(){try{return await globalThis.CivweaveLocalMeshV146?.deviceId?.()||''}catch{return''}}
async function recordPeerReview(object){const payload=object?.payload||object||{},validation=payload.validation||{},verdict=validation.pass===true||validation.decision==='pass'?'pass':validation.pass===false||validation.decision==='fail'?'fail':'';if(!verdict)return{accepted:false,reason:'peer review has no pass/fail verdict'};const questId=clean(payload.projectId||payload.questId,160),taskId=clean(payload.taskId,160),validatorId=clean(payload.validatorId||object?.origin?.nodeId,200),originId=clean(object?.origin?.nodeId,200);if(!questId||!taskId||!validatorId)return{accepted:false,reason:'peer review identity is incomplete'};if(originId&&originId!==validatorId)return{accepted:false,reason:'validator identity does not match the signed object origin'};const localId=await localDeviceId();if(localId&&validatorId===localId)return{accepted:false,reason:'local self-review is not a peer review'};const provider=clean(validation.provider||payload.provider,80).toLowerCase(),authority=clean(validation.authority||validation.provenance||payload.authority||'',120).toLowerCase(),deterministic=/deterministic|rubric|test/.test(authority)||provider==='deterministic';if(validation.fallbackUsed&&!deterministic)return{accepted:false,reason:'peer review used an unqualified fallback'};if(!deterministic&&['','bundled','reflex','manual'].includes(provider))return{accepted:false,reason:'peer review provenance is not independently evaluable'};const store=peerReviewStore(),key=reviewKey(questId,taskId),rows=list(store.byTask[key]);if(rows.some(row=>row.validatorId===validatorId||row.objectId===object?.id))return{accepted:false,reason:'duplicate peer review',status:peerReviewStatus(questId,taskId)};store.localDeviceId=localId||store.localDeviceId||'';rows.push({schema:SCHEMAS.peerReview,objectId:object?.id||`peer:${validatorId}:${Date.now()}`,questId,taskId,validatorId,deviceId:originId||validatorId,provider,model:clean(validation.model||payload.model,120),requestId:clean(validation.requestId||payload.requestId,180),pass:verdict==='pass',verdict,confidence:Number(validation.confidence)||0,score:Number(validation.score??validation.rubricScore??(verdict==='pass'?1:0)),rubricThreshold:Number(validation.rubricThreshold??validation.threshold??.6),authority:authority||'peer-model-validation',evidenceFamily:clean(validation.evidenceFamily||reviewEvidenceFamily({provider,authority},true),80),calibrationWeight:validation.calibrationWeight??validation.sourceReliability,receivedAt:now()});store.byTask[key]=rows;store.updatedAt=now();write(KEYS.peerReviews,store);const result=syncRewards(),status=peerReviewStatus(questId,taskId);event('civweave:peer-review-recorded',{questId,taskId,validatorId,status,rewards:result});return{accepted:true,status,rewards:result}}
function bridgeLivingRewards(){const state=read(KEYS.living,null);if(!state?.school)return 0;let added=0;for(const module of list(state.school.modules)){const progress=state.progress?.[module.id],validation=livingValidationFor(module,progress),legacy=Boolean(progress?.assessmentPassed&&!progress?.validationConfidence&&!list(progress?.attempts).length);if(!progress?.assessmentPassed||!(validation?.verifiedPass||legacy))continue;const source=`${state.school.id}:${module.id}`;if(appendReward({system:'living-school',sourceId:source,currency:'acorn',amount:1,createdAt:progress.passedAt||progress.completedAt}))added++;const skills=list(module.concepts).length?module.concepts:[state.school.capability];for(const skill of skills)if(appendReward({system:'living-school',sourceId:source,currency:'xp',amount:10,skill,createdAt:progress.passedAt||progress.completedAt}))added++}return added}
function bridgeCerbanimoRewards(){const state=mergeReviewMetadata(read(KEYS.cerbanimo,null));if(!state?.quests)return 0;let added=0;for(const quest of list(state.quests))for(const task of list(quest.tasks)){if(task.status!=='completed')continue;const source=`${quest.id}:${task.id}`,localSource=`${source}:local-evidence`,skills=taskSkills(quest,task);if(qualifiedProvider(task.review)){const validator={type:'local-qualified-evidence',provider:task.review.provider,model:task.review.model,requestId:task.review.requestId,confidence:task.review.confidence};if(appendReward({system:'cerbanimo',sourceId:localSource,currency:'acorn',amount:1,validator,phase:'local-validation',createdAt:task.review.at||task.updatedAt}))added++;for(const skill of skills)if(appendReward({system:'cerbanimo',sourceId:localSource,currency:'xp',amount:25,skill,validator,phase:'main-xp',createdAt:task.review.at||task.updatedAt}))added++}const validation=taskValidationStatus(quest,task),payout=validationConfidenceApi().payoutEligibility(validation,{requireCrossDevice:true});if(payout.eligible){const payoutSource=`${source}:weighted-cross-device`;const validator={type:'weighted-confidence',confidence:validation.passConfidence,diversity:validation.diversity,devices:validation.positiveDeviceIds};if(appendReward({system:'cerbanimo',sourceId:payoutSource,currency:'button',amount:2,validator,phase:'cross-device-payout',createdAt:now()}))added++;if(appendReward({system:'cerbanimo',sourceId:payoutSource,currency:'cotoken',amount:1,validator,phase:'validation-bonus',createdAt:now()}))added++;for(const skill of skills)if(appendReward({system:'cerbanimo',sourceId:payoutSource,currency:'xp',amount:10,skill,validator,phase:'bonus-xp',createdAt:now()}))added++}}return added}
function bridgeFellowFareRewards(){const state=read(KEYS.fellowfare,null);if(!state)return 0;let added=0;const trades=[...list(state.trades),...list(state.exchanges),...list(state.orders)];for(const trade of trades){if(!['completed','settled','accepted'].includes(trade.status))continue;const source=trade.id||hash(JSON.stringify(trade)),amount=Number(trade.buttons||trade.amount||trade.price||0);if(amount>0&&appendReward({system:'fellowfare',sourceId:source,currency:'button',amount,validator:'settled trade',createdAt:trade.updatedAt||trade.completedAt}))added++}return added}
function syncRewards(){const added=bridgeLivingRewards()+bridgeCerbanimoRewards()+bridgeFellowFareRewards();if(added)event('civweave:reward-bridge',{added,balances:balances()});return{added,balances:balances()}}
let storagePatched=false;function patchStorage(){if(storagePatched)return;storagePatched=true;const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){const result=original.call(this,key,value);if(this===localStorage&&SOURCE_KEYS.has(String(key)))queueMicrotask(()=>{syncCampus();syncRewards()});return result}}
let enginePatched=false;function patchCerbanimoEngine(){const api=globalThis.CivweaveCerbanimoQuestV144;if(!api||enginePatched)return Boolean(api);enginePatched=true;const originalRead=api.readState.bind(api),originalWrite=api.writeState.bind(api),originalTransition=api.applyTaskTransition.bind(api);api.readState=()=>mergeReviewMetadata(originalRead());api.writeState=state=>{captureReviewMetadata(state);const result=originalWrite(state);queueMicrotask(syncRewards);return mergeReviewMetadata(result)};api.applyTaskTransition=(...args)=>{const result=originalTransition(...args);queueMicrotask(syncRewards);return result};event('civweave:cerbanimo-reward-policy-ready',{validationMode:'weighted-confidence',confidenceThreshold:.88,evidenceFamilies:2,crossDevicePayout:true,peerRewards:['button','cotoken','bonus-xp']});return true}
function boot(){patchStorage();syncCampus();syncRewards();if(!patchCerbanimoEngine()){let attempts=0;const timer=setInterval(()=>{if(patchCerbanimoEngine()||attempts++>120)clearInterval(timer)},50)}addEventListener('civweave:mesh-inbox',event=>{const object=event.detail?.object;if(object?.kind==='cerbanimo.validation.receipt.v156')recordPeerReview(object).catch(()=>{})});addEventListener('focus',()=>{syncCampus();syncRewards()});addEventListener('visibilitychange',()=>{if(!document.hidden){syncCampus();syncRewards()}})}
boot();
globalThis.CivweaveDomainBridgeV156=Object.freeze({VERSION,KEYS,SCHEMAS,syncCampus,syncRewards,canonicalSnapshot,rewardLedger,appendReward,balances,profileFromCampus,recordPeerReview,peerReviewStatus,qualifiedProvider,taskValidationStatus,livingValidationFor,mergeReviewMetadata,patchCerbanimoEngine});
})();
