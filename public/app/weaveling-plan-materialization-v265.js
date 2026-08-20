(()=>{
'use strict';

const VERSION='1.1.1-weaveling-plan-materialization-v265-ai-only-quarantine';
const WORKING_KEY='civweave.working-campus.v1';
const INTENTIONS_KEY='civweave.intentions.v127';
const QUARANTINE_KEY='civweave.quest-quarantine.v1';
const BANNER_ID='cw-weave-review-ready-v265';
const PLANNER_PATH='/app/intention-planner-v141.js';
const NON_AI_PROVIDER_RE=/^(?:deterministic(?:-local)?|local-contract|bundled|packaged|reflex|minilm|local-reflex|manual|unknown)?$/i;
let patchedPlanner=null;
let patchedAssistant=null;
let readyPromise=null;

if(globalThis.CivweaveWeavelingPlanMaterializationV265?.version===VERSION)return;

const clean=(value,max=8000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const clone=value=>{try{return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value))}catch{return value}};
const now=()=>new Date().toISOString();
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function emit(type,detail={}){try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,at:now(),...detail}}))}catch{}}
function aiAuthoredPlan(plan){
  const authoring=plan?.authoring,provider=clean(authoring?.provider,120).toLowerCase();
  return Boolean(plan?.id&&authoring?.aiGenerated===true&&authoring?.mode==='model-structured-json'&&provider&&!NON_AI_PROVIDER_RE.test(provider));
}
function aiAuthoredResult(result){
  if(!result?.plan)return false;
  if(result?.planControl?.ok===true)return true;
  return result?.questAuthoring?.aiGenerated===true&&aiAuthoredPlan(result.plan);
}
function rejectUnauthorized(plan,source='unknown'){
  emit('civweave:quest-ai-authority-rejected',{planId:clean(plan?.id,180),title:clean(plan?.title,220),source,authoring:clone(plan?.authoring||null)});
  return null;
}
function quarantineUnverifiedReviewQuests(){
  const at=now(),quarantined=[];
  let rows=parse(localStorage.getItem(INTENTIONS_KEY),[]);if(!Array.isArray(rows))rows=[];
  const kept=rows.filter(row=>{
    const plan=row?.plan,state=clean(row?.state||plan?.state,40).toLowerCase();
    if(row?.kind==='weave-plan'&&plan&&state==='review'&&!aiAuthoredPlan(plan)){
      quarantined.push({...clone(row),quarantinedAt:at,quarantineReason:'missing-ai-authoring-provenance'});return false;
    }
    return true;
  });
  if(kept.length!==rows.length)try{localStorage.setItem(INTENTIONS_KEY,JSON.stringify(kept.slice(0,100)))}catch{}
  let current=parse(localStorage.getItem(WORKING_KEY),{}),workspaceChanged=false;
  if(current?.stage==='review'&&current?.plan&&!aiAuthoredPlan(current.plan)){
    quarantined.push({kind:'working-campus-review',plan:clone(current.plan),quarantinedAt:at,quarantineReason:'missing-ai-authoring-provenance'});
    current={...current,plan:null,reviewReady:null,stage:clean(current.wish)?'profile':'wish',view:'quest',updatedAt:at};workspaceChanged=true;
    try{localStorage.setItem(WORKING_KEY,JSON.stringify(current))}catch{}
  }
  if(quarantined.length){
    let prior=parse(localStorage.getItem(QUARANTINE_KEY),[]);if(!Array.isArray(prior))prior=[];
    const seen=new Set();const combined=[...quarantined,...prior].filter(row=>{const key=clean(row?.id||row?.plan?.id||`${row?.kind}:${row?.quarantinedAt}`,240);if(!key||seen.has(key))return false;seen.add(key);return true}).slice(0,100);
    try{localStorage.setItem(QUARANTINE_KEY,JSON.stringify(combined))}catch{}
    emit('civweave:quest-review-quarantined',{count:quarantined.length,workspaceChanged,reason:'missing-ai-authoring-provenance'});
  }
  return{count:quarantined.length,workspaceChanged};
}
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
function materialize(plan,{source='weaveling-ai-structured-v265'}={}){
  if(!aiAuthoredPlan(plan))return rejectUnauthorized(plan,source);
  const current=parse(localStorage.getItem(WORKING_KEY),{}),at=now(),saved=clone(plan);
  saved.state='review';saved.updatedAt=at;
  const next={...current,stage:'review',view:'quest',wish:clean(saved.wish||current.wish,8000),profile:saved.profile&&typeof saved.profile==='object'?clone(saved.profile):current.profile||{},plan:saved,reviewReady:{planId:saved.id,title:clean(saved.title,220)||'Reviewable Quest',at,source,aiGenerated:true},updatedAt:at};
  try{localStorage.setItem(WORKING_KEY,JSON.stringify(next))}catch{}
  document.documentElement.dataset.civweaveReviewableWeave='ai-ready-v265';
  document.documentElement.dataset.civweaveReviewableWeaveId=saved.id;
  renderReviewReady(saved);
  try{globalThis.CivweaveWeavelingHubV233?.render?.()}catch{}
  emit('civweave:working-campus-plan-built',{planId:saved.id,title:saved.title,source,reviewReady:true,aiGenerated:true,pathCount:Array.isArray(saved.paths)?saved.paths.length:0});
  emit('civweave:weave-review-ready',{planId:saved.id,title:saved.title,source,reviewReady:true,aiGenerated:true});
  const toast=document.getElementById('toast');
  if(toast&&isCivweavePage()){
    toast.textContent=`AI-generated Quest ready: ${clean(saved.title,180)||'your Quest'}. Nothing is active until you approve it.`;
    toast.hidden=false;setTimeout(()=>{if(toast.textContent.startsWith('AI-generated Quest ready:'))toast.hidden=true},6500);
  }
  return next;
}
function focusRevision(){
  const target=document.querySelector('#cw-shared-guide-surface-v236 textarea,#weaveling-chat-input,#cw-persistent-guide-chat-v215 textarea');
  if(!target)return false;target.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>target.focus(),220);return true;
}
function openReview(plan){
  if(!aiAuthoredPlan(plan))return false;
  const item=reviewItemFor(plan);
  if(!item)try{globalThis.CivweaveIntentionPlanner?.restore?.(plan)}catch{}
  if(globalThis.CivweaveIntentionUI?.open){globalThis.CivweaveIntentionUI.open(plan.id);return true}
  try{const current=parse(localStorage.getItem(WORKING_KEY),{});localStorage.setItem(WORKING_KEY,JSON.stringify({...current,stage:'review',view:'quest',plan:clone(plan),updatedAt:now()}))}catch{}
  location.reload();return true;
}
function renderReviewReady(plan){
  if(!isCivweavePage()||!aiAuthoredPlan(plan)){const stale=document.getElementById(BANNER_ID);if(stale&&plan?.id&&stale.dataset.planId===plan.id)stale.remove();return false}
  const workspace=document.getElementById('workspace'),work=workspace?.closest('.work');if(!workspace||!work)return false;
  let banner=document.getElementById(BANNER_ID);if(!banner){banner=document.createElement('section');banner.id=BANNER_ID;banner.setAttribute('aria-live','polite');work.insertBefore(banner,workspace)}
  banner.dataset.planId=plan.id;
  banner.innerHTML=`<div><small>AI QUEST GENERATED · REVIEW REQUIRED</small><strong>${esc(clean(plan.title,220)||'Reviewable Quest')}</strong><span>This saved Quest was generated by the selected AI and validated by Civweave. Nothing has been activated.</span></div><div class="cw-weave-review-actions"><button type="button" data-review-weave>Review Quest</button><button type="button" data-revise-weave>Revise Quest</button></div>`;
  banner.querySelector('[data-review-weave]')?.addEventListener('click',()=>openReview(plan));banner.querySelector('[data-revise-weave]')?.addEventListener('click',focusRevision);return true;
}
function patchPlanner(api=globalThis.CivweaveIntentionPlanner){
  if(!api?.persist||!api?.maybeCreate)return false;
  if(api.__cwQuestAIOnlyV265===VERSION){patchedPlanner=api;return true}
  const originalPersist=api.persist.__cwQuestAIOriginal||api.persist.bind(api);
  const originalRestore=typeof api.restore==='function'?(api.restore.__cwQuestAIOriginal||api.restore.bind(api)):null;
  const originalMaybe=api.maybeCreate.__cwQuestAIOriginal||api.maybeCreate.bind(api);
  const persist=plan=>{if(!aiAuthoredPlan(plan)){rejectUnauthorized(plan,'intention-planner.persist');const error=new Error('Quest persistence requires a validated AI-authored structured Quest.');error.code='QUEST_AI_AUTHORING_REQUIRED';throw error}return originalPersist(plan)};
  persist.__cwQuestAIOnlyV265=true;persist.__cwQuestAIOriginal=originalPersist;
  const restore=plan=>{if(!aiAuthoredPlan(plan))return rejectUnauthorized(plan,'intention-planner.restore');return originalRestore?originalRestore(plan):null};
  restore.__cwQuestAIOnlyV265=true;restore.__cwQuestAIOriginal=originalRestore;
  const maybeCreate=options=>{let detected=false;try{detected=Boolean(api.shouldCreate?.(options||{}))}catch{}if(detected)emit('civweave:quest-ai-generation-required',{source:'intention-planner.maybeCreate',text:clean(options?.text,1000)});return null};
  maybeCreate.__cwQuestAIOnlyV265=true;maybeCreate.__cwQuestAIOriginal=originalMaybe;
  let next=api;try{api.persist=persist;api.restore=restore;api.maybeCreate=maybeCreate;api.__cwQuestAIOnlyV265=VERSION}catch{}
  if(api.persist!==persist||api.maybeCreate!==maybeCreate){next={...api,persist,restore,maybeCreate,__cwQuestAIOnlyV265:VERSION,aiQuestOnly:true};try{globalThis.CivweaveIntentionPlanner=next}catch{return false}}
  patchedPlanner=next;emit('civweave:quest-ai-authority-ready',{surface:'planner'});return true;
}
function sanitizeAssistantResult(result){
  if(!result?.plan||aiAuthoredResult(result))return result;
  rejectUnauthorized(result.plan,`assistant-result:${clean(result?.provider||result?.requestedProvider,120)||'unknown'}`);
  const sanitized={...result,plan:null,planItemId:null,approvalGate:null,questAuthoring:{...(result?.questAuthoring||{}),aiGenerated:false,required:true,questCreated:false,rejectedBy:VERSION}};
  if(/generated and saved|reviewable quest|quest generated/i.test(clean(sanitized?.response?.answer,5000))){sanitized.response={...(sanitized.response||{}),answer:'The selected AI did not return a validated complete Quest, so Civweave did not create or save one.',requiresConsent:false,approvalGate:null}}
  return sanitized;
}
function patchAssistant(){
  const api=globalThis.CivweaveAssistantV141,current=api?.respond;if(!api||typeof current!=='function')return false;
  if(current.__cwQuestAIOnlyV265===VERSION){patchedAssistant=current;return true}
  const previous=current.bind(api),respond=async args=>sanitizeAssistantResult(await previous(args||{}));
  respond.__cwQuestAIOnlyV265=VERSION;respond.__prior=current;
  for(const key of ['__civweaveLocalProviderAuthorityV1','__civweaveLocalProviderAuthorityVersion','__cwPlatformGuideGuardsV1','__cwUnifiedChatSystemV1','__weavelingPlanJsonV190','__guideIdentityIntegrityV216','__cwGuideCapabilityPassoverV1','__deterministicModeV175','__cwMossLearningGoalPlannerV1'])if(current[key])respond[key]=current[key];
  try{api.respond=respond}catch{}
  if(api.respond!==respond){try{globalThis.CivweaveAssistantV141={...api,respond}}catch{return false}}
  patchedAssistant=globalThis.CivweaveAssistantV141?.respond||respond;emit('civweave:quest-ai-authority-ready',{surface:'assistant'});return true;
}
function waitForPlanner(timeout=10000){
  if(globalThis.CivweaveIntentionPlanner)return Promise.resolve(globalThis.CivweaveIntentionPlanner);
  return new Promise((resolve,reject)=>{const started=Date.now(),timer=setInterval(()=>{if(globalThis.CivweaveIntentionPlanner){clearInterval(timer);resolve(globalThis.CivweaveIntentionPlanner);return}if(Date.now()-started>=timeout){clearInterval(timer);reject(new Error('The canonical intention planner did not become ready.'))}},40)})
}
function ensurePlanner(){
  if(globalThis.CivweaveIntentionPlanner){patchPlanner();return Promise.resolve(globalThis.CivweaveIntentionPlanner)}
  if(readyPromise)return readyPromise;
  readyPromise=(async()=>{const existing=[...document.scripts].find(script=>{try{return new URL(script.src,location.href).pathname===PLANNER_PATH}catch{return false}});if(!existing){const script=document.createElement('script');script.src=`${PLANNER_PATH}?v=1.1.1-ai-quest-only`;script.async=false;document.head.append(script)}const api=await waitForPlanner();patchPlanner(api);return globalThis.CivweaveIntentionPlanner||api})().catch(error=>{readyPromise=null;console.warn('[Civweave] Weaveling planner readiness failed:',error);throw error});return readyPromise;
}
function recoverVisibleReview(){const current=parse(localStorage.getItem(WORKING_KEY),{}),plan=current?.stage==='review'?current.plan:null;if(aiAuthoredPlan(plan))renderReviewReady(plan)}
function start(){
  quarantineUnverifiedReviewQuests();ensurePlanner().catch(()=>{});patchAssistant();recoverVisibleReview();
  for(const name of ['civweave:guide-loader-reset','civweave:guide-workspace-ready','civweave:assistant-runtime-ready','civweave:local-provider-authority-installed','civweave:local-guide-control-bypass-ready','pageshow'])addEventListener(name,()=>queueMicrotask(()=>{quarantineUnverifiedReviewQuests();ensurePlanner().then(patchPlanner).catch(()=>{});patchAssistant();recoverVisibleReview()}));
  addEventListener('civweave:intentions-changed',recoverVisibleReview);
  let ticks=0;const timer=setInterval(()=>{if(globalThis.CivweaveIntentionPlanner!==patchedPlanner||globalThis.CivweaveIntentionPlanner?.__cwQuestAIOnlyV265!==VERSION)patchPlanner();if(globalThis.CivweaveAssistantV141?.respond!==patchedAssistant)patchAssistant();recoverVisibleReview();if(++ticks>=240)clearInterval(timer)},125);
}

globalThis.CivweaveWeavelingPlanMaterializationV265={version:VERSION,ensurePlanner,patchPlanner,patchAssistant,materialize,renderReviewReady,openReview,aiAuthoredPlan,aiAuthoredResult,sanitizeAssistantResult,quarantineUnverifiedReviewQuests,policy:'new-quests-require-ai-authored-structured-json-v265',deterministicQuestCreation:false,aiQuestOnly:true,legacyReviewQuarantine:true};
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
})();