import { readFile } from 'node:fs/promises';

const redirects = await readFile('public/_redirects', 'utf8');
const manifest = JSON.parse(await readFile('public/app/manifest.webmanifest', 'utf8'));
const appIndex = await readFile('public/app/index.html', 'utf8');

const expectedRedirects = [
  '/app/installed-entry-v146.html /app/ 302',
  '/app/installed-entry-v146 /app/ 302'
];

for (const rule of expectedRedirects) {
  if (!redirects.split(/\r?\n/).includes(rule)) {
    throw new Error(`Missing stable app redirect: ${rule}`);
  }
}

if (!String(manifest.start_url || '').startsWith('/app/?system=civweave')) {
  throw new Error(`Manifest start_url must use /app/: ${manifest.start_url}`);
}

for (const shortcut of manifest.shortcuts || []) {
  if (!String(shortcut.url || '').startsWith('/app/?system=')) {
    throw new Error(`Shortcut must use /app/: ${shortcut.name} -> ${shortcut.url}`);
  }
}

if (!appIndex.includes('/app/installed-entry-v146.js')) {
  throw new Error('/app/index.html is not the active installed-entry launcher.');
}

if (appIndex.includes('/loom/') || appIndex.includes('clean-slate migration')) {
  throw new Error('/app/index.html still contains the retired migration route.');
}

console.log('Stable app entry v215 verified.');
