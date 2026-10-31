(()=>{
'use strict';
// One presentation/catalogue owner. Existing inference, download, Settings,
// privacy/consent and device-fit contracts remain the execution authorities.
const VERSION='1.3.1-browser-uninstall-inference-health';
if(globalThis.CivweaveAIFleetV1?.version===VERSION)return;
const MEMORY_KEY='civweave.ai.fleet.memory-gb.v1';
const CHOICE_KEY='civweave.ai.fleet.choices.v1';
const BINDING_KEY='civweave.ai.fleet.bindings.v1';
const HEALTH_KEY='civweave.ai.fleet.gguf-health.v1';
function testHealth(id){return read(HEALTH_KEY,{})[id]||null}
function recordTestHealth(id,passed,detail=''){
 const old=read(HEALTH_KEY,{});
 localStorage.setItem(HEALTH_KEY,JSON.stringify({...old,[id]:{
  passed:Boolean(passed),detail:String(detail).slice(0,180),testedAt:new Date().toISOString()
 }}));
}
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
  const gguf=await import('/app/local-ai/browser-gguf-v1.js?v=embedded-gguf-v9-direct-fleet-install');
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
const GGUF_MODULE='/app/local-ai/browser-gguf-v1.js?v=embedded-gguf-v9-direct-fleet-install';
const STYLE_ID='cw-ai-fleet-style-v2';
function currentBackend(){const value=read(BACKEND_KEY,'browser');return BACKENDS[value]?value:'browser'}
function setBackend(value){if(!BACKENDS[value])throw Error('Unsupported local backend.');localStorage.setItem(BACKEND_KEY,value);return value}
function style(){
 if(document.getElementById(STYLE_ID))return;
 const element=document.createElement('style');element.id=STYLE_ID;
 element.textContent='#cw-ai-fleet-v1 .cw-fleet-scope-nav{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}#cw-ai-fleet-v1 .cw-fleet-scope-nav button{border-radius:10px;text-align:left;border:1px solid #95c9bc7b;background:#192d38;color:#e7f3ea}#cw-ai-fleet-v1 .cw-fleet-scope-nav button[aria-pressed=true]{border:2px solid #b1ead4;background:#305f55}#cw-ai-fleet-v1{display:grid;gap:14px}#cw-ai-fleet-v1 .cw-fleet-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:10px}#cw-ai-fleet-v1 .cw-fleet-card{display:grid;gap:8px;border:1px solid #ffffff30;border-radius:14px;padding:12px;background:#0b1b2c}#cw-ai-fleet-v1 .cw-fleet-card h4,#cw-ai-fleet-v1 .cw-fleet-card p{margin:0}#cw-ai-fleet-v1 .cw-fleet-card p,#cw-ai-fleet-v1 .cw-fleet-meta{color:#ccd9e7;font-size:.88rem}#cw-ai-fleet-v1 .cw-fleet-choices{display:flex;gap:7px;flex-wrap:wrap}#cw-ai-fleet-v1 [data-ai-fleet-backend][aria-pressed=true]{border-color:#6ddfbd;background:#193b3a;color:white}#cw-ai-fleet-v1 select{width:100%;min-height:42px}#cw-ai-fleet-v1 button{min-height:44px}#cw-ai-fleet-v1 output{display:block;white-space:pre-wrap}#cw-ai-fleet-v1 .cw-fleet-label{font-weight:650}';
 document.head?.append(element);
}
function canUse(entry,row){
 const required=entry?.family==='4b'?6:entry?.family==='2b'?4:Infinity;
 return Boolean(entry?.verified&&row&&required<=detectDevice().budgetGB);
}
function fleetRolesFor(entries,previous={}){
 const rows=Object.keys(ROLES).map(role=>({role}));
 const available=entries.filter(entry=>canUse(entry,rows[0]));
 const assignments={};
 for(const row of rows){
   if((previous.unassigned||[]).includes(row.role))continue;
   const last=available.find(entry=>entry.importId===previous.roles?.[row.role]?.importId);
   const best=last||available.find(entry=>entry.family===(row.role==='swift'?'2b':'4b'))||available[0];
   if(best)assignments[row.role]={model:best.model,importId:best.importId,family:best.family,
     label:best.label,quantization:best.quantization,bytes:best.bytes};
 }
 return assignments;
}
function saveBindings(roles,unassigned=[]){
 const state={schema:'civweave.ai.fleet.bindings.v1',enabled:Object.keys(roles).length>0,
   platform:'android',budgetGB:detectDevice().budgetGB,roles,unassigned,updatedAt:new Date().toISOString()};
 localStorage.setItem(BINDING_KEY,JSON.stringify(state));
 try{globalThis.dispatchEvent?.(new CustomEvent('civweave:ai-fleet-bound',{detail:{source:'user-verified-gguf',roles:Object.keys(roles)}}))}catch{}
 return state;
}
function importOption(entry){return esc(entry.label)+' · '+esc(entry.quantization)+' · '+Math.round(entry.bytes/1e6)+' MB'}
function renderBrowserInventory(panel,entries){
 const rows=Object.keys(ROLES).map(role=>({role}));
 const prior=read(BINDING_KEY,{});
 const roles=fleetRolesFor(entries,prior);
 const available=entries.filter(entry=>entry.verified);
 const changed=JSON.stringify(roles)!==JSON.stringify(prior.roles||{})||prior.platform!=='android'||prior.budgetGB!==detectDevice().budgetGB;
 if(changed)saveBindings(roles,prior.unassigned||[]);
 const state=globalThis.CivweaveSettingsV320?.readState?.()||{};
 const active=read('civweave.mobile.gguf-primary.v2',null);
 const isActive=active?.enabled&&active?.engine==='wllama'&&state.route==='openai-compatible'&&
   state.endpoint==='http://127.0.0.1:8080/v1'&&state.model===active.model;
 const list=panel.querySelector('[data-ai-fleet-inventory]');
 if(!list)return;
 const cards=entries.map(entry=>'<article class="cw-fleet-card"><h4>'+esc(entry.label)+'</h4>'+
   '<p>Text inference: '+esc(!entry.verified?'Unavailable':testHealth(entry.importId)?.passed===true?'PASS · meaningful-text test':testHealth(entry.importId)?.passed===false?'FAILED · '+testHealth(entry.importId).detail:'Not tested · storage verification only')+'</p>'+
   '<p>'+importOption(entry)+'</p><p>Shards: '+entry.sourceNames.length+' · '+(entry.verified?'Stored and verified':'Unavailable: '+esc(entry.error))+'</p>'+
   (entry.verified?'<div class="cw-fleet-choices"><button type="button" data-ai-fleet-activate="'+esc(entry.importId)+'">'+
     (active?.importId===entry.importId&&isActive?'Active primary':'Use as primary')+'</button>'+
     '<button type="button" data-ai-fleet-test="'+esc(entry.importId)+'">Run meaningful-text test</button></div>':'')+
   '<div class="cw-fleet-choices"><button type="button" data-ai-fleet-uninstall="'+esc(entry.importId)+'" aria-label="Uninstall '+esc(entry.label)+' browser copy">Uninstall model</button></div></article>').join('');
 const selectors=rows.map(row=>{
   const matches=available.filter(entry=>canUse(entry,row));
   const existing=roles[row.role]?.importId||'';
   const opts='<option value="">Unassigned</option>'+matches.map(entry=>'<option value="'+esc(entry.importId)+'"'+(existing===entry.importId?' selected':'')+'>'+importOption(entry)+'</option>').join('');
   return '<article class="cw-fleet-card"><h4>'+esc(ROLES[row.role].label)+' · '+esc(ROLES[row.role].purpose)+'</h4>'+
     '<p>'+esc(ROLES[row.role].description)+'</p><label class="cw-fleet-label">Installed model'+
     '<select data-ai-fleet-role-assign="'+esc(row.role)+'"'+(matches.length?'':' disabled')+'>'+opts+'</select></label>'+
     '<p>'+(!matches.length?'No GGUF import verified within your RAM budget':!existing?'No model assigned':testHealth(existing)?.passed===true?(isActive?'Text test passed · browser route configured':'Text test passed · activate a primary for chat'):'Model assigned · meaningful-text test not passed')+'</p></article>';
 }).join('');
 list.innerHTML='<h4>Saved GGUF models · '+entries.length+'</h4>'+
   '<div class="cw-fleet-grid">'+(cards||'<p>No saved GGUF manifests found in this browser profile.</p>')+'</div>'+
   '<h4>Fleet role assignments</h4><div class="cw-fleet-grid">'+selectors+'</div>';
 const msg=panel.querySelector('[data-ai-fleet-message]');
 if(msg)msg.textContent=(available.length?available.length+' complete GGUF model(s) found. ':'No complete imported GGUF found. ')+
   Object.keys(roles).length+' of '+rows.length+' compatible roles linked. '+
   (isActive?'Browser route configured; only imports passing a text test are verified for generation.':'Role links are saved, but browser inference is not the active model route.');
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
// All configuration actions live in this Fleet view. The canonical Settings
// form remains the sole writer of shared inference configuration.
function activateSharedRoute(layer,{model,endpoint}){
 const form=layer?.querySelector?.('[data-cw-settings-form]');
 const route=form?.elements?.namedItem?.('route');
 const modelInput=form?.elements?.namedItem?.('model');
 const endpointInput=form?.elements?.namedItem?.('endpoint');
 if(!route||!modelInput||!endpointInput||typeof form.requestSubmit!=='function')
   throw Error('The shared Settings route cannot be saved from this session.');
 route.value='openai-compatible';modelInput.value=model;endpointInput.value=endpoint;
 const consent=form.elements.namedItem('consent');if(consent)consent.checked=false;
 form.requestSubmit();
 const state=globalThis.CivweaveSettingsV320?.readState?.();
 if(state?.model!==model||state?.endpoint!==endpoint||state.route!=='openai-compatible')
   throw Error('The canonical AI route was not confirmed. Your installed models are unchanged.');
 return state;
}
let activeImport=null;
async function installChosenGGUF(layer,panel){
 const picker=panel.querySelector('[data-ai-fleet-gguf-files]');
 const button=panel.querySelector('[data-ai-fleet-import]');
 const cancel=panel.querySelector('[data-ai-fleet-import-cancel]');
 const status=panel.querySelector('[data-ai-fleet-import-status]');
 const files=Array.from(picker?.files||[]);
 if(!files.length)throw Error('Select a GGUF file or every split shard of one model using the file picker.');
 if(activeImport)throw Error('Another GGUF import is already in progress.');
 const controller=new AbortController();
 activeImport=controller;button.disabled=true;cancel.hidden=false;cancel.disabled=false;
 try{
   const gguf=await import(GGUF_MODULE);
   const record=await gguf.importFiles(files,{signal:controller.signal,onProgress:part=>{
     if(!status?.isConnected)return;
     const pct=part.total?Math.round(100*part.loaded/part.total):0;
     status.textContent='Import '+pct+'% · '+(part.phase||'working')+
       (part.count?' · shard '+part.index+'/'+part.count:'')+
       ' · '+Math.round(part.loaded/1e6)+' / '+Math.round(part.total/1e6)+' MB';
   }});
   picker.value='';
   if(status)status.textContent='Saved '+record.label+' ('+record.files.length+' shard(s)). Your other imported models remain installed. Choose role assignments below.';
   await refreshInventory(layer,panel,++inventorySequence);
 }catch(error){if(status)status.textContent='Import not completed: '+String(error?.message||error)}
 finally{if(activeImport===controller)activeImport=null;button.disabled=false;cancel.hidden=true;cancel.disabled=true;}
}
async function downloadFleetPreset(layer,panel,presetId){
 if(activeImport)throw Error('Another GGUF import or download is running.');
 const status=panel.querySelector('[data-ai-fleet-import-status]');
 const cancel=panel.querySelector('[data-ai-fleet-import-cancel]');
 const controller=new AbortController();
 activeImport=controller;cancel.hidden=false;cancel.disabled=false;
 try{
   const gguf=await import(GGUF_MODULE);
   const preset=gguf.GGUF_PRESETS.find(p=>p.id===presetId);
   if(!preset)throw Error('Choose an approved Qwen 3.5 GGUF preset.');
   if(typeof globalThis.confirm==='function'&&!globalThis.confirm('Download '+preset.label+' to this device? It uses about '+preset.sizeHint+' of storage and network data.'))return;
   if(status)status.textContent='Downloading '+preset.label+' directly into saved GGUF storage…';
   const result=await gguf.installPresetIntoImports(presetId,{signal:controller.signal,onProgress:part=>{
     if(!status?.isConnected)return;
     status.textContent='Installing '+preset.label+' · '+Math.round(part.loaded/1e6)+' MB'+
       (part.total?' / '+Math.round(part.total/1e6)+' MB ('+Math.round(part.loaded/part.total*100)+'%)':'')+'.';
   }});
   if(status)status.textContent='Installed '+result.label+'. Choose a fleet role and test generation below.';
   await refreshInventory(layer,panel,++inventorySequence);
 }catch(error){if(status)status.textContent='Download not completed: '+String(error?.message||error)}
 finally{if(activeImport===controller)activeImport=null;cancel.hidden=true;cancel.disabled=true;}
}
async function mountTermuxInline(layer,panel){
 const target=panel.querySelector('[data-ai-fleet-termux-mount]');
 if(!target||target.dataset.nativeServerMounted==='1')return;
 try{
   const native=await import('/app/local-ai/native-gguf-server-setup-v1.js?v=inline-fleet-2b-4b-v1');
   if(!target.isConnected||currentBackend()!=='termux')return;
   native.mountNativeServerSetup(target,{activate:async({model,endpoint})=>{
     activateSharedRoute(layer,{model,endpoint});
     const summary=panel.querySelector('[data-ai-fleet-message]');
     if(summary)summary.textContent='Termux '+model+' activated as the shared local route for Civweave. Other GGUF browser imports are preserved.';
   }});
 }catch(error){if(target.isConnected)target.textContent='Termux setup failed to load: '+String(error?.message||error)}
}
async function checkNativeHost(panel){
 const output=panel.querySelector('[data-ai-fleet-apk-status]');
 const port=globalThis.CivweaveStarlingNative;
 if(typeof port?.postMessage!=='function')throw Error('No trusted Android APK bridge is installed. The PWA cannot launch native WorkManager jobs by itself.');
 const {createStarlingHostTransport}=await import('/app/shared/starling-execution-transport-v1.mjs');
 const host=createStarlingHostTransport({kind:'android',nativePort:port});
 const snapshot=await host.status();
 if(snapshot?.backend!=='android'||snapshot?.mode!=='local-only')
   throw Error('The APK responded, but did not identify a compatible local-only Starling backend.');
 if(output)output.textContent='Connected Android host · '+Number(snapshot.jobs||0)+' local jobs. Native draft execution is available; main-chat inference requires the APK to supply a model engine.';
}
async function activateSavedImport(layer,panel,id){
 const status=panel.querySelector('[data-ai-fleet-message]');
 const gguf=await import(GGUF_MODULE),installed=await gguf.installedImports({verify:true});
 const record=installed.find(item=>item.importId===id&&item.verified);
 if(!record)throw Error('Imported model is missing or its shards could not be verified. Nothing was activated.');
 const selected=await gguf.activateImported(id);
 activateSharedRoute(layer,{model:selected.model,endpoint:'http://127.0.0.1:8080/v1'});
 if(status)status.textContent='Activated '+record.label+'; other verified imports remain available for fleet roles.';
 await refreshInventory(layer,panel,++inventorySequence);
}
async function uninstallSavedImport(layer,panel,id){
 if(activeImport)throw Error('Finish or cancel the current model installation first.');
 const gguf=await import(GGUF_MODULE),entries=await gguf.installedImports({verify:false});
 const entry=entries.find(row=>row.importId===id);
 if(!entry)throw Error('The saved import no longer exists.');
 if(typeof globalThis.confirm==='function'&&!globalThis.confirm(
  'Uninstall '+entry.label+' ('+Math.round(entry.bytes/1e6)+' MB) from Civweave browser storage? This removes only this saved copy; your original GGUF in Downloads is untouched.'))return;
 const result=await gguf.removeImported(id);
 const health=read(HEALTH_KEY,{});delete health[id];localStorage.setItem(HEALTH_KEY,JSON.stringify(health));
 // A missing primary must not fall through to a localhost HTTP request.
 if(result.wasSelected){
  const form=layer?.querySelector?.('[data-cw-settings-form]');
  const route=form?.elements?.namedItem?.('route');
  if(route){route.value='deterministic';route.dispatchEvent(new Event('change',{bubbles:true}));form.requestSubmit();}
 }
 await refreshInventory(layer,panel,++inventorySequence);
 const msg=panel.querySelector('[data-ai-fleet-message]');
 if(msg)msg.textContent='Uninstalled one saved '+entry.label+' copy ('+Math.round(entry.bytes/1e6)+' MB). Original Downloads file unchanged.'+
  (result.wasSelected?' Primary switched to offline rules; select and test another model to reactivate AI.':' Remaining role bindings were refreshed.');
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
   recordTestHealth(id,true,'Verified READY');
   renderBrowserInventory(panel,entries);
   if(status)status.textContent='PASS · '+entry.label+' · verified READY · meaningful output. Role assignments were not changed.';
 }catch(error){
   recordTestHealth(id,false,String(error?.message||error));
   renderBrowserInventory(panel,entries);
   throw error;
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
 const header='<h3>AI Fleet</h3><div class="cw-fleet-scope-nav" role="group" aria-label="Fleet scope"><button type="button" data-ai-fleet-local aria-pressed="true">Local Fleet · this device</button><button type="button" data-ai-fleet-guild>Guild Fleet · shared Worldweaver</button></div><p>Install models and assign private roles here. Guild Fleet uses signed Guild pilots and authorized Worldweaver rooms; local model files are never automatically shared.</p>'+
  '<div class="cw-fleet-choices" role="group" aria-label="Local inference backend">'+buttons+'</div>';
 let body='';
 if(backend==='browser')body='<p>Install and assign the models on this phone. Keep 2B and 4B as separate imports; they can share the five fleet roles without duplicating weights.</p>'+
   '<label>Usable model-memory budget <select data-ai-fleet-memory>'+memoryOptions+'</select></label>'+
   '<p class="cw-fleet-meta">Device: '+esc(device.platform)+' · '+esc(device.source)+'. Model files remain in your device browser storage. A complete file import is not a passing inference test.</p>'+
   '<section class="cw-fleet-card" data-ai-fleet-install><h4>1 · Install a model</h4>'+
   '<p>Select an existing Qwen 3.5 2B or 4B GGUF, or all split parts of that model together. Importing does not erase previously installed GGUFs.</p>'+
   '<label>Model file(s) <input type="file" accept=".gguf" multiple data-ai-fleet-gguf-files></label>'+
   '<p><strong>Download a compatible model directly</strong></p>'+
   '<div class="cw-fleet-choices"><button type="button" data-ai-fleet-download-preset="qwen35-2b-q4km-gguf">Install 2B Q4_K_M · ~1.3 GB</button>'+
   '<button type="button" data-ai-fleet-download-preset="qwen35-4b-iq2m-gguf">Install 4B IQ2_M · ~1.6 GB</button></div>'+
   '<p class="cw-fleet-meta">The downloadable 4B is a smaller, lower-fidelity quantization. To keep your original 4B Q4_K_M weights, choose its local GGUF/shards above.</p>'+
   '<div class="cw-fleet-choices"><button type="button" data-ai-fleet-import>Import selected GGUF and shards</button>'+
   '<button type="button" data-ai-fleet-import-cancel hidden disabled>Cancel import</button>'+
   '<button type="button" data-ai-fleet-rescan>Refresh installed models</button></div>'+
   '<output data-ai-fleet-import-status aria-live="polite">Choose files to begin. Files over 2 GB are automatically split where supported.</output></section>'+
   '<section><h4>2 · Assign fleet roles, test and activate</h4>'+
   '<div data-ai-fleet-inventory><p>Checking the saved GGUF model list…</p></div></section>';
 else if(backend==='termux'){
   body='<h4>Termux · native llama.cpp</h4><p>Configure, pair, install, start, test and activate your native server here. Commands that require Termux remain copyable; when paired, the Companion can manage the server from this panel.</p>'+
     '<div data-ai-fleet-termux-mount><p>Loading native Termux setup controls…</p></div>';
 }else{
   const native=Boolean(globalThis.CivweaveStarlingNative&&typeof globalThis.CivweaveStarlingNative.postMessage==='function');
   body='<h4>Android APK · native backend</h4>'+
     '<p>Bridge: '+(native?'Detected in this installed Android shell.':'Unavailable in this PWA/browser session.')+'</p>'+
     '<p>The currently installed APK bridge can manage local Starling drafts and WorkManager jobs. It does not yet install GGUF weights or replace the main Civweave chat engine. An Android APK containing the trusted native bridge is required.</p>'+
     '<div class="cw-fleet-choices"><button type="button" data-ai-fleet-apk-connect'+(native?'':' disabled')+'>Test native bridge</button></div>'+
     '<output data-ai-fleet-apk-status role="status">Native inference is not active until a compatible APK engine and model are installed.</output>';
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
       const row=ROLES[role]?{role}:null;
       const selected=entries.find(item=>item.importId===el.value&&canUse(item,row));
       if(el.value&&!selected)throw Error('That GGUF import is incomplete or incompatible with this role.');
       const previous=read(BINDING_KEY,{});
       const roles={...fleetRolesFor(entries,previous)};
       if(selected)roles[role]={model:selected.model,importId:selected.importId,family:selected.family,label:selected.label,
         quantization:selected.quantization,bytes:selected.bytes};
       else delete roles[role];
       // Preserve explicit unassignment instead of silently restoring an auto match.
       const unassigned=(previous.unassigned||[]).filter(item=>item!==role);
       if(!selected)unassigned.push(role);
       saveBindings(roles,unassigned);
       panel.querySelector('[data-ai-fleet-message]').textContent=ROLES[role].label+' assignment saved; no model was loaded.';
     })().catch(error=>{panel.querySelector('[data-ai-fleet-message]').textContent=String(error.message)})}
   });
   panel.addEventListener('click',event=>{
     const el=event.target.closest?.('button');if(!el)return;
     if(el.hasAttribute('data-ai-fleet-guild')){
       const api=globalThis.CivweaveStarlingIntegrationV1;
       if(typeof api?.open!=='function'){
         panel.querySelector('[data-ai-fleet-message]').textContent='Open a Guild in Civweave to access its signed Worldweaver fleet.';
         return;
       }
       el.disabled=true;
       void Promise.resolve(api.open()).then(()=>{
         const lounge=globalThis.CivweaveStarlingLoungeV1;
         if(!lounge?.setFleetScope?.('guild'))throw new Error('Connect to a Guild to access its Fleet. Local models remain private.');
         globalThis.CivweaveSettingsV320?.close?.();
       }).catch(error=>{
         const status=panel.querySelector('[data-ai-fleet-message]');
         if(status)status.textContent=String(error?.message||error);
       }).finally(()=>{el.disabled=false});
       return;
     }
     const backendChoice=el.dataset.aiFleetBackend;
     if(backendChoice){if(activeImport)activeImport.abort();setBackend(backendChoice);render(layer);return}
     const presetId=el.dataset.aiFleetDownloadPreset;
     if(presetId){
       el.disabled=true;void downloadFleetPreset(layer,panel,presetId)
         .catch(error=>{const out=panel.querySelector('[data-ai-fleet-import-status]');if(out)out.textContent=String(error?.message||error)})
         .finally(()=>{el.disabled=false});return;
     }
     if(el.hasAttribute('data-ai-fleet-import-cancel')){activeImport?.abort();return}
     if(el.hasAttribute('data-ai-fleet-apk-connect')){
       el.disabled=true;void checkNativeHost(panel).catch(error=>{const out=panel.querySelector('[data-ai-fleet-apk-status]');if(out)out.textContent=String(error?.message||error)}).finally(()=>{el.disabled=false});return;
     }
     if(el.hasAttribute('data-ai-fleet-rescan')){void refreshInventory(layer,panel,++inventorySequence);return}
     if(el.hasAttribute('data-ai-fleet-import')){
       el.disabled=true;void installChosenGGUF(layer,panel).catch(error=>{const out=panel.querySelector('[data-ai-fleet-import-status]');if(out)out.textContent=String(error?.message||error)}).finally(()=>{if(!activeImport)el.disabled=false});return;
     }
     const activate=el.dataset.aiFleetActivate,test=el.dataset.aiFleetTest,uninstall=el.dataset.aiFleetUninstall;
     if(activate||test||uninstall){
       el.disabled=true;
       const work=activate?activateSavedImport(layer,panel,activate):test?testSavedImport(panel,test):uninstallSavedImport(layer,panel,uninstall);
       void work.catch(error=>{const msg=panel.querySelector('[data-ai-fleet-message]');if(msg)msg.textContent=String(error?.message||error)})
         .finally(()=>{el.disabled=false});
     }
   });
 }
 target.dataset.aiFleetOwner='v1';
 if(backend==='browser')void refreshInventory(layer,panel,++inventorySequence);
 else{inventorySequence++;if(backend==='termux')void mountTermuxInline(layer,panel)}
 return true;
}
globalThis.CivweaveAIFleetV1=Object.freeze({version:VERSION,detectDevice,setMemoryBudget,catalogue,roles:ROLES,suites:SUITES,chosen,select,openSetup,matchImportedRoles,render,currentBackend,setBackend,fleetRolesFor,saveBindings});
})();