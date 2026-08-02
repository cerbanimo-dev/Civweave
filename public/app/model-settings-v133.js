(()=>{
'use strict';
const SETTINGS_KEY='commonweave.universal-ai.v127';
const SESSION_KEY='commonweave-model-session';
const GEMINI_ENDPOINT='https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODEL='gemini-3.5-flash-lite';
const OLLAMA_ENDPOINT='http://127.0.0.1:11434/api/chat';
const MICRO_MANIFEST='/app/models/functiongemma-270m-it/model-manifest.json';
const MICRO_ADAPTER='/app/models/functiongemma-270m-it/adapter.js';
const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed==null?fallback:parsed}catch{return fallback}};
const runtime=()=>globalThis.CommonweaveModelRuntime||null;
const providerName=value=>{
  const provider=String(value||'bundled').toLowerCase();
  if(['deterministic','browser','bundled','packaged'].includes(provider))return 'bundled';
  if(['openai','compatible','openai-compatible'].includes(provider))return 'openai-compatible';
  if(provider==='local-api')return 'ollama';
  return ['gemini','ollama','openai-compatible','hosted'].includes(provider)?provider:'bundled';
};
function report(kind,detail={}){try{fetch('/api/boot-log',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({schema:'commonweave.boot-log.v1',time:new Date().toISOString(),version:'1.0.30',build:'micro-routing-hologram-r5',kind:`model-settings-v133:${kind}`,url:location.href,detail}),keepalive:true,cache:'no-store'}).catch(()=>{})}catch{}}
function readState(){
  const legacy=parse(localStorage.getItem(SETTINGS_KEY),{route:'bundled',model:'FunctionGemma 270M',endpoint:MICRO_MANIFEST,consent:false,agenticEnabled:false});
  let profiles={interactive:null,agentic:null,agenticEnabled:false},shared=null;
  try{profiles=runtime()?.readModelProfiles?.()||profiles;shared=runtime()?.readSharedConfig?.('interactive')||null}catch{}
  const interactive=profiles.interactive||shared||legacy;
  const route=providerName(interactive?.provider||interactive?.route||legacy.route);
  const session=parse(sessionStorage.getItem(SESSION_KEY),{});
  let hasKey=Boolean(session.apiKey);
  try{hasKey=hasKey||Boolean(runtime()?.readSharedConfig?.('interactive')?.apiKey)}catch{}
  const model=String(interactive?.model||legacy.model||'').trim();
  const endpoint=String(interactive?.endpoint||legacy.endpoint||'').trim();
  return {
    route,
    hasKey,
    consent:Boolean(shared?.externalConsent??session.remoteConsent??legacy.consent),
    agenticEnabled:Boolean(profiles.agenticEnabled&&profiles.agentic),
    agenticModel:String(profiles.agentic?.model||'antigravity'),
    geminiModel:route==='gemini'&&model&&!/^antigravity/i.test(model)?model:GEMINI_MODEL,
    geminiEndpoint:route==='gemini'?(endpoint||GEMINI_ENDPOINT):GEMINI_ENDPOINT,
    ollamaModel:route==='ollama'?(model||'llama3.2'):'llama3.2',
    ollamaEndpoint:route==='ollama'?(endpoint||OLLAMA_ENDPOINT):OLLAMA_ENDPOINT,
    compatibleModel:route==='openai-compatible'?(model||'local-model'):'local-model',
    compatibleEndpoint:route==='openai-compatible'?endpoint:''
  };
}
function existingKey(){
  try{const key=runtime()?.readSharedConfig?.('interactive')?.apiKey;if(key)return key}catch{}
  return parse(sessionStorage.getItem(SESSION_KEY),{}).apiKey||'';
}
async function microStatus(){
  try{
    const adapter=await import(MICRO_ADAPTER);
    return await adapter.status();
  }catch(error){return {available:false,id:'google/functiongemma-270m-it',error:error.message}}
}
function build(){
  let node=document.getElementById('cw-ai-settings-v133');if(node)return node;
  node=document.createElement('dialog');node.id='cw-ai-settings-v133';node.className='cw127-dialog cw-ai-settings-dialog';
  node.innerHTML=`<form><header><div><small>UNIVERSAL AI SETTINGS</small><h2>Choose the Compass mind</h2></div><button class="cw127-close" type="button" data-close aria-label="Close">×</button></header>
  <label>Route<select name="route"><option value="bundled">Bundled FunctionGemma 270M</option><option value="gemini">Google Gemini</option><option value="ollama">Ollama or local API</option><option value="openai-compatible">OpenAI-compatible endpoint</option></select></label>
  <section class="cw-ai-route-panel" data-route-panel="bundled"><p>Runs entirely on this device. The bundled model structures intent and provides an offline fallback. It is not treated as an all-knowing guide.</p><div class="cw-ai-package-state" data-package-state>Checking the local model package…</div><label>Bundled model<input value="google/functiongemma-270m-it" readonly></label><label>Package manifest<input value="${MICRO_MANIFEST}" readonly></label><div class="cw-ai-actions"><button type="button" data-test>Check local package</button></div><output class="cw-ai-test-status" data-test-status role="status">The local package has not been checked yet.</output></section>
  <section class="cw-ai-route-panel" data-route-panel="gemini" hidden><label>Gemini API key<input name="apiKey" type="password" maxlength="1000" autocomplete="off" spellcheck="false" placeholder="Paste a Google Gemini API key"></label><div class="cw-ai-secret-note" data-secret-note></div><label>Model<input name="geminiModel" maxlength="200" value="${GEMINI_MODEL}"></label><label>Google API endpoint<input name="geminiEndpoint" maxlength="2048" value="${GEMINI_ENDPOINT}"></label><label class="cw-ai-consent"><input name="geminiConsent" type="checkbox"><span>Allow prompts to leave this device for Google’s Gemini API.</span></label><label class="cw-ai-agent-toggle"><input name="agenticEnabled" type="checkbox"><span><b>Use Antigravity for agentic and background work</b><small>Standard conversation stays on the interactive Gemini model. Longer tool-using work uses Antigravity and falls back to standard Gemini if the key lacks permission.</small></span></label><div class="cw-ai-agent-options" data-agent-options hidden><label>Agentic model<input name="agenticModel" value="antigravity" readonly></label><p>Antigravity can use managed code execution, Google Search, and URL Context through the shared model runtime.</p></div><div class="cw-ai-actions"><button type="button" data-test>Test Gemini connection</button></div><output class="cw-ai-test-status" data-test-status role="status">No connection test has been run.</output></section>
  <section class="cw-ai-route-panel" data-route-panel="ollama" hidden><label>Model<input name="ollamaModel" value="llama3.2"></label><label>Endpoint<input name="ollamaEndpoint" value="${OLLAMA_ENDPOINT}"></label><div class="cw-ai-actions"><button type="button" data-test>Test local model</button></div><output class="cw-ai-test-status" data-test-status role="status">No connection test has been run.</output></section>
  <section class="cw-ai-route-panel" data-route-panel="openai-compatible" hidden><label>Model<input name="compatibleModel" value="local-model"></label><label>Endpoint<input name="compatibleEndpoint" placeholder="http://127.0.0.1:8000/v1/chat/completions"></label><label>Bearer token or API key<input name="compatibleApiKey" type="password" maxlength="1000" autocomplete="off" spellcheck="false" placeholder="Optional session-only credential"></label><label class="cw-ai-consent"><input name="compatibleConsent" type="checkbox"><span>Allow prompts to leave this device when the endpoint is remote.</span></label><div class="cw-ai-actions"><button type="button" data-test>Test endpoint</button></div><output class="cw-ai-test-status" data-test-status role="status">No connection test has been run.</output></section>
  <p>Provider preferences are stored locally. API keys remain in session storage and are excluded from exports and offline seeds.</p><menu class="cw-ai-actions"><button type="button" data-save>Save settings</button></menu><output data-save-status role="status"></output></form>`;
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
  const form=node.querySelector('form');const route=providerName(form.route.value);
  form.querySelectorAll('[data-route-panel]').forEach(panel=>panel.hidden=panel.dataset.routePanel!==route);
  form.querySelector('[data-agent-options]').hidden=!(route==='gemini'&&form.agenticEnabled.checked);
  if(route==='gemini'){
    if(!form.geminiEndpoint.value.trim())form.geminiEndpoint.value=GEMINI_ENDPOINT;
    if(!form.geminiModel.value.trim())form.geminiModel.value=GEMINI_MODEL;
  }
  if(route==='ollama'&&!form.ollamaEndpoint.value.trim())form.ollamaEndpoint.value=OLLAMA_ENDPOINT;
}
async function updatePackageState(node){
  const state=node.querySelector('[data-package-state]');if(!state)return;
  state.textContent='Checking the local FunctionGemma package…';state.className='cw-ai-package-state';
  const result=await microStatus();
  state.textContent=result.available?'FunctionGemma is packaged and ready for offline routing.':`FunctionGemma files are not complete yet. ${result.error||'Add the local vendor bundle and model files.'}`;
  state.className=`cw-ai-package-state ${result.available?'is-ready':'is-missing'}`;
}
function fill(node){
  const form=node.querySelector('form');const state=readState();
  form.route.value=state.route;
  form.geminiModel.value=state.geminiModel;form.geminiEndpoint.value=state.geminiEndpoint;
  form.geminiConsent.checked=state.consent;form.agenticEnabled.checked=state.agenticEnabled;form.agenticModel.value=state.agenticModel;
  form.ollamaModel.value=state.ollamaModel;form.ollamaEndpoint.value=state.ollamaEndpoint;
  form.compatibleModel.value=state.compatibleModel;form.compatibleEndpoint.value=state.compatibleEndpoint;form.compatibleConsent.checked=state.consent;
  form.apiKey.placeholder=state.hasKey?'Session key already loaded. Enter another to replace it.':'Paste a Google Gemini API key';
  form.querySelector('[data-secret-note]').textContent=state.hasKey?'A Gemini key is loaded for this browser session.':'The key will be held only for this browser session.';
  form.querySelector('[data-save-status]').textContent='';sync(node);updatePackageState(node);
}
function configFrom(node){
  const form=node.querySelector('form');const route=providerName(form.route.value);const prior=existingKey();
  if(route==='bundled')return {route,key:'',externalConsent:false,agenticEnabled:false,interactive:{route:'bundled',provider:'bundled',model:'google/functiongemma-270m-it',endpoint:MICRO_MANIFEST,externalConsent:false},agentic:null};
  if(route==='gemini'){
    const key=String(form.apiKey.value||'').trim()||prior;const externalConsent=form.geminiConsent.checked;const agenticEnabled=form.agenticEnabled.checked;
    const interactive={route:'gemini',provider:'gemini',model:form.geminiModel.value.trim()||GEMINI_MODEL,endpoint:form.geminiEndpoint.value.trim()||GEMINI_ENDPOINT,externalConsent};
    return {route,key,externalConsent,agenticEnabled,interactive,agentic:agenticEnabled?{route:'gemini',provider:'gemini',model:'antigravity',endpoint:interactive.endpoint,externalConsent}:null};
  }
  if(route==='ollama')return {route,key:'',externalConsent:false,agenticEnabled:false,interactive:{route:'ollama',provider:'ollama',model:form.ollamaModel.value.trim()||'llama3.2',endpoint:form.ollamaEndpoint.value.trim()||OLLAMA_ENDPOINT,externalConsent:false},agentic:null};
  const key=String(form.compatibleApiKey.value||'').trim()||prior;const externalConsent=form.compatibleConsent.checked;
  return {route:'openai-compatible',key,externalConsent,agenticEnabled:false,interactive:{route:'openai-compatible',provider:'openai-compatible',model:form.compatibleModel.value.trim()||'local-model',endpoint:form.compatibleEndpoint.value.trim(),externalConsent},agentic:null};
}
function persist(setup){
  localStorage.setItem(SETTINGS_KEY,JSON.stringify({route:setup.route,provider:setup.interactive.provider,model:setup.interactive.model,endpoint:setup.interactive.endpoint,consent:setup.externalConsent,agenticEnabled:setup.agenticEnabled}));
  if(setup.key||setup.externalConsent)sessionStorage.setItem(SESSION_KEY,JSON.stringify({apiKey:setup.key,remoteConsent:setup.externalConsent,provider:setup.interactive.provider,savedAt:new Date().toISOString()}));
  else if(['bundled','ollama'].includes(setup.route))sessionStorage.removeItem(SESSION_KEY);
  const modelRuntime=runtime();if(!modelRuntime)return;
  modelRuntime.saveSharedConfig(setup.interactive,{profile:'interactive'});
  if(setup.key||setup.externalConsent)modelRuntime.saveSessionSecret(setup.interactive,{apiKey:setup.key,externalConsent:setup.externalConsent});
  if(setup.agentic){
    modelRuntime.saveSharedConfig(setup.agentic,{profile:'agentic',enabled:true});
    if(setup.key||setup.externalConsent)modelRuntime.saveSessionSecret(setup.agentic,{apiKey:setup.key,externalConsent:setup.externalConsent});
  }else modelRuntime.saveModelProfiles({agenticEnabled:false});
}
function save(node){
  const setup=configFrom(node);persist(setup);const status=node.querySelector('[data-save-status]');
  status.textContent=setup.route==='bundled'?'Bundled FunctionGemma selected for offline use.':setup.agenticEnabled?'Saved Gemini and Antigravity for Weaveling and every realm guide.':'Saved for Weaveling and every realm guide.';
  report('saved',{route:setup.route,provider:setup.interactive.provider,model:setup.interactive.model,hasSessionKey:Boolean(setup.key),consent:setup.externalConsent,agenticEnabled:setup.agenticEnabled});
}
async function test(node,button){
  const setup=configFrom(node);const panel=button.closest('[data-route-panel]');const status=panel.querySelector('[data-test-status]');
  button.disabled=true;status.textContent='Testing the selected route…';status.className='cw-ai-test-status';
  try{
    if(setup.route==='bundled'){
      const result=await microStatus();if(!result.available)throw new Error(result.error||'The local model files are not installed.');
      status.textContent='FunctionGemma is packaged and available offline.';status.className='cw-ai-test-status is-ok';updatePackageState(node);return;
    }
    if(setup.route==='gemini'&&!setup.key)throw new Error('Enter a Gemini API key first.');
    if(setup.route==='gemini'&&!setup.externalConsent)throw new Error('Enable remote-prompt consent before testing Gemini.');
    if(!runtime()?.detectCapabilities)throw new Error('The shared model runtime has not loaded.');
    const capability=await runtime().detectCapabilities({...setup.interactive,apiKey:setup.key},{probe:true});
    if(capability.available===false)throw new Error(`${capability.provider} did not answer the capability probe.`);
    status.textContent=`${capability.provider} is reachable with ${capability.model}.`;status.className='cw-ai-test-status is-ok';
    report('tested',{provider:capability.provider,model:capability.model,available:capability.available});
  }catch(error){status.textContent=`Connection test failed: ${error.message}`;status.className='cw-ai-test-status is-error';report('test-failed',{route:setup.route,message:error.message,code:error.code||null})}
  finally{button.disabled=false}
}
function open(){
  for(const id of ['cw127-settings','cw128-settings','cw-ai-settings-v132']){const old=document.getElementById(id);if(old?.open){try{old.close()}catch{old.removeAttribute('open')}}}
  const node=build();fill(node);if(typeof node.showModal==='function'){if(!node.open)node.showModal()}else node.setAttribute('open','');report('opened',{path:location.pathname});
}
function inlineMarkup(){
  const state=readState();const labels={bundled:'FunctionGemma 270M · on-device',gemini:`Gemini · ${state.geminiModel}`,ollama:`Ollama · ${state.ollamaModel}`,'openai-compatible':`Compatible · ${state.compatibleModel}`};
  return `<section class="cw-ai-inline-card"><span class="cw-ai-provider-chip">${labels[state.route]||state.route}</span><h2>Compass model route</h2><p>Weaveling and every realm guide use this shared route. User messages are compiled into structured Commonweave context before the selected AI answers.</p><button type="button" data-open-model-settings-v133>Configure model route</button></section>`;
}
document.addEventListener('click',event=>{
  const control=event.target.closest?.('[data-action="settings"],[data-settings],[data-open-model-settings-v133]');if(!control)return;
  event.preventDefault();event.stopImmediatePropagation();open();
},true);
addEventListener('DOMContentLoaded',()=>{if(new URLSearchParams(location.search).get('panel')==='settings')setTimeout(open,60)});
const legacy=parse(localStorage.getItem(SETTINGS_KEY),null);if(!legacy||['deterministic','browser'].includes(String(legacy.route||legacy.provider||'').toLowerCase()))persist({route:'bundled',key:'',externalConsent:false,agenticEnabled:false,interactive:{route:'bundled',provider:'bundled',model:'google/functiongemma-270m-it',endpoint:MICRO_MANIFEST,externalConsent:false},agentic:null});
globalThis.CommonweaveModelSettingsV133={open,readState,microStatus,inlineMarkup,GEMINI_ENDPOINT,GEMINI_MODEL,MICRO_MANIFEST};
report('ready',{route:readState().route});
})();
