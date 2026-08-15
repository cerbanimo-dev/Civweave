import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const [realm,ownershipText,chat,compat,sharedLoader,sharedCore]=await Promise.all([
  read('public/app/realm-session-integrity-v237.js'),
  read('config/system-ownership.json'),
  read('public/app/guide-chat-surface-v350.js'),
  read('public/app/guide-workspace-v242.js'),
  read('public/app/shared-guide-surface-v236.js'),
  read('public/app/shared-guide-surface-v236-core-v244.js')
]);
const ownership=JSON.parse(ownershipText),shared=`${sharedLoader}\n${sharedCore}`;
for(const source of [realm,chat,compat])new Function(source);
assert.equal(ownership.systems?.['guide-chat']?.owner,'public/app/guide-chat-surface-v350.js','System ownership must point chat controls at V350.');
assert(realm.includes("dataOnly:true"),'Realm session integrity must remain data-only.');
for(const forbidden of ['function mountChat','function onTrigger','data-persistent-form','cwp215-launcher','document.addEventListener(\'click\',onTrigger','new MutationObserver'])assert(!realm.includes(forbidden),`Realm session integrity still contains duplicate chat/UI ownership: ${forbidden}`);
assert(chat.includes("presentationOwner:'guide-chat-surface-v350'"),'V350 must advertise presentation ownership.');
assert(chat.includes("root.querySelector('[data-persistent-form]').addEventListener('submit'"),'Canonical V350 form submission owner is missing.');
assert(chat.includes('void submitActive(text)'),'Canonical V350 surface does not route submission into submitActive.');
assert(chat.includes('async function submitText(text,system=activeSystem)'),'Canonical V350 direct submission API is missing.');
assert(chat.includes('function switchGuide(system,options={})'),'Canonical V350 guide switching API is missing.');
for(const forbidden of ["document.addEventListener('pointerdown'","document.addEventListener('click'","document.addEventListener('submit'",'new MutationObserver','requestSubmit','.click()'])assert(!chat.includes(forbidden),`V350 reintroduced document-wide or synthetic chat control: ${forbidden}`);
assert(compat.includes("const TARGET='/app/guide-chat-surface-v350.js'"),'Historical V242 filename must forward to V350.');
assert(!compat.includes('data-persistent-form')&&!compat.includes('MutationObserver'),'V242 compatibility loader must not own chat UI.');
assert(sharedLoader.includes('/app/shared-guide-surface-v236-core-v244.js'),'Shared guide loader no longer mounts the canonical bubble-only implementation.');
assert(shared.includes('await api.submitText(value,currentSystem)'),'Shared guide surface is not routed through the canonical submission API.');
assert(sharedCore.includes("mode:'bubble-only'"),'Shared guide surface must remain bubble-only.');
assert(sharedCore.includes('function buildInline(){return false}'),'Retired inline guide cards must stay disabled without post-paint cleanup.');
assert(sharedCore.includes('function removeEmbeddedGuideCards(){return false}'),'Embedded-guide cleanup must remain an inert compatibility API because source markup owns absence.');
assert(!sharedCore.includes('new MutationObserver'),'Shared guide surface must not watch the DOM to delete embedded UI after paint.');
console.log(JSON.stringify({ok:true,revision:'v253-chat-control-source-truth-v350',chatEventOwner:'guide-chat-surface-v350',realmSessionDataOnly:true,documentCapture:false,syntheticRelay:false,embeddedGuideCardsDisabled:true,postPaintGuideCleanup:false,canonicalSubmit:true,bubbleOnly:true,sharedGuideLoaderAware:true},null,2));
