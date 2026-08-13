(()=>{
'use strict';
if(globalThis.CivweaveBasicValueModelV1)return;
const VERSION='1.2.0';
const clean=value=>String(value??'').trim();
const copy=value=>JSON.parse(JSON.stringify(value));
const CONTRACT=`CIVWEAVE BASIC VALUE GUIDE civweave.basic-value-guide.v1
Use the shared uniform starting wage before market evaluation. The wage is 5 🔘 Buttons per human-equivalent labor hour for every worker. Models estimate the hours represented by the work; they do not choose different wage rates for skill, seniority, prestige, role, bargaining power, urgency, or automation.
- Every task/work item that exposes laborWorthHours: estimate the ordinary competent human labor hours the work is worth. This is NOT model runtime or automated elapsed time. Include material setup, coordination, testing, documentation, handoff, and reasonable rework implied by scope.
- Uniform starting wage: 1 human-equivalent labor hour = 5 🔘 Buttons for everybody. Product/service labor wage = the sum of their component laborWorthHours × 5 🔘 Buttons. Live FellowFare comparables are a separate market layer applied afterward and must never alter the worker wage rate.
- Automation may make work faster in practice, but it must not discount the human-equivalent hours or the wage. The economic model deliberately flattens labor-rate hierarchy by holding the Button wage rate constant across people and roles.
- Every Living School module/curriculum item that exposes educationalHours: estimate ordinary learner/instructor educational time. For marketed curriculum, also suggest curriculumAcorns within 5–50 🌰 based on length and quality, using 10 🌰 Acorns/hour as the time reference.
- Learning module completion grant: 2 🌰 Acorns. Successful external confidence validation bonus: +2 🌰 Acorns. A qualified model/neuron contribution validating somebody else's learning: 1 🌰 Acorn. These grants are deterministic ledger rules; do not fabricate extra rewards.
- Marketed curriculum/tutoring time: 10 🌰 Acorns per hour. Curriculum packages should be suggested within 5–50 🌰 Acorns based on length and quality.
- Mentorship: balanced learning+doing = 5 🔘 Buttons + 5 🌰 Acorns; doing-heavy = 15 🔘 Buttons; learning-heavy = 20 🌰 Acorns.
- Every generated valuation is provisional until the second-pass civweave.basic-value-review.v1 reviewer checks it against the shared fairness rubric.
Never convert 🔘 Buttons to 🌰 Acorns or vice versa as if they were exchange-rate equivalents. They represent different kinds of value. Never award 🔘 Buttons merely because a task has a wage valuation; settlement still requires the relevant validated-work/payment flow.`;
const laborKey=/^(tasks?|steps?|workItems?|work_items?|quests?|deliverables?|products?|services?|projects?|activities?|actions?)$/i;
const educationKey=/^(modules?|lessons?|curricula?|curriculums?|courses?|tutorials?|tutoring|learningModules?|learning_modules?)$/i;
const commerceKey=/^(product|service|deliverable|project|quest|task|step|workItem|work_item)$/i;
function laborProperty(){return{type:'number',minimum:0,description:'Human-equivalent labor hours this work represents at an ordinary competent pace. Ignore acceleration from AI or automation. The wage rate is fixed elsewhere and is not model-selected.'}}
function educationalProperty(){return{type:'number',minimum:0,description:'Ordinary educational hours represented by this learning item. This is learning/instruction time, not model runtime.'}}
function rationaleProperty(){return{type:'string',description:'Explain the scope assumptions behind the proposed economic valuation so an independent reviewer can audit fairness. Do not justify a different labor wage rate; the wage is uniform.'}}
function curriculumProperty(){return{type:'number',minimum:5,maximum:50,description:'For curriculum only: suggested 5–50 🌰 Acorns based on length and quality, using 10 🌰/hour as the time reference.'}}
function recurseSchema(node,key='',root=false,seen=new WeakSet()){
  if(!node||typeof node!=='object'||seen.has(node))return node;seen.add(node);
  if(Array.isArray(node)){node.forEach(item=>recurseSchema(item,key,false,seen));return node}
  if(node.type==='object'||node.properties){
    node.properties=node.properties||{};
    if(laborKey.test(key)||commerceKey.test(key)){
      if(!node.properties.laborWorthHours)node.properties.laborWorthHours=laborProperty();
      if(!node.properties.valuationRationale)node.properties.valuationRationale=rationaleProperty();
      node.required=[...new Set([...(Array.isArray(node.required)?node.required:[]),'laborWorthHours','valuationRationale'])];
    }
    if(educationKey.test(key)){
      if(!node.properties.educationalHours)node.properties.educationalHours=educationalProperty();
      if(!node.properties.curriculumAcorns)node.properties.curriculumAcorns=curriculumProperty();
      if(!node.properties.valuationRationale)node.properties.valuationRationale=rationaleProperty();
      node.required=[...new Set([...(Array.isArray(node.required)?node.required:[]),'educationalHours','curriculumAcorns','valuationRationale'])];
    }
    if(root&&!node.properties.valuation){
      node.properties.valuation={type:'object',description:'Shared pre-market Civweave value estimate. Models estimate hours, while the uniform Button wage rate is deterministic. Provisional until second-pass economic review.',properties:{laborWorthHours:laborProperty(),educationalHours:educationalProperty(),curriculumAcorns:curriculumProperty(),mentorshipMode:{type:'string',enum:['balanced','doing-heavy','learning-heavy']},rationale:rationaleProperty()}};
    }
    for(const [name,child] of Object.entries(node.properties))recurseSchema(child,name,false,seen);
  }
  if(node.items)recurseSchema(node.items,key,false,seen);
  for(const name of ['anyOf','oneOf','allOf'])if(Array.isArray(node[name]))node[name].forEach(child=>recurseSchema(child,key,false,seen));
  return node;
}
function augmentSchema(schema){if(!schema||typeof schema!=='object')return schema;return recurseSchema(copy(schema),'',true)}
function relevant(request={}){
  const text=`${request.purpose||''} ${request.systemId||''} ${JSON.stringify(request.context||{})} ${(request.messages||[]).map(row=>row?.content||'').join(' ')}`.toLowerCase();
  return/(cerbanimo|living-school|fellowfare|civweave|task|quest|project|product|service|curriculum|tutor|mentor|learning|labor|market|price|value)/.test(text);
}
function patch(runtime){
  const rewardPatched=globalThis.CivweaveRewardReceiversV2?.patchRuntime?.(runtime)||runtime;
  if(!rewardPatched?.generate||rewardPatched.basicValueRevision===VERSION||rewardPatched.generate.__cwBasicValueV1)return rewardPatched;
  const original=rewardPatched.generate.bind(rewardPatched);
  const generate=async request=>{
    let next=request&&typeof request==='object'?{...request}:request;
    if(next&&relevant(next))next={...next,schema:augmentSchema(next.schema),context:{...(next.context||{}),basicValueGuide:{schema:'civweave.basic-value-guide.v1',laborWageButtonsPerHour:5,laborButtonsPerHour:5,laborWagePolicy:'uniform-starting-wage',modelChoosesLaborHoursNotRate:true,educationAcornsPerHour:10,curriculumAcorns:[5,50],moduleCompletionAcorns:2,externalValidationBonusAcorns:2,validatorContributionAcorns:1,mentorship:['5 🔘 + 5 🌰 balanced','15 🔘 doing-heavy','20 🌰 learning-heavy'],valuationReview:'civweave.basic-value-review.v1'}},messages:[...(next.messages||[]),{role:'system',content:CONTRACT}]};
    return original(next);
  };
  Object.defineProperty(generate,'__cwBasicValueV1',{value:true});
  if(Object.isExtensible(rewardPatched)&&!Object.isFrozen(rewardPatched)){
    try{rewardPatched.generate=generate;rewardPatched.basicValueRevision=VERSION;rewardPatched.__cwBasicValueV1=true;return rewardPatched}catch{}
  }
  const proxy={...rewardPatched,generate,basicValueRevision:VERSION,__cwBasicValueV1:true};
  return Object.isFrozen(rewardPatched)?Object.freeze(proxy):proxy;
}
function watch(){let value=patch(globalThis.CivweaveModelRuntime);try{Object.defineProperty(globalThis,'CivweaveModelRuntime',{configurable:true,enumerable:true,get:()=>value,set:next=>{value=patch(next)}})}catch{if(value)patch(value)}}
const api=Object.freeze({version:VERSION,promptContract:CONTRACT,augmentSchema,patchRuntime:patch});
globalThis.CivweaveBasicValueModelV1=api;
watch();
setInterval(()=>{const current=globalThis.CivweaveModelRuntime,patched=patch(current);if(patched&&patched!==current)globalThis.CivweaveModelRuntime=patched},1800);
})();