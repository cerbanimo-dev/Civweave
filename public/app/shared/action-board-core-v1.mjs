// Civweave Action Board v1: read-only Quest projection and local personal-action rules.
// No Quest activation, progress, proof, publishing, or server writes occur here.
export const ACTIONS_KEY = 'civweave.action-board.v1';
export const INTENTIONS_KEY = 'civweave.intentions.v127';
export const CAMPUS_KEY = 'civweave.working-campus.v1';
export const DONE = new Set(['accepted','completed','complete','done']);
export const VIEWS = ['inbox','next','focus','waiting','scheduled','someday','done'];
const clean = (v,n=500) => String(v ?? '').trim().slice(0,n);
const list = v => Array.isArray(v) ? v : [];
const state = v => clean(v,40).toLowerCase();
const finiteMinutes = v => Number.isFinite(Number(v)) && Number(v)>0 && Number(v)<=10080 ? Math.ceil(Number(v)) : null;
const asDate = v => /^\d{4}-\d{2}-\d{2}/.test(clean(v,40)) && !Number.isNaN(Date.parse(v)) ? clean(v,40) : '';
const deps = v => {
  const object = v && typeof v==='object' ? v : {};
  const value = Object.prototype.hasOwnProperty.call(object,'dependsOn') ? object.dependsOn : Object.prototype.hasOwnProperty.call(object,'dependencies') ? object.dependencies : object.dependencyIds;
  return [...new Set((Array.isArray(value)?value:value?[value]:[]).slice(0,24).map(x=>clean(typeof x==='string'?x:x?.id||x?.taskId,160)).filter(Boolean))];
};
const isDone = v => DONE.has(state(v));
export function normalizeAction(value, now=new Date().toISOString()){
  const v=value && typeof value==='object'?value:{};
  const status=['inbox','next','waiting','scheduled','someday','done'].includes(state(v.status))?state(v.status):'inbox';
  return {id:clean(v.id,140), title:clean(v.title,300), notes:clean(v.notes,4000), status,
    createdAt:asDate(v.createdAt)||now, updatedAt:asDate(v.updatedAt)||now,
    startAt:asDate(v.startAt), dueAt:asDate(v.dueAt),
    minutes:finiteMinutes(v.minutes), energy:['low','medium','high'].includes(state(v.energy))?state(v.energy):'',
    context:clean(v.context,100), waitingFor:clean(v.waitingFor,300),
    completedAt:status==='done'?(asDate(v.completedAt)||now):'', focus:Boolean(v.focus)};
}
export function normalizeStore(raw){
  const v=raw && typeof raw==='object' && !Array.isArray(raw)?raw:{};
  const seen=new Set();
  return {version:1, actions:list(v.actions).slice(0,1000).map(x=>normalizeAction(x)).filter(x=>{
    if(!x.id||!x.title||seen.has(x.id))return false;seen.add(x.id);return true;
  }), focusedQuestKeys:list(v.focusedQuestKeys).filter(x=>typeof x==='string').slice(0,400).map(x=>clean(x,400))};
}
export function mergeSavedPlans(ledger,campus){
  const byId=new Map();
  for(const row of list(ledger)){
    if(row?.kind!=='weave-plan'||!row.plan||typeof row.plan!=='object')continue;
    const p=row.plan,id=clean(p.id||row.id,160);
    if(id)byId.set(id,p);
  }
  const current=campus?.plan,id=clean(current?.id,160);
  // The canonical ledger wins if both locations contain this Quest.
  if(id&&!byId.has(id))byId.set(id,current);
  return [...byId.values()];
}
function titleOf(step){
  return clean(typeof step==='string'?step:step?.title||step?.name||step?.label||step?.description,300);
}
export function projectPlanActions(plans, now=new Date().toISOString()){
  const output=[],nowMs=Date.parse(now);
  for(const plan of list(plans).slice(0,100)){
    if(!plan||!plan.id||state(plan.state)==='completed')continue;
    const paths=list(plan.paths).slice(0,64),index=new Map(),records=[];
    function register(ref,owner){
      if(!ref)return;
      const rows=index.get(ref)||[];rows.push(owner);index.set(ref,rows);
    }
    paths.forEach((path,pi)=>{
      if(!path||typeof path!=='object')return;
      const pathId=clean(path.id,160),stepRows=list(path.steps?.length?path.steps:path.tasks).slice(0,120);
      const pathNode={ref:pathId,kind:'path',path,pi,done:isDone(path.status),dependencies:deps(path)};
      register(pathId,pathNode);
      records.push(pathNode);
      const progress=new Set(list(path.progress).filter(Number.isInteger));
      stepRows.forEach((step,si)=>{
        const stepId=clean(typeof step==='object'?step?.id||step?.taskId:'',160);
        const s=step && typeof step==='object'?step:{title:step};
        const node={ref:stepId,kind:'step',path,step:s,pi,si,done:progress.has(si)||isDone(s.status),dependencies:deps(s),pathNode};
        records.push(node);register(stepId,node);
      });
    });
    for(const node of records){
      if(node.kind==='path'&&records.some(x=>x.kind==='step'&&x.pi===node.pi))continue;
      if(node.done||(node.kind==='step'&&node.pathNode.done))continue;
      const path=node.path,step=node.kind==='step'?node.step:path;
      const title=node.kind==='step'?titleOf(step):clean(path.title,300);
      if(!title)continue;
      const sourceState=state(step.status||path.status);
      const blocked=[];
      if(state(plan.state)!=='active')blocked.push('Quest must be activated through its existing review process');
      if(['blocked','waiting','review','draft','cancelled','abandoned'].includes(sourceState))blocked.push('Saved status: '+sourceState);
      if(node.kind==='step'&&['blocked','waiting','review','draft'].includes(state(path.status)))blocked.push('Path is '+state(path.status));
      const required=[...deps(path),...(node.kind==='step'?node.dependencies:[])];
      for(const ref of new Set(required)){
        const candidates=index.get(ref)||[];
        if(candidates.length!==1){blocked.push(candidates.length?'Ambiguous dependency: '+ref:'Unknown dependency: '+ref);continue;}
        if(candidates[0]===node||!candidates[0].done)blocked.push('Awaiting prerequisite: '+ref);
      }
      const startAt=asDate(step.startAt||step.startDate||path.startAt||path.startDate);
      const dueAt=asDate(step.dueAt||step.dueDate||path.dueAt||path.dueDate);
      const waiting=blocked.length>0;
      const scheduled=!waiting&&startAt&&Date.parse(startAt)>nowMs;
      output.push({key:'quest:'+clean(plan.id,160)+':'+node.pi+':'+(node.kind==='step'?node.si:'path'),
        source:'quest',planId:clean(plan.id,160),pathId:clean(path.id,160),pathIndex:node.pi,
        stepIndex:node.kind==='step'?node.si:null, title, questTitle:clean(plan.title||plan.wish,180),
        realm:clean(path.realm,100), status:waiting?'waiting':scheduled?'scheduled':'next',
        reason:blocked.join('; '),minutes:finiteMinutes(step.minutes||step.durationMinutes||step.estimateMinutes),
        energy:['low','medium','high'].includes(state(step.energy))?state(step.energy):'',
        startAt,dueAt,focus:false});
    }
  }
  return output;
}
export function projectBoard(store,plans,now=new Date().toISOString()){
  const safe=normalizeStore(store),stamp=Date.parse(now);
  const personal=safe.actions.map(a=>{
    let status=a.status;
    if(status==='next'&&a.startAt&&Date.parse(a.startAt)>stamp)status='scheduled';
    if(status==='scheduled'&&a.startAt&&Date.parse(a.startAt)<=stamp)status='next';
    return {...a,key:'personal:'+a.id,source:'personal',status,reason:a.waitingFor,questTitle:'',realm:''};
  });
  const focused=new Set(safe.focusedQuestKeys);
  const linked=projectPlanActions(plans,now).map(a=>({...a,focus:focused.has(a.key)}));
  return [...personal,...linked];
}
export function selectActions(all,{view='next',minutes='',energy='',query=''}={}){
  const requested=state(view),q=clean(query,120).toLowerCase();
  return list(all).filter(a=>{
    if(requested==='focus' ? (!a.focus||a.status==='done') : a.status!==requested)return false;
    if(q && ![a.title,a.questTitle,a.realm,a.context].some(x=>clean(x).toLowerCase().includes(q)))return false;
    if(['next','focus'].includes(requested)){
      if(minutes!==''&&minutes!==null&&(!a.minutes||a.minutes>Number(minutes)))return false;
      const levels={low:1,medium:2,high:3};
      if(levels[energy]&&(!levels[a.energy]||levels[a.energy]>levels[energy]))return false;
    }
    return true;
  }).sort((a,b)=>(a.dueAt||'9999').localeCompare(b.dueAt||'9999')||a.title.localeCompare(b.title));
}
