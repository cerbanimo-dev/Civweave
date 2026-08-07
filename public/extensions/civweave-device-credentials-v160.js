(()=>{
'use strict';
const VERSION='192.0-usable-credential-bridge';
// Compatibility marker: VERSION='191.0-explicit-credential-policy'
// Compatibility marker: VERSION='160.1-device-credentials-settings-stable'
if(globalThis.CivweaveDeviceCredentialsV160?.version===VERSION)return;

const PERSIST_KEY='civweave-model-persistent-secrets-v191';
const LEGACY_PERSIST_KEY='civweave-model-persistent-secrets-v160';
const POLICY_KEY='civweave-model-credential-policy-v191';
const SESSION_KEY='civweave-model-session';
const SECRET_KEY='civweave-model-secrets-v1';
const SETTINGS_KEY='civweave.universal-ai.v127';
const PROFILES_KEY='civweave-model-profiles-v1';

const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed==null?fallback:parsed}catch{return fallback}};
const read=(storage,key,fallback='')=>{try{return storage?.getItem?.(key)??fallback}catch{return fallback}};
const write=(storage,key,value)=>{try{storage?.setItem?.(key,value);return true}catch{return false}};
const remove=(storage,key)=>{try{storage?.removeItem?.(key)}catch{}};
const now=()=>new Date().toISOString();

function providerName(value){
  const provider=String(value||'').trim().toLowerCase();
  if(provider==='gemini')return'gemini';
  if(provider==='ollama'||provider==='local-api')return'ollama';
  if(['openai','compatible','openai-compatible','hosted'].includes(provider))return'openai-compatible';
  return'deterministic';
}
function controller(){return globalThis.CivweaveModelSettingsControllerV173||globalThis.CivweaveAISettingsCleanroomV188||null}
function interactiveConfig(){
  const profiles=parse(read(localStorage,PROFILES_KEY,'{}'),{});
  const settings=parse(read(localStorage,SETTINGS_KEY,'{}'),{});
  const selected=profiles?.interactive&&typeof profiles.interactive==='object'?profiles.interactive:settings;
  const provider=providerName(selected?.provider||selected?.route||settings?.provider||settings?.route);
  return{
    provider,
    route:provider,
    model:String(selected?.model||settings?.model||(provider==='gemini'?'gemini-3.5-flash-lite':'local-model')).trim(),
    endpoint:String(selected?.endpoint||settings?.endpoint||(provider==='gemini'?'https://generativelanguage.googleapis.com/v1beta':'')).trim(),
    externalConsent:Boolean(selected?.externalConsent??selected?.remoteConsent??settings?.externalConsent??settings?.consent),
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
    remoteConsent:typeof nested.remoteConsent==='boolean'?nested.remoteConsent:typeof source.remoteConsent==='boolean'?source.remoteConsent:typeof nested.externalConsent==='boolean'?nested.externalConsent:typeof source.externalConsent==='boolean'?source.externalConsent:null,
    savedAt:String(source.savedAt||nested.savedAt||''),
    legacy:Boolean(!current&&legacy),
  };
}
function redactUrl(value){
  try{const url=new URL(String(value||''),location?.href||'http://localhost/');url.username='';url.password='';url.search='';url.hash='';return url.href}catch{return'invalid-endpoint'}
}
function fingerprint(config){return`${providerName(config.provider||config.route)}|${String(config.model||'').trim()}|${redactUrl(config.endpoint||'')}`}
function resolveConsent(record,config,currentSession){
  if(record&&typeof record.remoteConsent==='boolean')return record.remoteConsent;
  if(config.externalConsent===true)return true;
  if(typeof currentSession?.remoteConsent==='boolean')return currentSession.remoteConsent;
  return false;
}
function canonicalize(record=persistentRecord()){
  if(!record?.apiKey)return{remembered:false,session:false,usable:false,consent:false,mode:'session',revision:VERSION};
  const config=interactiveConfig();
  const current=parse(read(sessionStorage,SESSION_KEY,'{}'),{});
  const consent=resolveConsent(record,config,current);
  const provider=providerName(config.provider||record.provider);
  const model=config.model||record.model;
  const endpoint=config.endpoint||record.endpoint;
  const savedAt=record.savedAt||current.savedAt||now();
  const packet={...current,apiKey:record.apiKey,provider,model,endpoint,remoteConsent:consent,savedAt,restoredAt:now(),credentialRevision:VERSION};
  write(sessionStorage,SESSION_KEY,JSON.stringify(packet));

  const secrets=parse(read(sessionStorage,SECRET_KEY,'{}'),{});
  const key=fingerprint({provider,model,endpoint});
  secrets[key]={apiKey:record.apiKey,externalConsent:consent,savedAt};
  write(sessionStorage,SECRET_KEY,JSON.stringify(secrets));

  const policy=read(localStorage,POLICY_KEY,'device');
  if(policy==='device'||persistentRecord()){
    write(localStorage,PERSIST_KEY,JSON.stringify({
      schema:'civweave.device-model-secret.v192',
      apiKey:record.apiKey,
      provider,
      model,
      endpoint,
      remoteConsent:consent,
      savedAt,
      credentialRevision:VERSION,
      migratedFrom:record.legacy?'v160':undefined,
    }));
    remove(localStorage,LEGACY_PERSIST_KEY);
    write(localStorage,POLICY_KEY,'device');
  }
  return{remembered:true,session:true,usable:Boolean(record.apiKey&&consent),consent,mode:'device',provider,model,revision:VERSION};
}
function restore(){
  try{controller()?.restoreRememberedCredential?.()}catch{}
  const status=canonicalize();
  if(status.remembered)try{dispatchEvent(new CustomEvent('civweave:model-credential-restored',{detail:{...status,apiKey:undefined,at:now()}}))}catch{}
  return status.usable;
}
function persist(){
  const policy=read(localStorage,POLICY_KEY,'session');
  if(policy!=='device')return status();
  const session=parse(read(sessionStorage,SESSION_KEY,'{}'),{});
  if(!session.apiKey)return false;
  const config=interactiveConfig();
  write(localStorage,PERSIST_KEY,JSON.stringify({schema:'civweave.device-model-secret.v192',apiKey:session.apiKey,provider:config.provider,model:config.model,endpoint:config.endpoint,remoteConsent:Boolean(session.remoteConsent??config.externalConsent),savedAt:session.savedAt||now(),credentialRevision:VERSION}));
  return canonicalize().usable;
}
function forget(){
  try{controller()?.forgetCredential?.()}catch{}
  remove(localStorage,PERSIST_KEY);remove(localStorage,LEGACY_PERSIST_KEY);remove(localStorage,POLICY_KEY);
  remove(sessionStorage,SESSION_KEY);remove(sessionStorage,SECRET_KEY);
  return status();
}
function status(){
  const remembered=Boolean(persistentRecord());
  const session=parse(read(sessionStorage,SESSION_KEY,'{}'),{});
  const hasSession=Boolean(session.apiKey);
  const consent=Boolean(session.remoteConsent);
  return{remembered,session:hasSession,usable:Boolean(hasSession&&consent),consent,mode:remembered?'device':'session',revision:VERSION};
}
function hasSavedKey(){const state=status();return Boolean(state.remembered||state.session)}
function patchSettings(){return false}

restore();
addEventListener('civweave:model-settings-saved',event=>{
  const detail=event?.detail||{};
  if(detail.credentialPersistence==='device'||read(localStorage,POLICY_KEY,'')==='device')persist();
  else if(detail.route==='deterministic')forget();
});
addEventListener('pageshow',()=>restore());

globalThis.CivweaveDeviceCredentialsV160=Object.freeze({version:VERSION,restore,persist,forget,status,hasSavedKey,patchSettings,canonicalize,automaticPersistence:false,observer:false,timers:false,credentialPolicy:'explicit-cleanroom-v192',restoresConsent:true,mirrorsRuntimeSecret:true});
})();
