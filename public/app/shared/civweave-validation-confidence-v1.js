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