(()=>{
'use strict';
const VERSION='1.0.0-cerbanimo-quest-path-v266';
if(globalThis.CivweaveCerbanimoQuestPathV266?.version===VERSION)return;
const KEYS={campus:'civweave.working-campus.v1',intentions:'civweave.intentions.v127',handoff:'civweave.active-handoff.v1'};
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const read=(key,fallback)=>parse(localStorage.getItem(key),fallback);
const list=value=>Array.isArray(value)?value:[];
const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
const sourceActionId=(plan,path)=>`${plan.id}:${path.id}`;
function params(){return new URLSearchParams(location.search)}
function planFromLedger(id){const row=list(read(KEYS.intentions,[])).find(item=>item?.id===id||item?.plan?.id===id);return row?.plan||null}
function resolveContext(){
  const query=params(),handoff=read(KEYS.handoff,{}),campus=read(KEYS.campus,{});
  const weaveId=clean(query.get('weave')||handoff?.weaveId||campus?.plan?.id,220),pathId=clean(query.get('path')||handoff?.pathId,220);
  let plan=weaveId?planFromLedger(weaveId):null;
  if(!plan&&handoff?.plan?.id)plan=handoff.plan;
  if(!plan&&campus?.plan?.id)plan=campus.plan;
  if(!plan||plan.state==='review')return null;
  const paths=list(plan.paths).filter(path=>String(path?.realm||'').toLowerCase()==='cerbanimo');
  const path=paths.find(item=>String(item.id)===pathId)||paths[0]||null;
  return path?{plan,path}:null;
}
function proofRequirements(path){return list(path.steps).map(step=>`Attach inspectable evidence that this work unit is complete: ${clean(step,500)}`)}
function materialize(){
  const context=resolveContext(),api=globalThis.CivweaveCerbanimoQuestV144;
  if(!context||!api?.readState||!api?.createQuestFromInput||!api?.addQuest)return{ok:false,reason:'not-ready'};
  const {plan,path}=context,id=sourceActionId(plan,path),state=api.readState();
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
  }else if(state.preferences?.activeQuestId!==quest.id){
    state.preferences=state.preferences||{};state.preferences.activeQuestId=quest.id;api.writeState(state);
  }
  try{dispatchEvent(new CustomEvent('civweave:cerbanimo-quest-path-materialized',{detail:{weaveId:plan.id,pathId:path.id,questId:quest.id,sourceActionId:id}}))}catch{}
  return{ok:true,quest,context};
}
function boot(){
  let tries=0;
  const run=()=>{const result=materialize();if(result.ok||result.reason!=='not-ready'||tries++>80)return;setTimeout(run,50)};
  run();
}
const api=Object.freeze({version:VERSION,resolveContext,materialize,sourceActionId});
globalThis.CivweaveCerbanimoQuestPathV266=api;
if(document.readyState==='loading')addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();