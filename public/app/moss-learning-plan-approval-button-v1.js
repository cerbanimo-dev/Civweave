(()=>{
'use strict';

const VERSION='1.0.0-moss-learning-plan-approval-button-v1';
const ROOT_ID='cw-persistent-guide-chat-v215';
const STYLE_ID='cw-moss-learning-plan-approval-button-v1-style';
const SYSTEM='living-school';
const PLAN_KEY='civweave.chat.capability.pending.living-school.plan.v1';
const THREAD_KEY='civweave.guide-thread.v350.living-school';

if(globalThis.CivweaveMossLearningPlanApprovalButtonV1?.version===VERSION)return;

const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const clone=value=>{try{return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value))}catch{return value}};
const now=()=>new Date().toISOString();
const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
let approving=false;
let observer=null;

function unified(){return globalThis.CivweaveUnifiedChatSystemV1||null}
function guide(){return globalThis.CivweaveGuideChatSurfaceV350||globalThis.CivweavePersistentGuideChatV215||null}
function realm(){return globalThis.CivweaveRealmSessionIntegrityV237||null}
function readPlan(){
  try{return unified()?.readLearningPlan?.()||parse(localStorage.getItem(PLAN_KEY),null)}catch{return null}
}
function readThread(){
  try{const via=realm()?.readThread?.(SYSTEM);if(via)return via}catch{}
  try{return parse(localStorage.getItem(THREAD_KEY),null)||{schema:'civweave.realm-guide-thread.v237',system:SYSTEM,messages:[]}}catch{return{schema:'civweave.realm-guide-thread.v237',system:SYSTEM,messages:[]}}
}
function writeThread(thread){
  const next={schema:'civweave.realm-guide-thread.v237',system:SYSTEM,messages:[],...(thread||{}),updatedAt:now()};
  try{if(realm()?.writeThread)return realm().writeThread(SYSTEM,next)}catch{}
  try{localStorage.setItem(THREAD_KEY,JSON.stringify(next))}catch{}
  try{dispatchEvent(new CustomEvent('civweave:realm-guide-thread-changed',{detail:{system:SYSTEM,thread:next}}))}catch{}
  return next;
}
function resultRow(result){
  const next=clean(result?.response?.choice?.nextAction,1200),text=[clean(result?.response?.answer,10000),next?`Next: ${next}`:''].filter(Boolean).join('\n\n');
  return{id:uid('msg'),role:'assistant',guide:SYSTEM,responderSystem:SYSTEM,text:text||'The Learning Journey approval finished without a response.',provider:clean(result?.provider,120),model:clean(result?.model,240),approvalGate:result?.response?.approvalGate||null,actionSnapshot:result?.action?clone(result.action):null,at:now()};
}
function appendResult(result){
  const thread=readThread();thread.messages=Array.isArray(thread.messages)?thread.messages:[];thread.messages.push(resultRow(result));writeThread(thread);
  try{guide()?.render?.()}catch{}
  return result;
}
function failureResult(error){
  const message=clean(error?.message||error||'Unknown Learning Journey approval error.',1000);
  return{response:{answer:`Moss could not materialize the approved Learning Journey: ${message}`,choice:{mode:'Learn',system:SYSTEM,nextAction:'Review the plan and retry approval.'},approvalGate:null},provider:'moss-learning-plan-approval-button',model:'direct-materialization',action:{kind:'living-school-curriculum-generation-failed',system:SYSTEM,state:'failed',error:message}};
}
function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
#${ROOT_ID} .cw350-learning-plan-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:9px}
#${ROOT_ID} .cw350-learning-plan-actions button{min-height:42px;padding:9px 13px;border:1px solid var(--guide-accent);border-radius:11px;background:color-mix(in srgb,var(--guide-accent) 30%,#182334);color:#fff;font:850 13px/1.15 system-ui;cursor:pointer}
#${ROOT_ID} .cw350-learning-plan-actions button:disabled{opacity:.65;cursor:progress}
`;
  document.head?.append(style);
}
function activeMossRoot(){
  const root=document.getElementById(ROOT_ID);
  return root&&root.dataset.guide===SYSTEM?root:null;
}
function reviewArticle(root){
  const rows=[...root.querySelectorAll('article[data-role="assistant"]')].reverse();
  return rows.find(article=>{const text=clean(article.querySelector('.cw350-bubble')?.textContent,12000);return /Learning Journey plan:/i.test(text)&&/Status:\s*REVIEW/i.test(text)})||null;
}
function removeActions(){document.querySelectorAll?.('[data-moss-learning-plan-approval-v1]')?.forEach?.(node=>node.remove())}
function render(){
  installStyle();
  const root=activeMossRoot(),plan=readPlan();
  if(!root||!plan?.id||plan.state!=='review'){removeActions();return false}
  const current=root.querySelector('[data-moss-learning-plan-approval-v1]');
  if(current?.dataset?.planId===plan.id)return true;
  current?.remove();
  const article=reviewArticle(root);if(!article)return false;
  const body=article.querySelector(':scope > div')||article.lastElementChild;if(!body)return false;
  const actions=document.createElement('div');actions.className='cw350-learning-plan-actions';actions.dataset.mossLearningPlanApprovalV1='true';actions.dataset.planId=plan.id;
  const button=document.createElement('button');button.type='button';button.dataset.approveLearningJourney='true';button.textContent='Approve Learning Journey';button.setAttribute('aria-label','Approve this Learning Journey and generate its learning content');
  button.addEventListener('click',()=>void approvePlanById(plan.id,button,actions));actions.append(button);body.append(actions);return true;
}
async function approvePlanById(planId,button=null,actions=null){
  if(approving)return false;
  const plan=readPlan(),api=unified();
  if(!plan?.id||plan.id!==planId||plan.state!=='review'){render();return false}
  if(typeof api?.approveLivingSchoolPlan!=='function'){appendResult(failureResult('The Living School approval runtime is unavailable.'));return false}
  approving=true;
  if(button){button.disabled=true;button.textContent='Generating Learning Journey…'}
  try{
    const result=await api.approveLivingSchoolPlan(plan);actions?.remove?.();appendResult(result);return true;
  }catch(error){appendResult(failureResult(error));return false}
  finally{approving=false;queueMicrotask(render)}
}
function synchronize(){try{guide()?.render?.()}catch{};queueMicrotask(render);return true}
function start(){
  installStyle();render();
  for(const name of ['civweave:realm-guide-thread-changed','civweave:guide-chat-opened','civweave:guide-chat-ready','civweave:persistent-guide-chat-ready','civweave:assistant-runtime-ready','civweave:living-school-workbench-ready','pageshow'])addEventListener(name,()=>queueMicrotask(render));
  if(typeof MutationObserver==='function'){observer=new MutationObserver(()=>queueMicrotask(render));const target=document.getElementById(ROOT_ID)||document.body;if(target)observer.observe(target,{childList:true,subtree:true,attributes:true,attributeFilter:['data-guide']})}
  document.documentElement.dataset.civweaveMossLearningPlanApproval='button-v1';
  try{dispatchEvent(new CustomEvent('civweave:moss-learning-plan-approval-button-ready',{detail:{version:VERSION}}))}catch{}
}

const api=Object.freeze({version:VERSION,render,synchronize,approvePlanById,readPlan,appendResult,approvalSurface:'button',chatApprovalRequired:false});
globalThis.CivweaveMossLearningPlanApprovalButtonV1=api;
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
