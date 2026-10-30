(()=>{
'use strict';
// One presentation/catalogue owner. Existing inference, download, Settings,
// privacy/consent and device-fit contracts remain the execution authorities.
const VERSION='1.0.1-device-aware-ios-fallback';
if(globalThis.CivweaveAIFleetV1?.version===VERSION)return;
const MEMORY_KEY='civweave.ai.fleet.memory-gb.v1';
const CHOICE_KEY='civweave.ai.fleet.choices.v1';
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
const STYLE_ID='cw-ai-fleet-style-v1';
function style(){
 if(document.getElementById(STYLE_ID))return;
 const element=document.createElement('style');element.id=STYLE_ID;
 element.textContent='#cw-ai-fleet-v1{display:grid;gap:12px}#cw-ai-fleet-v1 .cw-fleet-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:10px}#cw-ai-fleet-v1 .cw-fleet-card{display:grid;gap:7px;border:1px solid #ffffff26;border-radius:13px;padding:12px;background:#091629}#cw-ai-fleet-v1 .cw-fleet-card h4,#cw-ai-fleet-v1 .cw-fleet-card p{margin:0}#cw-ai-fleet-v1 .cw-fleet-card small{color:#90efd8}#cw-ai-fleet-v1 .cw-fleet-card p{color:#cbd4ee;font-size:.88rem}#cw-ai-fleet-v1 .cw-fleet-group{display:grid;gap:8px}#cw-ai-fleet-v1 .cw-fleet-group h4{margin:0}#cw-ai-fleet-v1 .cw-fleet-meta{font-size:.82rem;color:#bdc9df}#cw-ai-fleet-v1 button{min-height:44px}#cw-ai-fleet-v1 select{width:auto;min-width:78px}';
 document.head?.append(element);
}
function render(layer){
 const form=layer?.querySelector?.('[data-cw-settings-form]');
 const target=form?.querySelector?.('[data-settings-tab-panel="local-models"]');
 if(!target||!layer?.isConnected||layer.hidden)return false;
 style();
 let panel=target.querySelector('#cw-ai-fleet-v1');
 if(!panel){target.replaceChildren();panel=document.createElement('section');panel.id='cw-ai-fleet-v1';panel.className='cw-clean-panel';target.append(panel)}
 // Remove obsolete catalog renderers. There is exactly one user-facing fleet.
 for(const child of [...target.children])if(child!==panel)child.remove();
 const device=detectDevice(),rows=catalogue(),all=chosen();
 const groups=[...new Set(rows.map(x=>x.group))];
 const options=[4,6,8,12,16,24,32,48,64,96,128].map(n=>'<option value="'+n+'"'+(device.budgetGB===n?' selected':'')+'>'+n+' GB</option>').join('');
 const groupHtml=groups.map(group=>{
  const cards=rows.filter(x=>x.group===group).map(x=>{
   const picked=all[x.role]?.modelId===x.modelId;
   const meta=[x.purpose,x.ramGB+' GB working RAM estimate',x.experimental?'Experimental':'Local',picked?'Preferred':''].filter(Boolean).join(' · ');
   return '<article class="cw-fleet-card" data-fleet-role="'+esc(x.role)+'"><small>'+esc(meta)+'</small><h4>'+esc(x.name)+'</h4><strong>'+esc(x.label)+'</strong><p>'+esc(x.description)+'</p>'+(x.notes?'<p>'+esc(x.notes)+'</p>':'')+'<button type="button" data-ai-fleet-setup="'+esc(x.platform+':'+x.role)+'">'+(picked?'Configure preferred AI':'Select & configure')+'</button></article>';
  }).join('');
  return '<div class="cw-fleet-group"><h4>'+esc(group)+'</h4><div class="cw-fleet-grid">'+cards+'</div></div>';
 }).join('');
 panel.innerHTML='<div><h3>AI Fleet</h3><p>Choose what the AI does first. Each role uses an actual model format supported by this device. Shared model weights are reused across roles where practical.</p></div>'+
  '<label>Usable model-memory budget <select data-ai-fleet-memory aria-label="Usable model memory">'+options+'</select></label>'+
  '<p class="cw-fleet-meta">Device: '+esc(device.platform)+' · '+(device.platform==='ios'?(device.webgpuApi?'WebGPU API present':'WebGPU unavailable; ai.local adapter')+' · ':'')+esc(device.source)+' · '+esc(device.note)+'</p>'+
  '<p class="cw-fleet-meta">These are working RAM estimates, not download sizes or measured peaks. Opening this view never downloads, starts or tests an AI. Hidden roles need more memory or a different runtime.</p>'+
  (groupHtml||'<p>No model in this fleet fits the configured memory budget.</p>')+
  '<output data-ai-fleet-message role="status" aria-live="polite">Select a role to open the compatible existing setup and activate it after verification.</output>';
 if(panel.dataset.fleetBound!=='1'){
  panel.dataset.fleetBound='1';
  panel.addEventListener('change',event=>{
   if(!event.target?.matches?.('[data-ai-fleet-memory]'))return;
   try{setMemoryBudget(event.target.value);render(layer)}catch(e){const out=panel.querySelector('[data-ai-fleet-message]');if(out)out.textContent=String(e.message)}
  });
  panel.addEventListener('click',event=>{
   const btn=event.target?.closest?.('[data-ai-fleet-setup]');if(!btn)return;
   const id=btn.dataset.aiFleetSetup;
   const row=catalogue().find(x=>x.platform+':'+x.role===id);
   if(!row)return;
   try{openSetup(row,layer)}catch(e){const out=panel.querySelector('[data-ai-fleet-message]');if(out)out.textContent=String(e?.message||e)}
  });
 }
 target.dataset.aiFleetOwner='v1';
 return true;
}
globalThis.CivweaveAIFleetV1=Object.freeze({version:VERSION,detectDevice,setMemoryBudget,catalogue,roles:ROLES,suites:SUITES,chosen,select,openSetup,render});
})();