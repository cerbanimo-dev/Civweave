/* confidence-weighted-validation-v1 */
(()=>{
'use strict';
if(globalThis.CivweaveProofProgressV158)return;
const VERSION='1.0.9-proof-progress-v158-stored-quest-projection';
const KEYS={
  campus:'civweave.working-campus.v1',
  intentions:'civweave.intentions.v127',
  inbox:'civweave.realm-inbox.v1',
  living:'civweave.living-school.cabinet.v151',
  cerbanimo:'cerbanimo.quest-engine.v144',
  fellowfare:'fellowfare.mvp.state.v3',
  fellowfareMarket:'fellowfare.marketplace.v2',
  fellowfareQuest:'civweave.fellowfare.quest-work.v1',
  anarchadia:'civweave.anarchadia.quest-work.v1'
};
const COMPLETE=new Set(['completed','complete','fulfilled','settled','accepted','delivered','verified','passed','closed']);
const TERMINAL=new Set(['abandoned','archived','cancelled','canceled']);
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
  const exact=`${plan.id}:${path.id}`;
  if([record?.sourceActionId,record?.sourceId,record?.source?.sourceId].some(value=>String(value||'')===exact))return true;
  const ids=identifiers(record);
  const paths=[record?.pathId,record?.context?.pathId,record?.metadata?.pathId,record?.payload?.pathId,record?.payload?.path?.id,record?.handoff?.pathId].filter(Boolean).map(String);
  return ids.includes(String(plan.id))&&paths.includes(String(path.id));
}
function latest(records){return [...records].sort((a,b)=>Date.parse(b.updatedAt||b.completedAt||b.createdAt||0)-Date.parse(a.updatedAt||a.completedAt||a.createdAt||0))[0]||null}
function proofItems(record={}){return list(record.proofs||record.evidence||record.artifacts||record.receipts||record.submissions)}

function livingCompletion(plan,path){
  const state=read(KEYS.living,null),school=state?.school;
  if(!school)return{complete:false,source:'living-school',reason:'No curriculum proof has been submitted.'};
  if(!related(school,plan,path))return{complete:false,source:'living-school',reason:'The current curriculum has no exact link to this Quest path.'};
  const modules=list(school.modules);
  if(!modules.length)return{complete:false,source:'living-school',reason:'The curriculum has no modules to verify.'};
  const passed=modules.filter(module=>{const progress=state.progress?.[module.id]||{},weighted=progress.validationConfidence;if(weighted?.schema==='civweave.validation-confidence.v1')return weighted.verifiedPass===true;return progress.assessmentPassed===true||progress.verified===true||COMPLETE.has(clean(progress.status));});
  return{complete:passed.length===modules.length,source:'living-school',proofIds:passed.map(module=>module.id),reason:passed.length===modules.length?'Every curriculum module has weighted, accepted learning evidence.':`${passed.length}/${modules.length} curriculum modules have accepted evidence.`};
}
function cerbanimoCompletion(plan,path){
  const state=read(KEYS.cerbanimo,{}),quests=list(state.quests),exact=`${plan.id}:${path.id}`;
  const quest=quests.find(quest=>String(quest?.sourceActionId||'')===exact);
  if(!quest)return{complete:false,source:'cerbanimo',completedIndexes:[],reason:'No quest tied to this Quest has submitted proof.'};
  const tasks=list(quest.tasks);
  if(!tasks.length)return{complete:false,source:'cerbanimo',completedIndexes:[],reason:'The quest has no tasks to verify.'};
  const completedIndexes=[];
  const proven=tasks.filter((task,index)=>{
    const accepted=task.status==='completed'&&proofItems(task).length>0&&task.review?.state==='accepted'&&task.review?.validator==='ai';
    if(accepted)completedIndexes.push(index);
    return accepted;
  });
  const finalAccepted=quest.status==='completed'&&quest.review?.state==='accepted'&&quest.review?.validator==='ai';
  return{
    complete:proven.length===tasks.length&&finalAccepted,
    source:'cerbanimo',
    completedIndexes,
    proofIds:proven.map(task=>task.id),
    reason:proven.length===tasks.length?(finalAccepted?'Every Endeavor work unit and final review have accepted independent AI proof.':'Every Endeavor work unit has accepted AI proof; final independent AI acceptance is still required.'):`${proven.length}/${tasks.length} Endeavor work units have accepted independent AI proof.`
  };
}
function fellowfareQuestRecords(){const state=read(KEYS.fellowfareQuest,{records:[]});return Array.isArray(state)?state:list(state?.records)}
function fellowfareCompletion(plan,path){
  const questRecord=latest(fellowfareQuestRecords().filter(record=>record?.weaveId===plan.id&&record?.pathId===path.id));
  if(questRecord){
    const steps=list(questRecord.steps),completedIndexes=steps.filter(step=>clean(step?.status)==='evidence-recorded'||COMPLETE.has(clean(step?.status))).map(step=>Number(step.index)).filter(Number.isFinite).sort((a,b)=>a-b);
    const total=Math.max(list(path.steps).length,steps.length),complete=total>0&&completedIndexes.length>=total&&COMPLETE.has(clean(questRecord.status));
    return{complete,source:'fellowfare',completedIndexes,proofIds:completedIndexes.map(index=>`${questRecord.id}:${index}`),reason:complete?'Every resource checkpoint has recorded evidence.':`${completedIndexes.length}/${total} resource checkpoints have recorded evidence.`};
  }
  const legacy=read(KEYS.fellowfare,{}),market=read(KEYS.fellowfareMarket,{});
  const records=[...list(legacy.requests),...list(legacy.threads),...list(legacy.listings),...list(legacy.offers),...list(legacy.trades),...list(legacy.exchanges),...list(legacy.orders),...list(market.listings),...list(market.orders)];
  const completeRows=records.filter(record=>related(record,plan,path)&&COMPLETE.has(clean(record.status)));
  return{
    complete:completeRows.length>0,
    source:'fellowfare',
    proofIds:completeRows.map(record=>record.id).filter(Boolean),
    reason:completeRows.length?'The material or service request has a completed exchange record.':'No fulfilled or settled exchange proof is attached to this Quest.'
  };
}
function anarchadiaRecords(){
  const state=read(KEYS.anarchadia,{records:[]});
  return Array.isArray(state)?state:list(state?.records);
}
function anarchadiaCompletion(plan,path){
  const records=anarchadiaRecords();
  const matching=records.filter(record=>record?.weaveId===plan.id&&record?.pathId===path.id);
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
function storedPlans(){
  const campus=read(KEYS.campus,null),plans=new Map();
  if(campus?.plan?.id)plans.set(String(campus.plan.id),campus.plan);
  for(const row of list(read(KEYS.intentions,[])).slice(0,100))if(row?.plan?.id&&!plans.has(String(row.plan.id)))plans.set(String(row.plan.id),row.plan);
  return{campus,plans:[...plans.values()]};
}
function planCompletion(planId){
  const plan=storedPlans().plans.find(plan=>String(plan.id)===String(planId)),state=clean(plan?.state),terminal=TERMINAL.has(state);
  if(!plan)return{planId:String(planId||''),state:'missing',terminal:false,complete:false,paths:[],reason:'No saved Quest has that exact identity.'};
  const paths=list(plan.paths).map(path=>({pathId:path.id,realm:path.realm,...completionFor(path,plan)}));
  const complete=!terminal&&['active','completed'].includes(state)&&paths.length>0&&paths.every(path=>path.complete===true);
  return{planId:plan.id,state,terminal,complete,paths,reason:terminal?'The Quest was explicitly stopped.':state==='review'?'The Quest still requires explicit activation.':complete?'Every path has current accepted native proof.':'Accepted native proof is still required for every path.'};
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
    const path=list(plan.paths).find(item=>item.id===row.payload?.path?.id);
    if(!path)continue;
    row.payload.path=structuredClone(path);row.status=path.status==='completed'?'completed':row.status==='completed'?(plan.state==='review'?'review':'accepted'):row.status;row.updatedAt=plan.updatedAt;changed=true;
  }
  if(changed)localStorage.setItem(KEYS.inbox,JSON.stringify(rows));
}
function syncProgress(){
  if(syncing)return{changed:false,reason:'already syncing'};
  syncing=true;
  try{
    const {campus,plans}=storedPlans(),changedPlans=[];
    for(const plan of plans){
    if(TERMINAL.has(clean(plan.state)))continue;
    let changed=false;
    for(const path of list(plan.paths)){
      const result=completionFor(path,plan);
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
    const nextPlanState=plan.state==='review'?'review':allDone?'completed':'active';
    if(plan.state!==nextPlanState){plan.state=nextPlanState;changed=true}
    if(changed){
      plan.updatedAt=now();
      if(campus?.plan?.id===plan.id){campus.plan=plan;campus.updatedAt=plan.updatedAt;localStorage.setItem(KEYS.campus,JSON.stringify(campus))}
      updateIntentions(plan);updateInbox(plan);
      changedPlans.push(plan.id);
      dispatchEvent(new CustomEvent('civweave:proof-progress-synced',{detail:{planId:plan.id,state:plan.state,paths:paths.map(path=>({id:path.id,realm:path.realm,status:path.status,progress:path.progress})),at:plan.updatedAt}}));
    }
    }
    lockCheckpointInputs();
    return{changed:changedPlans.length>0,plan:campus?.plan||null,changedPlans};
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
  for(const name of ['civweave:rewards-changed','civweave:reward-bridge','civweave:peer-review-recorded','civweave:domain-synced','civweave:intentions-changed','civweave:working-campus-plan-built','civweave:anarchadia-quest-work-changed','civweave:fellowfare-quest-work-changed','civweave:cerbanimo-quest-path-materialized','cerbanimo:quest-engine-changed','fellowfare:marketplace-changed'])addEventListener(name,syncProgress);
}
if(document.readyState==='loading')addEventListener('DOMContentLoaded',boot,{once:true});else boot();
globalThis.CivweaveProofProgressV158=Object.freeze({VERSION,KEYS,proofState,planCompletion,syncProgress,lockCheckpointInputs,completionFor,cerbanimoCompletion,fellowfareCompletion,anarchadiaCompletion});
})();
