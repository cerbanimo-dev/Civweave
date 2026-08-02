import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const [pkgText,adapter,worker,serviceWorker,materializer,workflow,hostWrapper]=await Promise.all([
  read('package.json'),
  read('public/app/models/smollm2-360m-instruct/adapter.js'),
  read('public/app/models/smollm2-360m-instruct/worker.js'),
  read('public/service-worker.js'),
  read('scripts/ensure-smollm2-model.mjs'),
  read('.github/workflows/verify-v126.yml'),
  read('server-v130.mjs')
]);
const pkg=JSON.parse(pkgText);

for(const required of [
  "WORKER_URL = `${MODEL_ROOT}/worker.js?v=onnx-runtime-r10`",
  'ort-wasm-simd-threaded.jsep.mjs',
  'ort-wasm-simd-threaded.jsep.wasm',
  'workerUrl: WORKER_URL'
])assert(adapter.includes(required),`adapter missing ${required}`);

for(const required of [
  "BACKEND_VERSION = 'onnx-r10'",
  'BACKEND_MJS = new URL(',
  'BACKEND_WASM = new URL(',
  'env.useWasmCache = false',
  'wasmPaths = { mjs: BACKEND_MJS, wasm: BACKEND_WASM }',
  'verifyBackendResponse(BACKEND_MJS',
  'verifyBackendResponse(BACKEND_WASM',
  "attempts = navigator.gpu ? ['webgpu', 'wasm'] : ['wasm']",
  "^application\\/wasm(?:;|$)"
])assert(worker.includes(required),`worker missing ${required}`);

assert(serviceWorker.includes("CACHE_REVISION='smollm2-route-lock-r12'"),'service worker cache revision is stale');
assert(serviceWorker.includes("const ONNX_BACKEND_PREFIX='/app/vendor/transformers/wasm/'"),'service worker has no ONNX backend route');
assert(serviceWorker.includes("new Request(request,{cache:'reload'})"),'ONNX backend files are not revalidated');
assert(serviceWorker.includes('/app/models/smollm2-360m-instruct/tokenizer.json'),'tokenizer is not part of the offline shell');
assert(hostWrapper.includes("['.wasm','application/wasm']"),'host wrapper does not add the WebAssembly MIME type');
assert(hostWrapper.includes("['.onnx','application/octet-stream']"),'host wrapper does not add the ONNX MIME type');

for(const required of [
  'git', 'lfs', 'pull', 'checkout',
  '272_737_275',
  'cc63370efc2aca6d5307518b85162777132cc5b8d68eeb8154ea9b5fce09ad46',
  'COMMONWEAVE_SKIP_LFS_PULL',
  "process.env.CI === 'true'"
])assert(materializer.includes(required),`materializer missing ${required}`);
assert(pkg.scripts?.postinstall?.includes('ensure-smollm2-model.mjs --soft'),'postinstall does not check/materialize SmolLM2');
assert(pkg.scripts?.prestart?.includes('ensure-smollm2-model.mjs --soft'),'startup does not check/materialize SmolLM2');
assert(pkg.scripts?.['model:pull']==='node scripts/ensure-smollm2-model.mjs','model:pull script missing');
assert(pkg.scripts?.['model:check']==='node scripts/ensure-smollm2-model.mjs --check','model:check script missing');

assert(workflow.includes("CACHE_REVISION='smollm2-route-lock-r12'"),'workflow does not verify the current cache');
assert(workflow.includes('smollm2-small-model-v137.js?v=route-lock-r2'),'workflow does not verify the route-lock contract');
assert(workflow.includes('onnx-r10'),'workflow does not probe versioned backend URLs');
assert(workflow.includes("content-type: application/wasm"),'workflow does not require the streaming WebAssembly MIME type');
assert(workflow.includes('lfs: false'),'lightweight CI should not fetch the 273 MB graph');

console.log(JSON.stringify({
  ok:true,
  backendPaths:'absolute-versioned-mjs-and-wasm',
  wasmMime:'application/wasm',
  streamingCompilation:true,
  internalWasmCache:false,
  serviceWorkerRevision:'smollm2-route-lock-r12',
  routeLockContract:'v137',
  tokenizerOffline:true,
  automaticLfsMaterialization:true,
  lightweightCiPullsLfs:false
},null,2));
