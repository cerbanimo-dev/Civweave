import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const [loom,realm,lite,settings,assistant,fallbackRuntime,adapter,hologram,worker,liteOverride,modelWorker,stager]=await Promise.all([
  read('public/app/loom-v128.html'),
  read('public/app/realm-v128.html'),
  read('public/app/lite-v129.html'),
  read('public/app/model-settings-v133.js'),
  read('public/app/assistant-runtime-v133.js'),
  read('public/app/smollm2-fallback-runtime-v134.js'),
  read('public/app/models/smollm2-360m-instruct/adapter.js'),
  read('public/app/weaveling-hologram-v133.css'),
  read('public/service-worker.js'),
  read('public/app/lite-model-settings-v133.js'),
  read('public/app/models/smollm2-360m-instruct/worker.js'),
  read('scripts/stage-transformers-assets.mjs')
]);
const manifest=JSON.parse(await read('public/app/models/smollm2-360m-instruct/model-manifest.json'));

for(const [name,html] of [['loom',loom],['realm',realm]]){
  for(const required of ['commonweave-model-runtime.js','smollm2-fallback-runtime-v134.js','model-settings-v133.js','assistant-runtime-v133.js'])assert(html.includes(required),`${name} is missing ${required}`);
  assert(!html.includes('visual-model-settings-v132.js'),`${name} still loads the superseded Visual model modal`);
  assert(html.indexOf('commonweave-model-runtime.js')<html.indexOf('smollm2-fallback-runtime-v134.js'),`${name} fallback loads before the shared runtime`);
  assert(html.indexOf('smollm2-fallback-runtime-v134.js')<html.indexOf('model-settings-v133.js'),`${name} settings load before the fallback floor`);
  assert(html.indexOf('model-settings-v133.js')<html.indexOf('assistant-runtime-v133.js'),`${name} assistant loads before settings migration`);
}
assert(loom.includes('weaveling-hologram-v133.css?v=heart-r7'),'the Quad does not load the revised hologram styling');
for(const required of ['model-settings-v133.css','model-settings-v133.js','lite-model-settings-v133.js','smollm2-fallback-runtime-v134.js'])assert(lite.includes(required),`Lite is missing ${required}`);
assert(lite.indexOf('model-settings-v131.js')<lite.indexOf('lite-model-settings-v133.js'),'Lite v133 override loads before the older renderer exists');
assert(liteOverride.includes('commonweave.model-setup'),'Lite model setup is not overridden');

assert(settings.includes('<option value="bundled">Onboard SmolLM2 360M</option>'),'onboard SmolLM2 route is missing');
assert(!settings.includes('<option value="deterministic"'),'deterministic route is still user-selectable');
for(const required of ['Gemini API key','https://generativelanguage.googleapis.com/v1beta','antigravity','sessionStorage','saveSessionSecret','detectCapabilities','Run five-prompt trial'])assert(settings.includes(required),`settings are missing ${required}`);
assert(settings.includes("provider:'bundled'"),'bundled route is not persisted as a provider');

assert(manifest.id==='HuggingFaceTB/SmolLM2-360M-Instruct','unexpected bundled model id');
assert(Number(manifest.parameterCount)>0&&Number(manifest.parameterCount)<=500_000_000,'bundled model exceeds the 500M parameter ceiling');
assert(manifest.remoteDownloadsAllowed===false,'bundled model permits remote downloads');
for(const required of ['new Worker','type: \'module\'','transformers-js-worker','benchmark','measuredLength','body-size','ort-wasm-simd-threaded.jsep.mjs','ort-wasm-simd-threaded.jsep.wasm','onnx-runtime-r9'])assert(adapter.includes(required),`local model adapter is missing ${required}`);

for(const required of ['commonweave.structured-context.v1','routingQuestion','routingAnswer','responseContract','CommonweaveModelRuntime','modelRuntime.generate','RESPONSE_SCHEMA','outputJson','onboardFallback'])assert(assistant.includes(required),`assistant runtime is missing ${required}`);
assert(!assistant.includes('request.deterministic'),'assistant runtime still invokes the deterministic provider');
assert(assistant.includes('event.stopImmediatePropagation()'),'assistant does not replace the legacy deterministic submit handler');
for(const required of ['fallbackExpectation','degraded-mode local fallback','delete clean.deterministic','delete clean.fallback','request?.signal?.aborted','AbortError',"error?.code==='CANCELLED'",'bundled-smollm2'])assert(fallbackRuntime.includes(required),`fallback runtime is missing ${required}`);

for(const required of ['.cw127-weaveling::before','.cw127-weaveling::after','clip-path:polygon','mix-blend-mode:screen','cw133BeamPulse','cw133ProjectionHover'])assert(hologram.includes(required),`hologram styling is missing ${required}`);
assert(hologram.includes('top:calc(72% + 100px)'),'Weaveling was not moved down by 100px');
assert(hologram.includes('width:min(16vw,136px)'),'Weaveling was not doubled from the previous scale');
assert(hologram.includes('height:min(18vh,164px)'),'Weaveling height was not doubled');
assert(/\.cw127-weaveling\{[^}]*animation:none/.test(hologram),'the physical projector still floats');
assert(/\.cw127-weaveling img\{[^}]*animation:cw133ProjectionHover/.test(hologram),'the light projection no longer floats independently');

for(const required of ["BACKEND_VERSION = 'onnx-r9'",'BACKEND_MJS','BACKEND_WASM','env.useWasmCache = false','wasmPaths = { mjs: BACKEND_MJS, wasm: BACKEND_WASM }',"attempts = navigator.gpu ? ['webgpu', 'wasm'] : ['wasm']",'verifyBackendResponse','SMOLLM2_BACKEND_UNAVAILABLE'])assert(modelWorker.includes(required),`SmolLM2 worker is missing ${required}`);
for(const required of ['ort-wasm-simd-threaded.jsep.mjs','ort-wasm-simd-threaded.jsep.wasm','backendFiles','loaderCount'])assert(stager.includes(required),`Transformers staging is missing ${required}`);

assert(worker.includes("CACHE_REVISION='smollm2-backend-r9'"),'service worker cache was not rotated for the exact backend URL repair');
for(const required of ['assistant-runtime-v133.js','smollm2-fallback-runtime-v134.js','model-settings-v133.js','weaveling-hologram-v133.css','smollm2-360m-instruct/model-manifest.json','smollm2-360m-instruct/adapter.js','smollm2-360m-instruct/worker.js','wasm/ort-wasm-simd-threaded.jsep.mjs','wasm/ort-wasm-simd-threaded.jsep.wasm','ONNX_BACKEND_PREFIX'])assert(worker.includes(required),`service worker does not include ${required}`);
assert(worker.includes("new Request(request,{cache:'reload'})"),'ONNX backend requests are not forced through revalidation');
assert(worker.includes("const MODEL_PREFIX='/app/models/'"),'service worker has no model asset policy');
assert(!worker.match(/CORE=\[[\s\S]*model_q4f16\.onnx/),'the 273 MB graph is forced into every service-worker install');

console.log(JSON.stringify({
  ok:true,
  bundledModel:manifest.id,
  parameters:manifest.parameterCount,
  deterministicRouteVisible:false,
  selectedProviderGeneration:true,
  structuredContext:'commonweave.structured-context.v1',
  fallbackFloor:'bundled-smollm2',
  cancellationFallsThrough:false,
  packageProbe:'header-or-small-body-size',
  onnxBackend:'absolute-versioned-mjs-wasm-with-webgpu-to-wasm-retry',
  hologram:'double-scale-lowered-100px-stationary-projector',
  cacheRevision:'smollm2-backend-r9'
},null,2));
