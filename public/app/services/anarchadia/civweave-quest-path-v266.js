(()=>{
'use strict';

const VERSION='1.0.1-anarchadia-quest-path-v266';
if(globalThis.AnarchadiaQuestPathV266?.version===VERSION)return;

const KEYS={
  campus:'civweave.working-campus.v1',
  intentions:'civweave.intentions.v127',
  inbox:'civweave.realm-inbox.v1',
  activeHandoff:'civweave.active-handoff.v1',
  questWork:'civweave.anarchadia.quest-work.v1'
};
const PANEL_ID='ac-quest-path-v266';
const STYLE_ID='ac-quest-path-style-v266';
const RECORDED='evidence-recorded';
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const read=(key,fallback)=>parse(localStorage.getItem(key),fallback);
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};
const list=value=>Array.isArray(value)?value:[];
const clone=value=>{try{return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value))}catch{return value}};
const now=()=>new Date().toISOString();
const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
let storePromise=null;
let renderQueued=false;

function questStore(){
  const raw=read(KEYS.questWork,{schema:'civweave.anarchadia.quest-work-store.v1',records:[]});
  if(Array.isArray(raw))return{schema:'civweave.anarchadia.quest-work-store.v1',records:raw};
  return{schema:'civweave.anarchadia.quest-work-store.v1',...(raw&&typeof raw==='object'?raw:{}),records:list(raw?.records)};
}
function saveQuestStore(store){return write(KEYS.questWork,{...store,schema:'civweave.anarchadia.quest-work-store.v1',records:list(store.records).slice(0,80),updatedAt:now()})}
function query(){return new URLSearchParams(location.search)}
function planFromLedger(id){
  const rows=list(read(KEYS.intentions,[]));
  const row=rows.find(item=>item?.id===id||item?.plan?.id===id);
  return row?.plan||null;
}
function resolveContext(){
  const params=query(),handoff=read(KEYS.activeHandoff,{}),campus=read(KEYS.campus,{});
  const weaveId=clean(params.get('weave')||handoff?.weaveId||campus?.plan?.id,240);
  const pathId=clean(params.get('path')||handoff?.pathId,240);
  let plan=null;
  if(weaveId)plan=planFromLedger(weaveId);
  if(!plan&&handoff?.plan?.id)plan=handoff.plan;
  if(!plan&&campus?.plan?.id)plan=campus.plan;
  if(!plan||plan.state==='review')return null;
  const paths=list(plan.paths).filter(path=>String(path?.realm||'').toLowerCase()==='anarchadia');
  let path=paths.find(item=>String(item.id)===pathId)||paths[0]||null;
  let synthetic=false;
  if(!path&&plan.governance){
    synthetic=true;
    path={
      id:`governance-${plan.id}`,
      type:'intention-passport',
      realm:'anarchadia',
      title:plan.governance.title||'Participation and consent agreement',
      purpose:plan.governance.purpose||'Review participation, boundaries, and commitments.',
      steps:list(plan.governance.agreements),
      completionCriteria:plan.governance.reviewQuestion||'Participation and consent have been explicitly reviewed.',
      status:plan.state==='active'?'ready':'review'
    };
  }
  if(!path)return null;
  return{plan,path,synthetic};
}
function acceptanceRequired(path){
  const text=`${path?.title||''} ${path?.purpose||''} ${path?.completionCriteria||''}`.toLowerCase();
  return /\b(signed|signature|accepted|acceptance|consent|approve|approval|ratif|participant group|participants agree|membership agreement)\b/.test(text);
}
function classifyStep(step=''){
  const text=clean(step,2000).toLowerCase();
  if(/\b(role|roles|responsibilit|maintenance|owner|mandate|recall|replaceable)\b/.test(text))return{route:'safeguards',kind:'roles',label:'Roles & safeguards'};
  if(/\b(consensus|decision|vote|voting|procedure|process|threshold|abstain|deliberat)\b/.test(text))return{route:'safeguards',kind:'procedure',label:'Procedure cards'};
  if(/\b(proposal|propose|motion|outcome)\b/.test(text))return{route:'proposals',kind:'proposal',label:'Proposals'};
  if(/\b(sign[- ]?up|membership|member agreement|participation agreement)\b/.test(text))return{route:'charter',kind:'membership',label:'Charter'};
  if(/\b(charter|purpose|usage|agreement|shared nature|harvest distribution)\b/.test(text))return{route:'charter',kind:'charter',label:'Charter'};
  if(/\b(consent|accept|signed|signature|approval|reviewing people|participant)\b/.test(text))return{route:'readiness',kind:'approval',label:'Readiness & approval'};
  if(/\b(dissent|exit|withdraw|boundary|rights|refusal)\b/.test(text))return{route:'safeguards',kind:'safeguards',label:'Safeguards'};
  return{route:'workbench',kind:'manual',label:'Governance workbench'};
}
function defaultRecord(context){
  const {plan,path}=context,at=now();
  return{
    id:uid('anarchadia-work'),schema:'civweave.anarchadia.quest-work.v1',weaveId:plan.id,pathId:path.id,
    title:path.title||'Anarchadia Quest path',completionCriteria:path.completionCriteria||'',status:'active',
    humanApprovalRequired:acceptanceRequired(path),humanApprovalComplete:false,workspaceRef:'',
    steps:list(path.steps).map((text,index)=>({index,text:clean(text,4000),status:'open',evidence:'',source:'',updatedAt:at})),
    createdAt:at,updatedAt:at
  };
}
function recordFor(context){
  const store=questStore();
  let record=store.records.find(item=>item?.weaveId===context.plan.id&&item?.pathId===context.path.id);
  if(!record){record=defaultRecord(context);store.records.unshift(record);saveQuestStore(store)}
  const expected=list(context.path.steps);
  record.steps=list(record.steps);
  expected.forEach((text,index)=>{
    if(!record.steps.some(step=>Number(step.index)===index))record.steps.push({index,text:clean(text,4000),status:'open',evidence:'',source:'',updatedAt:now()});
  });
  record.steps.sort((a,b)=>Number(a.index)-Number(b.index));
  record.completionCriteria=context.path.completionCriteria||record.completionCriteria||'';
  record.humanApprovalRequired=acceptanceRequired(context.path);
  return record;
}
function putRecord(record){
  const store=questStore(),index=store.records.findIndex(item=>item?.id===record.id||item?.weaveId===record.weaveId&&item?.pathId===record.pathId);
  record.updatedAt=now();
  if(index<0)store.records.unshift(record);else store.records[index]=record;
  saveQuestStore(store);
  syncCanonicalPlan(record);
  try{dispatchEvent(new CustomEvent('civweave:anarchadia-quest-work-changed',{detail:{record:clone(record),weaveId:record.weaveId,pathId:record.pathId,at:record.updatedAt}}))}catch{}
  return record;
}
function completedIndexes(record){return list(record.steps).filter(step=>step?.status===RECORDED).map(step=>Number(step.index)).filter(Number.isFinite).sort((a,b)=>a-b)}
function isComplete(record){
  const total=list(record.steps).length,done=completedIndexes(record).length;
  if(!total||done<total)return false;
  return record.humanApprovalRequired?record.humanApprovalComplete===true:true;
}
function proofReason(record){
  const done=completedIndexes(record).length,total=list(record.steps).length;
  if(done<total)return`${done}/${total} governance checkpoints have recorded evidence.`;
  if(record.humanApprovalRequired&&!record.humanApprovalComplete)return`${done}/${total} governance checkpoints have recorded evidence; participant acceptance is still required.`;
  return record.humanApprovalRequired?'Every governance checkpoint has evidence and the human approval gate is recorded.':'Every governance checkpoint has recorded evidence.';
}
function applyRecordToPlan(plan,record){
  if(!plan||plan.id!==record.weaveId)return false;
  const path=list(plan.paths).find(item=>item?.id===record.pathId);
  if(!path)return false;
  const progress=completedIndexes(record),complete=isComplete(record),at=now();
  path.progress=progress;
  path.status=complete?'completed':(progress.length?'active':'ready');
  path.proofProgress={source:'anarchadia',state:complete?'accepted':'required',proofIds:progress.map(index=>`${record.id}:${index}`),reason:proofReason(record),checkedAt:at};
  plan.updatedAt=at;
  if(plan.state!=='review')plan.state=list(plan.paths).length&&list(plan.paths).every(item=>item.status==='completed')?'completed':'active';
  return true;
}
function syncCanonicalPlan(record){
  const campus=read(KEYS.campus,{});
  if(campus?.plan&&applyRecordToPlan(campus.plan,record)){campus.updatedAt=campus.plan.updatedAt;write(KEYS.campus,campus)}
  const intentions=list(read(KEYS.intentions,[]));let changed=false;
  for(const item of intentions){
    if(item?.id!==record.weaveId&&item?.plan?.id!==record.weaveId)continue;
    const plan=item.plan||item;
    if(!applyRecordToPlan(plan,record))continue;
    item.plan=plan;item.state=plan.state;item.done=plan.state==='completed';item.updatedAt=plan.updatedAt;changed=true;
  }
  if(changed)write(KEYS.intentions,intentions);
  const inbox=list(read(KEYS.inbox,[]));let inboxChanged=false;
  for(const packet of inbox){
    if(packet?.payload?.weaveId!==record.weaveId)continue;
    const packetPath=packet?.payload?.path;
    if(packetPath?.id!==record.pathId)continue;
    const plan=campus?.plan||intentions.find(item=>item?.plan?.id===record.weaveId)?.plan;
    const path=list(plan?.paths).find(item=>item?.id===record.pathId);
    if(path){packet.payload.path=clone(path);packet.status=path.status==='completed'?'completed':packet.status;packet.updatedAt=now();inboxChanged=true}
  }
  if(inboxChanged)write(KEYS.inbox,inbox);
}
function ensureStoreModule(){
  if(!storePromise)storePromise=import('/app/services/anarchadia/src/store.js');
  return storePromise;
}
async function workspace(){
  try{return await (await ensureStoreModule()).loadWorkspace()}catch{return null}
}
function matchingCharterSections(ws,pattern){return list(ws?.charter?.sections).filter(section=>pattern.test(`${section?.title||''} ${section?.text||''}`.toLowerCase()))}
function evidenceFromWorkspace(ws,step){
  if(!ws)return null;
  const meta=classifyStep(step.text);
  if(meta.kind==='roles'&&list(ws.roles).length)return{evidence:`${list(ws.roles).length} role card${list(ws.roles).length===1?'':'s'} recorded in the Anarchadia safeguards workspace.`,source:'anarchadia:roles'};
  if(meta.kind==='procedure'&&list(ws.procedureCards).length)return{evidence:`${list(ws.procedureCards).length} decision procedure card${list(ws.procedureCards).length===1?'':'s'} recorded in the Anarchadia safeguards workspace.`,source:'anarchadia:procedure-cards'};
  if(meta.kind==='proposal'&&list(ws.proposals).length)return{evidence:`${list(ws.proposals).length} proposal record${list(ws.proposals).length===1?'':'s'} present in the Anarchadia proposal workspace.`,source:'anarchadia:proposals'};
  if(meta.kind==='membership'){
    const matches=matchingCharterSections(ws,/\b(member|membership|participat|sign[- ]?up|join|usage|shared)\b/);
    if(matches.length)return{evidence:`Charter section recorded: ${matches.map(section=>section.title||'Untitled section').slice(0,3).join(', ')}.`,source:'anarchadia:charter'};
  }
  if(meta.kind==='charter'){
    const sections=list(ws?.charter?.sections),hasDraft=clean(ws?.charter?.preamble)||sections.length;
    if(hasDraft)return{evidence:`Charter draft contains ${sections.length} section${sections.length===1?'':'s'}${clean(ws?.charter?.preamble)?' and a preamble':''}.`,source:'anarchadia:charter'};
  }
  if(meta.kind==='approval'&&ws?.humanApproval?.complete)return{evidence:'Human procedural approval is marked complete in the Anarchadia readiness workspace.',source:'anarchadia:human-approval'};
  if(meta.kind==='safeguards'&&(list(ws.rights).length||list(ws.roles).length||list(ws.procedureCards).length))return{evidence:'A related safeguards record exists in the Anarchadia workspace.',source:'anarchadia:safeguards'};
  return null;
}
async function inspectWorkbench(){
  const context=resolveContext();if(!context)return null;
  const record=recordFor(context),ws=await workspace();
  if(!ws){announce('Open or create the local Anarchadia workbench first.','warn');return record}
  record.workspaceRef=clean(ws?.meta?.communityRef,300);
  let added=0;
  for(const step of record.steps){
    const found=evidenceFromWorkspace(ws,step);
    if(found&&step.status!==RECORDED){step.status=RECORDED;step.evidence=found.evidence;step.source=found.source;step.updatedAt=now();added++}
  }
  record.humanApprovalComplete=Boolean(ws?.humanApproval?.complete);
  record.status=isComplete(record)?(record.humanApprovalRequired?'accepted':'completed'):'active';
  putRecord(record);render();
  announce(added?`Recorded evidence for ${added} checkpoint${added===1?'':'s'}.`:'No new matching workbench evidence was found.',added?'good':'neutral');
  return record;
}
function openRoute(route){location.hash=`#${route||'workbench'}`}
function recordManual(index){
  const context=resolveContext();if(!context)return;
  const record=recordFor(context),step=record.steps.find(item=>Number(item.index)===Number(index));if(!step)return;
  const input=document.querySelector(`[data-quest-evidence="${index}"]`),evidence=clean(input?.value,6000);
  if(!evidence){announce('Add a short evidence note or use “Check workbench” to attach an existing record.','warn');input?.focus();return}
  step.status=RECORDED;step.evidence=evidence;step.source='human-recorded';step.updatedAt=now();
  record.status=isComplete(record)?(record.humanApprovalRequired?'accepted':'completed'):'active';
  putRecord(record);render();announce('Evidence recorded.','good');
}
function reopenStep(index){
  const context=resolveContext();if(!context)return;
  const record=recordFor(context),step=record.steps.find(item=>Number(item.index)===Number(index));if(!step)return;
  step.status='open';step.evidence='';step.source='';step.updatedAt=now();record.status='active';putRecord(record);render();announce('Checkpoint reopened.','neutral');
}
async function refreshApproval(){
  const context=resolveContext();if(!context)return;
  const record=recordFor(context),ws=await workspace();
  record.humanApprovalComplete=Boolean(ws?.humanApproval?.complete);
  record.status=isComplete(record)?(record.humanApprovalRequired?'accepted':'completed'):'active';
  putRecord(record);render();
  announce(record.humanApprovalComplete?'Human approval record found.':'The readiness workspace does not yet record completed human approval.',record.humanApprovalComplete?'good':'warn');
}
function ensureStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
#${PANEL_ID}{margin:12px auto 18px;max-width:1180px;padding:14px;border:1px solid #ff4aa466;border-radius:18px;background:linear-gradient(145deg,#190d18f5,#0b1118f5);color:#f8f3f7;box-shadow:0 14px 42px #0006;font:14px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
#${PANEL_ID} *{box-sizing:border-box}#${PANEL_ID} header{display:flex;gap:12px;align-items:flex-start;justify-content:space-between}#${PANEL_ID} small{color:#ff72b4;font-weight:900;letter-spacing:.09em;text-transform:uppercase}#${PANEL_ID} h2{margin:3px 0 5px;font-size:20px}#${PANEL_ID} p{margin:4px 0;color:#c9bdc6}#${PANEL_ID} .acq266-meter{height:8px;background:#050609;border:1px solid #ffffff20;border-radius:999px;overflow:hidden;margin:12px 0}#${PANEL_ID} .acq266-meter span{display:block;height:100%;background:linear-gradient(90deg,#ff2b91,#f6d354);transition:width .2s ease}#${PANEL_ID} .acq266-actions{display:flex;gap:7px;flex-wrap:wrap}#${PANEL_ID} button{min-height:36px;padding:0 11px;border:1px solid #ffffff30;border-radius:10px;background:#ffffff0d;color:inherit;font-weight:800;cursor:pointer}#${PANEL_ID} button.primary{border-color:#ff4aa488;background:#ff4aa422}#${PANEL_ID} .acq266-steps{display:grid;gap:9px;margin-top:12px}#${PANEL_ID} .acq266-step{padding:11px;border:1px solid #ffffff18;border-radius:13px;background:#ffffff08}#${PANEL_ID} .acq266-step.done{border-color:#79e8c055;background:#79e8c00d}#${PANEL_ID} .acq266-step-head{display:flex;gap:9px;align-items:flex-start}#${PANEL_ID} .acq266-step-head b:first-child{display:grid;place-items:center;flex:0 0 26px;height:26px;border-radius:50%;background:#ffffff0d}#${PANEL_ID} .acq266-step-head div{flex:1}#${PANEL_ID} .acq266-step-head strong{display:block}#${PANEL_ID} .acq266-step-head em{display:block;margin-top:2px;color:#9faebc;font-size:11px;font-style:normal}#${PANEL_ID} textarea{width:100%;min-height:66px;margin:8px 0 6px;padding:8px;border:1px solid #ffffff24;border-radius:9px;background:#070a0f;color:#fff;resize:vertical;font:inherit}#${PANEL_ID} .acq266-proof{margin-top:7px;padding:7px 8px;border-left:3px solid #79e8c0;background:#79e8c00b;color:#cae8de;font-size:12px}#${PANEL_ID} .acq266-gate{margin-top:11px;padding:10px;border:1px solid #f6d35455;border-radius:12px;background:#f6d3540b}#${PANEL_ID} .acq266-status{font-size:11px;color:#aebac5}@media(max-width:700px){#${PANEL_ID}{margin:8px 8px 14px;padding:11px;border-radius:14px}#${PANEL_ID} header{display:block}#${PANEL_ID} header .acq266-actions{margin-top:8px}#${PANEL_ID} button{min-height:40px}}
`;
  document.head.append(style);
}
function announce(text,tone='neutral'){
  let node=document.querySelector(`#${PANEL_ID} [data-quest-status]`);if(!node)return;
  node.textContent=text;node.dataset.tone=tone;
}
function render(){
  const context=resolveContext();
  if(!context){document.getElementById(PANEL_ID)?.remove();return false}
  ensureStyle();
  const record=recordFor(context),done=completedIndexes(record).length,total=record.steps.length,percent=total?Math.round(done/total*100):0;
  let panel=document.getElementById(PANEL_ID);
  if(!panel){panel=document.createElement('section');panel.id=PANEL_ID;const app=document.getElementById('app');app?.parentNode?.insertBefore(panel,app)}
  if(!panel)return false;
  panel.innerHTML=`
    <header><div><small>ACTIVE QUEST · ANARCHADIA</small><h2>${esc(context.path.title||'Governance path')}</h2><p>${esc(context.path.purpose||'Work through the civic checkpoints and attach evidence as you go.')}</p></div><div class="acq266-actions"><button type="button" class="primary" data-quest-check>Check workbench</button><button type="button" data-quest-passport>Citizen Console</button></div></header>
    <div class="acq266-meter" aria-label="${percent} percent of governance checkpoints have evidence"><span style="width:${percent}%"></span></div>
    <div class="acq266-status"><b>${done}/${total}</b> checkpoints with evidence · <b>${esc(record.status)}</b> · <span data-quest-status>${esc(proofReason(record))}</span></div>
    <div class="acq266-steps">${record.steps.map(step=>{const meta=classifyStep(step.text),doneStep=step.status===RECORDED;return`<article class="acq266-step ${doneStep?'done':''}"><div class="acq266-step-head"><b>${doneStep?'✓':Number(step.index)+1}</b><div><strong>${esc(step.text)}</strong><em>${esc(meta.label)} · evidence remains a human record, not a legitimacy claim</em></div><button type="button" data-quest-route="${esc(meta.route)}">Open tool</button></div>${doneStep?`<div class="acq266-proof">${esc(step.evidence||'Evidence recorded.')}<br><small>${esc(step.source||'local record')}</small></div><div class="acq266-actions" style="margin-top:7px"><button type="button" data-quest-reopen="${Number(step.index)}">Reopen</button></div>`:`<textarea data-quest-evidence="${Number(step.index)}" placeholder="Evidence can be a local record, paper record, meeting note, file, or other inspectable reference.">${esc(step.evidence||'')}</textarea><div class="acq266-actions"><button type="button" class="primary" data-quest-record="${Number(step.index)}">Record evidence</button></div>`}</article>`}).join('')}</div>
    ${record.humanApprovalRequired?`<section class="acq266-gate"><small>ACCEPTANCE GATE</small><p>${esc(record.completionCriteria||'This path requires explicit human acceptance before it can complete.')}</p><p><b>${record.humanApprovalComplete?'Recorded':'Not yet recorded'}</b> · Anarchadia only records the declared approval procedure; it does not infer consent from silence, activity, or software use.</p><div class="acq266-actions"><button type="button" data-quest-route="readiness">Open readiness & approval</button><button type="button" data-quest-approval>Check approval record</button></div></section>`:''}`;
  panel.onclick=event=>{
    const target=event.target.closest('button');if(!target)return;
    if(target.dataset.questRoute)return openRoute(target.dataset.questRoute);
    if(target.hasAttribute('data-quest-check'))return inspectWorkbench();
    if(target.dataset.questRecord!=null)return recordManual(Number(target.dataset.questRecord));
    if(target.dataset.questReopen!=null)return reopenStep(Number(target.dataset.questReopen));
    if(target.hasAttribute('data-quest-approval'))return refreshApproval();
    if(target.hasAttribute('data-quest-passport'))location.assign('/app/anarchadia-console-v139.html?cabinet=1');
  };
  return true;
}
function queueRender(){if(renderQueued)return;renderQueued=true;queueMicrotask(()=>{renderQueued=false;render()})}
function start(){
  render();
  addEventListener('hashchange',queueRender);
  addEventListener('storage',event=>{if(Object.values(KEYS).includes(event.key))queueRender()});
  addEventListener('civweave:anarchadia-quest-work-changed',queueRender);
  document.documentElement.dataset.anarchadiaQuestPath='v266';
}

globalThis.AnarchadiaQuestPathV266=Object.freeze({version:VERSION,KEYS,resolveContext,recordFor,inspectWorkbench,render,syncCanonicalPlan,classifyStep,acceptanceRequired});
document.readyState==='loading'?addEventListener('DOMContentLoaded',start,{once:true}):start();
})();