(()=>{
'use strict';
const VERSION='1.0.31';
const SYSTEMS={
  commonweave:{name:'Commonweave',guide:'Weaveling',role:'central mirror and orchestrator',mascot:'/app/assets/ai/weaveling.png',prompt:'Tell Weaveling what you want to become true.',primary:[
    {label:'State an intention',id:'commonweave.state-wish'},
    {label:'Clarify the wish',id:'commonweave.clarify-wish'},
    {label:'Choose a skill posture',id:'commonweave.skill-posture'},
    {label:'Model setup',id:'commonweave.model-setup'},
    {label:'Shared intention map',id:'commonweave.shared-intention-map',planned:true}
  ]},
  'living-school':{name:'Living School',guide:'Moss',role:'learning guide',mascot:'/app/assets/ai/moss.png',prompt:'Tell Moss what you want to learn or demonstrate.',primary:[
    {label:'Start a learning path',id:'living-school.start-path'},
    {label:'Generate curriculum',id:'living-school.generate-curriculum'},
    {label:'Run a diagnostic',id:'living-school.diagnostic'},
    {label:'Create a practicum',id:'living-school.create-practicum'},
    {label:'Live cohort room',id:'living-school.live-cohort',planned:true}
  ]},
  cerbanimo:{name:'Cerbanimo',guide:'Kamiya',role:'Questwright and skilled-work guide',mascot:'/app/assets/ai/kamiya.png',prompt:'Tell Kamiya what visible result should exist.',primary:[
    {label:'Create or manage a quest',id:'cerbanimo.manage-quests'},
    {label:'Accept a task',id:'cerbanimo.accept-task'},
    {label:'Submit work and proof',id:'cerbanimo.submit-work'},
    {label:'Publish a material need',id:'cerbanimo.publish-need'},
    {label:'Skill simulator',id:'cerbanimo.skill-simulator',planned:true}
  ]},
  fellowfare:{name:'FellowFare',guide:'Rook',role:'quartermaster and exchange guide',mascot:'/app/assets/ai/rook.png',prompt:'Tell Rook what is needed or offered, where, and by when.',primary:[
    {label:'Post an offer',id:'fellowfare.post-offer'},
    {label:'Post a need',id:'fellowfare.post-need'},
    {label:'Borrow tools',id:'fellowfare.borrow-tools'},
    {label:'Draft fair terms',id:'fellowfare.draft-fair-terms'},
    {label:'Delivery routing',id:'fellowfare.delivery-routing',planned:true}
  ]},
  anarchadia:{name:'Anarchadia',guide:'Merlin',role:'civic, feature-request, and automation guide',mascot:'/app/assets/ai/merlin.png',prompt:'Tell Merlin what should change and how success should be tested.',primary:[]}
};
const ANARCHADIA_FEATURES=[
  {label:'Open proposals',description:'Review requests and local support signals.',action:['screen','proposals']},
  {label:'Feature request',description:'Create an official feature request.',action:['request','feature']},
  {label:'Bugfix request',description:'Create an official bug report.',action:['request','bugfix']},
  {label:'Public ledger',description:'Inspect local receipts and decisions.',action:['screen','ledger']},
  {label:'Automation pipeline',description:'Open rail checks, previews, and validation.',action:['screen','automation']},
  {label:'Observatory',description:'Inspect readiness, risk, and model posture.',action:['screen','observatory']},
  {label:'Citizen passport',description:'Return to the active local passport.',action:['scroll','passport']},
  {label:'Federation hall',description:'Cross-node federation controls.',planned:true},
  {label:'Assembly archive',description:'Long-form deliberation and decision history.',planned:true}
];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed==null?fallback:parsed}catch{return fallback}};
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const params=()=>new URLSearchParams(location.search);
const systemId=()=>{const query=params().get('system');if(SYSTEMS[query])return query;if(document.querySelector('.ac-console-bar'))return'anarchadia';return'commonweave'};
const chatKey=id=>`commonweave.cabinet-chat.${id}.v142`;
let ledgerPromise=null,mountQueued=false;
function loadLedger(){if(!ledgerPromise)ledgerPromise=globalThis.CommonweaveParity?.load?.().catch(()=>null)||Promise.resolve(null);return ledgerPromise}
function toast(message){let node=document.querySelector('#ch142-toast');if(!node){node=document.createElement('div');node.id='ch142-toast';node.className='ch142-toast';node.hidden=true;document.body.append(node)}node.textContent=message;node.hidden=false;clearTimeout(node._timer);node._timer=setTimeout(()=>node.hidden=true,2800)}
function history(id){const rows=parse(localStorage.getItem(chatKey(id)),[]);return Array.isArray(rows)?rows:[]}
function saveHistory(id,rows){localStorage.setItem(chatKey(id),JSON.stringify(rows.slice(-60)))}
function initialMessage(id){const config=SYSTEMS[id];return{role:'assistant',text:`I’m ${config.guide}, ${config.role} of ${config.name}. ${config.prompt}`}}
function gateMarkup(row){const gate=row.approvalGate;if(!gate)return'';if(gate.kind==='intention-activation')return`<div class="ch142-gate"><b>${gate.state==='active'?'Weave active':'Approval required'}</b><div><button type="button" data-ch142-gate="open-plan" data-id="${esc(gate.planId)}">Review weave</button>${gate.state!=='active'?`<button type="button" data-ch142-gate="activate-plan" data-id="${esc(gate.planId)}">Activate weave</button>`:''}</div></div>`;if(gate.kind==='realm-action-approval')return`<div class="ch142-gate"><b>${gate.missingRequired?.length?'Draft needs details':gate.state==='active'||gate.state==='published'?'Action active':'Approval required'}</b><div><button type="button" data-ch142-gate="open-action" data-id="${esc(gate.actionId)}">Review draft</button>${gate.required&&!gate.missingRequired?.length&&!['active','published'].includes(gate.state)?`<button type="button" data-ch142-gate="approve-action" data-id="${esc(gate.actionId)}">${esc(gate.label||'Approve')}</button>`:''}</div></div>`;return''}
function renderChat(band,id){const log=band.querySelector('[data-ch142-log]');if(!log)return;const rows=history(id),list=rows.length?rows:[initialMessage(id)];log.innerHTML=list.map(row=>`<article class="ch142-message ${row.role==='user'?'is-user':'is-guide'}${row.pending?' is-pending':''}"><p>${esc(row.text)}</p>${row.provider?`<small>${esc(row.provider)}${row.model?` · ${esc(row.model)}`:''}</small>`:''}${gateMarkup(row)}</article>`).join('');log.scrollTop=log.scrollHeight}
function roomLabel(ledger,roomId){return ledger?.index?.rooms?.get?.(roomId)?.label||ledger?.rooms?.find?.(room=>room.id===roomId)?.label||roomId||'Features'}
function capabilityDescription(capability){return clean(capability?.summary||capability?.purpose||'Open this canonical capability.',180)}
function resolveRealmFeatures(ledger,id){const capabilities=(ledger?.capabilities||[]).filter(capability=>capability.system===id),byId=new Map(capabilities.map(capability=>[capability.id,capability])),used=new Set(),groups=[];
  const primary=SYSTEMS[id].primary.map(entry=>{const capability=byId.get(entry.id);if(capability)used.add(capability.id);return capability?{label:entry.label,description:capabilityDescription(capability),capability}:{label:entry.label,description:'This feature is planned but not yet connected to a canonical capability.',planned:true}});
  groups.push({label:'Featured',items:primary});
  const rooms=new Map();for(const capability of capabilities){if(used.has(capability.id))continue;const key=capability.room||'other';if(!rooms.has(key))rooms.set(key,[]);rooms.get(key).push({label:capability.label,description:capabilityDescription(capability),capability})}
  for(const [room,items] of rooms)groups.push({label:roomLabel(ledger,room),items});return groups
}
function featuresMarkup(groups){return groups.map(group=>`<section class="ch142-feature-group"><h3>${esc(group.label)}</h3>${group.items.map(item=>`<button type="button" class="ch142-feature${item.planned?' is-coming':''}" ${item.capability?`data-ch142-capability="${esc(item.capability.id)}" data-room="${esc(item.capability.room)}"`:item.action?`data-ch142-action="${esc(item.action[0])}" data-value="${esc(item.action[1])}"`:'data-ch142-coming="true"'}><span><b>${esc(item.label)}</b><small>${esc(item.description)}</small></span><em>${item.planned?'Coming soon':'Open'}</em></button>`).join('')}</section>`).join('')}
async function createBand(header,id){const config=SYSTEMS[id],ledger=await loadLedger(),groups=id==='anarchadia'?[{label:'Citizen console',items:ANARCHADIA_FEATURES}]:resolveRealmFeatures(ledger,id);const band=document.createElement('section');band.className='ch142-control-band';band.dataset.cabinetHome='v142';band.dataset.system=id;band.innerHTML=`<div class="ch142-guide"><img src="${esc(config.mascot)}" alt="${esc(config.guide)}"><div><small>${esc(config.name)} guide</small><b>${esc(config.guide)}</b><span>${esc(config.role)}</span></div></div><div class="ch142-chat"><div class="ch142-chat-log" data-ch142-log aria-live="polite"></div><form class="ch142-chat-form" data-ch142-form><label class="ch142-sr" for="ch142-input-${esc(id)}">Message ${esc(config.guide)}</label><textarea id="ch142-input-${esc(id)}" name="message" rows="2" maxlength="4000" placeholder="${esc(config.prompt)}" required></textarea><button type="submit">Send</button></form></div><details class="ch142-features"><summary><span>Features</span><small>Open a working feature or see what is coming next.</small></summary><div class="ch142-feature-menu">${featuresMarkup(groups)}</div></details>`;
  header.insertAdjacentElement('afterend',band);renderChat(band,id);return band
}
async function submitChat(event,band,id){event.preventDefault();const form=event.currentTarget,input=form.elements.message,text=clean(input.value,4000);if(!text)return;const rows=history(id),pendingId=`pending-${Date.now().toString(36)}`;rows.push({role:'user',text},{role:'assistant',text:`${SYSTEMS[id].guide} is working through the ${SYSTEMS[id].name} contract…`,pending:true,id:pendingId});saveHistory(id,rows);input.value='';form.querySelector('button').disabled=true;renderChat(band,id);
  try{if(!globalThis.CommonweaveAssistantV141?.respond)throw new Error('The cabinet guide runtime has not loaded.');const result=await globalThis.CommonweaveAssistantV141.respond({text,systemId:id,history:rows.filter(row=>!row.pending)}),latest=history(id),index=latest.findIndex(row=>row.id===pendingId),next=clean(result.response?.choice?.nextAction,500),answer=clean(result.response?.answer||'The guide returned no text.'),replacement={role:'assistant',text:next?`${answer}\n\nNext: ${next}`:answer,provider:result.provider,model:result.model,approvalGate:result.response?.approvalGate||null,planSnapshot:result.plan?structuredClone(result.plan):null,actionSnapshot:result.action?structuredClone(result.action):null};if(index>=0)latest[index]=replacement;else latest.push(replacement);saveHistory(id,latest)}catch(error){const latest=history(id),index=latest.findIndex(row=>row.id===pendingId),replacement={role:'assistant',text:`The guide could not complete this call: ${error.message}`};if(index>=0)latest[index]=replacement;else latest.push(replacement);saveHistory(id,latest)}finally{form.querySelector('button').disabled=false;renderChat(band,id);input.focus()}
}
function openCapability(button,id){const capability=button.dataset.ch142Capability,room=button.dataset.room,query=new URLSearchParams({system:id,embed:'1',capability});if(room)query.set('room',room);location.assign(`/app/realm-console-v140.html?${query}`)}
function runAnarchadiaAction(type,value){if(type==='screen'){document.querySelector(`[data-screen-target="${CSS.escape(value)}"]`)?.click();return true}if(type==='request'){document.querySelector(`[data-request-kind="${CSS.escape(value)}"]`)?.click();return true}if(type==='scroll'&&value==='passport'){document.querySelector('[data-screen-target="home"]')?.click();document.querySelector('.ac-passport')?.scrollIntoView({behavior:'smooth',block:'start'});return true}return false}
function handleGate(button){const op=button.dataset.ch142Gate,id=button.dataset.id;if(op==='open-plan')globalThis.CommonweaveIntentionUI?.open?.(id);if(op==='activate-plan'){const result=globalThis.CommonweaveIntentionUI?.activate?.(id);toast(result?.ok?'Weave activated.':result?.error||'The weave could not be activated.')}if(op==='open-action')globalThis.CommonweaveActionUI?.open?.(id);if(op==='approve-action'){const result=globalThis.CommonweaveActionUI?.approve?.(id);toast(result?.ok?'Action approved and routed.':result?.error||'The action could not be approved.')}}
function bindBand(band,id){band.addEventListener('submit',event=>{if(event.target.matches('[data-ch142-form]'))submitChat(event,band,id)});band.addEventListener('click',event=>{const gate=event.target.closest('[data-ch142-gate]');if(gate){handleGate(gate);setTimeout(()=>renderChat(band,id),40);return}const capability=event.target.closest('[data-ch142-capability]');if(capability){openCapability(capability,id);return}const action=event.target.closest('[data-ch142-action]');if(action){if(!runAnarchadiaAction(action.dataset.ch142Action,action.dataset.value))toast('Coming soon.');band.querySelector('details')?.removeAttribute('open');return}if(event.target.closest('[data-ch142-coming]'))toast('Coming soon. This control stays here instead of sending you to a dead route.')})}
async function mount(){const id=systemId(),header=document.querySelector('.rc-top,.ac-console-bar');if(!header)return;document.documentElement.dataset.cabinetHomeV142='true';document.documentElement.dataset.cabinetMode=params().get('capability')?'feature':'home';if(document.querySelector('.ch142-control-band'))return;const band=await createBand(header,id);bindBand(band,id)}
function queueMount(){if(mountQueued)return;mountQueued=true;queueMicrotask(()=>{mountQueued=false;mount()})}
new MutationObserver(queueMount).observe(document.documentElement,{childList:true,subtree:true});addEventListener('DOMContentLoaded',queueMount,{once:true});queueMount();
})();
