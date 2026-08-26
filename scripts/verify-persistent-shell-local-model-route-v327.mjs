import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const shellPath = path.join(root, 'public/app/persistent-system-shell-v1.js');
const shellHtmlPath = path.join(root, 'public/app/persistent-system-shell-v1.html');
const bridgePath = path.join(root, 'public/app/settings-local-route-v325.js');
const aliasPath = path.join(root, 'public/app/settings-local-route-v323.js');
const freshPath = path.join(root, 'public/app/settings-local-route-v327.js');

const shell = fs.readFileSync(shellPath, 'utf8');
const shellHtml = fs.readFileSync(shellHtmlPath, 'utf8');
const bridge = fs.readFileSync(bridgePath, 'utf8');
const alias = fs.readFileSync(aliasPath, 'utf8');
const fresh = fs.readFileSync(freshPath, 'utf8');
const expectedVersion = '1.1.3-settings-local-route-v326-canonical-inert-hard-local';
const expectedShellVersion = '1.1.2-canonical-local-settings-refresh';
const directPreload = '/app/settings-local-route-v327.js?v=1.1.6-persistent-shell-direct-preload-v331';

const fail = message => { throw new Error(message); };

if (!shellHtml.includes('delete globalThis.CivweaveSettingsLocalRouteV323')) {
  fail('Persistent shell HTML does not evict a stale Local models global before the direct preload.');
}
if (!shellHtml.includes(directPreload)) {
  fail('Persistent shell HTML does not preload the full v327 Local models renderer.');
}
const evictAt = shellHtml.indexOf('delete globalThis.CivweaveSettingsLocalRouteV323');
const preloadAt = shellHtml.indexOf(directPreload);
const shellRuntimeAt = shellHtml.indexOf(`/app/persistent-system-shell-v1.js?v=${expectedShellVersion}`);
if (!(evictAt >= 0 && preloadAt > evictAt && shellRuntimeAt > preloadAt)) {
  fail('Local models stale-global eviction and direct preload must happen before the persistent shell runtime can open Settings.');
}
if (!fresh.includes(`const VERSION='${expectedVersion}'`)) {
  fail('Direct v327 Local models renderer does not expose the version expected by the persistent shell.');
}
if (!fresh.includes('savedStateOnlyView:true') || !fresh.includes('viewWritesState:false')) {
  fail('Direct Local models preload is no longer an inert saved-state-only view.');
}
if (/const m=manager\(\);let all,selected;\s*if\(m\?\.state&&m\?\.selection\)/.test(fresh)) {
  fail('Direct Local models renderer still consults the live download manager during snapshot rendering.');
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
  fail('v323 compatibility alias drifted from the full v327 saved-state implementation.');
}

console.log('PASS persistent shell synchronously evicts stale Local models globals and preloads the full inert v327 renderer before Settings can open, with the v325 bridge retained only as fallback.');
