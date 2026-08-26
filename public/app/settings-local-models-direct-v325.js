(()=>{
'use strict';
const VERSION='1.0.0-settings-v325-direct-local-models';
const LAYER_ID='cw-settings-v320';
const PANEL_ID='cw-local-models-direct-v325';
const STYLE_ID='cw-local-models-direct-v325-style';
const SELECTION_KEY='civweave.local-ai.selection.v266';
const DOWNLOADS_KEY='civweave.local-ai.downloads.v266';
const PACK_STATE_KEY='civweave.local-ai.packs.v1';
const HEALTH_KEY='civweave.local-ai.health.v286';
const ACTION_ROUTE='/app/settings-local-route-v331.js?cwAction=1&v=settings-v325-action-route';
const ACTION_ROUTE_VERSION='1.1.3-settings-local-route-v326-canonical-inert-hard-local';
const BUILD_LABEL='Settings v325 · renderer direct-local-v325 · actions lazy-v331';
const PACKS=Object.freeze([
  {id:'minimum-spec',label:'Minimum Spec Pack',tier:'MINIMUM',size:'~1.7 GB',summary:'Smallest complete offline voice + chat bundle, with CPU/WASM as the primary text path.',primaryModel:'qwen3-0.6b-q8-wasm'},
  {id:'premier-phone',label:'Premier Phone Pack',tier:'PREMIER PHONE',size:'~7.6 GB',summary:'Full phone-local AI ladder with fast and deep Gemma 4 paths plus CPU-safe fallback.',primaryModel:'gemma4-e2b-it-q2f16-mobile'},
  {id:'server-quality',label:'Server Quality Pack',tier:'SERVER QUALITY',size:'~13.0 GB',summary:'Higher-quality Guild/server bundle using Civweave’s strongest currently executable local models.',primaryModel:'gemma4-e4b-it-q2f16-mobile'}
]);
const MODELS=Object.freeze([
  {id:'smollm2-135m-instruct-q8-wasm',label:'SmolLM2 135M Instruct',tier:'Phone Tiny',size:'140 MB'},
  {id:'smollm2-360m-instruct-q4f16',label:'SmolLM2 360M Instruct',tier:'Phone Light',size:'272 MB'},
  {id:'qwen3-0.6b-q4f16',label:'Qwen 3 0.6B',tier:'Small',size:'610 MB'},
  {id:'gemma3-1b-it-q4f16',label:'Gemma 3 1B IT',tier:'Standard',size:'884 MB'},
  {id:'qwen3-1.7b-q4f16',label:'Qwen 3 1.7B',tier:'Large',size:'1.5 GB'},
  {id:'gemma4-e2b-it-q2f16-mobile',label:'Gemma 4 E2B IT',tier:'Gemma Fast',size:'2.3 GB'},
  {id:'gemma4-e4b-it-q2f16-mobile',label:'Gemma 4 E4B IT',tier:'Gemma Max',size:'3.4 GB'},
  {id:'smollm3-3b-q4f16',label:'SmolLM3 3B',tier:'Mini PC',size:'2.2 GB'},
  {id:'qwen3-4b-q4f16',label:'Qwen 3 4B',tier:'PC 12',size:'2.9 GB'}
]);
if(globalThis.CivweaveSettingsLocalDirectV325?.version===VERSION)return;
let actionPromise=null;
const parse=(value,fallback={})=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const read=(key,fallback={})=>{try{return parse(localStorage.getItem(key),fallback)}catch{return fallback}};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function snapshot(){return{selection:read(SELECTION_KEY,{active:false,id:null}),downloads:read(DOWNLOADS_KEY,{}),packs:read(PACK_STATE_KEY,{}),health:read(HEALTH_KEY,{})}}
function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
#${PANEL_ID}{display:grid;gap:12px}
#${PANEL_ID} .cw-direct-build{font:800 .72rem/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;color:#90efd8;letter-spacing:.03em;overflow-wrap:anywhere}
#${PANEL_ID} .cw-direct-note{padding:12px 13px;border:1px solid #77e9cf35;border-radius:12px;background:#081b20;color:#c9fff2}
#${PANEL_ID} .cw-direct-pack-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
#${PANEL_ID} .cw-direct-card,#${PANEL_ID} .cw-direct-model{display:grid;gap:7px;padding:12px;border:1px solid #ffffff20;border-radius:13px;background:#091329}
#${PANEL_ID} .cw-direct-card[data-active="true"],#${PANEL_ID} .cw-direct-model[data-active="true"]{outline:2px solid #90efd8}
#${PANEL_ID} .cw-direct-card h4,#${PANEL_ID} .cw-direct-model b{margin:0;color:#fff}
#${PANEL_ID} .cw-direct-card p,#${PANEL_ID} .cw-direct-model p{margin:0;color:#bdc9e3;font-size:.86rem}
#${PANEL_ID} .cw-direct-badge{font-size:.68rem;font-weight:900;letter-spacing:.08em;color:#90efd8}
#${PANEL_ID} .cw-direct-actions{display:flex;gap:7px;flex-wrap:wrap}
#${PANEL_ID} .cw-direct-actions button{min-height:36px;padding:6px 9px;font-size:.84rem}
#${PANEL_ID} .cw-direct-status{color:#9ff2dc;min-height:1.35em}
#${PANEL_ID} .cw-direct-error{color:#ffc3c3}
#${PANEL_ID} details{border-top:1px solid #ffffff17;padding-top:9px}
#${PANEL_ID} summary{cursor:pointer;color:#eef2ff}
#${PANEL_ID} .cw-direct-model-list{display:grid;gap:8px;margin-top:9px}
@media(max-width:820px){#${PANEL_ID} .cw-direct-pack-grid{grid-template-columns:1fr}}
`;
  document.head?.append(style);
}
function statusCopy(state,ready=false){
  const status=String(state?.status||'');
  if(ready||status==='ready')return'Downloaded and ready';
  if(status==='browser-ready')return'Ready for browser download';
  if(status==='browser-queued')return'Browser downloads queued';
  if(status==='browser-queuing')return'Sending files to browser downloads…';
  if(status==='downloading'||status==='finalizing')return`${status} · ${Math.max(0,Math.min(99,Number(state?.percent||0)))}%`;
  if(status==='paused')return'Paused';
  if(status==='error')return`Error${state?.error?`: ${String(state.error)}`:''}`;
  return'Not downloaded';
}
function packAction(pack,state,active){
  const status=String(state?.status||'');
  if(status==='ready')return active
    ?`<button type="button" data-cw-direct-local-action data-local-pack-use="${esc(pack.id)}">Using pack</button><button type="button" data-cw-direct-local-action data-local-pack-remove="${esc(pack.id)}">Remove pack</button>`
    :`<button type="button" data-cw-direct-local-action data-local-pack-use="${esc(pack.id)}">Use pack</button><button type="button" data-cw-direct-local-action data-local-pack-remove="${esc(pack.id)}">Remove pack</button>`;
  if(['downloading','finalizing'].includes(status))return`<button type="button" data-cw-direct-local-action data-local-pack-cancel="${esc(pack.id)}">Cancel</button>`;
  if(['paused','error','aborted'].includes(status))return`<button type="button" data-cw-direct-local-action data-local-pack-download="${esc(pack.id)}">Resume pack</button><button type="button" data-cw-direct-local-action data-local-pack-remove="${esc(pack.id)}">Clear pack</button>`;
  if(status==='browser-queued')return`<button type="button" data-cw-direct-local-action data-local-pack-download="${esc(pack.id)}">Queue again</button><button type="button" data-cw-direct-local-action data-local-pack-remove="${esc(pack.id)}">Clear pack</button>`;
  return`<button type="button" data-cw-direct-local-action data-local-pack-download="${esc(pack.id)}">Download pack</button>`;
}
function modelAction(model,state,active){
  const ready=String(state?.status||'')==='ready'||active,status=String(state?.status||'');
  if(ready)return`<button type="button" data-cw-direct-local-action data-local-use="${esc(model.id)}">${active?'Using locally':'Use locally'}</button><button type="button" data-cw-direct-local-action data-local-remove="${esc(model.id)}">Remove</button>`;
  if(['downloading','finalizing'].includes(status))return`<button type="button" data-cw-direct-local-action data-local-cancel="${esc(model.id)}">Cancel</button>`;
  if(['paused','error','aborted'].includes(status))return`<button type="button" data-cw-direct-local-action data-local-download="${esc(model.id)}">Resume</button><button type="button" data-cw-direct-local-action data-local-remove="${esc(model.id)}">Clear</button>`;
  return`<button type="button" data-cw-direct-local-action data-local-download="${esc(model.id)}">Download</button>`;
}
function updateHeader(layer=document.getElementById(LAYER_ID)){
  if(!layer)return false;
  const label=layer.querySelector('header small');
  if(label&&/CIVWEAVE SETTINGS/i.test(label.textContent||''))label.textContent='CIVWEAVE SETTINGS · v325';
  layer.dataset.settingsVisibleVersion='v325';
  return true;
}
function render(layer=document.getElementById(LAYER_ID)){
  if(!layer?.isConnected||layer.hidden)return false;
  installStyle();updateHeader(layer);
  const form=layer.querySelector('[data-cw-settings-form]');
  const target=form?.querySelector('[data-settings-tab-panel="local-models"]');
  if(!target)return false;
  const snap=snapshot();
  const packMarkup=PACKS.map(pack=>{
    const state=snap.packs[pack.id]||{};
    const active=Boolean(snap.selection?.active&&state.status==='ready'&&state.selectedModel===snap.selection.id);
    return`<article class="cw-direct-card" data-active="${active?'true':'false'}"><span class="cw-direct-badge">${esc(pack.tier)}</span><h4>${esc(pack.label)}</h4><p>${esc(pack.summary)}</p><p><b>${esc(statusCopy(state,state.status==='ready'))}</b> · ${esc(pack.size)}</p><div class="cw-direct-actions">${packAction(pack,state,active)}</div></article>`;
  }).join('');
  const modelMarkup=MODELS.map(model=>{
    const state=snap.downloads[model.id]||{},active=Boolean(snap.selection?.active&&snap.selection.id===model.id),health=snap.health[model.id];
    const healthText=health?(health.ok?'Last health check passed':'Last health check failed'):'No measured run yet';
    return`<article class="cw-direct-model" data-active="${active?'true':'false'}"><div><b>${esc(model.tier)} · ${esc(model.label)}</b><p>${esc(model.size)} · ${esc(statusCopy(state,active))}${active?' · ACTIVE':''}</p><p>${esc(healthText)}</p></div><div class="cw-direct-actions">${modelAction(model,state,active)}</div></article>`;
  }).join('');
  target.innerHTML=`<section id="${PANEL_ID}" class="cw-clean-panel" data-cw-direct-local-panel><div><h3>AI Downloads</h3><p>Saved choices are rendered immediately by Settings. Model lifecycle, cache, service-worker, GPU, and inference code stay unloaded until you choose an action.</p></div><div class="cw-direct-build">${esc(BUILD_LABEL)}</div><div class="cw-direct-note">This panel is no longer waiting on the local-model runtime to display. If this line is visible, the v325 Settings renderer reached this device.</div><div class="cw-direct-status" data-cw-direct-local-status role="status">Saved local model state loaded.</div><div class="cw-direct-pack-grid">${packMarkup}</div><details><summary><b>Individual models</b></summary><div class="cw-direct-model-list">${modelMarkup}</div></details>${snap.selection?.active?'<div class="cw-direct-actions"><button type="button" data-cw-direct-local-action data-local-disable>Stop using downloaded AI</button></div>':''}</section>`;
  form.dataset.directLocalModels='v325';layer.dataset.localModelsRenderer='direct-local-v325';
  return true;
}
function status(layer,text,error=false){
  const node=layer?.querySelector?.('[data-cw-direct-local-status]');
  if(!node)return;node.textContent=String(text||'');node.classList?.toggle?.('cw-direct-error',Boolean(error));
}
function actionDescriptor(button){
  const names=['localPackDownload','localPackUse','localPackRemove','localPackCancel','localDownload','localUse','localRemove','localCancel'];
  for(const name of names){const value=button.dataset?.[name];if(value)return{name,value,attr:'data-'+name.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())}}
  if(button.hasAttribute?.('data-local-disable'))return{name:'localDisable',value:'',attr:'data-local-disable'};
  return null;
}
function escapeSelector(value){try{return CSS?.escape?CSS.escape(String(value)):String(value).replace(/["\\]/g,'\\$&')}catch{return String(value).replace(/["\\]/g,'\\$&')}}
function ensureActionRoute(){
  const current=globalThis.CivweaveSettingsLocalRouteV323;
  if(current?.version===ACTION_ROUTE_VERSION&&current?.renderLocalModels)return Promise.resolve(current);
  if(actionPromise)return actionPromise;
  actionPromise=new Promise((resolve,reject)=>{
    try{delete globalThis.CivweaveSettingsLocalRouteV323}catch{try{globalThis.CivweaveSettingsLocalRouteV323=undefined}catch{}}
    const script=document.createElement('script');script.src=ACTION_ROUTE;script.async=false;script.dataset.civweaveExplicitLocalModelAction='v325';
    const timer=setTimeout(()=>reject(new Error('Local model action code did not become ready within 8 seconds.')),8000);
    script.onload=()=>{clearTimeout(timer);const api=globalThis.CivweaveSettingsLocalRouteV323;api?.renderLocalModels?resolve(api):reject(new Error('Local model action code loaded without its action API.'))};
    script.onerror=()=>{clearTimeout(timer);reject(new Error('Local model action code could not load.'))};
    document.head?.append(script);
  }).finally(()=>{actionPromise=null});
  return actionPromise;
}
async function delegateAction(button,layer=document.getElementById(LAYER_ID)){
  const descriptor=actionDescriptor(button);if(!descriptor||!layer?.isConnected)return false;
  button.disabled=true;status(layer,'Preparing the selected local model action…');
  try{
    const route=await ensureActionRoute();
    if(!layer?.isConnected||layer.hidden)return false;
    route.renderLocalModels(layer);
    let selector=`[${descriptor.attr}]`;
    if(descriptor.value)selector=`[${descriptor.attr}="${escapeSelector(descriptor.value)}"]`;
    const delegated=layer.querySelector(selector);
    if(!delegated)throw new Error('The selected local model action could not be handed to the lifecycle controller.');
    delegated.click();return true;
  }catch(error){render(layer);status(layer,error?.message||String(error),true);return false}
}
function hardGuard(layer=document.getElementById(LAYER_ID)){
  setTimeout(()=>{
    if(!layer?.isConnected||layer.hidden)return;
    const form=layer.querySelector('[data-cw-settings-form]'),target=form?.querySelector('[data-settings-tab-panel="local-models"]');
    const selected=form?.querySelector('[data-settings-tab="local-models"]')?.getAttribute('aria-selected')==='true';
    if(!selected)return;
    if(target?.querySelector('[data-local-model-slot-placeholder]')||/Reading saved local model choices/i.test(target?.textContent||'')){
      target.innerHTML=`<section class="cw-clean-panel"><h3>Local models could not open</h3><p>The v325 direct renderer did not replace the loading placeholder. Settings will not wait indefinitely.</p><div class="cw-direct-build">${esc(BUILD_LABEL)}</div></section>`;
    }
  },900);
}
function onDocumentClick(event){
  const layer=document.getElementById(LAYER_ID);if(!layer)return;
  const action=event.target?.closest?.(`#${LAYER_ID} [data-cw-direct-local-action]`);
  if(action){event.preventDefault();event.stopImmediatePropagation();void delegateAction(action,layer);return}
  const tab=event.target?.closest?.(`#${LAYER_ID} [data-settings-tab="local-models"]`);
  if(!tab)return;
  queueMicrotask(()=>{render(layer);hardGuard(layer)});
}
function onSettingsOpened(){const layer=document.getElementById(LAYER_ID);if(!layer)return;updateHeader(layer);const selected=layer.querySelector('[data-settings-tab="local-models"]')?.getAttribute('aria-selected')==='true';if(selected){render(layer);hardGuard(layer)}}
document.addEventListener('click',onDocumentClick,true);
addEventListener('civweave:model-settings-opened',onSettingsOpened);
addEventListener('civweave:settings-ready',()=>queueMicrotask(onSettingsOpened));
queueMicrotask(()=>updateHeader());
globalThis.CivweaveSettingsLocalDirectV325=Object.freeze({version:VERSION,visibleSettingsVersion:'v325',buildLabel:BUILD_LABEL,render,updateHeader,delegateAction,savedStateOnly:true,managerDependencyOnView:false,cacheReadOnView:false,serviceWorkerDependencyOnView:false,gpuDependencyOnView:false,inferenceDependencyOnView:false,actionModulesOnExplicitAction:true,hardLoadingGuardMs:900});
})();
