import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8');
const [orchestrator,fullscreen,store,ui,localRuntime,localOwner,settings,workspace,runtime266,bootstrap,gateway,repair]=await Promise.all([
  'public/app/experience-orchestrator-v232.js',
  'public/app/chat-fullscreen-v295.js',
  'public/app/saved-chat-store-v295.js',
  'public/app/saved-chat-ui-v295.js',
  'public/app/local-chat-runtime-v295.js',
  'public/app/local-chat-owner-v295.js',
  'public/app/settings-parity-v295.js',
  'public/app/guide-workspace-v242.js',
  'public/app/local-ai/runtime-v266.js',
  'public/app/local-ai/bootstrap-v266.js',
  'public/app/settings-gateway-v317.js',
  'public/service-worker-chat-repair-v245.js'
].map(read));
for(const source of [orchestrator,fullscreen,store,ui,localRuntime,localOwner,settings,workspace,runtime266,bootstrap,gateway])new Function(source);
new Function('self','caches','fetch',repair)({addEventListener(){},CivweaveChatCacheRepairV245:null},{keys:async()=>[]},async()=>({ok:true,clone(){return this}}));

assert.match(orchestrator,/REVISION='experience-orchestrator-v317-settings-neutral'/);
for(const file of ['chat-fullscreen-v295.js','saved-chat-store-v295.js','saved-chat-ui-v295.js','local-chat-runtime-v295.js','local-chat-owner-v295.js'])assert.ok(orchestrator.includes(file),`orchestrator lost ${file}`);
assert.doesNotMatch(orchestrator,/settings-parity-v295\.js/,'chat orchestrator must not preload Settings presentation');
assert.doesNotMatch(orchestrator,/addEventListener\('click'/,'chat orchestrator must not intercept Settings input');
assert.match(orchestrator,/settingsInputOwnership:false/);
assert.match(orchestrator,/settingsOwner:'settings-gateway-v317'/);
assert.match(orchestrator,/settingsLaunchWork:'none'/);
assert.match(gateway,/addEventListener\('click',onClick,true\)/,'Settings gateway must remain the sole delegated input owner');
assert.match(orchestrator,/1\.0\.106-chat-fullscreen-v299/);
assert.match(orchestrator,/1\.0\.117-local-chat-runtime-v305-mobile-bootstrap-recovery/);
assert.match(orchestrator,/v312-runtime-first-bootstrap/);
assert.match(orchestrator,/1\.0\.115-local-chat-owner-v302/);
assert.match(orchestrator,/globalThis\.addEventListener\('submit',earlyLocalSubmit,true\)/);
assert.doesNotMatch(orchestrator,/document\.addEventListener\('submit'/);
assert.match(orchestrator,/CivweaveLocalChatOwnerV295\?\.enqueue/);
assert.match(orchestrator,/CivweaveChatFullscreenV295\?\.settleViewport/);
assert.match(orchestrator,/runtimeOwnedWebGPUFallback:true/);
assert.match(orchestrator,/runtimeFirstBootstrap:true/);
assert.match(orchestrator,/bootstrapAuxiliaryFailureNonFatal:true/);
assert.match(orchestrator,/smoothFitRuntime===true/);
assert.match(orchestrator,/intentPrewarm===true/);
assert.match(orchestrator,/chatOpenPrewarm:true/);
assert.match(workspace,/document\.addEventListener\('submit',onSubmitCapture,true\)/);

assert.match(fullscreen,/1\.0\.106-chat-fullscreen-v299/);
assert.match(fullscreen,/REVISION='mobile-chat-freeze-v347'/);
assert.match(fullscreen,/function enforceFullScreen\(/);
assert.match(fullscreen,/getPropertyValue\(prop\)===value&&node\.style\.getPropertyPriority\(prop\)==='important'/);
assert.match(fullscreen,/setProperty\(prop,value,'important'\)/);
assert.match(fullscreen,/restingHeight/);
assert.match(fullscreen,/civweave:guide-workspace-state/);
assert.match(fullscreen,/pageshow/);
assert.match(fullscreen,/visibilitychange/);
assert.match(fullscreen,/orientationchange/);
assert.match(fullscreen,/height','var\(--cw299-vv-height,100dvh\)'/);
assert.match(fullscreen,/display','flex'/);
assert.match(fullscreen,/structuralComposerRepair:true/);
assert.match(fullscreen,/inlineImportantEnforcement:true/);
assert.match(fullscreen,/mutationLoopGuard:true/);
assert.match(fullscreen,/styleMutationObserverDisabled:true/);
assert.match(fullscreen,/attributeFilter:\['hidden','class'\]/);
assert.doesNotMatch(fullscreen,/attributeFilter:\[[^\]]*'style'/,'fullscreen root observer must not subscribe to its own style writes');
assert.doesNotMatch(fullscreen,/offsetTop/);
assert.match(fullscreen,/grid-template-columns:minmax\(0,1fr\) auto/);
for(const path of ['/app/experience-orchestrator-v232.js','/app/realm-session-integrity-v237.js','/app/guide-workspace-v242.js','/app/chat-fullscreen-v295.js','/app/saved-chat-store-v295.js','/app/saved-chat-ui-v295.js'])assert.ok(repair.includes(`'${path}'`),`repair cache purge lost ${path}`);
assert.match(repair,/REVISION='chat-avatar-visible-v346'/);
assert.match(repair,/FREEZE_REVISION='mobile-chat-freeze-v347'/);
assert.match(repair,/packageHumanBubble:cacheHumanMessageRuntime/);
for(const id of ['civweave','living-school','cerbanimo','fellowfare','anarchadia'])assert.ok(store.includes(`'${id}'`),`saved-chat store lost ${id}`);
assert.match(store,/civweave\.guide-saved-chats\.v295/);
assert.match(ui,/data-cw295-new/);
assert.match(ui,/data-cw295-chat/);

assert.match(localRuntime,/1\.0\.117-local-chat-runtime-v305-mobile-bootstrap-recovery/);
assert.match(localRuntime,/REVISION='v312-runtime-first-bootstrap'/);
assert.match(localRuntime,/bootstrap-v266\.js\?v=1\.0\.124-v312-runtime-first-bootstrap/);
assert.match(localRuntime,/failedBootstrapRecovery:true/);
assert.match(localRuntime,/recovering-bootstrap/);
assert.match(localRuntime,/BOOT_READY_TIMEOUT_MS=45000/);
assert.match(localRuntime,/LOCAL_RUNTIME_BOOT_TIMEOUT/);
assert.match(localRuntime,/singleBootstrapFlight:true/);
assert.match(localRuntime,/startupProgress:true/);
assert.match(localRuntime,/runtimeFirstBootstrap:true/);
assert.match(localRuntime,/bootstrapAuxiliaryFailureNonFatal:true/);
assert.match(localRuntime,/function waitForRuntime\(/);
assert.match(localRuntime,/if\(runtimeReady\(\)\|\|outcome\?\.runtime\)/);
assert.ok(localRuntime.indexOf("onProgress?.({phase:'loading-runtime'")<localRuntime.indexOf('await load(`${BOOT}'));
assert.match(localRuntime,/p==='loading-model'\)return 240000/);
assert.match(localRuntime,/coldStartBenchmarkOptOut:true/);
assert.match(localRuntime,/windowsWebGPUGrace:true/);
assert.match(localRuntime,/runtimeFallbackOwned/);
assert.match(localRuntime,/runtimeOwnedWebGPUFallback:true/);
assert.match(localRuntime,/Promise\.race\(\[request,watchdog,hardTimeout\]\)/);
assert.match(localRuntime,/smoothFitRuntime:true/);
assert.match(localRuntime,/adaptiveResidency:true/);
assert.match(localRuntime,/adaptiveWasmThreads:true/);
assert.match(localRuntime,/intentPrewarm:true/);

assert.match(runtime266,/1\.0\.115-local-ai-runtime-v302-session-handoff/);
assert.match(runtime266,/function stageIdleMs\(/);
assert.match(runtime266,/p==='loading-model'\)return spec\?\.device==='webgpu'\?240000:240000/);
assert.match(runtime266,/LOCAL_WEBGPU_LOAD_STALLED/);
assert.match(runtime266,/function resetWorker\(/);
assert.match(runtime266,/markQuarantined/);
assert.match(runtime266,/sessionStorage/);
assert.match(runtime266,/compatibilitySpec\(selected/);
assert.match(runtime266,/stalledWebGPUFallback:true/);
assert.match(runtime266,/webgpuSessionQuarantine:true/);
assert.match(runtime266,/backend-quarantined/);
assert.match(runtime266,/serializedInference:true/);
assert.match(runtime266,/coldStartBenchmarkOptIn:true/);
assert.match(runtime266,/knownArtifactLengths:true/);
assert.match(runtime266,/freshFallbackWorker/);
assert.doesNotMatch(runtime266,/forceSingleThread:spec\.device==='wasm'/);
assert.match(runtime266,/spec\.device==='wasm'&&\(!globalThis\.crossOriginIsolated\|\|mobileLike\(\)\|\|hardwareConcurrency\(\)<4\)/);
assert.match(runtime266,/compatibility\?Math\.min\(512/);
assert.match(runtime266,/compatibility\?Math\.min\(48/);
assert.match(runtime266,/function prewarm\(/);
assert.match(runtime266,/function residencyMs\(/);
assert.match(runtime266,/\['loading-runtime','checking-backend','loading-tokenizer','loading-model'\]\.includes\(phase\)/);
assert.match(bootstrap,/REVISION='1\.0\.115-local-ai-bootstrap-v302-session-handoff'/);
assert.match(bootstrap,/runtime-v266\.js\?v=1\.0\.121-v307-coherence-reload/);
assert.match(bootstrap,/stalledWebGPUFallback===true/);
assert.match(bootstrap,/componentCompatibility:'capability-contract-v307'/);
assert.match(bootstrap,/did not load within 12 seconds/);
assert.match(bootstrap,/boundedStartup:true/);
assert.match(bootstrap,/smoothFitRuntime:true/);
for(const name of ['Weaveling','Moss','Kamiya','Rook','Merlin'])assert.ok(localOwner.includes(name),`local owner lost ${name}`);
assert.match(localOwner,/fifoQueue:true/);
assert.doesNotMatch(localOwner,/button\.disabled=true/);
assert.match(localOwner,/Loading the selected model into memory/);
assert.match(localOwner,/truthfulExecutionModel:true/);
assert.match(localOwner,/executionModel:failedId/);
assert.match(localOwner,/document\.addEventListener\('focusin',prewarmIntent,true\)/);
assert.match(localOwner,/intentPrewarm:true/);
assert.match(settings,/settingsIndependentOfChat:true/);
assert.match(settings,/inferenceDormantOnOpen:true/);
console.log(JSON.stringify({ok:true,revision:'chat-launch-readiness-v347-mobile-freeze-guard',features:{fiveChats:true,settingsOwner:'settings-gateway-v317',settingsIndependentOfChat:true,deterministicFullscreenBoot:true,localFifoQueue:true,runtimeOwnedWebGPUFallback:true,runtimeFirstBootstrap:true,bootstrapAuxiliaryFailureNonFatal:true,freshWorkerFallback:true,failedBootstrapRecovery:true,truthfulExecutionModel:true,adaptiveWasmCompatibility:true,webgpuSessionQuarantine:true,boundedStartup:true,startupProgress:true,intentPrewarm:true,adaptiveResidency:true,smoothFitRuntime:true,mutationLoopGuard:true,fullChatRepairCoverage:true}},null,2));
