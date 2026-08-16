import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8');
const [orchestrator,fullscreen,mobile,store,ui,localRuntime,localOwner,settings,chatSurface,runtime266,bootstrap,gateway,repair,minilm]=await Promise.all([
  'public/app/experience-orchestrator-v232.js',
  'public/app/chat-fullscreen-v295.js',
  'public/app/mobile-ai-hardening-v302.js',
  'public/app/saved-chat-store-v295.js',
  'public/app/saved-chat-ui-v295.js',
  'public/app/local-chat-runtime-v295.js',
  'public/app/local-chat-owner-v295.js',
  'public/app/settings-parity-v295.js',
  'public/app/guide-chat-surface-v350.js',
  'public/app/local-ai/runtime-v266.js',
  'public/app/local-ai/bootstrap-v266.js',
  'public/app/settings-gateway-v317.js',
  'public/service-worker-chat-repair-v245.js',
  'public/app/minilm-context-router-v344.js'
].map(read));
for(const source of [orchestrator,fullscreen,mobile,store,ui,localRuntime,localOwner,settings,chatSurface,runtime266,bootstrap,gateway,minilm])new Function(source);
new Function('self','caches','fetch',repair)({addEventListener(){},CivweaveChatCacheRepairV245:null},{keys:async()=>[]},async()=>({ok:true,clone(){return this}}));

// One canonical chat owner. Settings and inference stay separate from opening chat.
assert.match(orchestrator,/REVISION='experience-orchestrator-v320-submit-only-generative'/);
for(const file of ['chat-fullscreen-v295.js','saved-chat-store-v295.js','saved-chat-ui-v295.js','local-chat-runtime-v295.js','local-chat-owner-v295.js'])assert.ok(orchestrator.includes(file),`orchestrator lost ${file}`);
assert.doesNotMatch(orchestrator,/settings-parity-v295\.js/,'chat orchestrator must not preload Settings presentation');
assert.doesNotMatch(orchestrator,/addEventListener\('click'/,'chat orchestrator must not intercept Settings input');
assert.match(orchestrator,/settingsInputOwnership:false/);
assert.match(orchestrator,/settingsOwner:'settings-gateway-v317'/);
assert.match(orchestrator,/settingsLaunchWork:'none'/);
assert.match(gateway,/addEventListener\('click',onClick,true\)/,'Settings gateway must remain the sole delegated input owner');
assert.match(orchestrator,/1\.0\.108-chat-fullscreen-v299/);
assert.match(orchestrator,/saved-tabs-grid-v351/);
assert.match(orchestrator,/1\.0\.117-local-chat-runtime-v305-mobile-bootstrap-recovery/);
assert.match(orchestrator,/v312-runtime-first-bootstrap/);
assert.match(orchestrator,/1\.0\.158-local-chat-owner-v303-submit-only/);
assert.match(orchestrator,/globalThis\.addEventListener\('submit',earlyLocalSubmit,true\)/);
assert.doesNotMatch(orchestrator,/document\.addEventListener\('submit'/);
assert.match(orchestrator,/CivweaveLocalChatOwnerV295\?\.enqueue/);
assert.match(orchestrator,/CivweaveChatFullscreenV295\?\.settleViewport/);
assert.match(orchestrator,/generativePrewarm:false/);
assert.match(orchestrator,/generativeStartsOnSubmit:true/);
assert.doesNotMatch(orchestrator,/chatOpenPrewarm:true|intentPrewarm===true/);
assert.match(chatSurface,/presentationOwner:'guide-chat-surface-v350'/);
assert.match(chatSurface,/root\.querySelector\('\[data-persistent-form\]'\)\.addEventListener\('submit'/);
assert.doesNotMatch(chatSurface,/document\.addEventListener\('submit'/,'canonical chat surface must not own document-wide submit capture');

// v351 invariant: opening chat must remain CSS-owned, not become a JS repair workload.
assert.match(fullscreen,/1\.0\.108-chat-fullscreen-v299/);
assert.match(fullscreen,/REVISION='saved-tabs-grid-v351'/);
assert.match(fullscreen,/height:100dvh!important/);
assert.match(fullscreen,/cssOnlyLayout:true/);
assert.match(fullscreen,/mainThreadQuiescent:true/);
assert.match(fullscreen,/domWideObserver:false/);
assert.match(fullscreen,/rootSubtreeObserver:false/);
assert.match(fullscreen,/viewportEventOwnership:false/);
assert.match(fullscreen,/androidKeyboardSettling:false/);
assert.match(fullscreen,/inlineImportantEnforcement:false/);
assert.doesNotMatch(fullscreen,/new\s+MutationObserver/,'chat fullscreen compatibility layer must never install a MutationObserver');
assert.doesNotMatch(fullscreen,/\.observe\s*\(/,'chat fullscreen compatibility layer must never observe the DOM');
assert.doesNotMatch(fullscreen,/visualViewport\?*\.addEventListener|visualViewport.*addEventListener/,'chat fullscreen must not own visualViewport events');
assert.doesNotMatch(fullscreen,/settleTimers|\[0,32,80,150,260,420,700\]/,'chat fullscreen must not schedule settling cascades');
assert.doesNotMatch(fullscreen,/civweave:guide-workspace-state/,'chat state events must not trigger fullscreen repair work');
assert.doesNotMatch(fullscreen,/requestAnimationFrame|queueMicrotask/,'chat fullscreen must not create frame or microtask feedback loops');
assert.doesNotMatch(fullscreen,/style\.setProperty\(/,'chat fullscreen must not continuously enforce inline layout');
assert.match(fullscreen,/grid-template-columns:minmax\(0,1fr\) auto/);

// The boot-time mobile hardener owns static CSS only. It must never feed visualViewport
// measurements back into root styles, because that creates layout/event feedback on Android.
assert.match(mobile,/REVISION='mobile-chat-css-dvh-v349'/);
assert.match(mobile,/height:100dvh!important/);
assert.match(mobile,/mobileFullscreenChat:true/);
assert.match(mobile,/chatLayoutMode:'css-dvh-only'/);
assert.match(mobile,/viewportEventOwnership:false/);
assert.match(mobile,/viewportStyleWrites:false/);
assert.match(mobile,/mainThreadQuiescentOnChatOpen:true/);
assert.doesNotMatch(mobile,/visualViewport\?*\.addEventListener|visualViewport.*addEventListener/,'mobile hardening must not subscribe to visualViewport');
assert.doesNotMatch(mobile,/--cw-mobile-visual-(?:height|width|top|left)/,'mobile hardening must not route viewport events through CSS variables');
assert.doesNotMatch(mobile,/document\.documentElement\.style\.setProperty/,'mobile hardening must not write viewport layout into the root element');
assert.doesNotMatch(mobile,/addEventListener\('resize',syncViewport/,'mobile hardening must not own resize layout work');

for(const path of ['/app/experience-orchestrator-v232.js','/app/realm-session-integrity-v237.js','/app/guide-workspace-v242.js','/app/chat-fullscreen-v295.js','/app/mobile-ai-hardening-v302.js','/app/saved-chat-store-v295.js','/app/saved-chat-ui-v295.js'])assert.ok(repair.includes(`'${path}'`),`repair cache purge lost ${path}`);
assert.match(repair,/REVISION='chat-avatar-visible-v346'/);
assert.match(repair,/FREEZE_REVISION='mobile-chat-main-thread-quiescence-v349'/);
assert.match(repair,/HARDENING_REVISION='mobile-chat-css-dvh-v349'/);
assert.match(repair,/packageHumanBubble:cacheHumanMessageRuntime/);
for(const id of ['civweave','living-school','cerbanimo','fellowfare','anarchadia'])assert.ok(store.includes(`'${id}'`),`saved-chat store lost ${id}`);
assert.match(store,/civweave\.guide-saved-chats\.v295/);
assert.match(ui,/data-cw295-new/);
assert.match(ui,/data-cw295-chat/);

// Local generation still starts only on submit and keeps its bounded recovery path.
assert.match(localRuntime,/1\.0\.117-local-chat-runtime-v305-mobile-bootstrap-recovery/);
assert.match(localRuntime,/REVISION='v312-runtime-first-bootstrap'/);
assert.match(localRuntime,/bootstrap-v266\.js\?v=1\.0\.124-v312-runtime-first-bootstrap/);
assert.match(localRuntime,/failedBootstrapRecovery:true/);
assert.match(localRuntime,/recovering-bootstrap/);
assert.match(localRuntime,/BOOT_READY_TIMEOUT_MS=45000/);
assert.match(localRuntime,/LOCAL_RUNTIME_BOOT_TIMEOUT/);
assert.match(localRuntime,/singleBootstrapFlight:true/);
assert.match(localRuntime,/runtimeFirstBootstrap:true/);
assert.match(localRuntime,/bootstrapAuxiliaryFailureNonFatal:true/);
assert.match(localRuntime,/runtimeOwnedWebGPUFallback:true/);
assert.match(localRuntime,/Promise\.race\(\[request,watchdog,hardTimeout\]\)/);
assert.match(localRuntime,/smoothFitRuntime:true/);
assert.match(localRuntime,/adaptiveResidency:true/);
assert.match(localRuntime,/adaptiveWasmThreads:true/);
assert.match(runtime266,/1\.0\.115-local-ai-runtime-v302-session-handoff/);
assert.match(runtime266,/stalledWebGPUFallback:true/);
assert.match(runtime266,/webgpuSessionQuarantine:true/);
assert.match(runtime266,/serializedInference:true/);
assert.match(runtime266,/function prewarm\(/,'low-level explicit prewarm API may remain for non-UI callers');
assert.match(bootstrap,/REVISION='1\.0\.115-local-ai-bootstrap-v302-session-handoff'/);
assert.match(bootstrap,/boundedStartup:true/);
assert.match(bootstrap,/smoothFitRuntime:true/);
for(const name of ['Weaveling','Moss','Kamiya','Rook','Merlin'])assert.ok(localOwner.includes(name),`local owner lost ${name}`);
assert.match(localOwner,/fifoQueue:true/);
assert.match(localOwner,/generativePrewarmDisabled:true/);
assert.match(localOwner,/generativeStartsOnSubmit:true/);
assert.match(localOwner,/intentPrewarm:false/);
assert.match(localOwner,/chatOpenPrewarm:false/);
assert.match(localOwner,/prewarmTrigger:'none'/);
for(const forbidden of ['beginPrewarm','prewarmIntent','prewarmWorkspace','local-chat-prewarm-progress'])assert.ok(!localOwner.includes(forbidden),`chat owner reintroduced forbidden generative prewarm hook ${forbidden}`);
assert.doesNotMatch(localOwner,/\.prewarm\s*\(/,'chat owner must not call generative prewarm');
assert.doesNotMatch(localOwner,/civweave:guide-workspace-state/,'opening/switching chat must not start generative inference work');
assert.doesNotMatch(localOwner,/addEventListener\('focusin'/,'focusing or typing into chat must not start generative inference work');
assert.match(settings,/settingsIndependentOfChat:true/);
assert.match(settings,/inferenceDormantOnOpen:true/);
for(const forbidden of ['prewarm','bootstrap-v266','local-chat-runtime-v295','CivweaveLocalModelRuntimeV266'])assert.ok(!gateway.includes(forbidden),`Settings gateway reintroduced forbidden generative startup hook ${forbidden}`);

// MiniLM remains independent lightweight semantic infrastructure.
assert.match(minilm,/contextRouter:'Xenova\/all-MiniLM-L6-v2'/);
assert.match(minilm,/function idleWarm\(/);
assert.match(minilm,/idleWarm\(\)/);
assert.match(minilm,/settingsAutostart:false/);
assert.doesNotMatch(minilm,/civweave:guide-workspace-state/,'MiniLM must remain independent of chat-open events');

console.log(JSON.stringify({ok:true,revision:'chat-launch-readiness-v351-selected-local-minilm',features:{fiveChats:true,canonicalChatOwner:'guide-chat-surface-v350',settingsOwner:'settings-gateway-v317',settingsIndependentOfChat:true,cssOnlyMobileFullscreen:true,visualViewportOwnership:false,chatMutationObservers:false,chatSettlingTimers:false,mainThreadQuiescentOnOpen:true,localFifoQueue:true,generativePrewarm:false,generativeStartsOnSubmit:true,minilmIndependent:true,fullChatRepairCoverage:true}},null,2));