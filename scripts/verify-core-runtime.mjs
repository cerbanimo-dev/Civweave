import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFile(path.join(root, relative), 'utf8');
const fail = (message) => { throw new Error(message); };

const [rootHtml, appHtml, offlineHtml, redirects, manifest, worker, buildKit, packageJson] = await Promise.all([
  read('public/index.html'),
  read('public/app/index.html'),
  read('public/offline.html'),
  read('public/_redirects'),
  read('public/app/manifest.webmanifest'),
  read('public/service-worker.js'),
  read('scripts/build-mobile-install-kit.mjs'),
  read('package.json')
]);

const forbidden = /installed-entry-v|working-campus-v|install-boundary-v|family-shell-v|platform-experience-v|service-worker-v\d+/i;
if (forbidden.test(rootHtml)) fail('Web root still references a legacy runtime.');
if (forbidden.test(appHtml)) fail('Canonical app entry still references a legacy runtime.');
if (forbidden.test(offlineHtml) || forbidden.test(redirects)) fail('Offline or redirect plumbing still references a legacy runtime.');
if (forbidden.test(manifest)) fail('PWA manifest still launches a legacy runtime.');
if (forbidden.test(worker)) fail('Service worker still requires or injects a legacy runtime.');
if (/install-boundary|extractArray\(|DEVICE_REQUIRED|injectNavigationPolicy|packageRecovery/i.test(worker + buildKit)) fail('Legacy package-enforcement code is still active.');

const styles = [...appHtml.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi)];
const scripts = [...appHtml.matchAll(/<script\b[^>]*src=["'][^"']+["'][^>]*><\/script>/gi)];
if (styles.length !== 1) fail(`Canonical app must have exactly one stylesheet; found ${styles.length}.`);
if (scripts.length !== 1) fail(`Canonical app must have exactly one executable script; found ${scripts.length}.`);
if (!appHtml.includes('/app/core.css') || !appHtml.includes('/app/core.js')) fail('Canonical core assets are not wired directly.');

const parsedManifest = JSON.parse(manifest);
if (parsedManifest.start_url !== '/app/' || parsedManifest.id !== '/app/') fail('PWA must start at the canonical /app/ entry.');
const pkg = JSON.parse(packageJson);
if (pkg.scripts?.start !== 'node server.mjs') fail('Runtime start must not traverse a versioned preparation chain.');
if (/prepare-start-v|start-civweave-v|server-v\d+/i.test(JSON.stringify(pkg.scripts || {}))) fail('package.json still invokes versioned startup scaffolding.');

console.log('Core runtime verified: one entry, one stylesheet, one script, no legacy boot/package enforcement.');
