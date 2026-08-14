import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Read-only by design. This file must never import either release synchronizer.
// CI needs to inspect the committed tree exactly as users receive it.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const check=(condition,message)=>{if(!condition)throw new Error(message)};
const same=(actual,expected,label)=>check(actual===expected,`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`);
const version=(await read('VERSION')).trim();
check(/^\d+\.\d+\.\d+$/.test(version),'VERSION must contain a semantic release version.');

const [
  packageText,
  launcherHtml,
  manifestText,
  installerHtml,
  installRuntime,
  installedEntryHtml,
  installedEntryRuntime,
  routes,
  nav,
  boundary,
  campusHtml,
  campusLoader,
  workerCore,
  workerWrapper,
  legacyWorker,
  integrityText,
  syncSource
]=await Promise.all([
  read('package.json'),
  read('public/index.html'),
  read('public/app/manifest.webmanifest'),
  read('public/app/index.html'),
  read('public/install-v130.js'),
  read('public/app/installed-entry-v146.html'),
  read('public/app/installed-entry-v146.js'),
  read('public/app/system-routes-v227.js'),
  read('public/app/themed-system-nav-v178.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/working-campus-v156.html'),
  read('public/app/working-campus-v156.js'),
  read('public/service-worker-core-v208.js'),
  read('public/service-worker-v203.js'),
  read('public/service-worker-v156.js'),
  read('public/app/shell-integrity-v281.json'),
  read('scripts/sync-release-version-assets.mjs')
]);

const pkg=JSON.parse(packageText),manifest=JSON.parse(manifestText),integrity=JSON.parse(integrityText);
same(pkg.version,version,'package.json version');
same(manifest.name,`Civweave v${version}`,'manifest name');
same(new URL(manifest.start_url,'https://civweave.invalid').pathname,'/app/installed-entry-v146.html','manifest installed entry');
same(integrity.version,version,'shell integrity manifest version');

const required=[
  [launcherHtml,`/app/civweave-brand.js?v=${version}`,'root launcher brand revision'],
  [launcherHtml,`/app/installed-entry-v146.js?v=${version}`,'root launcher installed-entry revision'],
  [installerHtml,`<title>Install Civweave v${version}</title>`,'installer title'],
  [installRuntime,`const VERSION = '${version}';`,'installer runtime'],
  [installedEntryHtml,`/app/installed-entry-v146.js?v=${version}`,'installed entry HTML'],
  [installedEntryRuntime,`const FALLBACK_VERSION='${version}';`,'installed entry runtime'],
  [routes,`const VERSION='${version}';`,'route contract'],
  [nav,`const VERSION='${version}-five-system-navigation-v227';`,'themed navigation'],
  [boundary,`const VERSION='${version}';`,'install boundary'],
  [campusHtml,`Civweave Working Campus · v${version}`,'Working Campus title'],
  [campusHtml,`<b class="version-chip">v${version}</b>`,'Working Campus chip'],
  [campusLoader,`system-routes-v227.js?v=${version}-five-system-route-contract-v227`,'Working Campus route loader'],
  [workerCore,`const VERSION = '${version}';`,'service-worker core'],
  [workerWrapper,`system-routes-v227.js?v=${version}-five-system-route-contract-v227`,'worker route import'],
  [workerWrapper,`service-worker-core-v208.js?v=${version}-chat-convergence-v250-installer-brand-v1-working-campus-return-v425-install-only-pwa-v1`,'worker core import'],
  [legacyWorker,`service-worker-v203.js?v=${version}-code-coherence-v288-lightweight-shell-v208-legacy-v156-bridge-v209-working-campus-return-v425`,'legacy worker bridge']
];
for(const [source,token,label] of required)check(source.includes(token),`${label} is not synchronized to Civweave ${version}: missing ${token}`);

check(workerCore.includes("const BUILD = 'lightweight-shell-v208-installer-brand-v1-working-campus-return-v425';"),'Service-worker cache epoch does not include the Working Campus return repair.');
check(workerCore.includes("'/app/working-campus-return-guard-v425.js'"),'Service-worker shell no longer precaches the Working Campus return guard.');
check(campusHtml.includes('/app/working-campus-return-guard-v425.js?v=working-campus-return-v425'),'Working Campus does not load the return guard.');
check(campusHtml.indexOf('/app/working-campus-return-guard-v425.js')<campusHtml.indexOf('/app/document-lifecycle-v221.js'),'Working Campus return guard must load before lifecycle teardown listeners.');
check(campusHtml.indexOf('/app/working-campus-return-guard-v425.js')<campusHtml.indexOf('/app/install-boundary-v146.js'),'Working Campus return guard must load before the install boundary.');
check(campusHtml.includes('/app/install-boundary-v146.js?v=chat-convergence-v250-navigation-lifecycle-v424')||campusHtml.includes('/app/install-boundary-v146.js?v=chat-convergence-v250-navigation-lifecycle-v424-install-only-pwa-v1'),'Working Campus boundary cache identity regressed.');
check(boundary.includes("const REVISION='chat-convergence-v250-navigation-lifecycle-v424-install-only-pwa-v1';"),'Install boundary lost the installed-display-only cache identity.');
check(boundary.includes("function allowed(){return installedDisplay()||developer()}"),'Install boundary once again permits browser runtime.');
check(integrity.version===version&&workerCore.includes(`const VERSION = '${integrity.version}';`),'Worker core and shell-integrity manifest are release-incoherent; this would prevent the replacement worker from installing.');

for(const token of [
  'working-campus-return-v425',
  'install-only-pwa-v1',
  "const BUILD = 'lightweight-shell-v208-installer-brand-v1-working-campus-return-v425';",
  "'/app/working-campus-return-guard-v425.js'",
  'service-worker-core-v208.js?v=${version}-chat-convergence-v250-installer-brand-v1-working-campus-return-v425-install-only-pwa-v1',
  'service-worker-v203.js?v=${version}-code-coherence-v288-lightweight-shell-v208-legacy-v156-bridge-v209-working-campus-return-v425'
])check(syncSource.includes(token),`Release synchronizer would erase the return/install-only repair: missing ${token}`);

console.log(JSON.stringify({
  ok:true,
  version,
  committedTreeVerified:true,
  verifierMutation:false,
  shellIntegrityCoherent:true,
  workingCampusReturnGuard:'v425',
  navigationLifecycle:'v424-install-only-pwa-v1',
  browserRuntime:false,
  workerCacheRefresh:'install-only-pwa-v1',
  workerCacheEpoch:'working-campus-return-v425'
},null,2));