(()=>{
'use strict';
const SETTINGS_KEY='civweave.universal-ai.v127';
const SESSION_KEY='civweave-model-session';
const GEMINI_ENDPOINT='https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODEL='gemini-3.5-flash-lite';
const OLLAMA_ENDPOINT='http://127.0.0.1:11434/api/chat';
const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed==null?fallback:parsed}catch{return fallback}};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const runtime=()=>globalThis.CivweaveModelRuntime||null;
const canonicalRoute=value=>{
  const route=String(value||'deterministic').toLowerCase();
  if(['openai-compatible','openai','compatible'].includes(route))return 'compatible';
  if(route==='local-api')return 'ollama';
  return ['deterministic','gemini','ollama','compatible'].includes(route)?route:'deterministic';
};
function report(kind,detail={}){fetch('/api/boot-log',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:`visual-model-settings:${kind}`,version:'1.0.30',detail}),keepalive:true}).catch(()=>{})}
function readState(){
  const legacy=parse(localStorage.getItem(SETTINGS_KEY),{route:'deterministic',model:'Weaveling local planner',endpoint:'',consent:false,agenticEnabled:false});
  let profiles={interactive:null,agentic:null,agenticEnabled:false};
  let selected=null;
  try{profiles=runtime()?.readModelProfiles?.()||profiles;selected=runtime()?.readSharedConfig?.('interactive')||null}catch{}
  const interactive=profiles.interactive||selected||legacy;
  const route=canonicalRoute(interactive?.route||interactive?.provider||legacy.route);
  const model=String(interactive?.model||legacy.model||'').trim();
  const endpoint=String(interactive?.endpoint||legacy.endpoint||'').trim();
  const session=parse(sessionStorage.getItem(SESSION_KEY),{});
  let hasKey=Boolean(session.apiKey);
  try{hasKey=hasKey||Boolean(runtime()?.readSharedConfig?.('interactive')?.apiKey)}catch{}
  return {
    route,
    model: route==='gemini'?(model&&!/^antigravity/i.test(model)?model:GEMINI_MODEL):model,
    endpoint: route==='gemini'?(endpoint||GEMINI_ENDPOINT):endpoint,
    consent:Boolean(selected?.externalConsent??session.remoteConsent??legacy.consent),
    hasKey,
    agenticEnabled:Boolean(profiles.agenticEnabled&&profiles.agentic),
    agenticModel:String(profiles.agentic?.model||'antigravity')
  };
}
function existingKey(){
  try{const key=runtime()?.readSharedConfig?.('interactive')?.apiKey;if(key)return key}catch{}
  return parse(sessionStorage.getItem(SESSION_KEY),{}).apiKey||'';
}
function closeOldDialogs(){for(const id of ['cw127-settings','cw128-settings']){const node=document.getElementById(id);if(node?.open){try{node.close()}catch{node.removeAttribute('open')}}}}
function build(){
  let node=document.getElementById('cw-ai-settings-v132');
  if(node)return node;
  node=document.createElement('dialog');
  node.id='cw-ai-settings-v132';
  node.className='cw127-dialog cw-ai-settings-dialog';
  node.innerHTML=`<form><header><div><small>UNIVERSAL AI SETTINGS</small><h2>Choose the Compass mind</h2></div><button class="cw127-close" type="button" data-close aria-label="Close">×</button></header>
  <label>Route<select name="route"><option value="deterministic">Private local planner</option><option value="gemini">Gemini</option><option value="ollama">Ollama or local API</option><option value="compatible">OpenAI-compatible endpoint</option></select></label>
  <section class="cw-ai-route-panel" data-route-panel="deterministic"><p>No network call is made. Civweave uses its local deterministic planning compiler.</p><label>Planner label<input name="deterministicModel" value="Weaveling local planner"></label></section>
  <section class="cw-ai-route-panel" data-route-panel="gemini" hidden><label>Gemini API key<input name="apiKey" type="password" maxlength="1000" autocomplete="off" spellcheck="false" placeholder="Paste a Google Gemini API key"></label><div class="cw-ai-secret-note" data-secret-note></div><label>Model<input name="geminiModel" maxlength="200" value="${GEMINI_MODEL}"></label><label>Google API endpoint<input name="geminiEndpoint" maxlength="2048" value="${GEMINI_ENDPOINT}"></label><label class="cw-ai-consent"><input name="geminiConsent" type="checkbox"><span>Allow prompts to leave this device for Google’s Gemini API.</span></label><label class="cw-ai-agent-toggle"><input name="agenticEnabled" type="checkbox"><span><b>Use Antigravity for agentic and background work</b><small>Standard conversation stays on the interactive Gemini model. Longer tool-using work uses Google’s Antigravity interactions route and falls back to standard Gemini if the key lacks permission.</small></span></label><div class="cw-ai-agent-options" data-agent-options hidden><label>Agentic model<input name="agenticModel" value="antigravity" readonly></label><p>Antigravity can use managed code execution, Google Search, and URL Context through the shared Civweave model runtime.</p></div><div class="cw-ai-actions"><button type="button" data-test>Test Gemini connection</button></div><output class="cw-ai-test-status" data-test-status role="status">No connection test has been run.</output></section>
  <section class="cw-ai-route-panel" data-route-panel="ollama" hidden><label>Model<input name="ollamaModel" value="llama3.2"></label><label>Endpoint<input name="ollamaEndpoint" value="${OLLAMA_ENDPOINT}"></label><div class="cw-ai-actions"><button type="button" data-test>Test local model</button></div><output class="cw-ai-test-status" data-test-status role="status">No connection test has been run.</output></section>
  <section class="cw-ai-route-panel" data-route-panel="compatible" hidden><label>Model<input name="compatibleModel" value="local-model"></label><label>Endpoint<input name="compatibleEndpoint" placeholder="http://127.0.0.1:8000/v1/chat/completions"></label><label>Bearer token or API key<input name="compatibleApiKey" type="password" autocomplete="off" spellcheck="false" placeholder="Optional session-only credential"></label><label class="cw-ai-consent"><input name="compatibleConsent" type="checkbox"><span>Allow prompts to leave this device when the endpoint is remote.</span></label><div class="cw-ai-actions"><button type="button" data-test>Test endpoint</button></div><output class="cw-ai-test-status" data-test-status role="status">No connection test has been run.</output></section>
  <p>Provider preferences are stored locally. API keys remain in session storage and are not included in exports or the offline seed.</p><menu class="cw-ai-actions"><button type="button" data-save>Save settings</button></menu><output data-save-status role="status"></output></form>`;
  document.body.append(node);
  node.querySelector('[data-close]').onclick=()=>node.close();
  node.addEventListener('click',event=>{if(event.target===node)node.close()});
  node.querySelector('select[name="route"]').addEventListener('change',()=>sync(node));
  node.querySelector('input[name="agenticEnabled"]').addEventListener('change',()=>sync(node));
  node.querySelector('[data-save]').onclick=()=>save(node);
  node.querySelectorAll('[data-test]').forEach(button=>button.onclick=()=>test(node,button));
  return node;
}
function sync(node){
  const form=node.querySelector('form');
  const route=canonicalRoute(form.route.value);
  form.querySelectorAll('[data-route-panel]').forEach(panel=>panel.hidden=panel.dataset.routePanel!==route);
  const agent=form.querySelector('[data-agent-options]');
  if(agent)agent.hidden=!(route==='gemini'&&form.agenticEnabled.checked);
  if(route==='gemini'){
    if(!form.geminiEndpoint.value.trim())form.geminiEndpoint.value=GEMINI_ENDPOINT;
    if(!form.geminiModel.value.trim())form.geminiModel.value=GEMINI_MODEL;
  }
  if(route==='ollama'&&!form.ollamaEndpoint.value.trim())form.ollamaEndpoint.value=OLLAMA_ENDPOINT;
}
function fill(node){
  const form=node.querySelector('form');
  const state=readState();
  form.route.value=state.route;
  form.geminiModel.value=state.route==='gemini'?(state.model||GEMINI_MODEL):GEMINI_MODEL;
  form.geminiEndpoint.value=state.route==='gemini'?(state.endpoint||GEMINI_ENDPOINT):GEMINI_ENDPOINT;
  form.geminiConsent.checked=state.consent;
  form.agenticEnabled.checked=state.agenticEnabled;
  form.agenticModel.value=state.agenticModel||'antigravity';
  if(state.route==='ollama'){form.ollamaModel.value=state.model||'llama3.2';form.ollamaEndpoint.value=state.endpoint||OLLAMA_ENDPOINT}
  if(state.route==='compatible'){form.compatibleModel.value=state.model||'local-model';form.compatibleEndpoint.value=state.endpoint||'';form.compatibleConsent.checked=state.consent}
  if(state.route==='deterministic')form.deterministicModel.value=state.model||'Weaveling local planner';
  form.apiKey.placeholder=state.hasKey?'Session key already loaded. Enter another to replace it.':'Paste a Google Gemini API key';
  form.querySelector('[data-secret-note]').textContent=state.hasKey?'A Gemini key is loaded for this browser session.':'The key will be held only for this browser session.';
  form.querySelector('[data-save-status]').textContent='';
  sync(node);
}
function configFrom(node){
  const form=node.querySelector('form');
  const route=canonicalRoute(form.route.value);
  const key=String(form.apiKey?.value||form.compatibleApiKey?.value||'').trim()||existingKey();
  if(route==='gemini'){
    const model=form.geminiModel.value.trim()||GEMINI_MODEL;
    const endpoint=form.geminiEndpoint.value.trim()||GEMINI_ENDPOINT;
    const externalConsent=form.geminiConsent.checked;
    const agenticEnabled=form.agenticEnabled.checked;
    return {route,key,externalConsent,agenticEnabled,interactive:{route:'gemini',provider:'gemini',model,endpoint,externalConsent},agentic:agenticEnabled?{route:'gemini',provider:'gemini',model:'antigravity',endpoint,externalConsent}:null};
  }
  if(route==='ollama')return {route,key:'',externalConsent:false,agenticEnabled:false,interactive:{route:'ollama',provider:'ollama',model:form.ollamaModel.value.trim()||'llama3.2',endpoint:form.ollamaEndpoint.value.trim()||OLLAMA_ENDPOINT,externalConsent:false},agentic:null};
  if(route==='compatible'){
    const externalConsent=form.compatibleConsent.checked;
    return {route,key,externalConsent,agenticEnabled:false,interactive:{route:'compatible',provider:'openai-compatible',model:form.compatibleModel.value.trim()||'local-model',endpoint:form.compatibleEndpoint.value.trim(),externalConsent},agentic:null};
  }
  return {route:'deterministic',key:'',externalConsent:false,agenticEnabled:false,interactive:{route:'deterministic',provider:'deterministic',model:form.deterministicModel.value.trim()||'Weaveling local planner',endpoint:'',externalConsent:false},agentic:null};
}
function persist(setup){
  localStorage.setItem(SETTINGS_KEY,JSON.stringify({route:setup.route,model:setup.interactive.model,endpoint:setup.interactive.endpoint,consent:setup.externalConsent,agenticEnabled:setup.agenticEnabled}));
  if(setup.key||setup.externalConsent)sessionStorage.setItem(SESSION_KEY,JSON.stringify({apiKey:setup.key,remoteConsent:setup.externalConsent,provider:setup.interactive.provider,savedAt:new Date().toISOString()}));
  else if(['deterministic','ollama'].includes(setup.route))sessionStorage.removeItem(SESSION_KEY);
  const modelRuntime=runtime();
  if(modelRuntime){
    modelRuntime.saveSharedConfig(setup.interactive,{profile:'interactive'});
    if(setup.key||setup.externalConsent)modelRuntime.saveSessionSecret(setup.interactive,{apiKey:setup.key,externalConsent:setup.externalConsent});
    if(setup.agentic){
      modelRuntime.saveSharedConfig(setup.agentic,{profile:'agentic',enabled:true});
      if(setup.key||setup.externalConsent)modelRuntime.saveSessionSecret(setup.agentic,{apiKey:setup.key,externalConsent:setup.externalConsent});
    }else modelRuntime.saveModelProfiles({agenticEnabled:false});
  }
}
function save(node){
  const setup=configFrom(node);
  persist(setup);
  const status=node.querySelector('[data-save-status]');
  status.textContent=setup.agenticEnabled?'Saved Gemini and Antigravity for Weaveling and every realm guide.':'Saved for Weaveling and every realm guide.';
  report('saved',{route:setup.route,model:setup.interactive.model,endpoint:setup.interactive.endpoint,hasSessionKey:Boolean(setup.key),consent:setup.externalConsent,agenticEnabled:setup.agenticEnabled});
}
async function test(node,button){
  const setup=configFrom(node);
  const panel=button.closest('[data-route-panel]');
  const status=panel.querySelector('[data-test-status]');
  if(setup.route==='gemini'&&!setup.key){status.textContent='Enter a Gemini API key first.';status.className='cw-ai-test-status is-error';return}
  if(setup.route==='gemini'&&!setup.externalConsent){status.textContent='Enable remote-prompt consent before testing Gemini.';status.className='cw-ai-test-status is-error';return}
  if(!runtime()){status.textContent='The shared model runtime has not loaded.';status.className='cw-ai-test-status is-error';return}
  button.disabled=true;status.textContent='Testing the selected provider…';status.className='cw-ai-test-status';
  try{
    const capability=await runtime().detectCapabilities({...setup.interactive,apiKey:setup.key},{probe:true});
    status.textContent=capability.available===false?`${capability.provider} did not answer the probe.`:`${capability.provider} is reachable with ${capability.model}.`;
    status.className=`cw-ai-test-status ${capability.available===false?'is-error':'is-ok'}`;
    report('tested',{provider:capability.provider,model:capability.model,available:capability.available});
  }catch(error){status.textContent=`Connection test failed: ${error.message}`;status.className='cw-ai-test-status is-error';report('test-failed',{message:error.message,code:error.code||null})}
  finally{button.disabled=false}
}
function open(){
  closeOldDialogs();
  const node=build();
  fill(node);
  if(typeof node.showModal==='function'){if(!node.open)node.showModal()}else node.setAttribute('open','');
  report('opened',{path:location.pathname});
}
document.addEventListener('click',event=>{
  const control=event.target.closest?.('[data-action="settings"],[data-settings]');
  if(!control)return;
  event.preventDefault();event.stopImmediatePropagation();open();
},true);
addEventListener('DOMContentLoaded',()=>{
  if(new URLSearchParams(location.search).get('panel')==='settings')setTimeout(()=>{closeOldDialogs();open()},90);
});
globalThis.CivweaveVisualModelSettings={open,GEMINI_ENDPOINT,GEMINI_MODEL};
})();