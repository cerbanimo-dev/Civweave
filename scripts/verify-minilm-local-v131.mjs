import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
async function digest(relative){const hash=createHash('sha256');for await(const chunk of createReadStream(path.join(root,relative)))hash.update(chunk);return hash.digest('hex')}
const [pkgText,manifestText,adapter,worker,sw,aiLoader,realm,living,fellowfare,anarchadia,downloadRuntime]=await Promise.all([
  read('package.json'),read('public/app/models/all-minilm-l6-v2/model-manifest.json'),read('public/app/models/all-minilm-l6-v2/adapter.js'),read('public/app/models/all-minilm-l6-v2/worker.js'),read('public/service-worker.js'),read('public/app/family-ai-loader-v105.js'),read('public/app/realm-console-v140.html'),read('public/app/cabinets/living-school/index.html'),read('public/app/fellowfare-cabinet-v144.html'),read('public/app/anarchadia-console-v139.html'),read('public/extensions/commonweave-model-download-v157.js')
]);
const pkg=JSON.parse(pkgText),manifest=JSON.parse(manifestText),cacheRevision=sw.match(/const CACHE_REVISION='([^']+)'/)?.[1]||'',deviceRevision=sw.match(/const DEVICE_REVISION='([^']+)'/)?.[1]||'',deviceRequired=sw.match(/const DEVICE_REQUIRED=([^;]+);/)?.[1]||'';
assert(manifest.id==='Xenova/all-MiniLM-L6-v2','wrong semantic model');
assert(manifest.behavior?.tokenGeneration===false,'MiniLM is configured as a token generator');
assert(manifest.behavior?.lexicalFallbackAlwaysAvailable===true,'lexical fallback is not guaranteed');
assert(manifest.behavior?.maximumInteractiveSemanticWaitMs===350,'interactive semantic wait exceeds contract');
assert(pkg.scripts?.['prestart:local']?.includes('ensure-minilm-model.mjs'),'local setup does not materialize MiniLM for a local node');
for(const token of ["pipeline('feature-extraction'","['wasm','q8']","['webgpu','q4f16']",'verifyWasm','fromDevicePackage','caches.match'])assert(worker.includes(token),`MiniLM worker missing ${token}`);
assert(!worker.includes("cache:'reload'")&&!worker.includes("headers:{range:"),'MiniLM worker still probes remote model hosts during ordinary use');
for(const token of ['BODY_PROBE_LIMIT=2_000_000','MODEL_CACHE','fetchAndCache','export async function install','sameOriginDownloadsOnly:true','remoteModelHostsAllowed:false','MINILM_NOT_DOWNLOADED'])assert(adapter.includes(token),`MiniLM adapter missing ${token}`);
assert(!adapter.includes('huggingface.co')&&!adapter.includes('cdn.jsdelivr'),'Installed MiniLM adapter can reach a third-party model host');
assert(/^(?:cabinet-mode|fullscreen-family|direct-family)-r\d+(?:-[a-z0-9-]+)?$/i.test(cacheRevision),'service worker is not on a versioned direct family cache policy');
assert(/^device-package-r\d+(?:-[a-z0-9-]+)?$/i.test(deviceRevision),'service worker is not on the device-package policy');
for(const token of ['MODEL_FILES','MODEL_CACHE','modelOnDemand','GET_MODEL_PACKAGE_STATUS','modelDeferred:true',"'x-commonweave-package':'install'"])assert(sw.includes(token),`device worker missing deferred model contract ${token}`);
assert(deviceRequired.includes('...CORE'),'core device package no longer derives from the application core');
for(const heavy of ['model_q4f16.onnx','model_quantized.onnx','transformers.min.js','ort-wasm-simd-threaded.jsep.wasm'])assert(!deviceRequired.includes(heavy),`core installer still blocks on ${heavy}`);
for(const token of ['data-download-local-model','adapter.install','Downloading','commonweave:model-package-ready'])assert(downloadRuntime.includes(token),`explicit model downloader missing ${token}`);
for(const token of ['/app/minilm-reflex-runtime-v138.js','async function ensure()','for(const [src,ready] of SCRIPTS)'])assert(aiLoader.includes(token),`lazy AI loader does not defer MiniLM through ${token}`);
for(const [name,html] of [['realm',realm],['living-school',living],['fellowfare',fellowfare],['anarchadia',anarchadia]])assert(!html.includes('/app/minilm-reflex-runtime-v138.js'),`${name} eagerly executes MiniLM during page startup`);
const wasm=await readFile(path.join(root,'public/app/vendor/transformers/wasm/ort-wasm-simd-threaded.jsep.wasm'));
assert(wasm.length>1_000_000,`ONNX WASM runtime is only ${wasm.length} bytes`);
assert(wasm[0]===0&&wasm[1]===97&&wasm[2]===115&&wasm[3]===109,'ONNX WASM runtime has invalid magic bytes');
for(const [relative,size,sha] of [
  ['public/app/models/all-minilm-l6-v2/onnx/model_q4f16.onnx',30018257,'eb08a666c46109637e0b6cb04f6052a68efd59bb0252d4e0438d28fb6b2d853d'],
  ['public/app/models/all-minilm-l6-v2/onnx/model_quantized.onnx',22972370,'afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1']
]){const info=await stat(path.join(root,relative));assert(info.size===size,`${relative} size is ${info.size}, expected ${size}`);assert(await digest(relative)===sha,`${relative} hash mismatch`)}
console.log(JSON.stringify({ok:true,model:manifest.id,serverMaterialization:true,coreInstallBlocksOnModel:false,modelDelivery:'explicit same-origin download into separate cache',pageStartup:'model dormant until requested',ordinaryRuntimeTraffic:'cache-only after explicit download',lexicalFallback:true,cacheRevision,deviceRevision},null,2));