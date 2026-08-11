import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8');
const [orchestrator,fullscreen,store,ui,localRuntime,localOwner,settings,workspace]=await Promise.all([
  'public/app/experience-orchestrator-v232.js',
  'public/app/chat-fullscreen-v295.js',
  'public/app/saved-chat-store-v295.js',
  'public/app/saved-chat-ui-v295.js',
  'public/app/local-chat-runtime-v295.js',
  'public/app/local-chat-owner-v295.js',
  'public/app/settings-parity-v295.js',
  'public/app/guide-workspace-v242.js'
].map(read));
for(const source of [orchestrator,fullscreen,store,ui,localRuntime,localOwner,settings,workspace])new Function(source);

assert.match(orchestrator,/experience-orchestrator-v298-mobile-chat-queue/);
for(const file of ['settings-parity-v295.js','chat-fullscreen-v295.js','saved-chat-store-v295.js','saved-chat-ui-v295.js','local-chat-runtime-v295.js','local-chat-owner-v295.js'])assert.ok(orchestrator.includes(file),`orchestrator lost ${file}`);
assert.match(orchestrator,/const SETTINGS_MODULE=/);
assert.match(orchestrator,/const CHAT_MODULES=/);
assert.match(orchestrator,/function ensureSettingsModule\(/);
assert.match(orchestrator,/function ensureChatModules\(/);
assert.match(orchestrator,/1\.0\.105-chat-fullscreen-v298/);
assert.match(orchestrator,/1\.0\.104-local-chat-runtime-v297/);
assert.match(orchestrator,/1\.0\.105-local-chat-owner-v298/);
assert.match(orchestrator,/v=1\.0\.105-v298/);
assert.match(orchestrator,/globalThis\.addEventListener\('submit',earlyLocalSubmit,true\)/,'local submit preflight must run at window capture before canonical document capture');
assert.doesNotMatch(orchestrator,/document\.addEventListener\('submit'/,'orchestrator must not compete with the canonical document-level chat submit owner');
assert.match(orchestrator,/CivweaveLocalChatOwnerV295\?\.enqueue/);
assert.match(orchestrator,/event\.stopImmediatePropagation\(\)/);
assert.match(orchestrator,/document\.addEventListener\('click',earlySettings,true\)/);
assert.match(orchestrator,/CivweaveSettingsParityV295\?\.open/);
const earlySettings=orchestrator.match(/function earlySettings\(event\)\{([\s\S]*?)\}\n\nglobalThis\.addEventListener/)?.[1]||'';
assert.ok(earlySettings,'earlySettings must remain inspectable');
assert.match(earlySettings,/openSettingsIndependent/);
assert.doesNotMatch(earlySettings,/ensureLaunchModules|ensureChatModules/,'settings click must never wait on chat readiness');
assert.match(orchestrator,/releaseLegacySettingsClick/,'failed settings ownership must release the click to the legacy page handler');
assert.match(workspace,/document\.addEventListener\('submit',onSubmitCapture,true\)/,'guide workspace remains the canonical non-local document submit owner');

assert.match(fullscreen,/1\.0\.105-chat-fullscreen-v298/);
assert.match(fullscreen,/position:fixed!important/);
assert.match(fullscreen,/inset:0 auto auto 0!important/);
assert.match(fullscreen,/transform:none!important/);
assert.match(fullscreen,/display:flex!important/);
assert.match(fullscreen,/flex-direction:column!important/);
assert.match(fullscreen,/height:var\(--cw298-vv-height,100dvh\)!important/);
assert.match(fullscreen,/flex:1 1 auto!important/);
assert.match(fullscreen,/function ensureStructure\(\)/);
assert.match(fullscreen,/structuralComposerRepair:true/);
assert.match(fullscreen,/staleViewportRecovery:true/);
assert.doesNotMatch(fullscreen,/grid-template-rows/,'fullscreen owner must not depend on a brittle child-row count');
assert.doesNotMatch(fullscreen,/offsetTop/,'Android keyboard positioning must not reapply visualViewport.offsetTop');
assert.match(fullscreen,/visualViewport\?\.addEventListener\('resize',settleViewport/);
assert.match(fullscreen,/document\.addEventListener\('focusin'/);
assert.match(fullscreen,/grid-template-columns:minmax\(0,1fr\) auto/);
assert.match(fullscreen,/textarea\{min-width:0!important;width:100%!important;min-height:54px/);

for(const id of ['civweave','living-school','cerbanimo','fellowfare','anarchadia'])assert.ok(store.includes(`'${id}'`),`saved-chat store lost ${id}`);
assert.match(store,/civweave\.guide-saved-chats\.v295/);
assert.match(store,/\.slice\(0,18\)/);
assert.doesNotMatch(store,/SYSTEMS\.forEach\(ensure\)/);
assert.match(ui,/nav\.setAttribute\('aria-label','Saved chats'\)/);
assert.match(ui,/data-cw295-new/);
assert.match(ui,/data-cw295-chat/);

assert.match(localRuntime,/1\.0\.104-local-chat-runtime-v297/);
assert.match(localRuntime,/civweave\.local-ai\.health\.v286/);
assert.match(localRuntime,/maxNewTokens=tps\?Math\.round\(clamp\(tps\*30,48,128\)\):64/);
assert.match(localRuntime,/thinking:false/);
assert.match(localRuntime,/stream:true/);
assert.match(localRuntime,/function idleLimit\(phase\)/);
assert.match(localRuntime,/p==='loading-model'\)return 150000/);
assert.match(localRuntime,/LOCAL_CHAT_STAGE_STALLED/);
assert.match(localRuntime,/Promise\.race\(\[request,watchdog,hardTimeout\]\)/);
assert.match(localRuntime,/runtime\.shutdown/);
assert.match(localRuntime,/progressExtendsColdStart:true/);

for(const name of ['Weaveling','Moss','Kamiya','Rook','Merlin'])assert.ok(localOwner.includes(name),`local owner lost ${name}`);
assert.match(localOwner,/1\.0\.105-local-chat-owner-v298/);
assert.match(localOwner,/queues=new Map\(\)/);
assert.match(localOwner,/running=new Set\(\)/);
assert.match(localOwner,/function enqueue\(system,text,form\)/);
assert.match(localOwner,/queuePending:true/);
assert.match(localOwner,/while\(q\.length\)/);
assert.match(localOwner,/fifoQueue:true/);
assert.match(localOwner,/capturePhase:false/);
assert.doesNotMatch(localOwner,/document\.addEventListener\('submit'/,'local owner must not compete for document submit capture');
assert.doesNotMatch(localOwner,/button\.disabled=true/,'local queue must keep Send available while another turn is running');
assert.match(localOwner,/slice\(-6\)/);
assert.match(localOwner,/function percent\(p\)/);
assert.match(localOwner,/Loading the selected model into memory/);
assert.match(localOwner,/localProgress:p/);
assert.match(localOwner,/worker was reset because that loading stage stopped making progress/i);
assert.match(localOwner,/Civweave stopped the run instead of letting the interface hang/);
assert.match(localOwner,/downloaded-local-direct/);

assert.match(settings,/1\.0\.99-settings-parity-v296/);
assert.match(settings,/data-action="settings"/);
assert.match(settings,/model-settings-controller-v173\.js/);
assert.match(settings,/document-lifecycle-v221\.js/);
assert.match(settings,/ensureLocalAISettingsManagement/);
assert.match(settings,/document\.addEventListener\('click',capture,true\)/);
assert.match(settings,/settingsIndependentOfChat:true/);
assert.match(settings,/inferenceDormantOnOpen:true/);

console.log(JSON.stringify({ok:true,revision:'chat-launch-readiness-v298-fullscreen-queue',features:{fiveChats:true,fullScreenMobile:true,keyboardVisualViewport:true,staleViewportRecovery:true,structuralComposerRepair:true,compactComposer:true,savedChatTabs:true,settingsParity:true,settingsIndependentOfChat:true,downloadedLocalFastPath:true,truthfulLoadProgress:true,stageAwareWatchdog:true,localFifoQueue:true,singleSubmitPreflight:true,boundedLocalRecovery:true}},null,2));
