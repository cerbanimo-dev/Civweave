import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(path.join(root,file),'utf8');
const chat=await read('public/app/persistent-guide-chat-v214.js');
const boundary=await read('public/app/install-boundary-v146.js');

new Function(chat);
new Function(boundary);

for(const token of [
  "const STORAGE_KEY='commonweave.persistent-guide-chat.v214'",
  "const SYSTEMS=['commonweave','living-school','cerbanimo','fellowfare','anarchadia']",
  "activeGuide=state.lastSystem===currentSystem",
  "activeGuide=currentSystem",
  'data-guide-id',
  'aria-pressed',
  "root.dataset.guide=activeGuide",
  '[data-guide="commonweave"]',
  '[data-guide="living-school"]',
  '[data-guide="cerbanimo"]',
  '[data-guide="fellowfare"]',
  '[data-guide="anarchadia"]',
  'event.stopImmediatePropagation()',
  "form.matches(LEGACY_FORM_SELECTOR)",
  "assistant.respond({text,systemId:guideAtSend,history})",
  'One thread, five guides.',
])assert(chat.includes(token),`Persistent chat is missing ${token}`);

assert.equal((chat.match(/assistant\.respond\(/g)||[]).length,1,'Persistent chat must own exactly one assistant submission pipeline.');
for(const retiredKey of [
  'commonweave.guide-chat.cerbanimo.v128',
  'commonweave.guide-chat.anarchadia.v128',
  'commonweave.guide-chat.living-school.v128',
  'commonweave.guide-chat.fellowfare.v128',
])assert(!chat.includes(retiredKey),`Persistent chat reintroduced realm history key ${retiredKey}`);

for(const token of [
  "const PERSISTENT_GUIDE_CHAT_SCRIPT='/app/persistent-guide-chat-v214.js'",
  'addScript(PERSISTENT_GUIDE_CHAT_SCRIPT)',
  "persistentGuideChatRevision:PERSISTENT_GUIDE_CHAT_REVISION",
  'persistentGuideChatSubmissionPipelines:1',
  'persistentGuideChatThemedSwitching:true',
])assert(boundary.includes(token),`Install boundary is missing ${token}`);

const surfaces=[
  'public/app/working-campus-v156.html',
  'public/app/realm-console-v140.html',
  'public/app/fellowfare-cabinet-v144.html',
  'public/app/anarchadia-console-v139.html',
  'public/app/cabinets/living-school/index.html',
];
for(const file of surfaces){
  const html=await read(file);
  assert(html.includes('/app/install-boundary-v146.js'),`${file} does not load the shared persistent chat boundary.`);
}

console.log(JSON.stringify({
  ok:true,
  revision:'v214-one-thread-five-guides',
  sharedHistory:true,
  singleSubmissionPipeline:true,
  currentRealmPriority:true,
  guideSwitcherCount:5,
  themedGuideStates:5,
  legacyFormsRetired:true,
  surfaces:surfaces.length,
},null,2));
