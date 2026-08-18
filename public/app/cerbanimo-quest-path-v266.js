(()=>{
'use strict';
const VERSION='1.0.1-cerbanimo-quest-path-v266-lazy-boot';
if(globalThis.CivweaveCerbanimoQuestPathV266?.version===VERSION)return;
const KEYS={campus:'civweave.working-campus.v1',intentions:'civweave.intentions.v127',handoff:'civweave.active-handoff.v1'};
const MATERIALIZED_KEY='civweave.cerbanimo.quest-path.materialized.v1';
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const storageGet=key=>{try{return localStorage.getItem(key)}catch{return null}};
const storageSet=(key,value)=>{try{localStorage.setItem(key,value);return true}catch{return false}};
const read=(key,fallback)=>parse(storageGet(key),fallback);
const list=value=>Array.isArray(value)?value:[];
const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
const sourceActionId=(plan,path)=>`${plan.id}:${path.id}`;
function params(){return new URLSearchParams(location.search)}
function planFromLedger(id){const row=list(read(KEYS.intentions,[])).find(item=>item?.id===id||item?.plan?.id===id);return row?.plan||null}
function resolveContext(){
  const query=params(),handoff=read(KEYS.handoff,{}),campus=read(KEYS.campus,{});
  const requestedWeave=clean(query.get('weave'),220),requestedPath=clean(query.get('path'),220);
  const weaveId=requestedWeave||clean(handoff?.weaveId||campus?.plan?.id,220),pathId=requestedPath||clean(handoff?.pathId,220);
  let plan=null;
  if(handoff?.plan?.id&&String(handoff.plan.id)===weaveId)plan=handoff.plan;
  if(!plan&&campus?.plan?.id&&String(campus.plan.id)===weaveId)plan=campus.plan;
  if(!plan&&weaveId)plan=planFromLedger(weaveId);
  if(!plan||plan.state==='review')return null;
  const paths=list(plan.paths).filter(path=>String(path?.realm||'').toLowerCase()==='cerbanimo');
  const path=paths.find(item=>String(item.id)===pathId)||paths[0]||null;
  return path?{plan,path,explicit:Boolean(requestedWeave||requestedPath)}:null;
}
function proofRequirements(path){return list(path.steps).map(step=>`Attach inspectable evidence that this work unit is complete: ${clean(step,500)}`)}
function materialize({force=false}={}){
  const context=resolveContext();
  if(!context)return{ok:false,reason:'no-context'};
  const {plan,path,explicit}=context,id=sourceActionId(plan,path);
  if(!force&&!explicit&&storageGet(MATERIALIZED_KEY)===id)return{ok:true,reason:'already-materialized',context,sourceActionId:id};
  const api=globalThis.CivweaveCerbanimoQuestV144;
  if(!api?.readState||!api?.createQuestFromInput||!api?.addQuest)return{ok:false,reason:'not-ready'};
  const state=api.readState();
  let quest=list(state.quests).find(item=>item?.sourceActionId===id);
  if(!quest){
    quest=api.createQuestFromInput({
      title:path.title||'Quest work path',
      objective:path.purpose||plan.outcome||plan.wish||path.title||'',
      description:[path.purpose,path.completionCriteria&&`Completion: ${path.completionCriteria}`].filter(Boolean).join('\n\n'),
      steps:list(path.steps),
      acceptanceCriteria:path.completionCriteria?[path.completionCriteria]:[],
      proofRequirements:proofRequirements(path),
      source:'civweave-quest-path',sourceActionId:id,sequential:true
    });
    const result=api.addQuest(quest,{activate:true});
    if(result?.ok===false)return result;
    quest=result?.quest||quest;
  }else if((explicit||force)&&state.preferences?.activeQuestId!==quest.id){
    state.preferences=state.preferences||{};state.preferences.activeQuestId=quest.id;api.writeState(state);
  }
  storageSet(MATERIALIZED_KEY,id);
  try{dispatchEvent(new CustomEvent('civweave:cerbanimo-quest-path-materialized',{detail:{weaveId:plan.id,pathId:path.id,questId:quest.id,sourceActionId:id}}))}catch{}
  return{ok:true,quest,context};
}
let bootScheduled=false;
function scheduleBoot(){
  if(bootScheduled)return;
  bootScheduled=true;
  const run=()=>{bootScheduled=false;const result=materialize();if(result.reason==='not-ready')console.warn('[Cerbanimo quest path] Quest engine was unavailable after page load; leaving materialization for an explicit retry.')};
  const idle=()=>typeof requestIdleCallback==='function'?requestIdleCallback(run,{timeout:1500}):setTimeout(run,0);
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>requestAnimationFrame(idle));else idle();
}
const api=Object.freeze({version:VERSION,resolveContext,materialize,scheduleBoot,sourceActionId});
globalThis.CivweaveCerbanimoQuestPathV266=api;
addEventListener('civweave:cerbanimo-quest-path-request',()=>materialize({force:true}));
if(document.readyState==='complete')scheduleBoot();else addEventListener('load',scheduleBoot,{once:true});
})();
