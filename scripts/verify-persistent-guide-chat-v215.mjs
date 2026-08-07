import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(path.join(root,file),'utf8');
const [chat,viewport,workspace,boundary,livingIndex,livingRuntime,livingCore,civweave,cerbanimo,fellowfare,anarchadia]=await Promise.all([
  read('public/app/persistent-guide-chat-v215.js'),
  read('public/app/persistent-guide-viewport-v216.js'),
  read('public/app/guide-workspace-v242.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/cabinets/living-school/index.html'),
  read('public/app/cabinets/living-school/living-school-cleanroom-v218.mjs'),
  read('public/app/cabinets/living-school/living-school-cleanroom-core-v218.mjs'),
  read('public/app/working-campus-v156.html'),
  read('public/app/realm-console-v140.html'),
  read('public/app/fellowfare-cabinet-v144.html'),
  read('public/app/anarchadia-console-v139.html')
]);

for(const source of [chat,viewport,workspace,boundary])new Function(source);
for(const token of [
  "const STORAGE_KEY='civweave.persistent-guide-chat.v214'",
  "const SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia']",
  "'living-school':'#59cf87'","cerbanimo:'#a66cff'","fellowfare:'#f2a93b'","anarchadia:'#ff4f9a'",
  "addEventListener('civweave:guide-notification',onNotification)",'function notify(system,text,options={})',
  'var(--cw-themed-nav-height,0px)',"assistant.respond({text,systemId:guideAtSend,history})",
])assert(chat.includes(token),`Retained v215 compatibility chat is missing ${token}`);
assert.equal((chat.match(/assistant\.respond\(/g)||[]).length,1,'Retained v215 compatibility runtime changed its single submission path.');

for(const token of ['globalThis.visualViewport','CivweavePersistentGuideViewportV216','scrollTrap:false','mutationObserver:false','autoScroll:false'])assert(viewport.includes(token),`Persistent viewport is missing safe v242 contract ${token}`);
assert(!viewport.includes('MutationObserver'),'Persistent viewport must not watch the whole document.');
assert(!viewport.includes('scrollIntoView'),'Persistent viewport must not force the page to the chat input.');
assert(!viewport.includes('data-keyboard-open'),'Keyboard-open state must not own document scrolling.');

for(const token of [
  "const SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia']",
  "const STATE_KEY='civweave.guide-workspace.v242'",
  'function switchWindow(system',
  'readThread(activeWindow)',
  'openWindow(pageSystem)',
  'switchGuide:(system,options={})=>switchWindow',
  'handoffSystem:system!==pageSystem?system:undefined',
  'Switching windows never mixes histories'
])assert(workspace.includes(token),`Effective v242 workspace is missing ${token}`);
assert.equal((workspace.match(/assistant\.respond\(/g)||[]).length,1,'Effective v242 workspace must own exactly one selected-window assistant submission path.');
assert(!/document\.(?:body|documentElement)\.style\.overflow/.test(workspace),'Guide workspace must not lock page overflow.');

for(const token of [
  "const PERSISTENT_GUIDE_CHAT_SCRIPT='/app/persistent-guide-chat-v215.js'",
  "const PERSISTENT_GUIDE_VIEWPORT_SCRIPT='/app/persistent-guide-viewport-v216.js'",
  "const GUIDE_WORKSPACE='/app/guide-workspace-v242.js'",
  'persistentGuideChatSubmissionPipelines:1','persistentGuideChatGuideCount:5',
  "persistentGuideChatWindowPolicy:'five-switchable-windows-current-realm-launcher'"
])assert(boundary.includes(token),`Install boundary is missing ${token}`);
assert(boundary.indexOf('REALM_SESSION_INTEGRITY,')<boundary.indexOf('GUIDE_WORKSPACE,'),'Guide workspace must load after realm-local ledger ownership.');

assert(livingIndex.includes('data-living-school-runtime="cleanroom-v218"'),'Living School is not on the clean-room surface.');
assert(livingIndex.includes('living-school-cleanroom-v218.mjs'),'Living School clean-room runtime is missing.');
for(const retired of ['id="moss"','id="compass"','id="room"','data-room','id="actions"','action-list','living-school-flat-loader'])assert(!livingIndex.includes(retired),`Living School still contains retired launcher or navigation token ${retired}.`);
assert.equal((livingRuntime.match(/document\.addEventListener\('click',handleLivingSchoolClick,true\)/g)||[]).length,1,'Living School must install exactly one canonical page controller.');
assert(!/MutationObserver|\.click\s*\(|setRoom|openNative|data-room/.test(livingRuntime),'Living School clean-room runtime contains a retired interaction tripwire.');
assert(livingCore.includes('You are Moss, Living School learning guide'),'Moss no longer owns Living School generation.');
assert(livingCore.includes('never impersonate another Civweave guide'),'Living School guide identity boundary is missing.');

for(const [name,html] of Object.entries({civweave,cerbanimo,fellowfare,anarchadia,livingIndex}))assert(html.includes('/app/install-boundary-v146.js'),`${name} does not load the shared guide boundary.`);
console.log(JSON.stringify({ok:true,revision:'v242-five-window-realm-local-workspace',assistantSubmissionPipelines:1,guideCount:5,scrollTrap:false,windowSwitcher:true,livingSchool:{pageControllers:1,legacyNavigation:false,mossOwnsGeneration:true}},null,2));
