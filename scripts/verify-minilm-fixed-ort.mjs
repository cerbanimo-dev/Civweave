import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const [pkgText,adapter,worker,manifestText,stage,materializer,serviceWorker,downloadRuntime]=await Promise.all([
  read('package.json'),
  read('public/app/models/all-minilm-l6-v2/adapter.js'),
  read('public/app/models/all-minilm-l6-v2/worker.js'),
  read('public/app/models/all-minilm-l6-v2/model-manifest.json'),
  read('scripts/stage-onnxruntime-web-assets.mjs'),
  read('scripts/ensure-minilm-fixed-ort-model.mjs'),
  read('public/service-worker.js'),
  read('public/extensions/commonweave-model-download-v157.js')
]);
const pkg=JSON.parse(pkgText),manifest=JSON.parse(manifestText);
assert(pkg.version==='1.0.6','fixed runtime branch is not aligned with Commonweave 1.0.6');
assert(pkg.dependencies?.['onnxruntime-web']==='1.27.0','onnxruntime-web is not pinned to 1.27.0');
assert(pkg.scripts?.prestart?.includes('stage-onnxruntime-web-assets.mjs'),'normal startup does not stage the fixed runtime');
assert(pkg.scripts?.prestart?.includes('ensure-minilm-fixed-ort-model.mjs'),'normal startup does not materialize the fixed graph');
assert(pkg.scripts?.['build:release']?.startsWith('npm run minilm:fixed-model:pull'),'release build does not materialize the fixed graph first');
assert(pkg.scripts?.check?.includes('verify-v106-settings-layer-v179.mjs'),'fixed runtime package wiring regresses the current settings-layer verifier');
assert(adapter.includes("loaderPolicy:'fixed'")&&adapter.includes("runtime:'onnxruntime-web/wasm'"),'adapter does not report the fixed runtime');
for(const token of ['/app/vendor/onnxruntime/ort.wasm.min.mjs','model_quantized.onnx','FIXED_PROFILE','device-package-r41-fixed-ort-wasm','commonweave-model-1.0.6-minilm-fixed-ort-r1'])assert(adapter.includes(token),`adapter missing ${token}`);
for(const retired of ['transformers.min.js','model_q4f16.onnx','navigator.gpu','selectProfile','includeWebGPU'])assert(!adapter.includes(retired),`adapter still contains model/backend selection: ${retired}`);
for(const token of ["import * as ort from '/app/vendor/onnxruntime/ort.wasm.min.mjs'","InferenceSession.create(modelBytes","executionProviders:['wasm']","ort.env.wasm.numThreads=1","ort.env.wasm.initTimeout=30000","wasmPaths={mjs:RUNTIME_MJS_URL,wasm:RUNTIME_WASM_URL}",'createTokenizer','wordPiece','MAX_TOKENS=128','batchSize:1'])assert(worker.includes(token),`worker missing ${token}`);
for(const retired of ["pipeline('feature-extraction'",'@huggingface/transformers','webgpu','q4f16','stateProfileKey','MINILM_PROFILE_CONFLICT','RUNTIME_ROOT'])assert(!worker.includes(retired),`worker still contains loader/backend negotiation: ${retired}`);
for(const token of ['ort.wasm.min.mjs','ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm'])assert(stage.includes(token),`stage script missing ${token}`);
for(const token of ['model_quantized.onnx','22972370','afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1'])assert(materializer.includes(token),`fixed model materializer missing ${token}`);
for(const retired of ['model_q4f16.onnx','tokenizer.json'])assert(!materializer.includes(retired),`fixed model materializer still downloads ${retired}`);
for(const token of ['MODEL_FILES','MODEL_CACHE','modelOnDemand','GET_MODEL_PACKAGE_STATUS','model_quantized.onnx','ort.wasm.min.mjs',"key!==MODEL_CACHE"] )assert(serviceWorker.includes(token),`service worker missing fixed model delivery contract ${token}`);
assert(serviceWorker.includes("VERSION='1.0.6'")&&serviceWorker.includes("AI_REVISION='deterministic-single-authority-v179'"),'service worker model corridor is not based on current 1.0.6 behavior');
assert(downloadRuntime.includes("VERSION='1.0.6-model-download-v180-fixed-ort'"),'model download UI is not aligned with Commonweave 1.0.6');
assert(manifest.format==='onnxruntime-web-fixed-wasm','manifest does not identify the fixed WASM runtime');
assert(manifest.behavior?.runtimeOwnsModelSelection===false,'manifest still delegates model selection to the runtime');
assert(manifest.behavior?.executionProvider==='wasm','manifest does not pin WASM');
assert(manifest.behavior?.runtimeThreads===1,'manifest does not cap runtime threads');
console.log(JSON.stringify({ok:true,appVersion:pkg.version,runtime:'onnxruntime-web/wasm',version:pkg.dependencies['onnxruntime-web'],graph:'model_quantized.onnx',threads:1,loaderRemoved:true,backendSelectionRemoved:true,cleanBuildMaterializesModel:true,serviceWorkerModelCorridor:true,currentSettingsLayerPreserved:true},null,2));
