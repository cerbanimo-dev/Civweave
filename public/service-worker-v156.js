'use strict';
importScripts('/service-worker-critical-v199.js?v=fast-runtime-proxy-v202');
importScripts('/service-worker.js?v=1.0.6-base-r52-living-school-boot-v195');
// Compatibility marker: importScripts('/service-worker.js?v=1.0.6-base-r51-image-system-nav-repair')
// Compatibility marker: importScripts('/service-worker.js?v=1.0.6-base-r50-memory-credential-v191')
// Compatibility marker: importScripts('/service-worker.js?v=1.0.6-base-r49-weaveling-plan-json')
// Compatibility marker: importScripts('/service-worker.js?v=1.0.6-base-r48-worker-evaluation')
// Compatibility marker: importScripts('/service-worker.js?v=1.0.6-base-r47-ai-settings-cleanroom')
(()=>{
'use strict';
const INLINE_CHAT_REVISION='inline-commonweave-r45-settings-self-contained';
const EXTENSION_VERSION='working-campus-additions-v197-assistant-runtime-package';
// Compatibility marker: EXTENSION_VERSION='working-campus-additions-v196-living-school-reader-loop'
// Compatibility marker: EXTENSION_VERSION='working-campus-additions-v195-living-school-boot'
// Compatibility marker: EXTENSION_VERSION='working-campus-additions-v194-image-system-nav-repair'
// Compatibility marker: EXTENSION_VERSION='working-campus-additions-v193-passport-exposed'
// Compatibility marker: EXTENSION_VERSION='working-campus-additions-v192-credential-usable'
// Compatibility marker: EXTENSION_VERSION='working-campus-additions-v191-memory-credential'
// Compatibility marker: EXTENSION_VERSION='working-campus-additions-v190-weaveling-plan-json'
// Compatibility marker: EXTENSION_VERSION='working-campus-additions-v189-worker-evaluation'
// Compatibility marker: EXTENSION_VERSION='working-campus-additions-v188-ai-settings-cleanroom'
const PREVIOUS_EXTENSION_VERSION='working-campus-additions-v196-living-school-reader-loop';
const EARLIER_EXTENSION_VERSION='working-campus-additions-v195-living-school-boot';
const SETTINGS_CONTROLLER_REVISION='single-cleanroom-authority-v188-credential-v191';
// Compatibility marker: SETTINGS_CONTROLLER_REVISION='single-cleanroom-authority-v188'
const SETTINGS_RUNTIME_REVISION='provider-runtime-disconnected-v188';
const SETTINGS_LOG_REVISION='diagnostics-runtime-retired-v188';
const PACKAGE_RECOVERY_REVISION='device-package-self-heal-v197-assistant-runtime-package';
const ASSISTANT_RUNTIME_REVISION='fast-interactive-v192-context-planner-v198';
const WEAVELING_PLAN_REVISION='structured-json-system-prompt-v190';
const WEAVELING_MEMORY_REVISION='working-long-term-local-v191';
const PASSPORT_REVISION='anarchadia-passport-expanded-v193';
const LIVING_SCHOOL_BOOT_REVISION='nonblocking-bootstrap-v194';
const LIVING_SCHOOL_MUTATION_GUARD_REVISION='reader-self-mutation-filter-v196';
const DETERMINISTIC_RUNTIME_REVISION='deterministic-default-v175';
const GEMINI_TRANSPORT_REVISION='gemini-interactions-v159';
const DEVICE_CREDENTIALS_REVISION='usable-key-and-consent-v192';
const PROOF_COMPATIBLE_EXTENSION_REVISION='working-campus-additions-v158-proof-progress';
const LIVE_SOURCE_PROOF_REVISION='antigravity-live-source-proof-v167';
const THEMED_SYSTEM_NAV_REVISION='themed-system-nav-v194-image-buttons';
const EXTENSION_CACHE='cwext-working-campus-additions-v197-assistant-runtime-package';
const TOOL_FILES=[
  '/extensions/commonweave-additions-v156.css',
  '/extensions/commonweave-additions-v156.js',
  '/extensions/commonweave-secure-vault-v156.js',
  '/extensions/commonweave-domain-bridge-v156.js',
  '/extensions/commonweave-qr-v156.js',
  '/extensions/commonweave-mesh-tools-v156.js',
  '/extensions/commonweave-device-credentials-v160.js',
  '/extensions/commonweave-proof-progress-v158.js',
  '/extensions/commonweave-gemini-interactions-v159.js',
  '/extensions/commonweave-antigravity-live-source-guard-v167.js',
  '/extensions/commonweave-weaveling-plan-json-v190.js'
];
const APP_FILES=[
  '/app/fast-interactive-runtime-v192.js','/app/reward-policy-v198.js','/app/context-plan-composer-v198.js',
  '/app/weaveling-memory-v191.js','/app/weaveling-memory-bridge-v191.js',
  '/app/platform-stability-v159.js','/app/platform-stability-v159.css','/app/platform-experience-v160.js','/app/platform-experience-v160.css','/app/action-followthrough-v165.js','/app/merlinites-shell-fix-v166.css','/app/mobile-regression-v170.css','/app/mobile-regression-v170.js','/app/local-rails-validator-v170.js','/app/cerbanimo-ai-validator-v159.js','/app/cerbanimo-proof-attachments-v165.js','/app/rook-request-flow-v160.js','/app/merlinites-semantic-planner-v164.js','/app/pwa-v130.js','/app/system-interface-v157.css',
  '/app/themed-system-nav-v178.js','/app/assets/navigation/200-commonweave-nav.webp','/app/assets/navigation/200-cerbanimo-nav.webp','/app/assets/navigation/200-living-school-nav.webp','/app/assets/navigation/200-fellowfare-nav.webp','/app/assets/navigation/200-anarchadia-nav.webp',
  '/app/cabinets/living-school/living-school-bootstrap-v194.js','/app/cabinets/living-school/living-school-two-agent-relay-v165.js','/app/cabinets/living-school/living-school-mutation-guard-v196.js','/app/cabinets/living-school/living-school-workbench-v158.css','/app/cabinets/living-school/living-school-workbench-v158.js','/app/cabinets/living-school/living-school-research-v162.js','/app/cabinets/living-school/living-school-runtime-stability-v159.css','/app/cabinets/living-school/living-school-runtime-stability-v159.js','/app/cabinets/living-school/living-school-paths-v160.js',
  '/app/anarchadia-console-v158.js','/app/anarchadia-passport-v193.css','/app/anarchadia-passport-v193.js','/app/anarchadia-chat-stability-v158.css','/app/anarchadia-runtime-stability-v159.js','/app/anarchadia-change-review-v165.js','/app/anarchadia-live-layout-v167.js'
];
const EXTENSION_FILES=[...TOOL_FILES,...APP_FILES];
async function fetchRequired(url){const response=await fetch(`${url}${url.includes('?')?'&':'?'}v=${EXTENSION_VERSION}`,{cache:'no-store',headers:{'x-commonweave-package':'install'}});if(!response.ok)throw new Error(`Package asset ${url} returned ${response.status}`);return response}
async function cacheExtensions(){const cache=await caches.open(EXTENSION_CACHE);for(const url of EXTENSION_FILES)await cache.put(url,(await fetchRequired(url)).clone());return true}
async function extensionStatus(){const cache=await caches.open(EXTENSION_CACHE),keys=await cache.keys(),present=new Set(keys.map(request=>new URL(request.url).pathname)),missing=EXTENSION_FILES.filter(url=>!present.has(url));return{type:'COMMONWEAVE_ADDITIONS_STATUS',version:EXTENSION_VERSION,previousVersion:PREVIOUS_EXTENSION_VERSION,earlierVersion:EARLIER_EXTENSION_VERSION,appVersion:'1.0.6',settingsControllerRevision:SETTINGS_CONTROLLER_REVISION,settingsRuntimeRevision:SETTINGS_RUNTIME_REVISION,settingsLogRevision:SETTINGS_LOG_REVISION,packageRecoveryRevision:PACKAGE_RECOVERY_REVISION,assistantRuntimeRevision:ASSISTANT_RUNTIME_REVISION,workerEvaluationRevision:'v189-isolated-global-scope',weavelingPlanRevision:WEAVELING_PLAN_REVISION,weavelingMemoryRevision:WEAVELING_MEMORY_REVISION,passportRevision:PASSPORT_REVISION,livingSchoolBootRevision:LIVING_SCHOOL_BOOT_REVISION,livingSchoolMutationGuardRevision:LIVING_SCHOOL_MUTATION_GUARD_REVISION,onlineSelfHeal:true,missingAssetDetails:true,logLevelKey:null,logBufferKey:null,persistentLogBuffer:false,redactsSecrets:true,deterministicRuntimeRevision:DETERMINISTIC_RUNTIME_REVISION,geminiTransportRevision:GEMINI_TRANSPORT_REVISION,deviceCredentialsRevision:DEVICE_CREDENTIALS_REVISION,automaticCredentialPersistence:false,credentialPersistence:'explicit-session-or-device',credentialUsable:true,restoresConsent:true,mirrorsRuntimeSecret:true,proofCompatibleRevision:PROOF_COMPATIBLE_EXTENSION_REVISION,liveSourceProofRevision:LIVE_SOURCE_PROOF_REVISION,themedSystemNavRevision:THEMED_SYSTEM_NAV_REVISION,inlineChatRevision:INLINE_CHAT_REVISION,defaultProvider:'deterministic',settingsPresentation:'cleanroom-v188',nativeDialog:false,legacySettingsCapture:false,settingsMutationObserver:false,settingsPolling:false,settingsTimers:false,settingsDiagnosticsRuntime:false,transformerActive:false,providerRuntimeOnOpen:false,providerTestsAvailable:false,singlePassOpen:true,migrationOnDemand:false,cache:EXTENSION_CACHE,ready:missing.length===0,assetCount:EXTENSION_FILES.length,presentCount:EXTENSION_FILES.length-missing.length,toolFiles:TOOL_FILES.length,applicationFiles:APP_FILES.length,missing}}
self.addEventListener('install',event=>event.waitUntil(cacheExtensions()));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(names=>Promise.all(names.filter(name=>name.startsWith('cwext-')&&name!==EXTENSION_CACHE).map(name=>caches.delete(name))))));
self.addEventListener('message',event=>{if(event.data?.type==='GET_ADDITIONS_STATUS')event.waitUntil(extensionStatus().then(packet=>{event.ports?.[0]?.postMessage(packet);event.source?.postMessage?.(packet)}))});
self.addEventListener('fetch',event=>{const request=event.request;if(!['GET','HEAD'].includes(request.method))return;const url=new URL(request.url);if(url.origin!==self.location.origin||!url.pathname.startsWith('/extensions/'))return;event.respondWith(caches.open(EXTENSION_CACHE).then(async cache=>{const cached=await cache.match(url.pathname,{ignoreSearch:true});if(cached)return request.method==='HEAD'?new Response(null,{status:cached.status,statusText:cached.statusText,headers:cached.headers}):cached;try{const response=await fetch(request,{cache:'no-store'});if(response.ok)await cache.put(url.pathname,response.clone());return response}catch{return new Response(`Commonweave additive tool is not installed: ${url.pathname}`,{status:503,headers:{'content-type':'text/plain; charset=utf-8','x-commonweave-missing-asset':url.pathname,'x-commonweave-package-recovery':PACKAGE_RECOVERY_REVISION}})}}))});
})();
(self.CommonweaveCriticalBootV202||self.CommonweaveCriticalBootV201||self.CommonweaveCriticalBootV199)?.finalize();
