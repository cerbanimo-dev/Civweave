import { readFile } from 'node:fs/promises';

const redirects = await readFile('public/_redirects', 'utf8');
const manifest = JSON.parse(await readFile('public/app/manifest.webmanifest', 'utf8'));
const installer = await readFile('public/app/index.html', 'utf8');
const installerRuntime = await readFile('public/install-v130.js', 'utf8');
const installedEntry = await readFile('public/app/installed-entry-v146.js', 'utf8');
const routes = await readFile('public/app/system-routes-v227.js', 'utf8');

const redirectLines=redirects.split(/\r?\n/).filter(Boolean);
if (redirectLines.includes('/app/installed-entry-v146.html /app/ 302')) {
  throw new Error('Stable installed entry must remain reachable; do not redirect the PWA start URL back to the installer.');
}
if (redirectLines.some(line => line.startsWith('/app/installed-entry-v146 ') || line.startsWith('/app/installed-entry-v146.html '))) {
  throw new Error('Do not add redirects for the installed entry; the manifest must launch the committed HTML entry directly.');
}

const canonicalPaths = [
  '/app/working-campus-v156.html',
  '/app/cabinets/living-school/index.html',
  '/app/realm-console-v140.html',
  '/app/fellowfare-cabinet-v144.html',
  '/app/anarchadia-console-v139.html'
];
const pathOf = value => new URL(String(value || ''), 'https://example.test').pathname;
const installedUpdaterPath = '/app/installed-entry-v146.html';

if (pathOf(manifest.start_url) !== installedUpdaterPath) {
  throw new Error(`Manifest start_url must use the canonical HTML installed entry: ${manifest.start_url}`);
}
if (!String(manifest.start_url).includes('installed=1')) throw new Error('Manifest installed entry must carry installed=1.');

for (const shortcut of manifest.shortcuts || []) {
  if (pathOf(shortcut.url) !== installedUpdaterPath) {
    throw new Error(`Shortcut must use the canonical HTML installed entry: ${shortcut.name} -> ${shortcut.url}`);
  }
}
for (const route of canonicalPaths) {
  if (!routes.includes(route)) throw new Error(`Route contract is missing ${route}.`);
}
for (const token of ["allowProvision:localDeveloper()",'localCampusReady',"installed-entry-local-package-required","browserRuntimePolicy:'installed-display-cache-only'",'routes.urlFor']) {
  if (!installedEntry.includes(token)) throw new Error(`Installed entry is missing local-first token ${token}.`);
}
if (installedEntry.includes('allowProvision:true')) throw new Error('Production installed entry must never enable implicit worker provisioning.');
for (const token of ['Install Civweave','Required local campus','FIELD NOTES FROM ANARCHADIA']) {
  if (!installer.includes(token)) throw new Error(`/app/index.html local-first installer is missing ${token}.`);
}
for (const token of ["BOOTSTRAP_BUILD='installer-bootstrap-v1-local-first'",'ensureLocalPackage','Installation will wait rather than fall back to an online runtime.']) {
  if (!installerRuntime.includes(token)) throw new Error(`Installer runtime is missing ${token}.`);
}
if (installer.includes('/loom/') || installer.includes('clean-slate migration')) {
  throw new Error('/app/index.html still contains the retired migration route.');
}

console.log('Stable app entry verified: installed launches require a complete local campus, use cache-only runtime behavior, and route through the canonical five-system contract.');
