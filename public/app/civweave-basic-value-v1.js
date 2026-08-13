(()=>{
'use strict';
if(globalThis.CivweaveBasicValueV1)return;
const VERSION='1.1.0';
const SCHEMA='civweave.basic-value-guide.v1';
const LIVING_STATE_KEY='civweave.living-school.cabinet.v151';
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
const num=value=>Number.isFinite(Number(value))?Number(value):0;
const round=value=>Number(num(value).toFixed(2));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,num(value)));
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const copy=value=>JSON.parse(JSON.stringify(value));
const GUIDE=Object.freeze({
  schema:SCHEMA,
  version:2,
  symbols:Object.freeze({button:'🔘',acorn:'🌰'}),
  labor:Object.freeze({
    wageButtonsPerHour:5,
    buttonsPerHour:5,
    wagePolicy:'uniform-starting-wage',
    basis:'uniform starting wage for human-equivalent labor at an ordinary competent pace; every worker receives the same Button wage rate, while models estimate only the hours represented by the work; automation does not reduce the wage or hours baseline'
  }),
  learning:Object.freeze({moduleCompletionAcorns:2,externalValidationBonusAcorns:2,validatorContributionAcorns:1}),
  education:Object.freeze({acornsPerHour:10,curriculumMinAcorns:5,curriculumMaxAcorns:50,curriculumBasis:'length and quality'}),
  mentorship:Object.freeze({
    balanced:Object.freeze({id:'balanced',label:'Learning + doing',buttons:5,acorns:5}),
    doingHeavy:Object.freeze({id:'doing-heavy',label:'Doing-heavy mentorship',buttons:15,acorns:0}),
    learningHeavy:Object.freeze({id:'learning-heavy',label:'Learning-heavy mentorship',buttons:0,acorns:20})
  })
});
function laborButtons(hours){return round(Math.max(0,num(hours))*GUIDE.labor.wageButtonsPerHour)}
function educationalAcorns(hours){return round(Math.max(0,num(hours))*GUIDE.education.acornsPerHour)}
function curriculumAcorns({hours=0,recommendedAcorns=0}={}){
  const explicit=num(recommendedAcorns);
  if(explicit>0)return round(clamp(explicit,GUIDE.education.curriculumMinAcorns,GUIDE.education.curriculumMaxAcorns));
  const timeBaseline=educationalAcorns(hours);
  return timeBaseline>0?round(clamp(timeBaseline,GUIDE.education.curriculumMinAcorns,GUIDE.education.curriculumMaxAcorns)):0;
}
function directLaborHours(value){
  if(!value||typeof value!=='object')return 0;
  for(const candidate of [value.laborWorthHours,value.humanEquivalentHours,value.laborHours,value.estimatedHumanHours,value.valuation?.laborWorthHours,value.valuation?.laborHours]){
    const hours=num(candidate);if(hours>0)return hours;
  }
  return 0;
}
function sumLaborHours(value,seen=new WeakSet()){
  if(!value||typeof value!=='object')return 0;
  if(seen.has(value))return 0;seen.add(value);
  const direct=directLaborHours(value);if(direct>0)return round(direct);
  if(Array.isArray(value))return round(value.reduce((sum,row)=>sum+sumLaborHours(row,seen),0));
  let total=0;
  for(const [key,row] of Object.entries(value)){
    if(['pricing','price','rewards','reward','validation','validationConfidence','metadata'].includes(key))continue;
    if(row&&typeof row==='object')total+=sumLaborHours(row,seen);
  }
  return round(total);
}
function mentorship(mode='balanced'){
  const key=clean(mode,40).toLowerCase();
  if(/doing|work/.test(key))return copy(GUIDE.mentorship.doingHeavy);
  if(/learning|teach|education/.test(key))return copy(GUIDE.mentorship.learningHeavy);
  return copy(GUIDE.mentorship.balanced);
}
function baselineFor(kind,input={}){
  const type=clean(kind,40).toLowerCase(),hours=sumLaborHours(input)||Math.max(0,num(input?.hours));
  if(['learning','curriculum'].includes(type))return{kind:type,hours,buttons:0,acorns:curriculumAcorns({hours,recommendedAcorns:input?.recommendedAcorns}),basis:'curriculum length + quality, with 10 🌰 Acorns/hour as the time baseline and a 5–50 🌰 range'};
  if(['tutoring','education','educational-time'].includes(type))return{kind:type,hours,buttons:0,acorns:educationalAcorns(hours),basis:'10 🌰 Acorns per educational hour'};
  if(type==='mentorship')return{kind:type,hours,...mentorship(input?.mode||input?.mentorshipMode),basis:'mentorship mix of learning and doing'};
  const wage=laborButtons(hours);
  return{kind:type||'labor',hours,buttons:wage,wageButtons:wage,wageRateButtonsPerHour:GUIDE.labor.wageButtonsPerHour,acorns:0,wagePolicy:GUIDE.labor.wagePolicy,basis:'uniform starting wage: 5 🔘 Buttons per human-equivalent labor hour for every worker; models value hours, not rank'};
}
function formatButtons(value){return`${round(value)} 🔘 Buttons`}
function formatAcorns(value){return`${round(value)} 🌰 Acorns`}
function chartRows(){return[
  {id:'labor-hour',label:'Starting wage',value:`${formatButtons(5)} / hour`,note:'Uniform labor wage for everyone. Models estimate human-equivalent hours, never a higher or lower rate for rank, prestige, or automation.'},
  {id:'module-complete',label:'Learning module completed',value:formatAcorns(2),note:'Completion grant.'},
  {id:'module-validated',label:'External successful validation',value:`+${formatAcorns(2)}`,note:'Bonus after successful external confidence validation.'},
  {id:'validation-help',label:'Validate someone’s learning',value:formatAcorns(1),note:'For a qualified model/neuron validation contribution.'},
  {id:'education-hour',label:'Curriculum / tutoring time',value:`${formatAcorns(10)} / hour`,note:'Marketed educational time.'},
  {id:'curriculum',label:'Curriculum package',value:`${formatAcorns(5)}–${formatAcorns(50)}`,note:'Length and quality set the final suggestion.'},
  {id:'mentor-balanced',label:'Mentorship: learning + doing',value:`${formatButtons(5)} + ${formatAcorns(5)}`,note:'Balanced on-the-job learning and productive work.'},
  {id:'mentor-doing',label:'Mentorship: doing-heavy',value:formatButtons(15),note:'Primarily productive work with mentorship.'},
  {id:'mentor-learning',label:'Mentorship: learning-heavy',value:formatAcorns(20),note:'Primarily instruction / guided learning.'}
]}
function ledger(){return globalThis.CivweaveCanonicalRewardsV2||null}
async function grantAcorns({amount,sourceId,sourceKey,sourceSystem='living-school',sourceKind='learning',validatorIds=[],metadata={}}){
  const api=ledger();if(!api||!amount||!sourceId)return null;
  return api.appendEntry({assetType:'acorn',amount,sourceSystem,sourceKind,sourceId,sourceKey,validatorIds,metadata:{...metadata,valueGuide:SCHEMA,operation:'grant'}});
}
function moduleIdFrom(detail={}){return clean(detail.moduleId||detail.module?.id||detail.completionId||detail.id,220)}
async function grantModuleCompletion(detail={}){
  const moduleId=moduleIdFrom(detail);if(!moduleId)return null;
  return grantAcorns({amount:GUIDE.learning.moduleCompletionAcorns,sourceId:moduleId,sourceKey:`basic-value:${moduleId}:module-complete`,metadata:{reason:'learning-module-completed'}});
}
function validationPassed(detail={}){
  const validation=detail.validationConfidence||detail.validation||detail.result||detail;
  const verified=Boolean(validation?.verifiedPass||validation?.decision==='verified-pass'||detail.verifiedPass);
  const external=Boolean(validation?.crossDeviceSatisfied||validation?.external===true||detail.external===true||detail.crossDeviceSatisfied===true||detail.payoutEligible===true);
  return verified&&external;
}
async function grantExternalValidation(detail={}){
  const moduleId=moduleIdFrom(detail);if(!moduleId||!validationPassed(detail))return null;
  const validation=detail.validationConfidence||detail.validation||detail.result||detail;
  return grantAcorns({amount:GUIDE.learning.externalValidationBonusAcorns,sourceId:moduleId,sourceKey:`basic-value:${moduleId}:external-validation`,sourceKind:'validation',validatorIds:Array.isArray(detail.validatorIds)?detail.validatorIds:[],metadata:{reason:'externally-validated-learning',passConfidence:num(validation?.passConfidence),crossDeviceSatisfied:true}});
}
async function grantValidationContribution(detail={}){
  if(detail.accepted===false||detail.qualified===false||detail.rejected===true)return null;
  const validationId=clean(detail.validationId||detail.receiptId||detail.evidenceId||detail.id,220),moduleId=moduleIdFrom(detail),validatorId=clean(detail.validatorId||detail.modelId||detail.nodeId||detail.deviceId||'local-validator',180);
  if(!validationId&&!moduleId)return null;
  const sourceId=validationId||moduleId;
  return grantAcorns({amount:GUIDE.learning.validatorContributionAcorns,sourceId,sourceKey:`basic-value:${sourceId}:validator:${validatorId}`,sourceKind:'validation',validatorIds:[validatorId],metadata:{reason:'learning-validation-contribution',moduleId:moduleId||undefined,validatorId}});
}
async function scanLivingSchoolState(raw){
  const state=raw&&typeof raw==='object'?raw:parse(localStorage.getItem(LIVING_STATE_KEY),null);if(!state)return;
  const modules=state.school?.modules||[],progress=state.progress||{};
  for(const module of modules){
    const row=progress[module?.id]||{};
    if(row.assessmentPassed)await grantModuleCompletion({moduleId:module.id});
    if(row.validationConfidence&&validationPassed({moduleId:module.id,validationConfidence:row.validationConfidence}))await grantExternalValidation({moduleId:module.id,validationConfidence:row.validationConfidence});
  }
}
function learningValidationContext(value,receipt){
  const packet=value?.validation?.packets?.find(row=>row?.id===receipt?.packetId),submission=value?.validation?.submissions?.find(row=>row?.id===packet?.submissionId);
  const isLearning=submission?.source==='living'||submission?.kind==='lesson'||/living|lesson|module|learning/i.test(`${submission?.source||''} ${submission?.kind||''} ${submission?.subjectId||''}`);
  return isLearning?{packet,submission}:null;
}
async function settleWeaveLearningValidation(value,receipt){
  const ctx=learningValidationContext(value,receipt);if(!ctx)return;
  const stored=value?.validation?.receipts?.find(row=>row?.id===receipt?.id);if(stored)await grantValidationContribution({validationId:stored.id,moduleId:ctx.submission?.subjectId,validatorId:stored.validatorId||stored.model||stored.deviceId,accepted:true});
  const packet=value?.validation?.packets?.find(row=>row?.id===receipt?.packetId),confidence=packet?.validationConfidence;
  if(confidence&&validationPassed({moduleId:ctx.submission?.subjectId,validationConfidence:confidence}))await grantExternalValidation({moduleId:ctx.submission?.subjectId,validationConfidence:confidence,validatorIds:(value?.validation?.receipts||[]).filter(row=>row?.packetId===packet.id).map(row=>row?.validatorId).filter(Boolean)});
}
function patchRewardWeave(){
  const weave=globalThis.CivweaveRewardWeave;if(!weave||weave.__cwBasicValueV1)return weave;
  if(typeof weave.record==='function'){
    const original=weave.record.bind(weave);weave.record=receipt=>{const next=original(receipt);Promise.resolve(settleWeaveLearningValidation(next,receipt)).catch(console.warn);return next};
  }
  if(typeof weave.applyExchange==='function'){
    const original=weave.applyExchange.bind(weave);weave.applyExchange=async exchange=>{const next=await original(exchange);if(exchange?.kind==='receipt')await settleWeaveLearningValidation(next,exchange.payload);return next};
  }
  try{Object.defineProperty(weave,'__cwBasicValueV1',{value:true})}catch{weave.__cwBasicValueV1=true}
  return weave;
}
function bind(){
  for(const name of ['living-school:module-completed','civweave:learning-module-completed'])addEventListener(name,event=>grantModuleCompletion(event.detail||{}).catch(console.warn));
  for(const name of ['living-school:learning-validated','civweave:learning-validation-completed'])addEventListener(name,event=>grantExternalValidation(event.detail||{}).catch(console.warn));
  for(const name of ['living-school:validation-contribution','civweave:learning-validation-contribution'])addEventListener(name,event=>grantValidationContribution(event.detail||{}).catch(console.warn));
  addEventListener('storage',event=>{if(event.key===LIVING_STATE_KEY)scanLivingSchoolState(parse(event.newValue,null)).catch(console.warn)});
  queueMicrotask(()=>scanLivingSchoolState().catch(console.warn));
  patchRewardWeave();setInterval(patchRewardWeave,1800);
}
const api=Object.freeze({version:VERSION,schema:SCHEMA,guide:GUIDE,laborButtons,educationalAcorns,curriculumAcorns,directLaborHours,sumLaborHours,mentorship,baselineFor,formatButtons,formatAcorns,chartRows,grantModuleCompletion,grantExternalValidation,grantValidationContribution,scanLivingSchoolState,patchRewardWeave});
globalThis.CivweaveBasicValueV1=api;
bind();
try{dispatchEvent(new CustomEvent('civweave:basic-value-guide-ready',{detail:{version:VERSION,schema:SCHEMA,guide:GUIDE}}))}catch{}
})();
