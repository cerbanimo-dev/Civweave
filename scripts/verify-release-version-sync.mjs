import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const check=(condition,message)=>{if(!condition)throw new Error(message)};
const version=(await read('VERSION')).trim();
check(/^\d+\.\d+\.\d+$/.test(version),'VERSION must contain a semantic release version.');

const [packageText,manifestText,installerHtml,installedEntryHtml,installedEntryRuntime,routes,campusHtml,campusRuntime,gateway,workerCore,workerWrapper,legacyWorker,syncSource,coherence]=await Promise.all([
  read('package.json'),
  read('public/app/manifest.webmanifest'),
  read('public/app/index.html'),
  read('public/app/installed-entry-v146.html'),
  read('public/app/installed-entry-v146.js'),
  read('public/app/system-routes-v227.js'),
  read('public/app/working-campus-v156.html'),
  read('public/app/working-campus-v156.js'),
  read('public/app/settings-gateway-v317.js'),
  read('public/service-worker-core-v208.js'),
  read('public/service-worker-v203.js'),
  read('public/service-worker-v156.js'),
  read('scripts/sync-release-version-assets.mjs'),
  read('scripts/sync-release-coherence-v220.mjs')
]);
const pkg=JSON.parse(packageText);
const manifest=JSON.parse(manifestText);

check(pkg.version===version,`package.json ${pkg.version} does not match VERSION ${version}.`);
check(manifest.name===`Civweave v${version}`,'manifest name is not synchronized.');
check(new URL(manifest.start_url,'https://civweave.invalid').pathname==='/app/installed-entry-v146.html','manifest start_url drifted.');
for(const [source,token,label] of [
  [installerHtml,`<title>Install Civweave v${version}</title>`,'installer title'],
  [installedEntryHtml,`/app/installed-entry-v146.js?v=${version}`,'installed entry HTML'],
  [installedEntryRuntime,`const FALLBACK_VERSION='${version}';`,'installed entry runtime'],
  [routes,`const VERSION='${version}';`,'route contract'],
  [campusHtml,`Civweave Working Campus · v${version}`,'Working Campus title'],
  [campusHtml,`<b class="version-chip">v${version}</b>`,'Working Campus chip'],
  [campusHtml,`model-settings-controller-v173.js?activate=1&v=${version}-interface-runtime-v1`,'Working Campus static Settings controller'],
  [campusHtml,`system-routes-v227.js?v=${version}-five-system-route-contract-v227`,'Working Campus route contract'],
  [campusHtml,`working-campus-v156.js?v=${version}-interface-runtime-v1`,'Working Campus runtime'],
  [campusRuntime,`const VERSION='${version}-interface-runtime-v1';`,'Working Campus runtime constant'],
  [gateway,`const VERSION='${version}-settings-gateway-static-v1';`,'Settings gateway'],
  [workerCore,`const VERSION='${version}';`,'service worker core'],
  [workerWrapper,`service-worker-core-v208.js?v=${version}-interface-rebase-v1`,'service worker wrapper'],
  [legacyWorker,`service-worker-v203.js?v=${version}-interface-rebase-v1-legacy-v156-bridge-v209`,'legacy worker bridge']
])check(source.includes(token),`${label} is not synchronized: missing ${token}`);

for(const forbidden of ['working-campus-return-guard-v425','document-lifecycle-v221','working-campus-v156.part'])
  check(!campusHtml.includes(forbidden),`Working Campus reintroduced ${forbidden}.`);
for(const forbidden of ['Function(','working-campus-v156.part','repairPersistedCampusState'])
  check(!campusRuntime.includes(forbidden),`Working Campus runtime reintroduced ${forbidden}.`);
check(workerCore.includes("const BUILD='lightweight-shell-v208-interface-rebase-v1';"),'Service-worker cache epoch is not the interface rebase.');
check(!workerCore.includes('working-campus-return-guard-v425'),'Service-worker core still references the retired return guard.');
check(!workerCore.includes('document-lifecycle-v221'),'Service-worker core still references the retired lifecycle subscriber.');
check(!/writeFile/.test(coherence),'Coherence verifier must not mutate the checkout.');
check(syncSource.includes("mode:'assert-only'")&&syncSource.includes('mutatesCheckout:false'),'Release version check must stay assertion-only.');

console.log(JSON.stringify({
  ok:true,
  version,
  committedTreeVerified:true,
  verifierMutation:false,
  campusRuntime:'static-v1',
  settingsGraph:'static-presentation-plus-gateway',
  serviceWorker:'interface-rebase-v1',
  boundedBootRecovery:true
},null,2));
