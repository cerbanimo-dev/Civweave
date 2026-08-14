(()=>{
'use strict';
const VERSION='211.0-live-device-credential-persistence';
if(globalThis.CivweaveDeviceCredentialPersistenceV211?.version===VERSION)return;

const SETTINGS_KEY='civweave.universal-ai.v127';
const PROFILES_KEY='civweave-model-profiles-v1';
const SESSION_KEY='civweave-model-session';
const SECRET_KEY='civweave-model-secrets-v1';
const PERSIST_KEY='civweave-model-persistent-secrets-v191';
const LEGACY_PERSIST_KEY='civweave-model-persistent-secrets-v160';
const POLICY_KEY='civweave-model-credential-policy-v191';
const SETTINGS_SELECTOR='[data-action="settings"],[data-settings],#lite-settings,[data-open-unified-ai-settings],#aiSettings,#modelSettings,#btnAISettings,[data-ai-settings]';
let pendingMode='';

const parse=(value,fallback={})=>{try{const parsed=JSON.parse(value);return parsed==null?fallback:parsed}catch{return fallback}};
const read=(storage,key,fallback='')=>{try{return storage?.getItem?.(key)??fallback}catch{return fallback}};
const write=(storage,key,value)=>{try{storage?.setItem?.(key,String(value));return true}catch{return false}};
const remove=(storage,key)=>{try{storage?.removeItem?.(key)}catch{}};
const now=()=>new Date().toISOString();
const runtime=()=>globalThis.CivweaveModelRuntime||null;

function providerName(value){
  const provider=String(value||'').trim().toLowerCase();
  if(provider==='server-auto')return'server-auto';
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
  return{
    provider,
    route:provider,
    model:String(interactive?.model||settings?.model||(provider==='gemini'?'gemini-3.5-flash-lite':'local-model')).trim(),
    endpoint:String(interactive?.endpoint||settings?.endpoint||(provider==='gemini'?'https://generativelanguage.googleapis.com/v1beta':'')).trim(),
    externalConsent:Boolean(interactive?.externalConsent??interactive?.remoteConsent??settings?.externalConsent??settings?.consent),
  };
}
function persistentRecord(){
  const current=parse(read(localStorage,PERSIST_KEY,''),null);
  const legacy=parse(read(localStorage,LEGACY_PERSIST_KEY,''),null);
  const source=current||legacy;
  if(!source||typeof source!=='object')return null;
  const nested=source.session&&typeof source.session==='object'?source.session:source;
  const apiKey=String(nested.apiKey||source.apiKey||'').trim();
  if(!apiKey)return null;
  return{
    apiKey,
    provider:providerName(nested.provider||source.provider||'gemini'),
    model:String(nested.model||source.model||'').trim(),
    endpoint:String(nested.endpoint||source.endpoint||'').trim(),
    remoteConsent:Boolean(nested.remoteConsent??source.remoteConsent??nested.externalConsent??source.externalConsent),
    savedAt:String(source.savedAt||nested.savedAt||''),
    legacy:Boolean(!current&&legacy),
  };
}
function fingerprint(config){
  let endpoint='';
  try{const url=new URL(String(config.endpoint||''),location?.href||'http://localhost/');url.username='';url.password='';url.search='';url.hash='';endpoint=url.href}catch{endpoint=String(config.endpoint||'')}
  return`${providerName(config.provider||config.route)}|${String(config.model||'').trim()}|${endpoint}`;
}
function mirrorRuntime(record){
  if(!record?.apiKey)return false;
  const config=currentConfig();
  const provider=providerName(config.provider||record.provider);
  const model=config.model||record.model;
  const endpoint=config.endpoint||record.endpoint;
  const consent=typeof record.remoteConsent==='boolean'?record.remoteConsent:Boolean(config.externalConsent);
  const savedAt=record.savedAt||now();
  const current=parse(read(sessionStorage,SESSION_KEY,'{}'),{});
  write(sessionStorage,SESSION_KEY,JSON.stringify({...current,apiKey:record.apiKey,provider,model,endpoint,remoteConsent:consent,savedAt,restoredAt:now(),credentialRevision:VERSION}));
  const secrets=parse(read(sessionStorage,SECRET_KEY,'{}'),{});
  secrets[fingerprint({provider,model,endpoint})]={apiKey:record.apiKey,externalConsent:consent,savedAt};
  write(sessionStorage,SECRET_KEY,JSON.stringify(secrets));
  try{runtime()?.saveSessionSecret?.({provider,route:provider,model,endpoint,externalConsent:consent},{apiKey:record.apiKey,externalConsent:consent})}catch{}
  return true;
}
function restore(){
  const record=persistentRecord();
  if(!record)return false;
  write(localStorage,POLICY_KEY,'device');
  if(record.legacy){
    write(localStorage,PERSIST_KEY,JSON.stringify({schema:'civweave.device-model-secret.v211',apiKey:record.apiKey,provider:record.provider,model:record.model,endpoint:record.endpoint,remoteConsent:record.remoteConsent,savedAt:record.savedAt||now(),credentialRevision:VERSION,migratedFrom:'v160'}));
    remove(localStorage,LEGACY_PERSIST_KEY);
  }
  const restored=mirrorRuntime(record);
  if(restored)try{dispatchEvent(new CustomEvent('civweave:model-credential-restored',{detail:{version:VERSION,provider:record.provider,remembered:true,at:now()}}))}catch{}
  return restored;
}
function forget(){
  remove(localStorage,PERSIST_KEY);
  remove(localStorage,LEGACY_PERSIST_KEY);
  write(localStorage,POLICY_KEY,'session');
  remove(sessionStorage,SESSION_KEY);
  remove(sessionStorage,SECRET_KEY);
  try{dispatchEvent(new CustomEvent('civweave:model-secret-forgotten',{detail:{version:VERSION,at:now()}}))}catch{}
  refreshForms();
  return status();
}
function status(){
  const remembered=Boolean(persistentRecord());
  const session=parse(read(sessionStorage,SESSION_KEY,'{}'),{});
  return{version:VERSION,remembered,session:Boolean(session.apiKey),mode:remembered?'device':'session',usable:Boolean(session.apiKey&&session.remoteConsent)};
}
function persistFromSession(mode=pendingMode){
  const selected=mode==='device'?'device':'session';
  if(selected!=='device'){
    remove(localStorage,PERSIST_KEY);
    remove(localStorage,LEGACY_PERSIST_KEY);
    write(localStorage,POLICY_KEY,'session');
    return false;
  }
  const session=parse(read(sessionStorage,SESSION_KEY,'{}'),{});
  const apiKey=String(session.apiKey||'').trim();
  if(!apiKey)return false;
  const config=currentConfig();
  const record={
    schema:'civweave.device-model-secret.v211',
    apiKey,
    provider:providerName(session.provider||config.provider),
    model:String(session.model||config.model||'').trim(),
    endpoint:String(session.endpoint||config.endpoint||'').trim(),
    remoteConsent:Boolean(session.remoteConsent??config.externalConsent),
    savedAt:String(session.savedAt||now()),
    credentialRevision:VERSION,
  };
  write(localStorage,PERSIST_KEY,JSON.stringify(record));
  remove(localStorage,LEGACY_PERSIST_KEY);
  write(localStorage,POLICY_KEY,'device');
  mirrorRuntime(record);
  return true;
}
function teaching(form){
  const select=form.elements?.namedItem?.('credentialMode');
  const note=form.querySelector?.('[data-secret-note]');
  if(!select||!note)return;
  if(select.value==='device')note.textContent='Remember on this device keeps the key in this browser profile until you forget it, clear site data, or reset the app.';
  else note.textContent=status().session?'A provider key is loaded for this browser session only.':'Credentials are held only for this browser session.';
}
function decorate(form){
  if(!form)return null;
  let select=form.elements?.namedItem?.('credentialMode');
  if(!select){
    const note=form.querySelector?.('[data-secret-note]');
    if(note){
      const label=document.createElement('label');
      label.className='cw-ai-route-field cw-device-credential-mode';
      label.innerHTML='<span>Credential lifetime</span><select name="credentialMode"><option value="session">This app session only</option><option value="device">Remember on this device</option></select>';
      note.insertAdjacentElement('afterend',label);
      select=label.querySelector('select');
    }
  }
  if(!select)return form;
  select.value=persistentRecord()||read(localStorage,POLICY_KEY,'')==='device'?'device':'session';
  if(select.dataset.cwDevicePersistenceBound!=='true'){
    select.dataset.cwDevicePersistenceBound='true';
    select.addEventListener('change',()=>teaching(form));
    form.addEventListener('submit',()=>{pendingMode=select.value==='device'?'device':'session'},{capture:true});
    const tools=form.querySelector?.('.cw-ai-secret-tools');
    if(tools&&!tools.querySelector('[data-forget-device-key]')){
      const button=document.createElement('button');
      button.type='button';
      button.dataset.forgetDeviceKey='';
      button.textContent='Forget saved key';
      button.addEventListener('click',()=>forget());
      tools.append(button);
    }
  }
  const forgetButton=form.querySelector?.('[data-forget-device-key]');
  if(forgetButton)forgetButton.hidden=!status().remembered&&!status().session;
  teaching(form);
  return form;
}
function refreshForms(){
  document.querySelectorAll?.('form[data-unified-model-settings],form[data-cw-cleanroom-form]').forEach(decorate);
}
function patchSettingsApi(){
  const api=globalThis.CivweaveModelSettingsV157||globalThis.CivweaveModelSettingsV133||globalThis.CivweaveAISettingsCleanroomV188||globalThis.CivweaveModelSettingsControllerV173;
  if(!api||api.__deviceCredentialPersistenceV211)return api||null;
  try{
    if(typeof api.open==='function'){
      const originalOpen=api.open.bind(api);
      api.open=(...args)=>{const result=originalOpen(...args);queueMicrotask(refreshForms);return result};
    }
    if(typeof api.mount==='function'){
      const originalMount=api.mount.bind(api);
      api.mount=(...args)=>decorate(originalMount(...args));
    }
    Object.defineProperty(api,'__deviceCredentialPersistenceV211',{value:true,configurable:true});
  }catch{}
  return api;
}
function openSettings(event){
  const target=event.target instanceof Element?event.target.closest(SETTINGS_SELECTOR):null;
  if(!target)return;
  const api=patchSettingsApi();
  if(!api?.open)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  api.open(target);
  queueMicrotask(refreshForms);
}

restore();
patchSettingsApi();
addEventListener('DOMContentLoaded',()=>{restore();patchSettingsApi();refreshForms()},{once:true});
addEventListener('pageshow',()=>{restore();patchSettingsApi();refreshForms()});
document.addEventListener('click',openSettings,true);
addEventListener('civweave:model-settings-saved',event=>{
  const route=providerName(event?.detail?.interactive?.provider||event?.detail?.route);
  const mode=pendingMode||read(localStorage,POLICY_KEY,'session');
  if(route==='deterministic')forget();
  else persistFromSession(mode);
  pendingMode='';
  queueMicrotask(()=>{
    refreshForms();
    document.querySelectorAll?.('form[data-unified-model-settings] [data-save-status]').forEach(node=>{
      if(route!=='deterministic')node.textContent=status().remembered?'Saved provider settings and remembered the key on this device.':'Saved provider settings for this app session.';
    });
  });
});

globalThis.CivweaveDeviceCredentialPersistenceV211=Object.freeze({version:VERSION,restore,forget,status,persistFromSession,decorate,refreshForms,patchSettingsApi,credentialPolicy:'explicit-session-or-device',storage:'browser-local-storage'});
})();
