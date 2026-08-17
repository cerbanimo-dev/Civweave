/* confidence-weighted-validation-v1 */
(()=>{
'use strict';
if(globalThis.CivweaveProofProgressV158)return;
const VERSION='1.0.5-proof-progress-v158-anarchadia-quest';
const KEYS={
  campus:'civweave.working-campus.v1',
  intentions:'civweave.intentions.v127',
  inbox:'civweave.realm-inbox.v1',
  living:'civweave.living-school.cabinet.v151',
  cerbanimo:'cerbanimo.quest-engine.v144',
  fellowfare:'fellowfare.mvp.state.v3',
  anarchadia:'civweave.anarchadia.quest-work.v1'
};
const COMPLETE=new Set(['completed','complete','fulfilled','settled','accepted','delivered','verified','passed','closed']);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const read=(key,fallback)=>parse(localStorage.getItem(key),fallback);
const list=value=>Array.isArray(value)?value:[];
const clean=value=>String(value??'').trim().toLowerCase();
const now=()=>new Date().toISOString();
let syncing=false;
let observer=null;

function identifiers(record={}){
  return [
    record.weaveId,record.intentionId,record.planId,record.sourceWeaveId,
    record.context?.weaveId,record.context?.intentionId,record.source?.weaveId,
    record.metadata?.weaveId,record.payload?.weaveId,record.handoff?.weaveId
  ].filter(Boolean).map(String);
}
function related(record,plan,path){
  const ids=identifiers(record);
  if(ids.includes(String(plan.id)))return true;
  const title=clean(record.title||record.name||record.label);
  return Boolean(title&&(title===clean(path.title)||clean(path.title).includes(title)||title.includes(clean(path.title))));
}
function latest(records){return [...records].sort((a,b)=>Date.parse(b.updatedAt||b.completedAt||b.createdAt||0)-Date.parse(a.updatedAt||a.completedAt||a.createdAt||0))[0]||null}
function proofItems(record={}){return list(record.proofs||record.evidence||record.artifacts||record.receipts||record.submissions)}
function acceptedReview(review={}){return review.state==='accepted'||review.decision==='pass'||review.pass===true||review.accepted===true}

function livingCompletion(plan,path){
  const state=read(KEYS.living,null),school=state?.school;
  if(!school)return{complete:false,source:'living-school',reason:'No curriculum proof has been submitted.'};
  if(identifiers(school).length&&!related(school,plan,path))return{complete:false,source:'living-school',reason:'The current curriculum belongs to another Quest.'};
  const modules=list(school.modules);
  if(!modules.length)return{complete:false,source:'living-school',reason:'The curriculum has no modules to verify.'};
  const passed=modules.filter(module=>{const progress=state.progress?.[module.id]||{},weighted=progress.validationConfidence;if(weighted?.schema==='civweave.validation-confidence.v1')return weighted.verifiedPass===true;return progress.assessmentPassed===true||progress.verified===true||COMPLETE.has(clean(progress.status));});
  return{complete:passed.length===modules.length,source:'living-school',proofIds:passed.map(module=>module.id),reason:passed.length===modules.length?'Every curriculum module has weighted, accepted learning evidence.':`${passed.length}/${modules.length} curriculum modules have accepted evidence.`};
}
function cerbanimoCompletion(plan,path){
  const state=read(KEYS.cerbanimo,{}),quests=list(state.quests);
  const relatedQuests=quests.filter(quest=>related(quest,plan,path));
  const quest=latest(relatedQuests.length?relatedQuests:(quests.length===1?quests:[]));
  if(!quest)return{complete:false,source:'cerbanimo',reason:'No quest tied to this Quest has submitted proof.'};
  const tasks=list(quest.tasks);
  if(!tasks.length)return{complete:false,source:'cerbanimo',reason:'The quest has no tasks to verify.'};
  const proven=tasks.filter(task=>{
    const completed=COMPLETE.has(clean(task.status));
    const hasProof=proofItems(task).length>0||acceptedReview(task.review);
    return completed&&hasProof;
  });
  return{
    complete:proven.length===tasks.length,
    source:'cerbanimo',
    proofIds:proven.map(task=>task.id),
    reason:proven.length===tasks.length?'Every quest task has submitted and accepted proof.':`${proven.length}/${tasks.length} quest tasks have accepted proof.`
  };
}
function fellowfareCompletion(plan,path){
  const state=read(KEYS.fellowfare,{});
  const records=[...list(state.requests),...list(state.threads),...list(state.listings),...list(state.offers),...list(state.trades),...list(state.exchanges),...list(state.orders)];
  const matching=records.filter(record=>related(record,plan,path));
  const candidates=matching.length?matching:(records.length===1?records:[]);
  const complete=candidates.filter(record=>COMPLETE.has(clean(record.status)));
  return{
    complete:complete.length>0,
    source:'fellowfare',
    proofIds:complete.map(record=>record.id).filter(Boolean),
    reason:complete.length?'The material or service request has a completed exchange record.':'No fulfilled or settled exchange proof is attached to this Quest.'
  };
}
function anarchadiaRecords(){
  const state=read(KEYS.anarchadia,{records:[]});
  return Array.isArray(state)?state:list(state?.records);
}
function anarchadiaCompletion(plan,path){
  const records=anarchadiaRecords();
  const matching=records.filter(record=>record?.weaveId===plan.id&&(record?.pathId===path.id||clean(record?.title)===clean(path.title)));
  const record=latest(matching);
  if(!record)return{complete:false,source:'anarchadia',completedIndexes:[],reason:'No Anarchadia governance evidence has been recorded for this Quest path.'};
  const steps=list(record.steps),completedIndexes=steps.filter(step=>clean(step?.status)==='evidence-recorded'||COMPLETE.has(clean(step?.status))).map(step=>Number(step.index)).filter(Number.isFinite).sort((a,b)=>a-b);
  const total=Math.max(list(path.steps).length,steps.length);
  const allEvidence=total>0&&completedIndexes.length>=total;
  const approvalRequired=record.humanApprovalRequired===true||/\b(signed|signature|accepted|acceptance|consent|approve|approval|ratif|participant group|participants agree|membership agreement)\b/i.test(`${path.title||''} ${path.purpose||''} ${path.completionCriteria||''}`);
  const approvalComplete=record.humanApprovalComplete===true;
  const complete=allEvidence&&(!approvalRequired||approvalComplete)&&COMPLETE.has(clean(record.status));
  const reason=!allEvidence
    ?`${completedIndexes.length}/${total} governance checkpoints have recorded evidence.`
    :approvalRequired&&!approvalComplete
      ?`${completedIndexes.length}/${total} governance checkpoints have recorded evidence; explicit human approval is still required.`
      :complete
        ?'Every governance checkpoint has evidence and the required human approval record is present.'
        :'Every governance checkpoint has evidence; the path is waiting for its completion record.';
  return{complete,source:'anarchadia',completedIndexes,proofIds:completedIndexes.map(index=>`${record.id}:${index}`),reason};
}
function completionFor(path,plan){
  if(path.realm==='living-school')return livingCompletion(plan,path);
  if(path.realm==='cerbanimo')return cerbanimoCompletion(plan,path);
  if(path.realm==='fellowfare')return fellowfareCompletion(plan,path);
  if(path.realm==='anarchadia')return anarchadiaCompletion(plan,path);
  return{complete:false,source:path.realm,reason:'This path has no proof adapter.'};
}
function proofState(){
  const campus=read(KEYS.campus,null),plan=campus?.plan;
  if(!plan)return{campus,plan:null,paths:[]};
  return{campus,plan,paths:list(plan.paths).map(path=>({path,result:completionFor(path,plan)}))};
}
function updateIntentions(plan){
  const rows=list(read(KEYS.intentions,[]));
  let changed=false;
  for(const row of rows){
    if(row.id!==plan.id&&row.plan?.id!==plan.id)continue;
    row.plan=structuredClone(plan);row.state=plan.state;row.done=plan.state==='completed';row.updatedAt=plan.updatedAt;changed=true;
  }
  if(changed)localStorage.setItem(KEYS.intentions,JSON.stringify(rows));
}
function updateInbox(plan){
  const rows=list(read(KEYS.inbox,[]));
  let changed=false;
  for(const row of rows){
    if(row.payload?.weaveId!==plan.id)continue;
    const path=list(plan.paths).find(item=>item.id===row.payload?.path?.id)||list(plan.paths).find(item=>item.realm===row.target);
    if(!path)continue;
    row.payload.path=structuredClone(path);row.status=path.status==='completed'?'completed':row.status;row.updatedAt=plan.updatedAt;changed=true;
  }
  if(changed)localStorage.setItem(KEYS.inbox,JSON.stringify(rows));
}
function syncProgress(){
  if(syncing)return{changed:false,reason:'already syncing'};
  syncing=true;
  try{
    const snapshot=proofState(),campus=snapshot.campus,plan=snapshot.plan;
    if(!campus||!plan)return{changed:false,reason:'no active plan'};
    let changed=false;
    for(const {path,result} of snapshot.paths){
      const allIndexes=list(path.steps).map((_,index)=>index);
      const partial=list(result.completedIndexes).map(Number).filter(index=>Number.isInteger(index)&&index>=0&&index<allIndexes.length);
      const nextProgress=result.complete?allIndexes:[...new Set(partial)].sort((a,b)=>a-b);
      const nextStatus=result.complete?'completed':(nextProgress.length?'active':(plan.state==='review'?'ready':'active'));
      if(JSON.stringify(list(path.progress))!==JSON.stringify(nextProgress)){path.progress=nextProgress;changed=true}
      if(path.status!==nextStatus){path.status=nextStatus;changed=true}
      const nextProof={source:result.source,state:result.complete?'accepted':'required',proofIds:list(result.proofIds),reason:result.reason,checkedAt:now()};
      const comparable={...nextProof,checkedAt:path.proofProgress?.checkedAt||nextProof.checkedAt};
      if(JSON.stringify(path.proofProgress||{})!==JSON.stringify(comparable)){path.proofProgress=nextProof;changed=true}
    }
    const paths=list(plan.paths),allDone=paths.length>0&&paths.every(path=>path.status==='completed');
    const nextPlanState=allDone?'completed':(plan.state==='review'?'review':'active');
    if(plan.state!==nextPlanState){plan.state=nextPlanState;changed=true}
    if(changed){
      plan.updatedAt=now();campus.updatedAt=plan.updatedAt;
      localStorage.setItem(KEYS.campus,JSON.stringify(campus));
      updateIntentions(plan);updateInbox(plan);
      dispatchEvent(new CustomEvent('civweave:proof-progress-synced',{detail:{planId:plan.id,state:plan.state,paths:paths.map(path=>({id:path.id,realm:path.realm,status:path.status,progress:path.progress})),at:plan.updatedAt}}));
    }
    lockCheckpointInputs();
    return{changed,plan};
  }finally{syncing=false}
}
function lockCheckpointInputs(root=document){
  const campus=read(KEYS.campus,null),paths=list(campus?.plan?.paths);
  root.querySelectorAll?.('#workspace input[type="checkbox"][data-step]').forEach(input=>{
    const [pathId,indexText]=String(input.dataset.step||'').split(':'),path=paths.find(item=>item.id===pathId),index=Number(indexText),done=Boolean(path&&list(path.progress).includes(index));
    input.checked=done;input.disabled=true;input.tabIndex=-1;input.setAttribute('aria-disabled','true');input.setAttribute('aria-readonly','true');input.dataset.proofDriven='true';
    const label=input.closest('label');if(label){label.classList.toggle('done',done);label.dataset.proofState=done?'accepted':'required';label.title=done?'Completed from accepted proof.':'Read-only checkpoint. Submit proof in the assigned system to complete it.'}
  });
}
function blockManualToggle(event){
  const input=event.target?.closest?.('#workspace input[type="checkbox"][data-step]');
  if(!input)return;
  event.preventDefault();event.stopImmediatePropagation();lockCheckpointInputs();
}
function watchWorkspace(){
  const workspace=document.querySelector('#workspace');
  if(!workspace||observer)return;
  observer=new MutationObserver(()=>lockCheckpointInputs(workspace));
  observer.observe(workspace,{childList:true,subtree:true});
  lockCheckpointInputs(workspace);
}
function boot(){
  document.addEventListener('click',blockManualToggle,true);
  document.addEventListener('change',blockManualToggle,true);
  document.addEventListener('keydown',event=>{if([' ','Enter'].includes(event.key))blockManualToggle(event)},true);
  watchWorkspace();syncProgress();
  addEventListener('focus',syncProgress);
  addEventListener('visibilitychange',()=>{if(!document.hidden)syncProgress()});
  addEventListener('storage',event=>{if(Object.values(KEYS).includes(event.key))syncProgress()});
  for(const name of ['civweave:rewards-changed','civweave:reward-bridge','civweave:peer-review-recorded','civweave:domain-synced','civweave:anarchadia-quest-work-changed'])addEventListener(name,syncProgress);
}
if(document.readyState==='loading')addEventListener('DOMContentLoaded',boot,{once:true});else boot();
globalThis.CivweaveProofProgressV158=Object.freeze({VERSION,KEYS,proofState,syncProgress,lockCheckpointInputs,completionFor,anarchadiaCompletion});
})();