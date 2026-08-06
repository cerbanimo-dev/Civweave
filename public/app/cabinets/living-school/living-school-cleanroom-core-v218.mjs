import * as gate from '../../services/living-school/modules/project-gate.mjs';

export const VERSION='living-school-cleanroom-v218';
export const STATE_KEY='commonweave.living-school.cabinet.v151';
const OLD_KEY='commonweave.living-school.cabinet.v150';
const INTAKE_KEY='commonweave.living-school.intake.v152';
const INTENTION_KEY='commonweave.intentions.v127';
export const OUTBOX_KEY='commonweave.cerbanimo.project-handoff.outbox.v1';

export const root=document.getElementById('living-school-root');
const toastNode=document.getElementById('lsc218-toast');
const progressLabel=document.getElementById('lsc218-progress-label');
const progressBar=document.getElementById('lsc218-progress-bar');

export const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const now=()=>new Date().toISOString();
export const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
export const clip=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
export const copy=value=>globalThis.structuredClone?globalThis.structuredClone(value):JSON.parse(JSON.stringify(value));
export function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
export function writeJson(key,value){localStorage.setItem(key,JSON.stringify(value));return value}
const freshGate=()=>gate.defaultProjectGate?.()||{status:'not-started',history:[],receiptIds:[]};
const titles=['Foundations and vocabulary','Observe the system','Practice the core workflow','Create and test an artifact','Explain evidence and tradeoffs','Transfer the capability','Teach or document the method','Final synthesis'];

export function moduleFor(index,capability){
  const title=titles[index]||`Module ${index+1}`;
  return{
    id:`module-${index+1}`,title,
    objective:`Use ${title.toLowerCase()} to advance: ${capability}`,
    concepts:[title.split(' ')[0],capability.split(/\s+/).slice(0,3).join(' ')].filter(Boolean),
    lesson:`Study ${title.toLowerCase()}. Connect it to the capability, identify one observable decision, and record evidence another person could inspect.`,
    exercise:`Apply ${title.toLowerCase()} to a small example. Name what changed, what evidence exists, and what you would revise.`,
    question:`How does ${title.toLowerCase()} support the capability, and what evidence would show that you used it well?`
  };
}

export function freshState(){
  return{
    schema:'living-school-cabinet-v151',runtimeSchema:VERSION,version:3,appVersion:VERSION,
    school:null,sources:[],activeModuleId:'module-1',progress:{},practicum:null,
    projectGate:freshGate(),receipts:[],final:null,credential:null,
    activePathId:'',pathContext:null,
    passport:{learnerId:uid('learner'),displayName:'Local learner',xp:0,ledger:[]},
    settings:{modelRoute:'shared',mode:'guided'},events:[]
  };
}

export function normalizeState(value){
  const base=freshState(),source=value&&typeof value==='object'?value:{};
  const next={...base,...source};
  delete next.room;delete next.currentRoom;delete next.lastRoom;
  next.schema='living-school-cabinet-v151';next.runtimeSchema=VERSION;next.version=3;next.appVersion=VERSION;
  next.sources=Array.isArray(source.sources)?source.sources:[];
  next.progress=source.progress&&typeof source.progress==='object'?source.progress:{};
  next.receipts=Array.isArray(source.receipts)?source.receipts:[];
  next.events=Array.isArray(source.events)?source.events.slice(-300):[];
  next.passport={...base.passport,...(source.passport||{}),ledger:Array.isArray(source.passport?.ledger)?source.passport.ledger.slice(-800):[]};
  next.settings={...base.settings,...(source.settings||{})};
  next.projectGate=gate.normalizeProjectGate?.(source.projectGate||freshGate())||source.projectGate||freshGate();
  if(next.school?.modules?.length){
    next.school={...next.school,modules:next.school.modules.map((item,index)=>({...moduleFor(index,next.school.capability||next.school.title||'the capability'),...item,id:item.id||`module-${index+1}`}))};
    if(!next.school.modules.some(item=>item.id===next.activeModuleId))next.activeModuleId=next.school.modules[0].id;
  }else next.school=null;
  return next;
}

let currentState=normalizeState(readJson(STATE_KEY,null)||readJson(OLD_KEY,null));
writeJson(STATE_KEY,currentState);
let toastTimer=0;

export const state=()=>currentState;
export function replaceState(value){currentState=normalizeState(value);return currentState}
export function persist(type,detail={}){
  if(type)currentState.events=[...currentState.events,{id:uid('event'),type,detail,at:now()}].slice(-300);
  currentState.appVersion=VERSION;currentState.runtimeSchema=VERSION;
  writeJson(STATE_KEY,currentState);return currentState;
}
export function toast(message){
  if(!toastNode)return;
  toastNode.textContent=clean(message,1000);toastNode.hidden=false;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastNode.hidden=true,4200);
}
export function setProgress(percent){
  if(progressLabel)progressLabel.textContent=`${percent}%`;
  if(progressBar)progressBar.style.width=`${percent}%`;
}
export const activeModule=()=>currentState.school?.modules?.find(item=>item.id===currentState.activeModuleId)||currentState.school?.modules?.[0]||null;
export const progressFor=moduleId=>currentState.progress[moduleId]||{lessonComplete:false,assessmentPassed:false,attempts:[],evidence:[]};
export const completedModules=()=>currentState.school?.modules?.filter(item=>progressFor(item.id).assessmentPassed).length||0;
export const finalUnlocked=()=>gate.canUnlockFinalTest?.(currentState.projectGate)||Boolean(currentState.projectGate?.status==='accepted'&&currentState.projectGate?.lastReceipt);
export function award(amount,reason,ref){
  currentState.passport={...currentState.passport,xp:Number(currentState.passport.xp||0)+amount,ledger:[...(currentState.passport.ledger||[]),{id:uid('xp'),amount,reason,ref,at:now()}].slice(-800)};
}
export function progressPercent(){
  const modules=currentState.school?.modules||[],count=Math.max(1,modules.length);
  const learning=modules.reduce((sum,item)=>sum+(progressFor(item.id).lessonComplete?45:0)+(progressFor(item.id).assessmentPassed?55:0),0)/count;
  return clip((currentState.school?10:0)+(currentState.sources.length?5:0)+Math.round(learning*.55)+(currentState.practicum?8:0)+(finalUnlocked()?10:0)+(currentState.final?.passed?7:0)+(currentState.credential?5:0),0,100);
}

export function availablePaths(){
  const map=new Map();
  const intake=readJson(INTAKE_KEY,[]);
  for(const item of Array.isArray(intake)?intake:[]){
    const id=clean(item?.sourcePlanId||item?.intentionId||item?.id,180);if(!id)continue;
    map.set(id,{id,title:clean(item.title||item.capability||'Learning path',180),capability:clean(item.purpose||item.capability||item.title,1200),proof:clean(item.completionCriteria||item.proof||'A fresh demonstration and reviewable evidence.',2000),state:clean(item.status||item.state||'ready',80)});
  }
  const intentions=readJson(INTENTION_KEY,[]);
  for(const item of Array.isArray(intentions)?intentions:[]){
    const plan=item.plan&&typeof item.plan==='object'?item.plan:item;
    const candidates=Array.isArray(plan.paths)?plan.paths:Object.values(plan.paths||{});
    const route=candidates.find(candidate=>candidate?.realm==='living-school');
    const id=clean(plan.id||item.id,180);if(!route||!id||map.has(id))continue;
    map.set(id,{id,title:clean(route.title||plan.title||'Learning path',180),capability:clean(route.purpose||plan.outcome||plan.wish||route.title,1200),proof:clean(route.completionCriteria||plan.completionCriteria||'A fresh demonstration and reviewable evidence.',2000),state:clean(plan.state||item.state||'review',80)});
  }
  if(currentState.pathContext?.id&&!map.has(currentState.pathContext.id))map.set(currentState.pathContext.id,currentState.pathContext);
  return[...map.values()];
}

const cssEscape=name=>globalThis.CSS?.escape?globalThis.CSS.escape(name):String(name).replace(/[\\"]/g,'\\$&');
export const formFor=target=>target.closest('form')||root;
export const field=(name,scope=root)=>scope?.querySelector?.(`[name="${cssEscape(name)}"]`)?.value??'';
export const fields=(target,names)=>Object.fromEntries(names.map(name=>[name,field(name,formFor(target))]));

function deterministicSchool(data){
  const capability=clean(data.capability,1200),count=clip(data.count,1,8);
  return{
    id:currentState.school?.id||uid('school'),title:clean(data.title||capability,180)||'Untitled learning path',capability,
    level:data.level||'beginner',mode:data.mode||'guided',proof:clean(data.proof||'A working artifact, explanation, and independent receipt.',2400),
    createdAt:currentState.school?.createdAt||now(),updatedAt:now(),modules:Array.from({length:count},(_,index)=>moduleFor(index,capability)),
    generation:{provider:'deterministic',model:'local curriculum compiler',generatedAt:now(),fallback:false}
  };
}

export async function generateSchool(data){
  const fallback=deterministicSchool(data);
  if(data.modelRoute!=='shared')return fallback;
  try{
    await globalThis.CommonweaveFamilyAILoaderV105?.ensure?.();
    const runtime=globalThis.CommonweaveModelRuntime,config=runtime?.readSharedConfig?.('interactive');
    if(!runtime?.generate||!config)throw new Error('Shared model configuration is unavailable.');
    const count=clip(data.count,1,8);
    const schema={type:'object',required:['title','modules'],properties:{title:{type:'string'},modules:{type:'array',items:{type:'object',properties:{title:{type:'string'},objective:{type:'string'},concepts:{type:'array',items:{type:'string'}},lesson:{type:'string'},exercise:{type:'string'},question:{type:'string'}}}}}};
    const result=await runtime.generate({purpose:'living-school-curriculum-generation',executionProfile:'interactive',config,schema,context:{capability:data.capability,level:data.level,moduleCount:count,proofContract:data.proof,sources:currentState.sources.slice(0,12)},messages:[{role:'system',content:'You are Moss, Living School learning guide. Generate practical evidence-oriented curriculum JSON. Speak only as Moss and never impersonate another Commonweave guide.'},{role:'user',content:`Create ${count} useful modules for: ${data.capability}`}]});
    if(result?.status!=='success'||!result.outputJson?.modules?.length)throw new Error(result?.error||'No modules returned.');
    const modules=result.outputJson.modules.slice(0,count).map((item,index)=>({...moduleFor(index,data.capability),...item,id:`module-${index+1}`,title:clean(item.title,180),objective:clean(item.objective,1200),concepts:(item.concepts||[]).map(value=>clean(value,120)).slice(0,8),lesson:clean(item.lesson,8000),exercise:clean(item.exercise,4000),question:clean(item.question,2000)}));
    while(modules.length<count)modules.push(moduleFor(modules.length,data.capability));
    return{...fallback,title:clean(result.outputJson.title||fallback.title,180),modules,generation:{provider:result.provider||config.provider||'shared',model:result.model||config.model||'',generatedAt:now(),fallback:false}};
  }catch(error){return{...fallback,generation:{...fallback.generation,fallback:true,error:clean(error.message,500)}}}
}
