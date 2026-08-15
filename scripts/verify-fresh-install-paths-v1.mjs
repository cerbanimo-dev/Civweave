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

const primeStart=bridge.indexOf('async function primeInstallability()');
const primePrepare=bridge.indexOf('await shell.prepareShell({eager:true})',primeStart);
const installClickStart=bridge.indexOf('async function ownInstallClick(event)');
const installClickEnd=bridge.indexOf('function start()',installClickStart);
const installClick=bridge.slice(installClickStart,installClickEnd);
const promptCall=installClick.indexOf('prompt.prompt();');
const firstAwait=installClick.indexOf('await ');
const choiceAwait=installClick.indexOf('await prompt.userChoice',promptCall);

assert.ok(primeStart>=0&&primePrepare>primeStart,'front door must prepare the lightweight shell before the install gesture');
assert.ok(bridge.includes('queueMicrotask(()=>void primeInstallability())'),'front door must begin installability preparation after the installer controller has loaded');
assert.ok(promptCall>=0,'native install bridge must invoke the saved browser prompt');
assert.ok(firstAwait===choiceAwait&&promptCall<firstAwait,'native prompt must be invoked synchronously in the click handler before any await consumes the user gesture');
assert.ok(!installClick.includes('await shell.prepareShell'),'install click must never wait for service-worker preparation before prompting');
assert.ok(bridge.includes("installSequencingPolicy:'prepare-shell-before-user-install-gesture'"),'bridge must publish its gesture-safe shell sequencing contract');
assert.ok(bridge.includes("promptAvailabilityPolicy:'capture-beforeinstallprompt-then-prompt-synchronously-on-click'"),'bridge must publish its native prompt user-gesture contract');
assert.ok(bridge.includes('eagerShellPreparation:true'),'bridge must expose that the small shell is primed before install interaction');

assert.equal((installer.match(/location\.assign\(ENTRY\)/g)||[]).length,1,'fallback installer may navigate to ENTRY only from installed display, never after browser install acceptance');
assert.ok(installer.includes('this browser tab remains installer-only'),'accepted browser install must remain on the installer');
assert.ok(!installer.includes('Civweave installed. Opening the campus now'),'browser install acceptance must not jump directly into campus runtime');
assert.ok(!installer.includes('You can open the online campus immediately'),'installer guidance must not advertise retired browser runtime');

assert.ok(installedEntryHtml.includes("const installed=navigator.standalone===true"),'installed entry must prove installed display before booting');
assert.ok(installedEntryHtml.includes("location.replace(installer.href)"),'browser display of installed entry must fail closed to the installer');
assert.ok(installedEntryRuntime.includes("if(!installedDisplay()&&!localDeveloper())"),'installed runtime must re-check installed display');

console.log(JSON.stringify({
  ok:true,
  revision:'fresh-install-paths-v3-user-gesture-safe',
  exactEntry,
  shellPrimedBeforeClick:true,
  promptSynchronousOnClick:true,
  browserInstallStaysInstallerOnly:true,
  staleAppInstallerEntry:false
},null,2));
