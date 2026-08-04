(()=>{
'use strict';
const VERSION='1.0.4-sol-semantic-v164';
const MODEL_ID='Xenova/all-MiniLM-L6-v2';
const ADAPTER_URL='/app/models/all-minilm-l6-v2/adapter.js';
const INTENTIONS_KEY='commonweave.intentions.v127';
const LIVING_KEY='commonweave.living-school.cabinet.v151';
const QUEST_KEY='cerbanimo.quest-engine.v144';
const MAX_DEPTH=3;
const root=globalThis;
if(root.CommonweaveSolV164?.version===VERSION)return;

const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const clone=value=>typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));
const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed==null?fallback:parsed}catch{return fallback}};
const now=()=>new Date().toISOString();
const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const words=value=>clean(value).toLowerCase().match(/[a-z0-9][a-z0-9'’-]*/g)||[];
const STOP=new Set('the a an and or but if then this that these those to of in on for from with by as is are was were be been being it its they them their you your we our i me my can could should would may might will do does did have has had about into through across at not no yes'.split(/\s+/));
const meaningful=value=>[...new Set(words(value).filter(word=>word.length>2&&!STOP.has(word)))];
const overlap=(left,right)=>{const a=new Set(meaningful(left)),b=new Set(meaningful(right));if(!a.size||!b.size)return 0;let hit=0;a.forEach(item=>{if(b.has(item))hit+=1});return hit/Math.sqrt(a.size*b.size)};
const dispatch=(name,detail)=>{try{root.dispatchEvent?.(new CustomEvent(name,{detail}))}catch{}};
const hasStorage=()=>typeof localStorage!=='undefined';
let adapterPromise=null;
let installed=false;
let planningBridgeTimer=0;

const ARCHETYPES=[
  {id:'learn-capability',label:'learn or teach a capability',text:'learn study understand practice teach explain curriculum lesson capability knowledge',realm:'living-school',phases:['Define the observable capability','Map prerequisite concepts and skills','Study a compact source set','Practice with guidance','Demonstrate independently','Review uncertainty and transfer']},
  {id:'build-project',label:'build or create a working project',text:'build create make implement code design develop prototype launch project game application',realm:'cerbanimo',phases:['Define the smallest visible result','List constraints and dependencies','Build the smallest working version','Test against acceptance criteria','Attach inspectable proof','Review, revise, and accept']},
  {id:'repair-system',label:'repair or improve an existing system',text:'repair fix debug improve restore optimize troubleshoot existing system broken performance regression',realm:'cerbanimo',phases:['Reproduce and bound the problem','Identify the highest-confidence cause','Protect currently working behavior','Apply the smallest repair','Run regression checks','Record proof and remaining risks']},
  {id:'acquire-resources',label:'acquire or exchange resources',text:'need materials supplies tools equipment borrow buy trade exchange resource inventory delivery budget',realm:'fellowfare',phases:['Specify the need and constraints','Inventory what is already available','Identify acceptable substitutes','Compare sources, cost, and logistics','Confirm consent and handoff','Record receipt and unresolved gap']},
  {id:'govern-coordinate',label:'coordinate people, consent, or governance',text:'organize coordinate team community agreement consent policy vote roles governance automation collective decision',realm:'anarchadia',phases:['Name the affected people and decision','Separate facts, preferences, and constraints','Define roles and consent boundaries','Choose a reviewable proposal','Record approval or objection','Set review and revision conditions']},
  {id:'research-decide',label:'research an uncertain decision',text:'research investigate compare evaluate decide evidence sources uncertainty options',realm:'living-school',phases:['State the decision and uncertainty','Gather a bounded source set','Classify source quality and disagreement','Compare options against criteria','Make a provisional decision','Record what would change the decision']}
];
const REALM_ATOMICS={
  'living-school':['State what the learner should be able to do','Check prior knowledge and vocabulary','Explain one central idea','Work through one guided example','Complete one fresh practice attempt','Submit evidence and name uncertainty'],
  cerbanimo:['State the observable result','Confirm dependencies and constraints','Perform the smallest work unit','Test the result against one criterion','Attach inspectable evidence','Accept, revise, or escalate'],
  fellowfare:['Name the exact need or offer','Record quantity, timing, and constraints','Check existing inventory and substitutes','Compare available sources','Confirm the exchange and delivery','Store a receipt or unresolved gap'],
  anarchadia:['Name the affected people','State the decision or rule','Identify consent and authority boundaries','Draft a reviewable proposal','Collect approval, objection, or revision','Record the decision and review date'],
  commonweave:['Clarify the intended outcome','Identify the realms involved','Choose the smallest useful next branch','Preserve assumptions and consent gates','Review evidence before activation','Continue, revise, or stop']
};
const EVIDENCE_TERMS=/\b(test|tests|passed|screenshot|photo|video|commit|file|artifact|receipt|measurement|log|record|witness|url|link|build|deployed|output|result)\b/i;
const CLAIM_ONLY=/\b(done|completed|finished|fixed|worked|successful|all requirements met)\b/i;

function lexicalRank(query,candidates,limit=8){
  return (Array.isArray(candidates)?candidates:[]).map((item,index)=>{
    const row=typeof item==='string'?{id:`candidate-${index+1}`,text:item}:item||{};
    const text=clean(row.text||row.label||row.description);
    const queryWords=meaningful(query),candidateWords=new Set(meaningful(text));
    let hits=0;queryWords.forEach(word=>{if(candidateWords.has(word))hits+=1});
    const phrase=clean(query).toLowerCase(),candidateLower=text.toLowerCase();
    const exact=phrase&&candidateLower.includes(phrase)?0.25:0;
    const score=Math.min(1,overlap(query,text)+exact+(hits>=2?0.08:0));
    return{id:clean(row.id,180)||`candidate-${index+1}`,score,source:'lexical'};
  }).sort((a,b)=>b.score-a.score).slice(0,Math.max(1,Math.min(16,Number(limit)||8)));
}
async function semanticRank(query,candidates,{limit=8,cacheKey='',timeoutMs=120000,semanticWaitMs=0}={}){
  const fallback=()=>({type:'rank',device:'lexical',dtype:'none',matches:lexicalRank(query,candidates,limit),fallback:true});
  try{
    if(!adapterPromise)adapterPromise=import(ADAPTER_URL).catch(error=>{adapterPromise=null;throw error});
    const adapter=await adapterPromise;
    if(typeof adapter.rank!=='function')return fallback();
    const task=adapter.rank(query,candidates,{limit,cacheKey,timeoutMs});
    if(semanticWaitMs>0){
      const timeout=new Promise(resolve=>setTimeout(()=>resolve(null),semanticWaitMs));
      const result=await Promise.race([task,timeout]);
      return result||fallback();
    }
    return await task;
  }catch(error){const result=fallback();result.error=clean(error?.message,500);return result}
}

function realmOf(value='commonweave'){
  const realm=clean(value,80).toLowerCase().replace(/_/g,'-');
  return REALM_ATOMICS[realm]?realm:'commonweave';
}
function nodeKind(realm,index,total){
  if(realm==='living-school')return index===total-1?'assessment':index<2?'lesson':'practice';
  if(realm==='fellowfare')return index===total-1?'receipt':'resource';
  if(realm==='anarchadia')return index===total-1?'decision':'governance';
  return index===total-1?'validation':'task';
}
function completionFor(realm,title){
  const label=clean(title,240)||'The step';
  if(realm==='living-school')return`${label} is explained or demonstrated with evidence another learner or reviewer can inspect.`;
  if(realm==='fellowfare')return`${label} has a confirmed source, handoff condition, and receipt or documented gap.`;
  if(realm==='anarchadia')return`${label} has an explicit decision, consent record, and review condition.`;
  return`${label} produces an observable result and at least one inspectable proof item.`;
}
function childStepsFor(realm,title,depth){
  const base=REALM_ATOMICS[realmOf(realm)]||REALM_ATOMICS.commonweave;
  const subject=clean(title,260).replace(/[.!?]+$/,'');
  const selected=depth>=2?[base[0],base[2],base[4]]:base;
  return selected.map((step,index)=>({
    id:uid('sol-node'),parentId:'',kind:nodeKind(realmOf(realm),index,selected.length),realm:realmOf(realm),
    title:index===0?`${step}: ${subject}`:step,objective:index===0?`Bound ${subject.toLowerCase()} before acting.`:`Advance ${subject.toLowerCase()} without inventing missing facts.`,
    completionEvidence:[completionFor(realmOf(realm),index===0?subject:step)],status:'proposed',confidence:.72,depth,children:[]
  }));
}
function pathNode(path,index){
  const realm=realmOf(path?.realm),steps=Array.isArray(path?.steps)&&path.steps.length?path.steps:[path?.title||`Path ${index+1}`];
  const node={id:clean(path?.id,160)||uid('sol-path'),parentId:'sol-root',kind:path?.type||'path',realm,title:clean(path?.title,260)||`Path ${index+1}`,objective:clean(path?.purpose||path?.completionCriteria,1200),completionEvidence:[clean(path?.completionCriteria,1200)||completionFor(realm,path?.title)],status:clean(path?.status,40)||'draft',confidence:.86,depth:1,children:[]};
  node.children=steps.slice(0,12).map((step,stepIndex)=>{
    const child={id:uid('sol-step'),parentId:node.id,kind:nodeKind(realm,stepIndex,steps.length),realm,title:clean(step,420),objective:`Advance ${clean(path?.title,220).toLowerCase()} through a bounded, reviewable action.`,completionEvidence:[completionFor(realm,step)],status:'proposed',confidence:.8,depth:2,children:[]};
    child.children=childStepsFor(realm,step,3).map(item=>({...item,parentId:child.id}));
    return child;
  });
  return node;
}
function enhancePlan(input,{source='deterministic-bridge'}={}){
  if(!input||typeof input!=='object')return input;
  const plan=clone(input);
  const existing=plan.semanticPlan;
  if(existing?.schema==='commonweave.sol-semantic-plan.v1'&&existing?.sourcePlanUpdatedAt===plan.updatedAt)return plan;
  const paths=Array.isArray(plan.paths)?plan.paths:[];
  const rootNode={id:'sol-root',parentId:null,kind:'outcome',realm:'commonweave',title:clean(plan.title||plan.wish,300)||'Review the intention',objective:clean(plan.outcome||plan.wish,1600),completionEvidence:[clean(plan.outcome,1600)||'The intended outcome has visible evidence and a reviewable route.'],status:clean(plan.state,40)||'review',confidence:.9,depth:0,children:paths.map(pathNode)};
  plan.semanticPlan={schema:'commonweave.sol-semantic-plan.v1',version:1,engine:'Sol',model:MODEL_ID,authority:'advisory-recursive-planning',source,sourcePlanUpdatedAt:plan.updatedAt||'',maxDepth:MAX_DEPTH,generatedAt:now(),root:rootNode,archetype:null,diagnostics:['Original paths and approval gates are preserved.','Only bounded children are generated.','No consequential action is activated by semantic similarity.']};
  plan.sol={engine:'Sol',version:VERSION,semanticPlanSchema:plan.semanticPlan.schema,nonRegressive:true,authority:'advisory'};
  return plan;
}
async function refinePlan(input,{text='',semanticWaitMs=0}={}){
  const plan=enhancePlan(input,{source:'semantic-refinement'});
  if(!plan?.semanticPlan)return plan;
  const query=clean(text||plan.wish||plan.title||plan.outcome,5000);
  const candidates=ARCHETYPES.map(item=>({id:item.id,text:`${item.label}. ${item.text}`}));
  const ranked=await semanticRank(query,candidates,{limit:3,cacheKey:'sol-archetypes-v1',semanticWaitMs});
  const best=ranked.matches?.[0],archetype=ARCHETYPES.find(item=>item.id===best?.id)||ARCHETYPES.find(item=>item.realm===realmOf(plan.paths?.[0]?.realm))||ARCHETYPES[1];
  plan.semanticPlan.archetype={id:archetype.id,label:archetype.label,realm:archetype.realm,score:Number(best?.score||0),device:ranked.device||'lexical'};
  plan.semanticPlan.suggestedPhases=archetype.phases.map((title,index)=>({id:uid('sol-phase'),kind:nodeKind(archetype.realm,index,archetype.phases.length),realm:archetype.realm,title,completionEvidence:[completionFor(archetype.realm,title)],status:'proposed',depth:1}));
  plan.semanticPlan.refinedAt=now();
  return plan;
}

function normalizeCriteria(criteria=[]){
  return (Array.isArray(criteria)?criteria:[]).slice(0,12).map((item,index)=>typeof item==='string'?{id:`criterion-${index+1}`,label:item,description:item,required:false,cues:[],examples:[],misconceptions:[]}:{id:clean(item?.id,120)||`criterion-${index+1}`,label:clean(item?.label||item?.description,240)||`Criterion ${index+1}`,description:clean(item?.description||item?.label,800),required:Boolean(item?.required),cues:(Array.isArray(item?.cues)?item.cues:[]).map(String).slice(0,10),examples:(Array.isArray(item?.examples)?item.examples:[]).map(String).slice(0,8),misconceptions:(Array.isArray(item?.misconceptions)?item.misconceptions:[]).map(String).slice(0,8)});
}
function criterionText(item){return[item.label,item.description,...item.cues,...item.examples].filter(Boolean).join('. ')}
async function evaluateLearning({prompt='',response='',criteria=[],deterministic=null,lessonExcerpt='',semanticWaitMs=0}={}){
  const rows=normalizeCriteria(criteria?.length?criteria:deterministic?.criteria||[]);
  const answer=clean(response,16000);
  const candidates=rows.map(item=>({id:item.id,text:criterionText(item)}));
  const ranked=await semanticRank(`${prompt}\n${answer}\n${lessonExcerpt}`,candidates,{limit:Math.max(1,rows.length),cacheKey:rows.length?`sol-learning-${rows.map(item=>item.id).join('-')}`:'',semanticWaitMs});
  const scores=new Map((ranked.matches||[]).map(item=>[item.id,Number(item.score||0)]));
  const coverage=rows.map(item=>{
    const semantic=scores.get(item.id)||0,lexical=overlap(answer,criterionText(item)),score=Math.max(semantic,lexical);
    const misconception=item.misconceptions.reduce((best,text)=>Math.max(best,overlap(answer,text)),0);
    const state=misconception>=.55?'misconception':score>=.58?'demonstrated':score>=.38?'partial':'missing';
    return{id:item.id,label:item.label,required:item.required,score:Math.round(score*100),semanticScore:Math.round(semantic*100),lexicalScore:Math.round(lexical*100),state,misconceptionScore:Math.round(misconception*100)};
  });
  const requiredMissing=coverage.filter(item=>item.required&&!['demonstrated'].includes(item.state));
  const demonstrated=coverage.filter(item=>item.state==='demonstrated').length;
  const partial=coverage.filter(item=>item.state==='partial').length;
  const firstGap=requiredMissing[0]||coverage.find(item=>item.state==='missing'||item.state==='partial'||item.state==='misconception');
  const deterministicAllows=Boolean(deterministic?.ok&&!deterministic?.uncertain);
  const semanticSupports=rows.length?requiredMissing.length===0&&demonstrated>=Math.ceil(rows.length*.6):answer.split(/\s+/).length>=12;
  const status=coverage.some(item=>item.state==='misconception')?'review':semanticSupports?'supported':demonstrated||partial?'partial':'insufficient';
  return{schema:'commonweave.sol-learning-review.v1',engine:'Sol',model:MODEL_ID,authority:'semantic-advisory',device:ranked.device||'lexical',status,coverage,requiredMissing:requiredMissing.map(item=>item.id),targetedFollowUp:firstGap?`Explain ${firstGap.label.toLowerCase()} in your own words and connect it to one concrete example or observable piece of evidence.`:'No semantic gap was detected. Preserve the original rubric and evidence checks.',semanticSupports,mayPass:Boolean(deterministicAllows&&semanticSupports),promoted:false,preserveDeterministicAuthority:true,deterministic:{ok:Boolean(deterministic?.ok),uncertain:Boolean(deterministic?.uncertain),score:Number(deterministic?.score||0),authority:deterministic?.authority||'unknown'},reviewedAt:now()};
}

function taskCriteria(task,quest){
  const own=Array.isArray(task?.acceptanceCriteria)?task.acceptanceCriteria:[];
  const questCriteria=Array.isArray(quest?.acceptanceCriteria)?quest.acceptanceCriteria:[];
  const proofRequirements=Array.isArray(quest?.proofRequirements)?quest.proofRequirements:[];
  return [...own,...questCriteria,...proofRequirements].filter(Boolean).slice(0,16).map((text,index)=>({id:`criterion-${index+1}`,label:clean(text,600),description:clean(text,600),required:true}));
}
async function evaluateTask({task={},quest={},semanticWaitMs=0}={}){
  const criteria=taskCriteria(task,quest),proofs=(Array.isArray(task?.proofs)?task.proofs:[]).map(item=>({kind:clean(item?.kind,60)||'note',label:clean(item?.label,220),value:clean(item?.value,6000)}));
  const proofText=proofs.map(item=>`${item.kind}: ${item.label}. ${item.value}`).join('\n');
  const candidates=criteria.map(item=>({id:item.id,text:item.description}));
  const ranked=await semanticRank(`${task?.title||''}\n${task?.description||''}\n${proofText}`,candidates,{limit:Math.max(1,criteria.length),cacheKey:criteria.length?`sol-task-${criteria.map(item=>item.label).join('|').slice(0,180)}`:'',semanticWaitMs});
  const scores=new Map((ranked.matches||[]).map(item=>[item.id,Number(item.score||0)]));
  const coverage=criteria.map(item=>{const semantic=scores.get(item.id)||0,lexical=overlap(proofText,item.description),score=Math.max(semantic,lexical);return{id:item.id,label:item.label,score:Math.round(score*100),state:score>=.58?'addressed':score>=.36?'partial':'missing'}});
  const missing=coverage.filter(item=>item.state!=='addressed');
  const evidenceKinds=[...new Set(proofs.map(item=>item.kind))];
  const claimOnly=proofs.length>0&&proofs.every(item=>CLAIM_ONLY.test(item.value)&&!EVIDENCE_TERMS.test(item.value)&&!['test','artifact','url','witness'].includes(item.kind));
  const status=!proofs.length?'no-evidence':claimOnly?'claim-only':criteria.length&&missing.length?'partial':proofs.length?'aligned':'review';
  return{schema:'commonweave.sol-task-review.v1',engine:'Sol',model:MODEL_ID,authority:'semantic-evidence-advisory',device:ranked.device||'lexical',status,coverage,missingCriteria:missing.map(item=>item.label),evidenceKinds,claimOnly,autoComplete:false,verified:false,requiresHumanOrDeterministicVerification:true,nextAction:!proofs.length?'Attach an inspectable proof item before review.':claimOnly?'Replace the completion claim with a test, artifact, link, measurement, receipt, or witness record.':missing.length?`Add proof for: ${missing[0].label}`:'The evidence is semantically aligned. Run the task’s deterministic or human verification before acceptance.',reviewedAt:now()};
}

function updateSavedIntention(item){
  if(!hasStorage()||!item?.id||!item?.plan)return;
  const rows=parse(localStorage.getItem(INTENTIONS_KEY),[]);if(!Array.isArray(rows))return;
  const index=rows.findIndex(row=>row?.id===item.id||row?.plan?.id===item.id);if(index<0)return;
  rows[index]={...rows[index],plan:item.plan,updatedAt:now()};
  localStorage.setItem(INTENTIONS_KEY,JSON.stringify(rows.slice(0,100)));
}
function patchPlanner(api){
  if(!api?.maybeCreate||api.__solSemanticInstalled)return api;
  const originalBuild=api.buildPlan?.bind(api),originalMaybe=api.maybeCreate.bind(api),originalRestore=api.restore?.bind(api);
  if(originalBuild)api.buildPlan=options=>enhancePlan(originalBuild(options));
  api.maybeCreate=options=>{
    const result=originalMaybe(options);if(!result?.plan)return result;
    const plan=enhancePlan(result.plan);result.plan=plan;
    if(result.item){result.item.plan=plan;updateSavedIntention(result.item)}
    result.response=result.response?{...result.response,semanticPlanning:{engine:'Sol',schema:plan.semanticPlan?.schema,authority:'advisory',maxDepth:MAX_DEPTH}}:result.response;
    return result;
  };
  if(originalRestore)api.restore=plan=>originalRestore(enhancePlan(plan));
  Object.defineProperty(api,'__solSemanticInstalled',{value:true});
  return api;
}
function installPlannerBridge(){
  const api=root.CommonweaveIntentionPlanner;if(api)patchPlanner(api);
  if(planningBridgeTimer)return;
  let attempts=0;planningBridgeTimer=setInterval(()=>{attempts+=1;if(root.CommonweaveIntentionPlanner){patchPlanner(root.CommonweaveIntentionPlanner);clearInterval(planningBridgeTimer);planningBridgeTimer=0}else if(attempts>80){clearInterval(planningBridgeTimer);planningBridgeTimer=0}},125);
}
function enrichStoredIntentions(){
  if(!hasStorage())return 0;
  const rows=parse(localStorage.getItem(INTENTIONS_KEY),[]);if(!Array.isArray(rows))return 0;
  let changed=0;
  const next=rows.map(item=>{if(item?.kind!=='weave-plan'||!item?.plan||item.plan?.semanticPlan?.schema==='commonweave.sol-semantic-plan.v1')return item;changed+=1;return{...item,plan:enhancePlan(item.plan),updatedAt:now()}});
  if(changed)localStorage.setItem(INTENTIONS_KEY,JSON.stringify(next.slice(0,100)));
  return changed;
}
function dispatchSyntheticStorage(key,value){
  try{root.dispatchEvent?.(new StorageEvent('storage',{key,newValue:value,storageArea:localStorage,url:location.href}))}catch{dispatch('commonweave:sol-storage-updated',{key})}
}
async function reviewLatestLiving(form){
  if(!hasStorage())return;
  await new Promise(resolve=>setTimeout(resolve,30));
  const state=parse(localStorage.getItem(LIVING_KEY),null);if(!state)return;
  const type=form?.dataset?.form;
  if(type==='assessment'){
    const module=state.school?.modules?.find(item=>item.id===state.activeModuleId)||state.school?.modules?.[0],progress=state.progress?.[module?.id],attempt=progress?.attempts?.at(-1);if(!module||!attempt||attempt.semanticReview)return;
    const review=await evaluateLearning({prompt:module.question,response:attempt.answer,criteria:attempt.evaluation?.criteria||[],deterministic:attempt.evaluation,lessonExcerpt:module.lesson,semanticWaitMs:600});
    attempt.semanticReview=review;attempt.solFeedback=review.targetedFollowUp;
  }else if(type==='final'){
    if(!state.final||state.final.semanticReview)return;
    const review=await evaluateLearning({prompt:'Explain capability, evidence, and uncertainty.',response:state.final.answer,criteria:state.final.evaluation?.criteria||[],deterministic:state.final.evaluation,lessonExcerpt:`Capability: ${state.school?.capability||''}. Artifact: ${state.practicum?.artifact||''}.`,semanticWaitMs:600});
    state.final.semanticReview=review;state.final.solFeedback=review.targetedFollowUp;
  }else return;
  const value=JSON.stringify(state);localStorage.setItem(LIVING_KEY,value);dispatchSyntheticStorage(LIVING_KEY,value);dispatch('commonweave:sol-learning-reviewed',{type});
}
async function reviewTaskFromControl(control){
  if(!hasStorage())return;
  await new Promise(resolve=>setTimeout(resolve,30));
  const state=parse(localStorage.getItem(QUEST_KEY),null);if(!state)return;
  const taskId=control?.closest?.('[data-task-id]')?.dataset?.taskId;if(!taskId)return;
  let quest=null,task=null;for(const candidate of state.quests||[]){const found=(candidate.tasks||[]).find(item=>item.id===taskId);if(found){quest=candidate;task=found;break}}
  if(!task||task.status!=='review')return;
  task.semanticValidation=await evaluateTask({task,quest,semanticWaitMs:600});
  const value=JSON.stringify(state);localStorage.setItem(QUEST_KEY,value);dispatch('cerbanimo:quest-engine-changed',{state,source:'Sol'});dispatch('commonweave:sol-task-reviewed',{questId:quest.id,taskId});
}
function bindDOM(){
  if(typeof document==='undefined'||document.documentElement.dataset.solSemanticBound==='true')return;
  document.documentElement.dataset.solSemanticBound='true';
  document.addEventListener('submit',event=>{const form=event.target?.closest?.('form[data-form="assessment"],form[data-form="final"]');if(form)reviewLatestLiving(form)},true);
  document.addEventListener('click',event=>{const control=event.target?.closest?.('[data-cq-action="submit-task"]');if(control)setTimeout(()=>reviewTaskFromControl(control),0)});
}
async function status(){
  let model={available:false,id:MODEL_ID};try{if(!adapterPromise)adapterPromise=import(ADAPTER_URL).catch(error=>{adapterPromise=null;throw error});const adapter=await adapterPromise;model=await adapter.status()}catch(error){model={available:false,id:MODEL_ID,error:clean(error?.message,500)}}
  return{version:VERSION,engine:'Sol',installed,model,maxDepth:MAX_DEPTH,authority:'advisory',bridges:{intention:Boolean(root.CommonweaveIntentionPlanner?.__solSemanticInstalled),living:typeof document!=='undefined',cerbanimo:typeof document!=='undefined'}};
}
function install(){
  if(installed)return true;installed=true;
  installPlannerBridge();enrichStoredIntentions();bindDOM();
  root.addEventListener?.('commonweave:intentions-changed',enrichStoredIntentions);
  root.addEventListener?.('storage',event=>{if(event.key===INTENTIONS_KEY)enrichStoredIntentions()});
  dispatch('commonweave:sol-ready',{version:VERSION,model:MODEL_ID});
  return true;
}

root.CommonweaveSolV164={version:VERSION,model:MODEL_ID,maxDepth:MAX_DEPTH,authority:'advisory',lexicalRank,rank:semanticRank,enhancePlan,refinePlan,evaluateLearning,evaluateTask,install,status,archetypes:clone(ARCHETYPES)};
if(typeof document==='undefined')install();else if(document.readyState==='loading')addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
