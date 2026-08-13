(()=>{
'use strict';
if(globalThis.CivweaveEconomicPolicyV1)return;
const VERSION='1.0.2';
const SCHEMA='civweave.economic-policy.v1';
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
const num=value=>value===null||value===undefined||value===''?null:Number.isFinite(Number(value))?Number(value):null;
const guide=()=>globalThis.CivweaveBasicValueV1?.guide||null;
const GOVERNANCE=Object.freeze({
  currentAuthority:'model-interim',
  futureAuthority:'anarchadia-democratic',
  democraticActivation:false,
  requiresQuorum:true,
  requiresPercentageLimit:true,
  maxPercentChangePerProposal:null,
  note:'Economic variables are vote-addressable now, but democratic mutation remains disabled until Anarchadia has a quorum rule and an explicit percentage-change limit.'
});
const STABILITY_LEVERS=Object.freeze([
  'stability.buttons.transactionSinkBps',
  'stability.acorns.transactionSinkBps',
  'stability.buttons.demurrageBpsPerYear',
  'stability.acorns.demurrageBpsPerYear',
  'stability.buttons.issuanceCeilingPerPeriod',
  'stability.acorns.issuanceCeilingPerPeriod'
]);
const STABILITY=Object.freeze({
  phase:'designing',
  enabledDeflationaryMechanisms:Object.freeze([]),
  candidateGovernedLevers:STABILITY_LEVERS,
  invariant:'No hidden sink, burn, demurrage, issuance cap, or other deflationary mechanism is enabled by this registry. Candidate stability levers are explicit, unset, disabled, and future-governed.',
  reviewRequirement:'Valuation reviewers should flag likely inflationary or deflationary pressure without inventing a rate.'
});
function rows(){
  const g=guide();
  const value=(path,fallback=null)=>{let node=g;for(const key of path.split('.'))node=node?.[key];const n=num(node);return n===null?fallback:n};
  const defs=[
    ['labor.baselineButtonsPerHour','button/hour',value('labor.buttonsPerHour',5),'Baseline human-equivalent labor value.'],
    ['labor.minimumButtonsPerHour','button/hour',null,'Future democratically governed pay minimum. Unset is distinct from the baseline.'],
    ['learning.moduleCompletionAcorns','acorn/module',value('learning.moduleCompletionAcorns',2),'Completion grant.'],
    ['learning.externalValidationBonusAcorns','acorn/module',value('learning.externalValidationBonusAcorns',2),'External successful validation bonus.'],
    ['learning.validatorContributionAcorns','acorn/validation',value('learning.validatorContributionAcorns',1),'Qualified learning-validation contribution.'],
    ['education.acornsPerHour','acorn/hour',value('education.acornsPerHour',10),'Marketed educational time baseline.'],
    ['education.curriculumMinAcorns','acorn/curriculum',value('education.curriculumMinAcorns',5),'Lower curriculum suggestion bound.'],
    ['education.curriculumMaxAcorns','acorn/curriculum',value('education.curriculumMaxAcorns',50),'Upper curriculum suggestion bound.'],
    ['mentorship.balanced.buttons','button/session',value('mentorship.balanced.buttons',5),'Balanced learning + doing mentorship.'],
    ['mentorship.balanced.acorns','acorn/session',value('mentorship.balanced.acorns',5),'Balanced learning + doing mentorship.'],
    ['mentorship.doingHeavy.buttons','button/session',value('mentorship.doingHeavy.buttons',15),'Doing-heavy mentorship.'],
    ['mentorship.learningHeavy.acorns','acorn/session',value('mentorship.learningHeavy.acorns',20),'Learning-heavy mentorship.'],
    ['stability.buttons.transactionSinkBps','basis-points/transfer',null,'Optional future Button transaction sink. Disabled until a governed rate and destination/destruction policy exist.'],
    ['stability.acorns.transactionSinkBps','basis-points/transfer',null,'Optional future Acorn transaction sink. Disabled until a governed rate and destination/destruction policy exist.'],
    ['stability.buttons.demurrageBpsPerYear','basis-points/year',null,'Optional future Button demurrage/idle-decay lever. Disabled.'],
    ['stability.acorns.demurrageBpsPerYear','basis-points/year',null,'Optional future Acorn demurrage/idle-decay lever. Disabled.'],
    ['stability.buttons.issuanceCeilingPerPeriod','button/period',null,'Optional future Button issuance ceiling. Period and amount are unset.'],
    ['stability.acorns.issuanceCeilingPerPeriod','acorn/period',null,'Optional future Acorn issuance ceiling. Period and amount are unset.']
  ];
  return defs.map(([id,unit,currentValue,description])=>({
    id,governanceKey:`economic.${id}`,unit,currentValue,description,
    voteEligibleEventually:true,requiresQuorum:true,requiresPercentageLimit:true,
    currentAuthority:GOVERNANCE.currentAuthority,futureAuthority:GOVERNANCE.futureAuthority
  }));
}
function snapshot(){
  return{schema:SCHEMA,version:VERSION,governance:GOVERNANCE,stability:STABILITY,variables:rows()};
}
function candidateChange({id,nextValue,currentValue,quorumSatisfied=false,percentLimit=null,governanceActive=false}={}){
  const variable=rows().find(row=>row.id===clean(id,180));if(!variable)return{allowed:false,reason:'unknown-variable'};
  if(!governanceActive||!GOVERNANCE.democraticActivation)return{allowed:false,reason:'anarchadia-economic-governance-not-active',variable};
  if(!quorumSatisfied)return{allowed:false,reason:'quorum-required',variable};
  const limit=num(percentLimit);if(limit===null||limit<=0)return{allowed:false,reason:'percentage-limit-required',variable};
  const prior=num(currentValue??variable.currentValue),next=num(nextValue);if(prior===null||next===null)return{allowed:false,reason:'numeric-value-required',variable};
  const change=prior===0?(next===0?0:Infinity):Math.abs((next-prior)/prior)*100;
  return{allowed:change<=limit,reason:change<=limit?'within-governance-guardrails':'percentage-change-limit-exceeded',changePercent:Number.isFinite(change)?Number(change.toFixed(4)):change,limitPercent:limit,variable};
}
globalThis.CivweaveEconomicPolicyV1=Object.freeze({version:VERSION,schema:SCHEMA,governance:GOVERNANCE,stability:STABILITY,stabilityLevers:STABILITY_LEVERS,variables:rows,snapshot,candidateChange});
try{dispatchEvent(new CustomEvent('civweave:economic-policy-ready',{detail:snapshot()}))}catch{}
})();