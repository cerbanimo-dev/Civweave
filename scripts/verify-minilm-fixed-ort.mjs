import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const [pkgText,adapter,worker,manifestText,stage]=await Promise.all([
  read('package.json'),
  read('public/app/models/all-minilm-l6-v2/adapter.js'),
  read('public/app/models/all-minilm-l6-v2/worker.js'),
  read('public/app/models/all-minilm-l6-v2/model-manifest.json'),
  read('scripts/stage-onnxruntime-web-assets.mjs')
]);
const pkg=JSON.parse(pkgText),manifest=JSON.parse(manifestText);
assert(pkg.dependencies?.['onnxruntime-web']==='1.27.0','onnxruntime-web is not pinned to 1.27.0');
assert(pkg.scripts?.prestart?.includes('stage-onnxruntime-web-assets.mjs'),'normal startup does not stage the fixed runtime');
assert(adapter.includes("loaderPolicy:'fixed'")&&adapter.includes("runtime:'onnxruntime-web/wasm'"),'adapter does not report the fixed runtime');
for(const token of ['/app/vendor/onnxruntime/ort.wasm.min.mjs','model_quantized.onnx','FIXED_PROFILE','device-package-r40-fixed-ort-wasm'])assert(adapter.includes(token),`adapter missing ${token}`);
for(const retired of ['transformers.min.js','model_q4f16.onnx','navigator.gpu','selectProfile','includeWebGPU'])assert(!adapter.includes(retired),`adapter still contains model/backend selection: ${retired}`);
for(const token of ["import * as ort from '/app/vendor/onnxruntime/ort.wasm.min.mjs'","InferenceSession.create(modelBytes","executionProviders:['wasm']","ort.env.wasm.numThreads=1",'createTokenizer','wordPiece','MAX_TOKENS=128','batchSize:1'])assert(worker.includes(token),`worker missing ${token}`);
for(const retired of ["pipeline('feature-extraction'",'@huggingface/transformers','webgpu','q4f16','stateProfileKey','MINILM_PROFILE_CONFLICT'])assert(!worker.includes(retired),`worker still contains loader/backend negotiation: ${retired}`);
for(const token of ['ort.wasm.min.mjs','ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm'])assert(stage.includes(token),`stage script missing ${token}`);
assert(manifest.format==='onnxruntime-web-fixed-wasm','manifest does not identify the fixed WASM runtime');
assert(manifest.behavior?.runtimeOwnsModelSelection===false,'manifest still delegates model selection to the runtime');
assert(manifest.behavior?.executionProvider==='wasm','manifest does not pin WASM');
assert(manifest.behavior?.runtimeThreads===1,'manifest does not cap runtime threads');
console.log(JSON.stringify({ok:true,runtime:'onnxruntime-web/wasm',version:pkg.dependencies['onnxruntime-web'],graph:'model_quantized.onnx',threads:1,loaderRemoved:true,backendSelectionRemoved:true},null,2));
