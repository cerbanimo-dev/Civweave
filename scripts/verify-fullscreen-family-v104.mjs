import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root=process.cwd();
const read=file=>fs.readFile(path.join(root,file),'utf8');
const assert=(value,message)=>{if(!value)throw new Error(message)};

const [shell,nav,routes,ownershipRaw,host,entry,manifestRaw,worker,loader,settingsController,shellAssets]=await Promise.all([
  read('public/app/family-shell-v104.js'),
  read('public/app/themed-system-nav-v178.js'),
  read('public/app/system-routes-v227.js'),
  read('config/system-ownership.json'),
  read('public/app/fullscreen-family-v104.html'),
  read('public/app/installed-entry-v146.js'),
  read('public/app/manifest.webmanifest'),
  read('public/service-worker.js'),
  read('public/app/family-ai-loader-v105.js'),
  read('public/app/model-settings-controller-v173.js'),
  read('public/service-worker-shell-assets-v1.js')
]);

const ownership=JSON.parse(ownershipRaw);
const expectedOrder=['civweave','living-school','cerbanimo','fellowfare','anarchadia'];

for(const token of [
  '<iframe id="cw-family-stage"',
  '/app/system-routes-v227.js?v=1.0.163-five-system-route-contract-v227',
  '/app/themed-system-nav-v178.js?v=1.0.163-five-system-navigation-v227',
  "const SHELL_REVISION='persistent-family-shell-v1'",
  'CivweavePersistentFamilyShellV1',
  "document.addEventListener('click'",
  'event.stopImmediatePropagation()',
  'cw-shell-sprite',
  'removeEmbeddedRail()',
  "addEventListener('popstate'"
])assert(host.includes(token),`Persistent family host missing ${token}`);
assert(!host.includes('location.replace(destination.href)'),'Persistent family host must not replace itself with a realm page.');
assert(routes.includes("const SHELL_PATH='/app/fullscreen-family-v104.html'"),'Route contract must expose the persistent family shell.');
assert(routes.includes('function directUrlFor(')&&routes.includes('function shellUrlFor('),'Route contract must distinguish realm-stage URLs from top-level shell URLs.');
assert(routes.includes("return window.self!==window.top"),'Embedded realm documents must keep direct URLs while top-level navigation uses the shell.');
for(const asset of [
  '/Civweave-weaveling-sprites.png',
  '/Living-School-moss-sprites.png',
  '/Cerbanimo-kamiya-sprites.png',
  '/FellowFare-rook-sprites.png',
  '/Anarchadia-merlin-sprites.png',
  '/app/assets/ai/chat/weaveling-face-v255.webp',
  '/app/assets/ai/chat/moss-face-v255.webp',
  '/app/assets/ai/chat/kamiya-face-v255.webp',
  '/app/assets/ai/chat/rook-face-v255.webp',
  '/app/assets/ai/chat/merlin-face-v255.webp'
])assert(shellAssets.includes(asset),`Required family navigation media missing ${asset}`);
assert(shellAssets.includes("requiredFamilyNavigation:[...REQUIRED_FAMILY_NAV]"),'Navigation media must be part of the required offline shell contract.');

assert((entry.includes("const requested=params.get('system')||params.get('target')||'civweave'")
  &&entry.includes('(sites[system]||sites.civweave)')
  &&entry.includes("destination.searchParams.set('installed','1')"))||entry.includes('routes.urlFor'),
  'Installed entry must resolve the requested system through the canonical route authority.');

const manifest=JSON.parse(manifestRaw);
assert(manifest.start_url.includes('installed-entry-v146.html'),'Civweave must continue launching through the installed updater entry.');
assert(manifest.shortcuts.length===5,'Every system needs a direct shortcut.');

for(const token of [
  "const SYSTEM_ORDER=['civweave','living-school','cerbanimo','fellowfare','anarchadia']",
  'data-cwf-chat',
  'data-open-unified-ai-settings',
  "document.documentElement.dataset.familyShell='direct'",
  "document.documentElement.dataset.visualShell='merlinites-r1'",
  'Talk to Civweave with Weaveling',
  '/app/merlinites-shell-fix-v166.css?v=merlinites-r2',
  "settingsOwner:'settings-gateway-v317'",
  "familyNavigationOwner:'themed-system-nav-v178'",
  'familyNavigationOwnership:false'
])assert(shell.includes(token),`Family shell contract missing ${token}`);

for(const retired of ['cwf104-tray','data-cwf-system','cwf104-system-art','data-cwf-badge','data-cwf-state']){
  assert(!shell.includes(retired),`Family shell still contains retired navigation token ${retired}.`);
}
assert(!shell.includes('MutationObserver')&&!shell.includes('contentDocument'),'Realm family helper must not observe nested documents; the persistent top-level host owns only its stage boundary.');
assert(!shell.includes('const SETTINGS_SCRIPTS=')&&!shell.includes('ensureSettings'),'Family shell still owns a settings loader.');

assert.equal(ownership.systems?.['family-navigation']?.owner,'public/app/themed-system-nav-v178.js','Themed navigation must be the family-navigation owner.');
assert.equal(ownership.systems?.['family-navigation']?.retiredOwner,'public/app/family-shell-v104.js','Family shell must remain recorded only as the retired navigation owner.');
assert(nav.includes("const NAV_ID='cw-themed-system-nav'"),'Themed navigation lost its canonical DOM root.');
assert(nav.includes('cw-themed-system-avatar')&&host.includes('cw-shell-sprite'),'The persistent rail lost expressive avatar rendering or its direct image fallback.');
assert(!nav.includes('cwf104-tray'),'Themed navigation still carries a suppression dependency on the retired tray.');

for(const token of ['async function ensure()', '/app/minilm-reflex-runtime-v138.js'])assert(loader.includes(token),`Lazy family chat contract missing ${token}`);
assert(!loader.includes('/app/minilm-model-settings-v138.js'),'Chat loader still owns settings.');
for(const token of ["VERSION='173.0-direct-settings-controller'",'/app/minilm-model-settings-v138.js','function installDormantReflexStatus()'])assert(settingsController.includes(token),`Direct settings contract missing ${token}`);

for(const pathName of ['/app/fullscreen-family-v104.html','/app/family-shell-v104.css','/app/family-shell-v104.js'])assert(worker.includes(pathName),`Offline package missing ${pathName}`);
for(const retired of ['/app/assets/cabinets/civweave.webp','/app/assets/world/town-square-home.webp','/app/cabinet-calibrator-v144.html','/app/shared/cabinet-shells-v129.json'])assert(!worker.includes(retired),`Retired install payload remains: ${retired}`);

for(const id of expectedOrder)assert(shell.includes(`${id}:`)||shell.includes(`'${id}':`)||shell.includes(`'${id}'`),`Family shell lost system compatibility metadata for ${id}.`);

console.log('Civweave persistent family shell verification passed: the five-guide rail and avatar media remain mounted while realm stages switch underneath it.');