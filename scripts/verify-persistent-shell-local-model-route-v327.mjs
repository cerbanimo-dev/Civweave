import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const shellPath = path.join(root, 'public/app/persistent-system-shell-v1.js');
const shellHtmlPath = path.join(root, 'public/app/persistent-system-shell-v1.html');
const routePath = path.join(root, 'public/app/settings-local-route-v325.js');
const aliasPath = path.join(root, 'public/app/settings-local-route-v323.js');

const shell = fs.readFileSync(shellPath, 'utf8');
const shellHtml = fs.readFileSync(shellHtmlPath, 'utf8');
const route = fs.readFileSync(routePath, 'utf8');
const alias = fs.readFileSync(aliasPath, 'utf8');
const expectedVersion = '1.1.3-settings-local-route-v326-canonical-inert-hard-local';
const expectedShellVersion = '1.1.2-canonical-local-settings-refresh';

const fail = message => { throw new Error(message); };

if (!shellHtml.includes(`/app/persistent-system-shell-v1.js?v=${expectedShellVersion}`)) {
  fail('Persistent shell HTML does not cache-bust the shell runtime containing the canonical local-settings loader.');
}
if (!shell.includes(`const VERSION='${expectedShellVersion}'`)) {
  fail('Persistent shell runtime version does not match its HTML cache key.');
}
if (!shell.includes(`const SETTINGS_LOCAL_ROUTE_VERSION='${expectedVersion}'`)) {
  fail('Persistent shell does not pin the canonical inert local-settings version.');
}
if (!shell.includes("const SETTINGS_LOCAL_ROUTE=`/app/settings-local-route-v325.js?v=${SETTINGS_LOCAL_ROUTE_VERSION}`")) {
  fail('Persistent shell does not load settings-local-route-v325.js as the canonical local-settings route.');
}
if (shell.includes("SETTINGS_LOCAL_ROUTE='/app/settings-local-route-v323.js")) {
  fail('Persistent shell still loads the legacy v323 path directly.');
}
if (!shell.includes("function settingsLocalRouteReady(){return globalThis.CivweaveSettingsLocalRouteV323?.version===SETTINGS_LOCAL_ROUTE_VERSION}")) {
  fail('Persistent shell does not reject stale already-loaded local-settings globals.');
}
if (!shell.includes('if(settingsLocalRouteReady()&&invoke())return true;')) {
  fail('Settings can still open before the canonical local-settings route is ready.');
}
if (!shell.includes("loadScript(SETTINGS_LOCAL_ROUTE,settingsLocalRouteReady,'Settings local-model view')")) {
  fail('Persistent shell does not refresh the canonical local-settings route before Settings opens.');
}
if (!route.includes(`const VERSION='${expectedVersion}'`)) {
  fail('Canonical v325 local-settings file version does not match the persistent-shell pin.');
}
if (route !== alias) {
  fail('v323 compatibility alias drifted from canonical v325 local-settings implementation.');
}
if (/const m=manager\(\);let all,selected;\s*if\(m\?\.state&&m\?\.selection\)/.test(route)) {
  fail('Canonical local-settings view still consults the live download manager during snapshot rendering.');
}

console.log('PASS persistent shell and its HTML cache boundary refresh the canonical inert local-model Settings route across all realms.');
