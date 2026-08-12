import { readFile } from 'node:fs/promises';

const redirects = await readFile('public/_redirects', 'utf8');
const manifest = JSON.parse(await readFile('public/app/manifest.webmanifest', 'utf8'));
const installer = await readFile('public/app/index.html', 'utf8');
const installedEntry = await readFile('public/app/installed-entry-v146.js', 'utf8');
const routes = await readFile('public/app/system-routes-v227.js', 'utf8');

const redirectLines=redirects.split(/\r?\n/).filter(Boolean);
if (redirectLines.includes('/app/installed-entry-v146.html /app/ 302')) {
  throw new Error('Stable installed entry must remain reachable; do not redirect the PWA start URL back to the installer.');
}
if (redirectLines.some(line => line.startsWith('/app/installed-entry-v146 ') || line.startsWith('/app/installed-entry-v146.html '))) {
  throw new Error('Do not add redirects for the installed entry; Cloudflare Pages canonicalizes the HTML file to the extensionless clean URL automatically.');
}

const canonicalPaths = [
  '/app/working-campus-v156.html',
  '/app/cabinets/living-school/index.html',
  '/app/realm-console-v140.html',
  '/app/fellowfare-cabinet-v144.html',
  '/app/anarchadia-console-v139.html'
];
const pathOf = value => new URL(String(value || ''), 'https://example.test').pathname;

if (pathOf(manifest.start_url) !== '/app/installed-entry-v146') {
  throw new Error(`Manifest start_url must use the Cloudflare-canonical extensionless updater entry: ${manifest.start_url}`);
}
if (!String(manifest.start_url).includes('installed=1')) throw new Error('Manifest installed entry must carry installed=1.');

for (const shortcut of manifest.shortcuts || []) {
  if (pathOf(shortcut.url) !== '/app/installed-entry-v146') {
    throw new Error(`Shortcut must use the Cloudflare-canonical extensionless updater entry: ${shortcut.name} -> ${shortcut.url}`);
  }
}
for (const route of canonicalPaths) {
  if (!routes.includes(route)) throw new Error(`Route contract is missing ${route}.`);
}
for (const token of ["updateViaCache:'none'",'await registration.update()',"candidate.postMessage({type:'SKIP_WAITING'})",'routes.urlFor']) {
  if (!installedEntry.includes(token)) throw new Error(`Installed entry is missing updater-first token ${token}.`);
}
for (const token of ['Install Civweave','/install-v130.js','knowledge-school-installer-v1.js']) {
  if (!installer.includes(token)) throw new Error(`/app/index.html installer is missing ${token}.`);
}
if (installer.includes('/loom/') || installer.includes('clean-slate migration')) {
  throw new Error('/app/index.html still contains the retired migration route.');
}

console.log('Stable app entry verified: installed launches use the Cloudflare-canonical clean URL, update first, then route into the canonical five-system contract.');
