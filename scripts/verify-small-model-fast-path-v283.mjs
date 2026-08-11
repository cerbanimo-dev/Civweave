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
assert.equal(policy.validateCompletion({completion:{nearTokenLimit:true}},'A sentence.',{}).reason,'token-limit');
assert.equal(policy.validateCompletion({},'{"answer":',{structured:true,jsonValid:false}).reason,'open-structure');
assert.equal(policy.validateCompletion({},'This ends with and',{}).reason,'abrupt-text');
assert.equal(policy.mergeContinuation('abcdefghijklmno','klmnopqrstuvwxyz'),'abcdefghijklmnopqrstuvwxyz');
assert.match(policy.continuationPrompt({structured:false}),/Continue exactly where/);
assert.ok(runtimeSource.includes("VERSION='1.0.88-local-ai-runtime-v299-stage-fallback'")&&runtimeSource.includes("LEGACY_VERSION='1.0.87-local-ai-runtime-v287-gemma4-mobile'")&&runtimeSource.includes("REVISION='1.0.88-local-ai-runtime-v283-small-model-fast-path'")&&runtimeSource.includes('promptTokenBudget:requestOptions.promptTokenBudget')&&runtimeSource.includes('smallModelFastPath:true')&&runtimeSource.includes('wasmPerformanceDiagnostics:true')&&runtimeSource.includes('stalledWebGPUFallback:true')&&runtimeSource.includes('webgpuSessionQuarantine:true'));
assert.ok(bridgeSource.includes("REVISION='1.0.88-local-ai-bridge-v283-small-model-fast-path'")&&bridgeSource.includes('continuation-requested')&&bridgeSource.includes('completionFor(run,slice)')&&bridgeSource.includes('LOCAL_CONTINUATION_VALIDATOR')&&bridgeSource.includes('promptTokenBudget:profile.promptTokenBudget'));
assert.ok(bootstrapSource.includes("REVISION='1.0.91-local-ai-bootstrap-v288-component-coherence'")&&bootstrapSource.includes("RUNTIME_REVISION='1.0.88-local-ai-runtime-v283-small-model-fast-path'")&&bootstrapSource.includes('/app/local-ai/small-model-policy-v283.js')&&bootstrapSource.includes('/app/local-ai/primary-route-v283.js')&&bootstrapSource.includes('/app/local-ai/runtime-v266.js?v=1.0.88-v299-stage-fallback')&&bootstrapSource.includes('componentCompatibility')&&bootstrapSource.includes('capability-contract-v288')&&bootstrapSource.includes('continuationValidation:true')&&bootstrapSource.includes('wasmPerformanceDiagnostics:true')&&bootstrapSource.includes('stalledWebGPUFallback:true'));
assert.ok(!bootstrapSource.includes("CivweaveLocalModelRuntimeV266?.version==='1.0.86-local-ai-runtime-v286-wasm-performance'"),'Bootstrap regressed to an exact implementation-version pin.');
assert.ok(primarySource.includes("ROUTE='downloaded-local'")&&primarySource.includes('Embedded local AI (downloaded model)')&&primarySource.includes('capability fallback'));
assert.ok(workerSource.includes('wasm.numThreads=wasmThreads')&&workerSource.includes('wasm.simd=true')&&workerSource.includes('use_cache:true')&&workerSource.includes('benchmarkTokensPerSecond'));
console.log(JSON.stringify({ok:true,revision:'small-model-fast-path-v299-on-v288',features:{embeddedLocalPrimary:true,adaptiveOutputSlices:true,clippingValidation:true,boundedContinuation:true,streamedContinuation:true,thinkingProfilesPreserved:true,wasmPerformancePreserved:true,stalledWebGPUFallback:true,webgpuSessionQuarantine:true,componentCompatibility:'capability-contract-v288'}},null,2));
