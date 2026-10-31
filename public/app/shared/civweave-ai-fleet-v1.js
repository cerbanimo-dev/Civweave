(()=>{
'use strict';
// One presentation/catalogue owner. Existing inference, download, Settings,
// privacy/consent and device-fit contracts remain the execution authorities.
const VERSION='1.1.0-three-local-backend-control';
if(globalThis.CivweaveAIFleetV1?.version===VERSION)return;
const MEMORY_KEY='civweave.ai.fleet.memory-gb.v1';
const CHOICE_KEY='civweave.ai.fleet.choices.v1';
const BINDING_KEY='civweave.ai.fleet.bindings.v1';
let inventorySequence=0;
const ROLES=Object.freeze({
 swift:{label:'Swift',purpose:'Everyday',description:'Conversation, quick help and lightweight everyday tasks.'},
 archive:{label:'Archive',purpose:'Documents',description:'Document analysis, retrieval and grounded summaries. Source retrieval remains a separate capability.'},
 forge:{label:'Forge',purpose:'Coding',description:'Code creation, review and debugging. Agent tools still require an approved execution environment.'},
 quill:{label:'Quill',purpose:'Writing',description:'Stories, publishing and polished long-form drafts.'},
 atlas:{label:'Atlas',purpose:'Reasoning',description:'Plans and complex reasoning. High-stakes actions still require their normal approval gates.'}
});
const item=(role,modelId,label,ramGB,runtime,opts={})=>Object.freeze({role,modelId,label,ramGB,runtime,...opts});
const SUITES=Object.freeze({
 ios:Object.freeze([
  item('swift','qwen35-08b-onnx-webgpu','Qwen 3.5 0.8B',2,'ios-webgpu'),
  item('archive','qwen35-2b-onnx-webgpu','Qwen 3.5 2B',4,'ios-webgpu',{experimental:true}),
  item('forge','qwen35-4b-onnx-webgpu','Qwen 3.5 4B',7,'ios-webgpu',{experimental:true,notes:'General model with coding capability; not a dedicated coder.'}),
  item('quill','qwen35-2b-onnx-webgpu','Qwen 3.5 2B',4,'ios-webgpu',{experimental:true}),
  item('atlas','qwen35-4b-onnx-webgpu','Qwen 3.5 4B',7,'ios-webgpu',{experimental:true,notes:'Small-model reasoning, not 70B-equivalent performance.'})
 ]),
 iosApi:Object.freeze([
  item('swift','qwen3.5:0.8b','Qwen 3.5 0.8B · ai.local',2,'ai-local',{notes:'Requires the installed ai.local app and a verified local endpoint.'}),
  item('archive','qwen3.5:2b','Qwen 3.5 2B · ai.local',4,'ai-local'),
  item('forge','qwen3.5:4b','Qwen 3.5 4B · ai.local',7,'ai-local'),
  item('quill','qwen3.5:4b','Qwen 3.5 4B · ai.local',7,'ai-local'),
  item('atlas','qwen3.5:4b','Qwen 3.5 4B · ai.local',7,'ai-local',{notes:'Compact reasoning rather than 70B-class reasoning.'})
 ]),
 android:Object.freeze([
  item('swift','qwen35-2b-gguf','Qwen 3.5 2B · Q4_K_M',4,'browser-gguf',{preset:'2b'}),
  item('archive','qwen35-4b-gguf','Qwen 3.5 4B · IQ2_M',6,'browser-gguf',{preset:'4b'}),
  item('forge','qwen35-4b-gguf','Qwen 3.5 4B · IQ2_M',6,'browser-gguf',{preset:'4b',notes:'General coding-capable model. Dedicated coder requires a compatible native runtime.'}),
  item('quill','qwen35-4b-gguf','Qwen 3.5 4B · IQ2_M',6,'browser-gguf',{preset:'4b'}),
  item('atlas','qwen35-4b-gguf','Qwen 3.5 4B · IQ2_M',6,'browser-gguf',{preset:'4b',notes:'Compact reasoning; large Atlas models are hidden on phones.'})
 ]),
 desktop:Object.freeze([
  item('swift','qwen3.5:4b','Qwen 3.5 4B',6,'ollama'),
  item('archive','qwen3.5:9b','Qwen 3.5 9B',11,'ollama'),
  item('forge','qwen2.5-coder:7b','Qwen 2.5 Coder 7B',8,'ollama'),
  item('quill','qwen3.5:9b','Qwen 3.5 9B',11,'ollama'),
  item('atlas','qwen3:14b','Qwen 3 14B',14,'ollama')
 ]),
 node:Object.freeze([
  item('swift','qwen3.5:9b','Qwen 3.5 9B',11,'ollama'),
  item('archive','qwen3:14b','Qwen 3 14B',15,'ollama'),
  item('forge','qwen2.5-coder:32b','Qwen 2.5 Coder 32B',27,'ollama'),
  item('quill','qwen3:32b','Qwen 3 32B',28,'ollama'),
  item('atlas','llama3.3:70b','Llama 3.3 70B',49,'ollama')
 ])
});
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const read=(key,fallback)=>{try{return parse(localStorage.getItem(key),fallback)}catch{return fallback}};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const budgetValue=value=>{const n=Number(value);return Number.isFinite(n)&&n>=2&&n<=256?n:null};
function detectDevice(){
 const ua=String(globalThis.navigator?.userAgent||'');
 const ios=/iPhone|iPad|iPod/i.test(ua)||(/Macintosh/i.test(ua)&&Number(globalThis.navigator?.maxTouchPoints||0)>1);
 const android=/Android/i.test(ua);
 const platform=ios?'ios':android?'android':'desktop';
 // deviceMemory is intentionally coarse (commonly capped at 8 GB).
 // Never infer the physical RAM of an iPhone from its user agent.
 const reported=budgetValue(globalThis.navigator?.deviceMemory);
 const override=budgetValue(read(MEMORY_KEY,null));
 const webgpuApi=Boolean(globalThis.navigator?.gpu&&typeof globalThis.navigator.gpu.requestAdapter==='function');
 const defaultBudget=ios?8:android?8:reported||8;
 const budgetGB=override||defaultBudget;
 return Object.freeze({platform,reportedGB:reported,budgetGB,webgpuApi,manual:override!==null,
  source:override!==null?'user set':reported!==null&&!ios?'browser estimate (may be capped)':'conservative default',
  note:ios?'iOS does not expose physical RAM to web pages. The 4B WebGPU model remains experimental.':
    'Browser memory reports are approximate and may be capped. Set the usable model-memory budget for accurate filtering.'});
}
function setMemoryBudget(value){
 const n=budgetValue(value);if(n===null)throw Error('Choose a budget between 2 and 256 GB.');
 localStorage.setItem(MEMORY_KEY,String(n));return n;
}
function catalogue(){
 const device=detectDevice();
 const families=device.platform==='desktop'?['desktop',...(device.budgetGB>=24?['node']:[])]:[device.platform==='ios'&&!device.webgpuApi?'iosApi':device.platform];
 return Object.freeze(families.flatMap(platform=>SUITES[platform].filter(model=>model.ramGB<=device.budgetGB).map(model=>Object.freeze({
  ...model,platform:platform==='iosApi'?'ios':platform,group:platform==='ios'?'iPhone · PWA WebGPU':platform==='iosApi'?'iPhone · ai.local (native)':platform==='android'?'Android · browser GGUF':platform==='node'?'Guild node · Ollama':'Desktop / cyberdeck · Ollama',
  name:ROLES[model.role].label,purpose:ROLES[model.role].purpose,description:ROLES[model.role].description
 }))));
}
function chosen(){return read(CHOICE_KEY,{})}
function select(role,modelId){
 if(!ROLES[role]||!catalogue().some(x=>x.role===role&&x.modelId===modelId))throw Error('This AI is not compatible with the current device/memory budget.');
 const next={...chosen(),[role]:{modelId,at:new Date().toISOString()}};
 localStorage.setItem(CHOICE_KEY,JSON.stringify(next));
 try{globalThis.dispatchEvent?.(new CustomEvent('civweave:ai-fleet-choice',{detail:{role,modelId}}))}catch{}
 return next[role];
}
function openSetup(row,layer){
 const form=layer?.querySelector?.('[data-cw-settings-form]');
 if(!form)throw Error('Shared Settings is not available.');
 // Choose a role/model without starting inference, accessing cache or sending
 // network requests. The existing Settings runtime owns activation.
 select(row.role,row.modelId);
 form.querySelector?.('[data-settings-tab="general"]')?.click?.();
 if(row.runtime==='ios-webgpu'){
  const details=form.querySelector('[data-ios-webgpu-model]');
  if(!details)throw Error('iPhone WebGPU configuration is not installed.');
  details.open=true;
  details.scrollIntoView?.({block:'nearest'});
 }else if(row.runtime==='ai-local'){
  const details=form.querySelector('[data-ios-ai-local-server]');
  if(!details)throw Error('iPhone ai.local setup is unavailable.');
  details.open=true;details.scrollIntoView?.({block:'nearest'});
 }else if(row.runtime==='browser-gguf'){
  const panel=form.querySelector('[data-mobile-gguf-panel]');
  const preset=form.elements?.namedItem?.('embeddedGGUFPreset');
  if(preset){preset.value=row.preset||'4b';preset.dispatchEvent(new Event('change',{bubbles:true}));}
  if(!panel)throw Error('Browser GGUF setup is unavailable.');
  panel.scrollIntoView?.({block:'nearest'});
 }else if(row.runtime==='ollama'){
  const route=form.elements?.namedItem?.('route');
  const model=form.elements?.namedItem?.('model');
  const endpoint=form.elements?.namedItem?.('endpoint');
  if(!route||!model||!endpoint)throw Error('Ollama settings are unavailable.');
  route.value='ollama';
  route.dispatchEvent(new Event('change',{bubbles:true}));
  model.value=row.modelId;
  endpoint.value='http://127.0.0.1:11434';
  form.querySelector('[data-panel="remote"]')?.scrollIntoView?.({block:'nearest'});
 }
 return true;
}

function matchImportedRoles(rows,installed,previous={}){
 const available=installed.filter(entry=>entry?.verified);
 const roles={};
 for(const row of rows.filter(row=>row.runtime==='browser-gguf')){
  const matches=available.filter(entry=>entry.family===row.preset);
  const prior=matches.find(entry=>entry.importId===previous.roles?.[row.role]?.importId);
  const item=prior||matches.sort((a,b)=>String(a.importedAt||'').localeCompare(String(b.importedAt||''))).at(-1);
  if(item)roles[row.role]={model:item.model,importId:item.importId,
   family:item.family,label:item.label,quantization:item.quantization,bytes:item.bytes};
 }
 return roles;
}
async function connectInstalledGGUF(layer,panel,sequence){
 const rows=catalogue().filter(row=>row.runtime==='browser-gguf');
 const message=panel.querySelector('[data-ai-fleet-message]');
 try{
  // Only manifests + OPFS shard headers are read; no engine, inference or download.
  const gguf=await import('/app/local-ai/browser-gguf-v1.js?v=embedded-gguf-v5-opfs-progress');
  const entries=await gguf.installedImports({verify:true});
  if(sequence!==inventorySequence||layer.hidden||!panel.isConnected)return;
  const previous=read(BINDING_KEY,{});
  const roles=matchImportedRoles(rows,entries,previous);
  const state={schema:'civweave.ai.fleet.bindings.v1',enabled:Object.keys(roles).length>0,
   budgetGB:detectDevice().budgetGB,platform:'android',roles};
  if(previous.schema!==state.schema||previous.enabled!==state.enabled||
   previous.budgetGB!==state.budgetGB||JSON.stringify(previous.roles||{})!==JSON.stringify(roles)){
   localStorage.setItem(BINDING_KEY,JSON.stringify({...state,updatedAt:new Date().toISOString()}));
   try{globalThis.dispatchEvent?.(new CustomEvent('civweave:ai-fleet-bound',
    {detail:{source:'verified-gguf-import',roles:Object.keys(roles)}}))}catch{}
  }
  const primary=globalThis.CivweaveSettingsV320?.readState?.()||{};
  const selected=read('civweave.mobile.gguf-primary.v2',null);
  const active=primary.route==='openai-compatible'&&
    primary.endpoint==='http://127.0.0.1:8080/v1'&&
    primary.model===selected?.model&&selected?.enabled&&selected?.engine==='wllama';
  for(const row of rows){
   const status=panel.querySelector('[data-ai-fleet-connection="'+row.role+'"]');
   const label=panel.querySelector('[data-ai-fleet-model-label="'+row.role+'"]');
   const button=panel.querySelector('[data-ai-fleet-setup="'+row.platform+':'+row.role+'"]');
   const binding=roles[row.role];
   if(binding){
    if(label)label.textContent=binding.label+' · '+binding.quantization;
    if(status)status.textContent=(active?'Linked · model load pending first use':'Installed · fleet not active')+' · '+binding.quantization+
      ' · '+Math.round(binding.bytes/1e6)+' MB';
    if(button)button.textContent='Configure role';
   }else{
    const incomplete=entries.some(entry=>entry.family===row.preset&&!entry.verified);
    if(status)status.textContent=incomplete?'Incomplete saved shards · re-import needed':'No matching GGUF installed';
   }
  }
  const count=Object.keys(roles).length;
  if(message)message.textContent=count
    ?count+' of '+rows.length+' available roles matched to '+new Set(Object.values(roles).map(entry=>entry.importId)).size+
      ' verified GGUF import(s). '+(active?'Local role routing is ready.':'Activate an imported GGUF as the shared primary under AI & safety to enable inference.')
    :entries.length?'Saved GGUF manifests exist, but shard verification failed. Re-import your existing files.':
      'No imported GGUF found in this browser profile. Reuse your existing files under AI & safety; no new download needed.';
 }catch(error){
  if(sequence===inventorySequence&&message?.isConnected)
   message.textContent='GGUF inventory check failed: '+String(error?.message||error);
 }
}


const BACKEND_KEY='civweave.ai.fleet.backend.v2';
const BACKENDS=Object.freeze({
 browser:{label:'In-browser GGUF',detail:'Wllama · WebGPU or WASM · saved GGUF shards'},
 termux:{label:'Termux server',detail:'llama.cpp · localhost 8080 · explicit server test'},
 android:{label:'Android APK backend',detail:'Native Starling bridge · installed wrapper required'}
});
const GGUF_MODULE='/app/local-ai/browser-gguf-v1.js?v=embedded-gguf-v8-prefill-observer';
const STYLE_ID='cw-ai-fleet-style-v1';
function currentBackend(){const value=read(BACKEND_KEY,'browser');return BACKENDS[value]?value:'browser'}
function setBackend(value){if(!BACKENDS[value])throw Error('Unsupported local backend.');localStorage.setItem(BACKEND_KEY,value);return value}
function style(){
 if(document.getElementById(STYLE_ID))return;
 const element=document.createElement('style');element.id=STYLE_ID;
 element.textContent='#cw-ai-fleet-v1{display:grid;gap:14px}#cw-ai-fleet-v1 .cw-fleet-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:10px}#cw-ai-fleet-v1 .cw-fleet-card{display:grid;gap:8px;border:1px solid #ffffff30;border-radius:14px;padding:12px;background:#0b1b2c}#cw-ai-fleet-v1 .cw-fleet-card h4,#cw-ai-fleet-v1 .cw-fleet-card p{margin:0}#cw-ai-fleet-v1 .cw-fleet-card p,#cw-ai-fleet-v1 .cw-fleet-meta{color:#ccd9e7;font-size:.88rem}#cw-ai-fleet-v1 .cw-fleet-choices{display:flex;gap:7px;flex-wrap:wrap}#cw-ai-fleet-v1 [data-ai-fleet-backend][aria-pressed=true]{border-color:#6ddfbd;background:#193b3a;color:white}#cw-ai-fleet-v1 select{width:100%;min-height:42px}#cw-ai-fleet-v1 button{min-height:44px}#cw-ai-fleet-v1 output{display:block;white-space:pre-wrap}#cw-ai-fleet-v1 .cw-fleet-label{font-weight:650}';
 document.head?.append(element);
}
function fleetRolesFor(entries,previous={}){
 // Preserve manual role choices whenever the exact import remains complete.
 // A later import must never make an earlier 4B or 2B disappear.
 return matchImportedRoles(catalogue().filter(row=>row.runtime==='browser-gguf'),entries,previous);
}
function saveBindings(roles){
 const state={schema:'civweave.ai.fleet.bindings.v1',enabled:Object.keys(roles).length>0,
   platform:'android',budgetGB:detectDevice().budgetGB,roles,updatedAt:new Date().toISOString()};
 localStorage.setItem(BINDING_KEY,JSON.stringify(state));
 try{globalThis.dispatchEvent?.(new CustomEvent('civweave:ai-fleet-bound',{detail:{source:'user-verified-gguf',roles:Object.keys(roles)}}))}catch{}
 return state;
}
function canUse(entry,row){return Boolean(entry?.verified&&row?.preset===entry.family)}
function importOption(entry){return esc(entry.label)+' · '+esc(entry.quantization)+' · '+Math.round(entry.bytes/1e6)+' MB'}
function renderBrowserInventory(panel,entries){
 const rows=catalogue().filter(row=>row.runtime==='browser-gguf');
 const prior=read(BINDING_KEY,{});
 const roles=fleetRolesFor(entries,prior);
 const available=entries.filter(entry=>entry.verified);
 const changed=JSON.stringify(roles)!==JSON.stringify(prior.roles||{})||prior.platform!=='android'||prior.budgetGB!==detectDevice().budgetGB;
 if(changed)saveBindings(roles);
 const state=globalThis.CivweaveSettingsV320?.readState?.()||{};
 const active=read('civweave.mobile.gguf-primary.v2',null);
 const isActive=active?.enabled&&active?.engine==='wllama'&&state.route==='openai-compatible'&&
   state.endpoint==='http://127.0.0.1:8080/v1'&&state.model===active.model;
 const list=panel.querySelector('[data-ai-fleet-inventory]');
 if(!list)return;
 const cards=entries.map(entry=>'<article class="cw-fleet-card"><h4>'+esc(entry.label)+'</h4>'+
   '<p>'+importOption(entry)+'</p><p>Shards: '+entry.sourceNames.length+' · '+(entry.verified?'Stored and verified':'Unavailable: '+esc(entry.error))+'</p>'+
   (entry.verified?'<div class="cw-fleet-choices"><button type="button" data-ai-fleet-activate="'+esc(entry.importId)+'">'+
     (active?.importId===entry.importId&&isActive?'Active primary':'Use as primary')+'</button>'+
     '<button type="button" data-ai-fleet-test="'+esc(entry.importId)+'">Run meaningful-text test</button></div>':'')+'</article>').join('');
 const selectors=rows.map(row=>{
   const matches=available.filter(entry=>canUse(entry,row));
   const existing=roles[row.role]?.importId||'';
   const opts='<option value="">Unassigned</option>'+matches.map(entry=>'<option value="'+esc(entry.importId)+'"'+(existing===entry.importId?' selected':'')+'>'+importOption(entry)+'</option>').join('');
   return '<article class="cw-fleet-card"><h4>'+esc(ROLES[row.role].label)+' · '+esc(ROLES[row.role].purpose)+'</h4>'+
     '<p>'+esc(ROLES[row.role].description)+'</p><label class="cw-fleet-label">Installed model'+
     '<select data-ai-fleet-role-assign="'+esc(row.role)+'"'+(matches.length?'':' disabled')+'>'+opts+'</select></label>'+
     '<p>'+(!matches.length?'No verified '+esc(row.preset.toUpperCase())+' import at this memory tier':isActive?'Role binding available for browser inference':'Model is installed; activate a primary GGUF to route chat')+'</p></article>';
 }).join('');
 list.innerHTML='<h4>Saved GGUF models · '+entries.length+'</h4>'+
   '<div class="cw-fleet-grid">'+(cards||'<p>No saved GGUF manifests found in this browser profile.</p>')+'</div>'+
   '<h4>Fleet role assignments</h4><div class="cw-fleet-grid">'+selectors+'</div>';
 const msg=panel.querySelector('[data-ai-fleet-message]');
 if(msg)msg.textContent=(available.length?available.length+' complete GGUF model(s) found. ':'No complete imported GGUF found. ')+
   Object.keys(roles).length+' of '+rows.length+' compatible roles linked. '+
   (isActive?'Browser inference is configured.':'Role links are saved, but browser inference is not the active model route.');
}
async function refreshInventory(layer,panel,sequence){
 const msg=panel.querySelector('[data-ai-fleet-message]');
 try{
   const gguf=await import(GGUF_MODULE);
   const entries=await gguf.installedImports({verify:true});
   if(sequence!==inventorySequence||!panel.isConnected||layer.hidden||currentBackend()!=='browser')return;
   renderBrowserInventory(panel,entries);
 }catch(error){if(sequence===inventorySequence&&msg?.isConnected)msg.textContent='GGUF inventory failed: '+String(error?.message||error)}
}
function configurationTab(layer,selector){
 const form=layer.querySelector('[data-cw-settings-form]');
 form?.querySelector('[data-settings-tab="general"]')?.click?.();
 const details=form?.querySelector(selector);
 if(details){details.open=true;details.scrollIntoView?.({block:'nearest'})}
 return Boolean(details);
}
async function activateSavedImport(layer,panel,id){
 const status=panel.querySelector('[data-ai-fleet-message]');
 const gguf=await import(GGUF_MODULE),installed=await gguf.installedImports({verify:true});
 const record=installed.find(item=>item.importId===id&&item.verified);
 if(!record)throw Error('Imported model is missing or its shards could not be verified. Nothing was activated.');
 const selected=await gguf.activateImported(id);
 // Use the canonical Settings form submit owner, not a second localStorage model-profile writer.
 const form=layer.querySelector('[data-cw-settings-form]');
 const route=form?.elements?.namedItem?.('route'),model=form?.elements?.namedItem?.('model'),endpoint=form?.elements?.namedItem?.('endpoint');
 if(!route||!model||!endpoint||typeof form.requestSubmit!=='function')throw Error('Settings form unavailable; GGUF preference saved but the shared route was not changed.');
 route.value='openai-compatible';model.value=selected.model;endpoint.value='http://127.0.0.1:8080/v1';
 const consent=form.elements.namedItem('consent');if(consent)consent.checked=false;
 form.requestSubmit();
 const state=globalThis.CivweaveSettingsV320?.readState?.();
 if(state?.model!==selected.model||state?.endpoint!=='http://127.0.0.1:8080/v1')
   throw Error('Shared Settings did not confirm activation. Open the General tab and save this GGUF route.');
 if(status)status.textContent='Activated '+record.label+'; other verified imports remain available for fleet roles.';
 await refreshInventory(layer,panel,++inventorySequence);
}
async function testSavedImport(panel,id){
 const status=panel.querySelector('[data-ai-fleet-message]');
 const gguf=await import(GGUF_MODULE),entries=await gguf.installedImports({verify:true});
 const entry=entries.find(item=>item.importId===id&&item.verified);
 if(!entry)throw Error('Cannot test an incomplete imported GGUF.');
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),720000);
 try{
   if(status)status.textContent='Testing '+entry.label+' with a short, deterministic text prompt. This may take several minutes on WASM/CPU.';
   const result=await gguf.generate({model:entry.model,importId:entry.importId,structured:false,temperature:0,maxTokens:24,
     messages:[{role:'user',content:'Reply with exactly READY and nothing else.'}],signal:controller.signal,
     onPhase:(stage,detail)=>{if(status)status.textContent='GGUF '+stage+(detail?.processed!==undefined?' · prompt '+detail.processed+'/'+detail.total:'')},
   });
   const answer=String(result.text||'').trim().replace(/[.!]+$/,'').toUpperCase();
   if(answer!=='READY')throw Error('The model emitted "'+String(result.text||'').trim().slice(0,130)+'" rather than READY. Inference ran but the answer is invalid; do not mark this model healthy.');
   if(status)status.textContent='PASS · '+entry.label+' · verified READY · meaningful output. Role assignments were not changed.';
 }finally{clearTimeout(timer)}
}
function render(layer){
 const form=layer?.querySelector?.('[data-cw-settings-form]');
 const target=form?.querySelector?.('[data-settings-tab-panel="local-models"]');
 if(!target||!layer?.isConnected||layer.hidden)return false;
 style();
 let panel=target.querySelector('#cw-ai-fleet-v1');
 if(!panel){target.replaceChildren();panel=document.createElement('section');panel.id='cw-ai-fleet-v1';panel.className='cw-clean-panel';target.append(panel)}
 for(const child of [...target.children])if(child!==panel)child.remove();
 const backend=currentBackend(),device=detectDevice();
 const buttons=Object.entries(BACKENDS).map(([key,value])=>'<button type="button" data-ai-fleet-backend="'+key+
   '" aria-pressed="'+(key===backend)+'">'+esc(value.label)+'</button>').join('');
 const memoryOptions=[4,6,8,12,16,24,32,48,64,96,128].map(n=>'<option value="'+n+'"'+(device.budgetGB===n?' selected':'')+'>'+n+' GB</option>').join('');
 const header='<h3>Local AI · Fleet & model configuration</h3><p>Three supported configuration paths; changing views never loads, downloads or switches a model.</p>'+
  '<div class="cw-fleet-choices" role="group" aria-label="Local inference backend">'+buttons+'</div>';
 let body='';
 if(backend==='browser')body='<p>In-browser GGUF · Wllama using WebGPU when available, otherwise CPU/WASM. Qwen 3.5 2B and 4B imports stay separate; the same weights can serve several roles.</p>'+
   '<label>Usable model-memory budget <select data-ai-fleet-memory>'+memoryOptions+'</select></label>'+
   '<p class="cw-fleet-meta">Device: '+esc(device.platform)+' · '+esc(device.source)+'. Shards are verified in browser-private storage; a successful import is not proof of useful generation.</p>'+
   '<button type="button" data-ai-fleet-open-gguf>Import additional GGUF / inspect storage</button>'+
   '<div data-ai-fleet-inventory><p>Reading saved GGUF manifests…</p></div>';
 else if(backend==='termux'){
   const active=globalThis.CivweaveSettingsV320?.readState?.()||{};
   const selected=active.route==='openai-compatible'&&active.endpoint==='http://127.0.0.1:8080/v1'&&active.model==='qwen35-4b-native';
   body='<h4>Termux · llama.cpp</h4><p>Use the real model installed in Termux with an OpenAI-compatible localhost API. Check /v1/models and generate a meaningful response before activating. No server requests are made by merely opening this tab.</p>'+
     '<p>Status: '+(selected?'Native Qwen 4B route selected; live server health has NOT been checked.':'Not currently selected as the shared native route.')+'</p>'+
     '<div class="cw-fleet-choices"><button type="button" data-ai-fleet-open-termux>Open Termux setup & verified activation</button>'+
     '<a href="/native-server-diagnostic.html" target="_blank" rel="noopener noreferrer">Native server diagnostic</a></div>'+
     '<p class="cw-fleet-meta">The server model alias, GGUF path, context size and generation parameters belong to the Termux llama-server. The browser model index does not describe files inside Termux.</p>';
 }else{
   const native=Boolean(globalThis.CivweaveStarlingNative&&typeof globalThis.CivweaveStarlingNative.postMessage==='function');
   body='<h4>Android APK · native execution host</h4><p>'+ (native?'An Android Starling bridge is present.':'No compatible Android Starling bridge detected in this session.')+
     ' The APK bridge currently supports bounded Starling draft jobs through WorkManager. It is not a drop-in replacement for main-chat GGUF inference; the APK needs its own packaged inference engine or running loopback llama.cpp service.</p>'+
     '<button type="button" data-ai-fleet-open-starling>Open Starling host controls</button>'+
     '<p class="cw-fleet-meta">Native host connection is opt-in; merely selecting this view never schedules a job.</p>';
 }
 panel.innerHTML=header+body+'<output data-ai-fleet-message role="status" aria-live="polite">No inference started.</output>';
 if(panel.dataset.fleetBound!=='1'){
   panel.dataset.fleetBound='1';
   panel.addEventListener('change',event=>{
     const el=event.target;
     if(el?.matches?.('[data-ai-fleet-memory]')){
       try{setMemoryBudget(el.value);render(layer)}catch(error){panel.querySelector('[data-ai-fleet-message]').textContent=String(error.message)}return;
     }
     const role=el?.dataset?.aiFleetRoleAssign;
     if(role){void (async()=>{
       const gguf=await import(GGUF_MODULE),entries=await gguf.installedImports({verify:true});
       const rows=catalogue().filter(row=>row.runtime==='browser-gguf');
       const row=rows.find(item=>item.role===role);
       const selected=entries.find(item=>item.importId===el.value&&canUse(item,row));
       if(el.value&&!selected)throw Error('That GGUF import is incomplete or incompatible with this role.');
       const previous=read(BINDING_KEY,{});
       const roles={...fleetRolesFor(entries,previous)};
       if(selected)roles[role]={model:selected.model,importId:selected.importId,family:selected.family,label:selected.label,
         quantization:selected.quantization,bytes:selected.bytes};
       else delete roles[role];
       // Preserve explicit unassignment instead of silently restoring an auto match.
       saveBindings(roles);
       panel.querySelector('[data-ai-fleet-message]').textContent=ROLES[role].label+' assignment saved; no model was loaded.';
     })().catch(error=>{panel.querySelector('[data-ai-fleet-message]').textContent=String(error.message)})}
   });
   panel.addEventListener('click',event=>{
     const el=event.target.closest?.('button');if(!el)return;
     const backendChoice=el.dataset.aiFleetBackend;
     if(backendChoice){setBackend(backendChoice);render(layer);return}
     if(el.hasAttribute('data-ai-fleet-open-gguf')){configurationTab(layer,'[data-mobile-gguf-panel]');return}
     if(el.hasAttribute('data-ai-fleet-open-termux')){configurationTab(layer,'[data-native-gguf-server]');return}
     if(el.hasAttribute('data-ai-fleet-open-starling')){globalThis.CivweaveStarlingLoungeV1?.open?.();return}
     const activate=el.dataset.aiFleetActivate,test=el.dataset.aiFleetTest;
     if(activate||test){
       el.disabled=true;
       const work=activate?activateSavedImport(layer,panel,activate):testSavedImport(panel,test);
       void work.catch(error=>{const msg=panel.querySelector('[data-ai-fleet-message]');if(msg)msg.textContent=String(error?.message||error)})
         .finally(()=>{el.disabled=false});
     }
   });
 }
 target.dataset.aiFleetOwner='v1';
 if(backend==='browser')void refreshInventory(layer,panel,++inventorySequence);
 else inventorySequence++;
 return true;
}
globalThis.CivweaveAIFleetV1=Object.freeze({version:VERSION,detectDevice,setMemoryBudget,catalogue,roles:ROLES,suites:SUITES,chosen,select,openSetup,matchImportedRoles,render,currentBackend,setBackend,fleetRolesFor,saveBindings});
})();