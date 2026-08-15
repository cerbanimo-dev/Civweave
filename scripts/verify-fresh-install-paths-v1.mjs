import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [bridge,installer,manifestText,installedEntryHtml,installedEntryRuntime,boundary]=await Promise.all([
  read('public/app/pwa-install-prompt-v250.js'),
  read('public/install-v130.js'),
  read('public/app/manifest.webmanifest'),
  read('public/app/installed-entry-v146.html'),
  read('public/app/installed-entry-v146.js'),
  read('public/app/install-boundary-v146.js')
]);

const exactEntry='/app/installed-entry-v146.html?installed=1&system=civweave';
const staleInstallerEntry='/app/?system=civweave&installed=1';
const manifest=JSON.parse(manifestText);

assert.equal(manifest.start_url,'/app/installed-entry-v146.html?installed=1','fresh installed launches must use the exact installed-entry HTML');
assert.equal(manifest.launch_handler?.client_mode,'navigate-new','installed launches must produce a dedicated PWA launch event');
assert.ok(bridge.includes(`const ENTRY='${exactEntry}'`),'front-door bridge must use the exact installed entry');
assert.ok(installer.includes(`const ENTRY = '${exactEntry}';`),'fallback installer must use the exact installed entry');
assert.ok(!bridge.includes(`const ENTRY='${staleInstallerEntry}'`),'front-door bridge must never point installed launch back at /app/');
assert.ok(!installer.includes(`const ENTRY = '${staleInstallerEntry}'`),'fallback installer must never point installed launch back at /app/');

const prepareStart=bridge.indexOf('async function prepareAfterInteraction');
const prepareCall=bridge.indexOf('await shell.prepareShell({manual:true})',prepareStart);
const installClickStart=bridge.indexOf('async function ownInstallClick(event)');
const installClickEnd=bridge.indexOf("if(hostSetupRedirect())return;",installClickStart);
const installClick=bridge.slice(installClickStart,installClickEnd);
const promptCall=installClick.indexOf('prompt.prompt();');
const choiceAwait=installClick.indexOf('await prompt.userChoice',promptCall);
const shellAwait=installClick.indexOf('await shell.prepareShell');

assert.ok(prepareStart>=0&&prepareCall>prepareStart,'front door must prepare the lightweight shell only after explicit install interaction');
assert.ok(!bridge.includes('queueMicrotask(()=>void primeInstallability())'),'front door must never prewarm the app shell during first paint');
assert.ok(!bridge.includes('async function primeInstallability()'),'front door must not retain a load-time shell-preparation path');
assert.ok(promptCall>=0,'native install bridge must invoke the saved browser prompt');
assert.ok(choiceAwait>promptCall,'native prompt must be invoked synchronously in the fresh click handler before awaiting the browser choice');
assert.equal(shellAwait,-1,'fresh install click must never wait for service-worker preparation before prompting');
assert.ok(bridge.includes("installSequencingPolicy:'prepare-on-first-install-interaction-then-prompt-on-fresh-gesture'"),'bridge must publish its two-phase user-gesture-safe install contract');
assert.ok(bridge.includes("promptAvailabilityPolicy:'capture-beforeinstallprompt-then-prompt-synchronously-on-fresh-click'"),'bridge must publish its native prompt user-gesture contract');
assert.ok(bridge.includes('eagerShellPreparation:false'),'bridge must explicitly forbid eager shell preparation');
assert.ok(bridge.includes('firstPaintShellWork:false'),'bridge must explicitly forbid first-paint shell work');
assert.ok(bridge.includes('eagerRelatedAppDiscovery:false'),'bridge must keep related-app discovery off first paint');
assert.ok(bridge.includes('cacheDistinctPath:true'),'bridge must escape old service-worker cache entries by pathname');

assert.equal((installer.match(/location\.assign\(ENTRY\)/g)||[]).length,1,'fallback installer may navigate to ENTRY only from installed display, never after browser install acceptance');
assert.ok(installer.includes('this browser tab remains installer-only'),'accepted browser install must remain on the installer');
assert.ok(!installer.includes('Civweave installed. Opening the campus now'),'browser install acceptance must not jump directly into campus runtime');
assert.ok(!installer.includes('You can open the online campus immediately'),'installer guidance must not advertise retired browser runtime');

assert.ok(installedEntryHtml.includes("const LAUNCH_SESSION_KEY='civweave.pwa.launch-session.v1'"),'installed entry must use a session-scoped PWA launch authorization');
assert.ok(installedEntryHtml.includes('globalThis.launchQueue.setConsumer'),'installed entry must consume the browser PWA launch event when display mode is misreported');
assert.ok(installedEntryHtml.includes("sessionStorage.setItem(LAUNCH_SESSION_KEY,'1')"),'PWA launch authorization must remain session-scoped');
assert.ok(installedEntryHtml.includes("if(params.get('installed')!=='1')return false"),'installed entry query must not authorize arbitrary browser navigation');
assert.ok(installedEntryHtml.includes('location.replace(installer.href)'),'browser display without installed proof must fail closed to the installer');
assert.ok(installedEntryRuntime.includes('async function installedLaunchAuthorized()'),'installed runtime must re-check launch authorization before booting');
assert.ok(installedEntryRuntime.includes("browserRuntimePolicy:'installed-display-or-pwa-launch-session'"),'installed runtime must accept only installed display or PWA launch session');
assert.ok(boundary.includes('function allowed(){return installedDisplay()||launchSession()||developer()}'),'Working Campus must preserve the same installed-display-or-launch-session boundary');
assert.ok(boundary.includes('installedQueryIsAuthorization:false'),'Working Campus must keep installed=1 non-authorizing');
assert.ok(!boundary.includes('civweave.pwa.installed-capability.v1'),'fresh-install path must not restore a durable browser-visible runtime capability');

console.log(JSON.stringify({
  ok:true,
  revision:'fresh-install-paths-v6-pwa-launch-session-v1',
  exactEntry,
  shellPrimedBeforeClick:false,
  shellPreparationUserInitiated:true,
  promptSynchronousOnFreshClick:true,
  cacheDistinctPath:true,
  browserInstallStaysInstallerOnly:true,
  pwaLaunchSession:true,
  installedQueryAuthorization:false,
  staleAppInstallerEntry:false
},null,2));