import assert from 'node:assert/strict';
import {access,readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const exists=async relative=>{try{await access(path.join(root,relative));return true}catch{return false}};

const retiredScreens=[
  'public/app/lite-v128.html','public/app/lite-v129.html',
  'public/app/loom-v127.html','public/app/loom-v128.html',
  'public/app/realm-v127.html','public/app/realm-v128.html',
  'public/cabinetonly/index.html','public/app/cabinet-only-v144.html',
  'public/app/cabinet-mode-v142.html','public/app/cabinet-visual-v141.html',
  'public/app/cabinet-calibrator-v144.html','public/app/fullscreen-family-v104.html'
];
for(const relative of retiredScreens)assert.equal(await exists(relative),false,`Retired presentation screen came back: ${relative}`);

const [pointer,surface,routes,ownership]=await Promise.all([
  read('public/app/guide-workspace-v242.js'),
  read('public/app/guide-chat-surface-v350.js'),
  read('public/app/system-routes-v227.js'),
  read('config/system-ownership.json')
]);
new Function(pointer);new Function(surface);
assert.match(pointer,/retired five-window workspace presentation was deleted/);
assert.match(pointer,/guide-chat-surface-v350\.js/);
for(const forbidden of ['cw242-window-switcher','data-cw242-window','Switching windows never mixes histories','Cross-realm work appears only as an explicit handover card','CIVWEAVE THREAD'])assert.ok(!pointer.includes(forbidden),`Retired workspace presentation leaked into compatibility pointer: ${forbidden}`);
assert.doesNotMatch(pointer,/innerHTML\s*=|createElement\(['"](?:section|nav|header|form|textarea)['"]\)/,'Retired workspace pointer must never render a view');
assert.match(surface,/1\.0\.160-guide-chat-surface-v350/);
assert.match(surface,/presentation:'single-current-chat-surface'/);
assert.match(surface,/data-guide-select/);
assert.match(surface,/height:100dvh/);
assert.match(surface,/globalThis\.CivweavePersistentGuideChatV215=api/);
for(const forbidden of ['cw242-window-switcher','data-cw242-window','Switching windows never mixes histories','Cross-realm work appears only as an explicit handover card','CIVWEAVE THREAD'])assert.ok(!surface.includes(forbidden),`Ancient workspace UI came back in the canonical surface: ${forbidden}`);
assert.doesNotMatch(surface,/new\s+MutationObserver|\.observe\s*\(/,'Canonical chat presentation must not install DOM repair observers');
assert.doesNotMatch(surface,/visualViewport.*addEventListener/,'Canonical chat presentation must not own visualViewport feedback');
for(const pathname of ['/app/working-campus-v156.html','/app/cabinets/living-school/index.html','/app/realm-console-v140.html','/app/fellowfare-cabinet-v144.html','/app/anarchadia-console-v139.html'])assert.ok(routes.includes(pathname),`Canonical route missing ${pathname}`);
for(const retired of ['lite-v128.html','lite-v129.html','loom-v127.html','loom-v128.html','realm-v127.html','realm-v128.html','cabinet-only-v144.html','cabinet-mode-v142.html','cabinet-visual-v141.html','cabinet-calibrator-v144.html','fullscreen-family-v104.html'])assert.ok(!routes.includes(retired),`Retired screen became navigable again: ${retired}`);
const owners=JSON.parse(ownership);assert.equal(owners.systems?.['guide-chat']?.owner,'public/app/guide-chat-surface-v350.js','guide-chat ownership must point at the current surface');

const appFiles=await readdir(path.join(root,'public','app'));
const unexpected=appFiles.filter(name=>/^(?:lite-v12[89]|loom-v12[78]|realm-v12[78]|cabinet-(?:only-v144|mode-v142|visual-v141|calibrator-v144)|fullscreen-family-v104)\.html$/.test(name));
assert.deepEqual(unexpected,[],'Retired top-level HTML screens returned to public/app');
console.log(JSON.stringify({ok:true,revision:'active-screen-surface-v350',canonicalSystemScreens:5,retiredScreensRemoved:retiredScreens.length,legacyWorkspacePresentation:false,canonicalGuideSurface:'public/app/guide-chat-surface-v350.js'},null,2));
