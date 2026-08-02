import { open, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const modelPath='public/app/models/smollm2-360m-instruct/onnx/model_q4f16.onnx';
const [manifestText,adapter,modelWorker,fallback,settings,serviceWorker,packageText,stager,attributes,workflow,gitignore,configText]=await Promise.all([
  read('public/app/models/smollm2-360m-instruct/model-manifest.json'),
  read('public/app/models/smollm2-360m-instruct/adapter.js'),
  read('public/app/models/smollm2-360m-instruct/worker.js'),
  read('public/app/smollm2-fallback-runtime-v134.js'),
  read('public/app/model-settings-v133.js'),
  read('public/service-worker.js'),
  read('package.json'),
  read('scripts/stage-transformers-assets.mjs'),
  read('.gitattributes'),
  read('.github/workflows/verify-v126.yml'),
  read('.gitignore'),
  read('public/app/models/smollm2-360m-instruct/config.json')
]);
const manifest=JSON.parse(manifestText);
const pkg=JSON.parse(packageText);
const config=JSON.parse(configText);

assert(manifest.id==='HuggingFaceTB/SmolLM2-360M-Instruct','wrong onboard model id');
assert(manifest.localId==='smollm2-360m-instruct','wrong local model directory id');
assert(Number(manifest.parameterCount)===360_000_000,'SmolLM2 parameter count is not 360M');
assert(Number(manifest.parameterCount)<=500_000_000,'onboard model exceeds the 500M ceiling');
assert(manifest.remoteDownloadsAllowed===false,'model manifest permits remote downloads');
assert(manifest.graph.endsWith('/onnx/model_q4f16.onnx'),'manifest does not point to the q4f16 graph');
assert(manifest.fallbackPolicy?.neverClaimToolExecution===true,'fallback policy may claim tool execution');
assert(manifest.fallbackPolicy?.requireUncertaintyWhenEvidenceIsMissing===true,'fallback policy does not require uncertainty');
assert(config.architectures?.includes('LlamaForCausalLM'),'SmolLM2 config is not a supported causal LM');

const modelStat=await stat(path.join(root,modelPath));
assert(modelStat.size>100,'model file or LFS pointer is empty');
const handle=await open(path.join(root,modelPath),'r');
const preview=Buffer.alloc(Math.min(256,modelStat.size));
await handle.read(preview,0,preview.length,0);
await handle.close();
const head=preview.toString('utf8');
const lfsPointer=head.startsWith('version https://git-lfs.github.com/spec/v1');
if(lfsPointer){
  assert(head.includes('oid sha256:cc63370efc2aca6d5307518b85162777132cc5b8d68eeb8154ea9b5fce09ad46'),'unexpected SmolLM2 LFS object id');
  assert(head.includes('size 272737275'),'unexpected SmolLM2 LFS object size');
}else{
  assert(modelStat.size>250_000_000&&modelStat.size<300_000_000,'materialized SmolLM2 graph has an unexpected size');
}
assert(attributes.includes('smollm2-360m-instruct/onnx/*.onnx filter=lfs'),'SmolLM2 ONNX graph is not tracked by Git LFS');

for(const required of ["new Worker(WORKER_URL, { type: 'module'",'benchmark(cases','SMOLLM2_TIMEOUT','remoteDownloadsAllowed: false'])assert(adapter.includes(required),`adapter is missing ${required}`);
for(const required of ["import { pipeline, env }",'env.allowRemoteModels = false','env.allowLocalModels = true','env.localModelPath = MODEL_ROOT',"dtype: 'q4f16'",'local_files_only: true',"device = navigator.gpu ? 'webgpu' : 'wasm'"])assert(modelWorker.includes(required),`worker is missing ${required}`);

for(const required of ['fallbackExpectation','degraded-mode local fallback','smallest useful answer','Never claim network access','Never invent current facts','Preserve the user’s agency','delete clean.deterministic','delete clean.fallback','request?.signal?.aborted','bundled-smollm2'])assert(fallback.includes(required),`fallback runtime is missing ${required}`);
assert(fallback.includes("if(isBundled(incoming.config))return generateLocal(incoming,{mode:'primary'})"),'SmolLM2 cannot act as the selected primary onboard model');
assert(fallback.includes("return await generateLocal(clean,{mode:'fallback'"),'failed provider calls do not reach SmolLM2');

for(const required of ['Onboard SmolLM2 360M','Run five-prompt trial','Fallback expectation','SmolLM2 remains the onboard fallback','benchmarkCases','routeCorrect','jsonValid'])assert(settings.includes(required),`settings are missing ${required}`);
assert(!settings.includes('Bundled FunctionGemma'),'FunctionGemma is still shown in settings');

assert(pkg.dependencies?.['@huggingface/transformers']==='3.8.1','Transformers.js is not pinned to 3.8.1');
assert(pkg.scripts?.postinstall==='node scripts/stage-transformers-assets.mjs','Transformers.js is not staged after install');
for(const required of ['@huggingface','transformers','dist','transformers.min.js','wasm','stage-manifest.json'])assert(stager.includes(required),`staging script is missing ${required}`);
assert(gitignore.includes('public/app/vendor/transformers/'),'generated Transformers.js assets are not ignored');

assert(serviceWorker.includes("CACHE_REVISION='smollm2-onboard-r6'"),'service worker cache revision is stale');
for(const required of ['smollm2-fallback-runtime-v134.js','smollm2-360m-instruct/model-manifest.json','smollm2-360m-instruct/adapter.js','smollm2-360m-instruct/worker.js','vendor/transformers/transformers.min.js'])assert(serviceWorker.includes(required),`service worker is missing ${required}`);
assert(!/CORE=\[[\s\S]*model_q4f16\.onnx/.test(serviceWorker),'service worker eagerly downloads the 273 MB graph on every install');
assert(serviceWorker.includes("if(url.pathname.startsWith(MODEL_PREFIX))"),'service worker lacks on-demand model caching');

assert(workflow.includes('lfs: false'),'lightweight CI unexpectedly downloads the LFS graph');
assert(workflow.includes('npm install --no-audit --no-fund'),'CI does not stage Transformers.js');
assert(workflow.includes('smollm2-manifest.json'),'CI does not inspect the model contract');

console.log(JSON.stringify({
  ok:true,
  model:manifest.id,
  parameters:manifest.parameterCount,
  graph:lfsPointer?'git-lfs-pointer':'materialized-onnx',
  graphBytes:lfsPointer?272737275:modelStat.size,
  runtime:'@huggingface/transformers@3.8.1',
  execution:'module-worker-webgpu-or-wasm',
  selectedPrimary:true,
  universalFallback:true,
  fallbackExcludesUserCancellation:true,
  benchmarkPrompts:5,
  eagerModelDownload:false
},null,2));
