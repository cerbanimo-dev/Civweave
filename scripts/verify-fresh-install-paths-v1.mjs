import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [bridge,installer,manifestText,installedEntryHtml,installedEntryRuntime]=await Promise.all([
  read('public/app/pwa-install-prompt-v249.js'),
  read('public/install-v130.js'),
  read('public/app/manifest.webmanifest'),
  read('public/app/installed-entry-v146.html'),
  read('public/app/installed-entry-v146.js')
]);

const exactEntry='/app/installed-entry-v146.html?installed=1&system=civweave';
const staleInstallerEntry='/app/?system=civweave&installed=1';
const manifest=JSON.parse(manifestText);

assert.equal(manifest.start_url,'/app/installed-entry-v146.html?installed=1','fresh installed launches must use the exact installed-entry HTML');
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

assert.equal((installer.match(/location\.assign\(ENTRY\)/g)||[]).length,1,'fallback installer may navigate to ENTRY only from installed display, never after browser install acceptance');
assert.ok(installer.includes('this browser tab remains installer-only'),'accepted browser install must remain on the installer');
assert.ok(!installer.includes('Civweave installed. Opening the campus now'),'browser install acceptance must not jump directly into campus runtime');
assert.ok(!installer.includes('You can open the online campus immediately'),'installer guidance must not advertise retired browser runtime');

assert.ok(installedEntryHtml.includes("const installed=navigator.standalone===true"),'installed entry must prove installed display before booting');
assert.ok(installedEntryHtml.includes("location.replace(installer.href)"),'browser display of installed entry must fail closed to the installer');
assert.ok(installedEntryRuntime.includes("if(!installedDisplay()&&!localDeveloper())"),'installed runtime must re-check installed display');

console.log(JSON.stringify({
  ok:true,
  revision:'fresh-install-paths-v4-no-load-prewarm',
  exactEntry,
  shellPrimedBeforeClick:false,
  shellPreparationUserInitiated:true,
  promptSynchronousOnFreshClick:true,
  browserInstallStaysInstallerOnly:true,
  staleAppInstallerEntry:false
},null,2));
