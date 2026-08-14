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

const bridgePrepare=bridge.indexOf('await installer.prepareShell({manual:true})');
const bridgeReadyGate=bridge.indexOf('if(!installer.shellReady)',bridgePrepare);
const bridgePromptWait=bridge.indexOf('const prompt=promptEvent||await waitForPrompt()',bridgeReadyGate);
const bridgePrompt=bridge.indexOf('await prompt.prompt()',bridgePromptWait);
assert.ok(bridgePrepare>=0,'native install bridge must prepare the lightweight shell');
assert.ok(bridgeReadyGate>bridgePrepare,'native prompt must be gated on confirmed shell readiness');
assert.ok(bridgePromptWait>bridgeReadyGate,'bridge must wait for beforeinstallprompt only after the shell is ready');
assert.ok(bridgePrompt>bridgePromptWait,'native prompt must open only after shell preparation and prompt availability');
assert.ok(!bridge.slice(0,bridgePrepare).includes('if(!prompt)'),'front-door bridge must never require a prompt before preparing the shell');
assert.ok(bridge.includes("installSequencingPolicy:'prepare-shell-before-native-prompt'"),'bridge must publish its shell-first sequencing contract');
assert.ok(bridge.includes("promptAvailabilityPolicy:'prepare-shell-then-wait-for-beforeinstallprompt'"),'bridge must publish the no-deadlock prompt availability contract');
assert.ok(bridge.includes('navigator.getInstalledRelatedApps()'),'related-app discovery must remain available after install');
assert.ok(bridge.includes('eagerRelatedAppDiscovery:false'),'related-app discovery must be explicitly non-eager');
assert.ok(bridge.includes('firstInputSafe:true'),'front-door bridge must declare first-input safety');
assert.ok(!bridge.includes("DOMContentLoaded',()=>{observeButton();discoverRelatedInstalls()"),'desktop installer must not call native installed-app discovery before user input');

const fallbackPrepare=installer.indexOf('await prepareShell({ manual: true });');
const fallbackPrompt=installer.indexOf('await prompt.prompt();',fallbackPrepare);
assert.ok(fallbackPrepare>=0&&fallbackPrompt>fallbackPrepare,'fallback installer must also prepare the shell before prompting');
assert.equal((installer.match(/location\.assign\(ENTRY\)/g)||[]).length,1,'fallback installer may navigate to ENTRY only from installed display, never after browser install acceptance');
assert.ok(installer.includes('this browser tab remains installer-only'),'accepted browser install must remain on the installer');
assert.ok(!installer.includes('Civweave installed. Opening the campus now'),'browser install acceptance must not jump directly into campus runtime');
assert.ok(!installer.includes('You can open the online campus immediately'),'installer guidance must not advertise retired browser runtime');

assert.ok(installedEntryHtml.includes("const installed=navigator.standalone===true"),'installed entry must prove installed display before booting');
assert.ok(installedEntryHtml.includes("location.replace(installer.href)"),'browser display of installed entry must fail closed to the installer');
assert.ok(installedEntryRuntime.includes("if(!installedDisplay()&&!localDeveloper())"),'installed runtime must re-check installed display');

console.log(JSON.stringify({
  ok:true,
  revision:'fresh-install-paths-v3-first-input-safe',
  exactEntry,
  shellFirst:true,
  waitsForPromptAfterShell:true,
  relatedAppDiscovery:'post-install-only',
  firstInputSafe:true,
  browserInstallStaysInstallerOnly:true,
  staleAppInstallerEntry:false
},null,2));
