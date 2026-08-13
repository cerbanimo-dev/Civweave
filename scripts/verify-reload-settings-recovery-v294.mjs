#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

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

assert.match(lifecycle,/document\.addEventListener\('click',captureSettingsOpen,true\)/,'AI settings must have a capture-phase first-open path');
assert.match(lifecycle,/event\.stopImmediatePropagation\(\)/,'successful first-open must suppress legacy target handlers that wait for inference');
assert.match(lifecycle,/controller\.open\(launcher\)/,'settings controller must open before downloaded inference readiness is awaited');
assert.match(lifecycle,/ensureMinimalManagement/,'settings must have a management-only recovery path');
assert.match(lifecycle,/settingsStillOpen/,'local-AI enhancement failure must report without closing the settings surface');

const managementBody=lifecycle.match(/function localAIManagementReady\(\)\{([\s\S]*?)\}\nfunction localAIInferenceReady/)?.[1]||'';
assert.ok(managementBody,'management readiness function must be inspectable');
assert.doesNotMatch(managementBody,/LocalModelRuntime|LocalModelBridge/,'opening/model-management readiness must not require the inference runtime or bridge');
const inferenceBody=lifecycle.match(/function localAIInferenceReady\(\)\{([\s\S]*?)\}\nfunction enhanceLocalAISettings/)?.[1]||'';
assert.match(inferenceBody,/LocalModelRuntimeV266/,'inference readiness must still validate the runtime');
assert.match(inferenceBody,/LocalModelBridgeV266/,'inference readiness must still validate the bridge');

assert.match(installedLaunch,/V282_CAMPUS_PATH='\/app\/working-campus-v156\.html'/,'installed launch must know the real campus recovery route');
assert.match(installedLaunch,/installed-entry-then-working-campus-never-installer-substitution/,'installed reload recovery must never substitute the installer');
assert.match(installedLaunch,/x-civweave-installed-recovery/,'recovery responses must be diagnosable');
assert.match(worker,/service-worker-installed-launch-v282\.js\?v=installed-pwa-launch-v294-campus-recovery/,'generated worker must cache-bust the installed launch recovery layer');
assert.match(workerBuilder,/service-worker-installed-launch-v282\.js\?v=installed-pwa-launch-v294-campus-recovery/,'worker generator must preserve the v294 installed launch cache bust');
assert.match(workerBuilder,/installedLaunch:'installed-pwa-launch-v294-campus-recovery'/,'worker generator diagnostics must report v294 installed launch');

function makeContext(){
  const puts=[];
  const context={
    console,
    URL,
    URLSearchParams,
    Request,
    Response,
    Headers,
    VERSION:'1.0.95',
    SHELL_CACHE:'civweave-shell-test',
    RUNTIME_CACHE:'civweave-runtime-test',
    stableAppEntry:async()=>new Response('prior'),
    cacheKey:pathname=>new Request(`https://civweave.test${pathname}`),
    responseLooksValid:(response,pathname)=>Boolean(response?.ok&&(!pathname.endsWith('.html')||/text\/html/i.test(response.headers.get('content-type')||''))),
    normalizeStableAppEntryResponse:async response=>new Response(await response.clone().arrayBuffer(),{status:200,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}}),
    findCached:async()=>null,
    fetchFresh:async()=>{throw new Error('offline')},
    caches:{open:async name=>({put:async(request,response)=>{puts.push({name,url:request.url,status:response.status})}})},
    self:{location:{origin:'https://civweave.test'}},
    puts
  };
  context.self.self=context.self;
  vm.createContext(context);
  vm.runInContext(installedLaunch,context,{filename:'service-worker-installed-launch-v282.js'});
  return context;
}

{
  const context=makeContext();
  context.findCached=async pathname=>pathname==='/app/installed-entry-v146.html'?new Response('<!doctype html><title>entry</title>',{headers:{'content-type':'text/html'}}):null;
  const response=await context.stableAppEntry(new Request('https://civweave.test/app/installed-entry-v146.html',{headers:{accept:'text/html'}}));
  assert.equal(response.status,200);
  assert.equal(response.headers.get('x-civweave-installed-recovery'),'not-needed');
}

{
  const context=makeContext();
  context.findCached=async pathname=>pathname==='/app/working-campus-v156.html'?new Response('<!doctype html><title>campus</title>',{headers:{'content-type':'text/html'}}):null;
  const response=await context.stableAppEntry(new Request('https://civweave.test/app/installed-entry-v146.html'));
  const text=await response.text();
  assert.equal(response.status,200,'missing installed-entry must recover when Working Campus is available');
  assert.equal(response.headers.get('x-civweave-installed-recovery'),'working-campus');
  assert.match(text,/\/app\/working-campus-v156\.html\?installed=1(?:&amp;|&)version=1\.0\.95/);
  assert.match(text,/installed-entry-recovery-v294/);
}

{
  const context=makeContext();
  const response=await context.stableAppEntry(new Request('https://civweave.test/app/installed-entry-v146.html'));
  assert.equal(response.status,503,'503 is reserved for loss of both the installed entry and the actual campus');
  assert.match(await response.text(),/local launch entry and Working Campus are unavailable/i);
}

console.log(JSON.stringify({
  ok:true,
  revision:'reload-settings-recovery-v294',
  assertions:{
    localAICompatibility:'v303-test-pulse-mobile-safe-current',
    settingsOpen:'capture-first-management-after-open',
    inferenceGate:'separate-from-settings-management',
    installedReload:'entry-then-working-campus-never-installer',
    workerCacheBust:'installed-pwa-launch-v294-campus-recovery'
  }
},null,2));
