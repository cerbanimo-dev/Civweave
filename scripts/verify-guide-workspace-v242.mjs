import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [pointer,surface,ownership]=await Promise.all([
  read('public/app/guide-workspace-v242.js'),
  read('public/app/guide-chat-surface-v350.js'),
  read('config/system-ownership.json')
]);
new Function(pointer);new Function(surface);
const owners=JSON.parse(ownership);
assert.equal(owners.systems?.['guide-chat']?.owner,'public/app/guide-chat-surface-v350.js');
assert.match(pointer,/retired five-window workspace presentation was deleted/);
assert.match(pointer,/guide-chat-surface-v350\.js/);
assert.doesNotMatch(pointer,/cw242-window-switcher|data-cw242-window|CIVWEAVE THREAD|Switching windows never mixes histories/);
assert.match(surface,/1\.0\.160-guide-chat-surface-v350/);
assert.match(surface,/presentation:'single-current-chat-surface'/);
assert.match(surface,/const SYSTEMS=\['civweave','living-school','cerbanimo','fellowfare','anarchadia'\]/);
assert.match(surface,/data-guide-select/);
assert.match(surface,/handoffSystem:system!==pageSystem\?system:undefined/);
assert.match(surface,/explicitHandoffTarget/);
assert.match(surface,/data-persistent-form/);
assert.match(surface,/CivweaveModelRuntime/);
assert.match(surface,/provider:'deterministic-local'/);
assert.match(surface,/height:100dvh/);
assert.match(surface,/env\(safe-area-inset-bottom\)/);
assert.doesNotMatch(surface,/new\s+MutationObserver|\.observe\s*\(/);
assert.doesNotMatch(surface,/visualViewport.*addEventListener/);
for(const ancient of ['cw242-window-switcher','data-cw242-window','CIVWEAVE THREAD','Switching windows never mixes histories','Cross-realm work appears only as an explicit handover card'])assert.ok(!surface.includes(ancient),`retired presentation returned: ${ancient}`);
console.log(JSON.stringify({ok:true,workspaceFilename:'compatibility-pointer-only',canonicalOwner:'guide-chat-surface-v350',presentation:'single-current-chat-surface',guideCount:5,retiredWorkspacePresentation:false,viewportFeedback:false},null,2));
