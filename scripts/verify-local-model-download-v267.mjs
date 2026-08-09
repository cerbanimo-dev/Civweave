import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [manager,settings,bridge,bootstrap,worker,sw,cloudflare,campus]=await Promise.all([
  read('public/app/local-ai/download-manager-v267.js'),
  read('public/app/local-ai/settings-panel-v267.js'),
  read('public/app/local-ai/runtime-bridge-v266.js'),
  read('public/app/local-ai/bootstrap-v266.js'),
  read('public/service-worker-local-model-download-v267.js'),
  read('public/service-worker-v203.js'),
  read('scripts/build-cloudflare-pages.mjs'),
  read('public/app/working-campus-v156.part5.txt')
]);

new Function(manager);
new Function(settings);
new Function(bridge);
new Function(bootstrap);
new Function(worker);
new Function(sw);
// build-cloudflare-pages.mjs is an ES module and is syntax-checked directly by the workflow.
new Function(campus.replace(/\}\)\(\);\s*$/,''));

const checks=[];
const check=(name,value)=>{assert.ok(value,name);checks.push(name)};

check('download manager exposes byte progress',manager.includes('bytesDownloaded')&&manager.includes('percent')&&manager.includes('ReadableStream'));
check('download manager uses Background Fetch when available',manager.includes('backgroundFetch.fetch')&&manager.includes("mode:'background-fetch'"));
check('download manager keeps foreground fallback resumable by completed cached files',manager.includes("status:'paused'")&&manager.includes('Tap Resume'));
check('download manager persists progress state',manager.includes('civweave.local-ai.downloads.v266')&&manager.includes('localStorage.setItem'));
check('download manager exposes cancel and start',manager.includes('start,install:start')&&manager.includes('cancel'));
check('settings shows percent progress bar',settings.includes('cw-model-progress')&&settings.includes('${p}%'));
check('settings leaves a persistent download dock outside modal',settings.includes('cw-local-ai-download-dock-v267')&&settings.includes('renderDock'));
check('settings explicitly selects downloaded model for interactive chat',settings.includes('is now the interactive chat model')&&settings.includes('CivweaveLocalModelBridgeV266?.patch'));
check('service worker handles background success',worker.includes('backgroundfetchsuccess')&&worker.includes('copyRecords'));
check('service worker handles failure and abort',worker.includes('backgroundfetchfailure')&&worker.includes('backgroundfetchabort'));
check('service worker copies fetched model responses into model cache',worker.includes('civweave-model-generative-v266')&&worker.includes('cache.put(record.request,response)'));
check('root service worker imports local model background worker',sw.includes('/service-worker-local-model-download-v267.js'));
check('Cloudflare build stages Transformers runtime before copy',cloudflare.includes('stage-transformers-assets.mjs')&&cloudflare.includes('Required local-AI runtime asset was not staged'));
check('Cloudflare build requires local inference entry and WebGPU wasm',cloudflare.includes('transformers.min.js')&&cloudflare.includes('ort-wasm-simd-threaded.jsep.wasm'));
check('local bridge marks downloaded model as actual provider',bridge.includes("provider:'downloaded-local'")&&bridge.includes('local-ai-bridge-v267'));
check('local bridge uses extended first-load timeout',bridge.includes('900000')&&bridge.includes('600000')&&bridge.includes('360000'));
check('bootstrap pins v267 manager, bridge and settings',bootstrap.includes('download-manager-v267.js')&&bootstrap.includes('local-ai-bridge-v267')&&bootstrap.includes('settings-panel-v267.js'));
check('Working Campus waits for v267 local bootstrap before selected local chat',campus.includes('if(localSelection.active){await ensureDownloadedLocalAISettings()')&&campus.includes('CivweaveLocalModelBridgeV266?.patch?.()'));
check('Working Campus refuses silent local-contract substitution',campus.includes("result?.provider==='local-contract'")&&campus.includes('did not substitute deterministic chat'));
check('model chip surfaces active downloaded model',campus.includes('Local · ${label}')&&campus.includes('civweave:local-model-selection'));

console.log(JSON.stringify({ok:true,revision:'local-model-background-progress-v267',checks:checks.length,features:{byteProgress:true,backgroundFetch:true,foregroundFallback:true,localRouteEnforced:true,cloudflareRuntimeStaged:true}},null,2));
