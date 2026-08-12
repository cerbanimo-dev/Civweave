(()=>{
'use strict';
const VERSION='1.0.4-platform-experience-v160.1-hud-stable';
// Compatibility marker: VERSION='1.0.4-platform-experience-v160'
if(globalThis.CivweavePlatformExperienceV160?.version===VERSION)return;
const THEME_KEY='civweave.appearance.v160';
const ACTION_KEY='civweave.realm-actions.v141';
const INTENTION_KEY='civweave.intentions.v127';
const FUNDING_KEY='civweave.fellowfare.funding-plans.v160';
const THEMES=['system','dark','light'];
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const list=key=>{const value=parse(localStorage.getItem(key),[]);return Array.isArray(value)?value:[]};
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
const now=()=>new Date().toISOString();
const diagnostics={observerCallbacks:0,patchRuns:0,domWrites:0};
let observer=null;
let patchQueued=false;
let patching=false;
let refreshTimer=0;
function rewardEvents(){const value=parse(localStorage.getItem('civweave.rewards.v156'),{});return Array.isArray(value)?value:Array.isArray(value?.events)?value.events:[]}
function balance(){return rewardEvents().reduce((sum,row)=>sum+(row?.currency==='button'?Number(row.amount)||0:0),0)}
function theme(){const value=localStorage.getItem(THEME_KEY);return THEMES.includes(value)?value:'system'}
function resolved(value=theme()){if(value!=='system')return value;return matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}
function writeText(node,value){if(!node)return false;const next=String(value??'');if(node.textContent===next)return false;node.textContent=next;diagnostics.domWrites+=1;return true}
function writeTitle(node,value){if(!node)return false;const next=String(value??'');if(node.title===next)return false;node.title=next;diagnostics.domWrites+=1;return true}
function writeHidden(node,value){if(!node)return false;const next=Boolean(value);if(node.hidden===next)return false;node.hidden=next;diagnostics.domWrites+=1;return true}
function writeClass(node,name,enabled){if(!node?.classList)return false;const has=node.classList.contains(name);if(has===Boolean(enabled))return false;node.classList.toggle(name,Boolean(enabled));diagnostics.domWrites+=1;return true}
function syncFrame(frame){
  try{
    const doc=frame.contentDocument;
    if(!doc?.documentElement)return;
    const selected=theme(),mode=resolved(selected);
    if(doc.documentElement.dataset.civweaveTheme!==selected){doc.documentElement.dataset.civweaveTheme=selected;diagnostics.domWrites+=1}
    if(doc.documentElement.dataset.civweaveResolvedTheme!==mode){doc.documentElement.dataset.civweaveResolvedTheme=mode;diagnostics.domWrites+=1}
    if(doc.documentElement.style.colorScheme!==mode){doc.documentElement.style.colorScheme=mode;diagnostics.domWrites+=1}
    if(!doc.querySelector('link[data-cw160-frame-theme]')){
      const link=doc.createElement('link');
      link.rel='stylesheet';
      link.href='/app/platform-experience-v160.css?v=1.0.107-go-live-v300';
      link.dataset.cw160FrameTheme='';
      doc.head?.append(link);
      diagnostics.domWrites+=1;
    }
  }catch{}
}
function bindFrame(frame){
  if(!frame)return;
  if(frame.dataset.cw160ThemeBound!=='true'){
    frame.dataset.cw160ThemeBound='true';
    frame.addEventListener('load',()=>syncFrame(frame));
  }
  syncFrame(frame);
}
function syncFrames(root=document){
  if(root?.matches?.('iframe'))bindFrame(root);
  root?.querySelectorAll?.('iframe')?.forEach(bindFrame);
}
function applyTheme(value=theme(),persist=false){
  const selected=THEMES.includes(value)?value:'system';
  if(persist&&localStorage.getItem(THEME_KEY)!==selected)localStorage.setItem(THEME_KEY,selected);
  const mode=resolved(selected),root=document.documentElement;
  if(root.dataset.civweaveTheme!==selected){root.dataset.civweaveTheme=selected;diagnostics.domWrites+=1}
  if(root.dataset.civweaveResolvedTheme!==mode){root.dataset.civweaveResolvedTheme=mode;diagnostics.domWrites+=1}
  if(root.style.colorScheme!==mode){root.style.colorScheme=mode;diagnostics.domWrites+=1}
  const meta=document.querySelector('meta[name="theme-color"]'),color=mode==='dark'?'#071018':'#f3efe6';
  if(meta&&meta.content!==color){meta.content=color;diagnostics.domWrites+=1}
  refreshControls();
  syncFrames();
  try{dispatchEvent(new CustomEvent('civweave:appearance-changed',{detail:{theme:selected,resolved:mode}}))}catch{}
  return selected;
}
function cycleTheme(){const current=theme(),next=THEMES[(THEMES.indexOf(current)+1)%THEMES.length];return applyTheme(next,true)}
function explicitActionSystem(text,contextSystem='civweave'){
  const value=clean(text,4000).toLowerCase();
  if(!value)return'';
  if(/\b(dark mode|light mode|appearance|theme|feature request|bug report|report a bug|platform feature)\b/.test(value))return'anarchadia';
  if(/\b(need|looking for|find|get|buy|borrow|pay|purchase|food|meal|materials|supplies|trade request|offer)\b/.test(value)&&!/\bneed to (learn|study|practice)\b/.test(value))return'fellowfare';
  if(/\b(learn|teach|curriculum|lesson|study|practice a skill|learning path)\b/.test(value))return'living-school';
  if(/\b(build|implement|prototype|repair|develop|make a project|create a project|skilled work)\b/.test(value))return'cerbanimo';
  return contextSystem!=='civweave'&&/\b(request|draft|plan|create|make|start)\b/.test(value)?contextSystem:'';
}
function installPatchedGlobal(name,patch){
  let value=globalThis[name];
  try{
    Object.defineProperty(globalThis,name,{configurable:true,enumerable:true,get:()=>value,set:next=>{value=patch(next)}});
    if(value)value=patch(value);
  }catch{if(value)patch(value)}
}
function patchAssistant(api){
  if(!api?.respond||api.__cw160ActionRouting)return api;
  const original=api.respond.bind(api);
  api.respond=async options=>{
    const request={...(options||{})},startedIn=request.systemId||'civweave';
    let target='';
    if(startedIn==='civweave'){
      const contextSystem=request.contextSystem||document.documentElement.dataset.civweaveSystem||'civweave';
      target=explicitActionSystem(request.text,contextSystem);
      if(target)request.systemId=target;
    }
    const result=await original(request);
    if(target&&result?.action&&result.response?.answer)result.response.answer=`Weaveling routed this to ${target==='anarchadia'?'Anarchadia':target==='fellowfare'?'FellowFare':target==='living-school'?'Living School':'Cerbanimo'}. ${result.response.answer}`;
    return result;
  };
  Object.defineProperty(api,'__cw160ActionRouting',{value:true});
  return api;
}
function buttonBudget(text){
  const value=clean(text,4000);
  const match=value.match(/(?:pay|budget|spend|cost|offer|have|use)?\s*(\d+(?:\.\d{1,2})?)\s*(?:buttons?|coins?)\b/i)||value.match(/\b(?:buttons?|coins?)\s*(\d+(?:\.\d{1,2})?)/i);
  return match?Number(match[1]):null;
}
function writeActions(rows){
  localStorage.setItem(ACTION_KEY,JSON.stringify(rows.slice(0,120)));
  try{dispatchEvent(new CustomEvent('civweave:actions-changed',{detail:{items:rows}}))}catch{}
}
function patchFellowFareAction(action,text=''){
  if(!action||action.system!=='fellowfare')return action;
  const required=buttonBudget(text||action.sourceText);
  if(required==null)return action;
  const available=balance(),gap=Math.max(0,required-available);
  action.fields={...(action.fields||{}),exchangeMethod:'Buttons',buttonBudget:required,availableButtons:available,fundingGap:gap,publicationPolicy:gap?`Hold privately until ${gap} more Button${gap===1?' is':'s are'} earned.`:'Funding is available; publication still requires approval.'};
  action.missingRequired=(action.missingRequired||[]).filter(item=>item!=='maximum budget or exchange method');
  action.state='review';
  action.approval={...(action.approval||{}),required:true,label:gap?'Approve plan and hold for funding':'Approve & publish request'};
  action.checkpoints=[`Build the request plan for ${required} Buttons.`,...(action.checkpoints||[]).filter(item=>!/^Build the request plan/.test(item)),...(gap?[`Earn ${gap} more Button${gap===1?'':'s'} before publication.`]:[])];
  action.updatedAt=now();
  const rows=list(ACTION_KEY),index=rows.findIndex(item=>item.id===action.id);
  if(index>=0){rows[index]=action;writeActions(rows)}
  return action;
}
function holdFunding(action){
  const available=balance(),required=Number(action?.fields?.buttonBudget)||0,gap=Math.max(0,required-available);
  action.fields={...(action.fields||{}),availableButtons:available,fundingGap:gap};
  if(gap<=0)return null;
  action.state='funding';
  action.execution={...(action.execution||{}),status:'awaiting-buttons',events:[...(action.execution?.events||[]),{type:'fellowfare.plan.held-for-funding',at:now(),requiredButtons:required,availableButtons:available,gap}].slice(-40)};
  action.approval={...(action.approval||{}),required:true,label:'Recheck funding'};
  action.updatedAt=now();
  const plans=list(FUNDING_KEY),index=plans.findIndex(item=>item.actionId===action.id);
  const plan={schema:'civweave.fellowfare.funding-plan.v160',id:index>=0?plans[index].id:`funding-${Date.now().toString(36)}`,actionId:action.id,title:action.title,requiredButtons:required,availableButtons:available,gap,state:'held',visibility:'private',createdAt:index>=0?plans[index].createdAt:now(),updatedAt:now()};
  if(index>=0)plans[index]=plan;else plans.unshift(plan);
  localStorage.setItem(FUNDING_KEY,JSON.stringify(plans.slice(0,100)));
  const rows=list(ACTION_KEY),i=rows.findIndex(item=>item.id===action.id);
  if(i>=0){rows[i]=action;writeActions(rows)}
  return{ok:true,action,held:true,plan};
}
function patchContracts(api){
  if(!api?.compose||api.__cw160Funding)return api;
  const compose=api.compose.bind(api),approve=api.approve.bind(api),answer=api.answer?.bind(api);
  api.compose=(text,system,ctx)=>patchFellowFareAction(compose(text,system,ctx),text);
  api.approve=id=>{
    const action=api.get?.(id);
    if(action?.system==='fellowfare'&&Number(action.fields?.buttonBudget)>0){const held=holdFunding(action);if(held)return held}
    return approve(id);
  };
  if(answer)api.answer=action=>{
    if(action?.system==='fellowfare'&&Number(action.fields?.buttonBudget)>0){
      const gap=Number(action.fields.fundingGap)||0;
      return gap?`Rook built a private request plan for ${action.fields.buttonBudget} Buttons. You have ${action.fields.availableButtons||0}; approve the plan to hold it until ${gap} more are earned. Nothing will be shared yet.`:`Rook built a request plan for ${action.fields.buttonBudget} Buttons. Review and approve it before publication.`;
    }
    return answer(action);
  };
  Object.defineProperty(api,'__cw160Funding',{value:true});
  return api;
}
function pending(){
  const actions=list(ACTION_KEY).filter(item=>['draft','clarifying','review','funding'].includes(item?.state));
  const intentions=list(INTENTION_KEY).filter(item=>item?.kind==='weave-plan'&&(item.state==='review'||item.plan?.state==='review'));
  return[
    ...actions.map(item=>({type:'action',id:item.id,title:item.title,at:item.updatedAt||item.createdAt,state:item.state,system:item.system})),
    ...intentions.map(item=>({type:'intention',id:item.id,title:item.title||item.plan?.title||'Review weave',at:item.updatedAt||item.createdAt,state:'review',system:'civweave'}))
  ].sort((a,b)=>(Date.parse(b.at||0)||0)-(Date.parse(a.at||0)||0));
}
async function openLatest(){
  const item=pending()[0];
  if(!item)return;
  await globalThis.CivweaveFamilyAILoaderV105?.ensure?.();
  if(item.type==='action')globalThis.CivweaveActionUI?.open?.(item.id);else globalThis.CivweaveIntentionUI?.open?.(item.id);
}
function controlHost(){return document.getElementById?.('cwf104-head')||document.querySelector?.('.top')||null}
function makeControl(kind){
  const button=document.createElement('button');
  button.type='button';
  if(kind==='review'){
    button.dataset.cw160Review='';
    const label=document.createElement('span'),count=document.createElement('b'),title=document.createElement('small');
    label.dataset.cw160ReviewLabel='';count.dataset.cw160ReviewCount='';title.dataset.cw160ReviewTitle='';
    button.append(label,count,title);
    button.addEventListener('click',()=>openLatest().catch(()=>{}));
  }else{
    button.dataset.cw160Theme='';
    button.addEventListener('click',cycleTheme);
  }
  return button;
}
function ensureControls(){
  const head=controlHost();
  if(!head)return false;
  let changed=false;
  if(!head.querySelector('[data-cw160-review]')){head.append(makeControl('review'));diagnostics.domWrites+=1;changed=true}
  if(!head.querySelector('[data-cw160-theme]')){head.append(makeControl('theme'));diagnostics.domWrites+=1;changed=true}
  refreshControls(head);
  return changed;
}
function refreshControls(host=controlHost()){
  if(!host)return;
  const items=pending(),review=host.querySelector('[data-cw160-review]'),appearance=host.querySelector('[data-cw160-theme]');
  if(review){
    const label=review.querySelector('[data-cw160-review-label]'),count=review.querySelector('[data-cw160-review-count]'),title=review.querySelector('[data-cw160-review-title]');
    writeText(label,'Review');
    writeText(count,items.length?String(items.length):'');
    writeText(title,items[0]?.title||'');
    writeHidden(review,!items.length);
    writeClass(review,'is-attention',Boolean(items.length));
    writeTitle(review,items[0]?.title||'');
  }
  if(appearance){
    const value=theme(),label=`Theme: ${value[0].toUpperCase()+value.slice(1)}`;
    writeText(appearance,label);
    const aria=`Appearance is ${value}. Activate to switch theme.`;
    if(appearance.getAttribute?.('aria-label')!==aria){appearance.setAttribute?.('aria-label',aria);diagnostics.domWrites+=1}
  }
}
function relevantMutation(records){
  const needsHost=!controlHost();
  return records.some(record=>[...(record.addedNodes||[])].some(node=>{
    if(node?.nodeType!==1)return false;
    if(node.matches?.('iframe')||node.querySelector?.('iframe'))return true;
    if(needsHost&&(node.matches?.('#cwf104-head,.top')||node.querySelector?.('#cwf104-head,.top')))return true;
    return false;
  }));
}
function observe(){
  if(!document.documentElement)return;
  if(!observer)observer=new MutationObserver(records=>{
    diagnostics.observerCallbacks+=1;
    if(relevantMutation(records))queuePatch();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
}
function patchDom(){
  patchQueued=false;
  if(patching)return;
  patching=true;
  diagnostics.patchRuns+=1;
  observer?.disconnect?.();
  try{ensureControls();syncFrames()}finally{patching=false;observe()}
}
function queuePatch(){
  if(patchQueued||patching)return;
  patchQueued=true;
  queueMicrotask(patchDom);
}
function boot(){
  applyTheme();
  patchDom();
  addEventListener('storage',event=>{
    if(![THEME_KEY,ACTION_KEY,INTENTION_KEY,'civweave.rewards.v156'].includes(event.key))return;
    if(event.key===THEME_KEY)applyTheme();else refreshControls();
  });
  addEventListener('civweave:actions-changed',()=>refreshControls());
  addEventListener('civweave:intentions-changed',()=>refreshControls());
  addEventListener('civweave:rewards-changed',()=>refreshControls());
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{if(theme()==='system')applyTheme()});
  clearInterval(refreshTimer);
  refreshTimer=setInterval(()=>refreshControls(),15000);
}
installPatchedGlobal('CivweaveAssistantV141',patchAssistant);
installPatchedGlobal('CivweaveGuideContractsV141',patchContracts);
document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot();
globalThis.CivweavePlatformExperienceV160={version:VERSION,theme,applyTheme,cycleTheme,pending,openLatest,explicitActionSystem,buttonBalance:balance,refreshControls,diagnostics};
})();
