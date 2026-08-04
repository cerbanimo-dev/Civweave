(()=>{
'use strict';
const VERSION='160.1-device-credentials-settings-stable';
// Compatibility marker: VERSION='160.0-device-credentials'
if(globalThis.CommonweaveDeviceCredentialsV160?.version===VERSION)return;
const PERSIST_KEY='commonweave-model-persistent-secrets-v160';
const SESSION_KEY='commonweave-model-session';
const RUNTIME_SECRET_KEY='commonweave-model-secrets-v1';
const SETTINGS_SELECTOR='[data-unified-model-settings],[data-smol-settings-form]';
const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed==null?fallback:parsed}catch{return fallback}};
let patchQueued=false;
let patching=false;
let observer=null;
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
function setText(node,text){if(!node||node.textContent===text)return false;node.textContent=text;return true}
function setHidden(node,hidden){if(!node||node.hidden===hidden)return false;node.hidden=hidden;return true}
function patchSettings(){
  patchQueued=false;if(patching)return;patching=true;observer?.disconnect?.();
  try{
    const saved=hasSavedKey();
    document.querySelectorAll(SETTINGS_SELECTOR).forEach(form=>{
      const secretNote=form.querySelector('[data-secret-note]');
      setText(secretNote,saved?'Credential saved on this device. It will be restored when Commonweave reopens.':'No device-saved credential is present.');
      const privacy=[...form.querySelectorAll('footer p,p')].find(node=>/credentials|api keys|session storage|session-only/i.test(node.textContent||''));
      setText(privacy,'Provider credentials are stored only on this device and excluded from exports, realm handoffs, and offline seeds.');
      let button=form.querySelector('[data-forget-device-key]');
      if(!button){
        button=document.createElement('button');button.type='button';button.dataset.forgetDeviceKey='';button.className='cw-ai-forget-key';button.textContent='Forget saved key';
        const actions=form.querySelector('footer .cw-ai-actions,menu.cw-ai-actions,.cw-ai-form-footer .cw-ai-actions')||form;actions.append(button);
      }
      setHidden(button,!saved);
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
addEventListener('pagehide',persist);
document.addEventListener('visibilitychange',()=>{if(document.hidden)persist()});
document.addEventListener('submit',event=>{if(event.target.matches?.(SETTINGS_SELECTOR))setTimeout(()=>{persist();queuePatch()},80)},true);
document.addEventListener('click',event=>{if(event.target.closest?.('[data-forget-device-key]')){event.preventDefault();forget()}},true);
observe();
document.readyState==='loading'?addEventListener('DOMContentLoaded',queuePatch,{once:true}):queuePatch();
globalThis.CommonweaveDeviceCredentialsV160={version:VERSION,restore,persist,forget,hasSavedKey,patchSettings};
})();
