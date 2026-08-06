(()=>{
'use strict';
const VERSION='228.0-gemini-defaults-device-persistence';
if(globalThis.CivweaveAISettingsRepairV228?.version===VERSION)return;

const SETTINGS_SELECTOR='[data-action="settings"],[data-settings],#lite-settings,[data-open-unified-ai-settings],#aiSettings,#modelSettings,#btnAISettings,[data-ai-settings]';
const FORM_SELECTOR='form[data-cw-cleanroom-form],form[data-unified-model-settings]';
const SETTINGS_KEY='commonweave.universal-ai.v127';
const PROFILES_KEY='commonweave-model-profiles-v1';
const SESSION_KEY='commonweave-model-session';
const SECRET_KEY='commonweave-model-secrets-v1';
const PERSIST_KEY='commonweave-model-persistent-secrets-v211';
const CONTROLLER_PERSIST_KEY='commonweave-model-persistent-secrets-v191';
const LEGACY_PERSIST_KEY='commonweave-model-persistent-secrets-v160';
const POLICY_KEY='commonweave-model-credential-policy-v191';
const PROVIDER_DEFAULTS=Object.freeze({
  gemini:Object.freeze({model:'gemini-3.5-flash-lite',endpoint:'https://generativelanguage.googleapis.com/v1beta'}),
  ollama:Object.freeze({model:'llama3.2',endpoint:'http://127.0.0.1:11434/api/chat'}),
  'openai-compatible':Object.freeze({model:'local-model',endpoint:''}),
});
let pendingSave=null;

const parse=(value,fallback={})=>{try{const parsed=JSON.parse(value);return parsed==null?fallback:parsed}catch{return fallback}};
const read=(storage,key,fallback='')=>{try{return storage?.getItem?.(key)??fallback}catch{return fallback}};
const write=(storage,key,value)=>{try{storage?.setItem?.(key,String(value));return true}catch{return false}};
const remove=(storage,key)=>{try{storage?.removeItem?.(key)}catch{}};
const now=()=>new Date().toISOString();
const field=(form,name)=>form?.elements?.namedItem?.(name)||null;

function providerName(value){
  const provider=String(value||'').trim().toLowerCase();
  if(provider==='gemini')return'gemini';
  if(provider==='ollama'||provider==='local-api')return'ollama';
  if(['openai','compatible','openai-compatible','hosted'].includes(provider))return'openai-compatible';
  return'deterministic';
}
function currentConfig(){
  const settings=parse(read(localStorage,SETTINGS_KEY,'{}'),{});
  const profiles=parse(read(localStorage,PROFILES_KEY,'{}'),{});
  const interactive=profiles?.interactive&&typeof profiles.interactive==='object'?profiles.interactive:settings;
  const provider=providerName(interactive?.provider||interactive?.route||settings?.provider||settings?.route);
  const defaults=PROVIDER_DEFAULTS[provider]||{};
  return{
    provider,
    model:String(interactive?.model||settings?.model||defaults.model||'').trim(),
    endpoint:String(interactive?.endpoint||settings?.endpoint||defaults.endpoint||'').trim(),
    consent:Boolean(interactive?.externalConsent??settings?.externalConsent??settings?.consent),
  };
}
function normalizeRecord(source){
  if(!source||typeof source!=='object')return null;
  const nested=source.session&&typeof source.session==='object'?source.session:source;
  const apiKey=String(nested.apiKey||source.apiKey||'').trim();
  if(!apiKey)return null;
  const config=currentConfig();
  return{
    apiKey,
    provider:providerName(nested.provider||source.provider||config.provider||'gemini'),
    model:String(nested.model||source.model||config.model||'').trim(),
    endpoint:String(nested.endpoint||source.endpoint||config.endpoint||'').trim(),
    consent:Boolean(nested.remoteConsent??source.remoteConsent??nested.externalConsent??source.externalConsent??config.consent),
    savedAt:String(source.savedAt||nested.savedAt||now()),
  };
}
function rememberedRecord(){
  return normalizeRecord(parse(read(localStorage,PERSIST_KEY,''),null))
    ||normalizeRecord(parse(read(localStorage,CONTROLLER_PERSIST_KEY,''),null))
    ||normalizeRecord(parse(read(localStorage,LEGACY_PERSIST_KEY,''),null));
}
function existingKey(){
  const session=parse(read(sessionStorage,SESSION_KEY,'{}'),{});
  if(session.apiKey)return String(session.apiKey).trim();
  const secrets=parse(read(sessionStorage,SECRET_KEY,'{}'),{});
  if(secrets.interactive?.apiKey||secrets.apiKey)return String(secrets.interactive?.apiKey||secrets.apiKey).trim();
  return rememberedRecord()?.apiKey||'';
}
function fingerprint(config){
  let endpoint='';
  try{const url=new URL(String(config.endpoint||''),location.href);url.username='';url.password='';url.search='';url.hash='';endpoint=url.href}catch{endpoint=String(config.endpoint||'')}
  return`${providerName(config.provider)}|${String(config.model||'').trim()}|${endpoint}`;
}
function mirrorSession(record){
  if(!record?.apiKey)return false;
  const packet={
    apiKey:record.apiKey,
    provider:record.provider,
    model:record.model,
    endpoint:record.endpoint,
    remoteConsent:Boolean(record.consent),
    savedAt:record.savedAt||now(),
    restoredAt:now(),
    credentialRevision:VERSION,
  };
  write(sessionStorage,SESSION_KEY,JSON.stringify(packet));
  const secrets=parse(read(sessionStorage,SECRET_KEY,'{}'),{});
  const secret={apiKey:record.apiKey,externalConsent:Boolean(record.consent),savedAt:packet.savedAt};
  secrets[fingerprint(record)]=secret;
  secrets.interactive={...secret,provider:record.provider,model:record.model,endpoint:record.endpoint};
  write(sessionStorage,SECRET_KEY,JSON.stringify(secrets));
  try{globalThis.CommonweaveModelRuntime?.saveSessionSecret?.({provider:record.provider,route:record.provider,model:record.model,endpoint:record.endpoint,externalConsent:Boolean(record.consent)},secret)}catch{}
  return true;
}
function restoreRemembered(){
  const record=rememberedRecord();
  if(!record)return false;
  write(localStorage,PERSIST_KEY,JSON.stringify({schema:'civweave.device-model-secret.v228',...record,remoteConsent:Boolean(record.consent),credentialRevision:VERSION}));
  write(localStorage,POLICY_KEY,'device');
  mirrorSession(record);
  return true;
}
function persistCredential(state){
  const provider=providerName(state.provider||state.route);
  if(provider==='deterministic')return false;
  const apiKey=String(state.apiKey||existingKey()).trim();
  if(!apiKey)return false;
  const defaults=PROVIDER_DEFAULTS[provider]||{};
  const record={
    apiKey,
    provider,
    model:String(state.model||defaults.model||'').trim(),
    endpoint:String(state.endpoint||defaults.endpoint||'').trim(),
    consent:Boolean(state.consent),
    savedAt:now(),
  };
  mirrorSession(record);
  if(state.credentialMode==='device'){
    write(localStorage,PERSIST_KEY,JSON.stringify({schema:'civweave.device-model-secret.v228',...record,remoteConsent:record.consent,credentialRevision:VERSION}));
    write(localStorage,CONTROLLER_PERSIST_KEY,JSON.stringify({schema:'commonweave.device-model-secret.v191',...record,remoteConsent:record.consent,credentialRevision:VERSION}));
    remove(localStorage,LEGACY_PERSIST_KEY);
    write(localStorage,POLICY_KEY,'device');
    return true;
  }
  remove(localStorage,PERSIST_KEY);
  remove(localStorage,CONTROLLER_PERSIST_KEY);
  remove(localStorage,LEGACY_PERSIST_KEY);
  write(localStorage,POLICY_KEY,'session');
  return false;
}
function providerDrafts(form){return parse(form.dataset.cwProviderDrafts||'{}',{})}
function saveDraft(form,provider){
  if(!PROVIDER_DEFAULTS[provider])return;
  const drafts=providerDrafts(form);
  drafts[provider]={model:String(field(form,'model')?.value||''),endpoint:String(field(form,'endpoint')?.value||'')};
  form.dataset.cwProviderDrafts=JSON.stringify(drafts);
}
function applyProviderDefaults(form,provider,{routeChanged=false}={}){
  const defaults=PROVIDER_DEFAULTS[provider];
  if(!defaults)return false;
  const drafts=providerDrafts(form),draft=drafts[provider];
  const model=field(form,'model'),endpoint=field(form,'endpoint');
  if(!model||!endpoint)return false;
  const staleModel=/^(?:commonweave-deterministic|civweave-deterministic|local-model|llama3\.2)/i.test(model.value.trim());
  const staleEndpoint=!endpoint.value.trim()||/127\.0\.0\.1:11434/i.test(endpoint.value);
  if(draft){model.value=draft.model||defaults.model;endpoint.value=draft.endpoint||defaults.endpoint}
  else{
    if(routeChanged||!model.value.trim()||staleModel)model.value=defaults.model;
    if(routeChanged||staleEndpoint)endpoint.value=defaults.endpoint;
  }
  form.dataset.cwProviderRoute=provider;
  return true;
}
function capture(form){
  const provider=providerName(field(form,'route')?.value);
  const defaults=PROVIDER_DEFAULTS[provider]||{};
  return{
    route:provider,
    provider,
    model:String(field(form,'model')?.value||defaults.model||'').trim(),
    endpoint:String(field(form,'endpoint')?.value||defaults.endpoint||'').trim(),
    apiKey:String(field(form,'apiKey')?.value||'').trim()||existingKey(),
    credentialMode:field(form,'credentialMode')?.value==='device'?'device':'session',
    consent:Boolean(field(form,'consent')?.checked),
  };
}
function bindForm(form){
  if(!form||form.dataset.cwAiRepairV228==='true')return form||null;
  form.dataset.cwAiRepairV228='true';
  const routeField=field(form,'route');
  if(routeField){
    form.dataset.cwProviderRoute=providerName(routeField.value);
    applyProviderDefaults(form,providerName(routeField.value));
    routeField.addEventListener('change',()=>{
      const previous=providerName(form.dataset.cwProviderRoute);
      saveDraft(form,previous);
      applyProviderDefaults(form,providerName(routeField.value),{routeChanged:true});
    });
  }
  form.addEventListener('submit',()=>{pendingSave=capture(form)},{capture:true});
  return form;
}
function bindForms(){document.querySelectorAll?.(FORM_SELECTOR).forEach(bindForm)}
function saveStatus(remembered){
  const form=document.querySelector(FORM_SELECTOR),status=form?.querySelector?.('[data-status],[data-save-status]');
  if(status)status.textContent=remembered?'Saved Gemini/provider settings and remembered the API key on this device.':'Saved Gemini/provider settings for this app session.';
}

restoreRemembered();
document.addEventListener('click',event=>{
  if(!(event.target instanceof Element)||!event.target.closest(SETTINGS_SELECTOR))return;
  queueMicrotask(bindForms);
},true);
addEventListener('commonweave:model-settings-opened',bindForms);
addEventListener('commonweave:model-settings-saved',()=>{
  const form=document.querySelector(FORM_SELECTOR);
  const state=pendingSave||(form?capture(form):null);
  pendingSave=null;
  if(!state||state.provider==='deterministic')return;
  const remembered=persistCredential(state);
  queueMicrotask(()=>{bindForms();saveStatus(remembered)});
});
addEventListener('pageshow',()=>{restoreRemembered();bindForms()});
if(document.readyState==='loading')addEventListener('DOMContentLoaded',()=>{restoreRemembered();bindForms()},{once:true});
else bindForms();

globalThis.CivweaveAISettingsRepairV228=Object.freeze({version:VERSION,providerDefaults:PROVIDER_DEFAULTS,restoreRemembered,persistCredential,bindForms,storagePolicy:'explicit-session-or-device'});
})();
