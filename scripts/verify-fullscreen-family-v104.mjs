import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const exists=path=>access(new URL(`../${path}`,import.meta.url)).then(()=>true,()=>false);
const [entry,manifest,routes,surface,worker]=await Promise.all([
  read('public/app/installed-entry-v146.js'),
  read('public/app/manifest.webmanifest'),
  read('public/app/system-routes-v227.js'),
  read('public/app/guide-chat-surface-v350.js'),
  read('public/service-worker-core-v208.js')
]);

assert.equal(await exists('public/app/fullscreen-family-v104.html'),false,'Retired fullscreen family presentation returned.');
for(const retired of [
  'public/app/lite-v128.html','public/app/lite-v129.html','public/app/loom-v127.html','public/app/loom-v128.html',
  'public/app/realm-v127.html','public/app/realm-v128.html','public/app/cabinet-only-v144.html',
  'public/app/cabinet-mode-v142.html','public/app/cabinet-visual-v141.html','public/app/cabinet-calibrator-v144.html'
])assert.equal(await exists(retired),false,`Retired presentation returned: ${retired}`);

const manifestJson=JSON.parse(manifest);
assert.match(entry,/const requested=params\.get\('system'\)\|\|params\.get\('target'\)\|\|'civweave'/);
assert.equal(manifestJson.shortcuts.length,5,'Every current system still needs a direct installed shortcut.');
for(const route of ['/app/working-campus-v156.html','/app/cabinets/living-school/index.html','/app/realm-console-v140.html','/app/fellowfare-cabinet-v144.html','/app/anarchadia-console-v139.html'])assert.ok(routes.includes(route),`Canonical installed route missing ${route}`);
assert.match(surface,/presentation:'single-current-chat-surface'/);
assert.match(surface,/const SYSTEMS=\['civweave','living-school','cerbanimo','fellowfare','anarchadia'\]/);
assert.doesNotMatch(surface,/CIVWEAVE THREAD|cw242-window-switcher|Switching windows never mixes histories/);
assert.doesNotMatch(worker,/fullscreen-family-v104/,'Service-worker app shell still requires the retired fullscreen family screen.');

console.log(JSON.stringify({ok:true,revision:'retired-fullscreen-family-v350',retiredPresentation:false,currentSystemRoutes:5,currentGuideSurface:'guide-chat-surface-v350'},null,2));
