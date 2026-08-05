(()=>{
'use strict';
const VERSION='160.2-encrypted-vault-only';
if(globalThis.CommonweaveDeviceCredentialsV160?.version===VERSION)return;
const LEGACY_PERSIST_KEY='commonweave-model-persistent-secrets-v160';
const SESSION_KEY='commonweave-model-session';
const RUNTIME_SECRET_KEY='commonweave-model-secrets-v1';
const NATIVE_SECRET_KEY='commonweave.model-secret.v1';
const SETTINGS_SELECTOR='[data-unified-model-settings],[data-smol-settings-form]';
const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed==null?fallback:parsed}catch{return fallback}};
let patchQueued=false;
let patching=false;
let observer=null;
function get(storage,key){try{return storage?.getItem?.(key)||''}catch{return''}}
function set(storage,key,value){try{storage?.setItem?.(key,value);return true}catch{return false}}
function remove(storage,key){try{storage?.removeItem?.(key)}catch{}}
function keyPresent(session,secrets,nativeSecret=''){return Boolean(session?.apiKey||nativeSecret||Object.values(secrets||{}).some(item=>item?.apiKey))}
function sessionStatus(){
  const session=parse(get(sessionStorage,SESSION_KEY),{}),secrets=parse(get(sessionStorage,RUNTIME_SECRET_KEY),{}),nativeSecret=get(sessionStorage,NATIVE_SECRET_KEY);
  return{session,secrets,nativeSecret,present:keyPresent(session,secrets,nativeSecret)};
}
function vaultRemembered(){try{return Boolean(globalThis.CommonweaveSecureVaultV156?.hasRemembered?.())}catch{return false}}
function dispatch(type,detail={}){try{dispatchEvent(new CustomEvent(type,{detail:{...detail,version:VERSION,at:new Date().toISOString()}}))}catch{}}
function migrateLegacyPlaintext(){
  const saved=parse(get(localStorage,LEGACY_PERSIST_KEY),null);
  if(!saved||typeof saved!=='object'){remove(localStorage,LEGACY_PERSIST_KEY);return false}
  const current=sessionStatus();
  const savedSession=saved.session&&typeof saved.session==='object'?saved.session:{};
  const savedSecrets=saved.secrets&&typeof saved.secrets==='object'?saved.secrets:{};
  const session={...savedSession,...current.session},secrets={...savedSecrets,...current.secrets};
  if(Object.keys(session).length)set(sessionStorage,SESSION_KEY,JSON.stringify(session));
  if(Object.keys(secrets).length)set(sessionStorage,RUNTIME_SECRET_KEY,JSON.stringify(secrets));
  remove(localStorage,LEGACY_PERSIST_KEY);
  const migrated=keyPresent(session,secrets,current.nativeSecret);
  if(migrated)dispatch('commonweave:legacy-plaintext-secret-migrated',{destination:'session-storage',requiresEncryptedVaultForPersistence:true});
  return migrated;
}
function restore(){return migrateLegacyPlaintext()||sessionStatus().present}
function persist(){
  // Provider credentials must never be copied into plaintext localStorage. The
  // passphrase-protected CommonweaveSecureVaultV156 is the only persistent path.
  remove(localStorage,LEGACY_PERSIST_KEY);
  return sessionStatus().present;
}
function forget(){
  remove(localStorage,LEGACY_PERSIST_KEY);remove(sessionStorage,SESSION_KEY);remove(sessionStorage,RUNTIME_SECRET_KEY);remove(sessionStorage,NATIVE_SECRET_KEY);
  try{globalThis.CommonweaveSecureVaultV156?.forget?.()}catch{}
  dispatch('commonweave:model-secret-forgotten');
  queuePatch();
}
function hasSessionKey(){return sessionStatus().present}
function hasSavedKey(){return hasSessionKey()||vaultRemembered()}
function setText(node,text){if(!node||node.textContent===text)return false;node.textContent=text;return true}
function setHidden(node,hidden){if(!node||node.hidden===hidden)return false;node.hidden=hidden;return true}
function patchSettings(){
  patchQueued=false;if(patching)return;patching=true;observer?.disconnect?.();
  try{
    const sessionKey=hasSessionKey(),remembered=vaultRemembered();
    document.querySelectorAll(SETTINGS_SELECTOR).forEach(form=>{
      const secretNote=form.querySelector('[data-secret-note]');
      const status=sessionKey
        ?(remembered?'Credential unlocked for this session; an encrypted vault is remembered on this device.':'Credential available for this session only. Use the encrypted vault to remember it safely.')
        :(remembered?'An encrypted credential vault is remembered but locked.':'No provider credential is stored on this device.');
      setText(secretNote,status);
      const privacy=[...form.querySelectorAll('footer p,p')].find(node=>/credentials|api keys|session storage|session-only|device-saved/i.test(node.textContent||''));
      setText(privacy,'Provider credentials remain session-only unless you explicitly protect them with the passphrase-encrypted device vault. Commonweave never stores provider keys as plaintext local data.');
      let button=form.querySelector('[data-forget-device-key]');
      if(!button){
        button=document.createElement('button');button.type='button';button.dataset.forgetDeviceKey='';button.className='cw-ai-forget-key';button.textContent='Forget device credential';
        const actions=form.querySelector('footer .cw-ai-actions,menu.cw-ai-actions,.cw-ai-form-footer .cw-ai-actions')||form;actions.append(button);
      }
      setHidden(button,!sessionKey&&!remembered);
    });
  }finally{patching=false;observe()}
}
function queuePatch(){if(patchQueued||patching)return;patchQueued=true;queueMicrotask(patchSettings)}
function relevantMutation(records){return records.some(record=>{
  if(record.target?.closest?.(SETTINGS_SELECTOR))return true;
  return [...(record.addedNodes||[])].some(node=>node?.nodeType===1&&(node.matches?.(SETTINGS_SELECTOR)||node.querySelector?.(SETTINGS_SELECTOR)));
})}
function observe(){
  if(!document?.documentElement)return;
  if(!observer)observer=new MutationObserver(records=>{if(relevantMutation(records))queuePatch()});
  observer.observe(document.documentElement,{childList:true,subtree:true});
}
restore();
addEventListener('commonweave:model-settings-saved',()=>setTimeout(()=>{persist();queuePatch()},0));
addEventListener('commonweave:vault-unlocked',queuePatch);
addEventListener('commonweave:vault-locked',queuePatch);
addEventListener('commonweave:vault-remembered',queuePatch);
addEventListener('commonweave:vault-forgotten',queuePatch);
document.addEventListener('submit',event=>{if(event.target.matches?.(SETTINGS_SELECTOR))setTimeout(()=>{persist();queuePatch()},80)},true);
document.addEventListener('click',event=>{if(event.target.closest?.('[data-forget-device-key]')){event.preventDefault();forget()}},true);
observe();
document.readyState==='loading'?addEventListener('DOMContentLoaded',queuePatch,{once:true}):queuePatch();
globalThis.CommonweaveDeviceCredentialsV160={version:VERSION,restore,persist,forget,hasSavedKey,hasSessionKey,migrateLegacyPlaintext,patchSettings};
})();
