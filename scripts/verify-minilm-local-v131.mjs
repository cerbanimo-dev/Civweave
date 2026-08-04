import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
async function digest(relative){const hash=createHash('sha256');for await(const chunk of createReadStream(path.join(root,relative)))hash.update(chunk);return hash.digest('hex')}
const [pkgText,manifestText,adapter,worker,sw,aiLoader,realm,living,fellowfare,anarchadia,ensureModel]=await Promise.all([read('package.json'),read('public/app/models/all-minilm-l6-v2/model-manifest.json'),read('public/app/models/all-minilm-l6-v2/adapter.js'),read('public/app/models/all-minilm-l6-v2/worker.js'),read('public/service-worker.js'),read('public/app/family-ai-loader-v105.js'),read('public/app/realm-console-v140.html'),read('public/app/cabinets/living-school/index.html'),read('public/app/fellowfare-cabinet-v144.html'),read('public/app/anarchadia-console-v139.html'),read('scripts/ensure-minilm-model.mjs')]);
const pkg=JSON.parse(pkgText),manifest=JSON.parse(manifestText),cacheRevision=sw.match(/const CACHE_REVISION='([^']+)'/)?.[1]||'',deviceRevision=sw.match(/const DEVICE_REVISION='([^']+)'/)?.[1]||'';
assert(manifest.id==='Xenova/all-MiniLM-L6-v2','wrong semantic model');
assert(manifest.behavior?.tokenGeneration===false,'MiniLM is configured as a token generator');
assert(manifest.behavior?.lexicalFallbackAlwaysAvailable===true,'lexical fallback is not guaranteed');
assert(manifest.behavior?.maximumInteractiveSemanticWaitMs===350,'interactive semantic wait exceeds contract');
assert(pkg.scripts?.['prestart:local']?.includes('ensure-minilm-model.mjs'),'local setup does not materialize MiniLM when explicitly requested');
assert(!pkg.scripts?.prestart?.includes('ensure-minilm-model.mjs'),'public gateway npm prestart directly materializes MiniLM');
assert(ensureModel.includes('verifyHashes=checkOnly')&&ensureModel.includes("'(fast size check)'"),'normal model readiness still hashes both ONNX graphs');
assert(ensureModel.includes('if(spec.sha&&verifyHashes')&&ensureModel.includes('if(spec.sha&&(await hash(temp))!==spec.sha'),'release checks and downloads no longer verify model integrity');
for(const token of ["pipeline('feature-extraction'","['wasm','q8']","['webgpu','q4f16']",'verifyWasm','fromDevicePackage','caches.match'])assert(worker.includes(token),`MiniLM worker missing ${token}`);
for(const token of ['BODY_PROBE_LIMIT=2_000_000','caches.match',"source:'installed-device-package'",'probe:\'cache-storage\''])assert(adapter.includes(token),`MiniLM adapter missing ${token}`);
assert(cacheRevision==='instant-shell-r37','service worker is not on the instant-shell cache policy');
assert(deviceRevision==='progressive-device-r37','service worker is not on the progressive device policy');
for(const token of ['MODEL_FILES','model_q4f16.onnx','model_quantized.onnx','ort-wasm-simd-threaded.jsep.wasm','async function cacheFirst'])assert(sw.includes(token),`progressive model worker missing ${token}`);
const coreMatch=sw.match(/const CORE=(\[[\s\S]*?\]);\nconst DEVICE_REQUIRED=/),requiredMatch=sw.match(/const DEVICE_REQUIRED=(\[[\s\S]*?\]);\nasync function cacheRequired/);
assert(coreMatch&&requiredMatch,'fast shell manifest could not be parsed');
const required=Function(`"use strict";const CORE=${coreMatch[1]};return ${requiredMatch[1]};`)();
assert(!required.some(asset=>asset.endsWith('.onnx')||asset.includes('/vendor/transformers/')),'MiniLM binaries still block initial installation or updates');
assert(sw.includes("url.pathname.startsWith(MODEL_GRAPH_PREFIX)")&&sw.includes('event.respondWith(cacheFirst(request))'),'Model assets are not cached on first use');
for(const token of ['/app/minilm-reflex-runtime-v138.js','async function ensure()','for(const [src,ready] of SCRIPTS)'])assert(aiLoader.includes(token),`lazy AI loader does not defer MiniLM through ${token}`);
for(const [name,html] of [['realm',realm],['living-school',living],['fellowfare',fellowfare],['anarchadia',anarchadia]])assert(!html.includes('/app/minilm-reflex-runtime-v138.js'),`${name} eagerly executes MiniLM during page startup`);
const wasm=await readFile(path.join(root,'public/app/vendor/transformers/wasm/ort-wasm-simd-threaded.jsep.wasm'));
assert(wasm.length>1_000_000&&wasm[0]===0&&wasm[1]===97&&wasm[2]===115&&wasm[3]===109,'ONNX WASM runtime is invalid');
for(const [relative,size,sha] of [
  ['public/app/models/all-minilm-l6-v2/onnx/model_q4f16.onnx',30018257,'eb08a666c46109637e0b6cb04f6052a68efd59bb0252d4e0438d28fb6b2d853d'],
  ['public/app/models/all-minilm-l6-v2/onnx/model_quantized.onnx',22972370,'afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1']
]){const info=await stat(path.join(root,relative));assert(info.size===size,`${relative} size is ${info.size}, expected ${size}`);assert(await digest(relative)===sha,`${relative} hash mismatch`)}
console.log(JSON.stringify({ok:true,model:manifest.id,renderMaterialization:false,localMaterialization:'explicit',graphs:'lazy cache-first',pageStartup:'model dormant until chat or settings',lexicalFallback:true,cacheRevision,deviceRevision},null,2));
