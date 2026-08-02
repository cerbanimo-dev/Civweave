(()=>{
'use strict';
const SETTINGS_KEY='commonweave.universal-ai.v127';
const SESSION_KEY='commonweave-model-session';
const GEMINI_ENDPOINT='https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODEL='gemini-3.5-flash-lite';
const OLLAMA_ENDPOINT='http://127.0.0.1:11434/api/chat';
const MODEL_ID='HuggingFaceTB/SmolLM2-360M-Instruct';
const MODEL_LABEL='SmolLM2 360M Instruct';
const MODEL_MANIFEST='/app/models/smollm2-360m-instruct/model-manifest.json';
const MODEL_ADAPTER='/app/models/smollm2-360m-instruct/adapter.js';
const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed==null?fallback:parsed}catch{return fallback}};
const runtime=()=>globalThis.CommonweaveModelRuntime||null;
let adapterPromise=null;

function providerName(value){
  const provider=String(value||'bundled').toLowerCase();
  if(['deterministic','browser','bundled','packaged','smollm2','functiongemma'].includes(provider))return 'bundled';
  if(['openai','compatible','openai-compatible'].includes(provider))return 'openai-compatible';
  if(provider==='local-api')return 'ollama';
  return ['gemini','ollama','openai-compatible','hosted'].includes(provider)?provider:'bundled';
}

function report(kind,detail={}){
  try{fetch('/api/boot-log',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({schema:'commonweave.boot-log.v1',time:new Date().toISOString(),version:'1.0.30',build:'smollm2-onboard-r6',kind:`model-settings-v134:${kind}`,url:location.href,detail}),keepalive:true,cache:'no-store'}).catch(()=>{})}catch{}
}

function existingKey(){
  try{const key=runtime()?.readSharedConfig?.('interactive')?.apiKey;if(key)return key}catch{}
  return parse(sessionStorage.getItem(SESSION_KEY),{}).apiKey||'';
}

function readState(){
  const legacy=parse(localStorage.getItem(SETTINGS_KEY),{route:'bundled',model:MODEL_ID,endpoint:MODEL_MANIFEST,consent:false,agenticEnabled:false});
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

async function adapter(){
  if(!adapterPromise)adapterPromise=import(MODEL_ADAPTER).catch(error=>{adapterPromise=null;throw error});
  return adapterPromise;
}

function formMarkup({inline=false}={}){
  return `<form class="cw-ai-settings-form${inline?' cw-ai-inline-form':''}" data-smol-settings-form>
    ${inline?'':`<header><div><small>UNIVERSAL AI SETTINGS</small><h2>Choose the Compass mind</h2></div><button class="cw127-close" type="button" data-close aria-label="Close">×</button></header>`}
    ${inline?'<small class="kicker">UNIVERSAL AI SETTINGS</small><h2>Choose the Compass mind</h2>':''}
    <label>Route<select name="route">
      <option value="bundled">Onboard SmolLM2 360M</option>
      <option value="gemini">Google Gemini</option>
      <option value="ollama">Ollama or local API</option>
      <option value="openai-compatible">OpenAI-compatible endpoint</option>
    </select></label>

    <section class="cw-ai-route-panel" data-route-panel="bundled">
      <p><b>${MODEL_LABEL}</b> runs on this device as a real onboard guide. It also becomes the degraded-mode floor beneath every other provider call.</p>
      <div class="cw-ai-package-state" data-package-state>Checking the local package…</div>
      <label>Onboard model<input value="${MODEL_ID}" readonly></label>
      <label>Package manifest<input value="${MODEL_MANIFEST}" readonly></label>
      <div class="cw-ai-fallback-contract"><b>Fallback expectation</b><span>Useful within evidence, explicit about uncertainty, no invented network or tool activity, no claim that external actions occurred, and consent preserved.</span></div>
      <div class="cw-ai-actions"><button type="button" data-test-package>Check local package</button><button type="button" data-benchmark>Run five-prompt trial</button></div>
      <output class="cw-ai-test-status" data-test-status role="status">The local package has not been checked yet.</output>
      <div class="cw-ai-benchmark" data-benchmark-output hidden></div>
    </section>

    <section class="cw-ai-route-panel" data-route-panel="gemini" hidden>
      <label>Gemini API key<input name="apiKey" type="password" maxlength="1000" autocomplete="off" spellcheck="false" placeholder="Paste a Google Gemini API key"></label>
      <div class="cw-ai-secret-note" data-secret-note></div>
      <label>Model<input name="geminiModel" maxlength="200" value="${GEMINI_MODEL}"></label>
      <label>Google API endpoint<input name="geminiEndpoint" maxlength="2048" value="${GEMINI_ENDPOINT}"></label>
      <label class="cw-ai-consent"><input name="geminiConsent" type="checkbox"><span>Allow prompts to leave this device for Google’s Gemini API.</span></label>
      <label class="cw-ai-agent-toggle"><input name="agenticEnabled" type="checkbox"><span><b>Use Antigravity for agentic and background work</b><small>Standard conversation stays on Gemini. Longer tool-using work uses Antigravity. SmolLM2 remains the local fallback if both fail.</small></span></label>
      <div class="cw-ai-agent-options" data-agent-options hidden><label>Agentic model<input name="agenticModel" value="antigravity" readonly></label><p>Antigravity may use managed code execution, Google Search, and URL Context through the shared runtime.</p></div>
      <div class="cw-ai-actions"><button type="button" data-test-provider>Test Gemini connection</button></div>
      <output class="cw-ai-test-status" data-test-status role="status">No connection test has been run.</output>
    </section>

    <section class="cw-ai-route-panel" data-route-panel="ollama" hidden>
      <label>Model<input name="ollamaModel" value="llama3.2"></label>
      <label>Endpoint<input name="ollamaEndpoint" value="${OLLAMA_ENDPOINT}"></label>
      <div class="cw-ai-actions"><button type="button" data-test-provider>Test local model</button></div>
      <output class="cw-ai-test-status" data-test-status role="status">No connection test has been run.</output>
    </section>

    <section class="cw-ai-route-panel" data-route-panel="openai-compatible" hidden>
      <label>Model<input name="compatibleModel" value="local-model"></label>
      <label>Endpoint<input name="compatibleEndpoint" placeholder="http://127.0.0.1:8000/v1/chat/completions"></label>
      <label>Bearer token or API key<input name="compatibleApiKey" type="password" maxlength="1000" autocomplete="off" spellcheck="false" placeholder="Optional session-only credential"></label>
      <label class="cw-ai-consent"><input name="compatibleConsent" type="checkbox"><span>Allow prompts to leave this device when the endpoint is remote.</span></label>
      <div class="cw-ai-actions"><button type="button" data-test-provider>Test endpoint</button></div>
      <output class="cw-ai-test-status" data-test-status role="status">No connection test has been run.</output>
    </section>

    <p>Provider preferences are stored locally. API keys remain in session storage and are excluded from exports and offline seeds.</p>
    <menu class="cw-ai-actions"><button type="submit">Save settings</button></menu>
    <output data-save-status role="status"></output>
  </form>`;
}

function sync(form){
  const route=providerName(form.route.value);
  form.querySelectorAll('[data-route-panel]').forEach(panel=>panel.hidden=panel.dataset.routePanel!==route);
  const agent=form.querySelector('[data-agent-options]');
  if(agent)agent.hidden=!(route==='gemini'&&form.agenticEnabled.checked);
  if(route==='gemini'){
    if(!form.geminiEndpoint.value.trim())form.geminiEndpoint.value=GEMINI_ENDPOINT;
    if(!form.geminiModel.value.trim())form.geminiModel.value=GEMINI_MODEL;
  }
  if(route==='ollama'&&!form.ollamaEndpoint.value.trim())form.ollamaEndpoint.value=OLLAMA_ENDPOINT;
}

function fill(form){
  const state=readState();
  form.route.value=state.route;
  form.geminiModel.value=state.geminiModel;
  form.geminiEndpoint.value=state.geminiEndpoint;
  form.geminiConsent.checked=state.consent;
  form.agenticEnabled.checked=state.agenticEnabled;
  form.agenticModel.value=state.agenticModel;
  form.ollamaModel.value=state.ollamaModel;
  form.ollamaEndpoint.value=state.ollamaEndpoint;
  form.compatibleModel.value=state.compatibleModel;
  form.compatibleEndpoint.value=state.compatibleEndpoint;
  form.compatibleConsent.checked=state.consent;
  form.apiKey.placeholder=state.hasKey?'Session key already loaded. Enter another to replace it.':'Paste a Google Gemini API key';
  form.querySelector('[data-secret-note]').textContent=state.hasKey?'A Gemini key is loaded for this browser session.':'The key will be held only for this browser session.';
  form.querySelector('[data-save-status]').textContent='';
  sync(form);
  updatePackageState(form);
}

function configFrom(form){
  const route=providerName(form.route.value);
  const prior=existingKey();
  if(route==='bundled')return {route,key:'',externalConsent:false,agenticEnabled:false,interactive:{route:'bundled',provider:'bundled',model:MODEL_ID,endpoint:MODEL_MANIFEST,externalConsent:false,maxTokens:420,timeoutMs:180000},agentic:null};
  if(route==='gemini'){
    const key=String(form.apiKey.value||'').trim()||prior;
    const externalConsent=form.geminiConsent.checked;
    const agenticEnabled=form.agenticEnabled.checked;
    const interactive={route:'gemini',provider:'gemini',model:form.geminiModel.value.trim()||GEMINI_MODEL,endpoint:form.geminiEndpoint.value.trim()||GEMINI_ENDPOINT,externalConsent};
    return {route,key,externalConsent,agenticEnabled,interactive,agentic:agenticEnabled?{route:'gemini',provider:'gemini',model:'antigravity',endpoint:interactive.endpoint,externalConsent}:null};
  }
  if(route==='ollama')return {route,key:'',externalConsent:false,agenticEnabled:false,interactive:{route:'ollama',provider:'ollama',model:form.ollamaModel.value.trim()||'llama3.2',endpoint:form.ollamaEndpoint.value.trim()||OLLAMA_ENDPOINT,externalConsent:false},agentic:null};
  const key=String(form.compatibleApiKey.value||'').trim()||prior;
  const externalConsent=form.compatibleConsent.checked;
  return {route:'openai-compatible',key,externalConsent,agenticEnabled:false,interactive:{route:'openai-compatible',provider:'openai-compatible',model:form.compatibleModel.value.trim()||'local-model',endpoint:form.compatibleEndpoint.value.trim(),externalConsent},agentic:null};
}

function persist(setup){
  localStorage.setItem(SETTINGS_KEY,JSON.stringify({route:setup.route,provider:setup.interactive.provider,model:setup.interactive.model,endpoint:setup.interactive.endpoint,consent:setup.externalConsent,agenticEnabled:setup.agenticEnabled}));
  if(setup.key||setup.externalConsent)sessionStorage.setItem(SESSION_KEY,JSON.stringify({apiKey:setup.key,remoteConsent:setup.externalConsent,provider:setup.interactive.provider,savedAt:new Date().toISOString()}));
  else if(['bundled','ollama'].includes(setup.route))sessionStorage.removeItem(SESSION_KEY);
  const modelRuntime=runtime();
  if(!modelRuntime)return;
  modelRuntime.saveSharedConfig(setup.interactive,{profile:'interactive'});
  if(setup.key||setup.externalConsent)modelRuntime.saveSessionSecret(setup.interactive,{apiKey:setup.key,externalConsent:setup.externalConsent});
  if(setup.agentic){
    modelRuntime.saveSharedConfig(setup.agentic,{profile:'agentic',enabled:true});
    if(setup.key||setup.externalConsent)modelRuntime.saveSessionSecret(setup.agentic,{apiKey:setup.key,externalConsent:setup.externalConsent});
  }else modelRuntime.saveModelProfiles({agenticEnabled:false});
}

async function updatePackageState(form){
  const state=form.querySelector('[data-package-state]');
  if(!state)return;
  state.textContent='Checking the local SmolLM2 package…';
  state.className='cw-ai-package-state';
  try{
    const result=await (await adapter()).status();
    state.textContent=result.available?'SmolLM2, tokenizer, ONNX graph, and Transformers.js runtime are present.':`SmolLM2 is incomplete. Missing: ${result.missing.map(item=>item.url.split('/').at(-1)).join(', ')||'unknown files'}.`;
    state.className=`cw-ai-package-state ${result.available?'is-ready':'is-missing'}`;
  }catch(error){
    state.textContent=`SmolLM2 package check failed: ${error.message}`;
    state.className='cw-ai-package-state is-missing';
  }
}

async function testProvider(form,button){
  const setup=configFrom(form);
  const panel=button.closest('[data-route-panel]');
  const status=panel.querySelector('[data-test-status]');
  button.disabled=true;
  status.textContent='Testing the selected route…';
  status.className='cw-ai-test-status';
  try{
    if(setup.route==='gemini'&&!setup.key)throw new Error('Enter a Gemini API key first.');
    if(setup.route==='gemini'&&!setup.externalConsent)throw new Error('Enable remote-prompt consent before testing Gemini.');
    if(!runtime()?.detectCapabilities)throw new Error('The shared model runtime has not loaded.');
    const capability=await runtime().detectCapabilities({...setup.interactive,apiKey:setup.key},{probe:true});
    if(capability.available===false)throw new Error(`${capability.provider} did not answer the capability probe.`);
    status.textContent=`${capability.provider} is reachable with ${capability.model}. SmolLM2 remains armed beneath it.`;
    status.className='cw-ai-test-status is-ok';
    report('provider-tested',{provider:capability.provider,model:capability.model,available:capability.available});
  }catch(error){
    status.textContent=`Connection test failed: ${error.message}`;
    status.className='cw-ai-test-status is-error';
    report('provider-test-failed',{route:setup.route,message:error.message,code:error.code||null});
  }finally{button.disabled=false}
}

function benchmarkCases(){
  const schema={type:'object',required:['system','mode','nextAction'],properties:{system:{type:'string'},mode:{type:'string'},nextAction:{type:'string'}}};
  const items=[
    ['learning','I want to understand local watershed testing and practice reading the results.','living-school','Learn'],
    ['build','Help me repair a broken community greenhouse vent and prove the work is complete.','cerbanimo','Build'],
    ['exchange','We need twelve reclaimed boards and a way to borrow a trailer fairly.','fellowfare','Acquire'],
    ['governance','Draft a proposal for how the neighborhood approves shared tool purchases.','anarchadia','Govern'],
    ['reflection','I have too many projects and need to decide what deserves attention first.','commonweave','Reflect']
  ];
  return items.map(([id,text,system,mode])=>({
    id,expected:{system,mode},maxNewTokens:140,
    messages:[
      {role:'system',content:'You are Commonweave’s small onboard routing guide. Return only JSON with system, mode, and nextAction. Do not use markdown.'},
      {role:'user',content:JSON.stringify({question:'Which Commonweave system owns the next useful action?',message:text,systems:['commonweave','living-school','cerbanimo','fellowfare','anarchadia'],schema})}
    ]
  }));
}

async function runBenchmark(form,button){
  const output=form.querySelector('[data-benchmark-output]');
  const status=form.querySelector('[data-route-panel="bundled"] [data-test-status]');
  button.disabled=true;
  output.hidden=false;
  output.innerHTML='<b>SmolLM2 trial starting…</b><p>The first run loads the local ONNX graph and may take noticeably longer.</p>';
  status.textContent='Loading SmolLM2 and running five local prompts…';
  status.className='cw-ai-test-status';
  try{
    const engine=await adapter();
    const availability=await engine.status();
    if(!availability.available)throw new Error(`The package is incomplete: ${availability.missing.map(item=>item.url).join(', ')}`);
    const cases=benchmarkCases();
    const trial=await engine.benchmark(cases,{timeoutMs:240000,maxNewTokens:140});
    let jsonValid=0,routeCorrect=0;
    const rows=trial.results.map((result,index)=>{
      const spec=cases[index];
      let parsed=null;
      if(result.ok){try{parsed=JSON.parse(result.text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));jsonValid+=1}catch{}}
      const correct=parsed?.system===spec.expected.system;
      if(correct)routeCorrect+=1;
      return `<li class="${correct?'is-pass':'is-fail'}"><b>${spec.id}</b>: ${result.ok?`${parsed?`${parsed.system} · ${parsed.mode}`:'invalid JSON'} · ${result.elapsedMs} ms · ${result.device}`:`failed · ${result.error}`}</li>`;
    }).join('');
    output.innerHTML=`<b>${routeCorrect}/${cases.length} routes correct · ${jsonValid}/${cases.length} valid JSON</b><p>Total trial time: ${(trial.elapsedMs/1000).toFixed(1)} seconds.</p><ol>${rows}</ol>`;
    status.textContent=`Trial complete: ${routeCorrect}/${cases.length} route choices correct and ${jsonValid}/${cases.length} valid JSON responses.`;
    status.className=`cw-ai-test-status ${routeCorrect>=4&&jsonValid>=4?'is-ok':'is-error'}`;
    report('smollm2-benchmark',{routeCorrect,jsonValid,total:cases.length,elapsedMs:trial.elapsedMs,results:trial.results.map(result=>({id:result.id,ok:result.ok,elapsedMs:result.elapsedMs,device:result.device||null,code:result.code||null}))});
  }catch(error){
    output.innerHTML=`<b>Trial could not run.</b><p>${String(error.message)}</p>`;
    status.textContent=`SmolLM2 trial failed: ${error.message}`;
    status.className='cw-ai-test-status is-error';
    report('smollm2-benchmark-failed',{message:error.message,code:error.code||null});
  }finally{button.disabled=false}
}

function bind(form){
  if(!form||form.dataset.smollm2SettingsBound==='true')return;
  form.dataset.smollm2SettingsBound='true';
  fill(form);
  form.route.addEventListener('change',()=>sync(form));
  form.agenticEnabled.addEventListener('change',()=>sync(form));
  form.querySelector('[data-test-package]')?.addEventListener('click',()=>updatePackageState(form));
  form.querySelector('[data-benchmark]')?.addEventListener('click',event=>runBenchmark(form,event.currentTarget));
  form.querySelectorAll('[data-test-provider]').forEach(button=>button.addEventListener('click',()=>testProvider(form,button)));
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const setup=configFrom(form);
    persist(setup);
    form.querySelector('[data-save-status]').textContent=setup.route==='bundled'?'SmolLM2 is now the active onboard guide and remains the fallback for all other routes.':setup.agenticEnabled?'Saved Gemini and Antigravity. SmolLM2 remains the onboard fallback.':'Saved the selected provider. SmolLM2 remains the onboard fallback.';
    report('saved',{route:setup.route,provider:setup.interactive.provider,model:setup.interactive.model,hasSessionKey:Boolean(setup.key),consent:setup.externalConsent,agenticEnabled:setup.agenticEnabled});
  });
}

function buildDialog(){
  let node=document.getElementById('cw-ai-settings-v134');
  if(node)return node;
  node=document.createElement('dialog');
  node.id='cw-ai-settings-v134';
  node.className='cw127-dialog cw-ai-settings-dialog';
  node.innerHTML=formMarkup();
  document.body.append(node);
  const form=node.querySelector('form');
  bind(form);
  node.querySelector('[data-close]').onclick=()=>node.close();
  node.addEventListener('click',event=>{if(event.target===node)node.close()});
  return node;
}

function open(){
  for(const id of ['cw127-settings','cw128-settings','cw-ai-settings-v132','cw-ai-settings-v133']){
    const old=document.getElementById(id);
    if(old?.open){try{old.close()}catch{old.removeAttribute('open')}}
  }
  const dialog=buildDialog();
  fill(dialog.querySelector('form'));
  if(!dialog.open)dialog.showModal();
}

function scanInline(){document.querySelectorAll('[data-smol-settings-form]').forEach(bind)}
const observer=new MutationObserver(scanInline);
observer.observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('click',event=>{
  const target=event.target.closest?.('[data-action="settings"],#lite-settings');
  if(target&&!target.closest('[data-smol-settings-form]')){event.preventDefault();event.stopImmediatePropagation();open()}
},true);
addEventListener('DOMContentLoaded',scanInline,{once:true});
globalThis.CommonweaveModelSettingsV133={open,inlineMarkup:()=>`<section class="cw-ai-inline-card">${formMarkup({inline:true})}</section>`,model:MODEL_ID,manifest:MODEL_MANIFEST};
})();
