import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const shellPath = path.join(root, 'public/app/persistent-system-shell-v1.js');
const shellHtmlPath = path.join(root, 'public/app/persistent-system-shell-v1.html');
const bridgePath = path.join(root, 'public/app/settings-local-route-v325.js');
const aliasPath = path.join(root, 'public/app/settings-local-route-v323.js');
const freshPath = path.join(root, 'public/app/settings-local-route-v327.js');
const generationPath = path.join(root, 'public/app/settings-local-route-v331.js');
const coreWorkerPath = path.join(root, 'public/service-worker-core-v208.js');

const shell = fs.readFileSync(shellPath, 'utf8');
const shellHtml = fs.readFileSync(shellHtmlPath, 'utf8');
const bridge = fs.readFileSync(bridgePath, 'utf8');
const alias = fs.readFileSync(aliasPath, 'utf8');
const fresh = fs.readFileSync(freshPath, 'utf8');
const generation = fs.readFileSync(generationPath, 'utf8');
const coreWorker = fs.readFileSync(coreWorkerPath, 'utf8');
const expectedVersion = '1.1.3-settings-local-route-v326-canonical-inert-hard-local';
const expectedShellVersion = '1.1.2-canonical-local-settings-refresh';

const fail = message => { throw new Error(message); };

if (!coreWorker.includes("const cached = await findCached(url.pathname);")) {
  fail('Core worker cache behavior changed; revisit the pathname-generation regression assumptions.');
}
if (!coreWorker.includes("{ ignoreSearch: true }")) {
  fail('Core worker no longer ignores query strings; revisit the pathname-generation regression assumptions.');
}
if (!shellHtml.includes('/app/settings-local-route-v331.js?v=1.1.7-persistent-shell-cache-generation-v332')) {
  fail('Persistent shell does not preload the cache-distinct v331 Local models pathname.');
}
if (shellHtml.includes('/app/settings-local-route-v327.js?v=1.1.6-persistent-shell-direct-preload-v331')) {
  fail('Persistent shell still relies on a query-only cache bust of the already-cached v327 pathname.');
}
if (!shellHtml.includes('delete globalThis.CivweaveSettingsLocalRouteV323')) {
  fail('Persistent shell does not evict a stale Local models global before the cache-distinct preload.');
}
if (shellHtml.indexOf('/app/settings-local-route-v331.js') > shellHtml.indexOf('/app/persistent-system-shell-v1.js')) {
  fail('Cache-distinct Local models renderer must load before persistent Settings can open.');
}
if (!shellHtml.includes(`/app/persistent-system-shell-v1.js?v=${expectedShellVersion}`)) {
  fail('Persistent shell HTML does not load the expected shell runtime.');
}
if (!shell.includes(`const VERSION='${expectedShellVersion}'`)) {
  fail('Persistent shell runtime version does not match its HTML cache key.');
}
if (!shell.includes(`const SETTINGS_LOCAL_ROUTE_VERSION='${expectedVersion}'`)) {
  fail('Persistent shell fallback does not pin the inert local-settings API version.');
}
if (!shell.includes("const SETTINGS_LOCAL_ROUTE=`/app/settings-local-route-v325.js?v=${SETTINGS_LOCAL_ROUTE_VERSION}`")) {
  fail('Persistent shell fallback bridge changed unexpectedly.');
}
if (generation !== fresh) {
  fail('v331 cache-generation route must remain byte-identical to the validated v327 saved-state renderer.');
}
if (alias !== fresh) {
  fail('v323 compatibility alias drifted from the validated v327 saved-state renderer.');
}
if (!bridge.includes(`const VERSION='${expectedVersion}'`)) {
  fail('v325 parent bridge version does not match the persistent-shell fallback pin.');
}
if (!bridge.includes("const FULL_ROUTE='/app/settings-local-route-v327.js?v=1.1.4-settings-local-route-v325-parent-bridge'")) {
  fail('v325 fallback bridge no longer hands off to the validated full implementation.');
}
if (/CivweaveLocalModelDownloadV266|\bmanager\(\)|\bregistry\(\)|\bpackManager\(\)/.test(bridge)) {
  fail('Parent bridge must not touch local-model lifecycle managers before an explicit Local models action.');
}
if (/const m=manager\(\);let all,selected;\s*if\(m\?\.state&&m\?\.selection\)/.test(generation)) {
  fail('Cache-generation Local models view still consults the live download manager during snapshot rendering.');
}

console.log('PASS Local models uses a genuinely new pathname generation before persistent Settings opens; query-only cache busting cannot satisfy this regression.');
