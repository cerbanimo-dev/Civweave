(()=>{
'use strict';

const VERSION='1.1.0-moss-learning-plan-decision-flow-v2';
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
let deciding=false;
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

#cw-persistent-guide-chat-v215 .cw350-learning-mascot{display:flex;align-items:center;gap:12px;margin:11px 0 2px;padding:11px;border:1px solid color-mix(in srgb,var(--guide-accent) 46%,#ffffff26);border-radius:14px;background:color-mix(in srgb,var(--guide-accent) 12%,#111b2d)}
#cw-persistent-guide-chat-v215 .cw350-learning-mascot img{display:block;flex:0 0 82px;width:82px;height:82px;object-fit:cover;object-position:center;border-radius:13px;border:1px solid color-mix(in srgb,var(--guide-accent) 55%,transparent)}
#cw-persistent-guide-chat-v215 .cw350-learning-mascot strong{display:block;color:#fff;font:850 14px/1.35 system-ui}
#cw-persistent-guide-chat-v215 .cw350-learning-mascot span{display:block;margin-top:4px;color:#c4d1dc;font:500 12px/1.45 system-ui}
#cw-persistent-guide-chat-v215 .cw350-learning-plan-actions [data-moss-action="revise"]{border-color:#9fb8ce;background:#233548}
#cw-persistent-guide-chat-v215 .cw350-learning-plan-actions [data-moss-action="deny"]{border-color:#758294;background:#252e3b}
#cw-persistent-guide-chat-v215 .cw350-learning-plan-actions button:focus-visible{outline:3px solid #fff;outline-offset:3px}
#cw-persistent-guide-chat-v215 .cw350-learning-mascot[data-status="error"]{border-color:#db995d}
@media(max-width:400px){#cw-persistent-guide-chat-v215 .cw350-learning-mascot img{flex-basis:66px;width:66px;height:66px}#cw-persistent-guide-chat-v215 .cw350-learning-plan-actions button{flex:1 1 90px}}
`;
  document.head?.append(style);
}
function activeMossRoot(){
  const root=document.getElementById(ROOT_ID);
  return root&&['living-school','civweave'].includes(root.dataset.guide)?root:null;
}
function articles(root){return [...root.querySelectorAll('article[data-role="assistant"]')].reverse()}
function reviewArticle(root,plan){
  return articles(root).find(article=>{
    const text=clean(article.querySelector('.cw350-bubble')?.textContent,12000);
    return /Learning Journey plan:/i.test(text)&&/Status:\\s*REVIEW/i.test(text)&&text.includes(clean(plan.request?.title,220));
  })||null;
}
function findFollowUpArticle(root,kind,plan){
  const pattern=kind==='retry'?/stopped before it could materialize|could not materialize the approved Learning Journey/i:/materialized the approved Learning Journey|I queued its materialization/i;
  return articles(root).find(article=>{
    const message=clean(article.querySelector('.cw350-bubble')?.textContent,12000);
    return pattern.test(message)&&(!plan?.request?.title||message.includes(clean(plan.request.title,180)));
  })||null;
}
function removeActions(){document.querySelectorAll?.('[data-moss-learning-plan-approval-v1]')?.forEach?.(node=>node.remove())}
function addMascot(body,status,title,description){
  const panel=document.createElement('div');panel.className='cw350-learning-mascot';panel.dataset.status=status;
  const image=document.createElement('img');image.src='/app/assets/ai/chat/moss-face-v255.webp';image.alt='Moss, the Living School learning guide';image.loading='lazy';image.addEventListener('error',()=>{if(!image.dataset.fallback){image.dataset.fallback='true';image.src='/app/services/living-school/visual-assets/core/moss.webp'}});
  const copy=document.createElement('div'),name=document.createElement('strong'),detail=document.createElement('span');
  name.textContent=title;detail.textContent=description;copy.append(name,detail);panel.append(image,copy);body.append(panel);
  return panel;
}
function actionButton(actions,label,action,handler){
  const button=document.createElement('button');button.type='button';button.dataset.mossAction=action;button.textContent=label;
  button.setAttribute('aria-label',action==='approve'?'Approve Learning Journey and generate its learning content':action==='revise'?'Revise this Learning Journey before approval':action==='deny'?'Deny and discard this Learning Journey':'Open Living School');
  button.addEventListener('click',handler);actions.append(button);return button;
}
function focusRevisionInput(root){
  const input=root?.querySelector('[data-persistent-form] textarea');
  if(!input)return false;
  input.placeholder='Describe what Moss should change in the Learning Journey…';
  try{input.focus({preventScroll:true})}catch{input.focus?.()}
  return true;
}
function render(){
  installStyle();
  const root=activeMossRoot(),plan=readPlan();
  if(!root){removeActions();return false}
  const previous=root.querySelector('[data-moss-learning-plan-approval-v1]');
  if((approving||deciding)&&previous?.dataset.planId===plan?.id)return true;
  if(plan?.id&&plan.state==='review'){
    if(previous?.dataset.planId===plan.id&&previous.dataset.mode==='review')return true;
    removeActions();
    const article=reviewArticle(root,plan);if(!article)return false;
    const body=article.querySelector(':scope > div')||article.lastElementChild;if(!body)return false;
    const wrapper=document.createElement('section');wrapper.dataset.mossLearningPlanApprovalV1='true';wrapper.dataset.planId=plan.id;wrapper.dataset.mode='review';
    addMascot(wrapper,'review','Moss · Your plan is ready','Review the outline above. Approve to build lessons, Revise to make changes, or Deny to discard. No content is generated until you approve.');
    const actions=document.createElement('div');actions.className='cw350-learning-plan-actions';
    const approve=actionButton(actions,'Approve','approve',()=>void approvePlanById(plan.id,approve,wrapper));approve.dataset.approveLearningJourney='true';
    actionButton(actions,'Revise','revise',()=>void decidePlanById(plan.id,'revise',wrapper));
    actionButton(actions,'Deny','deny',()=>void decidePlanById(plan.id,'deny',wrapper));
    wrapper.append(actions);body.append(wrapper);return true;
  }
  if(plan?.id&&plan.state==='approved'){
    if(previous?.dataset.planId===plan.id&&previous.dataset.mode==='retry')return true;
    removeActions();
    const article=findFollowUpArticle(root,'retry',plan);if(!article)return false;
    const body=article.querySelector(':scope > div')||article.lastElementChild;if(!body)return false;
    const wrapper=document.createElement('section');wrapper.dataset.mossLearningPlanApprovalV1='true';wrapper.dataset.planId=plan.id;wrapper.dataset.mode='retry';
    addMascot(wrapper,'error','Moss · Generation needs another try','Your approval is saved. Retry generating the learning content; you do not need to approve a second time.');
    const actions=document.createElement('div');actions.className='cw350-learning-plan-actions';
    const retry=actionButton(actions,'Retry generation','retry',()=>void retryPlanById(plan.id,retry,wrapper));
    wrapper.append(actions);body.append(wrapper);return true;
  }
  if(plan?.state==='revision-requested'||plan?.state==='denied'){removeActions();return false}
  const thread=readThread(),recent=[...(thread.messages||[])].reverse().find(row=>row?.role==='assistant'&&!row.pending);
  if(!['living-school-curriculum-generated','living-school-curriculum-queued'].includes(recent?.actionSnapshot?.kind)){removeActions();return false}
  if(previous?.dataset.mode==='open')return true;
  removeActions();
  const article=findFollowUpArticle(root,'open',null);if(!article)return false;
  const body=article.querySelector(':scope > div')||article.lastElementChild;if(!body)return false;
  const wrapper=document.createElement('section');wrapper.dataset.mossLearningPlanApprovalV1='true';wrapper.dataset.mode='open';
  addMascot(wrapper,'ready','Moss · Ready for the next step',recent.actionSnapshot.kind==='living-school-curriculum-queued'?'Open Living School to complete the queued generation.':'Open Living School and begin your first module.');
  const actions=document.createElement('div');actions.className='cw350-learning-plan-actions';
  actionButton(actions,'Open Learning Journey','open',()=>{location.assign('/app/cabinets/living-school/index.html')});
  wrapper.append(actions);body.append(wrapper);return true;
}
async function decidePlanById(planId,decision,wrapper=null){
  if(approving||deciding)return false;
  const plan=readPlan(),api=unified();
  if(!plan?.id||plan.id!==planId||plan.state!=='review'){render();return false}
  const action=decision==='revise'?'requestLivingSchoolPlanRevision':decision==='deny'?'denyLivingSchoolPlan':null;
  if(!action||typeof api?.[action]!=='function'){appendResult(failureResult('The Learning Journey decision runtime is unavailable.'));return false}
  deciding=true;wrapper?.querySelectorAll('button')?.forEach(button=>button.disabled=true);
  try{
    const result=await api[action](plan);appendResult(result);
    if(readPlan()?.state==='review')return false;
    wrapper?.remove?.();if(decision==='revise')queueMicrotask(()=>focusRevisionInput(activeMossRoot()));
    return true;
  }catch(error){appendResult(failureResult(error));return false}
  finally{deciding=false;queueMicrotask(render)}
}
async function approvePlanById(planId,button=null,actions=null){
  if(approving||deciding)return false;
  const plan=readPlan(),api=unified();
  if(!plan?.id||plan.id!==planId||plan.state!=='review'){render();return false}
  if(typeof api?.approveLivingSchoolPlan!=='function'){appendResult(failureResult('The Living School approval runtime is unavailable.'));return false}
  approving=true;
  if(actions?.querySelectorAll)actions.querySelectorAll('button').forEach(control=>control.disabled=true);
  if(button){button.disabled=true;button.textContent='Generating Learning Journey…'}
  try{
    const result=await api.approveLivingSchoolPlan(plan);actions?.remove?.();appendResult(result);
    return !['failed','error'].includes(clean(result?.action?.state,60).toLowerCase());
  }catch(error){appendResult(failureResult(error));return false}
  finally{approving=false;queueMicrotask(render)}
}
async function retryPlanById(planId,button=null,wrapper=null){
  if(approving||deciding)return false;
  const api=unified(),plan=readPlan();if(plan?.id!==planId||plan?.state!=='approved')return false;
  if(typeof api?.retryLivingSchoolPlanMaterialization!=='function'){appendResult(failureResult('The Learning Journey retry runtime is unavailable.'));return false}
  approving=true;
  if(button){button.disabled=true;button.textContent='Retrying generation…'}
  try{const result=await api.retryLivingSchoolPlanMaterialization(planId);wrapper?.remove?.();appendResult(result);return !['failed','error'].includes(clean(result?.action?.state,60).toLowerCase())}
  catch(error){appendResult(failureResult(error));return false}
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

const api=Object.freeze({version:VERSION,render,synchronize,approvePlanById,decidePlanById,retryPlanById,readPlan,appendResult,approvalSurface:'approve-revise-deny',chatApprovalRequired:false});
globalThis.CivweaveMossLearningPlanApprovalButtonV1=api;
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
