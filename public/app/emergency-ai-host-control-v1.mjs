import {CivweaveEmergencyAiHostV1} from './emergency-ai-host-v1.mjs';

const VERSION='1.0.1-emergency-ai-host-control-v1';
const ROOT_ID='emergencyAiHost';
let timer=0,routerPromise=null,lastError='';
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[ch]));
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);

function ensureRouter(){
  if(globalThis.CivweaveResponseRouterV347)return Promise.resolve(globalThis.CivweaveResponseRouterV347);
  if(routerPromise)return routerPromise;
  routerPromise=new Promise((resolve,reject)=>{
    const existing=[...(document.scripts||[])].find(script=>String(script.src||'').includes('/app/minilm-response-router-v347.js'));
    if(existing){
      if(globalThis.CivweaveResponseRouterV347)return resolve(globalThis.CivweaveResponseRouterV347);
      existing.addEventListener('load',()=>resolve(globalThis.CivweaveResponseRouterV347||null),{once:true});
      existing.addEventListener('error',()=>reject(new Error('Could not load the response-tier catalogue.')),{once:true});
      return;
    }
    const script=document.createElement('script');script.src='/app/minilm-response-router-v347.js?v=1.0.0';script.async=true;script.dataset.cwEmergencyAiTierCatalog='v1';
    script.onload=()=>resolve(globalThis.CivweaveResponseRouterV347||null);script.onerror=()=>reject(new Error('Could not load the response-tier catalogue.'));document.head.append(script);
  }).finally(()=>{if(!globalThis.CivweaveResponseRouterV347)routerPromise=null});
  return routerPromise;
}

function tierRow(row){
  const label=clean(row?.tierId,40)||'tier',model=clean(row?.modelId,220)||'no current model';
  return `<div class="check ${row?.passed?'ok':''}"><i></i><span><strong>${esc(label)}</strong> · ${esc(model)} · ${row?.passed?'speed check passed':'speed check required'}</span></div>`;
}
function renderProblem(message){const root=document.getElementById(ROOT_ID);if(root)root.innerHTML=`<section class="card wide"><h2>Emergency AI host</h2><p class="note">${esc(message)}</p></section>`}
function render(){
  const root=document.getElementById(ROOT_ID);if(!root)return;
  const ready=CivweaveEmergencyAiHostV1.readiness(),state=CivweaveEmergencyAiHostV1.status(),enabled=CivweaveEmergencyAiHostV1.optedIn();
  const rows=ready.required||[],canEnable=ready.eligible===true;
  root.innerHTML=`<section class="card wide"><h2>Emergency AI host</h2><p class="note">Share this host's downloaded premier model as a Guild emergency fallback. Requests use a bounded FIFO queue and the signed local-object mesh. Hosting stays unavailable until both current premier response tiers pass their speed checks.</p><div class="checklist" style="margin-top:8px">${rows.length?rows.map(tierRow).join(''):'<div class="check"><i></i><span>Waiting for the current response-tier catalogue and speed checks.</span></div>'}</div><dl class="kv" style="margin-top:10px"><dt>Hosting</dt><dd class="${enabled&&state.eligible?'ok':'warn'}">${enabled&&state.eligible?'enabled and eligible':enabled?'enabled but currently unavailable':'disabled'}</dd><dt>Scheduler</dt><dd>FIFO</dd><dt>Queue depth</dt><dd>${Number(state.queueDepth||0)}</dd><dt>Eligibility follows</dt><dd>current fast + smart tier primaries</dd></dl><div class="operator-actions"><button class="btn" type="button" data-emergency-ai-toggle="${enabled?'off':'on'}" ${!enabled&&!canEnable?'disabled':''}>${enabled?'Disable emergency AI host':'Enable emergency AI host'}</button></div>${!enabled&&!canEnable?'<p class="note warn">Enable unlocks automatically after both current tier models pass speed checks. Replacing the premier models does not require changing this policy.</p>':''}${lastError?`<div class="operator-output">${esc(lastError)}</div>`:''}</section>`;
  root.querySelector('[data-emergency-ai-toggle]')?.addEventListener('click',event=>{
    try{CivweaveEmergencyAiHostV1.setOptIn(event.currentTarget.dataset.emergencyAiToggle==='on');lastError=''}
    catch(error){lastError=String(error?.message||error)}
    render();
  });
}
async function start(){try{await ensureRouter();render();timer=setInterval(render,5000)}catch(error){renderProblem(error?.message||error)}}
for(const eventName of ['civweave:emergency-ai-host-opt-in','civweave:minilm-response-router-ready','civweave:local-model-downloaded','civweave:local-model-removed','civweave:model-runtime-ready'])addEventListener(eventName,render);
addEventListener('pagehide',()=>{if(timer)clearInterval(timer)},{once:true});
document.readyState==='loading'?addEventListener('DOMContentLoaded',start,{once:true}):queueMicrotask(start);

globalThis.CivweaveEmergencyAiHostControlV1=Object.freeze({version:VERSION,render});
