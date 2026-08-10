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

assert.match(orchestrator,/experience-orchestrator-v295-launch-readiness/);
for(const file of ['settings-parity-v295.js','chat-fullscreen-v295.js','saved-chat-store-v295.js','saved-chat-ui-v295.js','local-chat-runtime-v295.js','local-chat-owner-v295.js'])assert.ok(orchestrator.includes(file),`orchestrator lost ${file}`);
assert.match(orchestrator,/document\.addEventListener\('submit',earlySubmit,true\)/);
assert.match(orchestrator,/document\.addEventListener\('click',earlySettings,true\)/);
assert.match(orchestrator,/stopImmediatePropagation/);
assert.match(orchestrator,/CivweaveLocalChatOwnerV295\?\.submit/);
assert.match(orchestrator,/CivweaveSettingsParityV295\?\.open/);

assert.match(fullscreen,/height:var\(--cw295-vv-height,100dvh\)!important/);
assert.match(fullscreen,/globalThis\.visualViewport\?\.addEventListener\('resize',viewport/);
assert.match(fullscreen,/textarea\{min-height:58px/);

for(const id of ['civweave','living-school','cerbanimo','fellowfare','anarchadia'])assert.ok(store.includes(`'${id}'`),`saved-chat store lost ${id}`);
assert.match(store,/civweave\.guide-saved-chats\.v295/);
assert.match(store,/\.slice\(0,18\)/);
assert.doesNotMatch(store,/SYSTEMS\.forEach\(ensure\)/);
assert.match(ui,/nav\.setAttribute\('aria-label','Saved chats'\)/);
assert.match(ui,/data-cw295-new/);
assert.match(ui,/data-cw295-chat/);

assert.match(localRuntime,/civweave\.local-ai\.health\.v286/);
assert.match(localRuntime,/maxNewTokens=tps\?Math\.round\(clamp\(tps\*30,48,128\)\):64/);
assert.match(localRuntime,/thinking:false/);
assert.match(localRuntime,/stream:true/);
assert.match(localRuntime,/Promise\.race\(\[request,timeout\]\)/);
assert.match(localRuntime,/runtime\.shutdown/);

for(const name of ['Weaveling','Moss','Kamiya','Rook','Merlin'])assert.ok(localOwner.includes(name),`local owner lost ${name}`);
assert.match(localOwner,/slice\(-6\)/);
assert.match(localOwner,/Civweave stopped the run instead of letting the interface hang/);
assert.match(localOwner,/downloaded-local-direct/);

assert.match(settings,/data-action="settings"/);
assert.match(settings,/model-settings-controller-v173\.js/);
assert.match(settings,/document-lifecycle-v221\.js/);
assert.match(settings,/ensureLocalAISettingsManagement/);
assert.match(settings,/document\.addEventListener\('click',capture,true\)/);

console.log(JSON.stringify({ok:true,revision:'chat-launch-readiness-v295',features:{fiveChats:true,fullScreenMobile:true,keyboardVisualViewport:true,savedChatTabs:true,settingsParity:true,downloadedLocalFastPath:true,boundedLocalRecovery:true}},null,2));
