(()=>{
'use strict';

const REVISION='installer-online-fallback-v225-source-truth-retired-v1';
const SAFE_RUNTIME='/app/installer-repair-only-v1.js?v=install-only-pwa-v1-legacy-alias';

function loadRepairOnly(){
  if(globalThis.CivweaveInstallerRepairOnlyV1)return true;
  if(document.querySelector('script[src^="/app/installer-repair-only-v1.js"]'))return true;
  const script=document.createElement('script');
  script.src=SAFE_RUNTIME;
  script.async=false;
  script.dataset.civweaveLegacyFallbackReplacement=REVISION;
  document.head?.append(script);
  return true;
}

loadRepairOnly();

globalThis.CivweaveInstallerOnlineFallbackV225=Object.freeze({
  revision:REVISION,
  retired:true,
  replacement:SAFE_RUNTIME,
  browserRuntime:false,
  sourceTruth:true,
  domCleanup:false,
  policy:'legacy-alias-to-repair-only-never-open-campus'
});
})();
