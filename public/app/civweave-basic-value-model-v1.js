(()=>{
'use strict';
if(globalThis.CivweaveBasicValueModelV1)return;
const VERSION='1.0.0';
const clean=value=>String(value??'').trim();
const copy=value=>JSON.parse(JSON.stringify(value));
const CONTRACT=`CIVWEAVE BASIC VALUE GUIDE civweave.basic-value-guide.v1
Use a human-equivalent baseline before market evaluation. Automation may make work faster in practice, but it must not discount the baseline value of the human labor the task represents.
- Every task/work item that exposes laborWorthHours: estimate the ordinary competent human labor hours the work is worth. This is NOT model runtime or automated elapsed time.
- Baseline labor value: 1 hour = 5 🔘 Buttons. Product/service baseline = the sum of their component laborWorthHours × 5 🔘 Buttons. Live FellowFare comparables are a separate market layer applied afterward.
- Learning module completion grant: 2 🌰 Acorns. Successful external confidence validation bonus: +2 🌰 Acorns. A qualified model/neuron contribution validating somebody else's learning: 1 🌰 Acorn. These grants are deterministic ledger rules; do not fabricate extra rewards.
- Marketed curriculum/tutoring time: 10 🌰 Acorns per hour. Curriculum packages should be suggested within 5–50 🌰 Acorns based on length and quality.
- Mentorship: balanced learning+doing = 5 🔘 Buttons + 5 🌰 Acorns; doing-heavy = 15 🔘 Buttons; learning-heavy = 20 🌰 Acorns.
Never convert 🔘 Buttons to 🌰 Acorns or vice versa as if they were exchange-rate equivalents. They represent different kinds of value. Never award 🔘 Buttons merely because a task has a baseline price.`;
const taskKey=/^(tasks?|steps?|workItems?|work_items?|quests?|deliverables?|products?|services?|projects?|activities?|actions?)$/i;
const commerceKey=/^(product|service|deliverable|project|quest|task|step|workItem|work_item)$/i;
function laborProperty(){return{type:'number',minimum:0,description:'Human-equivalent labor hours this work is worth at an ordinary competent pace. Ignore acceleration from AI or automation.'}}
function recurseSchema(node,key='',root=false,seen=new WeakSet()){
  if(!node||typeof node!=='object'||seen.has(node))return node;seen.add(node);
  if(Array.isArray(node)){node.forEach(item=>recurseSchema(item,key,false,seen));return node}
  if(node.type==='object'||node.properties){
    node.properties=node.properties||{};
    if(taskKey.test(key)||commerceKey.test(key)){
      if(!node.properties.laborWorthHours)node.properties.laborWorthHours=laborProperty();
      node.required=[...new Set([...(Array.isArray(node.required)?node.required:[]),'laborWorthHours'])];
    }
    if(root&&!node.properties.valuation){
      node.properties.valuation={type:'object',description:'Shared pre-market Civweave value estimate.',properties:{laborWorthHours:laborProperty(),curriculumAcorns:{type:'number',minimum:5,maximum:50,description:'For curriculum only: 5–50 🌰 based on length and quality, using 10 🌰/hour as the time baseline.'},mentorshipMode:{type:'string',enum:['balanced','doing-heavy','learning-heavy']}}};
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
  return/(cerbanimo|living-school|fellowfare|task|quest|project|product|service|curriculum|tutor|mentor|learning|labor|market|price|value)/.test(text);
}
function patch(runtime){
  const rewardPatched=globalThis.CivweaveRewardReceiversV2?.patchRuntime?.(runtime)||runtime;
  if(!rewardPatched?.generate||rewardPatched.basicValueRevision===VERSION||rewardPatched.generate.__cwBasicValueV1)return rewardPatched;
  const original=rewardPatched.generate.bind(rewardPatched);
  const generate=async request=>{
    let next=request&&typeof request==='object'?{...request}:request;
    if(next&&relevant(next))next={...next,schema:augmentSchema(next.schema),context:{...(next.context||{}),basicValueGuide:{schema:'civweave.basic-value-guide.v1',laborButtonsPerHour:5,educationAcornsPerHour:10,curriculumAcorns:[5,50],moduleCompletionAcorns:2,externalValidationBonusAcorns:2,validatorContributionAcorns:1,mentorship:['5 🔘 + 5 🌰 balanced','15 🔘 doing-heavy','20 🌰 learning-heavy']}},messages:[...(next.messages||[]),{role:'system',content:CONTRACT}]};
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
