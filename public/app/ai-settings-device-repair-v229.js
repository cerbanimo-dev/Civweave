(()=>{
'use strict';
const VERSION='229.0-civweave-gemini-device-persistence';
if(globalThis.CivweaveAISettingsRepairV229?.version===VERSION)return;

const SETTINGS_SELECTOR='[data-action="settings"],[data-settings],#lite-settings,[data-open-unified-ai-settings],#aiSettings,#modelSettings,#btnAISettings,[data-ai-settings]';
const FORM_SELECTOR='form[data-cw-cleanroom-form],form[data-unified-model-settings]';
const SETTINGS_KEY='civweave.universal-ai.v127';
const PROFILES_KEY='civweave-model-profiles-v1';
const SESSION_KEY='civweave-model-session';
const SECRET_KEY='civweave-model-secrets-v1';
const PERSIST_KEY='civweave-model-persistent-secrets-v191';
const LEGACY_PERSIST_KEY='civweave-model-persistent-secrets-v160';
const POLICY_KEY='civweave-model-credential-policy-v191';
const OLD_SETTINGS_KEY='commonweave.universal-ai.v127';
const OLD_PROFILES_KEY='commonweave-model-profiles-v1';
const OLD_SESSION_KEY='commonweave-model-session';
const OLD_SECRET_KEY='commonweave-model-secrets-v1';
const OLD_PERSIST_KEYS=['commonweave-model-persistent-secrets-v211','commonweave-model-persistent-secrets-v191','commonweave-model-persistent-secrets-v160'];
const DEFAULTS=Object.freeze({
  gemini:Object.freeze({model:'gemini-3.5-flash-lite',endpoint:'https://generativelanguage.googleapis.com/v1beta'}),
  ollama:Object.freeze({model:'llama3.2',endpoint:'http://127.0.0.1:11434/api/chat'}),
  'openai-compatible':Object.freeze({model:'local-model',endpoint:''}),
});
let pendingSave=null;

const parse=(value,fallback={})=>{try{const parsed=JSON.parse(value);return parsed==null?fallback:parsed}catch{return fallback}};
const read=(storage,key,fallback='')=>{try{return storage?.getItem?.(key)??fallback}catch{return fallback}};
const write=(storage,key,value)=>{try{storage?.setItem?.(key,String(value));return true}catch{return false}};
const remove=(storage,key)=>{try{storage?.removeItem?.(key)}catch{}};
const field=(form,name)=>form?.elements?.namedItem?.(name)||null;
const now=()=>new Date().toISOString();

function providerName(value){
  const provider=String(value||'').trim().toLowerCase();
  if(provider==='server-auto')return'server-auto';
  if(provider==='gemini')return'gemini';
  if(provider==='ollama'||provider==='local-api')return'ollama';
  if(['openai','compatible','openai-compatible','hosted'].includes(provider))return'openai-compatible';
  return'deterministic';
}
function migrateRenamedStorage(){
  const pairs=[[OLD_SETTINGS_KEY,SETTINGS_KEY],[OLD_PROFILES_KEY,PROFILES_KEY]];
  for(const [oldKey,newKey] of pairs){if(!read(localStorage,newKey)&&read(localStorage,oldKey))write(localStorage,newKey,read(localStorage,oldKey))}
  if(!read(sessionStorage,SESSION_KEY)&&read(sessionStorage,OLD_SESSION_KEY))write(sessionStorage,SESSION_KEY,read(sessionStorage,OLD_SESSION_KEY));
  if(!read(sessionStorage,SECRET_KEY)&&read(sessionStorage,OLD_SECRET_KEY))write(sessionStorage,SECRET_KEY,read(sessionStorage,OLD_SECRET_KEY));
  if(!read(localStorage,PERSIST_KEY)){
    for(const oldKey of OLD_PERSIST_KEYS){const value=read(localStorage,oldKey);if(value){write(localStorage,PERSIST_KEY,value);break}}
  }
}
function currentSettings(){
  const settings=parse(read(localStorage,SETTINGS_KEY,'{}'),{});
  const profiles=parse(read(localStorage,PROFILES_KEY,'{}'),{});
  const interactive=profiles?.interactive&&typeof profiles.interactive==='object'?profiles.interactive:settings;
  const provider=providerName(interactive?.provider||interactive?.route||settings?.provider||settings?.route);
  const defaults=DEFAULTS[provider]||{};
  return{provider,model:String(interactive?.model||settings?.model||defaults.model||'').trim(),endpoint:String(interactive?.endpoint||settings?.endpoint||defaults.endpoint||'').trim(),consent:Boolean(interactive?.externalConsent??settings?.externalConsent??settings?.consent)};
}
function normalizeRecord(source){
  if(!source||typeof source!=='object')return null;
  const nested=source.session&&typeof source.session==='object'?source.session:source;
  const apiKey=String(nested.apiKey||source.apiKey||'').trim();
  if(!apiKey)return null;
  const config=currentSettings();
  return{apiKey,provider:providerName(nested.provider||source.provider||config.provider||'gemini'),model:String(nested.model||source.model||config.model||'').trim(),endpoint:String(nested.endpoint||source.endpoint||config.endpoint||'').trim(),consent:Boolean(nested.remoteConsent??source.remoteConsent??nested.externalConsent??source.externalConsent??config.consent),savedAt:String(source.savedAt||nested.savedAt||now())};
}
function rememberedRecord(){return normalizeRecord(parse(read(localStorage,PERSIST_KEY,''),null))||normalizeRecord(parse(read(localStorage,LEGACY_PERSIST_KEY,''),null))}
function existingKey(){
  const direct=parse(read(sessionStorage,SESSION_KEY,'{}'),{});if(direct.apiKey)return String(direct.apiKey).trim();
  const secrets=parse(read(sessionStorage,SECRET_KEY,'{}'),{});if(secrets.interactive?.apiKey||secrets.apiKey)return String(secrets.interactive?.apiKey||secrets.apiKey).trim();
  return rememberedRecord()?.apiKey||'';
}
function mirrorSession(record){
  if(!record?.apiKey)return false;
  const packet={apiKey:record.apiKey,provider:record.provider,model:record.model,endpoint:record.endpoint,remoteConsent:Boolean(record.consent),savedAt:record.savedAt||now(),restoredAt:now(),credentialRevision:VERSION};
  write(sessionStorage,SESSION_KEY,JSON.stringify(packet));
  const secrets=parse(read(sessionStorage,SECRET_KEY,'{}'),{});
  secrets.interactive={apiKey:record.apiKey,provider:record.provider,model:record.model,endpoint:record.endpoint,externalConsent:Boolean(record.consent),savedAt:packet.savedAt};
  write(sessionStorage,SECRET_KEY,JSON.stringify(secrets));
  return true;
}
function restoreRemembered(){
  migrateRenamedStorage();
  const record=rememberedRecord();
  if(!record)return false;
  write(localStorage,PERSIST_KEY,JSON.stringify({schema:'civweave.device-model-secret.v229',...record,remoteConsent:Boolean(record.consent),credentialRevision:VERSION}));
  write(localStorage,POLICY_KEY,'device');
  mirrorSession(record);
  return true;
}
function providerDrafts(form){return parse(form?.dataset?.civweaveProviderDrafts||'{}',{})}
function saveDraft(form,provider){
  if(!DEFAULTS[provider])return;
  const drafts=providerDrafts(form);
  drafts[provider]={model:String(field(form,'model')?.value||''),endpoint:String(field(form,'endpoint')?.value||'')};
  form.dataset.civweaveProviderDrafts=JSON.stringify(drafts);
}
function applyProviderDefaults(form,provider,{routeChanged=false}={}){
  const defaults=DEFAULTS[provider];if(!defaults)return false;
  const model=field(form,'model'),endpoint=field(form,'endpoint');if(!model||!endpoint)return false;
  const draft=providerDrafts(form)[provider];
  if(draft){model.value=draft.model||defaults.model;endpoint.value=draft.endpoint||defaults.endpoint}
  else if(routeChanged||!model.value.trim()||provider==='gemini'){
    model.value=defaults.model;
    endpoint.value=defaults.endpoint;
  }
  form.dataset.civweaveProviderRoute=provider;
  return true;
}
function hydrateKeyField(form){
  const input=field(form,'apiKey');if(!input)return;
  const key=existingKey();
  if(key&&!input.value)input.value=key;
  if(key)input.placeholder=rememberedRecord()?'Remembered on this device':'Loaded for this session';
}
function capture(form){
  const provider=providerName(field(form,'route')?.value),defaults=DEFAULTS[provider]||{};
  return{route:provider,provider,model:String(field(form,'model')?.value||defaults.model||'').trim(),endpoint:String(field(form,'endpoint')?.value||defaults.endpoint||'').trim(),apiKey:String(field(form,'apiKey')?.value||'').trim()||existingKey(),credentialMode:field(form,'credentialMode')?.value==='device'?'device':'session',consent:Boolean(field(form,'consent')?.checked)};
}
function persistCaptured(state){
  if(!state||state.provider==='deterministic'||state.provider==='server-auto')return false;
  const defaults=DEFAULTS[state.provider]||{};
  const model=String(state.model||defaults.model||'').trim(),endpoint=String(state.endpoint||defaults.endpoint||'').trim();
  const interactive={route:state.provider,provider:state.provider,model,endpoint,externalConsent:Boolean(state.consent)};
  write(localStorage,SETTINGS_KEY,JSON.stringify({...interactive,consent:Boolean(state.consent),agenticEnabled:false,credentialRevision:VERSION}));
  write(localStorage,PROFILES_KEY,JSON.stringify({interactive,agentic:null,agenticEnabled:false,credentialRevision:VERSION}));
  const apiKey=String(state.apiKey||existingKey()).trim();
  if(apiKey)mirrorSession({apiKey,provider:state.provider,model,endpoint,consent:Boolean(state.consent),savedAt:now()});
  if(state.credentialMode==='device'&&apiKey){
    write(localStorage,PERSIST_KEY,JSON.stringify({schema:'civweave.device-model-secret.v229',apiKey,provider:state.provider,model,endpoint,consent:Boolean(state.consent),remoteConsent:Boolean(state.consent),savedAt:now(),credentialRevision:VERSION}));
    remove(localStorage,LEGACY_PERSIST_KEY);write(localStorage,POLICY_KEY,'device');return true;
  }
  if(state.credentialMode==='session'){remove(localStorage,PERSIST_KEY);remove(localStorage,LEGACY_PERSIST_KEY);write(localStorage,POLICY_KEY,'session')}
  return false;
}
function bindForm(form){
  if(!form)return null;
  hydrateKeyField(form);
  const routeField=field(form,'route');
  if(routeField&&!form.dataset.civweaveAiRepairV229){
    form.dataset.civweaveAiRepairV229='true';
    form.dataset.civweaveProviderRoute=providerName(routeField.value);
    applyProviderDefaults(form,providerName(routeField.value));
    routeField.addEventListener('change',()=>{
      const previous=providerName(form.dataset.civweaveProviderRoute);saveDraft(form,previous);
      applyProviderDefaults(form,providerName(routeField.value),{routeChanged:true});hydrateKeyField(form);
    });
    form.addEventListener('submit',()=>{pendingSave=capture(form)},{capture:true});
  }
  return form;
}
function bindForms(){document.querySelectorAll?.(FORM_SELECTOR).forEach(bindForm)}
function afterOpen(){queueMicrotask(()=>{bindForms();const form=document.querySelector(FORM_SELECTOR);if(form){const route=providerName(field(form,'route')?.value);applyProviderDefaults(form,route);hydrateKeyField(form)}})}
function saveStatus(remembered){const form=document.querySelector(FORM_SELECTOR),status=form?.querySelector?.('[data-status],[data-save-status]');if(status)status.textContent=remembered?'Saved settings and remembered the API key on this device.':'Saved settings for this app session.'}

restoreRemembered();
document.addEventListener('click',event=>{if(!(event.target instanceof Element)||!event.target.closest(SETTINGS_SELECTOR))return;queueMicrotask(bindForms)},true);
addEventListener('civweave:model-settings-opened',afterOpen);
addEventListener('civweave:model-settings-saved',()=>{const form=document.querySelector(FORM_SELECTOR),state=pendingSave||(form?capture(form):null);pendingSave=null;if(!state||state.provider==='deterministic'||state.provider==='server-auto')return;const remembered=persistCaptured(state);queueMicrotask(()=>{bindForms();saveStatus(remembered)})});
addEventListener('pageshow',()=>{restoreRemembered();bindForms()});
if(document.readyState==='loading')addEventListener('DOMContentLoaded',()=>{restoreRemembered();bindForms()},{once:true});else bindForms();

globalThis.CivweaveAISettingsRepairV229=Object.freeze({version:VERSION,providerDefaults:DEFAULTS,restoreRemembered,persistCaptured,bindForms,storagePolicy:'explicit-session-or-device'});
})();
