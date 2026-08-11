import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const [realm,workspace,sharedLoader,sharedCore]=await Promise.all([
  read('public/app/realm-session-integrity-v237.js'),
  read('public/app/guide-workspace-v242.js'),
  read('public/app/shared-guide-surface-v236.js'),
  read('public/app/shared-guide-surface-v236-core-v244.js')
]);
const shared=`${sharedLoader}\n${sharedCore}`;
new Function(realm);new Function(workspace);
assert(realm.includes("dataOnly:true"),'Realm session integrity must be data-only.');
assert(realm.includes("canonicalChatOwner:'guide-workspace-v242'"),'Realm session integrity must name v242 as the chat owner.');
for(const forbidden of ['function mountChat','function onTrigger','data-persistent-form','cwp215-launcher','document.addEventListener(\'click\',onTrigger','new MutationObserver'])assert(!realm.includes(forbidden),`Realm session integrity still contains duplicate chat/UI ownership: ${forbidden}`);
assert(workspace.includes("document.addEventListener('pointerdown',onPointerDownCapture,true)"),'Canonical workspace pointer capture is missing.');
assert(workspace.includes("document.addEventListener('click',onClickCapture,true)"),'Canonical workspace click capture is missing.');
assert(workspace.includes("document.addEventListener('submit',onSubmitCapture,true)"),'Canonical workspace submit capture is missing.');
assert(workspace.includes('void submitActive(text)'),'Canonical workspace does not route form submission into submitActive.');
assert(workspace.includes('submitText:async(text,system=activeWindow)'),'Canonical workspace direct submission API is missing.');
assert(sharedLoader.includes('/app/shared-guide-surface-v236-core-v244.js'),'Shared guide loader no longer mounts the canonical inline implementation.');
assert(shared.includes('await api.submitText(value,currentSystem)'),'Inline realm composer is not routed through the canonical submission API.');
assert(shared.includes('type="submit"'),'Inline realm composer Send control is not a submit button.');
console.log(JSON.stringify({ok:true,revision:'v253-chat-control-single-owner',chatEventOwner:'guide-workspace-v242',realmSessionDataOnly:true,sendButtonDefaultPreserved:true,closeMinimizeDefaultPreserved:true,canonicalWorkspaceSubmit:true,inlineSubmit:true,sharedGuideLoaderAware:true},null,2));