import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(path.join(root,file),'utf8');
const [
  chat,boundary,livingIndex,loader,paths,interactions,
  commonweave,cerbanimo,fellowfare,anarchadia
]=await Promise.all([
  read('public/app/persistent-guide-chat-v215.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/cabinets/living-school/index.html'),
  read('public/app/cabinets/living-school/living-school-flat-loader-v213.js'),
  read('public/app/cabinets/living-school/living-school-paths-v213.js'),
  read('public/app/cabinets/living-school/living-school-interactions-v213.js'),
  read('public/app/working-campus-v156.html'),
  read('public/app/realm-console-v140.html'),
  read('public/app/fellowfare-cabinet-v144.html'),
  read('public/app/anarchadia-console-v139.html')
]);

for(const source of [chat,boundary,loader,paths,interactions])new Function(source);

for(const token of [
  "const STORAGE_KEY='commonweave.persistent-guide-chat.v214'",
  "const SYSTEMS=['commonweave','living-school','cerbanimo','fellowfare','anarchadia']",
  "commonweave:'#ebe7dd'",
  "'living-school':'#59cf87'",
  "cerbanimo:'#a66cff'",
  "fellowfare:'#f2a93b'",
  "anarchadia:'#ff4f9a'",
  "addEventListener('commonweave:guide-notification',onNotification)",
  'function notify(system,text,options={})',
  'cwp215-unread',
  'cwp215-launch-count',
  'var(--cw-themed-nav-height,0px)',
  "assistant.respond({text,systemId:guideAtSend,history})",
  'One thread, five guides.',
])assert(chat.includes(token),`Persistent chat v215 is missing ${token}`);

assert.equal((chat.match(/assistant\.respond\(/g)||[]).length,1,'Persistent chat must own exactly one assistant submission pipeline.');
assert(!/#0b1f3a|navy/i.test(chat.match(/const NOTIFICATION_PALETTE=\{[\s\S]*?\};/)?.[0]||''),'Rook notification palette drifted back toward navy.');
assert(chat.includes("fellowfare:'#f2a93b'"),'Rook notifications must be amber.');
for(const retiredKey of [
  'commonweave.guide-chat.cerbanimo.v128',
  'commonweave.guide-chat.anarchadia.v128',
  'commonweave.guide-chat.living-school.v128',
  'commonweave.guide-chat.fellowfare.v128',
])assert(!chat.includes(retiredKey),`Persistent chat reintroduced realm history key ${retiredKey}`);

for(const token of [
  "const PERSISTENT_GUIDE_CHAT_SCRIPT='/app/persistent-guide-chat-v215.js'",
  "const ADDITIONS_VERSION='v215-guide-chat-notifications'",
  'addScript(PERSISTENT_GUIDE_CHAT_SCRIPT)',
  "const PERSISTENT_GUIDE_CHAT_REVISION='v215-one-thread-five-guide-notifications'",
  'persistentGuideChatSubmissionPipelines:1',
  'persistentGuideChatGuideCount:5',
  'persistentGuideChatAboveNavigation:true',
  'persistentGuideChatNotifications:true',
  "rook:'amber'",
])assert(boundary.includes(token),`Install boundary is missing ${token}`);

assert(livingIndex.includes('data-build="living-school-flat-v213-direct-interactions"'),'Living School is not on the v213 direct interaction surface.');
assert(livingIndex.includes('living-school-flat-loader-v213.js'),'Living School does not load the direct interaction stack.');
assert(livingIndex.includes('living-school-interactions-v213.css'),'Living School direct interaction CSS is missing.');
assert(livingIndex.includes('id="actions"')&&livingIndex.includes('aria-hidden="true"')&&livingIndex.includes('tabindex="-1"')&&livingIndex.includes('hidden>☰'),'The unfinished Living School menu remains interactive.');
for(const retired of ['id="moss"','id="compass"','class="ls-moss"','class="ls-compass"'])assert(!livingIndex.includes(retired),`Living School still contains duplicate guide launcher ${retired}.`);
assert(livingIndex.includes('id="action-list"'),'The hidden legacy action-list contract required by the cabinet renderer was removed.');

assert(loader.includes('living-school-paths-v213.js?v=direct-controls-v213'),'Living School loader omits direct path controls.');
assert(loader.includes('living-school-interactions-v213.js?v=direct-surfaces-v213'),'Living School loader omits direct interactions.');
assert(!loader.includes('living-school-curriculum-launch-v212.js'),'Living School still loads the stale v212 room bridge.');
assert(!paths.includes('LivingSchoolCabinetV151?.setRoom')&&!paths.includes('[data-lsw-action'),'Path controls still overlap the workbench or stale room writer.');
assert(paths.includes("'[data-ls160-use],[data-ls160-view],[data-ls160-generate]'"),'Path controller no longer owns exactly the three pathbar controls.');
assert(!interactions.includes('openNative')&&!interactions.includes('.click()')&&!interactions.includes('LivingSchoolCabinetV151?.setRoom'),'Direct interactions still synthesize or route through stale room actions.');
assert.equal((interactions.match(/document\.addEventListener\('click',handleClick,true\)/g)||[]).length,1,'Living School direct interactions must install one canonical click controller.');
assert(interactions.includes('function openLesson()')&&interactions.includes('function openAssessment()'),'Direct lesson or assessment surfaces are missing.');

for(const [name,html] of Object.entries({commonweave,cerbanimo,fellowfare,anarchadia,livingIndex})){
  assert(html.includes('/app/install-boundary-v146.js'),`${name} does not load the shared guide boundary.`);
}

console.log(JSON.stringify({
  ok:true,
  revision:'v215-one-thread-five-guide-notifications',
  sharedHistoryKey:'commonweave.persistent-guide-chat.v214',
  assistantSubmissionPipelines:1,
  guideCount:5,
  notificationPalettes:{weaveling:'pearl-silver',moss:'green',kamiya:'purple',rook:'amber',merlin:'pink'},
  chatAboveFiveSystemNavigation:true,
  livingSchool:{directController:true,duplicateGuideButtons:false,unfinishedMenuInteractive:false,staleRoomBridge:false},
},null,2));