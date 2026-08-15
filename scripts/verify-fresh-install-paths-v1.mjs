import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [installer,bootstrap,manifestText,installedEntryHtml,installedEntryRuntime]=await Promise.all([
  read('public/install-v130.js'),
  read('public/service-worker-install-v1.js'),
  read('public/app/manifest.webmanifest'),
  read('public/app/installed-entry-v146.html'),
  read('public/app/installed-entry-v146.js')
]);

const exactEntry='/app/installed-entry-v146.html?installed=1&system=civweave';
const staleInstallerEntry='/app/?system=civweave&installed=1';
const manifest=JSON.parse(manifestText);

assert.equal(manifest.start_url,'/app/installed-entry-v146.html?installed=1','fresh installed launches must use the exact installed-entry HTML');
assert.ok(installer.includes(`const ENTRY='${exactEntry}';`),'installer must use the exact installed entry');
assert.ok(!installer.includes(staleInstallerEntry),'installer must never point installed launch back at /app/');
assert.ok(bootstrap.includes('localCampusRequiredForLaunch: true'),'bootstrap must declare the local campus required before launch');
assert.ok(bootstrap.includes('offlinePackageOptional: false'),'required campus must not be mislabeled optional');
assert.ok(bootstrap.includes('runtimeNetworkFallback: false'),'bootstrap runtime must fail closed instead of using the network');

const installFunction=installer.slice(installer.indexOf('async function installOrOpen()'),installer.indexOf("addEventListener('beforeinstallprompt'"));
const packageGate=installFunction.indexOf('await ensureLocalPackage()');
const prompt=installFunction.indexOf('await prompt.prompt()');
assert.ok(packageGate>=0,'fresh installation must verify the complete local package');
assert.ok(prompt>packageGate,'native install prompt must open only after the local campus package is ready');
assert.ok(installer.includes("BOOTSTRAP_BUILD='installer-bootstrap-v1-local-first'"),'fresh install must begin with the local-first bootstrap shell');
assert.ok(installer.includes("'x-civweave-package':'campus-preflight'"),'campus acquisition must be explicitly marked as package installation');
assert.ok(installer.includes('Installation will wait rather than fall back to an online runtime.'),'incomplete local package must block installation rather than create a thin client');
assert.equal((installer.match(/location\.assign\(ENTRY\)/g)||[]).length,1,'installer may navigate to ENTRY only from installed display');
assert.ok(!installer.includes('You can open the online campus immediately'),'installer guidance must never advertise an online runtime substitute');

assert.ok(installedEntryHtml.includes("const installed=navigator.standalone===true"),'installed entry must prove installed display before booting');
assert.ok(installedEntryHtml.includes('location.replace(installer.href)'),'browser display of installed entry must fail closed to the installer');
assert.ok(installedEntryRuntime.includes('if(!installedDisplay()&&!localDeveloper())'),'installed runtime must re-check installed display');
assert.ok(installedEntryRuntime.includes("browserRuntimePolicy:'installed-display-cache-only'"),'installed runtime must remain cache-only');
assert.ok(installedEntryRuntime.includes('allowProvision:localDeveloper()'),'production installed runtime must not implicitly provision missing code');

console.log(JSON.stringify({
  ok:true,
  revision:'fresh-install-paths-v3-local-package-first',
  exactEntry,
  bootstrapFirst:true,
  localCampusRequired:true,
  nativePromptAfterLocalPackage:true,
  runtimeNetworkFallback:false,
  browserInstallStaysInstallerOnly:true,
  staleAppInstallerEntry:false
},null,2));
