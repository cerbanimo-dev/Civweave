#!/usr/bin/env node
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';

const root=resolve(new URL('..',import.meta.url).pathname);
const file=relative=>readFileSync(resolve(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const includes=(text,needle,label)=>assert(text.includes(needle),`${label} is missing ${needle}`);
const before=(text,a,b,label)=>{const ai=text.indexOf(a),bi=text.indexOf(b);assert(ai>=0&&bi>=0&&ai<bi,`${label} must load ${a} before ${b}`)};
function syntax(relative){const result=spawnSync(process.execPath,['--check',resolve(root,relative)],{encoding:'utf8'});assert(result.status===0,`${relative} failed node --check:\n${result.stderr||result.stdout}`)}

const paths=[
  'public/app/local-guide-control-bypass-v1.js',
  'public/app/shared-guide-surface-v236.js',
  'public/app/local-ai/gemma4-litert-fast-extension-v1.js',
  'public/app/local-ai/litert-gemma4-fast-runtime-v1.js',
  'public/app/local-ai/gemma4-inference-repair-v1.js',
  'public/service-worker-local-ai-coherence-v307.js',
  'public/service-worker-v203.js',
  'public/service-worker.js',
  'scripts/stage-litert-lm-web-assets.mjs',
  'scripts/build-cloudflare-pages.mjs'
];
for(const path of paths)syntax(path);

const control=file('public/app/local-guide-control-bypass-v1.js');
includes(control,'1.2.0-local-guide-control-bypass-v1-community-garden-plan','planner control');
includes(control,'communityGardenIntent','planner control');
includes(control,"title:'Create a community garden with friends'",'planner control');
includes(control,"provider:'civweave-platform-planner'",'planner control');
includes(control,'localGenerationSkipped:true','planner control');
includes(control,'planner.persist(built)','planner control');

const sandbox={
  console,
  Date,
  Math,
  Object,
  Array,
  String,
  Number,
  Boolean,
  RegExp,
  JSON,
  Promise,
  setTimeout:()=>0,
  clearTimeout:()=>{},
  setInterval:()=>0,
  clearInterval:()=>{},
  queueMicrotask:()=>{},
  addEventListener:()=>{},
  dispatchEvent:()=>{},
  CustomEvent:class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}}
};
sandbox.globalThis=sandbox;
sandbox.CivweaveIntentionPlanner={
  shouldCreate:({text})=>/garden/i.test(text),
  buildPlan:()=>({id:'plan-test',state:'review',routing:{room:'civweave.quad'},signals:{},assumptions:[],paths:[{id:'a'},{id:'b'},{id:'c'}],governance:{}}),
  persist:plan=>({id:'plan-test',state:'review',plan}),
  format:plan=>`Quest: ${plan.title}`
};
vm.runInNewContext(control,sandbox,{filename:'local-guide-control-bypass-v1.js'});
const planner=sandbox.CivweaveLocalGuideControlBypassV1;
const phrase='I want to make a community garden with my friends';
assert(planner?.communityGardenIntent?.(phrase)===true,'Exact community-garden phrase was not recognized.');
const planned=planner.platformPlan({systemId:'civweave',text:phrase,history:[],context:{}});
assert(planned?.platformPlanning===true&&planned?.localGenerationSkipped===true,'Community-garden request did not bypass local generation.');
assert(planned?.provider==='civweave-platform-planner','Community-garden request did not use the platform planner provider.');
assert(planned?.plan?.communityGardenPlanV1===true,'Community-garden specialization was not applied.');
assert(planned.plan.paths?.length===3,'Community-garden Quest must have three paths.');
assert(/site|soil|season/i.test(planned.plan.paths[0].title+planned.plan.paths[0].purpose),'Learning path is not garden-specific.');
assert(/build|community-garden/i.test(planned.plan.paths[1].title+planned.plan.paths[1].purpose),'Labor path is not garden-specific.');
assert(/land|water|soil|seeds|tools/i.test(planned.plan.paths[2].title+planned.plan.paths[2].purpose),'Materials path is not garden-specific.');
assert(/harvest|maintenance|spending/i.test(JSON.stringify(planned.plan.governance)),'Garden governance does not cover shared maintenance/harvest/spending.');

const loader=file('public/app/shared-guide-surface-v236.js');
for(const [a,b] of [
  ['gemma4-pack-extension-v1.js','gemma4-litert-fast-extension-v1.js'],
  ['gemma4-litert-fast-extension-v1.js','gemma4-inference-repair-v1.js'],
  ['gemma4-inference-repair-v1.js','litert-gemma4-fast-runtime-v1.js'],
  ['litert-gemma4-fast-runtime-v1.js','local-provider-authority-v1.js'],
  ['local-provider-authority-v1.js','intention-planner-v141.js'],
  ['intention-planner-v141.js','local-guide-control-bypass-v1.js'],
  ['local-guide-control-bypass-v1.js','guide-stream-thinking-v249.js']
])before(loader,a,b,'shared guide loader');
includes(loader,'plannerSerializedBeforeControl:true','shared guide loader');
includes(loader,"gemma4LiteRTFastModelId:'gemma4-e2b-it-litert-web'",'shared guide loader');

const extension=file('public/app/local-ai/gemma4-litert-fast-extension-v1.js');
includes(extension,"REVISION='73d35ec36cf24347ab4eec1a46f0aafbb9c3a89d'",'LiteRT model extension');
includes(extension,'ARTIFACT_BYTES=2_008_432_640','LiteRT model extension');
includes(extension,"artifactSha256:'3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5'",'LiteRT model extension');
includes(extension,"RUNTIME_CACHE='civweave-litert-lm-runtime-v1'",'LiteRT model extension');
includes(extension,'primeRuntime','LiteRT model extension');
includes(extension,'Download 2.0 GB fast upgrade','LiteRT model extension');
includes(extension,'Nothing downloads until you choose it','LiteRT model extension');
includes(extension,'transparentAcceleration:true','LiteRT model extension');

const fast=file('public/app/local-ai/litert-gemma4-fast-runtime-v1.js');
includes(fast,"FAST_ID='gemma4-e2b-it-litert-web'",'LiteRT fast runtime');
includes(fast,'mod.Backend.GPU_ARTISAN','LiteRT fast runtime');
includes(fast,'ENGINE_CONTEXT_TOKENS=4096','LiteRT fast runtime');
includes(fast,"runtime:'litert-lm-web-0.14.0'",'LiteRT fast runtime');
includes(fast,'if(pick.id===LEGACY_Q4_ID)return base.generate(args)','LiteRT fast runtime fallback');
assert(!fast.includes('enable_speculative_decoding:true'),'Unsupported native speculative-decoding setting leaked into the web runtime.');
assert(!fast.includes('hint_kernel_batch_size'),'Unsupported native hint-kernel setting leaked into the web runtime.');

const repair=file('public/app/local-ai/gemma4-inference-repair-v1.js');
includes(repair,"transformersRepairScope:'onnx-only'",'Transformers repair');
includes(repair,'!LITERT_RE.test','Transformers repair');

const coherence=file('public/service-worker-local-ai-coherence-v307.js');
includes(coherence,"local-ai-code-v320-litert-gemma4-fast",'local AI service-worker coherence');
includes(coherence,"CW_LITERT_VENDOR_PREFIX = '/app/vendor/litert-lm/'",'local AI service-worker coherence');
includes(coherence,"'/app/local-ai/gemma4-litert-fast-extension-v1.js'",'local AI service-worker coherence');
includes(coherence,"'/app/local-ai/litert-gemma4-fast-runtime-v1.js'",'local AI service-worker coherence');
includes(coherence,"'/app/local-ai/gemma4-inference-repair-v1.js'",'local AI service-worker coherence');
includes(coherence,'liteRtVendorRuntimeEagerInstall: false','local AI service-worker coherence');

const sw203=file('public/service-worker-v203.js');
includes(sw203,'local-ai-code-v320-litert-gemma4-fast','canonical service worker');
const rootSw=file('public/service-worker.js');
includes(rootSw,'root-worker-bridge-v8-litert-gemma4-fast','root service worker bridge');
includes(rootSw,"'/app/local-ai/gemma4-litert-fast-extension-v1.js'",'root service worker bridge');
includes(rootSw,"'/app/local-ai/litert-gemma4-fast-runtime-v1.js'",'root service worker bridge');

const stage=file('scripts/stage-litert-lm-web-assets.mjs');
includes(stage,"CORE_PACKAGE='@litert-lm/core'",'LiteRT stage');
includes(stage,"CORE_VERSION='0.14.0'",'LiteRT stage');
includes(stage,"UTILS_VERSION='2.5.3'",'LiteRT stage');
includes(stage,"SCHEMA='civweave.litert-lm-web-stage.v1'",'LiteRT stage');
includes(stage,'MAX_CLOUDFLARE_ASSET_BYTES=24*1024*1024','LiteRT stage');
includes(stage,'rewriteBareImports','LiteRT stage');

const build=file('scripts/build-cloudflare-pages.mjs');
includes(build,'stage-litert-lm-web-assets.mjs','Cloudflare build');
includes(build,"app/vendor/litert-lm/dist/index.js",'Cloudflare build');
includes(build,"app/vendor/litert-lm/stage-manifest.json",'Cloudflare build');

const manifestPath=resolve(root,'public/app/vendor/litert-lm/stage-manifest.json');
if(existsSync(manifestPath)){
  const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
  assert(manifest.schema==='civweave.litert-lm-web-stage.v1','Staged LiteRT manifest has the wrong schema.');
  assert(manifest.coreVersion==='0.14.0','Staged LiteRT manifest has the wrong core version.');
  assert(Array.isArray(manifest.fileInventory)&&manifest.fileInventory.length>0,'Staged LiteRT manifest has no file inventory.');
  const oversized=manifest.fileInventory.filter(row=>Number(row.bytes)>24*1024*1024);
  assert(oversized.length===0,`Staged LiteRT assets exceed Cloudflare limit: ${JSON.stringify(oversized)}`);
}

console.log('PASS exact community-garden intent is planner-first, Gemma ONNX fallback is isolated, and the explicit LiteRT WebGPU fast lane is offline/cache/build coherent.');
