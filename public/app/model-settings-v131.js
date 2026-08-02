(()=>{
"use strict";
const MODEL_SESSION_KEY="commonweave-model-session";
const routeName=value=>{
  const provider=String(value||"deterministic").toLowerCase();
  if(["openai-compatible","openai","compatible"].includes(provider))return "compatible";
  if(provider==="local-api")return "ollama";
  return ["deterministic","gemini","ollama","compatible"].includes(provider)?provider:"deterministic";
};
const modelState=()=>{
  const legacy=parse(localStorage.getItem(SETTINGS_KEY),{route:"deterministic",model:"Weaveling local planner",endpoint:"",consent:false,agenticEnabled:false});
  const runtime=globalThis.CommonweaveModelRuntime;
  let profiles={interactive:null,agentic:null,agenticEnabled:false};
  let resolved=null;
  try{profiles=runtime?.readModelProfiles?.()||profiles;resolved=runtime?.readSharedConfig?.("interactive")||null}catch{}
  const interactive=profiles.interactive||resolved||legacy;
  const route=routeName(interactive?.route||interactive?.provider||legacy.route);
  const model=String(interactive?.model||legacy.model||"").trim();
  const endpoint=String(interactive?.endpoint||legacy.endpoint||"").trim();
  const session=parse(sessionStorage.getItem(MODEL_SESSION_KEY),{});
  let hasSessionKey=Boolean(session?.apiKey);
  try{hasSessionKey=hasSessionKey||Boolean(runtime?.readSharedConfig?.("interactive")?.apiKey)}catch{}
  return {
    route,
    consent:Boolean(resolved?.externalConsent??session?.remoteConsent??legacy.consent),
    hasSessionKey,
    agenticEnabled:Boolean(profiles.agenticEnabled&&profiles.agentic),
    agenticModel:String(profiles.agentic?.model||"antigravity"),
    interactiveModel:route==="gemini"&&!/^antigravity/i.test(model)?model:"gemini-3.5-flash-lite",
    geminiEndpoint:route==="gemini"?(endpoint||"https://generativelanguage.googleapis.com/v1beta"):"https://generativelanguage.googleapis.com/v1beta",
    ollamaModel:route==="ollama"?(model||"llama3.2"):"llama3.2",
    ollamaEndpoint:route==="ollama"?(endpoint||"http://127.0.0.1:11434/api/chat"):"http://127.0.0.1:11434/api/chat",
    compatibleModel:route==="compatible"?(model||"local-model"):"local-model",
    compatibleEndpoint:route==="compatible"?endpoint:"",
    deterministicModel:route==="deterministic"?(model||"Weaveling local planner"):"Weaveling local planner"
  };
};
const previousRenderNative=renderNative;
renderNative=function modelAwareRenderNative(capability){
  if(capability.id!=="commonweave.model-setup")return previousRenderNative(capability);
  const s=modelState();
  return `<section class="native-panel"><small class="kicker">COMPASS CALIBRATION</small><h2>Choose the model route</h2><p>This preference is shared by Weaveling and the four guides. Provider settings are local. API keys remain in this tab only.</p>
  <form data-native-form="model">
    <label>Route<select name="route" data-model-route-select>
      <option value="deterministic" ${s.route==="deterministic"?"selected":""}>Private local planner</option>
      <option value="gemini" ${s.route==="gemini"?"selected":""}>Google Gemini</option>
      <option value="ollama" ${s.route==="ollama"?"selected":""}>Ollama or local API</option>
      <option value="compatible" ${s.route==="compatible"?"selected":""}>OpenAI-compatible endpoint</option>
    </select></label>

    <section class="model-route-panel" data-model-route-panel="deterministic" ${s.route==="deterministic"?"":"hidden"}>
      <div class="provider-note">Runs inside Commonweave with the deterministic planning compiler. No prompt leaves the device.</div>
      <label>Planner label<input name="deterministicModel" maxlength="200" value="${esc(s.deterministicModel)}"></label>
    </section>

    <section class="model-route-panel" data-model-route-panel="gemini" ${s.route==="gemini"?"":"hidden"}>
      <div class="provider-note">Uses Gemini’s native <code>generateContent</code> route. The same session key can power Antigravity for longer agentic work.</div>
      <label>Gemini API key<input name="apiKey" type="password" maxlength="1000" autocomplete="off" spellcheck="false" placeholder="${s.hasSessionKey?"Session key already loaded":"Paste a Google Gemini API key"}"></label>
      <div class="secret-state">${s.hasSessionKey?"A Gemini key is loaded for this tab. Enter another only to replace it.":"The key is kept in session storage, excluded from exports, and disappears with the tab session."}</div>
      <label>Interactive Gemini model<input name="geminiModel" maxlength="200" value="${esc(s.interactiveModel)}" placeholder="gemini-3.5-flash-lite"></label>
      <label>Gemini API root<input name="geminiEndpoint" maxlength="2048" value="${esc(s.geminiEndpoint)}"></label>
      <label class="consent-box"><input name="consent" type="checkbox" ${s.consent?"checked":""}><span>Allow prompts to leave this device for Google’s Gemini API.</span></label>
      <label class="model-agent-toggle"><input name="agenticEnabled" type="checkbox" ${s.agenticEnabled?"checked":""} data-antigravity-toggle><span><b>Use Antigravity for agentic and background tasks</b><small>Antigravity uses Google’s managed interactions route with code execution, Google Search, and URL Context. Permission failure falls back to the interactive Gemini profile instead of blocking the task.</small></span></label>
      <div class="antigravity-options" data-antigravity-options ${s.agenticEnabled?"":"hidden"}>
        <label>Agentic model<input name="agenticModel" value="${esc(s.agenticModel||"antigravity")}" readonly></label>
        <div class="provider-note">Standard chat remains on <b>${esc(s.interactiveModel)}</b>. Agentic work uses <b>antigravity</b> with the same session-only key.</div>
      </div>
      <div class="native-actions"><button type="button" data-model-test>Test Gemini connection</button></div>
      <div class="model-test-status" data-model-test-status role="status">No connection test has been run in this session.</div>
    </section>

    <section class="model-route-panel" data-model-route-panel="ollama" ${s.route==="ollama"?"":"hidden"}>
      <div class="provider-note">Connects to a model on this device or local network.</div>
      <label>Model<input name="ollamaModel" maxlength="200" value="${esc(s.ollamaModel)}"></label>
      <label>Endpoint<input name="ollamaEndpoint" maxlength="2048" value="${esc(s.ollamaEndpoint)}"></label>
      <div class="native-actions"><button type="button" data-model-test>Test local model</button></div>
      <div class="model-test-status" data-model-test-status role="status">No connection test has been run in this session.</div>
    </section>

    <section class="model-route-panel" data-model-route-panel="compatible" ${s.route==="compatible"?"":"hidden"}>
      <div class="provider-note">Connects to an OpenAI-compatible local or remote endpoint.</div>
      <label>Model<input name="compatibleModel" maxlength="200" value="${esc(s.compatibleModel)}"></label>
      <label>Endpoint<input name="compatibleEndpoint" maxlength="2048" value="${esc(s.compatibleEndpoint)}" placeholder="http://127.0.0.1:8000/v1/chat/completions"></label>
      <label>Bearer token or API key<input name="compatibleApiKey" type="password" maxlength="1000" autocomplete="off" spellcheck="false" placeholder="Optional session-only credential"></label>
      <label class="consent-box"><input name="compatibleConsent" type="checkbox" ${s.consent?"checked":""}><span>Allow prompts to leave this device when the endpoint is not local.</span></label>
      <div class="native-actions"><button type="button" data-model-test>Test endpoint</button></div>
      <div class="model-test-status" data-model-test-status role="status">No connection test has been run in this session.</div>
    </section>

    <div class="native-actions"><button class="primary" type="submit">Save model setup</button></div>
  </form></section>`;
};
const sync=form=>{
  if(!form)return;
  const route=String(form.elements.route?.value||"deterministic");
  form.querySelectorAll("[data-model-route-panel]").forEach(panel=>panel.hidden=panel.dataset.modelRoutePanel!==route);
  const options=form.querySelector("[data-antigravity-options]");
  if(options)options.hidden=!(route==="gemini"&&form.querySelector("[data-antigravity-toggle]")?.checked);
};
const sessionKey=()=>{
  try{const key=globalThis.CommonweaveModelRuntime?.readSharedConfig?.("interactive")?.apiKey;if(key)return key}catch{}
  return parse(sessionStorage.getItem(MODEL_SESSION_KEY),{})?.apiKey||"";
};
const fromForm=form=>{
  const data=new FormData(form);
  const route=String(data.get("route")||"deterministic");
  const existingKey=sessionKey();
  if(route==="gemini"){
    const apiKey=String(data.get("apiKey")||"").trim()||existingKey;
    const endpoint=String(data.get("geminiEndpoint")||"").trim()||"https://generativelanguage.googleapis.com/v1beta";
    const model=String(data.get("geminiModel")||"").trim()||"gemini-3.5-flash-lite";
    const externalConsent=data.get("consent")==="on";
    const agenticEnabled=data.get("agenticEnabled")==="on";
    return {route,apiKey,externalConsent,agenticEnabled,interactive:{route:"gemini",provider:"gemini",model,endpoint,externalConsent},agentic:agenticEnabled?{route:"gemini",provider:"gemini",model:"antigravity",endpoint,externalConsent}:null,legacy:{route,model,endpoint,consent:externalConsent,agenticEnabled}};
  }
  if(route==="ollama"){
    const model=String(data.get("ollamaModel")||"").trim()||"llama3.2";
    const endpoint=String(data.get("ollamaEndpoint")||"").trim()||"http://127.0.0.1:11434/api/chat";
    return {route,apiKey:"",externalConsent:false,agenticEnabled:false,interactive:{route:"ollama",provider:"ollama",model,endpoint,externalConsent:false},agentic:null,legacy:{route,model,endpoint,consent:false,agenticEnabled:false}};
  }
  if(route==="compatible"){
    const model=String(data.get("compatibleModel")||"").trim()||"local-model";
    const endpoint=String(data.get("compatibleEndpoint")||"").trim();
    const apiKey=String(data.get("compatibleApiKey")||"").trim()||existingKey;
    const externalConsent=data.get("compatibleConsent")==="on";
    return {route,apiKey,externalConsent,agenticEnabled:false,interactive:{route:"compatible",provider:"openai-compatible",model,endpoint,externalConsent},agentic:null,legacy:{route,model,endpoint,consent:externalConsent,agenticEnabled:false}};
  }
  const model=String(data.get("deterministicModel")||"").trim()||"Weaveling local planner";
  return {route:"deterministic",apiKey:"",externalConsent:false,agenticEnabled:false,interactive:{route:"deterministic",provider:"deterministic",model,endpoint:"",externalConsent:false},agentic:null,legacy:{route:"deterministic",model,endpoint:"",consent:false,agenticEnabled:false}};
};
const save=form=>{
  const setup=fromForm(form);
  const runtime=globalThis.CommonweaveModelRuntime;
  localStorage.setItem(SETTINGS_KEY,JSON.stringify(setup.legacy));
  if(setup.apiKey||setup.externalConsent)sessionStorage.setItem(MODEL_SESSION_KEY,JSON.stringify({apiKey:setup.apiKey,remoteConsent:setup.externalConsent,provider:setup.interactive.provider,savedAt:new Date().toISOString()}));
  else if(["deterministic","ollama"].includes(setup.route))sessionStorage.removeItem(MODEL_SESSION_KEY);
  if(runtime){
    runtime.saveSharedConfig(setup.interactive,{profile:"interactive"});
    if(setup.apiKey||setup.externalConsent)runtime.saveSessionSecret(setup.interactive,{apiKey:setup.apiKey,externalConsent:setup.externalConsent});
    if(setup.agentic){
      runtime.saveSharedConfig(setup.agentic,{profile:"agentic",enabled:true});
      if(setup.apiKey||setup.externalConsent)runtime.saveSessionSecret(setup.agentic,{apiKey:setup.apiKey,externalConsent:setup.externalConsent});
    }else runtime.saveModelProfiles({agenticEnabled:false});
  }
  return setup;
};
const test=async(form,button)=>{
  const runtime=globalThis.CommonweaveModelRuntime;
  const setup=fromForm(form);
  const status=form.querySelector('[data-model-route-panel]:not([hidden]) [data-model-test-status]');
  if(!runtime){status.textContent="The shared model runtime has not loaded.";status.className="model-test-status is-error";return}
  if(setup.route==="gemini"&&!setup.apiKey){status.textContent="Enter a Gemini API key or load one for this tab first.";status.className="model-test-status is-error";return}
  if(setup.route==="gemini"&&!setup.externalConsent){status.textContent="Remote consent is required before testing Gemini.";status.className="model-test-status is-error";return}
  button.disabled=true;status.textContent="Testing the selected route…";status.className="model-test-status";
  try{
    const capability=await runtime.detectCapabilities({...setup.interactive,apiKey:setup.apiKey},{probe:true});
    let message=capability.available===false?`${capability.provider} did not answer the capability probe.`:`${capability.provider} is reachable with ${capability.model}.`;
    if(setup.agenticEnabled){
      const agent=await runtime.detectCapabilities({...setup.agentic,apiKey:setup.apiKey},{probe:false});
      if(agent.backgroundAgent)message+=" Antigravity is registered as the agentic profile; managed access is confirmed when its first interaction starts.";
    }
    status.textContent=message+(Array.isArray(capability.notes)&&capability.notes.length?` ${capability.notes.join(" ")}`:"");
    status.className=`model-test-status ${capability.available===false?"is-error":"is-ok"}`;
    report("model-tested",{route:setup.route,provider:capability.provider,model:capability.model,available:capability.available,agenticEnabled:setup.agenticEnabled});
  }catch(error){
    status.textContent=`Connection test failed: ${error.message}`;
    status.className="model-test-status is-error";
    report("model-test-failed",{route:setup.route,message:error.message,code:error.code||null});
  }finally{button.disabled=false}
};
document.addEventListener("change",event=>{
  const form=event.target.closest?.('[data-native-form="model"]');
  if(form&&event.target.matches("[data-model-route-select],[data-antigravity-toggle]"))sync(form);
});
document.addEventListener("click",event=>{
  const button=event.target.closest?.("[data-model-test]");
  if(button){const form=button.closest('[data-native-form="model"]');if(form)test(form,button)}
});
document.addEventListener("submit",event=>{
  const form=event.target.closest?.('[data-native-form="model"]');
  if(!form)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const setup=save(form);
  toast(setup.agenticEnabled?"Gemini and Antigravity profiles saved for every guide.":"Model setup saved for every guide.");
  report("model-saved",{route:setup.route,provider:setup.interactive.provider,model:setup.interactive.model,hasEndpoint:Boolean(setup.interactive.endpoint),hasSessionKey:Boolean(setup.apiKey),consent:setup.externalConsent,agenticEnabled:setup.agenticEnabled});
  render();
},true);
})();