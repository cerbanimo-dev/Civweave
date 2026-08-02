'use strict';
const VERSION='1.0.30';
const WORKFLOW_KEY='commonweave.cabinet-workflow.v129';
const SETTINGS_KEY='commonweave.universal-ai.v127';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const $=selector=>document.querySelector(selector);
const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed==null?fallback:parsed}catch{return fallback}};
let ledger,state,workspace=null,toastTimer;
const cabinetUrls=new Map();
async function cabinetUrl(system){
  if(cabinetUrls.has(system.id))return cabinetUrls.get(system.id);
  const shell=system.interfaceShell||{};
  const promise=Promise.resolve(shell.asset||`/app/assets/cabinets/${encodeURIComponent(system.id)}.webp`);
  cabinetUrls.set(system.id,promise);return promise;
}
function setCabinetArt(system){
  const image=$('#cabinet-art');
  image.removeAttribute('src');
  image.onerror=()=>{toast(`Cabinet art could not load for ${system.name}.`);report('cabinet-load-failed',{system:system.id,src:image.src})};
  cabinetUrl(system).then(url=>{if(document.documentElement.dataset.system===system.id){image.src=url;image.alt=`${system.name} cabinet workstation`}});
}
function readWorkflow(){return parse(localStorage.getItem(WORKFLOW_KEY),{wish:'',clarification:{outcome:'',context:'',constraints:''},skill:{posture:'practice',level:2},weave:null,activatedAt:null,passport:null,rewards:{acorns:0,buttons:0}})}
function writeWorkflow(next){localStorage.setItem(WORKFLOW_KEY,JSON.stringify(next));return next}
function workflowPatch(patch){return writeWorkflow({...readWorkflow(),...patch})}
function toast(message){const node=$('#lite-toast');node.textContent=message;node.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.hidden=true,3200)}
function report(kind,detail={}){fetch('/api/boot-log',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:`cabinet-lite:${kind}`,version:VERSION,detail}),keepalive:true}).catch(()=>{})}
function setRoute(next,{replace=false}={}){workspace=null;state={...state,...next};const url=CommonweaveParity.liteUrl(state);history[replace?'replaceState':'pushState'](state,'',url);render()}
function systemFor(id){return ledger.index.systems.get(id)||ledger.systems[0]}
function roomCapabilities(system,room){return ledger.capabilities.filter(item=>item.system===system.id&&item.room===room.id)}
function applyShell(system){
  const shell=system.interfaceShell||{};const screen=shell.screen||{};
  document.documentElement.dataset.system=system.id;
  document.documentElement.style.setProperty('--accent',system.accent||'#67e5d2');
  document.documentElement.style.setProperty('--accent-2',shell.accent2||system.accent||'#7d6cff');
  document.documentElement.style.setProperty('--screen-x',`${screen.x??10.8}%`);
  document.documentElement.style.setProperty('--screen-y',`${screen.y??21.9}%`);
  document.documentElement.style.setProperty('--screen-w',`${screen.width??78.4}%`);
  document.documentElement.style.setProperty('--screen-h',`${screen.height??61.2}%`);
  document.documentElement.style.setProperty('--screen-radius',`${screen.radius??4.2}%`);
  setCabinetArt(system);
  $('#screen-logo').src=system.logo;$('#screen-logo').alt=`${system.name} logo`;
  $('#screen-guide').textContent=`${system.guide} · ${shell.motif||'shared Commonweave workstation'}`;
  $('#screen-system').textContent=system.name;
}
function renderCabinetControls(system){
  const target=$('#cabinet-controls');const order=system.interfaceShell?.controlOrder||['anarchadia','fellowfare','commonweave','living-school','cerbanimo'];
  target.innerHTML=order.map(id=>{const item=systemFor(id);return `<button type="button" class="${id===system.id?'is-active':''}" data-system="${esc(id)}" aria-label="Open ${esc(item.name)}"></button>`}).join('');
}
function renderRooms(system,room){
  $('#room-list').innerHTML=system.rooms.map(item=>`<button type="button" class="${item.id===room.id?'is-active':''}" data-room="${esc(item.id)}" title="${esc(item.purpose)}">${esc(item.label)}</button>`).join('');
  requestAnimationFrame(()=>$('#room-list .is-active')?.scrollIntoView({block:'nearest',inline:'center'}));
}
function consentChip(capability){return `<span class="chip is-${esc(capability.consent)}">${esc(capability.consent)} consent</span>`}
function capabilityCard(capability,system){
  return `<article class="capability-card">
    <small class="kicker">${esc(capability.operation)} · ${esc(capability.sourceStatus)}</small>
    <h3>${esc(capability.label)}</h3><p>${esc(capability.summary)}</p>
    <div class="meta-row">${consentChip(capability)}<span class="chip">Visual ${esc(capability.visual.status)}</span><span class="chip">Lite ${esc(capability.lite.status)}</span></div>
    <footer class="card-actions"><button class="primary" type="button" data-capability="${esc(capability.id)}">Open console</button>${capability.lite.sourceRoute?`<button type="button" data-source="${esc(capability.id)}">Working tool</button>`:''}</footer>
  </article>`
}
function journeyProgress(){
  const w=readWorkflow();const done=new Set();
  if(parse(localStorage.getItem(SETTINGS_KEY),null))done.add('commonweave.model-setup');
  if(w.wish)done.add('commonweave.state-wish');
  if(w.clarification?.outcome||w.clarification?.context||w.clarification?.constraints)done.add('commonweave.clarify-wish');
  if(w.skill?.posture)done.add('commonweave.skill-posture');
  if(w.weave)done.add('commonweave.generate-weave');
  if(w.weave?.reviewedAt)done.add('commonweave.review-weave');
  if(w.activatedAt)done.add('commonweave.activate-weave');
  if(w.passport)done.add('commonweave.store-intention');
  return done;
}
function renderJourney(){
  const done=journeyProgress();let foundCurrent=false;
  const steps=ledger.journey.map((id,index)=>{const c=ledger.index.capabilities.get(id);const complete=done.has(id);const current=!complete&&!foundCurrent;if(current)foundCurrent=true;return `<button type="button" class="journey-step ${complete?'is-complete':''} ${current?'is-current':''}" data-jump-capability="${esc(id)}"><i>${complete?'✓':index+1}</i><b>${esc(c?.label||id)}</b><small>${esc(c?.system||'')}</small></button>`}).join('');
  return `<section class="journey-card"><small class="kicker">GOLDEN PATH · SHARED BY VISUAL AND LITE</small><div class="journey-list">${steps}</div></section>`;
}
function renderRoom(system,room,caps){
  const journey=system.id==='commonweave'?renderJourney():'';
  return `<section class="workstation-hero"><div class="hero-copy"><small class="kicker">${esc(system.name)} · ${esc(room.id)}</small><h2>${esc(room.label)}</h2><p>${esc(room.purpose)}</p><div class="meta-row"><span class="chip">${caps.length} mapped capabilities</span><span class="chip">Same room ID in Visual and Lite</span><span class="chip">${esc(system.interfaceShell?.motif||'cabinet')}</span></div></div><div class="room-preview" style="background-image:url('${esc(room.visualAsset)}')"><span>${esc(room.label)} visual counterpart</span></div></section>${journey}<section class="capability-grid">${caps.length?caps.map(cap=>capabilityCard(cap,system)).join(''):'<div class="empty-state"><h2>Room reserved</h2><p>This canonical room has no capabilities assigned yet.</p></div>'}</section>`;
}
function detailItem(label,value){return `<div class="detail-item"><small>${esc(label)}</small><p>${esc(value||'none')}</p></div>`}
