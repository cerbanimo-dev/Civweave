#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const bootstrap=read('public/app/local-ai/bootstrap-v266.js');
const lifecycle=read('public/app/document-lifecycle-v221.js');
const manager=read('public/app/local-ai/download-manager-v267.js');
const panel=read('public/app/local-ai/settings-panel-v267.js');
const installedLaunch=read('public/service-worker-installed-launch-v282.js');
const worker=read('public/service-worker-v203.js');
const workerBuilder=read('scripts/build-service-worker-v211.mjs');

assert.match(bootstrap,/test-pulse-v269\.js\?v=1\.0\.116-v303-mobile-safe/,'bootstrap must request the shipping v303 mobile-safe test-pulse revision');
assert.match(bootstrap,/1\.0\.116-local-model-test-pulse-v303-mobile-safe/,'bootstrap must accept the shipping v303 mobile-safe test-pulse identity');
assert.doesNotMatch(bootstrap,/1\.0\.83-local-model-test-pulse-v282-health/,'stale v282 test-pulse compatibility gate must stay retired');
assert.doesNotMatch(bootstrap,/1\.0\.86-local-model-test-pulse-v286-wasm-performance/,'stale v286 test-pulse compatibility gate must stay retired');

assert.match(lifecycle,/document-lifecycle-v322-settings-tab-service/,'settings lifecycle must identify as the v322 explicit-tab content service');
assert.match(lifecycle,/document-lifecycle-v322-explicit-local-model-tab/,'settings lifecycle must require the Local models tab');
assert.match(lifecycle,/searchParams\.get\('activate'\)==='1'/,'settings lifecycle must stay dormant until the canonical Settings owner activates it');
assert.match(lifecycle,/activation:'settings-v322-local-model-tab'/,'dormant lifecycle must identify the explicit local-model tab activation boundary');
assert.doesNotMatch(lifecycle,/captureSettingsOpen|document\.addEventListener\('click'/,'document lifecycle must not compete for Settings taps');
assert.doesNotMatch(lifecycle,/globalThis\.MutationObserver\s*=/,'document lifecycle must never replace MutationObserver globally');
assert.match(lifecycle,/function scheduleSettingsManagement\(/,'settings management must be independently schedulable');
assert.match(lifecycle,/managementAfterPaint:true/,'settings management must yield a browser paint before enhancement work');
assert.match(lifecycle,/explicitTabActivation:true/,'local-model management must require explicit tab activation');
assert.match(lifecycle,/bfCacheAutoManagement:false/,'BFCache return must not silently reload model management');
assert.match(lifecycle,/civweave:local-ai-settings-unavailable/,'local-AI enhancement failure must be reported without adding another Settings owner');
assert.match(lifecycle,/settingsEntryOwner:'settings-v320'/,'document lifecycle must identify the canonical Settings entry authority');
assert.match(lifecycle,/settingsOwner:'settings-v320'/,'document lifecycle must identify the canonical Settings presentation authority');
assert.match(lifecycle,/serviceRole:'downloaded-model-settings-content'/,'document lifecycle must remain a content service');
assert.match(lifecycle,/inputOwnership:false/,'document lifecycle must not own Settings input');
assert.match(lifecycle,/presentationOwnership:false/,'document lifecycle must not own Settings presentation');
assert.match(lifecycle,/settingsRootCreation:false/,'document lifecycle must not create a Settings root');
assert.match(lifecycle,/globalObserverPatch:false/,'document lifecycle must preserve browser observer primitives');
assert.match(lifecycle,/activationRequired:true/,'document lifecycle must remain lazy');
assert.match(lifecycle,/launchWork:'none'/,'document lifecycle must not perform startup inference work');
const revive=lifecycle.slice(lifecycle.indexOf('function revive()'),lifecycle.indexOf("addEventListener('pagehide'"));
assert.doesNotMatch(revive,/scheduleSettingsManagement|ensureLocalAISettingsManagement/,'BFCache return must not activate model management.');

const managementBody=lifecycle.match(/function managementReady\(\)\{([\s\S]*?)\}\nfunction canonicalLayer/)?.[1]||'';
assert.ok(managementBody,'management readiness function must be inspectable');
assert.doesNotMatch(managementBody,/LocalModelRuntime|LocalModelBridge/,'model-management readiness must not require the inference runtime or bridge');
assert.match(managementBody,/LocalAISettingsV266/,'management readiness must require the local-AI settings surface');
assert.match(managementBody,/LocalModelRegistryV266/,'management readiness must require the model registry');
assert.match(managementBody,/deviceFitRecommendations===true/,'management readiness must require device-fit recommendations');
assert.match(managementBody,/observerFeedbackBounded===true/,'management readiness must require the bounded Settings decorator');
assert.match(managementBody,/settingsOpenGpuProbe===false/,'management readiness must keep WebGPU probing out of Settings view work');
assert.match(manager,/autoSyncOnLoad:false/);
assert.match(manager,/explicitSyncOnly:true/);
assert.doesNotMatch(manager,/queueMicrotask\(\(\)=>sync\(\)/,'download manager must not reconcile cache/jobs on load');
assert.match(panel,/snapshotOnlyView:true/);
assert.match(panel,/backgroundSyncOnView:false/);
assert.doesNotMatch(panel,/pageshow[^\n]*syncBackgroundJobs/,'BFCache return must render saved model state without reconciliation.');

assert.match(installedLaunch,/V282_CAMPUS_PATH='\/app\/working-campus-v156\.html'/,'installed launch must know the real campus recovery route');
assert.match(installedLaunch,/installed-entry-then-working-campus-never-installer-substitution/,'installed reload recovery must never substitute the installer');
assert.match(installedLaunch,/x-civweave-installed-recovery/,'recovery responses must be diagnosable');
assert.match(worker,/service-worker-installed-launch-v282\.js\?v=installed-pwa-launch-v294-campus-recovery/,'generated worker must cache-bust the installed launch recovery layer');
assert.match(workerBuilder,/service-worker-installed-launch-v282\.js\?v=installed-pwa-launch-v294-campus-recovery/,'worker generator must preserve the v294 installed launch cache bust');
assert.match(workerBuilder,/installedLaunch:'installed-pwa-launch-v294-campus-recovery'/,'worker generator diagnostics must report v294 installed launch');

function makeContext(){
  const puts=[];
  const context={console,URL,URLSearchParams,Request,Response,Headers,VERSION:'1.0.95',SHELL_CACHE:'civweave-shell-test',RUNTIME_CACHE:'civweave-runtime-test',stableAppEntry:async()=>new Response('prior'),cacheKey:pathname=>new Request(`https://civweave.test${pathname}`),responseLooksValid:(response,pathname)=>Boolean(response?.ok&&(!pathname.endsWith('.html')||/text\/html/i.test(response.headers.get('content-type')||''))),normalizeStableAppEntryResponse:async response=>new Response(await response.clone().arrayBuffer(),{status:200,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}}),findCached:async()=>null,fetchFresh:async()=>{throw new Error('offline')},caches:{open:async name=>({put:async(request,response)=>{puts.push({name,url:request.url,status:response.status})}})},self:{location:{origin:'https://civweave.test'}},puts};
  context.self.self=context.self;vm.createContext(context);vm.runInContext(installedLaunch,context,{filename:'service-worker-installed-launch-v282.js'});return context;
}
{
  const context=makeContext();context.findCached=async pathname=>pathname==='/app/installed-entry-v146.html'?new Response('<!doctype html><title>entry</title>',{headers:{'content-type':'text/html'}}):null;
  const response=await context.stableAppEntry(new Request('https://civweave.test/app/installed-entry-v146.html',{headers:{accept:'text/html'}}));assert.equal(response.status,200);assert.equal(response.headers.get('x-civweave-installed-recovery'),'not-needed');
}
{
  const context=makeContext();context.findCached=async pathname=>pathname==='/app/working-campus-v156.html'?new Response('<!doctype html><title>campus</title>',{headers:{'content-type':'text/html'}}):null;
  const response=await context.stableAppEntry(new Request('https://civweave.test/app/installed-entry-v146.html'));const text=await response.text();assert.equal(response.status,200,'missing installed-entry must recover when Working Campus is available');assert.equal(response.headers.get('x-civweave-installed-recovery'),'working-campus');assert.match(text,/\/app\/working-campus-v156\.html\?installed=1(?:&amp;|&)version=1\.0\.95/);assert.match(text,/installed-entry-recovery-v294/);
}
{
  const context=makeContext();const response=await context.stableAppEntry(new Request('https://civweave.test/app/installed-entry-v146.html'));assert.equal(response.status,503,'503 is reserved for loss of both the installed entry and the actual campus');assert.match(await response.text(),/local launch entry and Working Campus are unavailable/i);
}

console.log(JSON.stringify({ok:true,revision:'reload-settings-recovery-v322-explicit-local-tab',assertions:{localAICompatibility:'v303-test-pulse-mobile-safe-current',settingsOpen:'canonical-ui-only',managementGate:'explicit-local-model-tab-content-only',bfcacheManagement:'off',cacheSyncOnView:false,globalBrowserPrimitives:'untouched',installedReload:'entry-then-working-campus-never-installer',workerCacheBust:'installed-pwa-launch-v294-campus-recovery'}},null,2));