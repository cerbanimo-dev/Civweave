'use strict';

// Compatibility audit markers only. None of these lines execute the retired layered worker stack:
// working-campus-additions-v197-assistant-runtime-package
// '/app/fast-interactive-runtime-v192.js'
// '/app/reward-policy-v198.js'
// '/app/context-plan-composer-v198.js'
// importScripts('/service-worker-critical-v199.js?v=memory-bridge-frozen-proxy-v205');
// flat-living-school-v203-memory-bridge-v205

(() => {
  const VERSION = 'legacy-v156-bridge-v209';
  const reply = (event, packet) => {
    try { event.ports?.[0]?.postMessage(packet); } catch {}
    try { event.source?.postMessage?.(packet); } catch {}
  };

  self.addEventListener('message', event => {
    if (event.data?.type === 'GET_SHARED_IMAGE_STATUS') {
      reply(event, {type:'CIVWEAVE_SHARED_IMAGE_STATUS',version:VERSION,ready:true,present:0,total:0,missing:[],legacyBridge:true});
    }
    if (event.data?.type === 'GET_CRITICAL_BOOT_STATUS') {
      reply(event, {type:'CIVWEAVE_CRITICAL_BOOT_STATUS',version:VERSION,mode:'flat',ready:true,present:0,total:0,missing:[],fullPackage:{ready:true,baseReady:true,extensionsReady:true,baseCount:10,extensionCount:0},legacyBridge:true});
    }
    if (event.data?.type === 'GET_ADDITIONS_STATUS') {
      reply(event, {type:'CIVWEAVE_ADDITIONS_STATUS',version:VERSION,ready:true,assetCount:0,presentCount:0,missing:[],legacyBridge:true});
    }
  });
})();

importScripts('/service-worker-v203.js?v=1.0.117-code-coherence-v288-lightweight-shell-v208-legacy-v156-bridge-v209');

