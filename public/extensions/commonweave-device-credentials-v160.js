(()=>{
'use strict';
const VERSION='160.0-device-credentials';
if(globalThis.CommonweaveDeviceCredentialsV160?.version===VERSION)return;
const PERSIST_KEY='commonweave-model-persistent-secrets-v160';
const SESSION_KEY='commonweave-model-session';
const RUNTIME_SECRET_KEY='commonweave-model-secrets-v1';
const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed==null?fallback:parsed}catch{return fallback}};
let patchQueued=false;
function get(storage,key){try{return storage?.getItem?.(key)||''}catch{return''}}
function set(storage,key,value){try{storage?.setItem?.(key,value);return true}catch{return false}}
function remove(storage,key){try{storage?.removeItem?.(key)}catch{}}
function keyPresent(session,secrets){return Boolean(session?.apiKey||Object.values(secrets||{}).some(item=>item?.apiKey))}
function restore(){
  const saved=parse(get(localStorage,PERSIST_KEY),null);if(!saved||typeof saved!=='object')return false;
  const currentSession=parse(get(sessionStorage,SESSION_KEY),{}),currentSecrets=parse(get(sessionStorage,RUNTIME_SECRET_KEY),{}),savedSession=saved.session&&typeof saved.session==='object'?saved.session:{},savedSecrets=saved.secrets&&typeof saved.secrets==='object'?saved.secrets:{};
  const session={...savedSession,...currentSession},secrets={...savedSecrets,...currentSecrets};
  if(Object.keys(session).length)set(sessionStorage,SESSION_KEY,JSON.stringify(session));
  if(Object.keys(secrets).length)set(sessionStorage,RUNTIME_SECRET_KEY,JSON.stringify(secrets));
  return keyPresent(session,secrets);
}
function persist(){
  const session=parse(get(sessionStorage,SESSION_KEY),{}),secrets=parse(get(sessionStorage,RUNTIME_SECRET_KEY),{});
  if(!keyPresent(session,secrets)){remove(localStorage,PERSIST_KEY);return false}
  return set(localStorage,PERSIST_KEY,JSON.stringify({schema:'commonweave.device-model-secrets.v1',session,secrets,savedAt:new Date().toISOString()}));
}
function forget(){
  remove(localStorage,PERSIST_KEY);remove(sessionStorage,SESSION_KEY);remove(sessionStorage,RUNTIME_SECRET_KEY);
  dispatchEvent(new CustomEvent('commonweave:model-secret-forgotten',{detail:{version:VERSION,at:new Date().toISOString()}}));
  queuePatch();
}
function hasSavedKey(){const saved=parse(get(localStorage,PERSIST_KEY),{}),session=parse(get(sessionStorage,SESSION_KEY),{}),secrets=parse(get(sessionStorage,RUNTIME_SECRET_KEY),{});return keyPresent(saved.session,saved.secrets)||keyPresent(session,secrets)}
function patchSettings(){
  patchQueued=false;const saved=hasSavedKey();
  document.querySelectorAll('[data-unified-model-settings],[data-smol-settings-form]').forEach(form=>{
    const secretNote=form.querySelector('[data-secret-note]');if(secretNote)secretNote.textContent=saved?'Credential saved on this device. It will be restored when Commonweave reopens.':'No device-saved credential is present.';
    const privacy=[...form.querySelectorAll('footer p,p')].find(node=>/credentials|api keys|session storage|session-only/i.test(node.textContent||''));if(privacy)privacy.textContent='Provider credentials are stored only on this device and excluded from exports, realm handoffs, and offline seeds.';
    let button=form.querySelector('[data-forget-device-key]');
    if(!button){button=document.createElement('button');button.type='button';button.dataset.forgetDeviceKey='';button.className='cw-ai-forget-key';button.textContent='Forget saved key';const actions=form.querySelector('footer .cw-ai-actions,menu.cw-ai-actions,.cw-ai-form-footer .cw-ai-actions')||form;actions.append(button)}
    button.hidden=!saved;
  });
}
function queuePatch(){if(patchQueued)return;patchQueued=true;queueMicrotask(patchSettings)}
restore();
addEventListener('commonweave:model-settings-saved',()=>setTimeout(()=>{persist();queuePatch()},0));
addEventListener('pagehide',persist);
document.addEventListener('visibilitychange',()=>{if(document.hidden)persist()});
document.addEventListener('submit',event=>{if(event.target.matches?.('[data-unified-model-settings],[data-smol-settings-form]'))setTimeout(()=>{persist();queuePatch()},80)},true);
document.addEventListener('click',event=>{if(event.target.closest?.('[data-forget-device-key]')){event.preventDefault();forget()}},true);
new MutationObserver(queuePatch).observe(document.documentElement,{childList:true,subtree:true});
document.readyState==='loading'?addEventListener('DOMContentLoaded',queuePatch,{once:true}):queuePatch();
globalThis.CommonweaveDeviceCredentialsV160={version:VERSION,restore,persist,forget,hasSavedKey};
})();
