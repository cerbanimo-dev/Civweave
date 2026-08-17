(()=>{
'use strict';

const VERSION='1.0.60-weaveling-plan-materialization-v265-direct-quest-copy';
const WORKING_KEY='civweave.working-campus.v1';
const INTENTIONS_KEY='civweave.intentions.v127';
const BANNER_ID='cw-weave-review-ready-v265';
const PLANNER_PATH='/app/intention-planner-v141.js';
let patchedPlanner=null;
let readyPromise=null;

if(globalThis.CivweaveWeavelingPlanMaterializationV265?.version===VERSION)return;

const clean=(value,max=8000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const clone=value=>{try{return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value))}catch{return value}};
const now=()=>new Date().toISOString();
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function isCivweavePage(){
  const route=globalThis.CivweaveSystemRoutesV227?.identify?.(location.pathname);
  if(route)return route==='civweave';
  const declared=clean(document.documentElement?.dataset?.civweaveSystemRoute||document.documentElement?.dataset?.civweaveSystem,80).toLowerCase();
  if(declared)return declared==='civweave';
  return location.pathname.includes('working-campus-v156');
}

function reviewItemFor(plan){
  const rows=parse(localStorage.getItem(INTENTIONS_KEY),[]);
  return Array.isArray(rows)?rows.find(row=>row?.id===plan?.id||row?.plan?.id===plan?.id)||null:null;
}

function materialize(plan,{source='weaveling-shared-chat-v265'}={}){
  if(!plan?.id)return null;
  const current=parse(localStorage.getItem(WORKING_KEY),{}),at=now(),saved=clone(plan);
  saved.state='review';
  saved.updatedAt=at;
  const next={
    ...current,
    stage:'review',
    view:'weave',
    wish:clean(saved.wish||current.wish,8000),
    profile:saved.profile&&typeof saved.profile==='object'?clone(saved.profile):current.profile||{},
    plan:saved,
    reviewReady:{planId:saved.id,title:clean(saved.title,220)||'Reviewable Quest',at,source},
    updatedAt:at
  };
  try{localStorage.setItem(WORKING_KEY,JSON.stringify(next))}catch{}
  document.documentElement.dataset.civweaveReviewableWeave='ready-v265';
  document.documentElement.dataset.civweaveReviewableWeaveId=saved.id;
  renderReviewReady(saved);
  try{globalThis.CivweaveWeavelingHubV233?.render?.()}catch{}
  try{dispatchEvent(new CustomEvent('civweave:working-campus-plan-built',{detail:{planId:saved.id,title:saved.title,source,reviewReady:true,pathCount:Array.isArray(saved.paths)?saved.paths.length:0}}))}catch{}
  try{dispatchEvent(new CustomEvent('civweave:weave-review-ready',{detail:{planId:saved.id,title:saved.title,source,reviewReady:true}}))}catch{}
  const toast=document.getElementById('toast');
  if(toast&&isCivweavePage()){
    toast.textContent=`Reviewable Quest ready: ${clean(saved.title,180)||'your Quest'}. Nothing is active until you approve it.`;
    toast.hidden=false;
    setTimeout(()=>{if(toast.textContent.startsWith('Reviewable Quest ready:'))toast.hidden=true},6500);
  }
  return next;
}

function focusRevision(){
  const target=document.querySelector('#cw-shared-guide-surface-v236 textarea,#weaveling-chat-input,#cw-persistent-guide-chat-v215 textarea');
  if(!target)return false;
  target.scrollIntoView({behavior:'smooth',block:'center'});
  setTimeout(()=>target.focus(),220);
  return true;
}

function openReview(plan){
  const item=reviewItemFor(plan);
  if(!item)try{globalThis.CivweaveIntentionPlanner?.restore?.(plan)}catch{}
  if(globalThis.CivweaveIntentionUI?.open){globalThis.CivweaveIntentionUI.open(plan.id);return true}
  try{
    const current=parse(localStorage.getItem(WORKING_KEY),{});
    localStorage.setItem(WORKING_KEY,JSON.stringify({...current,stage:'review',view:'weave',plan:clone(plan),updatedAt:now()}));
  }catch{}
  location.reload();
  return true;
}

function renderReviewReady(plan){
  if(!isCivweavePage()||!plan?.id)return false;
  const workspace=document.getElementById('workspace'),work=workspace?.closest('.work');
  if(!workspace||!work)return false;
  let banner=document.getElementById(BANNER_ID);
  if(!banner){
    banner=document.createElement('section');
    banner.id=BANNER_ID;
    banner.setAttribute('aria-live','polite');
    work.insertBefore(banner,workspace);
  }
  banner.dataset.planId=plan.id;
  banner.innerHTML=`<div><small>QUEST GENERATED · REVIEW REQUIRED</small><strong>${esc(clean(plan.title,220)||'Reviewable Quest')}</strong><span>This is a real saved Quest in REVIEW, not a chat-only outline. Nothing has been activated.</span></div><div class="cw-weave-review-actions"><button type="button" data-review-weave>Review Quest</button><button type="button" data-revise-weave>Revise Quest</button></div>`;
  banner.querySelector('[data-review-weave]')?.addEventListener('click',()=>openReview(plan));
  banner.querySelector('[data-revise-weave]')?.addEventListener('click',focusRevision);
  return true;
}

function patchPlanner(api=globalThis.CivweaveIntentionPlanner){
  if(!api?.maybeCreate)return false;
  if(api===patchedPlanner&&api.maybeCreate?.__cwMaterializeV265)return true;
  if(api.maybeCreate?.__cwMaterializeV265){patchedPlanner=api;return true}
  const original=api.maybeCreate.bind(api);
  const wrapped=(options={})=>{
    const result=original(options);
    if(result?.plan&&result?.item){
      materialize(result.plan,{source:'weaveling-shared-chat-v265'});
      result.response={
        ...(result.response||{}),
        answer:`I generated and saved the reviewable Quest “${clean(result.plan.title,220)||'your Quest'}”. It is now in REVIEW on the Civweave workspace. Nothing is active yet.\n\n${clean(result.response?.answer,7000)}`.trim(),
        choice:{...(result.response?.choice||{}),mode:'Plan',system:'civweave',nextAction:'Review the saved Quest, revise it, or activate it after review.'},
        requiresConsent:true,
        approvalGate:{kind:'intention-activation',planId:result.item.id,state:'review',required:true,actions:['review','revise','activate']}
      };
    }
    return result;
  };
  wrapped.__cwMaterializeV265=true;
  try{api.maybeCreate=wrapped}catch{}
  if(api.maybeCreate!==wrapped){
    try{
      api={...api,maybeCreate:wrapped};
      globalThis.CivweaveIntentionPlanner=api;
    }catch{return false}
  }
  patchedPlanner=api;
  return true;
}

function waitForPlanner(timeout=10000){
  if(globalThis.CivweaveIntentionPlanner)return Promise.resolve(globalThis.CivweaveIntentionPlanner);
  return new Promise((resolve,reject)=>{
    const started=Date.now(),timer=setInterval(()=>{
      if(globalThis.CivweaveIntentionPlanner){clearInterval(timer);resolve(globalThis.CivweaveIntentionPlanner);return}
      if(Date.now()-started>=timeout){clearInterval(timer);reject(new Error('The canonical intention planner did not become ready.'))}
    },40);
  });
}

function ensurePlanner(){
  if(globalThis.CivweaveIntentionPlanner){patchPlanner();return Promise.resolve(globalThis.CivweaveIntentionPlanner)}
  if(readyPromise)return readyPromise;
  readyPromise=(async()=>{
    const existing=[...document.scripts].find(script=>{try{return new URL(script.src,location.href).pathname===PLANNER_PATH}catch{return false}});
    if(!existing){
      const script=document.createElement('script');
      script.src=`${PLANNER_PATH}?v=1.0.60-v265-direct-quest-copy`;
      script.async=false;
      document.head.append(script);
    }
    const api=await waitForPlanner();
    patchPlanner(api);
    return globalThis.CivweaveIntentionPlanner||api;
  })().catch(error=>{readyPromise=null;console.warn('[Civweave] Weaveling planner readiness failed:',error);throw error});
  return readyPromise;
}

function recoverVisibleReview(){
  const current=parse(localStorage.getItem(WORKING_KEY),{}),plan=current?.stage==='review'?current.plan:null;
  if(plan?.id)renderReviewReady(plan);
}

function start(){
  ensurePlanner().catch(()=>{});
  recoverVisibleReview();
  addEventListener('civweave:guide-loader-reset',()=>ensurePlanner().then(patchPlanner).catch(()=>{}));
  addEventListener('civweave:guide-workspace-ready',()=>{ensurePlanner().then(patchPlanner).catch(()=>{});recoverVisibleReview()});
  addEventListener('civweave:intentions-changed',()=>recoverVisibleReview());
  let ticks=0;const timer=setInterval(()=>{if(globalThis.CivweaveIntentionPlanner!==patchedPlanner)patchPlanner();recoverVisibleReview();if(++ticks>=240)clearInterval(timer)},125);
}

globalThis.CivweaveWeavelingPlanMaterializationV265={version:VERSION,ensurePlanner,patchPlanner,materialize,renderReviewReady,openReview,policy:'weaveling-chat-must-materialize-before-claiming-a-reviewable-quest-v265'};
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
})();