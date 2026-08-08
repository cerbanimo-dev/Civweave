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
const handlerStart=realm.indexOf('function onTrigger(event){');
const guard=realm.indexOf('event.target.closest?.(`#${ROOT_ID},#${LAUNCHER_ID},#cw-shared-guide-surface-v236`)',handlerStart);
const broadTrigger=realm.indexOf("event.target.closest?.('[data-cwf-chat],[data-open-guide-chat],[data-open-persistent-chat],#moss,#compass,.ls-moss,.ls-compass,[data-guide]')",handlerStart);
assert(handlerStart>=0,'Realm-session chat trigger handler is missing.');
assert(guard>handlerStart&&guard<broadTrigger,'Chat-root exclusion must run before the broad [data-guide] launcher selector.');
assert(realm.includes('if(event.target.closest?.(`#${ROOT_ID},#${LAUNCHER_ID},#cw-shared-guide-surface-v236`))return;'),'Chat controls can still be swallowed by the legacy launcher capture handler.');
assert(workspace.includes("document.addEventListener('submit',onSubmitCapture,true)"),'Canonical workspace submit capture is missing.');
assert(workspace.includes('void submitActive(text)'),'Canonical workspace does not route form submission into submitActive.');
assert(workspace.includes('submitText:async(text,system=activeWindow)'),'Canonical workspace direct submission API is missing.');
assert(sharedLoader.includes('/app/shared-guide-surface-v236-core-v244.js'),'Shared guide loader no longer mounts the canonical inline implementation.');
assert(shared.includes('await api.submitText(value,currentSystem)'),'Inline realm composer is not routed through the canonical submission API.');
assert(shared.includes('type="submit"'),'Inline realm composer Send control is not a submit button.');
console.log(JSON.stringify({ok:true,revision:'v253-chat-control-capture',chatRootExcludedFromLegacyTrigger:true,sendButtonDefaultPreserved:true,closeMinimizeDefaultPreserved:true,canonicalWorkspaceSubmit:true,inlineSubmit:true,sharedGuideLoaderAware:true},null,2));
