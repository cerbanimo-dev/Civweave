import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8');
const [orchestrator,fullscreen,store,ui,localRuntime,localOwner,settings]=await Promise.all([
  'public/app/experience-orchestrator-v232.js',
  'public/app/chat-fullscreen-v295.js',
  'public/app/saved-chat-store-v295.js',
  'public/app/saved-chat-ui-v295.js',
  'public/app/local-chat-runtime-v295.js',
  'public/app/local-chat-owner-v295.js',
  'public/app/settings-parity-v295.js'
].map(read));
for(const source of [orchestrator,fullscreen,store,ui,localRuntime,localOwner,settings])new Function(source);

assert.match(orchestrator,/experience-orchestrator-v297-mobile-local-loading/);
for(const file of ['settings-parity-v295.js','chat-fullscreen-v295.js','saved-chat-store-v295.js','saved-chat-ui-v295.js','local-chat-runtime-v295.js','local-chat-owner-v295.js'])assert.ok(orchestrator.includes(file),`orchestrator lost ${file}`);
assert.match(orchestrator,/const SETTINGS_MODULE=/);
assert.match(orchestrator,/const CHAT_MODULES=/);
assert.match(orchestrator,/function ensureSettingsModule\(/);
assert.match(orchestrator,/function ensureChatModules\(/);
assert.match(orchestrator,/1\.0\.104-chat-fullscreen-v297/);
assert.match(orchestrator,/1\.0\.104-local-chat-runtime-v297/);
assert.match(orchestrator,/1\.0\.104-local-chat-owner-v297/);
assert.match(orchestrator,/v=1\.0\.104-v297/);
assert.match(orchestrator,/document\.addEventListener\('submit',earlySubmit,true\)/);
assert.match(orchestrator,/document\.addEventListener\('click',earlySettings,true\)/);
assert.match(orchestrator,/stopImmediatePropagation/);
assert.match(orchestrator,/CivweaveLocalChatOwnerV295\?\.submit/);
assert.match(orchestrator,/CivweaveSettingsParityV295\?\.open/);
const earlySettings=orchestrator.match(/function earlySettings\(event\)\{([\s\S]*?)\}\n\ndocument\.addEventListener/)?.[1]||'';
assert.ok(earlySettings,'earlySettings must remain inspectable');
assert.match(earlySettings,/openSettingsIndependent/);
assert.doesNotMatch(earlySettings,/ensureLaunchModules|ensureChatModules/,'settings click must never wait on chat readiness');
assert.match(orchestrator,/releaseLegacySettingsClick/,'failed settings ownership must release the click to the legacy page handler');

assert.match(fullscreen,/1\.0\.104-chat-fullscreen-v297/);
assert.match(fullscreen,/top:0!important/);
assert.match(fullscreen,/height:var\(--cw297-vv-height,100dvh\)!important/);
assert.doesNotMatch(fullscreen,/offsetTop/,'Android keyboard positioning must not reapply visualViewport.offsetTop');
assert.match(fullscreen,/visualViewport\?\.addEventListener\('resize',settleViewport/);
assert.match(fullscreen,/document\.addEventListener\('focusin'/);
assert.match(fullscreen,/grid-template-columns:minmax\(0,1fr\) auto/);
assert.match(fullscreen,/textarea\{min-width:0!important;min-height:54px/);

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
assert.match(localOwner,/1\.0\.104-local-chat-owner-v297/);
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

console.log(JSON.stringify({ok:true,revision:'chat-launch-readiness-v297-mobile-local-loading',features:{fiveChats:true,fullScreenMobile:true,keyboardVisualViewport:true,androidKeyboardOffsetFix:true,compactComposer:true,savedChatTabs:true,settingsParity:true,settingsIndependentOfChat:true,downloadedLocalFastPath:true,truthfulLoadProgress:true,stageAwareWatchdog:true,boundedLocalRecovery:true}},null,2));
