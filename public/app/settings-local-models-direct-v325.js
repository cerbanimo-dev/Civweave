(()=>{
'use strict';
const VERSION='1.2.5-settings-v325-direct-local-models-ios-webgpu-qwen';
const LAYER_ID='cw-settings-v320';
const PANEL_ID='cw-local-models-direct-v325';
const STYLE_ID='cw-local-models-direct-v325-style';
const SELECTION_KEY='civweave.local-ai.selection.v266';
const DOWNLOADS_KEY='civweave.local-ai.downloads.v266';
const PACK_STATE_KEY='civweave.local-ai.packs.v1';
const HEALTH_KEY='civweave.local-ai.health.v286';
const PERF_KEY='civweave.local-ai.performance.v1';
const PHONE_IMPORT_KEY='civweave.qwen35-4b.import-progress.v1';
let phoneImportInFlight=false;
function phoneImportRecord(phase,message,chunk=0,chunks=0){try{localStorage.setItem(PHONE_IMPORT_KEY,JSON.stringify({phase,text:String(message).slice(0,400),chunk,chunks,at:Date.now()}))}catch{}}
function phoneImportState(){try{return JSON.parse(localStorage.getItem(PHONE_IMPORT_KEY)||'{}')}catch{return{}}}
const PREMIER='premier-phone';
const FAST_E2='gemma4-e2b-it-litert-web';
const FAST_E4='gemma4-e4b-it-litert-web';
const FINALIZER_SRC='/app/local-ai/premier-phone-finalizer-v1.js?v=1.0.0-idempotent-existing-components';
const BUILD_LABEL='Settings v325 · renderer direct-local-v325.4 · Qwen 4B phone-first performance';
const PACKS=Object.freeze([
  {id:'minimum-spec',label:'Minimum Spec Pack',tier:'MINIMUM',size:'~1.7 GB',summary:'Smallest complete offline voice + chat bundle, with CPU/WASM as the primary text path.',primaryModel:'qwen3-0.6b-q8-wasm'},
  {id:'qwen-flagship-phone',label:'Legacy mixed-engine phone pack',tier:'LEGACY · NON-GGUF',size:'~19.7 GB core',summary:'Historical LiteRT/ONNX phone package kept only for existing users. GGUF is the new on-device phone-primary path above; this pack does not install GGUF.',primaryModel:'qwen35-4b-litert-web'},
  {id:PREMIER,label:'Gemma Phone Compatibility Pack',tier:'PHONE ALTERNATE',size:'~6.9 GB',summary:'Alternate Gemma phone-local ladder retained for compatibility, multilingual speech, and a CPU-safe fallback.',primaryModel:FAST_E2},
  {id:'server-quality',label:'Server Quality Pack',tier:'SERVER QUALITY',size:'~13.0 GB',summary:'Higher-quality Guild/server bundle using Civweave’s strongest currently executable local models.',primaryModel:'gemma4-e4b-it-q2f16-mobile'}
]);
const MODELS=Object.freeze([
  {id:'llama32-3b-instruct-q4f16',label:'Llama 3.2 3B Instruct · JSON compiler trial',tier:'PHONE TEST',size:'~2.4 GB',trial:true},
  {id:'smollm2-135m-instruct-q8-wasm',label:'SmolLM2 135M Instruct',tier:'Phone Tiny',size:'140 MB'},
  {id:'smollm2-360m-instruct-q4f16',label:'SmolLM2 360M Instruct',tier:'Phone Light',size:'272 MB'},
  {id:'qwen3-0.6b-q4f16',label:'Qwen 3 0.6B',tier:'Small',size:'610 MB'},
  {id:'gemma3-1b-it-q4f16',label:'Gemma 3 1B IT',tier:'Standard',size:'884 MB'},
  {id:'qwen3-1.7b-q4f16',label:'Qwen 3 1.7B',tier:'Large',size:'1.5 GB'},
  {id:'qwen35-4b-litert-web',label:'Qwen 3.5 4B · LiteRT (legacy)',tier:'LEGACY · incompatible web loader',size:'2.75 GB',browserPackId:'qwen-flagship-phone'},
  {id:'qwen35-9b-litert-web',label:'Qwen 3.5 9B · LiteRT',tier:'Phone Flagship Max',size:'9.5 GB',browserPackId:'qwen-flagship-phone'},
  {id:'gemma4-e2b-it-q2f16-mobile',label:'Gemma 4 E2B IT',tier:'Phone Alternate Fast',size:'~2.3 GB',browserPackId:'qwen-flagship-phone'},
  {id:'smollm3-3b-q4f16',label:'SmolLM3 3B',tier:'Mini PC',size:'2.2 GB'},
  {id:'qwen3-4b-q4f16',label:'Qwen 3 4B',tier:'PC 12',size:'2.9 GB'}
]);
const PHONE_COMPANIONS=Object.freeze([
  Object.freeze({label:'Qwen2.5-Coder-7B-Instruct Q4_K_M',use:'Dedicated coding companion · llama.cpp / Pocket Constellary',url:'https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF/blob/main/qwen2.5-coder-7b-instruct-q4_k_m.gguf'}),
  Object.freeze({label:'Local Dream · Stable Diffusion 1.5',use:'Snapdragon NPU image generation companion',url:'https://github.com/xororz/local-dream'}),
  Object.freeze({label:'Qualcomm AI Hub · Stable Diffusion 1.5',use:'Snapdragon 7 Gen 4 deployment reference',url:'https://aihub.qualcomm.com/mobile/models/stable_diffusion_v1_5'})
]);
const MAC_MINI_SETUPS=Object.freeze([
  Object.freeze({hardware:'M4 / M6 · 16 GB',summary:'Constrained local reasoning/chat. Keep contexts modest and leave headroom for macOS.',links:Object.freeze([{label:'gpt-oss-20B · Ollama',url:'https://ollama.com/library/gpt-oss:20b'}])}),
  Object.freeze({hardware:'M4 / M6 · 24–32 GB',summary:'Best value dense reasoning tier for planning, architecture, and coding.',links:Object.freeze([{label:'Qwen3.8-27B · MLX 4-bit',url:'https://huggingface.co/mlx-community/Qwen3.8-27B-4bit'}])}),
  Object.freeze({hardware:'M4 Pro / M5 Pro · 48 GB',summary:'Higher-fidelity planning plus a fast MoE worker; swap models rather than keeping both resident.',links:Object.freeze([{label:'Qwen3.8-27B · MLX 8-bit',url:'https://huggingface.co/mlx-community/Qwen3.8-27B-8bit'},{label:'Qwen3.6-35B-A3B · MLX 4-bit',url:'https://huggingface.co/mlx-community/Qwen3.6-35B-A3B-4bit'}])}),
  Object.freeze({hardware:'M4 Pro / M5 Pro · 64 GB',summary:'Full cyberdeck tier: high-fidelity planning plus the dedicated 80B-total coding MoE.',links:Object.freeze([{label:'Qwen3.8-27B · MLX 8-bit',url:'https://huggingface.co/mlx-community/Qwen3.8-27B-8bit'},{label:'Qwen3-Coder-Next · MLX 4-bit',url:'https://huggingface.co/mlx-community/Qwen3-Coder-Next-4bit'}])})
]);
const ACTION_FILES=Object.freeze([
  ['/app/local-ai/model-registry-v266.js?v=1.0.119-v306-qwen35-4b',()=>Boolean(String(globalThis.CivweaveLocalModelRegistryV266?.version||'').startsWith('1.0.119-')&&globalThis.CivweaveLocalModelRegistryV266?.byId?.('qwen35-4b-litert-web'))],
  ['/app/local-ai/download-manager-v267.js?v=1.0.71-v324-qwen4-chunked-import',()=>Boolean(String(globalThis.CivweaveLocalModelDownloadV266?.version||'').startsWith('1.0.71-')&&globalThis.CivweaveLocalModelDownloadV266?.status&&globalThis.CivweaveLocalModelDownloadV266?.selection&&globalThis.CivweaveLocalModelDownloadV266?.autoSyncOnLoad===false)],
  ['/app/local-ai/download-policy-v278.js?v=1.0.82-v322-explicit-sync',()=>Boolean(globalThis.CivweaveLocalModelDownloadV266?.largeExternalDataForeground===true&&globalThis.CivweaveLocalModelDownloadV266?.autoSyncOnLoad===false)],
  ['/app/local-ai/metadata-repair-v276.js?v=1.0.81-v277',()=>Boolean(globalThis.CivweaveLocalModelDownloadV266?.metadataOnlyRepair===true)],
  ['/app/local-ai/specialized-model-capabilities-v1.js?v=1.1.0-model-packs',()=>Boolean(globalThis.CivweaveLocalSpecializedAI?.preferredTts==='supertonic-3-tts-int8')],
  ['/app/local-ai/model-packs-v1.js?v=1.2.0-premium-phone',()=>Boolean(globalThis.CivweaveLocalModelPacksV1?.byId&&globalThis.CivweaveLocalModelPacksV1?.install)],
  ['/app/local-ai/browser-pack-download-v1.js?v=1.4.0-qwen35-flagship',()=>Boolean(globalThis.CivweaveBrowserPackDownloadV1?.queue&&globalThis.CivweaveBrowserPackDownloadV1?.pickAndImport)]
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
#${PANEL_ID} .cw-direct-pack-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:9px}
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
#${PANEL_ID} .cw-direct-link-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:9px;margin-top:9px}
#${PANEL_ID} .cw-direct-link-card{display:grid;gap:7px;padding:11px;border:1px solid #ffffff1c;border-radius:12px;background:#071226}
#${PANEL_ID} .cw-direct-link-card b{color:#fff}
#${PANEL_ID} .cw-direct-link-card p{margin:0;color:#bdc9e3;font-size:.84rem}
#${PANEL_ID} .cw-direct-link-card a{display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:6px 9px;border:1px solid #ffffff33;border-radius:8px;background:#ffffff0d;color:#dffcf6;text-decoration:none;font-size:.82rem;font-weight:800}
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
  if(model.id==='qwen35-4b-litert-web')return'<a href="https://huggingface.co/litert-community/Qwen3.5-4B/resolve/main/Qwen3.5-4B_mixed_int4.litertlm" target="_blank" rel="noopener noreferrer">Download 2.75 GB in browser</a><label>Import Qwen 4B file<input type="file" accept=".litertlm" data-local-phone-import="'+esc(model.id)+'"></label>';
  if(model.id==='qwen35-9b-litert-web')return'<span>9B requires a separate experimental installation; the 4B selection never starts it.</span>';
  if(model.browserPackId)return`<button type="button" data-cw-direct-local-action data-local-pack-download="${esc(model.browserPackId)}">Download flagship pack</button>`;
  if(['downloading','finalizing'].includes(value))return`<button type="button" data-cw-direct-local-action data-local-cancel="${esc(model.id)}">Cancel</button>`;
  if(['paused','error','aborted'].includes(value))return`<button type="button" data-cw-direct-local-action data-local-download="${esc(model.id)}">Resume</button><button type="button" data-cw-direct-local-action data-local-remove="${esc(model.id)}">Clear</button>`;
  return`<button type="button" data-cw-direct-local-action data-local-download="${esc(model.id)}">Download</button>`;
}
function externalLinks(rows){
  return rows.map(row=>`<a href="${esc(row.url)}" target="_blank" rel="noopener noreferrer">${esc(row.label)}</a>`).join('');
}
function phoneCompanionMarkup(){
  return PHONE_COMPANIONS.map(row=>`<article class="cw-direct-link-card"><b>${esc(row.label)}</b><p>${esc(row.use)}</p><div class="cw-direct-actions"><a href="${esc(row.url)}" target="_blank" rel="noopener noreferrer">Open setup</a></div></article>`).join('');
}
function macMiniMarkup(){
  return MAC_MINI_SETUPS.map(row=>`<article class="cw-direct-link-card"><b>${esc(row.hardware)}</b><p>${esc(row.summary)}</p><div class="cw-direct-actions">${externalLinks(row.links)}</div></article>`).join('');
}
function updateHeader(layer=document.getElementById(LAYER_ID)){
  if(!layer)return false;
  const label=layer.querySelector('header small');if(label&&/CIVWEAVE SETTINGS/i.test(label.textContent||''))label.textContent='CIVWEAVE SETTINGS · v325';
  layer.dataset.settingsVisibleVersion='v325';return true;
}

const UNIFIED_FLEET_SRC='/app/shared/civweave-ai-fleet-v1.js?v=1.3.1-backend-switch-fix';
function showUnifiedFleet(layer=document.getElementById('cw-settings-v320')){
  const target=layer?.querySelector?.('[data-settings-tab-panel="local-models"]');
  if(!target||!layer?.isConnected||layer.hidden)return false;
  updateHeader(layer);
  const api=globalThis.CivweaveAIFleetV1;
  if(api?.render){api.render(layer);return true;}
  // One shared model-selection owner. Legacy pack/model card renderers are
  // superseded; neither their download buttons nor their listeners are mounted.
  target.innerHTML='<section class="cw-clean-panel"><h3>AI Fleet</h3><p>Loading compatible AI choices for this device…</p></section>';
  if(!globalThis.__civweaveFleetLoadV1){
    globalThis.__civweaveFleetLoadV1=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=UNIFIED_FLEET_SRC;script.async=false;
      script.onload=()=>globalThis.CivweaveAIFleetV1?.render?resolve(true):reject(Error('AI Fleet catalog did not initialize.'));
      script.onerror=()=>reject(Error('AI Fleet catalog failed to load.'));
      document.head.append(script);
    }).catch(error=>{
      const live=document.querySelector('[data-settings-tab-panel="local-models"]');
      if(live)live.innerHTML='<section class="cw-clean-panel"><h3>AI Fleet unavailable</h3><p>'+String(error?.message||error).replace(/[&<>]/g,'')+'</p></section>';
      return false;
    });
  }
  void globalThis.__civweaveFleetLoadV1.then(ok=>{if(ok&&layer?.isConnected&&!layer.hidden&&
    layer.querySelector('[data-settings-tab="local-models"]')?.getAttribute('aria-selected')==='true')
    globalThis.CivweaveAIFleetV1.render(layer)});
  return true;
}

function render(layer=document.getElementById(LAYER_ID)){
  if(showUnifiedFleet(layer))return true;
  if(!layer?.isConnected||layer.hidden)return false;
  installStyle();updateHeader(layer);
  const form=layer.querySelector('[data-cw-settings-form]'),target=form?.querySelector('[data-settings-tab-panel="local-models"]');if(!target)return false;
  const snap=snapshot();const perf=(()=>{try{return JSON.parse(localStorage.getItem(PERF_KEY)||'{}')}catch{return{}}})();const phoneImport=phoneImportState();
  const gguf=read('civweave.mobile.gguf-primary.v2',{});
  const ggufStatus=gguf?.enabled?'Selected GGUF primary: '+esc(gguf.label||gguf.model||'Qwen GGUF'):'No embedded GGUF primary selected';
  const safariWebGPUMarkup='<article class="cw-direct-card" data-ios-webgpu-browser><span class="cw-direct-badge">iOS 26+ · APPLE GPU · EXPERIMENTAL</span><h4>Qwen 3.5 · Safari WebGPU</h4><p>0.8B first, 2B next, 4B experimental. Download optimized ONNX files directly in this browser and test streaming before enabling. No LiteRT, ai.local or HTTP server.</p><div class="cw-direct-actions"><button type="button" data-direct-open-ios-webgpu>Download / test iPhone WebGPU Qwen</button></div></article>';
  const embeddedGGUFMarkup=`<article class="cw-direct-card" data-gguf-phone-primary><span class="cw-direct-badge">RECOMMENDED · GGUF ONLY</span><h4>On-device GGUF · Phone Primary</h4><p>Download GGUF weights into Civweave. Inference uses bundled browser Wllama/WebGPU/WASM. No LiteRT, no llama-server and no API endpoint.</p><p>${ggufStatus}</p><div class="cw-direct-actions"><button type="button" data-direct-open-gguf>Manage GGUF download and activate</button></div></article>`;
  const packMarkup=PACKS.map(pack=>{
    const state=snap.packs[pack.id]||{},active=Boolean(snap.selection?.active&&state.status==='ready'&&state.selectedModel===snap.selection.id);
    const premium=pack.id==='qwen-flagship-phone'?'<p><b>Roles:</b> general chat · voice-to-voice · deep logic/planning · architecture/code · optional image generation</p>':'';
    return`<article class="cw-direct-card" data-pack-id="${esc(pack.id)}" data-active="${active?'true':'false'}"><span class="cw-direct-badge">${esc(pack.tier)}</span><h4>${esc(pack.label)}</h4><p>${esc(pack.summary)}</p>${premium}<p><b>${esc(statusCopy(state,state.status==='ready'))}</b> · ${esc(pack.size)}</p><div class="cw-direct-actions">${packAction(pack,state,active)}</div></article>`;
  }).join('');
  const modelMarkup=MODELS.map(model=>{
    const state=snap.downloads[model.id]||{},active=Boolean(snap.selection?.active&&snap.selection.id===model.id),health=snap.health[model.id],healthText=health?(health.ok?'Last health check passed':'Last health check failed'):'No measured run yet';
    const row=perf[model.id]||{},recent=(Array.isArray(row.samples)?row.samples:[]).slice(-5),speeds=recent.filter(x=>Number.isFinite(x.tokensPerSecond)),ttfts=recent.filter(x=>Number.isFinite(x.ttftMs)),speed=speeds.length?(speeds.reduce((n,x)=>n+x.tokensPerSecond,0)/speeds.length).toFixed(1)+' tokens/s'+(speeds.some(x=>x.approximate)?' (approx)':''):'Not measured yet',ttft=ttfts.length?' · first token '+(ttfts.reduce((n,x)=>n+x.ttftMs,0)/ttfts.length/1000).toFixed(1)+'s':'';
    return`<article class="cw-direct-model" data-model-id="${esc(model.id)}" data-active="${active?'true':'false'}"><div><b>${esc(model.tier)} · ${esc(model.label)}</b><p>${esc(model.size)} · ${esc(statusCopy(state,active))}${active?' · ACTIVE':''}</p><p>${esc(healthText)}</p><p>Actual speed: ${esc(speed+ttft)}${row.lastPlan?' · '+(row.lastPlan.validated?'Moss structure PASS':'Moss structure failed'):''}</p>${model.id==='qwen35-4b-litert-web'?'<p>Known LiteRT Web limitation: the Qwen 3.5 4B hybrid artifact contains LlmExecutorMetadata that the pinned streaming loader cannot read. Cached weights are preserved. For generation, choose on-device GGUF or a local OpenAI-compatible server.</p>':''}${model.id==='qwen35-4b-litert-web'&&phoneImport?.text?`<p data-qwen-phone-import-progress role="status">File import: ${esc(phoneImport.phase==='importing'&&!phoneImportInFlight?'Previous attempt · '+phoneImport.text+' · Reselect the file to resume.':phoneImport.text)}</p>`:''}</div><div class="cw-direct-actions">${modelAction(model,state,active)}</div></article>`;
  }).join('');
  target.innerHTML=`<section id="${PANEL_ID}" class="cw-clean-panel" data-cw-direct-local-panel><div><h3>AI Downloads</h3><p>Saved choices are rendered immediately by Settings. Runtime and download code loads only when you choose an action.</p></div><div class="cw-direct-build">${esc(BUILD_LABEL)}</div><div class="cw-direct-note">The Premium Phone Pack keeps the executable chat/reasoning and voice stack in Civweave. Dedicated GGUF coding and Snapdragon diffusion remain optional companion installs so they do not compete for phone RAM.</div><div class="cw-direct-status" data-cw-direct-local-status role="status">Saved local model state loaded.</div><div class="cw-direct-pack-grid">${safariWebGPUMarkup}${embeddedGGUFMarkup}${packMarkup}</div><details open><summary><b>Premium phone companions</b></summary><p>Optional tools for dedicated coding and local image generation. These links open outside Civweave; they are not claimed as browser-runtime models.</p><div class="cw-direct-link-grid">${phoneCompanionMarkup()}</div></details><details><summary><b>Mac mini / cyberdeck local AI setups</b></summary><p>Apple Silicon model suggestions by unified-memory tier. These are external MLX/Ollama setups, useful for Guild servers, workstations, and portable cyberdecks.</p><div class="cw-direct-link-grid">${macMiniMarkup()}</div></details><div class="cw-direct-note"><b>New: Llama 3.2 3B two-pass test</b><br>Download the ~2.4 GB ONNX model from Individual Civweave models below, then <a href="/app/local-ai/llama32-two-pass-test-v4.html">run constrained JSON compilation</a>. This does not remove your installed Gemma models.</div><details open><summary><b>Individual Civweave models</b></summary><div class="cw-direct-model-list">${modelMarkup}</div></details>${snap.selection?.active?'<div class="cw-direct-actions"><button type="button" data-cw-direct-local-action data-local-disable>Stop using downloaded AI</button></div>':''}</section>`;
  form.dataset.directLocalModels='v325';layer.dataset.localModelsRenderer='direct-local-v325.5';return true;
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
    if(existing){
      if(ready?.())return resolve(true);
      if(path==='/app/local-ai/model-registry-v266.js'||path==='/app/local-ai/download-manager-v267.js'){
        // Replace a stale registry on user action; a completed old script will
        // never fire its load event again. Do not touch caches on view.
        try{existing.remove()}catch{}
      }else{
        existing.addEventListener('load',done,{once:true});
        existing.addEventListener('error',()=>reject(new Error(`${label} could not load.`)),{once:true});
        return;
      }
    }
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
    status(layer,`Starting ${spec.label} · direct streaming transfer…`);
    await m.start(id,{preferBackground:false,onProgress:progress=>{
      const loaded=Number(progress?.bytesDownloaded||0),total=Number(progress?.totalBytes||spec.estimatedBytes||0);
      const pct=total?Math.floor(loaded/total*100):0,file=String(progress?.artifact||'');
      const state=String(progress?.status||'');
      if(state==='error'||state==='paused')status(layer,`${spec.label} · ${state} · ${String(progress.error||'')}`,true);
      else if(state==='ready'){status(layer,`${spec.label} · download complete. Select Use locally.`);if(layer?.isConnected&&!layer.hidden)preserveScroll(layer,()=>render(layer))}
      else status(layer,`${spec.label} · ${file||'downloading'} · ${pct}% · ${(loaded/1e6).toFixed(1)} / ${(total/1e6).toFixed(1)} MB`);
    }});
    status(layer,`${spec.label} · direct download running; the transfer status above updates as bytes arrive. Keep Settings open.`);return true;
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
async function importPhoneQwenDirect(event){
  // Both the v324 full route and this v325 direct fallback can be loaded in
  // the same document. Capture only this renderer's own input. Previously this
  // global capture listener cleared input.value before the v324 change handler
  // could read files[0], making the import appear to flash and do nothing.
  const input=event.target?.closest?.('input[data-local-phone-import]');
  if(!input||!input.closest('#'+PANEL_ID)||phoneImportInFlight)return;
  const file=input.files?.[0];input.value='';if(!file)return;
  phoneImportInFlight=true;
  const layer=document.getElementById(LAYER_ID);
  try{
    const id=input.dataset.localPhoneImport;
    if(id!=='qwen35-4b-litert-web'||file.name!=='Qwen3.5-4B_mixed_int4.litertlm'||file.size!==2754070624)throw Error('Select the complete 2,754,070,624-byte Qwen3.5-4B_mixed_int4.litertlm file.');
    phoneImportRecord('importing','Importing Qwen 4B as resumable 8 MiB fragments.');status(layer,'Importing Qwen 4B in resumable 8 MiB fragments…');
    for(const [src,ready]of ACTION_FILES.slice(0,2))await ensureScript(src,ready,'Qwen phone import component');
    const m=manager(),r=registry(),spec=r?.byId?.(id),artifact=spec?.artifacts?.find(x=>x.required);
    if(!m||artifact?.sizeBytes!==file.size||artifact.path!==file.name)throw Error('Current Qwen 4B registry/download manager does not match this file.');
    const {importChunkedFile}=await import('/app/local-ai/llama32-chunked-model-storage-v1.js?v=1');
    let last=0;
    await importChunkedFile(await caches.open(m.cache),r.directUrl(spec,artifact.path),file,{onProgress:p=>{
      if(Date.now()-last>250||p.chunk===p.chunks){last=Date.now();const msg='Qwen 4B '+p.chunk+'/'+p.chunks+' cached fragments';phoneImportRecord('importing',msg,p.chunk,p.chunks);status(layer,msg);}
    }});
    const verified=await m.status(id);
    if(!verified.available)throw Error('Model cache still incomplete after import.');
    phoneImportRecord('ready','Qwen 4B verified; select Use locally. No GPU inference started.');
    preserveScroll(layer,()=>render(layer));
    status(layer,'Qwen 4B verified. Select Use locally; no GPU inference was started.');
  }catch(error){const msg=String(error?.message||error);phoneImportRecord('error','Import failed: '+msg+' · Reselect the downloaded file to resume retained fragments.');status(layer,msg,true)}
  finally{phoneImportInFlight=false}
}
document.addEventListener('change',event=>void importPhoneQwenDirect(event),true);
function onDocumentClick(event){const layer=document.getElementById(LAYER_ID);if(!layer)return;
if(event.target?.closest?.('[data-direct-open-ios-webgpu]')){
  event.preventDefault();
  layer.querySelector('[data-settings-tab="general"]')?.click();
  const panel=layer.querySelector('[data-ios-webgpu-model]');if(panel)panel.open=true;
  panel?.scrollIntoView?.({block:'nearest'});
  return;
}
if(event.target?.closest?.('[data-direct-open-gguf]')){event.preventDefault();layer.querySelector('[data-settings-tab="general"]')?.click();layer.querySelector('[data-mobile-gguf-panel]')?.scrollIntoView?.({block:'nearest'});return}const action=event.target?.closest?.(`#${LAYER_ID} [data-cw-direct-local-action]`);if(action){event.preventDefault();event.stopImmediatePropagation();void delegateAction(action,layer);return}const tab=event.target?.closest?.(`#${LAYER_ID} [data-settings-tab="local-models"]`);if(tab)queueMicrotask(()=>{render(layer);hardGuard(layer)})}
function onSettingsOpened(){const layer=document.getElementById(LAYER_ID);if(!layer)return;updateHeader(layer);const selected=layer.querySelector('[data-settings-tab="local-models"]')?.getAttribute('aria-selected')==='true';if(selected){render(layer);hardGuard(layer)}}
document.addEventListener('click',onDocumentClick,true);
addEventListener('civweave:model-settings-opened',onSettingsOpened);
addEventListener('civweave:settings-ready',()=>queueMicrotask(onSettingsOpened));
queueMicrotask(()=>updateHeader());
globalThis.CivweaveSettingsLocalDirectV325=Object.freeze({version:VERSION,visibleSettingsVersion:'v325',buildLabel:BUILD_LABEL,render,updateHeader,delegateAction,executeAction,ensureActions,ensureGemmaRuntime,savedStateOnly:true,managerDependencyOnView:false,cacheReadOnView:false,serviceWorkerDependencyOnView:false,gpuDependencyOnView:false,inferenceDependencyOnView:false,actionModulesOnExplicitAction:true,actionsStayInPlace:true,fullRendererSwapOnAction:false,premierPhoneFinalizer:true,hardLoadingGuardMs:900});
})();