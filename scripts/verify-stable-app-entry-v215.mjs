import { readFile } from 'node:fs/promises';

const redirects = await readFile('public/_redirects', 'utf8');
const manifest = JSON.parse(await readFile('public/app/manifest.webmanifest', 'utf8'));
const installer = await readFile('public/app/index.html', 'utf8');
const routes = await readFile('public/app/system-routes-v227.js', 'utf8');

const expectedRedirects = [
  '/app/installed-entry-v146.html /app/ 302',
  '/app/installed-entry-v146 /app/ 302'
];

for (const rule of expectedRedirects) {
  if (!redirects.split(/\r?\n/).includes(rule)) {
    throw new Error(`Missing stable app redirect: ${rule}`);
  }
}

const canonicalPaths = [
  '/app/working-campus-v156.html',
  '/app/cabinets/living-school/index.html',
  '/app/realm-console-v140.html',
  '/app/fellowfare-cabinet-v144.html',
  '/app/anarchadia-console-v139.html'
];
const pathOf = value => new URL(String(value || ''), 'https://example.test').pathname;

if (pathOf(manifest.start_url) !== canonicalPaths[0]) {
  throw new Error(`Manifest start_url must open the canonical Civweave campus: ${manifest.start_url}`);
}

for (const shortcut of manifest.shortcuts || []) {
  if (!canonicalPaths.includes(pathOf(shortcut.url))) {
    throw new Error(`Shortcut must use a canonical system route: ${shortcut.name} -> ${shortcut.url}`);
  }
}

for (const route of canonicalPaths) {
  if (!routes.includes(route)) throw new Error(`Route contract is missing ${route}.`);
}

for (const token of ['Install Civweave','/install-v130.js','knowledge-school-installer-v1.js']) {
  if (!installer.includes(token)) throw new Error(`/app/index.html installer is missing ${token}.`);
}

if (installer.includes('/loom/') || installer.includes('clean-slate migration')) {
  throw new Error('/app/index.html still contains the retired migration route.');
}

console.log('Stable app entry v215 verified against the canonical five-system route contract.');
