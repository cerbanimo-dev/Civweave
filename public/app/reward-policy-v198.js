(()=>{
'use strict';
const VERSION='1.0.7-reward-policy-v198';
const STATE_KEY='commonweave.reward-policy.v198';
const LEDGER_KEY='commonweave.rewards.v156';
const DAILY_CAP=3;
const MODES=Object.freeze({
  deterministic:Object.freeze({multiplier:.5,dailyCap:DAILY_CAP,label:'Deterministic + local semantic'}),
  generative:Object.freeze({multiplier:1.5,dailyCap:Infinity,label:'Generative model'})
});
const REVIEW_BONUS=.5;
const PROMOTION=Object.freeze({
  headline:'Generative models earn 50% more rewards',
  detail:'Use a connected generative model for 50% more Buttons, Acorns, and Skill XP, unlimited eligible tasks, and extra rewards when your model reviews another user’s submission.'
});
const TRIVIAL=/\b(identify|name|pick|choose|state|write)\s+(the\s+)?(smallest|first|next)\s+(task|step|thing|action)\b|\bsmallest\s+(task|step|action)\b/i;
const CLAIM_ONLY=/^(done|finished|complete|completed|fixed|yes|ok|okay|i did it|submitted)[.!\s]*$/i;
const PROOF=/\b(screenshot|photo|video|audio|file|artifact|commit|diff|test|measurement|receipt|link|url|log|record|output|result|draft|worksheet|diagram|prototype|source|citation|feedback)\b/i;
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{const out=JSON.parse(value);return out==null?fallback:out}catch{return fallback}};
const clone=value=>typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));
const now=()=>new Date().toISOString();
const dayKey=(date=new Date())=>{
  const year=date.getFullYear(),month=String(date.getMonth()+1).padStart(2,'0'),day=String(date.getDate()).padStart(2,'0');
  return `${year}-${month}-${day}`;
};
const words=value=>clean(value).toLowerCase().match(/[a-z0-9][a-z0-9'’-]*/g)||[];
const array=value=>Array.isArray(value)?value:[];
function hash(value){let h=2166136261;for(const char of clean(value,24000)){h^=char.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(36)}
function normalizeMode(value){return String(value||'deterministic').toLowerCase()==='generative'?'generative':'deterministic'}
function state(){const value=parse(globalThis.localStorage?.getItem?.(STATE_KEY),{});return{schema:'commonweave.reward-policy-state.v1',version:1,days:value.days&&typeof value.days==='object'?value.days:{},claims:Array.isArray(value.claims)?value.claims:[]}}
function save(value){globalThis.localStorage?.setItem?.(STATE_KEY,JSON.stringify(value));return value}
function ledger(){const value=parse(globalThis.localStorage?.getItem?.(LEDGER_KEY),{});return Array.isArray(value)?{schema:'commonweave.rewards.v156',events:value}:value&&typeof value==='object'?{...value,events:Array.isArray(value.events)?value.events:[]}:{schema:'commonweave.rewards.v156',events:[]}}
function taskFingerprint(task={}){return hash([task.title,task.objective,task.deliverable,...array(task.evidence),...array(task.acceptanceCriteria)].map(value=>clean(value).toLowerCase().replace(/\s+/g,' ')).join('|'))}
function proofText(submission={}){if(typeof submission==='string')return clean(submission);return clean([submission.text,submission.response,submission.note,submission.summary,...array(submission.proofs).map(item=>typeof item==='string'?item:item?.value||item?.label||item?.url),...array(submission.evidence).map(item=>typeof item==='string'?item:item?.value||item?.label||item?.url)].filter(Boolean).join(' '),20000)}
function assessTask(task={},submission={}){
  const title=clean(task.title||task.action,500),objective=clean(task.objective||task.description,2000),deliverable=clean(task.deliverable,1200),evidence=(Array.isArray(task.evidence)?task.evidence:[]).map(item=>clean(item,500)).filter(Boolean),criteria=(Array.isArray(task.acceptanceCriteria)?task.acceptanceCriteria:[]).map(item=>clean(item,700)).filter(Boolean),complexity=Math.max(0,Number(task.complexityPoints||0)),combined=`${title} ${objective} ${deliverable}`,proof=proofText(submission),reasons=[];
  if(TRIVIAL.test(combined)&&complexity<5)reasons.push('A tiny next-step prompt is a substep, not a reward-bearing task.');
  if(words(combined).length<14)reasons.push('The task does not yet define enough work.');
  if(deliverable.length<12)reasons.push('A concrete deliverable is required.');
  if(evidence.length<1)reasons.push('At least one inspectable evidence type is required.');
  if(criteria.length<2)reasons.push('At least two acceptance criteria are required.');
  if(complexity<4)reasons.push('The task complexity score is below the reward threshold.');
  if(proof){
    if(CLAIM_ONLY.test(proof))reasons.push('A completion claim without evidence cannot earn rewards.');
    if(words(proof).length<12&&!PROOF.test(proof))reasons.push('The submission is too slight to demonstrate completion.');
  }
  return{eligible:reasons.length===0,reasons,complexity,taskFingerprint:taskFingerprint(task),requirements:{minimumComplexity:4,minimumCriteria:2,minimumEvidenceTypes:1,claimOnlyRejected:true}};
}
function normalizeBase(base={buttons:2,acorns:2,skillXp:10}){return{buttons:Math.max(0,Number(base.buttons??2)||0),acorns:Math.max(0,Number(base.acorns??2)||0),skillXp:Math.max(0,Number(base.skillXp??10)||0)}}
function quote({mode='deterministic',baseRewards,activity='task-completion'}={}){
  const normalized=normalizeMode(mode),base=normalizeBase(baseRewards),bonus=normalized==='generative'&&activity==='peer-model-review'?REVIEW_BONUS:0,multiplier=MODES[normalized].multiplier+bonus;
  return{mode:normalized,activity,multiplier,buttons:Math.max(0,Math.round(base.buttons*multiplier)),acorns:Math.max(0,Math.round(base.acorns*multiplier)),skillXp:Math.max(0,Math.round(base.skillXp*multiplier)),promotion:PROMOTION};
}
function remaining(mode='deterministic',date=new Date()){
  const normalized=normalizeMode(mode);if(normalized==='generative')return Infinity;
  const snapshot=state(),used=Number(snapshot.days?.[dayKey(date)]?.deterministicEligibleTasks||0);return Math.max(0,DAILY_CAP-used);
}
function appendLedger(events){const value=ledger();value.events.push(...events);value.events=value.events.slice(-4000);globalThis.localStorage?.setItem?.(LEDGER_KEY,JSON.stringify(value));return value}
function claim({mode='deterministic',task={},submission={},baseRewards,activity='task-completion',actorId='',targetOwnerId='',date=new Date()}={}){
  const normalized=normalizeMode(mode),review=activity==='peer-model-review',assessment=assessTask(task,submission),snapshot=state(),dateKey=dayKey(date),fingerprint=assessment.taskFingerprint;
  if(!assessment.eligible)return{ok:false,code:'TASK_NOT_REWARD_ELIGIBLE',assessment,remaining:remaining(normalized,date),promotion:PROMOTION};
  if(review&&normalized!=='generative')return{ok:false,code:'GENERATIVE_REVIEW_REQUIRED',assessment,remaining:remaining(normalized,date),promotion:PROMOTION};
  if(review&&actorId&&targetOwnerId&&String(actorId)===String(targetOwnerId))return{ok:false,code:'SELF_REVIEW_NOT_REWARDED',assessment,remaining:remaining(normalized,date),promotion:PROMOTION};
  if(snapshot.claims.some(item=>item.fingerprint===fingerprint&&item.activity===activity))return{ok:false,code:'DUPLICATE_REWARD_CLAIM',assessment,remaining:remaining(normalized,date),promotion:PROMOTION};
  const day=snapshot.days[dateKey]||{deterministicEligibleTasks:0};
  if(normalized==='deterministic'&&Number(day.deterministicEligibleTasks||0)>=DAILY_CAP)return{ok:false,code:'DETERMINISTIC_DAILY_LIMIT',assessment,remaining:0,promotion:PROMOTION};
  const amounts=quote({mode:normalized,baseRewards,activity}),claimId=`reward-${Date.now().toString(36)}-${hash(`${fingerprint}|${activity}|${snapshot.claims.length}`)}`;
  const record={id:claimId,fingerprint,taskId:clean(task.id,180),activity,mode:normalized,amounts:{buttons:amounts.buttons,acorns:amounts.acorns,skillXp:amounts.skillXp},actorId:clean(actorId,180),targetOwnerId:clean(targetOwnerId,180),at:date.toISOString()};
  snapshot.claims.push(record);snapshot.claims=snapshot.claims.slice(-4000);
  if(normalized==='deterministic'){day.deterministicEligibleTasks=Number(day.deterministicEligibleTasks||0)+1;snapshot.days[dateKey]=day}
  save(snapshot);
  const rewardSystem=clean(task.system||task.realm||(activity==='peer-model-review'?'commonweave':'commonweave'),80),skill=clean(task.skill||task.skillId||task.category||'general',180)||'general';
  const currencyEvents=[['button',amounts.buttons],['acorn',amounts.acorns],['xp',amounts.skillXp]].filter(([,amount])=>amount>0).map(([currency,amount])=>({id:`${claimId}-${currency}`,type:'reward',currency,amount,skill:currency==='xp'?skill:undefined,system:rewardSystem,source:activity,sourceId:record.taskId||claimId,taskId:record.taskId,mode:normalized,claimId,phase:review?'peer-model-review':'verified-completion',createdAt:record.at,at:record.at,metadata:{rewardPolicy:VERSION,reviewBonus:review}}));
  appendLedger(currencyEvents);
  try{globalThis.dispatchEvent?.(new CustomEvent('commonweave:rewards-changed',{detail:{claim:clone(record),events:clone(currencyEvents)}}));globalThis.dispatchEvent?.(new CustomEvent('commonweave:reward-policy-claimed',{detail:{claim:clone(record)}}))}catch{}
  return{ok:true,claim:record,events:currencyEvents,assessment,remaining:remaining(normalized,date),promotion:PROMOTION};
}
function decorateTask(task={},mode='deterministic'){
  const assessment=assessTask(task,{});return{...task,rewardEligibility:{eligible:assessment.eligible,reasons:assessment.reasons,complexity:assessment.complexity,fingerprint:assessment.taskFingerprint,dailyLimit:normalizeMode(mode)==='deterministic'?DAILY_CAP:null,mode:normalizeMode(mode),promotion:PROMOTION}};
}
function status(){return{version:VERSION,dailyDeterministicLimit:DAILY_CAP,modes:clone(MODES),reviewBonus:REVIEW_BONUS,promotion:PROMOTION,remainingDeterministicToday:remaining('deterministic')}}
const api=Object.freeze({version:VERSION,STATE_KEY,LEDGER_KEY,DAILY_CAP,MODES,REVIEW_BONUS,PROMOTION,assessTask,taskFingerprint,quote,claim,remaining,decorateTask,status,resetForTests:()=>{globalThis.localStorage?.removeItem?.(STATE_KEY)}});
globalThis.CommonweaveRewardPolicyV198=api;
try{globalThis.dispatchEvent?.(new CustomEvent('commonweave:reward-policy-ready',{detail:status()}))}catch{}
})();
