// Read-only index of Living School's canonical locally persisted journeys.
// A routed intention is not a curriculum, and an approved plan is not a generated lesson.
export const PLAN_KEY='civweave.chat.capability.pending.living-school.plan.v1';
export const QUEUE_KEY='civweave.chat.capability.pending.living-school.curriculum.v1';
export const LEARNING_PLAN_SCHEMA='civweave.learning-journey-plan.v2';
export const PLAN_LIBRARY_KEY='civweave.living-school.learning-journey-plans.v1';
const clean=(value,max=1200)=>String(value??'').trim().slice(0,max);
const label=value=>clean(value,400).toLowerCase().replace(/\s+/g,' ');
const list=value=>Array.isArray(value)?value:[];
function matching(a,b){
  const ac=label(a?.capability||a?.request?.capability),bc=label(b?.capability||b?.request?.capability);
  return Boolean(ac&&bc&&ac===bc);
}
function storedPlans(read){
  const library=read(PLAN_LIBRARY_KEY,{});
  const listOfPlans=Array.isArray(library)?library:Array.isArray(library?.plans)?library.plans:[];
  const byId=new Map();
  for(const plan of listOfPlans){
    if(plan?.schema===LEARNING_PLAN_SCHEMA&&typeof plan.id==='string'&&plan.id&&
       plan.request?.capability&&['review','approved','generated','superseded','revision-requested','denied'].includes(plan.state))
      byId.set(plan.id,plan);
  }
  // Always migrate the old single-plan slot, including pre-registry installs.
  // Prefer the most recently saved version of the same plan.
  const active=read(PLAN_KEY,null);
  if(active?.schema===LEARNING_PLAN_SCHEMA&&active.id&&active.request?.capability){
    const prior=byId.get(active.id);
    if(!prior||(Date.parse(active.updatedAt)||0)>=(Date.parse(prior.updatedAt)||0))byId.set(active.id,active);
  }
  return [...byId.values()].sort((a,b)=>(Date.parse(b.updatedAt||b.createdAt)||0)-(Date.parse(a.updatedAt||a.createdAt)||0)).slice(0,50);
}
export function learningJourneyPlanById(read,id){
  return storedPlans(typeof read==='function'?read:()=>null).find(plan=>'plan:'+plan.id===id)||null;
}
function approvedPlan(read){
  const plan=read(PLAN_KEY,null);
  return plan?.schema===LEARNING_PLAN_SCHEMA&&plan?.id&&['review','approved'].includes(plan.state)&&
    plan.request?.capability?plan:null;
}
function queuedPlan(read){
  const queued=read(QUEUE_KEY,null);
  return queued?.approvedAt&&queued.approvedPlanId&&queued.capability?queued:null;
}
// Old Moss messages may contain complete, high-level plans that were later
// overwritten in the single pending-plan slot. Recover only explicit,
 // human-visible plan outlines, never infer approval from chat text.
const CHAT_THREAD_KEY='civweave.guide-thread.v350.living-school';
export function recoverableChatPlans(read){
  const thread=(typeof read==='function'?read:()=>null)(CHAT_THREAD_KEY,{});
  const messages=Array.isArray(thread?.messages)?thread.messages:[];
  const plans=[];
  for(let index=0;index<messages.length;index++){
    const msg=messages[index];
    if(msg?.role!=='assistant')continue;
    const content=clean(msg.text||msg.content,12000);
    const title=content.match(/Learning Journey plan:\s*[“"]([^”"\n]{3,240})[”"]/i)?.[1];
    const capability=content.match(/^Goal:\s*(.{3,900})$/im)?.[1];
    if(!title||!capability)continue;
    const modules=[];
    const rx=/^\s*\d+\.\s+(.+)\n\s*Focus:\s*(.+)\n\s*Demonstrate:\s*(.+)/gm;
    for(const match of content.matchAll(rx))if(modules.length<8)
      modules.push({title:clean(match[1],220),focus:clean(match[2],700),outcome:clean(match[3],700)});
    if(!modules.length)continue;
    const id='chat-recovered-'+clean(msg.id||String(index),100).replace(/[^a-zA-Z0-9-]/g,'-');
    const date=clean(msg.at||thread.updatedAt||'',90);
    plans.push({schema:LEARNING_PLAN_SCHEMA,id,state:'review',createdAt:date,updatedAt:date,
      request:{title:clean(title,240),capability:clean(capability,900),
        level:clean(content.match(/^Level:\s*(.+)$/im)?.[1]||'beginner',80),
        mode:clean(content.match(/^Mode:\s*(.+)$/im)?.[1]||'guided',80),
        proof:clean(content.match(/^Proof of capability:\s*(.+)$/im)?.[1]||'',1200),
        count:modules.length,intent:'new',newPath:true},
      modules,assumptions:[],authoring:{mode:'chat-history-recovery',recoveredFromMessage:id}});
  }
  return plans.slice(-40);
}

export function learningJourneySnapshot(read,schoolState={}){
  const readRecord=typeof read==='function'?read:()=>null;
  const plan=approvedPlan(readRecord),queue=queuedPlan(readRecord),plans=storedPlans(readRecord),recoverable=recoverableChatPlans(readRecord).filter(candidate=>!plans.some(plan=>matching(plan.request,candidate.request)));
  const current=schoolState?.school?.modules?.length?schoolState.school:null;
  const recovery=schoolState?.generationRecovery;
  const rows=[],seen=new Set();
  const add=(id,title,capability,status,kind,at='',details='')=>{
    id=clean(id,180);
    if(!id||seen.has(id))return;
    seen.add(id);
    rows.push({id,title:clean(title,240)||clean(capability,240)||'Untitled Learning Journey',
      capability:clean(capability,1200),status,kind,at:clean(at,90),details:clean(details,1200)});
  };
  for(const entry of plans){
    const ready=matching(current,entry.request)&&current.modules.length>=Math.max(1,Number(entry.request.count)||1);
    const failed=matching(recovery?.request,entry.request)&&['failed','partial'].includes(recovery?.status);
    const kind=entry.state==='approved'?'approved':entry.state==='generated'||ready?'current':entry.state==='review'?'review':entry.state;
    const status=entry.state==='generated'||ready?'Curriculum ready':
      entry.state==='review'?'Review required':entry.state==='approved'?(failed?'Generation failed · retry available':'Approved · select to generate'):
      entry.state==='revision-requested'?'Revision requested':entry.state==='superseded'?'Older plan · not approved':'Declined plan';
    add('plan:'+entry.id,entry.request.title,entry.request.capability,status,kind,entry.updatedAt||entry.createdAt,
      failed?clean(recovery?.unstructured?.error||'The last generation did not complete.',900):'');
  }
  for(const recovered of recoverable){
    add('recover:'+recovered.id,recovered.request.title,recovered.request.capability,
      'Recoverable from Moss chat · review required','recoverable',recovered.updatedAt,
      'Original approval cannot be confirmed; restore the outline and approve it again before generation');
  }
  if(queue&&!seen.has('plan:'+queue.approvedPlanId)){
    const ready=matching(current,queue)&&current.modules.length>=Math.max(1,Number(queue.count)||1);
    add('queue:'+queue.approvedPlanId,queue.title,queue.capability,ready?'Curriculum ready':'Approved · generation awaits selection',
      ready?'current':'queued',queue.queuedAt);
  }
  if(current)add('school:'+current.id,current.title,current.capability,
    current.modules.length<Math.max(1,Number(current.requestedModuleCount)||current.modules.length)?'Partial curriculum':'Curriculum ready',
    'current',current.updatedAt);
  for(const archived of list(schoolState.learningHistory).slice(-30).reverse()){
    const school=archived?.school;
    if(school?.id&&list(school.modules).length)
      add('archive:'+school.id,school.title,school.capability,'Archived curriculum','archived',archived.archivedAt||school.updatedAt);
  }
  if(recovery?.requestId&&['failed','partial'].includes(recovery.status)){
    const overlaps=rows.some(row=>['review','approved','queued'].includes(row.kind)&&
      matching(row,recovery.request));
    if(!overlaps)add('recovery:'+recovery.requestId,recovery.request?.title,recovery.request?.capability,
      recovery.status==='partial'?'Partial generation · recovery available':'Generation failed · retry available',
      'recovery',recovery.updatedAt,clean(recovery.unstructured?.error,900));
  }
  for(const event of list(schoolState.events).slice(-100).reverse()){
    if(!['living-school-new-path-replacement-rolled-back','living-school-shared-generation-rejected'].includes(event?.type))continue;
    const detail=event.detail||{};
    const capability=clean(detail.capability||detail.title,1200),title=clean(detail.title||capability,240);
    if(!capability||rows.some(row=>matching(row,{capability})&&
      (row.kind==='approved'||row.kind==='queued'||row.kind==='review'||row.kind==='recovery'||row.kind==='current')))continue;
    add('failure:'+event.id,title,capability,'Generation failed · retry available',
      'failed',event.at,clean(detail.error||detail.reason,900));
  }
  rows.sort((a,b)=>(Date.parse(b.at)||0)-(Date.parse(a.at)||0));
  const completedFor=request=>matching(current,request)&&current.modules.length>=Math.max(1,Number(request?.count)||1);
  const approvedEntries=plans.filter(entry=>entry.state==='approved'&&entry.approvedAt&&!completedFor(entry.request));
  const generatable=approvedEntries.map(entry=>({id:'plan:'+entry.id,request:{...entry.request},approvedAt:entry.approvedAt}));
  if(queue&&!plans.some(entry=>entry.id===queue.approvedPlanId)&&!completedFor(queue))
    generatable.push({id:'queue:'+queue.approvedPlanId,request:{...queue},approvedAt:queue.approvedAt});
  // Legacy single-item consumers continue to work; the UI uses *all* entries.
  const retry=generatable[0]||null;
  const failedRequest=recovery?.request?.capability&&['failed','partial'].includes(recovery.status)?recovery.request:null;
  const focus=(!current?(plan?.state==='approved'?plan.request:queue||failedRequest):null);
  return {rows:rows.slice(0,50),retry,generatable,plans,recoverable,focus,plan,queue};
}
