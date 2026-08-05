(()=>{
'use strict';
const VERSION='1.0.5-unified-ai-settings-v178';
const APP_VERSION='1.0.5';
const SETTINGS_KEY='commonweave.universal-ai.v127';
const PROFILES_KEY='commonweave-model-profiles-v1';
const SESSION_KEY='commonweave-model-session';
const SECRET_KEY='commonweave-model-secrets-v1';
const GEMINI_ENDPOINT='https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODEL='gemini-3.5-flash-lite';
const OLLAMA_ENDPOINT='http://127.0.0.1:11434/api/chat';
const DETERMINISTIC_MODEL='commonweave-deterministic-v178';
const LEGACY_PATTERN=/(?:^|[-_/ ])(?:bundled|packaged|reflex|minilm|all-minilm|xenova|transformer|browser)(?:$|[-_/ ])/i;
let returnFocus=null;
const parse=(value,fallback)=>{try{const out=JSON.parse(value);return out==null?fallback:out}catch{return fallback}};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const runtime=()=>globalThis.CommonweaveModelRuntime||null;
const byName=(form,name)=>form.elements.namedItem(name);
const deterministic=()=>({route:'deterministic',provider:'deterministic',model:DETERMINISTIC_MODEL,endpoint:'',externalConsent:false});
function providerName(value){
  const raw=String(value||'deterministic').trim().toLowerCase();
  if(!raw||raw==='deterministic'||LEGACY_PATTERN.test(raw))return'deterministic';
  if(['openai','compatible','openai-compatible'].includes(raw))return'openai-compatible';
  if(raw==='local-api')return'ollama';
  return['gemini','ollama','openai-compatible','hosted'].includes(raw)?raw:'deterministic';
}
function isRetired(config){
  if(!config||typeof config!=='object')return true;
  const joined=[config.route,config.provider,config.model,config.id,config.source].filter(Boolean).join(' ');
  return LEGACY_PATTERN.test(joined)||providerName(config.provider||config.route)==='deterministic'&&String(config.provider||config.route||'').toLowerCase()!=='deterministic';
}
function writeProfiles(profiles){localStorage.setItem(PROFILES_KEY,JSON.stringify(profiles))}
function migrateDeterministicDefault(){
  const legacy=parse(localStorage.getItem(SETTINGS_KEY),{});
  if(isRetired(legacy)||!legacy.route)localStorage.setItem(SETTINGS_KEY,JSON.stringify({...deterministic(),consent:false,agenticEnabled:false,migratedBy:VERSION}));
  const profiles=parse(localStorage.getItem(PROFILES_KEY),{});
  if(isRetired(profiles.interactive)){profiles.interactive=deterministic();profiles.agentic=null;profiles.agenticEnabled=false;profiles.migratedBy=VERSION;writeProfiles(profiles)}
  try{
    const shared=runtime()?.readSharedConfig?.('interactive');
    if(isRetired(shared)){
      runtime()?.saveSharedConfig?.(deterministic(),{profile:'interactive'});
      runtime()?.saveModelProfiles?.({interactive:deterministic(),agentic:null,agenticEnabled:false});
    }
  }catch{}
  const reflex=globalThis.CommonweaveReflexRuntime;
  if(reflex&&LEGACY_PATTERN.test(String(reflex.model||reflex.id||''))){
    try{delete globalThis.CommonweaveReflexRuntime}catch{globalThis.CommonweaveReflexRuntime=null}
    globalThis.CommonweaveDeterministicModeV175?.migrate?.();
  }
  return true;
}
function existingKey(){
  try{const secret=runtime()?.readSessionSecret?.('interactive');if(secret?.apiKey)return secret.apiKey}catch{}
  const current=parse(sessionStorage.getItem(SESSION_KEY),{});if(current.apiKey)return current.apiKey;
  const shared=parse(sessionStorage.getItem(SECRET_KEY),{});return shared.interactive?.apiKey||shared.apiKey||'';
}
function readState(){
  migrateDeterministicDefault();
  const legacy=parse(localStorage.getItem(SETTINGS_KEY),{...deterministic(),consent:false});
  let profiles=parse(localStorage.getItem(PROFILES_KEY),{}),shared=null;
  try{profiles=runtime()?.readModelProfiles?.()||profiles;shared=runtime()?.readSharedConfig?.('interactive')||null}catch{}
  let interactive=profiles.interactive||shared||legacy;
  if(isRetired(interactive))interactive=deterministic();
  const route=providerName(interactive.provider||interactive.route);
  return{
    route,
    consent:Boolean(interactive.externalConsent??legacy.consent),
    hasKey:Boolean(existingKey()),
    agenticEnabled:Boolean(profiles.agenticEnabled&&profiles.agentic),
    geminiModel:route==='gemini'?(interactive.model||GEMINI_MODEL):GEMINI_MODEL,
    geminiEndpoint:route==='gemini'?(interactive.endpoint||GEMINI_ENDPOINT):GEMINI_ENDPOINT,
    ollamaModel:route==='ollama'?(interactive.model||'llama3.2'):'llama3.2',
    ollamaEndpoint:route==='ollama'?(interactive.endpoint||OLLAMA_ENDPOINT):OLLAMA_ENDPOINT,
    compatibleModel:route==='openai-compatible'?(interactive.model||'local-model'):'local-model',
    compatibleEndpoint:route==='openai-compatible'?(interactive.endpoint||''):''
  };
}
function markup(){
  return`<form class="cw-ai-settings-form" data-unified-ai-settings-v175 data-version="${VERSION}">
    <header class="cw-ai-header"><div class="cw-ai-header-copy"><small>COMMONWEAVE AI · v${APP_VERSION}</small><h2>Commonweave AI settings</h2><p>One settings surface for Weaveling and every realm guide.</p></div><button class="cw-ai-close" type="button" data-close aria-label="Close Commonweave AI settings">×</button></header>
    <label class="cw-ai-route-field"><span>Primary route</span><select name="route">
      <option value="deterministic">Deterministic local mode</option>
      <option value="gemini">Google Gemini</option>
      <option value="ollama">Ollama or local API</option>
      <option value="openai-compatible">OpenAI-compatible endpoint</option>
    </select></label>
    <section class="cw-ai-route-panel" data-route-panel="deterministic">
      <div class="cw-ai-panel-heading"><span class="cw-ai-orb is-local">✓</span><div><small>DEFAULT · ON DEVICE</small><h3>Deterministic local mode</h3></div></div>
      <p>Commonweave uses inspectable rules, canonical local state, and explicit approval gates. No language model is loaded and no prompt leaves this device.</p>
      <div class="cw-ai-fallback-contract"><b>Transformer laboratory is inactive</b><span>Archived experiments are not downloaded, started, checked, or exposed by the installed application.</span></div>
    </section>
    <section class="cw-ai-route-panel" data-route-panel="gemini" hidden>
      <div class="cw-ai-panel-heading"><span class="cw-ai-orb is-gemini">G</span><div><small>REMOTE · OPT IN</small><h3>Gemini + Antigravity</h3></div></div>
      <label class="cw-ai-secret-field">Gemini API key<input name="apiKey" type="password" maxlength="1000" autocomplete="off" spellcheck="false" placeholder="Paste a Google Gemini API key"></label>
      <div class="cw-ai-secret-tools"><button type="button" data-paste-key>Paste key</button><button type="button" data-import-key>Import .env / JSON</button><button type="button" data-forget-key>Forget session key</button><input data-key-file type="file" accept=".env,.txt,.json,text/plain,application/json" hidden></div>
      <div class="cw-ai-secret-note" data-secret-note>Credentials are held only for this browser session.</div>
      <div class="cw-ai-field-grid"><label>Conversation model<input name="geminiModel" maxlength="200" value="${GEMINI_MODEL}"></label><label>Google API endpoint<input name="geminiEndpoint" maxlength="2048" value="${GEMINI_ENDPOINT}"></label></div>
      <label class="cw-ai-consent"><input name="geminiConsent" type="checkbox"><span><b>Allow Gemini requests</b><small>Prompts may leave this device only after this box is checked.</small></span></label>
      <label class="cw-ai-agent-toggle"><input name="agenticEnabled" type="checkbox"><span><b>Use Antigravity for agentic work</b><small>Conversation stays on Gemini. Tool-using work may use Antigravity when the key has access.</small></span></label>
      <div class="cw-ai-agent-options" data-agent-options hidden><label>Agentic model<input name="agenticModel" value="antigravity" readonly></label></div>
      <div class="cw-ai-test-grid"><div><button type="button" data-test-gemini>Test Gemini response</button><output class="cw-ai-test-status" data-test-status="gemini" role="status">No Gemini test has run.</output></div><div data-agent-test-wrap hidden><button type="button" data-test-antigravity>Test Antigravity</button><output class="cw-ai-test-status" data-test-status="antigravity" role="status">No Antigravity test has run.</output></div></div>
    </section>
    <section class="cw-ai-route-panel" data-route-panel="ollama" hidden>
      <div class="cw-ai-panel-heading"><span class="cw-ai-orb is-local">⌁</span><div><small>LOCAL API</small><h3>Ollama</h3></div></div>
      <div class="cw-ai-field-grid"><label>Model<input name="ollamaModel" value="llama3.2"></label><label>Endpoint<input name="ollamaEndpoint" value="${OLLAMA_ENDPOINT}"></label></div>
      <div class="cw-ai-actions"><button type="button" data-test-provider>Test local API</button></div><output class="cw-ai-test-status" data-test-status="provider" role="status">No connection test has run.</output>
    </section>
    <section class="cw-ai-route-panel" data-route-panel="openai-compatible" hidden>
      <div class="cw-ai-panel-heading"><span class="cw-ai-orb is-compatible">↗</span><div><small>CUSTOM ENDPOINT</small><h3>OpenAI-compatible route</h3></div></div>
      <div class="cw-ai-field-grid"><label>Model<input name="compatibleModel" value="local-model"></label><label>Endpoint<input name="compatibleEndpoint" placeholder="http://127.0.0.1:8000/v1/chat/completions"></label></div>
      <label>Bearer token or API key<input name="compatibleApiKey" type="password" maxlength="1000" autocomplete="off" spellcheck="false" placeholder="Optional session-only credential"></label>
      <label class="cw-ai-consent"><input name="compatibleConsent" type="checkbox"><span><b>Allow remote requests</b><small>Required when this endpoint leaves the device.</small></span></label>
      <div class="cw-ai-actions"><button type="button" data-test-provider>Test endpoint</button></div><output class="cw-ai-test-status" data-test-status="provider" role="status">No connection test has run.</output>
    </section>
    <footer class="cw-ai-form-footer"><p>Provider preferences are stored locally. Credentials stay in session storage.</p><div class="cw-ai-actions"><button type="submit" class="cw-ai-save">Save Commonweave AI settings</button></div><output data-save-status role="status"></output></footer>
  </form>`;
}
function sync(form){
  const route=providerName(byName(form,'route').value);
  form.querySelectorAll('[data-route-panel]').forEach(panel=>panel.hidden=panel.dataset.routePanel!==route);
  const agentic=Boolean(byName(form,'agenticEnabled')?.checked);
  form.querySelector('[data-agent-options]').hidden=!(route==='gemini'&&agentic);
  form.querySelector('[data-agent-test-wrap]').hidden=!(route==='gemini'&&agentic);
}
function fill(form){
  const state=readState();
  byName(form,'route').value=state.route;
  byName(form,'geminiModel').value=state.geminiModel;
  byName(form,'geminiEndpoint').value=state.geminiEndpoint;
  byName(form,'geminiConsent').checked=state.consent;
  byName(form,'agenticEnabled').checked=state.agenticEnabled;
  byName(form,'ollamaModel').value=state.ollamaModel;
  byName(form,'ollamaEndpoint').value=state.ollamaEndpoint;
  byName(form,'compatibleModel').value=state.compatibleModel;
  byName(form,'compatibleEndpoint').value=state.compatibleEndpoint;
  byName(form,'compatibleConsent').checked=state.consent;
  const keyInput=byName(form,'apiKey');keyInput.value='';keyInput.placeholder=state.hasKey?'A session key is loaded. Enter another to replace it.':'Paste a Google Gemini API key';
  form.querySelector('[data-secret-note]').textContent=state.hasKey?'A Gemini key is loaded for this browser session.':'Credentials are held only for this browser session.';
  form.querySelector('[data-save-status]').textContent='';
  sync(form);
}
function setupFrom(form){
  const route=providerName(byName(form,'route').value),prior=existingKey();
  if(route==='deterministic')return{route,key:prior,consent:false,agentic:false,interactive:deterministic(),agenticConfig:null};
  if(route==='gemini'){
    const key=byName(form,'apiKey').value.trim()||prior,consent=byName(form,'geminiConsent').checked,agentic=byName(form,'agenticEnabled').checked;
    const interactive={route:'gemini',provider:'gemini',model:byName(form,'geminiModel').value.trim()||GEMINI_MODEL,endpoint:byName(form,'geminiEndpoint').value.trim()||GEMINI_ENDPOINT,externalConsent:consent};
    return{route,key,consent,agentic,interactive,agenticConfig:agentic?{route:'gemini',provider:'gemini',model:'antigravity',endpoint:interactive.endpoint,externalConsent:consent}:null};
  }
  if(route==='ollama')return{route,key:'',consent:false,agentic:false,interactive:{route:'ollama',provider:'ollama',model:byName(form,'ollamaModel').value.trim()||'llama3.2',endpoint:byName(form,'ollamaEndpoint').value.trim()||OLLAMA_ENDPOINT,externalConsent:false},agenticConfig:null};
  const key=byName(form,'compatibleApiKey').value.trim()||prior,consent=byName(form,'compatibleConsent').checked;
  return{route:'openai-compatible',key,consent,agentic:false,interactive:{route:'openai-compatible',provider:'openai-compatible',model:byName(form,'compatibleModel').value.trim()||'local-model',endpoint:byName(form,'compatibleEndpoint').value.trim(),externalConsent:consent},agenticConfig:null};
}
function persist(setup){
  localStorage.setItem(SETTINGS_KEY,JSON.stringify({route:setup.route,provider:setup.interactive.provider,model:setup.interactive.model,endpoint:setup.interactive.endpoint,consent:setup.consent,agenticEnabled:setup.agentic,version:APP_VERSION}));
  localStorage.setItem(PROFILES_KEY,JSON.stringify({interactive:setup.interactive,agentic:setup.agenticConfig,agenticEnabled:setup.agentic,version:APP_VERSION}));
  if(setup.key||setup.consent)sessionStorage.setItem(SESSION_KEY,JSON.stringify({apiKey:setup.key,remoteConsent:setup.consent,provider:setup.interactive.provider,savedAt:new Date().toISOString()}));
  const modelRuntime=runtime();
  if(modelRuntime){
    modelRuntime.saveSharedConfig?.(setup.interactive,{profile:'interactive'});
    modelRuntime.saveModelProfiles?.({interactive:setup.interactive,agentic:setup.agenticConfig,agenticEnabled:setup.agentic});
    if(setup.key||setup.consent)modelRuntime.saveSessionSecret?.(setup.interactive,{apiKey:setup.key,externalConsent:setup.consent});
  }
  dispatchEvent(new CustomEvent('commonweave:model-settings-saved',{detail:{version:VERSION,appVersion:APP_VERSION,route:setup.route,interactive:setup.interactive,agentic:setup.agenticConfig,agenticEnabled:setup.agentic,hasSessionKey:Boolean(setup.key),savedAt:new Date().toISOString()}}));
}
function extractKey(text){
  const raw=String(text||'').trim();if(!raw)return'';
  try{const json=JSON.parse(raw);return String(json.GEMINI_API_KEY||json.GOOGLE_API_KEY||json.apiKey||json.api_key||json.key||'').trim()}catch{}
  const match=raw.match(/(?:GEMINI_API_KEY|GOOGLE_API_KEY|apiKey|api_key)\s*[:=]\s*["']?([^\s"'\r\n]+)/i);
  return(match?.[1]||(!/[\r\n=:{]/.test(raw)?raw:'')).trim();
}
async function pasteKey(form,button){
  button.disabled=true;try{const key=extractKey(await navigator.clipboard.readText());if(!key)throw new Error('The clipboard did not contain a recognizable key.');byName(form,'apiKey').value=key;form.querySelector('[data-secret-note]').textContent='Clipboard key loaded. Save to apply it.'}catch(error){form.querySelector('[data-secret-note]').textContent=`Paste failed: ${error.message}`}finally{button.disabled=false}
}
async function importKey(form,file){if(!file)return;const key=extractKey(await file.text());if(!key)throw new Error('No recognizable API key was found.');byName(form,'apiKey').value=key;form.querySelector('[data-secret-note]').textContent=`Loaded ${file.name}. Save to apply it.`}
function forgetKey(form){sessionStorage.removeItem(SESSION_KEY);sessionStorage.removeItem(SECRET_KEY);byName(form,'apiKey').value='';form.querySelector('[data-secret-note]').textContent='The session key was forgotten.'}
async function testGemini(form,profile,button){
  const setup=setupFrom(form),status=form.querySelector(`[data-test-status="${profile}"]`);button.disabled=true;status.textContent='Testing…';status.className='cw-ai-test-status';
  try{
    if(!setup.key)throw new Error('Enter a Gemini API key first.');if(!setup.consent)throw new Error('Allow Gemini requests before testing.');if(!runtime()?.generate)throw new Error('The shared model runtime is unavailable.');
    const config=profile==='agentic'?(setup.agenticConfig||{...setup.interactive,model:'antigravity'}):setup.interactive;
    const result=await runtime().generate({purpose:`commonweave-settings-${profile}-test`,executionProfile:profile==='agentic'?'agentic':'interactive',config:{...config,apiKey:setup.key},messages:[{role:'user',content:'Reply with READY.'}]});
    if(result?.status!=='success'||result?.fallback?.used)throw new Error(result?.fallback?.reason||result?.error?.message||'The provider did not complete the test.');
    status.textContent=`Answered successfully with ${result.actual?.model||config.model}.`;status.className='cw-ai-test-status is-ok';
  }catch(error){status.textContent=`Test failed: ${error.message}`;status.className='cw-ai-test-status is-error'}finally{button.disabled=false}
}
async function testProvider(form,button){
  const setup=setupFrom(form),status=button.closest('[data-route-panel]').querySelector('[data-test-status="provider"]');button.disabled=true;status.textContent='Testing…';
  try{const capability=await runtime()?.detectCapabilities?.({...setup.interactive,apiKey:setup.key},{probe:true});if(!capability||capability.available===false)throw new Error(capability?.notes?.join(' ')||'The provider did not answer.');status.textContent=`${capability.provider} is reachable with ${capability.model}.`;status.className='cw-ai-test-status is-ok'}catch(error){status.textContent=`Connection test failed: ${error.message}`;status.className='cw-ai-test-status is-error'}finally{button.disabled=false}
}
function close(dialog,reason='explicit'){if(!dialog?.open)return;dialog.dataset.closeReason=reason;dialog.close(reason)}
function bind(form,dialog){
  if(form.dataset.unifiedAiBound==='true')return form;form.dataset.unifiedAiBound='true';
  byName(form,'route').addEventListener('change',()=>sync(form));byName(form,'agenticEnabled').addEventListener('change',()=>sync(form));
  form.querySelector('[data-paste-key]').addEventListener('click',event=>pasteKey(form,event.currentTarget));
  form.querySelector('[data-import-key]').addEventListener('click',()=>form.querySelector('[data-key-file]').click());
  form.querySelector('[data-forget-key]').addEventListener('click',()=>forgetKey(form));
  form.querySelector('[data-key-file]').addEventListener('change',event=>{importKey(form,event.target.files?.[0]).catch(error=>form.querySelector('[data-secret-note]').textContent=error.message);event.target.value=''});
  form.querySelector('[data-test-gemini]').addEventListener('click',event=>testGemini(form,'gemini',event.currentTarget));
  form.querySelector('[data-test-antigravity]').addEventListener('click',event=>testGemini(form,'agentic',event.currentTarget));
  form.querySelectorAll('[data-test-provider]').forEach(button=>button.addEventListener('click',()=>testProvider(form,button)));
  form.querySelector('[data-close]').addEventListener('click',event=>{event.preventDefault();event.stopPropagation();close(dialog,'close-button')});
  form.addEventListener('submit',event=>{event.preventDefault();const setup=setupFrom(form);persist(setup);form.querySelector('[data-save-status]').textContent=setup.route==='deterministic'?'Saved deterministic local mode. No model will load.':'Saved the selected provider.'});
  return form;
}
function build(){
  let dialog=document.querySelector('#cw-ai-settings-v175');if(dialog)return{dialog,created:false};
  dialog=document.createElement('dialog');dialog.id='cw-ai-settings-v175';dialog.className='cw-ai-settings-dialog';dialog.dataset.dismissal='explicit-only';dialog.innerHTML=markup();document.body.append(dialog);
  bind(dialog.querySelector('form'),dialog);fill(dialog.querySelector('form'));
  dialog.addEventListener('cancel',event=>{event.preventDefault();close(dialog,'escape')});
  dialog.addEventListener('close',()=>{document.documentElement.dataset.settingsOpenState='closed';const target=returnFocus;returnFocus=null;requestAnimationFrame(()=>target?.isConnected&&target.focus?.({preventScroll:true}))});
  return{dialog,created:true};
}
function open(){
  migrateDeterministicDefault();const{dialog}=build();fill(dialog.querySelector('form'));returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
  if(!dialog.open){document.documentElement.dataset.settingsOpenState='opening';dialog.showModal();document.documentElement.dataset.settingsOpenState='open';requestAnimationFrame(()=>byName(dialog.querySelector('form'),'route')?.focus({preventScroll:true}))}
  return dialog;
}
function renderInline(target){const host=typeof target==='string'?document.querySelector(target):target;if(!host)return null;host.innerHTML=markup();const form=host.querySelector('form');form.querySelector('[data-close]')?.remove();bind(form,{open:false});fill(form);return form}
migrateDeterministicDefault();
const api=Object.freeze({version:VERSION,appVersion:APP_VERSION,eventOwnership:'controller-only',dismissal:'explicit-only',open,close:()=>close(document.querySelector('#cw-ai-settings-v175'),'api'),renderInline,readState,migrateDeterministicDefault,providerName,isRetired,extractKey});
globalThis.CommonweaveUnifiedAISettingsV175=api;globalThis.CommonweaveModelSettingsV133=api;globalThis.CommonweaveModelSettingsV157=api;
})();
