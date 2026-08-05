(()=>{
'use strict';
const VERSION='1.0.6-ai-settings-cleanroom-v188';
const APP_VERSION='1.0.6';
if(globalThis.CommonweaveAISettingsCleanroomV188?.version===VERSION)return;

const LAYER_ID='cw-ai-settings-cleanroom-v188';
const STYLE_ID='cw-ai-settings-cleanroom-v188-style';
const SETTINGS_KEY='commonweave.universal-ai.v127';
const PROFILES_KEY='commonweave-model-profiles-v1';
const SESSION_KEY='commonweave-model-session';
const SECRET_KEY='commonweave-model-secrets-v1';
const DEFAULTS=Object.freeze({
  route:'deterministic',
  provider:'deterministic',
  model:'commonweave-deterministic-v188',
  endpoint:'',
  consent:false,
  apiKey:'',
});
let returnFocus=null;

function parse(value,fallback={}){
  try{
    const parsed=JSON.parse(value);
    return parsed&&typeof parsed==='object'?parsed:fallback;
  }catch{return fallback;}
}
function getLocal(key){try{return localStorage.getItem(key)||'';}catch{return '';}}
function setLocal(key,value){try{localStorage.setItem(key,value);return true;}catch{return false;}}
function getSession(key){try{return sessionStorage.getItem(key)||'';}catch{return '';}}
function setSession(key,value){try{sessionStorage.setItem(key,value);return true;}catch{return false;}}
function removeSession(key){try{sessionStorage.removeItem(key);}catch{}}
function providerName(value){
  const route=String(value||'').trim().toLowerCase();
  if(route==='gemini')return'gemini';
  if(route==='ollama'||route==='local-api')return'ollama';
  if(['openai','compatible','openai-compatible','hosted'].includes(route))return'openai-compatible';
  return'deterministic';
}
function isRetired(config){
  const text=[config?.route,config?.provider,config?.model,config?.source].filter(Boolean).join(' ').toLowerCase();
  return/(bundled|packaged|reflex|minilm|all-minilm|xenova|transformer|webgpu|wasm)/.test(text);
}
function existingKey(){
  const direct=parse(getSession(SESSION_KEY),{});
  if(direct.apiKey)return String(direct.apiKey);
  const shared=parse(getSession(SECRET_KEY),{});
  return String(shared.interactive?.apiKey||shared.apiKey||'');
}
function readState(){
  const saved=parse(getLocal(SETTINGS_KEY),{});
  const profiles=parse(getLocal(PROFILES_KEY),{});
  const interactive=profiles.interactive&&typeof profiles.interactive==='object'?profiles.interactive:saved;
  if(isRetired(interactive))return{...DEFAULTS,hasKey:Boolean(existingKey())};
  const route=providerName(interactive.provider||interactive.route||saved.provider||saved.route);
  const fallbackModel=route==='gemini'?'gemini-3.5-flash-lite':route==='ollama'?'llama3.2':route==='openai-compatible'?'local-model':DEFAULTS.model;
  const fallbackEndpoint=route==='gemini'?'https://generativelanguage.googleapis.com/v1beta':route==='ollama'?'http://127.0.0.1:11434/api/chat':'';
  return{
    route,
    provider:route,
    model:String(interactive.model||saved.model||fallbackModel),
    endpoint:String(interactive.endpoint||saved.endpoint||fallbackEndpoint),
    consent:Boolean(interactive.externalConsent??saved.consent),
    apiKey:'',
    hasKey:Boolean(existingKey()),
  };
}
function deterministic(){return{...DEFAULTS};}
function migrateDeterministicDefault(){return false;}
function extractKey(text){return String(text||'').trim();}
function byName(form,name){return form.elements.namedItem(name);}

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
#${LAYER_ID}[hidden]{display:none!important}
#${LAYER_ID}{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:max(10px,env(safe-area-inset-top)) max(10px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left));background:rgba(2,5,16,.94);overflow:auto;font:16px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#f5f7ff}
#${LAYER_ID},#${LAYER_ID} *{box-sizing:border-box;scroll-behavior:auto!important}
#${LAYER_ID} .cw-clean-shell{width:min(720px,100%);max-height:calc(100dvh - 20px);overflow:auto;border:1px solid rgba(126,239,213,.42);border-radius:20px;background:#10182f;box-shadow:0 24px 70px rgba(0,0,0,.72)}
#${LAYER_ID} header{display:flex;gap:18px;align-items:flex-start;justify-content:space-between;padding:22px 22px 17px;border-bottom:1px solid rgba(255,255,255,.1);background:#172445}
#${LAYER_ID} h2{margin:2px 0 5px;font-size:clamp(1.25rem,4vw,1.8rem)}
#${LAYER_ID} h3{margin:0 0 5px;font-size:1.05rem}
#${LAYER_ID} p{margin:0;color:#cbd4ee}
#${LAYER_ID} small{color:#90efd8;font-weight:700;letter-spacing:.08em}
#${LAYER_ID} button,#${LAYER_ID} input,#${LAYER_ID} select{font:inherit}
#${LAYER_ID} button{min-height:44px;border:1px solid rgba(255,255,255,.25);border-radius:12px;padding:9px 14px;background:#26365f;color:#fff;cursor:pointer}
#${LAYER_ID} button:active{transform:none}
#${LAYER_ID} .cw-clean-close{width:44px;min-width:44px;padding:0;font-size:1.5rem;background:#202d4d}
#${LAYER_ID} form{padding:20px;display:grid;gap:17px}
#${LAYER_ID} label{display:grid;gap:7px;font-weight:700;color:#e9edfb}
#${LAYER_ID} input,#${LAYER_ID} select{width:100%;min-height:46px;border:1px solid rgba(255,255,255,.24);border-radius:11px;padding:10px 12px;background:#080f22;color:#fff}
#${LAYER_ID} input[type=checkbox]{width:22px;min-height:22px;margin:0}
#${LAYER_ID} .cw-clean-consent{display:flex;align-items:flex-start;gap:10px;font-weight:500}
#${LAYER_ID} .cw-clean-panel{display:grid;gap:14px;padding:16px;border:1px solid rgba(255,255,255,.12);border-radius:15px;background:#0b1329}
#${LAYER_ID} .cw-clean-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}
#${LAYER_ID} .cw-clean-note{padding:13px 15px;border-radius:13px;background:#091d20;color:#c9fff2;border:1px solid rgba(91,235,200,.25)}
#${LAYER_ID} footer{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;padding-top:4px}
#${LAYER_ID} output{display:block;min-height:1.4em;color:#9ff2dc}
@media(max-width:600px){#${LAYER_ID}{padding:6px}#${LAYER_ID} .cw-clean-shell{max-height:calc(100dvh - 12px);border-radius:15px}#${LAYER_ID} header{padding:17px}#${LAYER_ID} form{padding:16px}#${LAYER_ID} .cw-clean-grid{grid-template-columns:1fr}}
`;
  document.head.append(style);
}
function markup(){
  return `<div class="cw-clean-shell"><header><div><small>COMMONWEAVE AI · CLEAN ROOM v188</small><h2>AI settings</h2><p>This panel contains no model runtime, provider probe, observer, polling loop, or background diagnostic system.</p></div><button type="button" class="cw-clean-close" data-close aria-label="Close AI settings">×</button></header><form data-cw-cleanroom-form><label>Primary route<select name="route"><option value="deterministic">Deterministic local mode</option><option value="gemini">Google Gemini</option><option value="ollama">Ollama or local API</option><option value="openai-compatible">OpenAI-compatible endpoint</option></select></label><section class="cw-clean-panel" data-panel="deterministic"><div><h3>Deterministic local mode</h3><p>Uses Commonweave’s local rules and saved state. No language model starts when this menu opens or saves.</p></div></section><section class="cw-clean-panel" data-panel="remote" hidden><div><h3 data-provider-heading>Provider configuration</h3><p>These values are only stored. Connectivity tests are deliberately absent while the settings path is rebuilt.</p></div><div class="cw-clean-grid"><label>Model<input name="model" maxlength="200" autocomplete="off"></label><label>Endpoint<input name="endpoint" maxlength="2048" autocomplete="url" spellcheck="false"></label></div><label>Session API key<input name="apiKey" type="password" maxlength="1000" autocomplete="off" spellcheck="false" placeholder="Optional session-only credential"></label><label class="cw-clean-consent"><input name="consent" type="checkbox"><span>Allow requests to the selected external endpoint.</span></label></section><div class="cw-clean-note">Provider testing, MiniLM startup, Transformers.js, WebGPU, WASM initialization, and automatic model discovery are disconnected from this screen.</div><footer><output data-status role="status"></output><div><button type="button" data-reset>Use deterministic mode</button> <button type="submit">Save settings</button></div></footer></form></div>`;
}
function sync(form){
  const route=providerName(byName(form,'route')?.value);
  const remote=route!=='deterministic';
  form.querySelector('[data-panel="deterministic"]').hidden=remote;
  form.querySelector('[data-panel="remote"]').hidden=!remote;
  const heading=form.querySelector('[data-provider-heading]');
  if(heading)heading.textContent=route==='gemini'?'Google Gemini':route==='ollama'?'Ollama or local API':'OpenAI-compatible endpoint';
}
function fill(form){
  const state=readState();
  byName(form,'route').value=state.route;
  byName(form,'model').value=state.model;
  byName(form,'endpoint').value=state.endpoint;
  byName(form,'apiKey').value='';
  byName(form,'apiKey').placeholder=state.hasKey?'A session key is already loaded. Enter another to replace it.':'Optional session-only credential';
  byName(form,'consent').checked=state.consent;
  form.querySelector('[data-status]').textContent='';
  sync(form);
}
function stateFrom(form){
  const route=providerName(byName(form,'route').value);
  if(route==='deterministic')return deterministic();
  const model=String(byName(form,'model').value||'').trim()||(route==='gemini'?'gemini-3.5-flash-lite':route==='ollama'?'llama3.2':'local-model');
  const endpoint=String(byName(form,'endpoint').value||'').trim()||(route==='gemini'?'https://generativelanguage.googleapis.com/v1beta':route==='ollama'?'http://127.0.0.1:11434/api/chat':'');
  return{route,provider:route,model,endpoint,consent:Boolean(byName(form,'consent').checked),apiKey:String(byName(form,'apiKey').value||'').trim()||existingKey()};
}
function persist(state){
  const interactive={route:state.route,provider:state.provider,model:state.model,endpoint:state.endpoint,externalConsent:Boolean(state.consent)};
  const stored={...interactive,consent:Boolean(state.consent),agenticEnabled:false,version:APP_VERSION,settingsController:VERSION};
  setLocal(SETTINGS_KEY,JSON.stringify(stored));
  setLocal(PROFILES_KEY,JSON.stringify({interactive,agentic:null,agenticEnabled:false,version:APP_VERSION,settingsController:VERSION}));
  if(state.route!=='deterministic'&&(state.apiKey||state.consent))setSession(SESSION_KEY,JSON.stringify({apiKey:state.apiKey,remoteConsent:Boolean(state.consent),provider:state.provider,savedAt:new Date().toISOString(),settingsController:VERSION}));
  else{removeSession(SESSION_KEY);removeSession(SECRET_KEY);}
  dispatchEvent(new CustomEvent('commonweave:model-settings-saved',{detail:{version:VERSION,appVersion:APP_VERSION,route:state.route,interactive,agentic:null,agenticEnabled:false,hasSessionKey:Boolean(state.apiKey),savedAt:new Date().toISOString()}}));
  return state;
}
function close(reason='explicit'){
  const layer=document.getElementById(LAYER_ID);
  if(!layer||layer.hidden)return false;
  layer.hidden=true;
  layer.dataset.closeReason=reason;
  document.documentElement.dataset.settingsOpenState='closed';
  const target=returnFocus;
  returnFocus=null;
  if(target?.isConnected&&typeof target.focus==='function')try{target.focus({preventScroll:true});}catch{}
  dispatchEvent(new CustomEvent('commonweave:model-settings-closed',{detail:{reason,version:VERSION}}));
  return true;
}
function bind(layer){
  if(layer.dataset.bound==='true')return;
  layer.dataset.bound='true';
  const form=layer.querySelector('form');
  byName(form,'route').addEventListener('change',()=>sync(form));
  form.querySelector('[data-close]').addEventListener('click',()=>close('close-button'));
  form.querySelector('[data-reset]').addEventListener('click',()=>{
    byName(form,'route').value='deterministic';
    byName(form,'model').value=DEFAULTS.model;
    byName(form,'endpoint').value='';
    byName(form,'apiKey').value='';
    byName(form,'consent').checked=false;
    sync(form);
    form.querySelector('[data-status]').textContent='Deterministic mode selected. Save to apply.';
  });
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const state=persist(stateFrom(form));
    form.querySelector('[data-status]').textContent=state.route==='deterministic'?'Saved deterministic local mode. No model was loaded.':'Saved provider preferences. No connection or model test ran.';
  });
  layer.addEventListener('click',event=>{if(event.target===layer)close('backdrop');});
  layer.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close('escape');}});
}
function build(){
  let layer=document.getElementById(LAYER_ID);
  if(layer)return layer;
  for(const id of ['cw-ai-settings-bootstrap-v180','cw-ai-settings-v175','cw-ai-settings-v181','cw-ai-settings-v182'])document.getElementById(id)?.remove();
  installStyle();
  layer=document.createElement('section');
  layer.id=LAYER_ID;
  layer.hidden=true;
  layer.setAttribute('role','dialog');
  layer.setAttribute('aria-modal','true');
  layer.setAttribute('aria-label','Commonweave AI settings');
  layer.dataset.presentation='cleanroom-v188';
  layer.innerHTML=markup();
  document.body.append(layer);
  bind(layer);
  fill(layer.querySelector('form'));
  return layer;
}
function open(launcher){
  const existing=document.getElementById(LAYER_ID);
  if(existing&&!existing.hidden)return existing;
  const layer=existing||build();
  fill(layer.querySelector('form'));
  returnFocus=launcher instanceof HTMLElement?launcher:(document.activeElement instanceof HTMLElement?document.activeElement:null);
  layer.hidden=false;
  layer.dataset.openedAt=String(Date.now());
  document.documentElement.dataset.settingsOpenState='open';
  document.documentElement.dataset.settingsController='cleanroom-v188';
  dispatchEvent(new CustomEvent('commonweave:model-settings-opened',{detail:{version:VERSION,presentation:'cleanroom-v188',providerRuntimeLoaded:false}}));
  return layer;
}
function ensure(){build();return Promise.resolve(true);}
function renderInline(target){
  const host=typeof target==='string'?document.querySelector(target):target;
  if(!host)return null;
  host.innerHTML=markup();
  const shell=host.querySelector('.cw-clean-shell');
  const form=shell.querySelector('form');
  shell.querySelector('[data-close]')?.remove();
  fill(form);
  byName(form,'route').addEventListener('change',()=>sync(form));
  form.querySelector('[data-reset]').addEventListener('click',()=>{byName(form,'route').value='deterministic';sync(form);});
  form.addEventListener('submit',event=>{event.preventDefault();persist(stateFrom(form));form.querySelector('[data-status]').textContent='Saved without starting a model.';});
  return form;
}

const base={
  version:VERSION,
  appVersion:APP_VERSION,
  authority:'ai-settings-cleanroom-v188',
  eventOwnership:'single-cleanroom-controller',
  presentation:'cleanroom-v188',
  nativeDialog:false,
  defaultRoute:'deterministic',
  legacySettingsCapture:false,
  transformerActive:false,
  providerRuntimeOnOpen:false,
  providerRuntimeAvailable:false,
  providerTestsAvailable:false,
  modelDiscoveryAvailable:false,
  singlePassOpen:true,
  migrationOnDemand:false,
  open,
  close,
  ensure,
  renderInline,
  readState,
  migrateDeterministicDefault,
  providerName,
  isRetired,
  extractKey,
};
const api={...base};
api.facade=api;
api.settingsFacade=api;
Object.freeze(api);
globalThis.CommonweaveAISettingsCleanroomV188=api;
globalThis.CommonweaveUnifiedAISettingsV175=api;
globalThis.CommonweaveModelSettingsV133=api;
globalThis.CommonweaveModelSettingsControllerV173=api;
document.documentElement.dataset.settingsController='cleanroom-v188';
document.documentElement.dataset.settingsOpenState='ready';
})();
