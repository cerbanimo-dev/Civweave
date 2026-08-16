import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root=process.cwd();
const read=file=>fs.readFile(path.join(root,file),'utf8');
const assert=(value,message)=>{if(!value)throw new Error(message)};

const [shell,nav,ownershipRaw,host,entry,manifestRaw,worker,loader,settingsController]=await Promise.all([
  read('public/app/family-shell-v104.js'),
  read('public/app/themed-system-nav-v178.js'),
  read('config/system-ownership.json'),
  read('public/app/fullscreen-family-v104.html'),
  read('public/app/installed-entry-v146.js'),
  read('public/app/manifest.webmanifest'),
  read('public/service-worker.js'),
  read('public/app/family-ai-loader-v105.js'),
  read('public/app/model-settings-controller-v173.js')
]);

const ownership=JSON.parse(ownershipRaw);
const expectedOrder=['civweave','living-school','cerbanimo','fellowfare','anarchadia'];

assert(host.includes('location.replace')&&!host.includes('<iframe'),'Compatibility family host must redirect without an iframe.');
for(const route of [
  '/app/working-campus-v156.html',
  '/app/cabinets/living-school/index.html',
  '/app/realm-console-v140.html?system=cerbanimo',
  '/app/fellowfare-cabinet-v144.html',
  '/app/anarchadia-console-v139.html'
])assert(host.includes(route),`Compatibility host missing ${route}`);

assert(entry.includes("const requested=params.get('system')||params.get('target')||'civweave'")
  &&entry.includes('(sites[system]||sites.civweave)')
  &&entry.includes("destination.searchParams.set('installed','1')"),
  'Installed entry must resolve the requested system through direct installed routes.');

const manifest=JSON.parse(manifestRaw);
assert(manifest.start_url.includes('system=civweave'),'Civweave must remain the first installed screen.');
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
assert(!shell.includes('MutationObserver')&&!shell.includes('contentDocument'),'Family shell must not observe nested documents.');
assert(!shell.includes('const SETTINGS_SCRIPTS=')&&!shell.includes('ensureSettings'),'Family shell still owns a settings loader.');

assert.equal(ownership.systems?.['family-navigation']?.owner,'public/app/themed-system-nav-v178.js','Themed navigation must be the family-navigation owner.');
assert.equal(ownership.systems?.['family-navigation']?.retiredOwner,'public/app/family-shell-v104.js','Family shell must remain recorded only as the retired navigation owner.');
assert(nav.includes("const NAV_ID='cw-themed-system-nav'"),'Themed navigation lost its canonical DOM root.');
assert(nav.includes('cw-themed-system-avatar')&&nav.includes('cw-themed-system-monogram'),'Themed navigation lost expressive avatar/monogram rendering.');
assert(!nav.includes('cwf104-tray'),'Themed navigation still carries a suppression dependency on the retired tray.');

for(const token of ['async function ensure()', '/app/minilm-reflex-runtime-v138.js'])assert(loader.includes(token),`Lazy family chat contract missing ${token}`);
assert(!loader.includes('/app/minilm-model-settings-v138.js'),'Chat loader still owns settings.');
for(const token of ["VERSION='173.0-direct-settings-controller'",'/app/minilm-model-settings-v138.js','function installDormantReflexStatus()'])assert(settingsController.includes(token),`Direct settings contract missing ${token}`);

for(const pathName of ['/app/fullscreen-family-v104.html','/app/family-shell-v104.css','/app/family-shell-v104.js'])assert(worker.includes(pathName),`Offline package missing ${pathName}`);
for(const retired of ['/app/assets/cabinets/civweave.webp','/app/assets/world/town-square-home.webp','/app/cabinet-calibrator-v144.html','/app/shared/cabinet-shells-v129.json'])assert(!worker.includes(retired),`Retired install payload remains: ${retired}`);

for(const id of expectedOrder)assert(shell.includes(`${id}:`)||shell.includes(`'${id}':`)||shell.includes(`'${id}'`),`Family shell lost system compatibility metadata for ${id}.`);

console.log('Civweave family shell verification passed: header/chat/status remain shared, while themed-system-nav-v178 is the sole five-system navigation owner.');
