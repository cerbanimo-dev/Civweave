(()=>{
'use strict';
const VERSION='1.0.4-v156';
const KEYS={campus:'commonweave.working-campus.v1',intentions:'commonweave.intentions.v127',inbox:'commonweave.realm-inbox.v1',domain:'commonweave.domain.v156',rewards:'commonweave.rewards.v156',living:'commonweave.living-school.cabinet.v151',cerbanimo:'cerbanimo.quest-engine.v144',fellowfare:'fellowfare.mvp.state.v3'};
const SCHEMAS={domain:'commonweave.domain.v156',learning:'commonweave.learning-request.v156',task:'commonweave.task-request.v156',materials:'commonweave.materials-request.v156',passport:'commonweave.passport.v156',rewardLedger:'commonweave.reward-ledger.v156',rewardEvent:'commonweave.reward-event.v156'};
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
function profileFromCampus(){const campus=read(KEYS.campus,{});return{
  aptitude:campus.profile?.skillLevel||campus.skillLevel||campus.aptitude||'not specified',
  learningMode:campus.profile?.learningMode||campus.learningMode||'guided',
  collaborationMode:campus.profile?.collaborationMode||campus.collaborationMode||'solo or unspecified',
  weeklyHours:campus.profile?.weeklyHours||campus.weeklyHours||'not specified',
  constraints:clean(campus.profile?.constraints||campus.constraints||'',3000)
}}
function pathFor(plan,realm){return list(plan?.paths).find(path=>path?.realm===realm)||null}
function normalizeRequest(plan,realm,kind){const path=pathFor(plan,realm);if(!path)return null;const profile=profileFromCampus();return{
  schema:SCHEMAS[kind],
  id:`${kind}:${plan.id||hash(plan.title)}:${hash(path.title||realm)}`,
  intentionId:plan.id,
  source:'working-campus-v155',realm,
  title:clean(path.title||plan.title,240),
  purpose:clean(path.purpose||plan.outcome||plan.wish,3000),
  steps:list(path.steps).map(step=>clean(step,600)).filter(Boolean),
  completionCriteria:clean(path.completionCriteria||plan.completionCriteria,2000),
  evidence:list(path.evidence).map(item=>clean(item,500)).filter(Boolean),
  learnerProfile:profile,
  state:plan.state||'review',
  updatedAt:plan.updatedAt||plan.activatedAt||plan.createdAt||null
}}
function canonicalSnapshot(){const plan=planFromCampus();if(!plan)return{schema:SCHEMAS.domain,version:VERSION,activeIntentionId:null,intentions:[],requests:{learning:[],tasks:[],materials:[]},passport:null,updatedAt:null};const learning=normalizeRequest(plan,'living-school','learning'),tasks=normalizeRequest(plan,'cerbanimo','task'),materials=normalizeRequest(plan,'fellowfare','materials'),updatedAt=plan.updatedAt||plan.activatedAt||plan.createdAt||null;return{
  schema:SCHEMAS.domain,version:VERSION,activeIntentionId:plan.id,
  intentions:[{id:plan.id,title:clean(plan.title,240),wish:clean(plan.wish,4000),outcome:clean(plan.outcome,4000),state:plan.state||'review',profile:profileFromCampus(),governance:plan.governance||null,updatedAt}],
  requests:{learning:learning?[learning]:[],tasks:tasks?[tasks]:[],materials:materials?[materials]:[]},
  passport:{schema:SCHEMAS.passport,intentionId:plan.id,consent:plan.governance?.consent||'review required',constraints:profileFromCampus().constraints,paths:list(plan.paths).map(path=>({realm:path.realm,title:path.title,state:path.state||'ready'}))},
  updatedAt
}}
function syncCampus(){const next=canonicalSnapshot(),before=read(KEYS.domain,null);if(JSON.stringify(before)!==JSON.stringify(next)){write(KEYS.domain,next);event('commonweave:domain-synced',{snapshot:next})}return next}
function rewardId(system,source,currency,skill=''){return `reward:${system}:${source}:${currency}:${hash(skill)}`}
function rewardLedger(){const value=read(KEYS.rewards,{schema:SCHEMAS.rewardLedger,events:[]});value.schema=SCHEMAS.rewardLedger;value.events=list(value.events);return value}
function appendReward(input){const ledger=rewardLedger(),eventRow={schema:SCHEMAS.rewardEvent,id:input.id||rewardId(input.system,input.sourceId,input.currency,input.skill),system:input.system,sourceId:input.sourceId,currency:input.currency,amount:Number(input.amount)||0,skill:clean(input.skill,180)||null,validator:input.validator||null,createdAt:input.createdAt||now()};if(eventRow.amount<=0||ledger.events.some(item=>item.id===eventRow.id))return null;ledger.events.push(eventRow);ledger.updatedAt=now();write(KEYS.rewards,ledger);event('commonweave:rewards-changed',{event:eventRow,balances:balances(ledger.events)});return eventRow}
function balances(events=rewardLedger().events){const out={acorns:0,buttons:0,cotokens:0,xp:{}};for(const row of events){const amount=Number(row.amount)||0;if(row.currency==='xp')out.xp[row.skill||'general']=(out.xp[row.skill||'general']||0)+amount;else if(row.currency==='acorn')out.acorns+=amount;else if(row.currency==='button')out.buttons+=amount;else if(row.currency==='cotoken')out.cotokens+=amount}return out}
function bridgeLivingRewards(){const state=read(KEYS.living,null);if(!state?.school)return 0;let added=0;for(const module of list(state.school.modules)){const progress=state.progress?.[module.id];if(!progress?.assessmentPassed)continue;const source=`${state.school.id}:${module.id}`;if(appendReward({system:'living-school',sourceId:source,currency:'acorn',amount:1,createdAt:progress.passedAt||progress.completedAt}))added++;const skills=list(module.concepts).length?module.concepts:[state.school.capability];for(const skill of skills)if(appendReward({system:'living-school',sourceId:source,currency:'xp',amount:10,skill,createdAt:progress.passedAt||progress.completedAt}))added++}return added}
function bridgeCerbanimoRewards(){const state=read(KEYS.cerbanimo,null);if(!state?.quests)return 0;let added=0;for(const quest of list(state.quests))for(const task of list(quest.tasks)){if(task.status!=='completed')continue;const source=`${quest.id}:${task.id}`,skills=list(task.skillTags||quest.skillTags);for(const [currency,amount] of [['cotoken',1],['button',2],['acorn',1]])if(appendReward({system:'cerbanimo',sourceId:source,currency,amount,validator:task.review?.state||'accepted',createdAt:task.updatedAt}))added++;for(const skill of skills.length?skills:['skilled labor'])if(appendReward({system:'cerbanimo',sourceId:source,currency:'xp',amount:25,skill,validator:task.review?.state||'accepted',createdAt:task.updatedAt}))added++}return added}
function bridgeFellowFareRewards(){const state=read(KEYS.fellowfare,null);if(!state)return 0;let added=0;const trades=[...list(state.trades),...list(state.exchanges),...list(state.orders)];for(const trade of trades){if(!['completed','settled','accepted'].includes(trade.status))continue;const source=trade.id||hash(JSON.stringify(trade)),amount=Number(trade.buttons||trade.amount||trade.price||0);if(amount>0&&appendReward({system:'fellowfare',sourceId:source,currency:'button',amount,validator:'settled trade',createdAt:trade.updatedAt||trade.completedAt}))added++}return added}
function syncRewards(){const added=bridgeLivingRewards()+bridgeCerbanimoRewards()+bridgeFellowFareRewards();if(added)event('commonweave:reward-bridge',{added,balances:balances()});return{added,balances:balances()}}
let patched=false;function patchStorage(){if(patched)return;patched=true;const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){const result=original.call(this,key,value);if(this===localStorage&&SOURCE_KEYS.has(String(key)))queueMicrotask(()=>{syncCampus();syncRewards()});return result}}
function boot(){patchStorage();syncCampus();syncRewards();addEventListener('focus',()=>{syncCampus();syncRewards()});addEventListener('visibilitychange',()=>{if(!document.hidden){syncCampus();syncRewards()}})}
boot();
globalThis.CommonweaveDomainBridgeV156=Object.freeze({VERSION,KEYS,SCHEMAS,syncCampus,syncRewards,canonicalSnapshot,rewardLedger,appendReward,balances,profileFromCampus});
})();
