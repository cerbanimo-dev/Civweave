#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const bootstrap=read('public/app/local-ai/bootstrap-v266.js');
const lifecycle=read('public/app/document-lifecycle-v221.js');
const installedLaunch=read('public/service-worker-installed-launch-v282.js');
const worker=read('public/service-worker-v203.js');
const workerBuilder=read('scripts/build-service-worker-v211.mjs');

assert.match(bootstrap,/test-pulse-v269\.js\?v=1\.0\.116-v303-mobile-safe/,'bootstrap must request the shipping v303 mobile-safe test-pulse revision');
assert.match(bootstrap,/1\.0\.116-local-model-test-pulse-v303-mobile-safe/,'bootstrap must accept the shipping v303 mobile-safe test-pulse identity');
assert.doesNotMatch(bootstrap,/1\.0\.83-local-model-test-pulse-v282-health/,'stale v282 test-pulse compatibility gate must stay retired');
assert.doesNotMatch(bootstrap,/1\.0\.86-local-model-test-pulse-v286-wasm-performance/,'stale v286 test-pulse compatibility gate must stay retired');

assert.match(lifecycle,/document-lifecycle-v317-management-only/,'settings lifecycle must use the v317 management-only contract');
assert.match(lifecycle,/document-lifecycle-v317-explicit-activation/,'settings lifecycle must require explicit gateway activation');
assert.match(lifecycle,/searchParams\.get\('activate'\)==='1'/,'settings lifecycle must activate only through the gateway');
assert.doesNotMatch(lifecycle,/captureSettingsOpen|document\.addEventListener\('click'/,'document lifecycle must not compete with the gateway for Settings taps');
assert.doesNotMatch(lifecycle,/globalThis\.MutationObserver\s*=/,'document lifecycle must never replace MutationObserver globally');
assert.match(lifecycle,/function scheduleSettingsManagement\(/,'settings management must be independently schedulable');
assert.match(lifecycle,/managementAfterPaint:true/,'settings management must yield a browser paint before enhancement work');
assert.match(lifecycle,/settingsEntryOwner:'settings-gateway-v317'/,'settings lifecycle must declare the gateway as input owner');
assert.match(lifecycle,/inputOwnership:false/,'settings lifecycle must remain input-neutral');
assert.match(lifecycle,/launchWork:'none'/,'settings lifecycle must do no work at app launch');

const managementBody=lifecycle.match(/function managementReady\(\)\{([\s\S]*?)\}\nfunction enhance/)?.[1]||'';
assert.ok(managementBody,'management readiness function must be inspectable');
assert.match(managementBody,/largeExternalDataForeground===true/,'management readiness must include the download policy');
assert.match(managementBody,/metadataOnlyRepair===true/,'management readiness must include metadata repair');
assert.match(managementBody,/metadataRepairRaceSafe===true/,'management readiness must require race-safe metadata repair');
assert.match(managementBody,/CivweaveLocalAIPrimaryRouteV283/,'management readiness must include the primary route');
assert.match(managementBody,/deviceFitRecommendations===true/,'management readiness must include device-fit support');
assert.doesNotMatch(managementBody,/LocalModelRuntime|LocalModelBridge/,'opening Settings must not require the inference runtime or bridge');
assert.doesNotMatch(lifecycle,/localAIInferenceReady|ensureLocalAIInference|runtime-v266|runtime-bridge-v266|new Worker\(|\.generate\(/,'the Settings lifecycle must not contain an inference lane');

assert.match(installedLaunch,/V282_CAMPUS_PATH='\/app\/working-campus-v156\.html'/,'installed launch must know the real campus recovery route');
assert.match(installedLaunch,/installed-entry-then-working-campus-never-installer-substitution/,'installed reload recovery must never substitute the installer');
assert.match(installedLaunch,/x-civweave-installed-recovery/,'recovery responses must be diagnosable');
assert.match(worker,/service-worker-installed-launch-v282\.js\?v=installed-pwa-launch-v294-campus-recovery/,'generated worker must cache-bust the installed launch recovery layer');
assert.match(workerBuilder,/service-worker-installed-launch-v282\.js\?v=installed-pwa-launch-v294-campus-recovery/,'worker generator must preserve the v294 installed launch cache bust');
assert.match(workerBuilder,/installedLaunch:'installed-pwa-launch-v294-campus-recovery'/,'worker generator diagnostics must report v294 installed launch');

await import('./smoke-installer-recovery-v206.mjs');

console.log(JSON.stringify({
  ok:true,
  revision:'reload-settings-recovery-v317-management-only',
  assertions:{
    localAICompatibility:'v303-test-pulse-mobile-safe-current',
    settingsOpen:'gateway-then-post-paint-management',
    inferenceGate:'absent-from-settings-lifecycle',
    globalBrowserPrimitives:'untouched',
    installedReload:'covered-by-v206-recovery-smoke-plus-v294-static-contract',
    workerCacheBust:'installed-pwa-launch-v294-campus-recovery'
  }
},null,2));
