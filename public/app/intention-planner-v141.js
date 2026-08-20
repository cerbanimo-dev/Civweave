(()=>{
'use strict';

const VERSION='1.1.0-intention-planner-v141-ai-authority-only';
const INTENTIONS_KEY='civweave.intentions.v127';
const PLAN_SCHEMA='civweave.intention-weave.v1';
const EXPLICIT_PLAN_TRIGGER=/\b(plan|roadmap|routine|program|curriculum|pathway|steps|practice schedule|daily practice|weekly practice|reviewable quest|reviewable weave|set (?:an )?intention)\b|\bteach me\b|\bhelp me learn\b|\bcreate (?:me )?(?:a )?plan\b/i;
const WISH_TRIGGER=/\b(i want|i wish|my wish|my goal|we want|we wish|let'?s|help me)\b/i;
const RETRY_TRIGGER=/\b(retry|try again|one more time|rebuild|build that again|redo)\b/i;
const CORRECTION_TRIGGER=/\b(not (?:a|an|the)|instead(?: of)?|rather than|i mean|correction|change (?:it|that)|revise (?:it|that)|scratch that)\b/i;
const PROJECT_ACTION='(?:learn|make|build|create|write|start|organize|find|change|improve|design|develop|launch|open|set\\s*up|form|run|establish|grow)';
const DIRECT_INTENTION_TRIGGER=new RegExp(`^(?:(?:please|kindly)\\s+)?${PROJECT_ACTION}\\b`,'i');
const INTENT_PROJECT_TRIGGER=new RegExp(`\\b(?:i|we)\\s+(?:want|need|would\\s+like|wish|hope|plan|intend|aim)\\s+to\\s+${PROJECT_ACTION}\\b`,'i');
const COLLECTIVE_PROJECT_TRIGGER=new RegExp(`\\b(?:me\\s+and\\s+(?:my\\s+)?friends|my\\s+friends\\s+and\\s+(?:me|i)|friends?\\s+and\\s+i|our\\s+(?:friends|group|team|family|community)|we)\\b[^.!?]{0,90}\\b${PROJECT_ACTION}\\b`,'i');
const NON_AI_PROVIDER_RE=/^(?:deterministic(?:-local)?|local-contract|bundled|packaged|reflex|minilm|local-reflex|manual|unknown)?$/i;

const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed==null?fallback:parsed}catch{return fallback}};
const clean=value=>String(value==null?'':value).trim();
const lower=value=>clean(value).toLowerCase();
const emit=(type,detail={})=>{try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,at:new Date().toISOString(),...detail}}))}catch{}};

function stripGreeting(value=''){
  return clean(value).replace(/^\s*(?:(?:hi|hello|hey|yo|good\s+(?:morning|afternoon|evening))[\s,!;:.-]*)+/i,'').trim();
}
function projectIntent(value=''){
  const text=stripGreeting(value);
  if(!text)return false;
  return EXPLICIT_PLAN_TRIGGER.test(text)||WISH_TRIGGER.test(text)||DIRECT_INTENTION_TRIGGER.test(text)||INTENT_PROJECT_TRIGGER.test(text)||COLLECTIVE_PROJECT_TRIGGER.test(text);
}
function dispatchChanged(items){emit('civweave:intentions-changed',{items})}
function userTurns(history,text){
  const turns=(Array.isArray(history)?history:[]).filter(item=>item?.role==='user').map(item=>clean(item.text||item.content)).filter(Boolean);
  const latest=clean(text);if(latest&&turns.at(-1)!==latest)turns.push(latest);return turns.slice(-24);
}
function activeIntentionTurns(history,text){
  const turns=userTurns(history,text);if(!turns.length)return[];
  const latestIndex=turns.length-1,latest=turns[latestIndex];
  if(projectIntent(latest))return[latest];
  if(CORRECTION_TRIGGER.test(latest)){
    for(let index=latestIndex-1;index>=0;index--)if(projectIntent(turns[index])||EXPLICIT_PLAN_TRIGGER.test(turns[index]))return[turns[index],latest];
    return[latest];
  }
  if(RETRY_TRIGGER.test(latest)){
    for(let index=latestIndex-1;index>=0;index--)if(projectIntent(turns[index]))return[turns[index],latest];
  }
  return[latest];
}
function currentSystem(context={}){return clean(context?.currentContext?.systemId||context?.guide?.system||context?.routingAnswer?.system||'civweave')}
function meaningfulPriorWish(turns){return turns.slice(0,-1).some(projectIntent)}
function shouldCreate({text,history,context,force=false}={}){
  if(force)return true;if(currentSystem(context)!=='civweave')return false;
  const value=clean(text);if(!value)return false;
  if(projectIntent(value)||CORRECTION_TRIGGER.test(value))return true;
  return RETRY_TRIGGER.test(value)&&meaningfulPriorWish(userTurns(history,value));
}
function aiAuthoredPlan(plan){
  const authoring=plan?.authoring,provider=clean(authoring?.provider).toLowerCase();
  return Boolean(plan?.id&&plan?.schema===PLAN_SCHEMA&&authoring?.aiGenerated===true&&authoring?.mode==='model-structured-json'&&provider&&!NON_AI_PROVIDER_RE.test(provider));
}
function savedItems(){const value=parse(localStorage.getItem(INTENTIONS_KEY),[]);return Array.isArray(value)?value:[]}
function persist(plan){
  if(!aiAuthoredPlan(plan)){
    const error=new Error('Quest persistence requires validated AI-authored structured output.');error.code='QUEST_AI_AUTHORING_REQUIRED';emit('civweave:quest-ai-authority-rejected',{surface:'intention-planner.persist',planId:clean(plan?.id),title:clean(plan?.title)});throw error;
  }
  const items=savedItems(),fingerprint=lower(`${plan.title}|${plan.wish}`).slice(0,500),duplicate=items.find(item=>item?.kind==='weave-plan'&&item?.fingerprint===fingerprint&&item?.state!=='completed'),at=new Date().toISOString();
  if(duplicate){
    plan.id=duplicate.id;plan.createdAt=duplicate.plan?.createdAt||duplicate.createdAt||plan.createdAt;plan.updatedAt=at;duplicate.plan=plan;duplicate.text=plan.title;duplicate.state='review';duplicate.done=false;duplicate.updatedAt=at;
    localStorage.setItem(INTENTIONS_KEY,JSON.stringify(items.slice(0,100)));dispatchChanged(items);return duplicate;
  }
  const item={id:plan.id,kind:'weave-plan',fingerprint,text:plan.title,state:'review',done:false,createdAt:plan.createdAt||at,updatedAt:plan.updatedAt||at,plan};items.unshift(item);localStorage.setItem(INTENTIONS_KEY,JSON.stringify(items.slice(0,100)));dispatchChanged(items);return item;
}
function restore(plan){
  if(!plan?.id)return null;const items=savedItems(),existing=items.find(item=>item?.id===plan.id||item?.plan?.id===plan.id);if(existing)return existing;
  if(!aiAuthoredPlan(plan)){emit('civweave:quest-ai-authority-rejected',{surface:'intention-planner.restore',planId:clean(plan?.id),title:clean(plan?.title)});return null}
  const restored=structuredClone(plan);restored.state=restored.state||'review';const at=new Date().toISOString(),item={id:restored.id,kind:'weave-plan',fingerprint:lower(`${restored.title}|${restored.wish}`).slice(0,500),text:restored.title||'Restored Quest',state:restored.state,done:false,createdAt:restored.createdAt||at,updatedAt:at,plan:restored};items.unshift(item);localStorage.setItem(INTENTIONS_KEY,JSON.stringify(items.slice(0,100)));dispatchChanged(items);return item;
}
function format(plan){
  if(!plan)return'';const paths=(plan.paths||[]).map((path,index)=>[`${index+1}. ${clean(path.title)} · ${clean(path.realm)}`,clean(path.purpose),`First step: ${clean(path.steps?.[0])||'Review the AI-generated first checkpoint.'}`,`Completion: ${clean(path.completionCriteria)||'Review the AI-generated completion criterion.'}`].join('\n')).join('\n\n'),governance=plan.governance?`\n\nConsent layer · ${clean(plan.governance.realm||'anarchadia')}\n${clean(plan.governance.purpose)}`:'';
  return[`I generated and saved a reviewable Quest for “${clean(plan.title)}.”`,'','Governing outcome',clean(plan.outcome),'',paths,governance,'','The Quest is in REVIEW. Inspect, revise, or explicitly activate it with the controls below.'].join('\n').trim();
}
function buildPlan(options={}){
  emit('civweave:quest-ai-generation-required',{surface:'intention-planner.buildPlan',text:clean(options?.text)});const error=new Error('Deterministic Quest construction is retired. Generate the Quest with the selected AI model.');error.code='QUEST_AI_AUTHORING_REQUIRED';throw error;
}
function maybeCreate(options={}){
  if(shouldCreate(options))emit('civweave:quest-ai-generation-required',{surface:'intention-planner.maybeCreate',text:clean(options?.text)});return null;
}

globalThis.CivweaveIntentionPlanner={version:VERSION,schema:PLAN_SCHEMA,triggers:{explicit:EXPLICIT_PLAN_TRIGGER,wish:WISH_TRIGGER,direct:DIRECT_INTENTION_TRIGGER,retry:RETRY_TRIGGER,correction:CORRECTION_TRIGGER},stripGreeting,projectIntent,shouldCreate,activeIntentionTurns,aiAuthoredPlan,buildPlan,maybeCreate,persist,restore,format,deterministicQuestCreation:false,aiQuestOnly:true};
emit('civweave:intention-planner-ready',{aiQuestOnly:true,deterministicQuestCreation:false});
})();