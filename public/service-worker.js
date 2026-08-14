'use strict';
const VERSION='1.0.7';
const CACHE_REVISION='direct-family-r46-installer-brand-v1';
const GUIDE_REVISION='five-system-chat-r46-weaveling-memory';
const CABINET_REVISION='direct-software-r38-v106';
const DEVICE_REVISION='device-package-r43-hub-map-offline';
const CALIBRATION_REVISION='marketing-only-r1';
const INSTALL_REVISION='direct-entry-r45-memory-credential-v191';
const LEDGER_HYDRATION_REVISION='direct-software-r35';
const AI_REVISION='settings-v191-explicit-device-credential';
const BASE_PACKAGE_RECOVERY_REVISION='device-package-self-heal-v191';
const MEMORY_REVISION='weaveling-working-long-memory-v191';
// Compatibility markers retained for prior audits:
// CACHE_REVISION='direct-family-r44-package-self-heal'
// CACHE_REVISION='direct-family-r43-settings-single-pass'
// AI_REVISION='settings-v183-diagnostics-package-self-heal-fixed-ort'
// AI_REVISION='self-contained-settings-v182-single-pass-fixed-ort'
// BASE_PACKAGE_RECOVERY_REVISION='device-package-self-heal-v184'
const STATIC_CACHE=`civweave-static-${VERSION}-${CACHE_REVISION}-${GUIDE_REVISION}-${CABINET_REVISION}-${DEVICE_REVISION}-${INSTALL_REVISION}`;
const RUNTIME_CACHE=`civweave-runtime-${VERSION}-${CACHE_REVISION}-${GUIDE_REVISION}-${CABINET_REVISION}-${DEVICE_REVISION}-${INSTALL_REVISION}`;
const MODEL_CACHE='civweave-model-1.0.7-minilm-fixed-ort-r1';
const MODEL_FILES=new Set([
  '/app/models/all-minilm-l6-v2/config.json',
  '/app/models/all-minilm-l6-v2/tokenizer_config.json',
  '/app/models/all-minilm-l6-v2/vocab.txt',
  '/app/models/all-minilm-l6-v2/reflex-index.json',
  '/app/models/all-minilm-l6-v2/onnx/model_quantized.onnx',
  '/app/vendor/onnxruntime/ort.wasm.min.mjs',
  '/app/vendor/onnxruntime/ort-wasm-simd-threaded.mjs',
  '/app/vendor/onnxruntime/ort-wasm-simd-threaded.wasm'
]);
const ARCHIVED_LOCATION_PREFIXES=['/app/services/living-school/visual-assets/','/app/services/cerbanimo/assets/visual/','/app/services/fellowfare/assets/mall/','/app/services/anarchadia/assets/screens/'];
const MAP_CORE=[
  '/finder/index.html',
  '/app/hub-map-v1.html',
  '/app/federation-finder-map-v275.html',
  '/app/civweave-hub-map-v1.js',
  '/app/civweave-locality-gossip-v1.js',
  '/app/host-node-session-v1.js',
  '/app/civweave-map-v1-manifest.json',
  '/app/civweave-map-service-v275.js',
  '/app/civweave-map-bootstrap-v1.js',
  '/app/civweave-map-mesh-v276.js',
  '/app/civweave-map-mesh-bridge-v276.js',
  '/app/civweave-map-coverage-v277.js',
  '/app/civweave-map-storage-v1.js',
  '/app/civweave-map-offline-v1.js',
  '/app/civweave-map-ui-v1.js',
  '/app/shared/civweave-map-coverage-scoring-v1.mjs',
  '/app/shared/civweave-sha256-stream-v1.mjs',
  '/app/federation-finder-data/federation-seed-v269.json',
  '/app/vendor/maplibre-v5.13.0/maplibre-gl.js',
  '/app/vendor/maplibre-v5.13.0/maplibre-gl.css',
  '/app/vendor/pmtiles-v4.4.1/pmtiles.js'
];
const CORE=[
  '/index.html','/install-v130.css','/install-v130.js','/offline.html',
  '/app/manifest.webmanifest','/app/installed-entry-v146.html','/app/installed-entry-v146.js','/app/install-boundary-v146.js','/app/local-object-mesh-v146.js','/app/local-first-policy-v131.js',
  '/app/fullscreen-family-v104.html','/app/working-campus-v156.html','/app/working-campus-v156.css','/app/working-campus-v156.js','/app/working-campus-v156.part1.txt','/app/working-campus-v156.part2.txt','/app/working-campus-v156.part3.txt','/app/working-campus-v156.part4.txt','/app/working-campus-v156.part5.txt','/app/family-shell-v104.css','/app/family-shell-v104.js','/app/family-ai-loader-v105.js','/app/weaveling-memory-v191.js','/app/weaveling-memory-bridge-v191.js',
  '/app/model-settings-controller-v173.js','/app/unified-ai-settings-v175.js','/app/deterministic-mode-v175.js','/app/settings-delegation-v175.js','/app/shared-tools-cleanup-v175.js','/app/model-settings-v133.css','/app/shared/civweave-model-runtime.js','/app/safe-mode-v1.mjs',
  '/app/realm-console-v140.html','/app/realm-console-v140.css','/app/realm-console-v140.js','/app/cerbanimo-quest-engine-v144.css','/app/cerbanimo-quest-engine-v144.js','/app/cerbanimo-ai-validator-v156.js',
  '/app/cabinets/living-school/index.html','/app/cabinets/living-school/living-school-cabinet-v151.css','/app/cabinets/living-school/living-school-cabinet-v151.mjs','/app/services/living-school/modules/rubric-engine.mjs','/app/services/living-school/modules/project-gate.mjs','/app/services/living-school/modules/cerbanimo-bridge.mjs',
  '/app/fellowfare-cabinet-v144.html','/app/fellowfare-cabinet-v144.css','/app/fellowfare-cabinet-v144.js',
  '/app/anarchadia-console-v139.html','/app/anarchadia-console-v139.css','/app/anarchadia-console-v139.js','/app/anarchadia-cabinet-workbench-v144.js',
  '/app/anarchadia-governance-v145.html','/app/anarchadia-governance-v145.css','/app/anarchadia-governance-v145.js','/app/anarchadia-governance-kernel-v145.js','/app/anarchadia-governance-store-v145.js','/app/anarchadia-governance-bridge-v145.js',
  '/app/anarchadia-sovereignty-v146.html','/app/anarchadia-sovereignty-v146.css','/app/anarchadia-sovereignty-v146.js','/app/anarchadia-sovereignty-kernel-v146.js','/app/anarchadia-local-sovereignty-v146.js','/app/anarchadia-sovereignty-bridge-v146.js',
  '/app/guide-contracts-v141.js','/app/assistant-runtime-v141.js','/app/assistant-runtime-v141.css','/app/core-loop-v152.js','/app/capability-readiness-v154.js','/app/intention-planner-v141.js','/app/intention-ui-v138.js','/app/intention-ui-v138.css',
  '/app/shared/civweave-parity-runtime.js','/app/shared/civweave-parity-ledger.json',
  '/app/services/anarchadia/workbench.html','/app/services/anarchadia/cabinet-workbench-v144.css','/app/services/anarchadia/cabinet-workbench-loader-v144.js','/app/services/anarchadia/styles.css','/app/services/anarchadia/src/app.js','/app/services/anarchadia/src/domain.js','/app/services/anarchadia/src/store.js','/app/services/anarchadia/src/export.js','/app/services/anarchadia/src/ai.js','/app/services/anarchadia/civweave-handoff-consumer.js','/app/services/anarchadia/civweave-presence.js','/app/services/anarchadia/docs/PROVISIONAL_CONSTITUTION.md',
  '/app/services/fellowfare/cabinet.html','/app/services/fellowfare/cabinet-embed.css','/app/services/fellowfare/cabinet-bridge.js','/app/services/fellowfare/styles.css','/app/services/fellowfare/app.js','/app/services/fellowfare/ai.js','/app/services/fellowfare/ledger.js','/app/services/fellowfare/shared/civweave-model-runtime.js','/app/services/fellowfare/civweave-handoff-consumer.js',
  '/app/learning-pack-seeds-v1.js',
  '/app/shared/learning-pack-runtime-v1.mjs',
  '/app/shared/learning-pack-resolver-v1.mjs',
  '/app/shared/learning-pack-shelf-v1.mjs',
  '/app/shared/learning-pack-shelf-v1.css',
  '/app/shared/core-practice-pack-v1.mjs',
  '/app/shared/expert-pack-library-v1.mjs',
  '/app/shared/skill-crosswalk-v1.mjs',
  '/app/shared/labor-intelligence-core-v1.mjs',
  '/app/cerbanimo-learning-packs-v1.js',
  '/app/living-school-learning-packs-v1.mjs',
  '/app/services/fellowfare/labor-context-v1.mjs',
  '/downloads/learning-packs/catalog.json',
  '/downloads/learning-packs/onet-labor-atlas-30-3.json.gz',
  '/downloads/learning-packs/esco-skill-crosswalk-v1.json.gz',
  '/app/logos/civweave.webp','/app/logos/civweave-app-icon.png','/app/logos/cerbanimo.webp','/app/logos/fellowfare-v2.webp','/app/logos/civweave-icon-192.png','/app/logos/civweave-icon-512.png','/app/logos/civweave-icon-maskable-192.png','/app/logos/civweave-icon-maskable-512.png','/app/logos/civweave-pwa-192-v247.png','/app/logos/civweave-prismatic-wordmark-v1.png','/app/logos/cerbanimo-steward-mark-v1.png',
  '/app/assets/ai/weaveling.png','/app/assets/ai/moss.png','/app/assets/ai/kamiya.png','/app/assets/ai/rook.png','/app/assets/ai/merlin.png'
];
const DEVICE_REQUIRED=[...CORE,...MAP_CORE];
async function cacheRequired(cache,url){const response=await fetch(url,{cache:'no-store',headers:{'x-civweave-package':'install'}});if(!response.ok)throw new Error(`Device package asset ${url} returned ${response.status}`);await cache.put(url,response.clone());return true}
async function packageStatus(){const cache=await caches.open(STATIC_CACHE),keys=await cache.keys(),required=[...new Set(DEVICE_REQUIRED)],present=new Set(keys.map(request=>new URL(request.url).pathname)),missing=required.filter(url=>!present.has(url));return{type:'CIVWEAVE_DEVICE_PACKAGE',ready:missing.length===0,version:VERSION,revision:INSTALL_REVISION,deviceRevision:DEVICE_REVISION,ledgerHydrationRevision:LEDGER_HYDRATION_REVISION,aiRevision:AI_REVISION,memoryRevision:MEMORY_REVISION,credentialPersistence:'explicit-session-or-device',packageRecoveryRevision:BASE_PACKAGE_RECOVERY_REVISION,onlineSelfHeal:true,missingAssetDetails:true,defaultProvider:'deterministic',settingsPresentation:'self-contained-fixed-layer',nativeDialog:false,transformerActive:false,providerRuntimeOnOpen:false,singlePassOpen:true,migrationOnDemand:true,modelOnDemand:true,modelCache:MODEL_CACHE,cache:STATIC_CACHE,assetCount:required.length,presentCount:required.length-missing.length,missing,mapPackage:'Civweave Map v1'} }
async function modelPackageStatus(){const cache=await caches.open(MODEL_CACHE),keys=await cache.keys(),present=new Set(keys.map(request=>new URL(request.url).pathname)),required=[...MODEL_FILES],missing=required.filter(url=>!present.has(url));return{type:'CIVWEAVE_MODEL_PACKAGE',ready:missing.length===0,version:VERSION,runtime:'onnxruntime-web/wasm',executionProvider:'wasm',threads:1,cache:MODEL_CACHE,assetCount:required.length,presentCount:required.length-missing.length,missing}}
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(STATIC_CACHE);try{for(const url of [...new Set(DEVICE_REQUIRED)])await cacheRequired(cache,url);await self.skipWaiting()}catch(error){await caches.delete(STATIC_CACHE);console.error('[Civweave] Core package installation failed:',error);throw error}})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();const stale=keys.filter(key=>(key.startsWith('civweave-')&&key!==STATIC_CACHE&&key!==RUNTIME_CACHE&&key!==MODEL_CACHE)||/^(living-school|cerbanimo|fellowfare|anarchadia)-/.test(key));await Promise.all(stale.map(key=>caches.delete(key)));await self.clients.claim()})()));
self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
  if(event.data?.type==='GET_VERSION'){const packet={type:'CIVWEAVE_VERSION',version:VERSION,revision:`${CACHE_REVISION}-${GUIDE_REVISION}-${CABINET_REVISION}-${DEVICE_REVISION}-${INSTALL_REVISION}`,localFirstRevision:CACHE_REVISION,guideRevision:GUIDE_REVISION,cabinetRevision:CABINET_REVISION,deviceRevision:DEVICE_REVISION,calibrationRevision:CALIBRATION_REVISION,installRevision:INSTALL_REVISION,ledgerHydrationRevision:LEDGER_HYDRATION_REVISION,aiRevision:AI_REVISION,memoryRevision:MEMORY_REVISION,credentialPersistence:'explicit-session-or-device',packageRecoveryRevision:BASE_PACKAGE_RECOVERY_REVISION,onlineSelfHeal:true,missingAssetDetails:true,defaultProvider:'deterministic',settingsPresentation:'self-contained-fixed-layer',nativeDialog:false,transformerActive:false,providerRuntimeOnOpen:false,singlePassOpen:true,migrationOnDemand:true,modelOnDemand:true,modelRuntime:'onnxruntime-web/wasm',mapPackage:'Civweave Map v1'};event.ports?.[0]?.postMessage(packet);event.source?.postMessage?.(packet)}
  if(event.data?.type==='GET_DEVICE_PACKAGE_STATUS')event.waitUntil(packageStatus().then(packet=>{event.ports?.[0]?.postMessage(packet);event.source?.postMessage?.(packet)}));
  if(event.data?.type==='GET_MODEL_PACKAGE_STATUS')event.waitUntil(modelPackageStatus().then(packet=>{event.ports?.[0]?.postMessage(packet);event.source?.postMessage?.(packet)}));
});
self.addEventListener('sync',event=>{if(event.tag==='civweave-community-outbox')event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{for(const client of clients)client.postMessage({type:'CIVWEAVE_OUTBOX_SYNC_REQUESTED'});return true}))});
async function cachedResponse(requestOrUrl){return caches.match(requestOrUrl,{ignoreSearch:true,ignoreMethod:true})}
function headResponse(response){return new Response(null,{status:response.status,statusText:response.statusText,headers:response.headers})}
async function notifyPackageEvent(detail){try{const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of clients)client.postMessage({type:'CIVWEAVE_PACKAGE_EVENT',...detail})}catch{}}
async function networkRepair(request){
  const url=new URL(request.url);
  try{
    const headers=new Headers(request.headers);headers.set('x-civweave-package','runtime-repair');
    const response=await fetch(new Request(request,{cache:'no-store',headers}));
    const type=String(response.headers.get('content-type')||'');
    if(!response.ok)return null;
    if(request.mode!=='navigate'&&/text\/html/i.test(type)&&!url.pathname.endsWith('.html'))return null;
    if(request.method==='GET'){const cache=await caches.open(RUNTIME_CACHE);await cache.put(url.pathname,response.clone())}
    await notifyPackageEvent({event:'asset-repaired',pathname:url.pathname,status:response.status,recoveryRevision:BASE_PACKAGE_RECOVERY_REVISION});
    return response;
  }catch{return null}
}
function missingAssetResponse(pathname,fallback=''){
  const body=[
    `Civweave could not load ${pathname}.`,
    'It was missing from the installed package cache and could not be repaired from the network.',
    fallback?`Offline fallback attempted: ${fallback}`:'No packaged fallback matched this route.',
    'Open the Civweave installer, tap Check updates, then use Reset and retry package if the problem remains.',
    `Package recovery revision: ${BASE_PACKAGE_RECOVERY_REVISION}`
  ].join('\n\n');
  return new Response(body,{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-civweave-device-package':'not-installed','x-civweave-missing-asset':pathname,'x-civweave-package-recovery':BASE_PACKAGE_RECOVERY_REVISION}})
}
async function deviceOnly(request,fallback=''){
  const url=new URL(request.url),cached=await cachedResponse(request)||await cachedResponse(url.pathname);
  if(cached)return request.method==='HEAD'?headResponse(cached):cached;
  const repaired=await networkRepair(request);
  if(repaired)return request.method==='HEAD'?headResponse(repaired):repaired;
  const fallbackCached=fallback?await cachedResponse(fallback):null;
  if(fallbackCached){await notifyPackageEvent({event:'asset-fallback',pathname:url.pathname,fallback,recoveryRevision:BASE_PACKAGE_RECOVERY_REVISION});return request.method==='HEAD'?headResponse(fallbackCached):fallbackCached}
  await notifyPackageEvent({event:'asset-missing',pathname:url.pathname,fallback,recoveryRevision:BASE_PACKAGE_RECOVERY_REVISION});
  return missingAssetResponse(url.pathname,fallback)
}
async function modelOnDemand(request){
  const url=new URL(request.url),cache=await caches.open(MODEL_CACHE),cached=await cache.match(url.pathname,{ignoreSearch:true});
  if(cached)return request.method==='HEAD'?headResponse(cached):cached;
  try{
    const headers=new Headers(request.headers);headers.set('x-civweave-package','model');
    const response=await fetch(new Request(request,{cache:'no-store',headers}));
    const type=String(response.headers.get('content-type')||'');
    if(!response.ok||/text\/html/i.test(type))throw new Error(`Model asset ${url.pathname} returned ${response.status} ${type||'unknown'}`);
    if(request.method==='GET')await cache.put(url.pathname,response.clone());
    return request.method==='HEAD'?headResponse(response):response;
  }catch(error){return new Response(`Local model asset unavailable: ${error.message}`,{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-civweave-model-package':'not-installed'}})}
}
async function injectNavigationPolicy(response,pathname=''){const type=response.headers.get('content-type')||'';if(!type.includes('text/html'))return response;const text=await response.text(),scripts=[];if(!text.includes('/app/install-boundary-v146.js'))scripts.push('<script src="/app/install-boundary-v146.js?v=1.0.7"></script>');if(pathname.includes('anarchadia')&&!text.includes('/app/anarchadia-local-sovereignty-v146.js'))scripts.push('<script src="/app/anarchadia-local-sovereignty-v146.js?v=1.0.7"></script><script src="/app/anarchadia-sovereignty-bridge-v146.js?v=1.0.7"></script>');if(!scripts.length)return new Response(text,{status:response.status,statusText:response.statusText,headers:response.headers});const insertion=scripts.join(''),html=/<\/head>/i.test(text)?text.replace(/<\/head>/i,insertion+'</head>'):text.replace(/<\/body>/i,insertion+'</body>');const headers=new Headers(response.headers);headers.delete('content-length');headers.set('x-civweave-install-boundary','v146');if(pathname.includes('anarchadia'))headers.set('x-civweave-local-sovereignty','v146');return new Response(html,{status:response.status,statusText:response.statusText,headers})}
function navigationFallback(url){const pathname=url.pathname;if(pathname==='/finder'||pathname==='/finder/'||pathname==='/finder/index.html')return'/app/hub-map-v1.html';if(pathname.includes('installed-entry-v146'))return'/app/installed-entry-v146.html';if(pathname.includes('working-campus-v156'))return'/app/working-campus-v156.html';if(pathname.includes('fullscreen-family-v104'))return'/app/fullscreen-family-v104.html';if(pathname.endsWith('/services/fellowfare/cabinet.html'))return'/app/services/fellowfare/cabinet.html';if(pathname.includes('fellowfare-cabinet'))return'/app/fellowfare-cabinet-v144.html';if(pathname.includes('/app/cabinets/living-school/'))return'/app/cabinets/living-school/index.html';if(pathname.includes('anarchadia-console'))return'/app/anarchadia-console-v139.html';if(pathname.includes('realm-console'))return'/app/realm-console-v140.html';if(pathname.includes('anarchadia-sovereignty'))return'/app/anarchadia-sovereignty-v146.html';if(pathname.includes('anarchadia-governance'))return'/app/anarchadia-governance-v145.html';if(pathname.includes('cabinet-mode')||pathname.includes('cabinet-only')||pathname.includes('cabinet-visual')||pathname.startsWith('/loom')||pathname.startsWith('/lite')||pathname.startsWith('/cabinetonly'))return'/app/fullscreen-family-v104.html';if(DEVICE_REQUIRED.includes(pathname)&&pathname.endsWith('.html'))return pathname;if(pathname.startsWith('/app/'))return'/app/installed-entry-v146.html';return'/app/installed-entry-v146.html'}
self.addEventListener('fetch',event=>{
  const request=event.request;if(!['GET','HEAD'].includes(request.method))return;
  const url=new URL(request.url);if(url.origin!==self.location.origin)return;
  if(url.pathname.startsWith('/api/'))return;
  if(ARCHIVED_LOCATION_PREFIXES.some(prefix=>url.pathname.startsWith(prefix))){event.respondWith(Promise.resolve(new Response('Location scene is not included in the installed software package.',{status:410,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-civweave-asset-status':'marketing-only'}})));return}
  if(url.pathname==='/service-worker.js'||url.pathname==='/service-worker-v156.js'){event.respondWith(fetch(request,{cache:'no-store'}));return}
  if(url.pathname==='/'||url.pathname==='/index.html'||url.pathname.startsWith('/downloads/'))return;
  if(MODEL_FILES.has(url.pathname)){event.respondWith(modelOnDemand(request));return}
  if(request.mode==='navigate'){event.respondWith((async()=>injectNavigationPolicy(await deviceOnly(request,navigationFallback(url)),url.pathname))());return}
  if(url.pathname.startsWith('/app/')||url.pathname.startsWith('/finder/')||url.pathname.startsWith('/loom/')||url.pathname.startsWith('/lite/')||url.pathname.startsWith('/cabinetonly/')||url.pathname==='/offline.html'){event.respondWith(deviceOnly(request));return}
});
