import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [bridge,installer,manifestText,installedEntryHtml,installedEntryRuntime]=await Promise.all([
  read('public/app/pwa-install-prompt-v247.js'),
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
assert.ok(!installer.includes(`const ENTRY = '${staleInstallerEntry}';`),'fallback installer must never point installed launch back at /app/');

const bridgePrepare=bridge.indexOf('await installer.prepareShell({manual:true})');
const bridgeReadyGate=bridge.indexOf('if(!installer.shellReady)',bridgePrepare);
const bridgePrompt=bridge.indexOf('await prompt.prompt()',bridgePrepare);
assert.ok(bridgePrepare>=0,'native install bridge must prepare the lightweight shell');
assert.ok(bridgeReadyGate>bridgePrepare&&bridgeReadyGate<bridgePrompt,'native prompt must be gated on confirmed shell readiness');
assert.ok(bridgePrompt>bridgePrepare,'native prompt must open only after shell preparation');
assert.ok(bridge.includes("installSequencingPolicy:'prepare-shell-before-native-prompt'"),'bridge must publish its shell-first sequencing contract');

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
  revision:'fresh-install-paths-v1',
  exactEntry,
  shellFirst:true,
  browserInstallStaysInstallerOnly:true,
  staleAppInstallerEntry:false
},null,2));
