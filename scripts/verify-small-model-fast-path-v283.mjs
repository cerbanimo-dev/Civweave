import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [policySource,runtimeSource,bridgeSource,bootstrapSource,primarySource,workerSource]=await Promise.all([
  read('public/app/local-ai/small-model-policy-v283.js'),
  read('public/app/local-ai/runtime-v266.js'),
  read('public/app/local-ai/runtime-bridge-v266.js'),
  read('public/app/local-ai/bootstrap-v266.js'),
  read('public/app/local-ai/primary-route-v283.js'),
  read('public/app/local-ai/worker-v266.js')
]);
for(const source of [policySource,runtimeSource,bridgeSource,bootstrapSource,primarySource,workerSource])new Function(source);
const context={globalThis:null,dispatchEvent(){return true},CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail}}};context.globalThis=context;vm.createContext(context);vm.runInContext(policySource,context);
const policy=context.CivweaveLocalSmallModelPolicyV283;assert.ok(policy);
assert.equal(policy.profile({workingContextTokens:4096},{purpose:'interactive'}).initialSlice,256);
assert.equal(policy.profile({workingContextTokens:4096},{purpose:'code-generation'}).initialSlice,384);
assert.equal(policy.profile({workingContextTokens:4096},{purpose:'interactive'}).totalMax,1024);
const extendedStructured=policy.profile({workingContextTokens:4096},{purpose:'civweave-guide-response-v141',responseFormat:'json',config:{maxTokens:1800}});
assert.equal(extendedStructured.extendedStructured,true,'1800-token structured guide requests should enter the extended local budget');
assert.equal(extendedStructured.initialSlice,512,'extended structured requests should not remain on the old 384-token slice');
assert.equal(extendedStructured.continuationSlice,512);
assert.equal(extendedStructured.totalMax,1800,'the planning budget should survive the local small-model policy instead of being silently reduced to 1536');
assert.equal(policy.validateCompletion({completion:{nearTokenLimit:true}},'A sentence.',{}).reason,'token-limit');
assert.equal(policy.validateCompletion({},'{"answer":',{structured:true,jsonValid:false}).reason,'open-structure');
assert.equal(policy.validateCompletion({},'This ends with and',{}).reason,'abrupt-text');
const clippedGuide=JSON.stringify({answer:"Then we'll plan different areas for growing, storing, and",choice:{mode:'Plan',system:'civweave',room:'',nextAction:''},assumptions:[],requiresConsent:false,confidence:.8,questDraft:null});
const eosGuide=JSON.stringify({answer:"Sure, I can help with that! Let's break down the steps to create a community garden: first, choose a location for the garden, plan the structure, select a mix of vegetables and herbs, and then develop a schedule for daily",choice:{mode:'Plan',system:'civweave',room:'',nextAction:''},assumptions:[],requiresConsent:false,confidence:.8,questDraft:null});
const completedGuide=JSON.stringify({answer:"Then we'll plan different areas for growing, storing, and composting. Recruit a small steward team, confirm water access, map beds and paths, choose crops for the season, schedule recurring maintenance, and define a harvest-sharing rule. Start by identifying two candidate sites and checking who controls them.",choice:{mode:'Plan',system:'civweave',room:'',nextAction:'Choose the site.'},assumptions:[],requiresConsent:false,confidence:.8,questDraft:null});
assert.equal(policy.validateCompletion({},clippedGuide,{structured:true,jsonValid:true}).reason,'structured-answer-abrupt','valid JSON with a dangling conjunction must continue');
assert.equal(policy.validateCompletion({},eosGuide,{structured:true,jsonValid:true}).reason,'structured-guide-answer-incomplete','valid guide JSON ending at an unfinished sentence must continue');
assert.equal(policy.validateCompletion({},completedGuide,{structured:true,jsonValid:true}).reason,'complete');
assert.equal(policy.mergeContinuation(clippedGuide,completedGuide),completedGuide,'a corrected structured continuation should replace the clipped JSON object');
assert.equal(policy.mergeContinuation('abcdefghijklmno','klmnopqrstuvwxyz'),'abcdefghijklmnopqrstuvwxyz');
assert.match(policy.continuationPrompt({structured:false}),/Continue exactly where/);
assert.match(policy.continuationPrompt({structured:true}),/complete corrected JSON object/);
assert.match(policy.continuationPrompt({structured:true}),/full plan rather than a preamble or partial list/);
assert.equal(policy.structuredAnswerCompletionValidation,true);
assert.equal(policy.guideAnswerCompletionValidation,true);
assert.equal(policy.extendedStructuredBudget,true);
assert.ok(runtimeSource.includes("VERSION='1.0.115-local-ai-runtime-v302-session-handoff'")&&runtimeSource.includes("LEGACY_VERSION='1.0.87-local-ai-runtime-v287-gemma4-mobile'")&&runtimeSource.includes("REVISION='1.0.88-local-ai-runtime-v283-small-model-fast-path'")&&runtimeSource.includes('promptTokenBudget,temperature:requestOptions.temperature')&&runtimeSource.includes('smallModelFastPath:true')&&runtimeSource.includes('freshWorkerFallback:true')&&runtimeSource.includes('phaseAwareErrors:true')&&runtimeSource.includes('promptBudgetEnforced:true')&&runtimeSource.includes('compatibilityPromptCap:true')&&runtimeSource.includes('adaptiveWasmThreads:true'));
assert.ok(runtimeSource.includes('compatibility?Math.min(512')&&runtimeSource.includes('compatibility?Math.min(48'),'Small-model compatibility lane must bound prompt and output work.');
assert.ok(bridgeSource.includes("REVISION='1.0.88-local-ai-bridge-v283-small-model-fast-path'")&&bridgeSource.includes('continuation-requested')&&bridgeSource.includes('completionFor(run,slice)')&&bridgeSource.includes('LOCAL_CONTINUATION_VALIDATOR')&&bridgeSource.includes('promptTokenBudget:profile.promptTokenBudget'));
const currentBootstrapVersion=/VERSION='1\.0\.\d+-local-ai-bootstrap-v\d+-[^']+'/.test(bootstrapSource);
assert.ok(currentBootstrapVersion&&bootstrapSource.includes("REVISION='1.0.115-local-ai-bootstrap-v302-session-handoff'")&&bootstrapSource.includes("RUNTIME_REVISION='1.0.88-local-ai-runtime-v283-small-model-fast-path'")&&bootstrapSource.includes('/app/local-ai/small-model-policy-v283.js')&&bootstrapSource.includes('/app/local-ai/primary-route-v283.js')&&bootstrapSource.includes('/app/local-ai/runtime-v266.js?v=1.0.121-v307-coherence-reload')&&bootstrapSource.includes("componentCompatibility:'capability-contract-v324'")&&bootstrapSource.includes('mutableComponentCapabilityReadiness:true')&&bootstrapSource.includes('continuationValidation:true')&&bootstrapSource.includes('freshWorkerFallback:true')&&bootstrapSource.includes('boundedStartup:true')&&bootstrapSource.includes('coherenceReload:true')&&bootstrapSource.includes('packageRevisionGuard:true')&&bootstrapSource.includes('smoothFitRuntime:true'));
assert.ok(bootstrapSource.includes('/app/browser-tool-v1.js')&&bootstrapSource.includes('/app/local-ai/browser-agent-v1.js')&&bootstrapSource.includes('delegatedBrowserTools:true')&&bootstrapSource.includes('offlineArchiveSearch:true'),'Current bootstrap must preserve delegated browser tools alongside the local small-model runtime.');
assert.ok(!bootstrapSource.includes("CivweaveLocalModelRuntimeV266?.version==='1.0.86-local-ai-runtime-v286-wasm-performance'"),'Bootstrap regressed to an exact implementation-version pin.');
assert.ok(primarySource.includes("ROUTE='downloaded-local'")&&primarySource.includes('Embedded local AI (downloaded model)')&&primarySource.includes('capability fallback'));
assert.ok(workerSource.includes('wasm.numThreads=wasmThreads')&&workerSource.includes('wasm.simd=true')&&workerSource.includes('use_cache:true')&&workerSource.includes('benchmarkTokensPerSecond')&&workerSource.includes("message.type==='prewarm'"));
console.log(JSON.stringify({ok:true,revision:'small-model-fast-path-v324-guide-completion',features:{embeddedLocalPrimary:true,adaptiveOutputSlices:true,extendedStructuredBudget:true,clippingValidation:true,structuredAnswerCompletionValidation:true,guideAnswerCompletionValidation:true,boundedContinuation:true,streamedContinuation:true,thinkingProfilesPreserved:true,wasmPerformancePreserved:true,adaptiveWasmThreads:true,compatibilityPromptCap:true,intentPrewarm:true,stalledWebGPUFallback:true,webgpuSessionQuarantine:true,freshWorkerFallback:true,promptBudgetEnforced:true,boundedStartup:true,coherenceReload:true,packageRevisionGuard:true,delegatedBrowserTools:true,componentCompatibility:'capability-contract-v324'}},null,2));
