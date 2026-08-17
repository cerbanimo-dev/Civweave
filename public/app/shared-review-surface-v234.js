(()=>{
'use strict';

const VERSION='1.0.1-direct-quest-copy';
const REVISION='shared-review-surface-v234';
const STYLE_ID='cw-shared-review-style-v234';
const SURFACE_ID='cw-shared-review-surface-v234';
const PENDING_ID='cw-review-weaves-v234';
const INTENTIONS_KEY='civweave.intentions.v127';
const ACTIONS_KEY='civweave.realm-actions.v141';
const REALM_INBOX_KEY='civweave.realm-inbox.v1';
const WORKING_KEY='civweave.working-campus.v1';
const CONTRACT_SCRIPT='/app/guide-contracts-v141.js';
const SYSTEM_LABEL={civweave:'Civweave','living-school':'Living School',cerbanimo:'Cerbanimo',fellowfare:'FellowFare',anarchadia:'Anarchadia'};
const GUIDE_NAME={civweave:'Weaveling','living-school':'Moss',cerbanimo:'Kamiya',fellowfare:'Rook',anarchadia:'Merlin'};
const SUPPORTED_GATES=new Set(['open-plan','activate-plan','open-action','approve-action']);

if(globalThis.CivweaveSharedReviewSurfaceV234?.version===VERSION)return;

const clean=(value,max=8000)=>String(value??'').trim().slice(0,max);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const now=()=>new Date().toISOString();
const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const arr=key=>{try{const value=parse(localStorage.getItem(key),[]);return Array.isArray(value)?value:[]}catch{return[]}};
const obj=key=>{try{const value=parse(localStorage.getItem(key),{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch{return{}}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};

let current=null;
let hubObserver=null;
let discoveryObserver=null;
let contractPromise=null;

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
#${SURFACE_ID}{box-sizing:border-box;color:var(--ink,#f8fbff);font:14px/1.42 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
#${SURFACE_ID} *{box-sizing:border-box}
#${SURFACE_ID}[data-host="persistent-chat"]{position:absolute;z-index:70;inset:70px 0 0;overflow:auto;overscroll-behavior:contain;background:color-mix(in srgb,var(--panel,#081225) 96%,#000);border-top:1px solid var(--line,#ffffff2b);padding:13px}
#${SURFACE_ID}[data-host="inline-chat"]{position:absolute;z-index:70;inset:0;overflow:auto;background:#07111ff5;border:1px solid #ffffff28;border-radius:16px;padding:13px;box-shadow:0 18px 60px #0009}
#${SURFACE_ID}[data-host="body"]{position:fixed;z-index:2147483650;right:max(14px,env(safe-area-inset-right));bottom:max(14px,env(safe-area-inset-bottom));width:min(440px,calc(100vw - 28px));max-height:calc(100dvh - 28px);overflow:auto;background:#0b1424f7;color:#f8fbff;border:1px solid #ffffff30;border-radius:22px;padding:13px;box-shadow:0 24px 80px #000a;backdrop-filter:blur(18px)}
#${SURFACE_ID} .cwsr234-head{display:flex;align-items:flex-start;gap:10px;padding:4px 2px 12px;border-bottom:1px solid color-mix(in srgb,var(--line,#ffffff2b) 70%,transparent)}
#${SURFACE_ID} .cwsr234-head>div{min-width:0;flex:1}#${SURFACE_ID} .cwsr234-head small{display:block;color:var(--accent,#8de5ef);font-size:10px;font-weight:900;letter-spacing:.11em}#${SURFACE_ID} .cwsr234-head h2{margin:3px 0 0;font:800 19px/1.15 Georgia,serif}#${SURFACE_ID} .cwsr234-close{width:36px;height:36px;border:1px solid var(--line,#ffffff2b);border-radius:10px;background:#ffffff0d;color:inherit;font-size:20px;cursor:pointer}
#${SURFACE_ID} .cwsr234-state{display:inline-flex;margin-top:7px;padding:3px 8px;border:1px solid color-mix(in srgb,var(--accent,#8de5ef) 55%,transparent);border-radius:999px;color:var(--accent,#8de5ef);font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}
#${SURFACE_ID} .cwsr234-summary{padding:12px 2px 4px}#${SURFACE_ID} .cwsr234-summary p{margin:0 0 8px;color:var(--muted,#b8c6df)}
#${SURFACE_ID} .cwsr234-block{margin-top:10px;padding:11px;border:1px solid color-mix(in srgb,var(--line,#ffffff2b) 70%,transparent);border-radius:14px;background:#ffffff08}#${SURFACE_ID} .cwsr234-block>small{display:block;color:var(--accent,#8de5ef);font-size:9px;font-weight:900;letter-spacing:.1em;margin-bottom:5px}#${SURFACE_ID} .cwsr234-block h3{margin:0 0 6px;font-size:14px}#${SURFACE_ID} .cwsr234-block p{margin:0 0 7px;color:var(--muted,#b8c6df)}#${SURFACE_ID} ol,#${SURFACE_ID} ul{margin:7px 0 0;padding-left:20px}#${SURFACE_ID} li+li{margin-top:5px}
#${SURFACE_ID} .cwsr234-fields{display:grid;gap:7px;margin:0}#${SURFACE_ID} .cwsr234-fields>div{display:grid;gap:2px;padding:7px 0;border-top:1px solid #ffffff0e}#${SURFACE_ID} .cwsr234-fields>div:first-child{border-top:0}#${SURFACE_ID} dt{font-size:10px;font-weight:900;color:var(--accent,#8de5ef);text-transform:uppercase;letter-spacing:.06em}#${SURFACE_ID} dd{margin:0;color:var(--muted,#b8c6df);white-space:pre-wrap}
#${SURFACE_ID} .cwsr234-warning{margin-top:10px;padding:9px 10px;border:1px solid #ffd36e66;border-radius:12px;background:#ffd36e12;color:#ffe7a8}
#${SURFACE_ID} .cwsr234-actions{position:sticky;bottom:-13px;display:flex;flex-wrap:wrap;gap:8px;margin:13px -13px -13px;padding:11px 13px;background:color-mix(in srgb,var(--panel,#081225) 96%,#000);border-top:1px solid var(--line,#ffffff2b)}#${SURFACE_ID} .cwsr234-actions button{min-height:40px;padding:0 13px;border:1px solid var(--line,#ffffff2b);border-radius:999px;background:#ffffff0d;color:inherit;font-weight:800;cursor:pointer}#${SURFACE_ID} .cwsr234-actions .primary{background:var(--accent,#d8dde7);color:#09111d;border-color:transparent}
#${PENDING_ID}{border-color:#d8dde755!important}#${PENDING_ID} .cwsr234-pending-list{display:grid}#${PENDING_ID} details{border-top:1px solid #ffffff10}#${PENDING_ID} details:first-child{border-top:0}#${PENDING_ID} summary{list-style:none;cursor:pointer;padding:11px 12px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center}#${PENDING_ID} summary::-webkit-details-marker{display:none}#${PENDING_ID} summary strong{display:block;font-size:13px}#${PENDING_ID} summary small{display:block;color:var(--mint,#8af5d2);font-size:9px;font-weight:900;letter-spacing:.09em}#${PENDING_ID} summary b{font-size:10px;color:var(--muted,#9eb0c6);text-transform:uppercase}#${PENDING_ID} .cwsr234-pending-body{padding:0 12px 12px}#${PENDING_ID} .cwsr234-pending-body p{margin:0 0 8px;color:var(--muted,#9eb0c6);font-size:12px}#${PENDING_ID} .cwsr234-path-list{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:9px}#${PENDING_ID} .cwsr234-path-list span{padding:3px 7px;border-radius:999px;background:#ffffff0b;border:1px solid #ffffff18;font-size:10px}#${PENDING_ID} .cwsr234-review-button{min-height:34px;padding:0 10px;border:1px solid #8af5d255;border-radius:999px;background:#8af5d214;color:inherit;font-weight:800;cursor:pointer}
@media(max-width:560px){#${SURFACE_ID}[data-host="body"]{left:max(12px,env(safe-area-inset-left));right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));width:auto}}
`;
  document.head.append(style);
}

function findPlanItem(id){
  return arr(INTENTIONS_KEY).find(item=>item?.id===id||item?.plan?.id===id)||null;
}
function findAction(id){return arr(ACTIONS_KEY).find(item=>item?.id===id)||null}
function reviewWeaves(){
  return arr(INTENTIONS_KEY)
    .filter(item=>item?.kind==='weave-plan'&&item?.plan&&String(item.state||item.plan?.state||'').toLowerCase()==='review')
    .sort((a,b)=>Date.parse(b.updatedAt||b.plan?.updatedAt||0)-Date.parse(a.updatedAt||a.plan?.updatedAt||0))
    .slice(0,8);
}
function realm(value){const id=clean(value,80).toLowerCase().replace(/_/g,'-');return SYSTEM_LABEL[id]?id:'civweave'}
function humanKey(value){return clean(value,120).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]+/g,' ').replace(/^./,char=>char.toUpperCase())}
function valueText(value){
  if(value==null||value==='')return'Not yet specified';
  if(Array.isArray(value))return value.map(item=>clean(item,500)).filter(Boolean).join('\n');
  if(typeof value==='object')return Object.entries(value).map(([key,item])=>`${humanKey(key)}: ${clean(Array.isArray(item)?item.join(', '):item,700)}`).join('\n');
  return clean(value,1200);
}
function fieldsMarkup(fields={}){
  const entries=Object.entries(fields||{}).filter(([,value])=>value!==undefined&&value!==null&&value!=='');
  if(!entries.length)return'';
  return`<section class="cwsr234-block"><small>DETAILS</small><dl class="cwsr234-fields">${entries.map(([key,value])=>`<div><dt>${esc(humanKey(key))}</dt><dd>${esc(valueText(value))}</dd></div>`).join('')}</dl></section>`;
}
function listMarkup(label,items){
  const list=Array.isArray(items)?items.map(item=>clean(item,1400)).filter(Boolean):[];
  return list.length?`<section class="cwsr234-block"><small>${esc(label)}</small><ol>${list.map(item=>`<li>${esc(item)}</li>`).join('')}</ol></section>`:'';
}
function openPersistentChat(system){
  try{return globalThis.CivweavePersistentGuideChatV215?.open?.({guide:realm(system)})||null}catch{return null}
}
function chooseHost(source=null){
  const persistent=document.getElementById('cw-persistent-guide-chat-v215');
  if(persistent)return{node:persistent,type:'persistent-chat'};
  const inline=source?.closest?.('.ch142-control-band,.ch142-chat')||document.querySelector('.ch142-control-band');
  if(inline){if(getComputedStyle(inline).position==='static')inline.style.position='relative';return{node:inline,type:'inline-chat'}}
  return{node:document.body,type:'body'};
}
function removeSurface(){document.getElementById(SURFACE_ID)?.remove();current=null;return true}
function focusChat(){
  removeSurface();
  queueMicrotask(()=>document.querySelector('#cw-persistent-guide-chat-v215 textarea,.ch142-chat-form textarea')?.focus({preventScroll:true}));
}
function notify(system,text){
  try{globalThis.CivweavePersistentGuideChatV215?.notify?.(realm(system),text,{open:true});return}catch{}
  try{dispatchEvent(new CustomEvent('civweave:guide-notification',{detail:{system:realm(system),text,open:true}}))}catch{}
}
function renderPlan(item,source=null){
  const plan=item?.plan||item;
  if(!plan)return false;
  openPersistentChat('civweave');
  installStyle();
  const host=chooseHost(source),surface=document.createElement('section');
  removeSurface();
  surface.id=SURFACE_ID;surface.dataset.host=host.type;surface.dataset.kind='weave';surface.dataset.id=clean(item.id||plan.id,180);
  const paths=Array.isArray(plan.paths)?plan.paths:[];
  const governance=plan.governance&&typeof plan.governance==='object'?plan.governance:null;
  surface.innerHTML=`
    <header class="cwsr234-head"><div><small>QUEST REVIEW</small><h2>${esc(plan.title||item.text||'Untitled Quest')}</h2><span class="cwsr234-state">${esc(item.state||plan.state||'review')}</span></div><button class="cwsr234-close" type="button" data-review-command="close" aria-label="Close review">×</button></header>
    <div class="cwsr234-summary">${plan.wish?`<p><strong>Quest goal:</strong> ${esc(plan.wish)}</p>`:''}${plan.outcome?`<p>${esc(plan.outcome)}</p>`:''}</div>
    ${paths.map((path,index)=>`<section class="cwsr234-block"><small>${esc(`${index+1} · ${SYSTEM_LABEL[realm(path.realm)]||humanKey(path.realm)} · ${path.status||'ready'}`)}</small><h3>${esc(path.title||'Untitled path')}</h3>${path.purpose?`<p>${esc(path.purpose)}</p>`:''}${listMarkup('STEPS',path.steps)}${path.completionCriteria?`<p><strong>Completion:</strong> ${esc(path.completionCriteria)}</p>`:''}</section>`).join('')}
    ${listMarkup('ASSUMPTIONS',plan.assumptions)}
    ${governance?`<section class="cwsr234-block"><small>ANARCHADIA · PASSPORT AND CONSENT</small><h3>${esc(governance.title||'Governance layer')}</h3>${governance.purpose?`<p>${esc(governance.purpose)}</p>`:''}${Array.isArray(governance.agreements)&&governance.agreements.length?`<ul>${governance.agreements.map(item=>`<li>${esc(item)}</li>`).join('')}</ul>`:''}</section>`:''}
    <div class="cwsr234-actions"><button type="button" data-review-command="close">Keep under review</button>${String(item.state||plan.state||'review')==='review'?`<button type="button" class="primary" data-review-command="activate-plan" data-id="${esc(item.id||plan.id)}">Activate Quest</button>`:''}</div>`;
  host.node.append(surface);current={kind:'weave',id:surface.dataset.id,source};return surface;
}
function renderAction(action,source=null){
  if(!action)return false;
  const system=realm(action.system);
  openPersistentChat(system);
  installStyle();
  const host=chooseHost(source),surface=document.createElement('section');
  removeSurface();
  surface.id=SURFACE_ID;surface.dataset.host=host.type;surface.dataset.kind='action';surface.dataset.id=clean(action.id,180);
  const missing=Array.isArray(action.missingRequired)?action.missingRequired.filter(Boolean):[];
  const required=Boolean(action.approval?.required);
  const approvable=required&&!missing.length&&!['active','published','completed'].includes(action.state);
  surface.innerHTML=`
    <header class="cwsr234-head"><div><small>${esc(`${SYSTEM_LABEL[system]} · ${GUIDE_NAME[system]||'GUIDE'} REVIEW`)}</small><h2>${esc(action.title||humanKey(action.kind||'draft'))}</h2><span class="cwsr234-state">${esc(action.state||'review')}</span></div><button class="cwsr234-close" type="button" data-review-command="close" aria-label="Close review">×</button></header>
    <div class="cwsr234-summary">${action.sourceText?`<p>${esc(action.sourceText)}</p>`:''}</div>
    ${fieldsMarkup(action.fields)}
    ${missing.length?`<div class="cwsr234-warning"><strong>Still needed:</strong> ${esc(missing.join(' · '))}</div>`:''}
    ${listMarkup('CHECKPOINTS',action.checkpoints)}
    ${listMarkup('ACCEPTANCE CRITERIA',action.acceptanceCriteria)}
    ${listMarkup('EVIDENCE',action.evidence)}
    <div class="cwsr234-actions"><button type="button" data-review-command="focus-chat">Return to chat</button>${approvable?`<button type="button" class="primary" data-review-command="approve-action" data-id="${esc(action.id)}">${esc(action.approval?.label||'Approve')}</button>`:''}</div>`;
  host.node.append(surface);current={kind:'action',id:action.id,source};return surface;
}
function openPlan(id,options={}){const item=findPlanItem(id);if(!item){notify('civweave','That Quest is no longer present on this device.');return false}return renderPlan(item,options.source||null)}
function openAction(id,options={}){const action=findAction(id);if(!action){notify('civweave','That draft is no longer present on this device.');return false}return renderAction(action,options.source||null)}

function buildHandoffs(plan){
  const packets=(Array.isArray(plan.paths)?plan.paths:[]).map(path=>({
    id:uid('handoff'),schema:'civweave.handoff.v1',source:'civweave',target:realm(path.realm),kind:path.type||'path',title:path.title||'Quest path',status:'accepted',
    payload:{weaveId:plan.id,wish:plan.wish||'',path,profile:plan.profile||{},manualReviewRequired:true},createdAt:now()
  }));
  if(plan.governance){packets.push({id:uid('handoff'),schema:'civweave.handoff.v1',source:'civweave',target:'anarchadia',kind:'intention-passport',title:plan.governance.title||'Personal passport entry',status:'accepted',payload:{weaveId:plan.id,wish:plan.wish||'',governance:plan.governance,manualReviewRequired:true},createdAt:now()})}
  return packets;
}
function activatePlan(id){
  const items=arr(INTENTIONS_KEY),index=items.findIndex(item=>item?.id===id||item?.plan?.id===id);
  if(index<0)return{ok:false,error:'The saved Quest could not be found.'};
  const item=items[index],plan=structuredClone(item.plan||item);
  const at=now();
  plan.state='active';plan.updatedAt=at;
  if(Array.isArray(plan.paths))for(const path of plan.paths){if(!path.status||path.status==='draft'||path.status==='review')path.status='ready';if(!Array.isArray(path.progress))path.progress=[]}
  item.plan=plan;item.state='active';item.done=false;item.updatedAt=at;items[index]=item;
  write(INTENTIONS_KEY,items.slice(0,100));
  const oldInbox=arr(REALM_INBOX_KEY).filter(packet=>packet?.payload?.weaveId!==plan.id);
  write(REALM_INBOX_KEY,[...buildHandoffs(plan),...oldInbox].slice(0,120));
  const working=obj(WORKING_KEY);
  write(WORKING_KEY,{...working,wish:plan.wish||working.wish||'',plan,stage:'active',view:'quest',updatedAt:at});
  try{dispatchEvent(new CustomEvent('civweave:intentions-changed',{detail:{items}}))}catch{}
  try{dispatchEvent(new CustomEvent('civweave:working-campus-plan-built',{detail:{plan,state:'active',source:REVISION}}))}catch{}
  try{dispatchEvent(new CustomEvent('civweave:review-plan-activated',{detail:{id:plan.id,plan,source:REVISION}}))}catch{}
  removeSurface();mountPendingWeaves();notify('civweave',`The Quest “${plan.title||'Untitled Quest'}” is active. Its realm handoffs are ready.`);
  return{ok:true,item,plan};
}
function ensureGuideContracts(){
  if(globalThis.CivweaveGuideContractsV141)return Promise.resolve(globalThis.CivweaveGuideContractsV141);
  if(contractPromise)return contractPromise;
  contractPromise=new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname===CONTRACT_SCRIPT);
    const finish=()=>globalThis.CivweaveGuideContractsV141?resolve(globalThis.CivweaveGuideContractsV141):reject(new Error('Guide contracts loaded without becoming ready.'));
    if(existing){existing.addEventListener('load',finish,{once:true});setTimeout(finish,0);return}
    const script=document.createElement('script');script.src=`${CONTRACT_SCRIPT}?v=${REVISION}`;script.async=false;script.onload=finish;script.onerror=()=>reject(new Error('Could not load the guide action contract.'));document.head.append(script);
  }).catch(error=>{contractPromise=null;throw error});
  return contractPromise;
}
async function approveAction(id){
  try{
    const contracts=await ensureGuideContracts(),result=contracts?.approve?.(id)||{ok:false,error:'Approval is unavailable.'};
    if(!result.ok){notify(findAction(id)?.system||'civweave',result.error||'That draft could not be approved.');return result}
    const action=result.action||findAction(id);removeSurface();notify(action?.system||'civweave',`Approved: ${action?.title||'draft'}.`);
    try{dispatchEvent(new CustomEvent('civweave:review-action-approved',{detail:{id,action,source:REVISION}}))}catch{}
    return result;
  }catch(error){notify(findAction(id)?.system||'civweave',`Approval could not complete: ${clean(error?.message||error,700)}`);return{ok:false,error:clean(error?.message||error,700)}}
}

async function handleSurfaceClick(event){
  const button=event.target.closest('[data-review-command]');if(!button)return;
  const command=button.dataset.reviewCommand,id=button.dataset.id||current?.id;
  if(command==='close')return removeSurface();
  if(command==='focus-chat')return focusChat();
  if(command==='activate-plan')return activatePlan(id);
  if(command==='approve-action')return approveAction(id);
}
function onGateCapture(event){
  const button=event.target instanceof Element?event.target.closest('[data-gate],[data-cwf-gate]'):null;
  if(!button)return;
  const command=button.dataset.gate||button.dataset.cwfGate;
  if(!SUPPORTED_GATES.has(command))return;
  const id=clean(button.dataset.id,220);if(!id)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(command==='open-plan')openPlan(id,{source:button});
  if(command==='open-action')openAction(id,{source:button});
  if(command==='activate-plan')activatePlan(id);
  if(command==='approve-action')approveAction(id);
  try{dispatchEvent(new CustomEvent(`civweave:shared-review-${command}`,{detail:{id,handled:true,source:REVISION,at:now()}}))}catch{}
}

function pendingMarkup(items){
  return items.map(item=>{
    const plan=item.plan||{},paths=Array.isArray(plan.paths)?plan.paths:[];
    return`<details><summary><span><small>QUEST REVIEW</small><strong>${esc(plan.title||item.text||'Untitled Quest')}</strong></span><b>${esc(item.state||'review')}</b></summary><div class="cwsr234-pending-body">${plan.outcome?`<p>${esc(plan.outcome)}</p>`:''}${paths.length?`<div class="cwsr234-path-list">${paths.map(path=>`<span>${esc(SYSTEM_LABEL[realm(path.realm)]||humanKey(path.realm))}: ${esc(path.title||'path')}</span>`).join('')}</div>`:''}<button type="button" class="cwsr234-review-button" data-review-hub="${esc(item.id||plan.id)}">Review in chat</button></div></details>`;
  }).join('');
}
function mountPendingWeaves(){
  const hub=document.getElementById('weaveling-hub-v233');
  if(!hub)return false;
  installStyle();
  const items=reviewWeaves(),signature=items.map(item=>`${item.id}:${item.updatedAt||item.plan?.updatedAt||''}`).join('|');
  let section=document.getElementById(PENDING_ID);
  if(!items.length){section?.remove();return true}
  if(section?.dataset.signature===signature)return true;
  if(!section){section=document.createElement('section');section.id=PENDING_ID;section.className='wh233-panel cwsr234-pending';const thread=hub.querySelector('.wh233-thread');thread?.insertAdjacentElement('afterend',section);if(!section.isConnected)hub.prepend(section)}
  section.dataset.signature=signature;
  section.innerHTML=`<header><div><small>QUESTS UNDER REVIEW</small><h2>Waiting for your call</h2></div><b>${items.length}</b></header><div class="cwsr234-pending-list">${pendingMarkup(items)}</div>`;
  section.onclick=event=>{const button=event.target.closest('[data-review-hub]');if(button)openPlan(button.dataset.reviewHub,{source:button})};
  return true;
}
function watchHub(){
  const hub=document.getElementById('weaveling-hub-v233');
  if(!hub)return false;
  discoveryObserver?.disconnect();discoveryObserver=null;
  hubObserver?.disconnect();
  hubObserver=new MutationObserver(()=>mountPendingWeaves());
  hubObserver.observe(hub,{childList:true,subtree:false});
  mountPendingWeaves();return true;
}
function discoverHub(){
  if(watchHub())return;
  if(discoveryObserver)return;
  discoveryObserver=new MutationObserver(()=>watchHub());
  discoveryObserver.observe(document.documentElement,{childList:true,subtree:true});
}
function onStorage(event){if([INTENTIONS_KEY,ACTIONS_KEY,WORKING_KEY,REALM_INBOX_KEY].includes(event.key)){mountPendingWeaves();if(current?.kind==='weave'&&event.key===INTENTIONS_KEY)openPlan(current.id);if(current?.kind==='action'&&event.key===ACTIONS_KEY)openAction(current.id)}}
function start(){
  installStyle();
  document.addEventListener('click',onGateCapture,true);
  document.addEventListener('click',handleSurfaceClick);
  addEventListener('storage',onStorage);
  addEventListener('civweave:intentions-changed',mountPendingWeaves);
  addEventListener('civweave:working-campus-plan-built',mountPendingWeaves);
  discoverHub();
  document.documentElement.dataset.sharedReviewSurface=REVISION;
  try{dispatchEvent(new CustomEvent('civweave:shared-review-ready',{detail:{version:VERSION,revision:REVISION,at:now()}}))}catch{}
}

const api=Object.freeze({version:VERSION,revision:REVISION,openPlan,activatePlan,openAction,approveAction,close:removeSurface,reviewWeaves,mountPendingWeaves,start});
globalThis.CivweaveSharedReviewSurfaceV234=api;
document.readyState==='loading'?addEventListener('DOMContentLoaded',start,{once:true}):start();
})();