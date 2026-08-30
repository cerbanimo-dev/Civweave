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
  'public/extensions/civweave-weaveling-plan-json-v190.js',
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
includes(control,'1.4.1-local-guide-control-bypass-v1-ai-quest-lazy-route','Quest route control');
includes(control,"ORCHESTRATOR_VERSION='1.2.0-weaveling-plan-json-v190-ai-quest-intent'",'Quest route control');
includes(control,'__cwWeavelingAIQuestRequiredV1','Quest route control');
includes(control,'likelyQuestIntent','Quest route control');
includes(control,'ensureOrchestrator','Quest route control');
includes(control,'orchestrator.createModelPlan','Quest route control');
includes(control,'aiQuestAuthoringRequired:true','Quest route control');
includes(control,'deterministicQuestCreation:false','Quest route control');
assert(!control.includes('platformPlan('),'Control layer must not author a deterministic platform Quest.');
assert(!control.includes('specializeCommunityGarden'),'Hard-coded community-garden Quest specialization must be retired.');
assert(!control.includes('localGenerationSkipped:true'),'Quest routing must not advertise skipped AI generation.');

const orchestrator=file('public/extensions/civweave-weaveling-plan-json-v190.js');
includes(orchestrator,'1.2.0-weaveling-plan-json-v190-ai-quest-intent','Quest orchestrator');
includes(orchestrator,'localStructuredTransport','Quest orchestrator');
includes(orchestrator,"provider:'downloaded-local'",'Quest orchestrator');
includes(orchestrator,"mode:'model-structured-json'",'Quest orchestrator');
includes(orchestrator,'aiGenerated:true','Quest orchestrator');
includes(orchestrator,'deterministicQuestFallback:false','Quest orchestrator');
includes(orchestrator,'stripGreeting','Quest orchestrator');
includes(orchestrator,'COLLECTIVE_PROJECT_RE','Quest orchestrator');
includes(orchestrator,"Nothing was created or saved",'Quest orchestrator');
includes(orchestrator,"Every title, purpose, step, completion criterion, evidence item, and governance agreement must be specific to this user's request",'Quest customization prompt');
includes(orchestrator,'Your job is to design the user\'s Quest for them.','Quest capability prompt');
assert(!orchestrator.includes('fallback:()=>planner.buildPlan'),'Structured Quest request still carries deterministic planner fallback.');
assert(!orchestrator.includes("provider==='deterministic'?'deterministic-fallback'"),'Quest normalization still permits deterministic authorship.');

const intentSandbox={console,Date,Math,Object,Array,String,Number,Boolean,RegExp,JSON,Promise,globalThis:null};
intentSandbox.globalThis=intentSandbox;
vm.runInNewContext(orchestrator,intentSandbox,{filename:'civweave-weaveling-plan-json-v190.js'});
const intentApi=intentSandbox.CivweaveWeavelingPlanJsonV190;
const gardenPhrase='I want to make a community garden with my friends';
const arcadePhrase='Hello me and my friends create a basement arcade business';
assert(intentApi?.planIntent?.(gardenPhrase,[],{})===true,'Community-garden phrasing is not recognized as Quest intent.');
assert(intentApi?.planIntent?.(arcadePhrase,[],{})===true,'Greeting-prefixed basement-arcade phrasing is not recognized as Quest intent.');
assert(intentApi?.stripGreeting?.(arcadePhrase).startsWith('me and my friends'),'Greeting stripping damaged the actual arcade request.');

let structuredCalls=0,localCalls=0;
const sandbox={
  console,Date,Math,Object,Array,String,Number,Boolean,RegExp,JSON,Promise,
  setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},queueMicrotask:fn=>fn(),
  addEventListener:()=>{},dispatchEvent:()=>{},CustomEvent:class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}}
};
sandbox.globalThis=sandbox;
const localProvider=async()=>{localCalls++;return{provider:'downloaded-local',response:{answer:'ordinary local chat'}}};
localProvider.__civweaveLocalProviderAuthorityV1=true;
localProvider.__civweaveLocalProviderAuthorityVersion='1.0.3-local-provider-authority-v1-inference-core-first';
localProvider.__prior=async()=>({provider:'deterministic-control'});
sandbox.CivweaveAssistantV141={respond:localProvider};
sandbox.CivweaveWeavelingPlanJsonV190={
  version:'1.2.0-weaveling-plan-json-v190-ai-quest-intent',
  planIntent:text=>/community garden|basement arcade/i.test(text),
  createModelPlan:async args=>{structuredCalls++;return{provider:'downloaded-local',model:'gemma4-e2b-it-q4f16',plan:{title:/arcade/i.test(args.text)?'AI basement arcade Quest':'AI community garden Quest'},questAuthoring:{aiGenerated:true}}},
  install:()=>true
};
vm.runInNewContext(control,sandbox,{filename:'local-guide-control-bypass-v1.js'});
const routedGarden=await sandbox.CivweaveAssistantV141.respond({systemId:'civweave',text:gardenPhrase,history:[]});
const routedArcade=await sandbox.CivweaveAssistantV141.respond({systemId:'civweave',text:arcadePhrase,history:[]});
assert(structuredCalls===2,'One or more project phrases did not route into AI structured Quest authoring.');
assert(localCalls===0,'A project phrase fell through to ordinary local chat instead of Quest authoring.');
assert(routedGarden?.questAuthoring?.aiGenerated===true,'Community-garden Quest route did not preserve AI authoring provenance.');
assert(routedArcade?.questAuthoring?.aiGenerated===true,'Basement-arcade Quest route did not preserve AI authoring provenance.');
assert(/basement arcade/i.test(routedArcade?.plan?.title||''),'Basement-arcade request was not handed to the structured authoring route.');

const loader=file('public/app/shared-guide-surface-v236.js');
for(const [a,b] of [
  ['gemma4-pack-extension-v1.js','gemma4-litert-fast-extension-v1.js'],
  ['gemma4-litert-fast-extension-v1.js','gemma4-inference-repair-v1.js'],
  ['gemma4-inference-repair-v1.js','litert-gemma4-fast-runtime-v1.js'],
  ['litert-gemma4-fast-runtime-v1.js','local-provider-authority-v1.js'],
  ['local-provider-authority-v1.js','intention-planner-v141.js'],
  ['intention-planner-v141.js','civweave-weaveling-plan-json-v190.js'],
  ['civweave-weaveling-plan-json-v190.js','local-guide-control-bypass-v1.js'],
  ['local-guide-control-bypass-v1.js','guide-stream-thinking-v249.js']
])before(loader,a,b,'shared guide loader');
includes(loader,'1.2.0-ai-quest-intent','shared guide loader');
includes(loader,'1.4.1-ai-quest-lazy-route','shared guide loader');
includes(loader,'aiQuestAuthoringRequired:true','shared guide loader');
includes(loader,'structuredQuestOrchestratorSerialized:true','shared guide loader');
includes(loader,'questIntentGreetingSafe:true','shared guide loader');
includes(loader,'questOrchestratorRevisionPinned:true','shared guide loader');
includes(loader,"questCustomizationOwner:'selected-ai-model'",'shared guide loader');
includes(loader,'deterministicQuestFallback:false','shared guide loader');
includes(loader,"gemma4LiteRTFastModelId:'gemma4-e2b-it-litert-web'",'shared guide loader');

const extension=file('public/app/local-ai/gemma4-litert-fast-extension-v1.js');
includes(extension,"id:'gemma4-e2b-it-litert-web'",'LiteRT model extension');
includes(extension,"id:'gemma4-e4b-it-litert-web'",'LiteRT model extension');
includes(extension,"revision:'73d35ec36cf24347ab4eec1a46f0aafbb9c3a89d'",'LiteRT E2B model extension');
includes(extension,"revision:'4f479a5ff97de64f5c1711ec439a2cb89e6a8fb4'",'LiteRT E4B model extension');
includes(extension,'artifactBytes:2_008_432_640','LiteRT E2B model extension');
includes(extension,'artifactBytes:2_969_059_328','LiteRT E4B model extension');
includes(extension,"sha256:'3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5'",'LiteRT E2B model extension');
includes(extension,"sha256:'3904d826d5dddd25ea173e85204caec09e68ba038116e9b992b69cbdc94f57a0'",'LiteRT E4B model extension');
includes(extension,"RUNTIME_CACHE='civweave-litert-lm-runtime-v1'",'LiteRT model extension');
includes(extension,'primeRuntime','LiteRT model extension');
includes(extension,'Gemma 4 · 12 GB phone performance profile','LiteRT model extension');
includes(extension,'data-litert-fast-browser-link','LiteRT model extension direct browser download');
includes(extension,'data-litert-fast-import-input','LiteRT model extension browser file import');
includes(extension,'directBrowserUserGesture:true','LiteRT model extension browser gesture contract');
includes(extension,'directFileImport:true','LiteRT model extension browser import contract');
assert(!/<button[^>]+data-litert-fast-pair/.test(extension),'LiteRT phone UI must not render a one-tap multi-file browser download button.');
includes(extension,'transparentAcceleration:true','LiteRT model extension');
includes(extension,'dualModelAcceleration:true','LiteRT model extension');
includes(extension,'oneEngineAtATime:true','LiteRT model extension');

const fast=file('public/app/local-ai/litert-gemma4-fast-runtime-v1.js');
includes(fast,"'gemma4-e2b-it-litert-web'",'LiteRT fast runtime');
includes(fast,"'gemma4-e4b-it-litert-web'",'LiteRT fast runtime');
includes(fast,'mod.Backend.GPU_ARTISAN','LiteRT fast runtime');
includes(fast,'contextTokens:4096','LiteRT fast runtime');
includes(fast,"runtime:'litert-lm-web-0.14.0'",'LiteRT fast runtime');
includes(fast,"'gemma4-e2b-it-q2f16-mobile'",'LiteRT E2B alias');
includes(fast,"'gemma4-e4b-it-q2f16-mobile'",'LiteRT E4B alias');
includes(fast,'return base.generate(args)','LiteRT fast runtime fallback');
includes(fast,'use_submodel:Boolean(useSubmodel)','LiteRT MTP runtime');
includes(fast,'supportsJspi','LiteRT JSPI capability gate');
includes(fast,"capability:'webassembly-jspi'",'LiteRT JSPI capability gate');
includes(fast,'jspiRequired:true','LiteRT JSPI capability gate');
includes(fast,'oneEngineAtATime:true','LiteRT phone memory policy');
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
includes(stage,'litertlm_wasm_asyncify_internal.wasm','LiteRT Pages omission');
includes(stage,'litertlm_wasm_compat_asyncify_internal.wasm','LiteRT Pages omission');
includes(stage,'omitPagesIncompatibleFallbacks','LiteRT Pages omission');
includes(stage,"browserProfile:'chromium-jspi-webgpu'",'LiteRT stage');
includes(stage,'requiresJspi:true','LiteRT stage');

const build=file('scripts/build-cloudflare-pages.mjs');
includes(build,'stage-litert-lm-web-assets.mjs','Cloudflare build');
includes(build,"app/vendor/litert-lm/dist/index.js",'Cloudflare build');
includes(build,"app/vendor/litert-lm/stage-manifest.json",'Cloudflare build');

const manifestPath=resolve(root,'public/app/vendor/litert-lm/stage-manifest.json');
if(existsSync(manifestPath)){
  const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
  assert(manifest.schema==='civweave.litert-lm-web-stage.v1','Staged LiteRT manifest has the wrong schema.');
  assert(manifest.coreVersion==='0.14.0','Staged LiteRT manifest has the wrong core version.');
  assert(manifest.browserProfile==='chromium-jspi-webgpu','Staged LiteRT manifest is not pinned to the Chromium/JSPI WebGPU profile.');
  assert(manifest.requiresJspi===true,'Staged LiteRT manifest must require JSPI.');
  assert(Array.isArray(manifest.omittedFiles)&&manifest.omittedFiles.length===2,'Staged LiteRT manifest must record the two omitted Asyncify fallbacks.');
  assert(Array.isArray(manifest.fileInventory)&&manifest.fileInventory.length>0,'Staged LiteRT manifest has no file inventory.');
  const oversized=manifest.fileInventory.filter(row=>Number(row.bytes)>24*1024*1024);
  assert(oversized.length===0,`Staged LiteRT assets exceed Cloudflare limit: ${JSON.stringify(oversized)}`);
}

console.log('PASS garden and greeting-prefixed basement-arcade intent route to AI structured Quest authoring, deterministic Quest creation is forbidden, and the dual Gemma 4 LiteRT MTP/JSPI fast lane remains offline/cache/build coherent.');
