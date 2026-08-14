(()=>{
'use strict';

const REVISION='installer-online-fallback-v225-retired-install-only-pwa-v1';
const SAFE_RUNTIME='/app/installer-repair-only-v1.js?v=install-only-pwa-v1-legacy-alias';

function removeLegacyBrowserLaunchers(){
  document.querySelector('#open-online-campus-v225')?.remove();
  document.querySelectorAll('[data-civweave-browser-fallback],a[href*="launch=online"],[data-civweave-online-fallback]').forEach(node=>node.remove());
}
function loadRepairOnly(){
  if(globalThis.CivweaveInstallerRepairOnlyV1)return true;
  if(document.querySelector(`script[src^="/app/installer-repair-only-v1.js"]`))return true;
  const script=document.createElement('script');
  script.src=SAFE_RUNTIME;
  script.async=false;
  script.dataset.civweaveLegacyFallbackReplacement=REVISION;
  document.head?.append(script);
  return true;
}
function apply(){
  removeLegacyBrowserLaunchers();
  const help=document.querySelector('#install-help');
  if(help&&!help.dataset.civweaveLegacyFallbackRetired){
    help.dataset.civweaveLegacyFallbackRetired=REVISION;
    if(/online launch|browser fallback|open civweave online/i.test(help.textContent||''))help.textContent='Browser-tab runtime is retired. Repair or install here, then open Civweave from the device app launcher.';
  }
  const install=document.querySelector('#install-app');
  if(install&&/open civweave online|continue in browser/i.test(install.textContent||''))install.textContent='Install Civweave';
}

apply();
loadRepairOnly();
const observer=new MutationObserver(apply);
observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
addEventListener('pagehide',()=>observer.disconnect(),{once:true});

globalThis.CivweaveInstallerOnlineFallbackV225=Object.freeze({
  revision:REVISION,
  retired:true,
  replacement:SAFE_RUNTIME,
  browserRuntime:false,
  policy:'legacy-alias-to-repair-only-never-open-campus'
});
})();
