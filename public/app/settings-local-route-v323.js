(()=>{
'use strict';
const VERSION='1.1.2-settings-local-route-v326-inert-view';
const ROUTE='downloaded-local';
const SELECTION_KEY='civweave.local-ai.selection.v266';
const DOWNLOADS_KEY='civweave.local-ai.downloads.v266';
const PACK_STATE_KEY='civweave.local-ai.packs.v1';
const HEALTH_KEY='civweave.local-ai.health.v286';
const SETTINGS_KEY='civweave.universal-ai.v127';
const PROFILES_KEY='civweave-model-profiles-v1';
const PANEL_ID='cw-local-ai-v324';
const STYLE_ID='cw-local-ai-v324-style';
const DOCK_ID='cw-local-ai-download-dock-v324';
const FOREGROUND_PHONE_MODELS=new Set(['gemma3-1b-it-q4f16','qwen3-0.6b-q4f16']);
const BROWSER_PACKS=new Set(['premier-phone','server-quality']);
const LEGACY_BROWSER_ERROR='CIVWEAVE_AI_PACK_BROWSER_DOWNLOAD_REQUIRED';

const PACK_CATALOGUE=Object.freeze([
  Object.freeze({
    id:'minimum-spec',label:'Minimum Spec Pack',tier:'MINIMUM',estimatedBytes:1_653_000_000,
    target:'6–8 GB RAM · 4+ CPU cores · no WebGPU required for core chat',
    storage:'~1.7 GB download · keep 3 GB free',
    primaryModel:'qwen3-0.6b-q8-wasm',
    modelIds:Object.freeze(['qwen3-0.6b-q8-wasm','smollm2-135m-instruct-q8-wasm']),
    summary:'Smallest complete offline voice + chat bundle, with CPU/WASM as the primary text path.',
    contents:'Qwen 3 0.6B CPU/WASM · SmolLM2 135M fallback · Silero VAD · Parakeet INT8 · Supertonic 3 multilingual TTS'
  }),
  Object.freeze({
    id:'premier-phone',label:'Premier Phone Pack',tier:'PREMIER PHONE',estimatedBytes:7_577_000_000,
    target:'12 GB RAM · modern Android-class WebGPU',
    storage:'~7.6 GB download · keep 11 GB free',
    primaryModel:'gemma4-e2b-it-q2f16-mobile',
    modelIds:Object.freeze(['gemma4-e2b-it-q2f16-mobile','gemma4-e4b-it-q2f16-mobile','qwen3-0.6b-q8-wasm']),
    summary:'Full phone-local AI ladder: fast Gemma 4, deep Gemma 4, wide multilingual speech, and CPU-safe fallback.',
    contents:'Gemma 4 E2B · Gemma 4 E4B · Qwen 3 0.6B CPU fallback · Silero · Parakeet INT8 · Omnilingual 300M INT8 · Supertonic 3'
  }),
  Object.freeze({
    id:'server-quality',label:'Server Quality Pack',tier:'SERVER QUALITY',estimatedBytes:12_990_000_000,
    target:'24+ GB RAM · 8+ modern CPU cores · strong WebGPU',
    storage:'~13.0 GB download · keep 20 GB free',
    primaryModel:'gemma4-e4b-it-q2f16-mobile',
    modelIds:Object.freeze(['gemma4-e4b-it-q2f16-mobile','gemma4-e2b-it-q2f16-mobile','qwen3-4b-q4f16','qwen3-0.6b-q8-wasm']),
    summary:'Higher-quality Guild/server bundle using the strongest currently executable Civweave local models and higher-quality speech.',
    contents:'Gemma 4 E4B · Gemma 4 E2B fast lane · Qwen 3 4B alternate · Qwen 3 0.6B CPU fallback · Silero · full-precision Parakeet · Omnilingual 1B INT8 · Supertonic 3'
  })
]);

const CATALOGUE=Object.freeze([
  {id:'smollm2-135m-instruct-q8-wasm',label:'SmolLM2 135M Instruct',tier:'Phone Tiny',repo:'onnx-community/SmolLM2-135M-Instruct-ONNX',estimatedBytes:140453620,license:'Apache-2.0',contextWindowTokens:8192,workingContextTokens:768,preferBackground:false},
  {id:'smollm2-360m-instruct-q4f16',label:'SmolLM2 360M Instruct',tier:'Phone Light',repo:'onnx-community/SmolLM2-360M-Instruct-ONNX',estimatedBytes:272353302,license:'Apache-2.0',contextWindowTokens:8192,workingContextTokens:1536,preferBackground:true},
  {id:'qwen3-0.6b-q4f16',label:'Qwen 3 0.6B',tier:'Small',repo:'onnx-community/Qwen3-0.6B-ONNX',estimatedBytes:610000000,license:'Apache-2.0',contextWindowTokens:40960,workingContextTokens:4096,preferBackground:true},
  {id:'gemma3-1b-it-q4f16',label:'Gemma 3 1B IT',tier:'Standard',repo:'onnx-community/gemma-3-1b-it-ONNX',estimatedBytes:884000000,license:'Gemma',contextWindowTokens:32768,workingContextTokens:4096,preferBackground:false},
  {id:'qwen3-1.7b-q4f16',label:'Qwen 3 1.7B',tier:'Large',repo:'onnx-community/Qwen3-1.7B-ONNX',estimatedBytes:1470000000,license:'Apache-2.0',contextWindowTokens:40960,workingContextTokens:4096,preferBackground:true},
  {id:'gemma4-e2b-it-q2f16-mobile',label:'Gemma 4 E2B IT',tier:'Gemma Fast',repo:'onnx-community/gemma-4-E2B-it-qat-mobile-ONNX',estimatedBytes:2335000000,license:'Apache-2.0',contextWindowTokens:128000,workingContextTokens:8192,preferBackground:true},
  {id:'gemma4-e4b-it-q2f16-mobile',label:'Gemma 4 E4B IT',tier:'Gemma Max',repo:'onnx-community/gemma-4-E4B-it-qat-mobile-ONNX',estimatedBytes:3365000000,license:'Apache-2.0',contextWindowTokens:128000,workingContextTokens:16384,preferBackground:true},
  {id:'smollm3-3b-q4f16',label:'SmolLM3 3B',tier:'Mini PC',repo:'HuggingFaceTB/SmolLM3-3B-ONNX',estimatedBytes:2160000000,license:'Apache-2.0',contextWindowTokens:65536,workingContextTokens:2048,preferBackground:false},
  {id:'qwen3-4b-q4f16',label:'Qwen 3 4B',tier:'PC 12',repo:'onnx-community/Qwen3-4B-ONNX',estimatedBytes:2860000000,license:'Apache-2.0',contextWindowTokens:40960,workingContextTokens:2048,preferBackground:false}
]);
const PREVIEW=Object.freeze([
  {label:'Qwen 3 8B',reason:'Runtime preview. The available package targets ONNX Runtime GenAI rather than Civweave’s pinned browser text-generation lane.'},
  {label:'Gemma 4 12B / larger server tier',reason:'Future server upgrade. It stays out of Download until Civweave has a pinned local runtime and verified artifact manifest that can actually execute it.'},
  {label:'Qwen 3 14B class',reason:'32 GB hardware target. Download remains hidden until a pinned browser/local runtime package has a verified artifact manifest.'}
]);
const ACTION_FILES=[
  ['/app/local-ai/model-registry-v266.js?v=1.0.115-v302-gemma3-v4',()=>Boolean(globalThis.CivweaveLocalModelRegistryV266?.byId)],
  ['/app/local-ai/download-manager-v267.js?v=1.0.68-v322-explicit-sync',()=>Boolean(globalThis.CivweaveLocalModelDownloadV266?.status&&globalThis.CivweaveLocalModelDownloadV266?.selection&&globalThis.CivweaveLocalModelDownloadV266?.state&&globalThis.CivweaveLocalModelDownloadV266?.autoSyncOnLoad===false)],
  ['/app/local-ai/download-policy-v278.js?v=1.0.82-v322-explicit-sync',()=>Boolean(globalThis.CivweaveLocalModelDownloadV266?.largeExternalDataForeground===true&&globalThis.CivweaveLocalModelDownloadV266?.autoSyncOnLoad===false)],
  ['/app/local-ai/metadata-repair-v276.js?v=1.0.81-v277',()=>Boolean(globalThis.CivweaveLocalModelDownloadV266?.metadataOnlyRepair===true&&globalThis.CivweaveLocalModelDownloadV266?.metadataRepairRaceSafe===true)],
  ['/app/local-ai/specialized-model-capabilities-v1.js?v=1.1.0-model-packs',()=>Boolean(globalThis.CivweaveLocalSpecializedAI?.preferredTts==='supertonic-3-tts-int8')],
  ['/app/local-ai/model-packs-v1.js?v=1.0.1-browser-guard',()=>Boolean(globalThis.CivweaveLocalModelPacksV1?.byId&&globalThis.CivweaveLocalModelPacksV1?.install)],
  ['/app/local-ai/browser-pack-download-v1.js?v=1.0.0-settings-v325',()=>Boolean(globalThis.CivweaveBrowserPackDownloadV1?.queue&&globalThis.CivweaveBrowserPackDownloadV1?.importUrl)]
];
if(globalThis.CivweaveSettingsLocalRouteV323?.version===VERSION)return;

const parse=(value,fallback={})=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const manager=()=>globalThis.CivweaveLocalModelDownloadV266;
const registry=()=>globalThis.CivweaveLocalModelRegistryV266;
const packManager=()=>globalThis.CivweaveLocalModelPacksV1;
const browserPackDownload=()=>globalThis.CivweaveBrowserPackDownloadV1;
let actionPromise=null,notice='',noticeError=false,navigating=false;

function writable(){return !navigating&&Boolean(document.documentElement?.isConnected)}
function selection(){try{return parse(localStorage.getItem(SELECTION_KEY),{active:false,id:null})}catch{return{active:false,id:null}}}
function normalizeLegacyBrowserPackErrors(packs){
  const normalized={...(packs&&typeof packs==='object'?packs:{})};
  for(const id of BROWSER_PACKS){
    const state=normalized[id];if(!state)continue;
    if(state.errorCode===LEGACY_BROWSER_ERROR||state.phase==='browser-download-required'){
      normalized[id]={...state,status:'browser-ready',phase:'browser-download-ready',percent:0,completedBytes:0,error:'',errorCode:'',downloadMode:'browser'};
    }
  }
  return normalized;
}
function snapshot(){
  let all={},selected={active:false,id:null},packs={};
  try{all=parse(localStorage.getItem(DOWNLOADS_KEY),{});selected=selection();packs=parse(localStorage.getItem(PACK_STATE_KEY),{})}catch{}
  return{all,selection:selected,packs:normalizeLegacyBrowserPackErrors(packs)};
}
function savedHealth(){try{return parse(localStorage.getItem(HEALTH_KEY),{})}catch{return{}}}
function fallbackConfig(){try{const profiles=parse(localStorage.getItem(PROFILES_KEY),{}),saved=parse(localStorage.getItem(SETTINGS_KEY),{}),interactive=profiles.interactive&&typeof profiles.interactive==='object'?profiles.interactive:saved;return interactive&&typeof interactive==='object'?interactive:{}}catch{return{}}}
function selectedLabel(){const current=selection();return current.active&&current.id?String(current.id):'No downloaded model selected'}
function panelFor(form){let panel=form.querySelector('[data-panel="downloaded-local"]');if(panel)return panel;panel=document.createElement('section');panel.className='cw-clean-panel';panel.dataset.panel='downloaded-local';panel.hidden=true;panel.innerHTML='<div><h3>Downloaded local AI</h3><p data-downloaded-local-summary></p></div><div class="cw-clean-note">Use the Local models tab to install a complete AI pack or choose an individual model. Selecting downloaded AI keeps your configured remote provider as fallback; opening Settings does not load the model runtime.</div>';const anchor=form.querySelector('[data-panel="deterministic"]');if(anchor)anchor.after(panel);else form.prepend(panel);return panel}
function sync(form){if(!form?.isConnected)return false;const route=form.elements?.namedItem?.('route');if(!route)return false;if(!route.querySelector(`option[value="${ROUTE}"]`)){const option=document.createElement('option');option.value=ROUTE;option.textContent='Downloaded local AI';const deterministic=route.querySelector('option[value="deterministic"]');deterministic?.after(option)||route.prepend(option)}const panel=panelFor(form),current=selection(),summary=panel.querySelector('[data-downloaded-local-summary]');if(summary)summary.textContent=current.active&&current.id?`${current.id} is selected for on-device interactive chat.`:'No downloaded model is selected yet.';const useLocal=route.value===ROUTE;panel.hidden=!useLocal;if(useLocal){form.querySelector('[data-panel="deterministic"]')?.setAttribute('hidden','');form.querySelector('[data-panel="remote"]')?.setAttribute('hidden','')}return true}
function fmt(bytes){const b=Number(bytes||0);return b>=1e9?`${(b/1e9).toFixed(1)} GB`:b>=1e6?`${Math.round(b/1e6)} MB`:`${Math.max(1,Math.round(b/1e3))} KB`}
function installLocalStyle(){
  if(document.getElementById(STYLE_ID))return true;if(!writable()||!document.head)return false;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
#${PANEL_ID}{display:grid;gap:12px}
#${PANEL_ID} .cw-pack-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
#${PANEL_ID} .cw-pack-card{display:grid;align-content:start;gap:8px;padding:13px;border:1px solid #ffffff22;border-radius:14px;background:#0a1730}
#${PANEL_ID} .cw-pack-card[data-pack-active="true"]{outline:2px solid #90efd8}
#${PANEL_ID} .cw-pack-card h4{margin:0;font-size:1rem}
#${PANEL_ID} .cw-pack-badge{font-size:.7rem;font-weight:900;letter-spacing:.08em;color:#90efd8}
#${PANEL_ID} .cw-local-row{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:11px;border:1px solid #ffffff1c;border-radius:12px;background:#091124}
#${PANEL_ID} .cw-local-row p,#${PANEL_ID} .cw-pack-card p{margin:.2rem 0;font-size:.9rem}
#${PANEL_ID} .cw-local-meta{color:#b9c8e3;font-size:.78rem}
#${PANEL_ID} .cw-local-actions{display:flex;gap:7px;flex-wrap:wrap}
#${PANEL_ID} .cw-local-actions a{display:inline-flex;align-items:center;justify-content:center;min-height:32px;padding:5px 9px;border:1px solid #ffffff33;border-radius:8px;background:#ffffff0d;color:inherit;text-decoration:none;font:inherit;font-weight:700}
#${PANEL_ID} .cw-local-active{outline:2px solid #90efd8}
#${PANEL_ID} .cw-local-error{color:#ffc3c3!important}
#${PANEL_ID} .cw-progress{height:8px;margin-top:7px;border-radius:99px;overflow:hidden;background:#ffffff14}
#${PANEL_ID} .cw-progress i{display:block;height:100%;width:var(--pct);background:linear-gradient(90deg,#7eeed5,#93c9ff,#e79cff)}
#${PANEL_ID} .cw-local-divider{height:1px;background:#ffffff18;margin:4px 0}
#${DOCK_ID}[hidden]{display:none!important}
#${DOCK_ID}{position:fixed;z-index:2147483645;left:max(10px,calc(env(safe-area-inset-left) + 8px));right:auto;bottom:max(80px,calc(env(safe-area-inset-bottom) + 70px));width:min(360px,calc(100vw - 20px));padding:10px;border:1px solid #8af5d255;border-radius:14px;background:#0b1728f2;color:#fff}
@media(max-width:820px){#${PANEL_ID} .cw-pack-grid{grid-template-columns:1fr}}
@media(max-width:700px),(hover:none) and (pointer:coarse){#${PANEL_ID} .cw-local-row{grid-template-columns:1fr}#${DOCK_ID}{top:max(10px,calc(env(safe-area-inset-top) + 8px));right:max(10px,calc(env(safe-area-inset-right) + 8px));bottom:auto;left:max(10px,calc(env(safe-area-inset-left) + 8px));width:auto}}`;
  document.head.append(style);return true;
}
function statusMarkup(st,available){
  if(!st||(!st.status&&!available))return'';
  if(st.status==='browser-ready')return'<p class="cw-local-meta"><b>Ready for browser download</b> · Large files will use the browser download manager.</p>';
  if(st.status==='browser-queuing')return'<p class="cw-local-meta"><b>Sending files to the browser download manager…</b></p>';
  if(st.status==='browser-queued')return'<p class="cw-local-meta"><b>Browser downloads queued</b> · Civweave can be closed while they finish. Import the completed files afterward.</p>';
  const percent=available?100:Math.max(0,Math.min(99,Number(st.percent||0)));return`<div class="cw-progress" style="--pct:${percent}%"><i></i></div><p class="cw-local-meta"><b>${percent}%</b>${st.status?` · ${esc(st.status)}`:''}${st.error?` · <span class="cw-local-error">${esc(st.error)}</span>`:''}</p>`;
}
function actions(model,st,available,active){if(available)return`<button type="button" data-local-use="${esc(model.id)}">${active?'Using locally':'Use locally'}</button><button type="button" data-local-remove="${esc(model.id)}">Remove</button>`;if(['downloading','finalizing'].includes(String(st.status||'')))return`<button type="button" data-local-cancel="${esc(model.id)}">Cancel</button>`;if(['paused','error','aborted','ready'].includes(String(st.status||'')))return`<button type="button" data-local-download="${esc(model.id)}">Resume</button><button type="button" data-local-remove="${esc(model.id)}">Clear</button>`;return`<button type="button" data-local-download="${esc(model.id)}">Download</button>`}
function packActions(pack,st,active){
  const state=String(st?.status||'');
  if(state==='ready')return`<button type="button" data-local-pack-use="${esc(pack.id)}">${active?'Using pack':'Use pack'}</button><button type="button" data-local-pack-remove="${esc(pack.id)}">Remove pack</button>`;
  if(state==='browser-queuing')return'<button type="button" disabled>Sending to browser…</button>';
  if(state==='browser-queued'){
    const href=`/app/index.html?source=settings-ai-pack-import&pack=${encodeURIComponent(pack.id)}#cw-ai-pack-browser-title`;
    return`<a href="${esc(href)}" target="_blank" rel="noopener">Import finished downloads</a><button type="button" data-local-pack-download="${esc(pack.id)}">Queue again</button><button type="button" data-local-pack-remove="${esc(pack.id)}">Clear pack</button>`;
  }
  if(['downloading','finalizing'].includes(state))return`<button type="button" data-local-pack-cancel="${esc(pack.id)}">Cancel</button>`;
  if(['paused','error','aborted'].includes(state))return`<button type="button" data-local-pack-download="${esc(pack.id)}">Resume pack</button><button type="button" data-local-pack-remove="${esc(pack.id)}">Clear pack</button>`;
  return`<button type="button" data-local-pack-download="${esc(pack.id)}">Download pack</button>`;
}
function dock(){if(!writable()||!document.body)return null;let element=document.getElementById(DOCK_ID);if(element)return element;element=document.createElement('button');element.id=DOCK_ID;element.type='button';element.hidden=true;element.dataset.openUnifiedAiSettings='';element.dataset.civweaveSettingsLauncher='local-model-download';document.body.append(element);return element}
function renderDock(){
  if(!writable())return;installLocalStyle();const element=dock();if(!element)return;const snap=snapshot();
  const packRow=PACK_CATALOGUE.map(pack=>({pack,state:snap.packs[pack.id]})).find(({state})=>state&&['downloading','finalizing','paused','error'].includes(String(state.status||'')));
  if(packRow){const percent=Math.max(0,Math.min(99,Number(packRow.state.percent||0)));element.hidden=false;element.innerHTML=`<strong>${esc(packRow.pack.label)} · ${esc(packRow.state.status)} · ${percent}%</strong><small>${fmt(packRow.state.completedBytes||0)} / ${fmt(packRow.state.totalBytes||packRow.pack.estimatedBytes)}</small>`;return}
  const row=CATALOGUE.map(model=>({model,state:snap.all[model.id]})).find(({state})=>state&&['downloading','finalizing','paused','error'].includes(String(state.status||'')));
  if(!row){element.hidden=true;return}const percent=Math.max(0,Math.min(99,Number(row.state.percent||0)));element.hidden=false;element.innerHTML=`<strong>${esc(row.model.label)} · ${esc(row.state.status)} · ${percent}%</strong><small>${fmt(row.state.bytesDownloaded||0)} / ${fmt(row.state.totalBytes||row.model.estimatedBytes)}</small>`;
}
function localPanel(form){return form?.querySelector(`#${PANEL_ID}`)||null}
function renderLocalModels(layerOrForm=document.getElementById('cw-settings-v320')){
  if(!writable())return null;installLocalStyle();
  const form=layerOrForm?.matches?.('[data-cw-settings-form]')?layerOrForm:layerOrForm?.querySelector?.('[data-cw-settings-form]')||document.querySelector('[data-cw-settings-form]');
  if(!form?.isConnected)return null;const target=form.querySelector('[data-settings-tab-panel="local-models"]');if(!target?.isConnected)return null;
  target.querySelector('[data-local-model-slot-placeholder]')?.remove();let panel=localPanel(form);if(!panel){panel=document.createElement('section');panel.id=PANEL_ID;panel.className='cw-clean-panel';target.append(panel)}
  const {all,selection:currentSelection,packs}=snapshot(),health=savedHealth();
  const packCards=PACK_CATALOGUE.map(pack=>{
    const st=packs[pack.id]||{},active=Boolean(currentSelection.active&&st.status==='ready'&&st.selectedModel===currentSelection.id);
    return`<article class="cw-pack-card" data-pack-id="${esc(pack.id)}" data-pack-active="${active?'true':'false'}"><span class="cw-pack-badge">${esc(pack.tier)}</span><h4>${esc(pack.label)}</h4><p>${esc(pack.summary)}</p><p class="cw-local-meta"><b>Target:</b> ${esc(pack.target)}</p><p class="cw-local-meta"><b>Storage:</b> ${esc(pack.storage)}</p><p class="cw-local-meta">${esc(pack.contents)}</p>${statusMarkup(st,st.status==='ready')}<div class="cw-local-actions">${packActions(pack,st,active)}</div></article>`;
  }).join('');
  const rows=CATALOGUE.map(model=>{
    const st=all[model.id]||{},active=Boolean(currentSelection.active&&currentSelection.id===model.id),available=st.status==='ready'||active,h=health[model.id],healthCopy=h?(h.ok?`Last health PASS${h.fallbackUsed?' via fallback':''} · TTFT ${((h.metrics?.ttftMs||0)/1000).toFixed(2)}s · ${Number(h.metrics?.tokensPerSecond||0).toFixed(2)} tok/s`:`Last health failed · ${esc(h.stage||'unknown stage')}`):'No measured run yet';
    return`<div class="cw-local-row${active?' cw-local-active':''}" data-model-id="${esc(model.id)}"><div><b>${esc(model.tier)} · ${esc(model.label)}</b><p>${esc(model.repo)} · ${fmt(model.estimatedBytes)} · ${esc(model.license)}${active?' · ACTIVE':''}</p><p class="cw-local-meta">Model window <b>${Number(model.contextWindowTokens||0).toLocaleString()} tokens</b> · Civweave working default <b>${Number(model.workingContextTokens||0).toLocaleString()}</b></p><p class="cw-local-meta">${healthCopy}</p>${statusMarkup(st,available)}</div><div class="cw-local-actions">${actions(model,st,available,active)}</div></div>`;
  }).join('');
  const preview=PREVIEW.map(model=>`<div class="cw-local-row"><div><b>${esc(model.label)} · preview</b><p>${esc(model.reason)}</p></div></div>`).join('');
  panel.innerHTML=`<div><h3>AI Downloads</h3><p>Choose a complete hardware-tier pack or manage individual local models. This view reads only small saved-state records; opening it does not touch model caches, GPUs, or inference runtimes.</p></div><div class="cw-clean-note">Pack/model code loads only after an explicit Download, Resume, Use, Remove, Cancel, or Stop action. Large phone/server packs hand their large files to the browser download manager so Civweave does not need to remain open for the transfer.</div><div data-local-status role="status" class="${noticeError?'cw-local-error':''}">${esc(notice)}</div><div class="cw-pack-grid">${packCards}</div><div class="cw-local-divider"></div><details><summary><b>Individual models</b></summary><div style="display:grid;gap:8px;margin-top:10px">${rows}</div></details><details><summary>Preview models</summary><div style="display:grid;gap:8px;margin-top:10px">${preview}</div></details><div class="cw-local-actions"><button type="button" data-local-disable ${currentSelection.active?'':'hidden'}>Stop using downloaded AI</button></div>`;
  if(panel.dataset.cwLocalActionsBound!=='1'){panel.dataset.cwLocalActionsBound='1';panel.addEventListener('click',event=>void localAction(event,panel))}
  renderDock();return panel;
}
function showLocal(text,isError=false){notice=text;noticeError=isError;const status=document.querySelector(`#${PANEL_ID} [data-local-status]`);if(status){status.textContent=text;status.classList.toggle('cw-local-error',isError)}}
function afterPaint(){return new Promise(resolve=>{const done=()=>setTimeout(resolve,0);if(typeof requestAnimationFrame==='function')requestAnimationFrame(done);else setTimeout(resolve,0)})}
function ensureScript(src,ready){
  if(ready?.())return Promise.resolve(true);
  return new Promise((resolve,reject)=>{
    const path=new URL(src,location.href).pathname,existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname===path);
    if(existing){if(ready?.())return resolve(true);existing.addEventListener('load',()=>ready?.()?resolve(true):reject(new Error(`${path} loaded without becoming ready.`)),{once:true});existing.addEventListener('error',()=>reject(new Error(`${path} could not load.`)),{once:true});return}
    const script=document.createElement('script');script.src=src;script.async=false;script.dataset.civweaveLocalModelAction='v326';script.onload=()=>ready?.()?resolve(true):reject(new Error(`${path} loaded without becoming ready.`));script.onerror=()=>reject(new Error(`${path} could not load.`));document.head.append(script);
  });
}
function ensureActionModules(){if(ACTION_FILES.every(([,ready])=>ready?.()))return Promise.resolve(true);if(actionPromise)return actionPromise;actionPromise=(async()=>{for(const [src,ready] of ACTION_FILES)await ensureScript(src,ready);return true})().finally(()=>{actionPromise=null});return actionPromise}
function foregroundDownload(model){return Boolean(model?.preferBackground===false||FOREGROUND_PHONE_MODELS.has(String(model?.id||'')))}
async function localAction(event,panel){
  const button=event.target.closest('button');if(!button||!writable())return;
  const packId=button.dataset.localPackDownload||button.dataset.localPackUse||button.dataset.localPackRemove||button.dataset.localPackCancel;
  const id=button.dataset.localDownload||button.dataset.localUse||button.dataset.localRemove||button.dataset.localCancel;
  const isAction=Boolean(packId||id||button.hasAttribute('data-local-disable'));if(!isAction)return;
  try{
    button.disabled=true;showLocal(packId?'Preparing this AI pack action…':'Preparing this model action…');await afterPaint();await ensureActionModules();
    const m=manager(),r=registry(),p=packManager();if(!m||!r||!p)throw new Error('Local AI download action modules did not become ready.');
    if(button.hasAttribute('data-local-pack-download')){
      const pack=p.byId(packId);
      if(p.installMode?.(packId)==='browser'){
        const browser=browserPackDownload();if(!browser?.queue)throw new Error('The browser AI pack download bridge did not become ready.');
        showLocal(`Sending ${pack.label} to the browser download manager…`);
        await browser.queue(packId,{onProgress:progress=>{if(progress?.message)showLocal(progress.message)}});
        showLocal(`${pack.label} downloads are queued in the browser. Civweave can be closed while they finish; then choose Import finished downloads.`);
      }else{
        showLocal(`Downloading ${pack.label}…`);
        await p.install(packId,{onProgress:progress=>{const state=progress?.state||p.state(packId)||{};showLocal(`${pack.label} · ${Math.max(0,Math.min(99,Number(state.percent||0)))}% · ${state.component||state.phase||'downloading'}`)}});
        showLocal(`${pack.label} is downloaded and verified.`);
      }
    }else if(button.hasAttribute('data-local-pack-cancel')){
      await p.cancel(packId);showLocal(`${p.byId(packId).label} download paused.`);
    }else if(button.hasAttribute('data-local-pack-use')){
      const result=await p.use(packId);globalThis.CivweaveLocalModelBridgeV266?.patch?.();showLocal(`${result.pack.label} is active · ${r.byId(result.model)?.label||result.model} handles interactive local chat.`);
    }else if(button.hasAttribute('data-local-pack-remove')){
      const label=p.byId(packId).label;if(p.installMode?.(packId)==='browser')browserPackDownload()?.clear?.(packId);await p.remove(packId);showLocal(`${label} removed. Files still required by another installed pack were kept.`);
    }else if(button.hasAttribute('data-local-download')){
      const spec=r.byId(id);if(!spec)throw new Error(`Unknown local model: ${id}`);showLocal(`Starting ${spec.label}…`);await m.start(id,{preferBackground:!foregroundDownload(CATALOGUE.find(model=>model.id===id)||spec)});showLocal(`${spec.label} download started.`);
    }else if(button.hasAttribute('data-local-cancel')){
      await m.cancel(id);showLocal('Download cancelled.');
    }else if(button.hasAttribute('data-local-use')){
      const verified=await m.status(id);if(!verified.available)throw new Error('The cached package did not pass integrity verification. Resume or repair it before selecting this model.');m.select(id);globalThis.CivweaveLocalModelBridgeV266?.patch?.();showLocal(`${r.byId(id)?.label||id} is now the interactive local model.`);
    }else if(button.hasAttribute('data-local-remove')){
      await m.remove(id);showLocal('Local model package removed from this device.');
    }else if(button.hasAttribute('data-local-disable')){
      m.select(null);globalThis.CivweaveLocalModelRuntimeV266?.shutdown?.();showLocal('Downloaded local AI is disabled.');
    }
    if(writable())renderLocalModels(panel.closest('[data-cw-settings-form]'));
  }catch(error){showLocal(String(error?.message||error),true);if(writable())renderLocalModels(panel.closest('[data-cw-settings-form]'))}
}
function patch(form=document.querySelector('[data-cw-settings-form]')){
  if(!form?.isConnected)return false;const route=form.elements?.namedItem?.('route');if(!route)return false;sync(form);const current=selection();if(current.active&&current.id)route.value=ROUTE;sync(form);if(form.dataset.cwLocalRouteV323==='1')return true;form.dataset.cwLocalRouteV323='1';
  route.addEventListener('change',()=>queueMicrotask(()=>sync(form)));
  form.addEventListener('submit',event=>{
    const chosen=String(route.value||''),currentSelection=selection();
    if(chosen===ROUTE){
      event.preventDefault();event.stopImmediatePropagation();const status=form.querySelector('[data-status]');
      if(!currentSelection.active||!currentSelection.id){if(status)status.textContent='Choose an AI pack or downloaded model in Local models before using Downloaded local AI.';form.querySelector('[data-settings-tab="local-models"]')?.click?.();return}
      const fallback=fallbackConfig();if(status)status.textContent=`Downloaded local AI is active · ${currentSelection.id}. Your configured provider remains the fallback.`;
      try{dispatchEvent(new CustomEvent('civweave:model-settings-saved',{detail:{version:VERSION,route:ROUTE,primaryRoute:ROUTE,primaryModel:currentSelection.id,interactive:fallback,agentic:null,agenticEnabled:false,localSelection:currentSelection,savedAt:new Date().toISOString()}}))}catch{}return;
    }
    if(currentSelection.active&&currentSelection.id){try{localStorage.setItem(SELECTION_KEY,JSON.stringify({active:false,id:null,updatedAt:new Date().toISOString()}));dispatchEvent(new CustomEvent('civweave:local-model-selection',{detail:{active:false,id:null,updatedAt:new Date().toISOString()}}))}catch{}}
  },true);
  return true;
}
function patchVisible(){const form=document.querySelector('[data-cw-settings-form]');if(form)patch(form)}
function rerenderVisible(){if(!writable())return;const form=document.querySelector('[data-cw-settings-form]');if(form?.dataset.activeSettingsTab==='local-models')renderLocalModels(form);else renderDock()}
addEventListener('civweave:model-settings-opened',()=>queueMicrotask(patchVisible));
addEventListener('civweave:local-model-download-open',()=>{if(!writable())return;globalThis.CivweaveSettingsV320?.open?.();queueMicrotask(()=>document.querySelector('[data-settings-tab="local-models"]')?.click?.())});
for(const name of ['civweave:local-model-download-progress','civweave:local-model-downloaded','civweave:local-model-removed','civweave:local-model-health','civweave:local-model-selection','civweave:local-model-pack-progress','civweave:local-model-pack-installed','civweave:local-model-pack-removed','civweave:local-model-pack-selected'])addEventListener(name,()=>queueMicrotask(rerenderVisible));
addEventListener('pagehide',()=>{navigating=true});
addEventListener('beforeunload',()=>{navigating=true},{once:true});
addEventListener('pageshow',()=>{navigating=false;queueMicrotask(()=>{patchVisible();rerenderVisible()})});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',patchVisible,{once:true});else queueMicrotask(patchVisible);
globalThis.CivweaveSettingsLocalRouteV323=Object.freeze({
  version:VERSION,route:ROUTE,patch,selection,selectedLabel,renderLocalModels,ensureActionModules,catalogue:CATALOGUE,packCatalogue:PACK_CATALOGUE,
  settingsPresentationOwnership:false,inputOwnership:false,managerDependency:false,runtimeDependency:false,cacheDependency:false,localModelsViewDirect:true,lifecycleDependency:false,registryDependencyOnView:false,managerDependencyOnView:false,cacheReadOnView:false,serviceWorkerReadyOnView:false,hardwareProbeOnView:false,packRuntimeDependencyOnView:false,packCacheReadOnView:false,savedStateOnlyView:true,viewWritesState:false,actionModulesOnDemand:true,browserPackHandoff:true,legacyBrowserErrorRecovery:true
});
})();