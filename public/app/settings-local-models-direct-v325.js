(()=>{
'use strict';
const VERSION='1.1.0-settings-v325-direct-local-models-stable-actions';
const LAYER_ID='cw-settings-v320';
const PANEL_ID='cw-local-models-direct-v325';
const STYLE_ID='cw-local-models-direct-v325-style';
const SELECTION_KEY='civweave.local-ai.selection.v266';
const DOWNLOADS_KEY='civweave.local-ai.downloads.v266';
const PACK_STATE_KEY='civweave.local-ai.packs.v1';
const HEALTH_KEY='civweave.local-ai.health.v286';
const PREMIER='premier-phone';
const FAST_E2='gemma4-e2b-it-litert-web';
const FAST_E4='gemma4-e4b-it-litert-web';
const FINALIZER_SRC='/app/local-ai/premier-phone-finalizer-v1.js?v=1.0.0-idempotent-existing-components';
const BUILD_LABEL='Settings v325 · renderer direct-local-v325.2 · stable in-place actions';
const PACKS=Object.freeze([
  {id:'minimum-spec',label:'Minimum Spec Pack',tier:'MINIMUM',size:'~1.7 GB',summary:'Smallest complete offline voice + chat bundle, with CPU/WASM as the primary text path.',primaryModel:'qwen3-0.6b-q8-wasm'},
  {id:PREMIER,label:'Premier Phone Pack',tier:'PREMIER PHONE',size:'~6.9 GB',summary:'Current phone pack: Gemma 4 E2B LiteRT for fast work, Gemma 4 E4B LiteRT for deeper work, multilingual speech, and a CPU-safe fallback.',primaryModel:FAST_E2},
  {id:'server-quality',label:'Server Quality Pack',tier:'SERVER QUALITY',size:'~13.0 GB',summary:'Higher-quality Guild/server bundle using Civweave’s strongest currently executable local models.',primaryModel:'gemma4-e4b-it-q2f16-mobile'}
]);
const MODELS=Object.freeze([
  {id:'smollm2-135m-instruct-q8-wasm',label:'SmolLM2 135M Instruct',tier:'Phone Tiny',size:'140 MB'},
  {id:'smollm2-360m-instruct-q4f16',label:'SmolLM2 360M Instruct',tier:'Phone Light',size:'272 MB'},
  {id:'qwen3-0.6b-q4f16',label:'Qwen 3 0.6B',tier:'Small',size:'610 MB'},
  {id:'gemma3-1b-it-q4f16',label:'Gemma 3 1B IT',tier:'Standard',size:'884 MB'},
  {id:'qwen3-1.7b-q4f16',label:'Qwen 3 1.7B',tier:'Large',size:'1.5 GB'},
  {id:'gemma4-e2b-it-q4f16',label:'Gemma 4 E2B IT Q4F16',tier:'Gemma compatibility',size:'compatibility fallback'},
  {id:'gemma4-e4b-it-q4f16',label:'Gemma 4 E4B IT Q4F16',tier:'Gemma compatibility',size:'compatibility fallback'},
  {id:'smollm3-3b-q4f16',label:'SmolLM3 3B',tier:'Mini PC',size:'2.2 GB'},
  {id:'qwen3-4b-q4f16',label:'Qwen 3 4B',tier:'PC 12',size:'2.9 GB'}
]);
const ACTION_FILES=Object.freeze([
  ['/app/local-ai/model-registry-v266.js?v=1.0.115-v302-gemma3-v4',()=>Boolean(globalThis.CivweaveLocalModelRegistryV266?.byId)],
  ['/app/local-ai/download-manager-v267.js?v=1.0.68-v322-explicit-sync',()=>Boolean(globalThis.CivweaveLocalModelDownloadV266?.status&&globalThis.CivweaveLocalModelDownloadV266?.selection&&globalThis.CivweaveLocalModelDownloadV266?.autoSyncOnLoad===false)],
  ['/app/local-ai/download-policy-v278.js?v=1.0.82-v322-explicit-sync',()=>Boolean(globalThis.CivweaveLocalModelDownloadV266?.largeExternalDataForeground===true&&globalThis.CivweaveLocalModelDownloadV266?.autoSyncOnLoad===false)],
  ['/app/local-ai/metadata-repair-v276.js?v=1.0.81-v277',()=>Boolean(globalThis.CivweaveLocalModelDownloadV266?.metadataOnlyRepair===true)],
  ['/app/local-ai/specialized-model-capabilities-v1.js?v=1.1.0-model-packs',()=>Boolean(globalThis.CivweaveLocalSpecializedAI?.preferredTts==='supertonic-3-tts-int8')],
  ['/app/local-ai/model-packs-v1.js?v=1.0.1-browser-guard',()=>Boolean(globalThis.CivweaveLocalModelPacksV1?.byId&&globalThis.CivweaveLocalModelPacksV1?.install)],
  ['/app/local-ai/browser-pack-download-v1.js?v=1.3.1-worker-import',()=>Boolean(globalThis.CivweaveBrowserPackDownloadV1?.queue&&globalThis.CivweaveBrowserPackDownloadV1?.pickAndImport)]
]);
if(globalThis.CivweaveSettingsLocalDirectV325?.version===VERSION)return;
let actionPromise=null,gemmaPromise=null;
const parse=(value,fallback={})=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const read=(key,fallback={})=>{try{return parse(localStorage.getItem(key),fallback)}catch{return fallback}};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const manager=()=>globalThis.CivweaveLocalModelDownloadV266;
const registry=()=>globalThis.CivweaveLocalModelRegistryV266;
const packManager=()=>globalThis.CivweaveLocalModelPacksV1;
const browser=()=>globalThis.CivweaveBrowserPackDownloadV1;
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
  const value=String(state?.status||'');
  if(ready||value==='ready')return'Downloaded and ready';
  if(['core-update-required','performance-core-required'].includes(value))return'Phone performance core needs finishing';
  if(value==='support-required')return'Phone support files need finishing';
  if(value==='browser-ready')return'Ready for browser download';
  if(value==='browser-queued')return'Browser downloads queued';
  if(value==='browser-partial')return'Browser downloads partly imported';
  if(value==='browser-importing')return'Importing browser downloads…';
  if(value==='browser-queuing')return'Sending files to browser downloads…';
  if(value==='downloading'||value==='finalizing')return`${value} · ${Math.max(0,Math.min(99,Number(state?.percent||0)))}%`;
  if(value==='paused')return'Paused';
  if(value==='error')return`Error${state?.error?`: ${String(state.error)}`:''}`;
  return'Not downloaded';
}
function packAction(pack,state,active){
  const value=String(state?.status||'');
  if(value==='ready')return active
    ?`<button type="button" data-cw-direct-local-action data-local-pack-use="${esc(pack.id)}">Using pack</button><button type="button" data-cw-direct-local-action data-local-pack-remove="${esc(pack.id)}">Remove pack</button>`
    :`<button type="button" data-cw-direct-local-action data-local-pack-use="${esc(pack.id)}">Use pack</button><button type="button" data-cw-direct-local-action data-local-pack-remove="${esc(pack.id)}">Remove pack</button>`;
  if(pack.id===PREMIER&&['core-update-required','performance-core-required','support-required'].includes(value))return`<button type="button" data-cw-direct-local-action data-local-pack-finish="${PREMIER}">Finish phone performance core</button><button type="button" data-cw-direct-local-action data-local-pack-remove="${PREMIER}">Clear pack</button>`;
  if(['downloading','finalizing','browser-importing','browser-queuing'].includes(value))return`<button type="button" data-cw-direct-local-action data-local-pack-cancel="${esc(pack.id)}">Cancel</button>`;
  if(value==='browser-partial')return`<button type="button" data-cw-direct-local-action data-local-pack-import="${esc(pack.id)}">Import finished downloads</button><button type="button" data-cw-direct-local-action data-local-pack-download="${esc(pack.id)}">Queue again</button>`;
  if(['paused','error','aborted'].includes(value))return`<button type="button" data-cw-direct-local-action data-local-pack-download="${esc(pack.id)}">Resume pack</button><button type="button" data-cw-direct-local-action data-local-pack-remove="${esc(pack.id)}">Clear pack</button>`;
  if(value==='browser-queued')return`<button type="button" data-cw-direct-local-action data-local-pack-import="${esc(pack.id)}">Import finished downloads</button><button type="button" data-cw-direct-local-action data-local-pack-download="${esc(pack.id)}">Queue next</button>`;
  return`<button type="button" data-cw-direct-local-action data-local-pack-download="${esc(pack.id)}">Download pack</button>`;
}
function modelAction(model,state,active){
  const ready=String(state?.status||'')==='ready'||active,value=String(state?.status||'');
  if(ready)return`<button type="button" data-cw-direct-local-action data-local-use="${esc(model.id)}">${active?'Using locally':'Use locally'}</button><button type="button" data-cw-direct-local-action data-local-remove="${esc(model.id)}">Remove</button>`;
  if(['downloading','finalizing'].includes(value))return`<button type="button" data-cw-direct-local-action data-local-cancel="${esc(model.id)}">Cancel</button>`;
  if(['paused','error','aborted'].includes(value))return`<button type="button" data-cw-direct-local-action data-local-download="${esc(model.id)}">Resume</button><button type="button" data-cw-direct-local-action data-local-remove="${esc(model.id)}">Clear</button>`;
  return`<button type="button" data-cw-direct-local-action data-local-download="${esc(model.id)}">Download</button>`;
}
function updateHeader(layer=document.getElementById(LAYER_ID)){
  if(!layer)return false;
  const label=layer.querySelector('header small');if(label&&/CIVWEAVE SETTINGS/i.test(label.textContent||''))label.textContent='CIVWEAVE SETTINGS · v325';
  layer.dataset.settingsVisibleVersion='v325';return true;
}
function render(layer=document.getElementById(LAYER_ID)){
  if(!layer?.isConnected||layer.hidden)return false;
  installStyle();updateHeader(layer);
  const form=layer.querySelector('[data-cw-settings-form]'),target=form?.querySelector('[data-settings-tab-panel="local-models"]');if(!target)return false;
  const snap=snapshot();
  const packMarkup=PACKS.map(pack=>{
    const state=snap.packs[pack.id]||{},active=Boolean(snap.selection?.active&&state.status==='ready'&&state.selectedModel===snap.selection.id);
    return`<article class="cw-direct-card" data-pack-id="${esc(pack.id)}" data-active="${active?'true':'false'}"><span class="cw-direct-badge">${esc(pack.tier)}</span><h4>${esc(pack.label)}</h4><p>${esc(pack.summary)}</p><p><b>${esc(statusCopy(state,state.status==='ready'))}</b> · ${esc(pack.size)}</p><div class="cw-direct-actions">${packAction(pack,state,active)}</div></article>`;
  }).join('');
  const modelMarkup=MODELS.map(model=>{
    const state=snap.downloads[model.id]||{},active=Boolean(snap.selection?.active&&snap.selection.id===model.id),health=snap.health[model.id],healthText=health?(health.ok?'Last health check passed':'Last health check failed'):'No measured run yet';
    return`<article class="cw-direct-model" data-model-id="${esc(model.id)}" data-active="${active?'true':'false'}"><div><b>${esc(model.tier)} · ${esc(model.label)}</b><p>${esc(model.size)} · ${esc(statusCopy(state,active))}${active?' · ACTIVE':''}</p><p>${esc(healthText)}</p></div><div class="cw-direct-actions">${modelAction(model,state,active)}</div></article>`;
  }).join('');
  target.innerHTML=`<section id="${PANEL_ID}" class="cw-clean-panel" data-cw-direct-local-panel><div><h3>AI Downloads</h3><p>Saved choices are rendered immediately by Settings. Runtime and download code loads only when you choose an action.</p></div><div class="cw-direct-build">${esc(BUILD_LABEL)}</div><div class="cw-direct-note">Pack actions now stay on this card. They do not swap in the older lifecycle screen, so download/finalization progress remains attached to the pack you touched.</div><div class="cw-direct-status" data-cw-direct-local-status role="status">Saved local model state loaded.</div><div class="cw-direct-pack-grid">${packMarkup}</div><details><summary><b>Individual models</b></summary><div class="cw-direct-model-list">${modelMarkup}</div></details>${snap.selection?.active?'<div class="cw-direct-actions"><button type="button" data-cw-direct-local-action data-local-disable>Stop using downloaded AI</button></div>':''}</section>`;
  form.dataset.directLocalModels='v325';layer.dataset.localModelsRenderer='direct-local-v325.2';return true;
}
function status(layer,text,error=false){const node=layer?.querySelector?.('[data-cw-direct-local-status]');if(!node)return;node.textContent=String(text||'');node.classList?.toggle?.('cw-direct-error',Boolean(error))}
function actionDescriptor(button){
  const names=['localPackFinish','localPackDownload','localPackImport','localPackUse','localPackRemove','localPackCancel','localDownload','localUse','localRemove','localCancel'];
  for(const name of names){const value=button.dataset?.[name];if(value)return{name,value,attr:'data-'+name.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())}}
  if(button.hasAttribute?.('data-local-disable'))return{name:'localDisable',value:'',attr:'data-local-disable'};return null;
}
function ensureScript(src,ready,label='Local model action module'){
  if(ready?.())return Promise.resolve(true);
  return new Promise((resolve,reject)=>{
    const path=new URL(src,location.href).pathname,existing=[...document.scripts].find(node=>{try{return new URL(node.src,location.href).pathname===path}catch{return false}});
    const done=()=>ready?.()?resolve(true):reject(new Error(`${label} loaded without becoming ready.`));
    if(existing){existing.addEventListener('load',done,{once:true});existing.addEventListener('error',()=>reject(new Error(`${label} could not load.`)),{once:true});queueMicrotask(()=>{if(ready?.())resolve(true)});return}
    const script=document.createElement('script');script.src=src;script.async=false;script.dataset.civweaveDirectLocalAction='v325';script.onload=done;script.onerror=()=>reject(new Error(`${label} could not load.`));document.head?.append(script);
  });
}
function ensureActions(){
  if(ACTION_FILES.every(([,ready])=>ready?.()))return Promise.resolve(true);
  if(actionPromise)return actionPromise;
  actionPromise=(async()=>{for(const [src,ready] of ACTION_FILES)await ensureScript(src,ready);return true})().finally(()=>{actionPromise=null});return actionPromise;
}
function ensureGemmaRuntime(){
  if(globalThis.CivweavePremierPhoneFinalizerV1?.finish)return Promise.resolve(globalThis.CivweavePremierPhoneFinalizerV1);
  if(gemmaPromise)return gemmaPromise;
  gemmaPromise=(async()=>{
    await globalThis.CivweaveModelSettingsControllerV173?.ensureGemma4Pack?.();
    if(!globalThis.CivweavePremierPhoneFinalizerV1?.finish)await ensureScript(FINALIZER_SRC,()=>Boolean(globalThis.CivweavePremierPhoneFinalizerV1?.finish),'Premier Phone finalizer');
    return globalThis.CivweavePremierPhoneFinalizerV1;
  })().finally(()=>{gemmaPromise=null});return gemmaPromise;
}
function persistLocalRoute(){try{globalThis.CivweaveSettingsLocalRouteV323?.persistLocalRoute?.(manager()?.selection?.())}catch{}}
function preserveScroll(layer,fn){
  const target=layer?.querySelector?.('[data-settings-tab-panel="local-models"]'),layerTop=Number(layer?.scrollTop||0),targetTop=Number(target?.scrollTop||0),pageTop=Number(globalThis.scrollY||0);fn();
  requestAnimationFrame?.(()=>{try{layer.scrollTop=layerTop}catch{}try{const next=layer?.querySelector?.('[data-settings-tab-panel="local-models"]');if(next)next.scrollTop=targetTop}catch{}try{globalThis.scrollTo?.(0,pageTop)}catch{}});
}
async function executeAction(descriptor,button,layer){
  await ensureActions();
  if(descriptor.value===PREMIER)await ensureGemmaRuntime();
  let m=manager(),r=registry(),p=packManager(),b=browser();if(!m||!r||!p)throw new Error('Local AI action modules did not become ready.');
  const id=descriptor.value;
  if(descriptor.name==='localPackFinish'){
    const finalizer=await ensureGemmaRuntime();
    return finalizer.finish({downloadMissingSupport:true,onProgress:progress=>{if(progress?.message)status(layer,progress.message)}});
  }
  if(descriptor.name==='localPackDownload'){
    const pack=p.byId(id);
    if(p.installMode?.(id)==='browser'){
      if(!b?.queue)throw new Error('The browser AI pack download bridge did not become ready.');
      status(layer,`Sending ${pack.label} to the browser download manager…`);
      const result=await b.queue(id,{onProgress:progress=>{if(progress?.message)status(layer,progress.message)}});
      status(layer,`${pack.label} browser download started. Import completed files back into this same card.`);return result;
    }
    status(layer,`Downloading ${pack.label}…`);const result=await p.install(id,{onProgress:progress=>{const state=progress?.state||p.state?.(id)||{};status(layer,`${pack.label} · ${Math.max(0,Math.min(99,Number(state.percent||0)))}% · ${state.component||state.phase||'downloading'}`)}});status(layer,`${pack.label} is downloaded and verified.`);return result;
  }
  if(descriptor.name==='localPackImport'){
    const pack=p.byId(id);if(!b?.pickAndImport)throw new Error('The in-Settings model import picker did not become ready.');
    status(layer,`Choose completed ${pack.label} download files.`);const result=await b.pickAndImport(id,{onProgress:progress=>{if(progress?.message)status(layer,progress.message)}});if(result?.cancelled)status(layer,'Model import cancelled. Existing files were left unchanged.');else status(layer,result?.available?`${pack.label} browser files are imported and verified.`:'Import finished. Rechecking this pack…');return result;
  }
  if(descriptor.name==='localPackCancel'){await p.cancel(id);status(layer,`${p.byId(id).label} download paused.`);return true}
  if(descriptor.name==='localPackUse'){
    if(id===PREMIER){const finalizer=await ensureGemmaRuntime();const result=await finalizer.use(FAST_E2,{onProgress:progress=>{if(progress?.message)status(layer,progress.message)}});persistLocalRoute();return result}
    const result=await p.use(id);persistLocalRoute();status(layer,`${result.pack.label} is active.`);return result;
  }
  if(descriptor.name==='localPackRemove'){
    const label=p.byId(id).label;if(p.installMode?.(id)==='browser')b?.clear?.(id);await p.remove(id);status(layer,`${label} removed.`);return true;
  }
  if(descriptor.name==='localDownload'){
    const spec=r.byId(id);if(!spec)throw new Error(`Unknown local model: ${id}`);
    if([FAST_E2,FAST_E4].includes(id)){
      await ensureGemmaRuntime();const handoff=globalThis.CivweaveGemma4BrowserPackCoherenceV1;if(!handoff?.startModelDownload)throw new Error('Gemma 4 browser download controls are unavailable.');return handoff.startModelDownload(id,button);
    }
    status(layer,`Starting ${spec.label}…`);await m.start(id,{preferBackground:false});status(layer,`${spec.label} download started.`);return true;
  }
  if(descriptor.name==='localCancel'){await m.cancel(id);status(layer,'Download cancelled.');return true}
  if(descriptor.name==='localUse'){
    const verified=await m.status(id);if(!verified.available)throw new Error('The local package did not pass integrity verification.');m.select(id);persistLocalRoute();status(layer,`${r.byId(id)?.label||id} is now the downloaded local model.`);return verified;
  }
  if(descriptor.name==='localRemove'){await m.remove(id);status(layer,'Local model package removed from this device.');return true}
  if(descriptor.name==='localDisable'){m.select(null);globalThis.CivweaveLocalModelRuntimeV266?.shutdown?.();status(layer,'Downloaded local AI is disabled.');return true}
  return false;
}
async function delegateAction(button,layer=document.getElementById(LAYER_ID)){
  const descriptor=actionDescriptor(button);if(!descriptor||!layer?.isConnected)return false;
  button.disabled=true;status(layer,'Preparing the selected local model action…');
  try{
    const result=await executeAction(descriptor,button,layer);const finalMessage=layer.querySelector?.('[data-cw-direct-local-status]')?.textContent||'Action finished.';
    if(layer?.isConnected&&!layer.hidden)preserveScroll(layer,()=>render(layer));status(layer,finalMessage);globalThis.CivweaveSettingsLocalProgressPlacementV1?.schedule?.([0,40,120]);return result!==false;
  }catch(error){const message=String(error?.message||error);if(layer?.isConnected&&!layer.hidden)preserveScroll(layer,()=>render(layer));status(layer,message,true);globalThis.CivweaveSettingsLocalProgressPlacementV1?.schedule?.([0,40,120]);return false}
  finally{if(button?.isConnected)button.disabled=false}
}
function hardGuard(layer=document.getElementById(LAYER_ID)){
  setTimeout(()=>{if(!layer?.isConnected||layer.hidden)return;const form=layer.querySelector('[data-cw-settings-form]'),target=form?.querySelector('[data-settings-tab-panel="local-models"]'),selected=form?.querySelector('[data-settings-tab="local-models"]')?.getAttribute('aria-selected')==='true';if(!selected)return;if(target?.querySelector('[data-local-model-slot-placeholder]')||/Reading saved local model choices/i.test(target?.textContent||''))target.innerHTML=`<section class="cw-clean-panel"><h3>Local models could not open</h3><p>The direct Settings renderer did not replace the loading placeholder.</p><div class="cw-direct-build">${esc(BUILD_LABEL)}</div></section>`},900);
}
function onDocumentClick(event){const layer=document.getElementById(LAYER_ID);if(!layer)return;const action=event.target?.closest?.(`#${LAYER_ID} [data-cw-direct-local-action]`);if(action){event.preventDefault();event.stopImmediatePropagation();void delegateAction(action,layer);return}const tab=event.target?.closest?.(`#${LAYER_ID} [data-settings-tab="local-models"]`);if(tab)queueMicrotask(()=>{render(layer);hardGuard(layer)})}
function onSettingsOpened(){const layer=document.getElementById(LAYER_ID);if(!layer)return;updateHeader(layer);const selected=layer.querySelector('[data-settings-tab="local-models"]')?.getAttribute('aria-selected')==='true';if(selected){render(layer);hardGuard(layer)}}
document.addEventListener('click',onDocumentClick,true);
addEventListener('civweave:model-settings-opened',onSettingsOpened);
addEventListener('civweave:settings-ready',()=>queueMicrotask(onSettingsOpened));
queueMicrotask(()=>updateHeader());
globalThis.CivweaveSettingsLocalDirectV325=Object.freeze({version:VERSION,visibleSettingsVersion:'v325',buildLabel:BUILD_LABEL,render,updateHeader,delegateAction,executeAction,ensureActions,ensureGemmaRuntime,savedStateOnly:true,managerDependencyOnView:false,cacheReadOnView:false,serviceWorkerDependencyOnView:false,gpuDependencyOnView:false,inferenceDependencyOnView:false,actionModulesOnExplicitAction:true,actionsStayInPlace:true,fullRendererSwapOnAction:false,premierPhoneFinalizer:true,hardLoadingGuardMs:900});
})();