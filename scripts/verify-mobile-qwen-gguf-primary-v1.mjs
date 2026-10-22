import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';

const read=path=>readFile(path,'utf8');
const [settings,runtime,gguf,build,stage,localCards]=await Promise.all([
  read('public/app/settings-gateway-v317.js'),
  read('public/app/shared/civweave-model-runtime.js'),
  read('public/app/local-ai/browser-gguf-v1.js'),
  read('scripts/build-cloudflare-pages.mjs'),
  read('scripts/stage-wllama-browser-v1.mjs'),
  read('public/app/settings-local-models-direct-v325.js')
]);
new vm.Script(settings,{filename:'settings-gateway-v317.js'});
new vm.Script(runtime,{filename:'civweave-model-runtime.js'});
execFileSync(process.execPath,['--check','public/app/local-ai/gguf-split-browser-v1.js'],{stdio:'inherit'});
execFileSync(process.execPath,['scripts/test-gguf-browser-split-v1.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,['--check','public/app/local-ai/browser-gguf-opfs-v1.js'],{stdio:'inherit'});
execFileSync(process.execPath,['scripts/test-gguf-opfs-import-v1.mjs'],{stdio:'inherit'});
assert.match(settings,/data-embedded-gguf-cancel-import/);
assert.match(settings,/ggufImportAbort\.signal/);
assert.match(settings,/Saving shard/);
assert.match(gguf,/writeGGUFShard\(dir,importId,i,row\.file/);
assert.match(gguf,/readGGUFShards\(record\)/);
const importStart=gguf.indexOf('export async function importFiles('),importEnd=gguf.indexOf('export async function activateImported(',importStart);
assert.ok(importStart>=0&&importEnd>importStart);
assert.doesNotMatch(gguf.slice(importStart,importEnd),/cache\.put\(/,'GGUF import must not stall on a multi-gigabyte Cache.put.');

assert.match(settings,/split oversized GGUF files into tensor-aligned shards automatically/);
assert.match(gguf,/planGGUFSplit\(original/);
assert.match(gguf,/shardFromPlan\(plan,index\)/);
assert.match(gguf,/new File\(\[blob\],splitter\.splitName/);

for(const source of ['public/app/local-ai/browser-gguf-v1.js','scripts/stage-wllama-browser-v1.mjs'])
  execFileSync(process.execPath,['--check',source]);

const keep=settings.indexOf('data-mobile-gguf-panel');
const replaceable=settings.indexOf('data-settings-tab-panel="local-models"');
assert.ok(keep>0&&replaceable>keep,'GGUF controls must stay in persistent AI & safety tab.');
assert.match(settings,/data-embedded-gguf-download/);
assert.match(settings,/data-embedded-gguf-activate/);
assert.match(settings,/name="embeddedGGUFFiles"[^>]*multiple/);
assert.match(settings,/data-embedded-gguf-import/);
assert.match(settings,/gguf\.importFiles\(files/);
assert.match(settings,/gguf\.activateImported\(record\.importId\)/);

assert.match(settings,/gguf\.download\(selected\.url/);
assert.match(settings,/gguf\.activate\(selected\)/);
assert.match(settings,/persist\(\{\.\.\.DEFAULTS,route:'openai-compatible'/);
assert.doesNotMatch(settings,/data-mobile-qwen-connect|checkedPhoneEndpoint|probePhoneGGUF/,'Server-only GGUF UI must be retired.');

assert.match(gguf,/export const GGUF_SELECTION_KEY='civweave\.mobile\.gguf-primary\.v2'/);
assert.match(gguf,/\.modelManager\.downloadModel\(/);
assert.match(gguf,/\.modelManager\.getModels\(/);
assert.match(gguf,/\.validate\(\)==='valid'/);
assert.match(gguf,/\.loadModel\(source,/);
assert.match(gguf,/\.createChatCompletion\(params\)/);
assert.match(gguf,/export async function importFiles\(/);
assert.match(gguf,/export async function activateImported\(/);
assert.match(gguf,/civweave-gguf-file-import-v1/);
assert.match(gguf,/store\.writeGGUFShard\(dir,importId,i,row\.file/);
assert.match(gguf,/current\.loadModel\(source,/);
assert.match(gguf,/selected\.source==='file'/);
assert.match(gguf,/MAX_GGUF_SHARD_BYTES=2_000_000_000/);
assert.match(gguf,/GGUF_SHARDS_MISSING/);

assert.match(gguf,/enable_thinking:false/);
assert.match(gguf,/n_gpu_layers:gpuLayers/);
assert.match(gguf,/n_gpu_layers:[0-9]|create\(0\)/);
assert.match(gguf,/Qwen3\.5-4B-IQ2_M\.gguf/);
assert.match(gguf,/Qwen3\.5-2B-Q4_K_M\.gguf/);
assert.match(gguf,/\.size>24\*1024\*1024|GGUF_NOT_DOWNLOADED/);
assert.doesNotMatch(gguf,/llama-server|\.litertlm|127\.0\.0\.1|chat\/completions/,'Embedded engine must not depend on native server or LiteRT.');

const browserDispatch=runtime.indexOf('const browserGGUF=await import(');
const networkDispatch=runtime.indexOf('const url = openAIChatUrl(config.endpoint, config);',browserDispatch);
assert.ok(browserDispatch>0&&networkDispatch>browserDispatch,'Browser GGUF must intercept before any native HTTP transport.');
assert.match(runtime,/selectedGGUF\.model===config\.model/);
assert.match(runtime,/browserGGUF\.generate\(/);
assert.match(runtime,/emit\(context,'partial'/);
assert.match(runtime,/networkInference:false/);
assert.match(build,/stage-wllama-browser-v1\.mjs/);
assert.match(build,/app\/vendor\/wllama\/esm\/wasm\/wllama\.wasm/);
assert.match(stage,/@wllama\/wllama@3\.8\.1/);
assert.match(stage,/--package-lock=false/);
assert.match(localCards,/RECOMMENDED · GGUF ONLY/);
assert.match(localCards,/data-direct-open-gguf/);
assert.match(localCards,/LEGACY · NON-GGUF/);
assert.doesNotMatch(localCards,/tier:'PHONE FIRST'/);

// Execute the actual file/shard validation helpers with synthetic files.
const validatorStart=gguf.indexOf('function importName(name){');
const validatorEnd=gguf.indexOf('function cachePath(importId,index){',validatorStart);
assert.ok(validatorStart>=0&&validatorEnd>validatorStart);
const validateContext=vm.createContext({});
const validateFunctions=gguf.slice(validatorStart,validatorEnd);
const validator=new vm.Script("const MAX_GGUF_SHARD_BYTES=2_000_000_000;const err=(code,message)=>Object.assign(new Error(message),{code});"+validateFunctions+"\nthis.orderedFiles=orderedFiles;this.modelFromFile=modelFromFile;");
validator.runInContext(validateContext);
const small=(name,index,size=1024)=>({name,size,slice:()=>({arrayBuffer:async()=>new Uint8Array([71,71,85,70]).buffer})});
const valid4b='Qwen3.5-4B-Q4_K_M.gguf';
assert.equal(validateContext.modelFromFile(valid4b).family,'4b');
assert.equal(validateContext.orderedFiles([small(valid4b)]).length,1);
assert.throws(()=>validateContext.orderedFiles([small(valid4b,0,2_000_000_001)]),/2 GB per-file limit/);
assert.throws(()=>validateContext.orderedFiles([small('Qwen3.5-4B-Q4_K_M-00001-of-00002.gguf')]),/Select all 2 shards/);
const reversed=validateContext.orderedFiles([
  small('Qwen3.5-4B-Q4_K_M-00002-of-00002.gguf'),
  small('Qwen3.5-4B-Q4_K_M-00001-of-00002.gguf')
]);
assert.equal(reversed[0].name,'Qwen3.5-4B-Q4_K_M-00001-of-00002.gguf');
assert.throws(()=>validateContext.orderedFiles([
  small('Qwen3.5-4B-Q4_K_M-00001-of-00002.gguf'),
  small('Qwen3.5-2B-Q4_K_M-00002-of-00002.gguf')
]),/same original model basename/);

console.log('Browser-only GGUF contracts: settings, verified cache, native worker runtime, no HTTP inference, and pinned asset stage passed.');
