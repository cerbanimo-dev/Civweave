(()=>{
'use strict';
const VERSION='1.0.0';
const inner=globalThis.CivweaveContributionMeshV1;
const confidence=globalThis.CivweaveValidationConfidenceV1;
if(!inner?.security)throw new Error('Contribution security must load before proof gate');
if(!confidence?.aggregate)throw new Error('Confidence validation must load before proof gate');
const req=request=>new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
function openDb(){return new Promise((resolve,reject)=>{const request=indexedDB.open(inner.DB_NAME);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
async function rows(){const db=await openDb();try{return await req(db.transaction('events','readonly').objectStore('events').getAll())}finally{db.close()}}
const normalizeAsset=value=>{const asset=String(value||'').toUpperCase();if(!['BUTTON','ACORN'].includes(asset))throw new Error(`unsupported transferable contribution asset: ${asset||'(empty)'}`);return asset};

async function proofStatusForMint(mintHash){
  const all=await rows(),candidate=all.find(row=>row.status==='active'&&row.eventHash===String(mintHash)&&row.envelope?.event?.type==='MintFinalized');
  if(!candidate)throw new Error('mint candidate is unavailable');
  const payload=candidate.envelope.event.payload||{},hashes=[...new Set((payload.validationHashes||[]).map(String))];
  if(!payload.claimId||!payload.contributorDeviceId||!hashes.length)throw new Error('mint candidate lacks claim, contributor device, or validation references');
  const validations=[];
  for(const hash of hashes){
    const row=all.find(item=>item.status==='active'&&item.eventHash===hash);
    if(!row||row.envelope?.event?.type!=='ValidationSubmitted')throw new Error(`validation reference is unavailable or wrong type: ${hash}`);
    const value=row.envelope.event.payload||{};
    if(String(value.claimId)!==String(payload.claimId))throw new Error('validation claim does not match mint claim');
    validations.push({
      id:hash,validatorId:value.validatorId,deviceId:value.deviceId,
      family:value.evidenceClass,provenance:value.sourceType,
      confidence:value.confidence,calibrationWeight:value.calibration,
      rubricScore:value.rubricScore,rubricThreshold:value.passThreshold,
      decision:value.decision,model:value.model,
    });
  }
  const aggregate=confidence.aggregate(validations,{contributorDeviceId:String(payload.contributorDeviceId)}),effects=(payload.effects||[]).map(effect=>({asset:normalizeAsset(effect.asset),amount:Number(effect.amount)})),requiresCrossDevice=effects.some(effect=>effect.asset==='BUTTON');
  const eligibility=confidence.payoutEligibility(aggregate,{requireCrossDevice:requiresCrossDevice});
  return{mintHash:candidate.eventHash,claimId:payload.claimId,contributorDeviceId:payload.contributorDeviceId,effects,validationHashes:hashes,aggregate,requiresCrossDevice,eligible:eligibility.eligible,eligibility};
}

async function proposeMint({claimId,subjectId,effects,evidenceRoot,rubricHash='',validationHashes=[],contributorDeviceId}={}){
  const wallet=await inner.walletIdentity(),target=String(subjectId||wallet.walletId),claim=String(claimId||'').trim(),device=String(contributorDeviceId||'').trim(),refs=[...new Set((validationHashes||[]).map(String).filter(Boolean))];
  if(!claim||!device||!evidenceRoot||!refs.length)throw new Error('secure mint proposal requires claim, contributor device, evidence root, and validation references');
  const transferable=(effects||[]).map(effect=>({asset:normalizeAsset(effect.asset),amount:Number(effect.amount)}));
  if(!transferable.length||transferable.some(effect=>!Number.isFinite(effect.amount)||effect.amount<=0))throw new Error('secure mint effects are invalid');
  const event=await inner.createEvent('MintFinalized',{
    protocol:'civweave.contribution-event.v1',claimId:claim,subjectId:target,effects:transferable,
    evidenceRoot:String(evidenceRoot),rubricHash:String(rubricHash),validationHashes:refs,
    contributorDeviceId:device,validationPolicy:confidence.VERSION,
  });
  const envelope=await inner.publishEvent(event),proof=await proofStatusForMint(event.hash);
  if(!proof.eligible)throw new Error(`mint proof is not payout eligible: ${proof.aggregate.decision}${proof.requiresCrossDevice&&!proof.aggregate.crossDeviceSatisfied?' + cross-device gate':''}`);
  return envelope;
}
async function witnessMint(mintHash,options={}){const proof=await proofStatusForMint(mintHash);if(!proof.eligible)throw new Error('mint proof does not satisfy confidence/diversity/cross-device payout gates');return inner.security.witnessMint(mintHash,options)}
async function certifyMint(mintHash){const proof=await proofStatusForMint(mintHash);if(!proof.eligible)throw new Error('mint proof does not satisfy confidence/diversity/cross-device payout gates');return inner.security.certifyMint(mintHash)}
async function launchStatus(){const status=await inner.security.launchStatus(),blockers=[...status.blockers];if(!globalThis.CivweaveValidationConfidenceV1?.aggregate)blockers.push('validation-confidence-runtime-missing');return{...status,readyForContributionValue:blockers.length===0,blockers:[...new Set(blockers)],transferMode:blockers.length?'pending-only':status.transferMode,validationPolicy:confidence.VERSION}}
const security=Object.freeze({...inner.security,proposeMint,witnessMint,certifyMint,proofStatusForMint,launchStatus});
const api=Object.freeze({...inner,security,proofGateVersion:VERSION});
globalThis.CivweaveContributionMeshV1=api;
})();