import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

await import('./verify-release-version-sync.mjs');

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const [pkgText,versionText,adapter,worker,manifestText,stage,materializer,serviceWorker,downloadRuntime,mobileBuilder]=await Promise.all([
  read('package.json'),
  read('VERSION'),
  read('public/app/models/all-minilm-l6-v2/adapter.js'),
  read('public/app/models/all-minilm-l6-v2/worker.js'),
  read('public/app/models/all-minilm-l6-v2/model-manifest.json'),
  read('scripts/stage-onnxruntime-web-assets.mjs'),
  read('scripts/ensure-minilm-fixed-ort-model.mjs'),
  read('public/service-worker.js'),
  read('public/extensions/civweave-model-download-v157.js'),
  read('scripts/build-mobile-install-kit.mjs')
]);
const pkg=JSON.parse(pkgText),manifest=JSON.parse(manifestText),canonicalVersion=versionText.trim();

assert(/^\d+\.\d+\.\d+$/.test(canonicalVersion),'VERSION must contain a semantic release version');
assert(pkg.version===canonicalVersion,`package.json ${pkg.version} is not aligned with canonical Civweave ${canonicalVersion}`);
assert(pkg.dependencies?.['onnxruntime-web']==='1.27.0','onnxruntime-web is not pinned to 1.27.0');
assert(pkg.scripts?.prestart?.includes('stage-onnxruntime-web-assets.mjs'),'normal startup does not stage the fixed runtime');
assert(pkg.scripts?.prestart?.includes('ensure-minilm-fixed-ort-model.mjs'),'normal startup does not materialize the fixed graph');
assert(pkg.scripts?.['build:release']?.startsWith('npm run minilm:fixed-model:pull'),'release build does not materialize the fixed graph first');
const settingsBoundaryCheck=String(pkg.scripts?.check||'');
assert(settingsBoundaryCheck.includes('verify-ai-settings-self-contained-v181.mjs')||settingsBoundaryCheck.includes('verify-ai-settings-freeze-boundary-v180.mjs'),'fixed runtime wiring dropped the settings freeze-boundary test');

for(const token of ["loaderPolicy:'fixed'","runtime:'onnxruntime-web/wasm'",'/app/vendor/onnxruntime/ort.wasm.min.mjs','model_quantized.onnx','FIXED_PROFILE','device-package-r41-fixed-ort-wasm'])assert(adapter.includes(token),`adapter missing ${token}`);
const modelCache=adapter.match(/const MODEL_CACHE='([^']+)'/)?.[1]||'';
assert(/^civweave-model-\d+\.\d+\.\d+-minilm-fixed-ort-r1$/.test(modelCache),'adapter model cache must remain a versioned fixed-ORT package key');
for(const retired of ['transformers.min.js','model_q4f16.onnx','navigator.gpu','selectProfile','includeWebGPU'])assert(!adapter.includes(retired),`adapter still contains model/backend selection: ${retired}`);
assert(adapter.includes("if(!explicit)return{ready:false,dormant:true,reason:'explicit-activation-required'}"),'adapter can start outside explicit semantic-lab activation');

for(const token of [
  "import * as ort from '/app/vendor/onnxruntime/ort.wasm.min.mjs'",
  "InferenceSession.create(MODEL_URL",
  "executionProviders:['wasm']",
  'ort.env.wasm.numThreads=1',
  'ort.env.wasm.initTimeout=30000',
  'wasmPaths={mjs:RUNTIME_MJS_URL,wasm:RUNTIME_WASM_URL}',
  'createTokenizer',
  'wordPiece',
  'MAX_TOKENS=128',
  "const VECTOR_DB='civweave-semantic-cache-v1'",
  'const INDEX_BATCH_SIZE=1',
  'async function ensureIndexVectors(id,state)',
  'yieldMs:16',
  "source:'indexeddb'"
])assert(worker.includes(token),`worker missing ${token}`);
for(const retired of ["pipeline('feature-extraction'",'@huggingface/transformers','webgpu','q4f16','stateProfileKey','MINILM_PROFILE_CONFLICT','RUNTIME_ROOT'])assert(!worker.includes(retired),`worker still contains loader/backend negotiation: ${retired}`);
const prewarmBlock=worker.slice(worker.indexOf("if(message.type==='prewarm')"),worker.indexOf("if(message.type==='match')"));
assert(!prewarmBlock.includes('ensureIndexVectors'),'prewarm still embeds the reflex index');
const loadBlock=worker.slice(worker.indexOf('async function load(id,requestedProfile)'),worker.indexOf('async function ensureIndexVectors'));
assert(!loadBlock.includes('index-embedding'),'session creation still embeds the reflex index');

for(const token of ['ort.wasm.min.mjs','ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm'])assert(stage.includes(token),`stage script missing ${token}`);
for(const token of ['model_quantized.onnx','22972370','afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1'])assert(materializer.includes(token),`fixed model materializer missing ${token}`);
for(const retired of ['model_q4f16.onnx','tokenizer.json'])assert(!materializer.includes(retired),`fixed model materializer still downloads ${retired}`);

for(const token of ['MODEL_FILES','MODEL_CACHE','modelOnDemand','GET_MODEL_PACKAGE_STATUS','model_quantized.onnx','ort.wasm.min.mjs','key!==MODEL_CACHE'])assert(serviceWorker.includes(token),`service worker missing fixed model delivery contract ${token}`);
assert(serviceWorker.includes("'/app/anarchadia-sovereignty-kernel-v146.js'"),'service worker core lost the Anarchadia sovereignty kernel while adding the model corridor');
assert(!serviceWorker.match(/const CORE=\[[\s\S]*model_quantized\.onnx/),'heavy model graph leaked into the core install list');

for(const token of ["settingsHooks:false","automaticStartup:false","civweave:open-semantic-lab",'fixed ONNX Runtime Web WASM'])assert(downloadRuntime.includes(token),`semantic-lab downloader missing ${token}`);
for(const forbidden of ['civweave:open-ai-settings','#settings-button','#model-chip'])assert(!downloadRuntime.includes(forbidden),`model download still hooks the settings lifecycle through ${forbidden}`);

assert(manifest.format==='onnxruntime-web-fixed-wasm','manifest does not identify the fixed WASM runtime');
assert(manifest.behavior?.runtimeOwnsModelSelection===false,'manifest still delegates model selection to the runtime');
assert(manifest.behavior?.executionProvider==='wasm','manifest does not pin WASM');
assert(manifest.behavior?.runtimeThreads===1,'manifest does not cap runtime threads');
assert(manifest.behavior?.prewarmEmbedsReflexIndex===false,'manifest says prewarm embeds the reflex index');
assert(manifest.behavior?.reflexIndexBatchSize===1&&manifest.behavior?.reflexIndexYieldMs===16,'manifest lost lazy index throttling');

assert(mobileBuilder.includes("'/app/models/all-minilm-l6-v2/onnx/'"),'mobile installer no longer rejects ONNX graphs');
assert(mobileBuilder.includes("modelPolicy: 'deferred'"),'mobile installer no longer keeps the model deferred');

console.log(JSON.stringify({
  ok:true,
  appVersion:pkg.version,
  canonicalVersion,
  runtime:'onnxruntime-web/wasm',
  runtimeVersion:pkg.dependencies['onnxruntime-web'],
  graph:'model_quantized.onnx',
  modelCache,
  threads:1,
  loaderRemoved:true,
  backendSelectionRemoved:true,
  semanticActivation:'explicit-lab-only',
  prewarmEmbedsReflexIndex:false,
  reflexVectorCache:'indexeddb-or-precomputed',
  cleanBuildMaterializesModel:true,
  serviceWorkerModelCorridor:true,
  mobileCoreModelPolicy:'deferred',
  settingsFreezeBoundaryPreserved:true
},null,2));
