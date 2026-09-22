(()=>{
'use strict';
const API_VERSION='release-version-v1';
const JAPANESE_RUNTIME='/app/japanese-mode-v1.js';
const SETTINGS_LOCAL_RECOVERY='/app/settings-local-tab-recovery-v334.js';
let languagePromise=null;
function versionFromManifest(manifest){
  const name=String(manifest?.name||'');
  const named=name.match(/\bv(\d+\.\d+\.\d+)\b/i)?.[1];
  if(named)return named;
  try{return new URL(manifest?.start_url||'',location.origin).searchParams.get('version')||''}catch{return''}
}
function canonicalRealm(){
  const root=document.documentElement;
  const system=String(root?.dataset?.civweaveSystemRoute||root?.dataset?.civweaveSystem||'').trim();
  return Boolean(system&&system!=='civweave');
}
function wantsJapanese(){
  try{
    const params=new URLSearchParams(location.search),explicit=String(params.get('lang')||params.get('locale')||'').toLowerCase();
    if(explicit==='ja'||explicit==='ja-jp'||params.get('japanese')==='1')return true;
    if(explicit==='en'||explicit==='en-us')return false;
    return localStorage.getItem('civweave.language.v1')==='ja';
  }catch{return false}
}
function ensureSettingsLocalRecovery(){
  if(globalThis.CivweaveSettingsLocalTabRecoveryV334)return true;
  const existing=[...document.scripts].find(script=>{
    try{return script.src&&new URL(script.src,location.href).pathname===SETTINGS_LOCAL_RECOVERY}catch{return false}
  });
  if(existing)return true;
  if(!document.head?.isConnected)return false;
  const script=document.createElement('script');
  script.src=`${SETTINGS_LOCAL_RECOVERY}?v=1.0.0-settings-local-tab-recovery-v334`;
  script.async=false;
  script.dataset.civweaveSettingsRecovery='release-version-v1';
  document.head.append(script);
  return true;
}
function ensureLanguageRuntime(){
  if(!wantsJapanese())return Promise.resolve(false);
  if(globalThis.CivweaveJapaneseModeV1?.apply){globalThis.CivweaveJapaneseModeV1.apply(document);return Promise.resolve(true)}
  if(languagePromise)return languagePromise;
  languagePromise=new Promise(resolve=>{
    const existing=[...document.scripts].find(script=>script.src&&new URL(script.src,location.href).pathname===JAPANESE_RUNTIME);
    const ready=()=>{try{globalThis.CivweaveJapaneseModeV1?.apply?.(document)}catch{}resolve(Boolean(globalThis.CivweaveJapaneseModeV1))};
    if(existing){
      if(globalThis.CivweaveJapaneseModeV1)return ready();
      existing.addEventListener('load',ready,{once:true});
      existing.addEventListener('error',()=>resolve(false),{once:true});
      return;
    }
    const script=document.createElement('script');
    script.src=`${JAPANESE_RUNTIME}?v=japanese-mode-v2`;
    script.async=false;
    script.dataset.civweaveJapaneseBootstrap='release-version-v1';
    script.onload=ready;
    script.onerror=()=>resolve(false);
    document.head?.append(script);
  }).finally(()=>{languagePromise=null});
  return languagePromise;
}
function versionDisplayNode(node){
  if(!node||node===document.documentElement||node===document.body)return false;
  if(node.matches?.('html,body,main,header,section,article,nav,aside,form'))return false;
  return true;
}
function apply(version){
  if(!/^\d+\.\d+\.\d+$/.test(version))return false;
  // Keep release metadata on <html>, but never treat that metadata attribute as
  // a text target. The previous implementation set data-civweave-version on
  // <html> and then selected [data-civweave-version], which assigned
  // documentElement.textContent and erased the entire application DOM.
  const displays=[...document.querySelectorAll('.version,.version-chip,[data-civweave-version]')].filter(versionDisplayNode);
  for(const node of displays)node.textContent=`v${version}`;
  document.documentElement.dataset.civweaveVersion=version;
  document.documentElement.dataset.civweaveVersionSync='structural-safe-v2';
  if(/\bv\d+\.\d+\.\d+\b/.test(document.title))document.title=document.title.replace(/\bv\d+\.\d+\.\d+\b/g,`v${version}`);
  globalThis.CivweaveReleaseVersionV1=Object.freeze({apiVersion:API_VERSION,version,apply,realmMutation:false,ensureLanguageRuntime,ensureSettingsLocalRecovery,structuralSafe:true,settingsLocalRecovery:'v334'});
  dispatchEvent(new CustomEvent('civweave:release-version',{detail:{version,apiVersion:API_VERSION}}));
  return true;
}
async function sync(){
  ensureSettingsLocalRecovery();
  void ensureLanguageRuntime();
  if(canonicalRealm()){
    globalThis.CivweaveReleaseVersionV1=Object.freeze({apiVersion:API_VERSION,version:'',apply,realmMutation:false,skipped:'canonical-realm',ensureLanguageRuntime,ensureSettingsLocalRecovery,japaneseBootstrap:'preference-only',settingsLocalRecovery:'v334',structuralSafe:true});
    return;
  }
  try{
    const response=await fetch('/app/manifest.webmanifest',{cache:'no-store'});
    if(!response.ok)throw new Error(`manifest ${response.status}`);
    const version=versionFromManifest(await response.json());
    if(!apply(version))throw new Error('manifest version missing');
  }catch(error){
    console.warn('[Civweave] Visible release version could not be synchronized.',error?.message||error);
  }
}
sync();
})();
