import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8');
const [orchestrator,fullscreen,store,ui,localRuntime,localOwner,settings,workspace,runtime266,bootstrap]=await Promise.all([
  'public/app/experience-orchestrator-v232.js',
  'public/app/chat-fullscreen-v295.js',
  'public/app/saved-chat-store-v295.js',
  'public/app/saved-chat-ui-v295.js',
  'public/app/local-chat-runtime-v295.js',
  'public/app/local-chat-owner-v295.js',
  'public/app/settings-parity-v295.js',
  'public/app/guide-workspace-v242.js',
  'public/app/local-ai/runtime-v266.js',
  'public/app/local-ai/bootstrap-v266.js'
].map(read));
for(const source of [orchestrator,fullscreen,store,ui,localRuntime,localOwner,settings,workspace,runtime266,bootstrap])new Function(source);

assert.match(orchestrator,/experience-orchestrator-v299-chat-boot-runtime-fallback/);
for(const file of ['settings-parity-v295.js','chat-fullscreen-v295.js','saved-chat-store-v295.js','saved-chat-ui-v295.js','local-chat-runtime-v295.js','local-chat-owner-v295.js'])assert.ok(orchestrator.includes(file),`orchestrator lost ${file}`);
assert.match(orchestrator,/1\.0\.106-chat-fullscreen-v299/);
assert.match(orchestrator,/1\.0\.105-local-chat-runtime-v299/);
assert.match(orchestrator,/1\.0\.105-local-chat-owner-v298/);
assert.match(orchestrator,/v=1\.0\.106-v299/);
assert.match(orchestrator,/globalThis\.addEventListener\('submit',earlyLocalSubmit,true\)/,'local submit preflight must run at window capture before canonical document capture');
assert.doesNotMatch(orchestrator,/document\.addEventListener\('submit'/,'orchestrator must not compete with canonical document submit ownership');
assert.match(orchestrator,/CivweaveLocalChatOwnerV295\?\.enqueue/);
assert.match(orchestrator,/CivweaveChatFullscreenV295\?\.settleViewport/);
assert.match(orchestrator,/runtimeOwnedWebGPUFallback:true/);
assert.match(workspace,/document\.addEventListener\('submit',onSubmitCapture,true\)/,'guide workspace remains the canonical non-local document submit owner');

assert.match(fullscreen,/1\.0\.106-chat-fullscreen-v299/);
assert.match(fullscreen,/function enforceFullScreen\(/);
assert.match(fullscreen,/setProperty\(prop,value,'important'\)/,'fullscreen owner must win late workspace CSS with inline important properties');
assert.match(fullscreen,/restingHeight/,'fullscreen owner must remember the resting viewport across stale Android keyboard metrics');
assert.match(fullscreen,/civweave:guide-workspace-state/,'workspace open state must retrigger fullscreen enforcement');
assert.match(fullscreen,/pageshow/);
assert.match(fullscreen,/visibilitychange/);
assert.match(fullscreen,/orientationchange/);
assert.match(fullscreen,/height','var\(--cw299-vv-height,100dvh\)'/);
assert.match(fullscreen,/display','flex'/);
assert.match(fullscreen,/structuralComposerRepair:true/);
assert.match(fullscreen,/inlineImportantEnforcement:true/);
assert.doesNotMatch(fullscreen,/offsetTop/,'Android keyboard positioning must not reapply visualViewport.offsetTop');
assert.match(fullscreen,/grid-template-columns:minmax\(0,1fr\) auto/);

for(const id of ['civweave','living-school','cerbanimo','fellowfare','anarchadia'])assert.ok(store.includes(`'${id}'`),`saved-chat store lost ${id}`);
assert.match(store,/civweave\.guide-saved-chats\.v295/);
assert.match(ui,/data-cw295-new/);
assert.match(ui,/data-cw295-chat/);

assert.match(localRuntime,/1\.0\.105-local-chat-runtime-v299/);
assert.match(localRuntime,/bootstrap-v266\.js\?v=1\.0\.92-v299-chat-runtime/);
assert.match(localRuntime,/p==='loading-model'\)return 240000/,'outer chat watchdog must give the runtime-owned fallback time to execute');
assert.match(localRuntime,/runtimeFallbackOwned/);
assert.match(localRuntime,/runtimeOwnedWebGPUFallback:true/);
assert.match(localRuntime,/Promise\.race\(\[request,watchdog,hardTimeout\]\)/);

assert.match(runtime266,/1\.0\.88-local-ai-runtime-v299-stage-fallback/);
assert.match(runtime266,/function stageIdleMs\(/);
assert.match(runtime266,/spec\?\.device==='webgpu'\?75000:210000/,'WebGPU model construction must have a bounded no-progress timeout distinct from WASM');
assert.match(runtime266,/LOCAL_WEBGPU_LOAD_STALLED/);
assert.match(runtime266,/function resetWorker\(/,'fallback must start in a fresh worker instead of reusing the stuck global loading promise');
assert.match(runtime266,/markQuarantined/);
assert.match(runtime266,/sessionStorage/,'a stalled WebGPU model must be skipped for the rest of the app session');
assert.match(runtime266,/compatibilitySpec\(selected/);
assert.match(runtime266,/stalledWebGPUFallback:true/);
assert.match(runtime266,/webgpuSessionQuarantine:true/);
assert.match(runtime266,/backend-quarantined/);

assert.match(bootstrap,/REVISION='1\.0\.91-local-ai-bootstrap-v288-component-coherence'/);
assert.match(bootstrap,/runtime-v266\.js\?v=1\.0\.88-v299-stage-fallback/);
assert.match(bootstrap,/stalledWebGPUFallback===true/);
assert.match(bootstrap,/componentCompatibility:'capability-contract-v288'/);

for(const name of ['Weaveling','Moss','Kamiya','Rook','Merlin'])assert.ok(localOwner.includes(name),`local owner lost ${name}`);
assert.match(localOwner,/fifoQueue:true/);
assert.doesNotMatch(localOwner,/button\.disabled=true/,'local queue must keep Send available while another turn is running');
assert.match(localOwner,/Loading the selected model into memory/);

assert.match(settings,/settingsIndependentOfChat:true/);
assert.match(settings,/inferenceDormantOnOpen:true/);

console.log(JSON.stringify({ok:true,revision:'chat-launch-readiness-v299-deterministic-fullscreen-stage-fallback',features:{fiveChats:true,deterministicFullscreenBoot:true,keyboardVisualViewport:true,restingViewportMemory:true,structuralComposerRepair:true,localFifoQueue:true,runtimeOwnedWebGPUFallback:true,freshWorkerFallback:true,webgpuSessionQuarantine:true,wasmCompatibilityFallback:true,settingsIndependentOfChat:true}},null,2));
