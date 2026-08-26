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

const fail = message => { throw new Error(message); };

if (!shellHtml.includes(`/app/persistent-system-shell-v1.js?v=${expectedShellVersion}`)) {
  fail('Persistent shell HTML does not cache-bust the shell runtime containing the local-settings loader.');
}
if (!shell.includes(`const VERSION='${expectedShellVersion}'`)) {
  fail('Persistent shell runtime version does not match its HTML cache key.');
}
if (!shell.includes(`const SETTINGS_LOCAL_ROUTE_VERSION='${expectedVersion}'`)) {
  fail('Persistent shell does not pin the inert local-settings bridge version.');
}
if (!shell.includes("const SETTINGS_LOCAL_ROUTE=`/app/settings-local-route-v325.js?v=${SETTINGS_LOCAL_ROUTE_VERSION}`")) {
  fail('Persistent shell does not load settings-local-route-v325.js as its local-settings bridge.');
}
if (shell.includes("SETTINGS_LOCAL_ROUTE='/app/settings-local-route-v323.js")) {
  fail('Persistent shell still loads the legacy v323 path directly.');
}
if (!shell.includes("function settingsLocalRouteReady(){return globalThis.CivweaveSettingsLocalRouteV323?.version===SETTINGS_LOCAL_ROUTE_VERSION}")) {
  fail('Persistent shell does not require the pinned local-settings API version.');
}
if (!shell.includes('if(settingsLocalRouteReady()&&invoke())return true;')) {
  fail('Settings can still open before the local-settings bridge is ready.');
}
if (!shell.includes("loadScript(SETTINGS_LOCAL_ROUTE,settingsLocalRouteReady,'Settings local-model view')")) {
  fail('Persistent shell does not load the local-settings bridge before Settings opens.');
}
if (!bridge.includes(`const VERSION='${expectedVersion}'`)) {
  fail('v325 parent bridge version does not match the persistent-shell pin.');
}
if (!bridge.includes("const FULL_ROUTE='/app/settings-local-route-v327.js?v=1.1.4-settings-local-route-v325-parent-bridge'")) {
  fail('v325 parent bridge does not hand off to the cache-distinct v327 full implementation.');
}
if (!bridge.includes('delete globalThis.CivweaveSettingsLocalRouteV323')) {
  fail('v325 parent bridge does not evict a stale same-version local-settings global before handoff.');
}
if (!bridge.includes('loaderBridge:true')) {
  fail('v325 parent bridge is not marked as a replaceable loader bridge.');
}
if (!bridge.includes('renderLocalModels')) {
  fail('v325 parent bridge does not expose an immediate Local models renderer.');
}
if (bridge === fresh) {
  fail('v325 must remain a small parent bridge rather than duplicating the full v327 implementation.');
}
if (alias !== fresh) {
  fail('v323 compatibility alias drifted from the full v327 saved-state implementation.');
}
if (/CivweaveLocalModelDownloadV266|\bmanager\(\)|\bregistry\(\)|\bpackManager\(\)/.test(bridge)) {
  fail('Parent bridge must not touch local-model lifecycle managers before the explicit Local models handoff.');
}
if (/const m=manager\(\);let all,selected;\s*if\(m\?\.state&&m\?\.selection\)/.test(fresh)) {
  fail('Fresh local-settings implementation still consults the live download manager during snapshot rendering.');
}

console.log('PASS persistent shell loads an inert v325 bridge that evicts stale globals and hands Local models to the cache-distinct saved-state-only v327 implementation.');
