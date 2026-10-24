// Read-only index of Living School's canonical locally persisted journeys.
// A routed intention is not a curriculum, and an approved plan is not a generated lesson.
export const PLAN_KEY='civweave.chat.capability.pending.living-school.plan.v1';
export const QUEUE_KEY='civweave.chat.capability.pending.living-school.curriculum.v1';
export const LEARNING_PLAN_SCHEMA='civweave.learning-journey-plan.v2';
const clean=(value,max=1200)=>String(value??'').trim().slice(0,max);
const label=value=>clean(value,400).toLowerCase().replace(/\s+/g,' ');
const list=value=>Array.isArray(value)?value:[];
function matching(a,b){
  const ac=label(a?.capability||a?.request?.capability),bc=label(b?.capability||b?.request?.capability);
  return Boolean(ac&&bc&&ac===bc);
}
function approvedPlan(read){
  const plan=read(PLAN_KEY,null);
  return plan?.schema===LEARNING_PLAN_SCHEMA&&plan?.id&&['review','approved'].includes(plan.state)&&
    plan.request?.capability?plan:null;
}
function queuedPlan(read){
  const queued=read(QUEUE_KEY,null);
  return queued?.autoRun===true&&queued.approvedAt&&queued.approvedPlanId&&queued.capability?queued:null;
}
export function learningJourneySnapshot(read,schoolState={}){
  const readRecord=typeof read==='function'?read:()=>null;
  const plan=approvedPlan(readRecord),queue=queuedPlan(readRecord);
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
  if(plan){
    const matchReady=matching(current,plan.request)&&current.modules.length>=Math.max(1,Number(plan.request.count)||1);
    const failed=matching(recovery?.request,plan.request)&&['failed','partial'].includes(recovery?.status);
    const status=matchReady?'Curriculum ready':plan.state==='review'?'Review required':failed?'Generation failed · retry available':
      queue?.approvedPlanId===plan.id?'Queued for generation':'Approved · curriculum not generated';
    add('plan:'+plan.id,plan.request.title,plan.request.capability,status,
      matchReady?'current':plan.state==='review'?'review':'approved',plan.updatedAt,
      failed?clean(recovery?.unstructured?.error||'The last generation did not complete.',900):'');
  }
  if(queue&&!seen.has('plan:'+queue.approvedPlanId)){
    const ready=matching(current,queue)&&current.modules.length>=Math.max(1,Number(queue.count)||1);
    add('queue:'+queue.approvedPlanId,queue.title,queue.capability,ready?'Curriculum ready':'Queued · generation incomplete',
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
  const retry=plan?.state==='approved'&&!matching(current,plan.request)?
    {id:'plan:'+plan.id,request:{...plan.request},approvedAt:plan.approvedAt}:queue&&!matching(current,queue)?
    {id:'queue:'+queue.approvedPlanId,request:{...queue},approvedAt:queue.approvedAt}:null;
  const focus=(!current?(plan?.request||queue||null):null);
  return {rows:rows.slice(0,20),retry,focus,plan,queue};
}
