import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
async function digest(relative){const hash=createHash('sha256');for await(const chunk of createReadStream(path.join(root,relative)))hash.update(chunk);return hash.digest('hex')}
const [pkgText,manifestText,adapter,worker,sw]=await Promise.all([read('package.json'),read('public/app/models/all-minilm-l6-v2/model-manifest.json'),read('public/app/models/all-minilm-l6-v2/adapter.js'),read('public/app/models/all-minilm-l6-v2/worker.js'),read('public/service-worker.js')]);
const pkg=JSON.parse(pkgText),manifest=JSON.parse(manifestText),deviceRevision=sw.match(/const DEVICE_REVISION='([^']+)'/)?.[1]||'';
assert(manifest.id==='Xenova/all-MiniLM-L6-v2','wrong semantic model');
assert(manifest.behavior?.tokenGeneration===false,'MiniLM is configured as a token generator');
assert(manifest.behavior?.lexicalFallbackAlwaysAvailable===true,'lexical fallback is not guaranteed');
assert(manifest.behavior?.maximumInteractiveSemanticWaitMs===350,'interactive semantic wait exceeds contract');
assert(pkg.scripts?.['prestart:local']?.includes('ensure-minilm-model.mjs'),'local setup does not materialize MiniLM before device-package installation');
assert(!pkg.scripts?.prestart?.includes('ensure-minilm-model.mjs'),'public gateway startup still materializes MiniLM');
for(const token of ["pipeline('feature-extraction'","['wasm','q8']","['webgpu','q4f16']",'verifyWasm','fromDevicePackage','caches.match'])assert(worker.includes(token),`MiniLM worker missing ${token}`);
assert(!worker.includes("cache:'reload'")&&!worker.includes("headers:{range:"),'MiniLM worker still probes the node during ordinary use');
for(const token of ['BODY_PROBE_LIMIT=2_000_000','caches.match',"source:'installed-device-package'",'probe:\'cache-storage\''])assert(adapter.includes(token),`MiniLM adapter missing ${token}`);
assert(!adapter.includes("cache:'reload'")&&!adapter.includes("method:'HEAD'"),'MiniLM adapter still creates network probes');
assert(sw.includes("CACHE_REVISION='cabinet-mode-r22'"),'service worker is not on the current Cabinet Mode cache policy');
assert(/^device-package-r\d+(?:-[a-z0-9-]+)?$/i.test(deviceRevision),'service worker is not on the device-package policy');
for(const token of ['DEVICE_REQUIRED','model_q4f16.onnx','model_quantized.onnx','ort-wasm-simd-threaded.jsep.wasm','async function deviceOnly'])assert(sw.includes(token),`device package worker missing ${token}`);
assert(!sw.includes('binaryStreamFirst')&&!sw.includes('staleWhileRevalidate'),'model assets still bypass or revalidate beyond the device package');
const wasm=await readFile(path.join(root,'public/app/vendor/transformers/wasm/ort-wasm-simd-threaded.jsep.wasm'));
assert(wasm.length>1_000_000,`ONNX WASM runtime is only ${wasm.length} bytes`);
assert(wasm[0]===0&&wasm[1]===97&&wasm[2]===115&&wasm[3]===109,'ONNX WASM runtime has invalid magic bytes');
for(const [relative,size,sha] of [
  ['public/app/models/all-minilm-l6-v2/onnx/model_q4f16.onnx',30018257,'eb08a666c46109637e0b6cb04f6052a68efd59bb0252d4e0438d28fb6b2d853d'],
  ['public/app/models/all-minilm-l6-v2/onnx/model_quantized.onnx',22972370,'afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1']
]){const info=await stat(path.join(root,relative));assert(info.size===size,`${relative} size is ${info.size}, expected ${size}`);assert(await digest(relative)===sha,`${relative} hash mismatch`)}
console.log(JSON.stringify({ok:true,model:manifest.id,renderMaterialization:false,localMaterialization:true,graphs:'installed during device-package update',ordinaryRuntimeTraffic:'cache-storage only',lexicalFallback:true,cacheRevision:deviceRevision},null,2));
