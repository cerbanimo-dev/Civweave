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
const generatedPreload = '/app/settings-local-route-v331.js?v=1.1.7-persistent-shell-cache-generation-v333';
const retiredQueryOnlyPreload = '/app/settings-local-route-v327.js?v=1.1.6-persistent-shell-direct-preload-v331';

const fail = message => { throw new Error(message); };

if (!coreWorker.includes('const cached = await findCached(url.pathname);')) {
  fail('Core worker cache behavior changed; revisit the pathname-generation regression assumptions.');
}
if (!coreWorker.includes('{ ignoreSearch: true }')) {
  fail('Core worker no longer ignores query strings; revisit the pathname-generation regression assumptions.');
}
if (!shellHtml.includes('delete globalThis.CivweaveSettingsLocalRouteV323')) {
  fail('Persistent shell HTML does not evict a stale Local models global before direct preload.');
}
if (!shellHtml.includes(generatedPreload)) {
  fail('Persistent shell HTML does not preload the cache-distinct v331 Local models pathname.');
}
if (shellHtml.includes(retiredQueryOnlyPreload)) {
  fail('Persistent shell still relies on query-only cache busting of the already-cached v327 pathname.');
}
const evictAt = shellHtml.indexOf('delete globalThis.CivweaveSettingsLocalRouteV323');
const preloadAt = shellHtml.indexOf(generatedPreload);
const shellRuntimeAt = shellHtml.indexOf(`/app/persistent-system-shell-v1.js?v=${expectedShellVersion}`);
if (!(evictAt >= 0 && preloadAt > evictAt && shellRuntimeAt > preloadAt)) {
  fail('Local models stale-global eviction and cache-distinct preload must happen before persistent Settings can open.');
}
if (generation !== fresh) {
  fail('v331 cache-generation route must remain byte-identical to the validated v327 inert renderer.');
}
if (!generation.includes(`const VERSION='${expectedVersion}'`)) {
  fail('v331 Local models generation does not expose the version expected by persistent Settings.');
}
if (!generation.includes('savedStateOnlyView:true') || !generation.includes('viewWritesState:false')) {
  fail('v331 Local models generation is no longer an inert saved-state-only view.');
}
if (/const m=manager\(\);let all,selected;\s*if\(m\?\.state&&m\?\.selection\)/.test(generation)) {
  fail('v331 Local models renderer still consults the live download manager during snapshot rendering.');
}
if (!shell.includes(`const SETTINGS_LOCAL_ROUTE_VERSION='${expectedVersion}'`)) {
  fail('Persistent shell fallback loader does not pin the full Local models API version.');
}
if (!shell.includes("const SETTINGS_LOCAL_ROUTE=`/app/settings-local-route-v325.js?v=${SETTINGS_LOCAL_ROUTE_VERSION}`")) {
  fail('Persistent shell lost its v325 fallback bridge.');
}
if (!bridge.includes("const FULL_ROUTE='/app/settings-local-route-v327.js?v=1.1.4-settings-local-route-v325-parent-bridge'")) {
  fail('v325 fallback bridge no longer hands off to v327.');
}
if (!bridge.includes('delete globalThis.CivweaveSettingsLocalRouteV323')) {
  fail('v325 fallback bridge no longer evicts a stale same-version global.');
}
if (alias !== fresh) {
  fail('v323 compatibility alias drifted from the validated v327 saved-state implementation.');
}

console.log('PASS persistent Settings uses a new Local models pathname generation; query-only cache busting cannot satisfy this regression.');
