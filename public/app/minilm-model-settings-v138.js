(()=>{
'use strict';
const VERSION='157.1';
const SETTINGS_KEY='commonweave.universal-ai.v127';
const SESSION_KEY='commonweave-model-session';
const MODEL_ID='Xenova/all-MiniLM-L6-v2';
const MANIFEST='/app/models/all-minilm-l6-v2/model-manifest.json';
const GEMINI_ENDPOINT='https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODEL='gemini-3.5-flash-lite';
const OLLAMA_ENDPOINT='http://127.0.0.1:11434/api/chat';
const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed==null?fallback:parsed}catch{return fallback}};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const runtime=()=>globalThis.CommonweaveModelRuntime||null;
const byName=(form,name)=>form.elements.namedItem(name);

function providerName(value){
  const provider=String(value||'bundled').toLowerCase();
  if(['bundled','packaged','reflex','minilm','local-reflex','smollm2','deterministic','browser'].includes(provider))return'bundled';
  if(['openai','compatible','openai-compatible'].includes(provider))return'openai-compatible';
  if(provider==='local-api')return'ollama';
  return['gemini','ollama','openai-compatible','hosted'].includes(provider)?provider:'bundled';
}
function existingKey(){
  try{const key=runtime()?.readSharedConfig?.('interactive')?.apiKey;if(key)return key}catch{}
  return parse(sessionStorage.getItem(SESSION_KEY),{}).apiKey||'';
}
function readState(){
  const legacy=parse(localStorage.getItem(SETTINGS_KEY),{route:'bundled',model:MODEL_ID,endpoint:MANIFEST,consent:false});
  let profiles={interactive:null,agentic:null,agenticEnabled:false},shared=null;
  try{profiles=runtime()?.readModelProfiles?.()||profiles;shared=runtime()?.readSharedConfig?.('interactive')||null}catch{}
  const interactive=profiles.interactive||shared||legacy;
  const route=providerName(interactive?.provider||interactive?.route);
  return{
    route,
    consent:Boolean(interactive?.externalConsent??legacy.consent),
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
function markup({inline=false}={}){
  return`<form class="cw-ai-settings-form${inline?' cw-ai-inline-form':''}" data-unified-model-settings data-version="${VERSION}">
    ${inline?'':`<header class="cw-ai-header"><div class="cw-ai-header-copy"><small>COMMONWEAVE MODEL ROUTES</small><h2>Choose how the guides think</h2><p>One shared form controls the Working Campus and the settings bar.</p></div><button class="cw-ai-close" type="button" data-close aria-label="Close settings">×</button></header>`}
    ${inline?'<div class="cw-ai-inline-intro"><small>COMMONWEAVE MODEL ROUTES</small><h2>Choose how the guides think</h2></div>':''}
    <label class="cw-ai-route-field"><span>Primary route</span><select name="route">
      <option value="bundled">Onboard Semantic Reflex</option>
      <option value="gemini">Google Gemini</option>
      <option value="ollama">Ollama or local API</option>
      <option value="openai-compatible">OpenAI-compatible endpoint</option>
    </select></label>

    <section class="cw-ai-route-panel" data-route-panel="bundled">
      <div class="cw-ai-panel-heading"><span class="cw-ai-orb is-local">✦</span><div><small>ON DEVICE</small><h3>MiniLM Semantic Reflex</h3></div></div>
      <p>MiniLM routes and retrieves locally without generating tokens. Commonweave composes responses from canonical state, consent rules, and matched response patterns.</p>
      <div class="cw-ai-package-state" data-package-state>Checking the local semantic package…</div>
      <div class="cw-ai-field-grid"><label>Semantic model<input value="${MODEL_ID}" readonly></label><label>Package manifest<input value="${MANIFEST}" readonly></label></div>
      <div class="cw-ai-fallback-contract"><b>Immediate fallback</b><span>A lexical reflex remains available in milliseconds. MiniLM improves matching after warmup and never blocks chat while loading.</span></div>
      <div class="cw-ai-actions"><button type="button" data-check-package>Check local package</button><button type="button" data-benchmark>Run reflex speed trial</button></div>
      <output class="cw-ai-test-status" data-test-status="bundled" role="status">The semantic package has not been checked yet.</output>
      <div class="cw-ai-benchmark" data-benchmark-output hidden></div>
    </section>

    <section class="cw-ai-route-panel" data-route-panel="gemini" hidden>
      <div class="cw-ai-panel-heading"><span class="cw-ai-orb is-gemini">G</span><div><small>REMOTE, OPT-IN</small><h3>Gemini + Antigravity</h3></div></div>
      <label class="cw-ai-secret-field">Gemini API key<input name="apiKey" type="password" maxlength="1000" autocomplete="off" spellcheck="false" placeholder="Paste or import a Gemini API key"></label>
      <div class="cw-ai-secret-tools"><button type="button" data-paste-key>Paste key</button><button type="button" data-import-key>Import .env / JSON</button><input data-key-file type="file" accept=".env,.txt,.json,text/plain,application/json" hidden></div>
      <div class="cw-ai-secret-note" data-secret-note>Credentials are held only for this browser session.</div>
      <div class="cw-ai-field-grid"><label>Conversation model<input name="geminiModel" maxlength="200" value="${GEMINI_MODEL}"></label><label>Google API endpoint<input name="geminiEndpoint" maxlength="2048" value="${GEMINI_ENDPOINT}"></label></div>
      <label class="cw-ai-consent"><input name="geminiConsent" type="checkbox"><span><b>Allow Gemini requests</b><small>Prompts may leave this device and go to Google only after this box is checked.</small></span></label>
      <label class="cw-ai-agent-toggle"><input name="agenticEnabled" type="checkbox"><span><b>Use Antigravity for agentic and background work</b><small>Conversation stays on Gemini. Tool-using or background work can use Antigravity when your key has access.</small></span></label>
      <div class="cw-ai-agent-options" data-agent-options hidden><label>Agentic model<input name="agenticModel" value="antigravity" readonly></label><p>Antigravity is tested separately. A Gemini fallback does not count as a successful Antigravity test.</p></div>
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
      <label class="cw-ai-consent"><input name="compatibleConsent" type="checkbox"><span><b>Allow remote requests</b><small>Required only when this endpoint leaves the device.</small></span></label>
      <div class="cw-ai-actions"><button type="button" data-test-provider>Test endpoint</button></div><output class="cw-ai-test-status" data-test-status="provider" role="status">No connection test has run.</output>
    </section>

    <footer class="cw-ai-form-footer"><p>Provider preferences are stored locally. Credentials stay in session storage and are excluded from exports and offline seeds.</p><div class="cw-ai-actions"><button type="submit" class="cw-ai-save">Save shared settings</button></div><output data-save-status role="status"></output></footer>
  </form>`;
}
function sync(form){
  const route=providerName(byName(form,'route').value);
  form.querySelectorAll('[data-route-panel]').forEach(panel=>panel.hidden=panel.dataset.routePanel!==route);
  const agentic=Boolean(byName(form,'agenticEnabled')?.checked);
  form.querySelector('[data-agent-options]').hidden=!(route==='gemini'&&agentic);
  form.querySelector('[data-agent-test-wrap]').hidden=!(route==='gemini'&&agentic);
  if(route==='gemini'){
    if(!byName(form,'geminiModel').value.trim())byName(form,'geminiModel').value=GEMINI_MODEL;
    if(!byName(form,'geminiEndpoint').value.trim())byName(form,'geminiEndpoint').value=GEMINI_ENDPOINT;
  }
  if(route==='ollama'&&!byName(form,'ollamaEndpoint').value.trim())byName(form,'ollamaEndpoint').value=OLLAMA_ENDPOINT;
}
function fill(form){
  const state=readState();
  byName(form,'route').value=state.route;
  byName(form,'geminiModel').value=state.geminiModel;
  byName(form,'geminiEndpoint').value=state.geminiEndpoint;
  byName(form,'geminiConsent').checked=state.consent;
  byName(form,'agenticEnabled').checked=state.agenticEnabled;
  byName(form,'agenticModel').value='antigravity';
  byName(form,'ollamaModel').value=state.ollamaModel;
  byName(form,'ollamaEndpoint').value=state.ollamaEndpoint;
  byName(form,'compatibleModel').value=state.compatibleModel;
  byName(form,'compatibleEndpoint').value=state.compatibleEndpoint;
  byName(form,'compatibleConsent').checked=state.consent;
  const keyInput=byName(form,'apiKey');
  keyInput.value='';
  keyInput.placeholder=state.hasKey?'A session key is loaded. Enter another to replace it.':'Paste or import a Gemini API key';
  form.querySelector('[data-secret-note]').textContent=state.hasKey?'A Gemini key is already loaded for this browser session.':'Credentials are held only for this browser session.';
  form.querySelector('[data-save-status]').textContent='';
  sync(form);
  checkPackage(form);
}
function setupFrom(form){
  const route=providerName(byName(form,'route').value),prior=existingKey();
  if(route==='bundled')return{route,key:'',consent:false,agentic:false,interactive:{route:'bundled',provider:'bundled',model:MODEL_ID,endpoint:MANIFEST,externalConsent:false},agenticConfig:null};
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
  localStorage.setItem(SETTINGS_KEY,JSON.stringify({route:setup.route,provider:setup.interactive.provider,model:setup.interactive.model,endpoint:setup.interactive.endpoint,consent:setup.consent,agenticEnabled:setup.agentic}));
  if(setup.key||setup.consent)sessionStorage.setItem(SESSION_KEY,JSON.stringify({apiKey:setup.key,remoteConsent:setup.consent,provider:setup.interactive.provider,savedAt:new Date().toISOString()}));
  else sessionStorage.removeItem(SESSION_KEY);
  const modelRuntime=runtime();
  if(modelRuntime){
    modelRuntime.saveSharedConfig(setup.interactive,{profile:'interactive'});
    if(setup.key||setup.consent)modelRuntime.saveSessionSecret(setup.interactive,{apiKey:setup.key,externalConsent:setup.consent});
    if(setup.agenticConfig){modelRuntime.saveSharedConfig(setup.agenticConfig,{profile:'agentic',enabled:true});modelRuntime.saveSessionSecret(setup.agenticConfig,{apiKey:setup.key,externalConsent:setup.consent})}
    else modelRuntime.saveModelProfiles({agenticEnabled:false});
  }
  dispatchEvent(new CustomEvent('commonweave:model-settings-saved',{detail:{version:VERSION,route:setup.route,interactive:setup.interactive,agentic:setup.agenticConfig,agenticEnabled:setup.agentic,hasSessionKey:Boolean(setup.key),savedAt:new Date().toISOString()}}));
}
function missingSummary(result){return(result?.missing||[]).map(item=>`${item.url.split('/').at(-1)} (${item.status||'network'}, ${Number(item.length||0)} bytes)`).join(', ')}
async function checkPackage(form){
  const status=form.querySelector('[data-package-state]');if(!status)return;
  status.textContent='Checking MiniLM, tokenizer, and local runtimes…';status.className='cw-ai-package-state';
  try{const result=await globalThis.CommonweaveReflexRuntime?.status?.();if(!result)throw new Error('Reflex runtime has not loaded.');status.textContent=result.available?'MiniLM semantic retrieval is ready. A lexical reflex remains available before model warmup.':`Semantic package is incomplete: ${missingSummary(result)}`;status.className=`cw-ai-package-state ${result.available?'is-ready':'is-missing'}`}
  catch(error){status.textContent=`Semantic package check failed: ${error.message}`;status.className='cw-ai-package-state is-missing'}
}
async function benchmark(form,button){
  const output=form.querySelector('[data-benchmark-output]'),status=form.querySelector('[data-test-status="bundled"]');button.disabled=true;output.hidden=false;status.textContent='Prewarming MiniLM and measuring five semantic matches…';
  const cases=[['mutual-aid','I wish I could get my friends to work together to form mutual aid networks and local food sources','mutual-aid-food-network'],['learning','I want to understand watershed testing and practice reading the results','learning-path'],['build','Repair a greenhouse vent and prove the work is complete','build-repair-project'],['exchange','Find reclaimed boards and borrow a trailer fairly','resource-exchange'],['governance','Draft how the neighborhood approves shared tool purchases','governance-proposal']].map(([id,text,expected])=>({id,text,expected}));
  try{const packageState=await globalThis.CommonweaveReflexRuntime.status();if(!packageState?.available)throw new Error(`Semantic package incomplete: ${missingSummary(packageState)}`);const warmStart=performance.now();const warm=await globalThis.CommonweaveReflexRuntime.prewarm();if(warm?.ready===false)throw new Error(warm.error||'MiniLM failed to initialize.');const warmMs=Math.round(performance.now()-warmStart);const trial=await globalThis.CommonweaveReflexRuntime.benchmark(cases);let correct=0;const rows=trial.results.map((result,index)=>{const expected=cases[index].expected,actual=result.matches?.[0]?.id||'';if(actual===expected)correct+=1;return`<li class="${actual===expected?'is-pass':'is-fail'}"><b>${esc(result.id)}</b>: ${esc(actual||result.error||'no match')} · ${result.elapsedMs} ms · ${esc(result.device||'lexical')}</li>`}).join('');output.innerHTML=`<b>${correct}/5 semantic matches correct</b><p>Cold prewarm: ${warmMs} ms. Five warm queries: ${trial.elapsedMs} ms. Chat never waits for this model; the lexical reflex answers immediately.</p><ol>${rows}</ol>`;status.textContent=`Reflex trial complete: ${correct}/5 matches. Warm queries averaged ${Math.round(trial.elapsedMs/5)} ms.`;status.className=`cw-ai-test-status ${correct>=4?'is-ok':'is-error'}`}
  catch(error){output.innerHTML=`<b>Trial failed.</b><p>${esc(error.message)}</p>`;status.textContent=`Reflex trial failed: ${error.message}`;status.className='cw-ai-test-status is-error'}finally{button.disabled=false}
}
function extractKey(text){
  const raw=String(text||'').trim();if(!raw)throw new Error('The selected source was empty.');
  try{const json=JSON.parse(raw),keys=['GEMINI_API_KEY','GOOGLE_API_KEY','GOOGLE_GENERATIVE_AI_API_KEY','geminiApiKey','googleApiKey','apiKey','key'];const visit=value=>{if(!value||typeof value!=='object')return'';for(const key of keys)if(typeof value[key]==='string'&&value[key].trim())return value[key].trim();for(const child of Object.values(value)){const found=visit(child);if(found)return found}return''};const found=visit(json);if(found)return found}catch{}
  const env=raw.match(/(?:^|\n)\s*(?:export\s+)?(?:GEMINI_API_KEY|GOOGLE_API_KEY|GOOGLE_GENERATIVE_AI_API_KEY)\s*=\s*["']?([^"'\r\n#]+)["']?/i);if(env?.[1])return env[1].trim();
  if(!/[\s={}]/.test(raw)&&raw.length>=20)return raw;
  throw new Error('No Gemini key was found. Use GEMINI_API_KEY, GOOGLE_API_KEY, JSON apiKey, or a raw key file.');
}
function setImportedKey(form,key,source){const input=byName(form,'apiKey');input.value=key;form.querySelector('[data-secret-note]').textContent=`Key loaded from ${source}. It will remain session-only unless you close this browser session.`;input.focus()}
async function pasteKey(form,button){button.disabled=true;try{if(!navigator.clipboard?.readText)throw new Error('Clipboard access is unavailable in this browser.');setImportedKey(form,extractKey(await navigator.clipboard.readText()),'the clipboard')}catch(error){form.querySelector('[data-secret-note]').textContent=`Could not paste a key: ${error.message}`}finally{button.disabled=false}}
async function importKey(form,file){try{if(!file)throw new Error('Choose a .env, .txt, or .json file.');setImportedKey(form,extractKey(await file.text()),file.name||'the selected file')}catch(error){form.querySelector('[data-secret-note]').textContent=`Could not import a key: ${error.message}`}}
async function testGemini(form,kind,button){
  const setup=setupFrom(form),status=form.querySelector(`[data-test-status="${kind}"]`);button.disabled=true;status.className='cw-ai-test-status';status.textContent=kind==='antigravity'?'Testing direct Antigravity access…':'Sending a one-word Gemini response test…';
  try{
    if(setup.route!=='gemini')throw new Error('Select Google Gemini first.');if(!setup.key)throw new Error('Enter, paste, or import a Gemini API key first.');if(!setup.consent)throw new Error('Enable Gemini requests before testing.');if(!runtime()?.generate)throw new Error('The shared model runtime has not loaded.');
    const controller=new AbortController(),timeoutMs=kind==='antigravity'?60000:30000,timer=setTimeout(()=>controller.abort(),timeoutMs);
    let result;try{const config=kind==='antigravity'?setup.agenticConfig:setup.interactive;if(kind==='antigravity'&&!config)throw new Error('Enable Antigravity before testing it.');result=await runtime().generate({purpose:`commonweave-${kind}-connection-test`,executionProfile:kind==='antigravity'?'agentic':'interactive',config:{...config,apiKey:setup.key,timeoutMs:timeoutMs-1000,maxTokens:48},signal:controller.signal,messages:[{role:'user',content:'Return the single word READY. Do not use tools.'}]})}finally{clearTimeout(timer)}
    const actualModel=String(result?.actual?.model||'').toLowerCase(),actualProvider=String(result?.actual?.provider||'').toLowerCase();if(result?.status!=='success')throw new Error(result?.error?.message||`The test ended with status ${result?.status||'unknown'}.`);if(actualProvider!=='gemini')throw new Error(`The request fell through to ${actualProvider||'another provider'}.`);if(kind==='antigravity'&&!actualModel.includes('antigravity'))throw new Error('Gemini answered, but Antigravity was unavailable or fell back.');if(kind==='gemini'&&actualModel.includes('antigravity'))throw new Error('The interactive test unexpectedly used Antigravity.');
    status.textContent=kind==='antigravity'?`Antigravity answered directly as ${result.actual.model}.`:`Gemini answered directly as ${result.actual.model}.`;status.className='cw-ai-test-status is-ok';
  }catch(error){status.textContent=`Test failed: ${error.message}`;status.className='cw-ai-test-status is-error'}finally{button.disabled=false}
}
async function testProvider(form,button){
  const setup=setupFrom(form),status=button.closest('[data-route-panel]').querySelector('[data-test-status="provider"]');button.disabled=true;status.textContent='Testing the selected endpoint…';status.className='cw-ai-test-status';
  try{if(!runtime()?.detectCapabilities)throw new Error('The shared model runtime has not loaded.');const capability=await runtime().detectCapabilities({...setup.interactive,apiKey:setup.key},{probe:true});if(capability.available===false)throw new Error(capability.notes?.join(' ')||'The provider did not answer.');status.textContent=`${capability.provider} is reachable with ${capability.model}.`;status.className='cw-ai-test-status is-ok'}catch(error){status.textContent=`Connection test failed: ${error.message}`;status.className='cw-ai-test-status is-error'}finally{button.disabled=false}
}
function bind(form){
  if(!form||form.dataset.unifiedModelBound==='true')return;form.dataset.unifiedModelBound='true';fill(form);
  byName(form,'route').addEventListener('change',()=>sync(form));byName(form,'agenticEnabled').addEventListener('change',()=>sync(form));form.querySelector('[data-check-package]')?.addEventListener('click',()=>checkPackage(form));form.querySelector('[data-benchmark]')?.addEventListener('click',event=>benchmark(form,event.currentTarget));form.querySelector('[data-paste-key]')?.addEventListener('click',event=>pasteKey(form,event.currentTarget));form.querySelector('[data-import-key]')?.addEventListener('click',()=>form.querySelector('[data-key-file]').click());form.querySelector('[data-key-file]')?.addEventListener('change',event=>{importKey(form,event.target.files?.[0]);event.target.value=''});form.querySelector('[data-test-gemini]')?.addEventListener('click',event=>testGemini(form,'gemini',event.currentTarget));form.querySelector('[data-test-antigravity]')?.addEventListener('click',event=>testGemini(form,'antigravity',event.currentTarget));form.querySelectorAll('[data-test-provider]').forEach(button=>button.addEventListener('click',()=>testProvider(form,button)));
  form.addEventListener('submit',event=>{event.preventDefault();const setup=setupFrom(form);persist(setup);form.querySelector('[data-save-status]').textContent=setup.route==='bundled'?'Saved the onboard semantic reflex.':setup.agentic?'Saved Gemini and Antigravity. MiniLM remains the immediate local fallback.':'Saved the selected provider. MiniLM remains the immediate local fallback.'});
}
function build(){
  let dialog=document.getElementById('cw-ai-settings-v157');if(dialog)return dialog;dialog=document.createElement('dialog');dialog.id='cw-ai-settings-v157';dialog.className='cw-ai-settings-dialog';dialog.innerHTML=markup();document.body.append(dialog);bind(dialog.querySelector('form'));dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});return dialog;
}
function open(){const dialog=build();fill(dialog.querySelector('form'));if(!dialog.open)dialog.showModal();return dialog}
function mount(target){const node=typeof target==='string'?document.querySelector(target):target;if(!node)throw new Error('A settings mount target is required.');node.innerHTML=`<section class="cw-ai-inline-card">${markup({inline:true})}</section>`;const form=node.querySelector('form');bind(form);return form}
const observer=new MutationObserver(()=>document.querySelectorAll('[data-unified-model-settings]').forEach(bind));observer.observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('click',event=>{const target=event.target.closest?.('[data-action="settings"],#lite-settings');if(!target||target.closest('[data-unified-model-settings]'))return;event.preventDefault();event.stopImmediatePropagation();open()},true);
globalThis.CommonweaveModelSettingsV157={version:VERSION,open,mount,inlineMarkup:()=>`<section class="cw-ai-inline-card">${markup({inline:true})}</section>`,readState,model:MODEL_ID,manifest:MANIFEST};
globalThis.CommonweaveModelSettingsV133=globalThis.CommonweaveModelSettingsV157;
})();
