import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const check=(condition,message)=>{if(!condition)throw new Error(message)};
const same=(actual,expected,label)=>check(actual===expected,`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`);
const version=(await read('VERSION')).trim();
check(/^\d+\.\d+\.\d+$/.test(version),'VERSION must contain a semantic release version.');

const [packageText,launcherHtml,manifestText,installerHtml,installRuntime,bootstrapWorker,installedEntryHtml,installedEntryRuntime,routes,nav,boundary,campusHtml,campusLoader,workerCore,workerWrapper,legacyWorker,integrityText,syncSource,headers]=await Promise.all([
  read('package.json'),read('public/index.html'),read('public/app/manifest.webmanifest'),read('public/app/index.html'),read('public/install-v130.js'),read('public/service-worker-install-v1.js'),read('public/app/installed-entry-v146.html'),read('public/app/installed-entry-v146.js'),read('public/app/system-routes-v227.js'),read('public/app/themed-system-nav-v178.js'),read('public/app/install-boundary-v146.js'),read('public/app/working-campus-v156.html'),read('public/app/working-campus-v156.js'),read('public/service-worker-core-v208.js'),read('public/service-worker-v203.js'),read('public/service-worker-v156.js'),read('public/app/shell-integrity-v281.json'),read('scripts/sync-release-version-assets.mjs'),read('public/_headers')
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
  [installerHtml,'Civweave installs in two local stages. The campus is required;','local-first installer headline'],
  [installRuntime,`const VERSION='${version}';`,'installer runtime'],
  [installRuntime,"BOOTSTRAP_BUILD='installer-bootstrap-v1-local-first'",'local-first bootstrap revision'],
  [installRuntime,'ensureLocalPackage','required local package gate'],
  [bootstrapWorker,'offlinePackageOptional: false','required local campus status'],
  [bootstrapWorker,'localCampusRequiredForLaunch: true','required local campus launch gate'],
  [bootstrapWorker,'runtimeNetworkFallback: false','bootstrap cache-only runtime'],
  [installedEntryHtml,`/app/installed-entry-v146.js?v=${version}`,'installed entry HTML'],
  [installedEntryHtml,'installed-entry-browser-gate-v1','installed entry pre-paint gate'],
  [installedEntryRuntime,`const FALLBACK_VERSION='${version}';`,'installed entry runtime'],
  [installedEntryRuntime,"browserRuntimePolicy:'installed-display-cache-only'",'installed entry local-first browser boundary'],
  [installedEntryRuntime,'allowProvision:localDeveloper()','production no implicit worker provision'],
  [routes,`const VERSION='${version}';`,'route contract'],
  [nav,`const VERSION='${version}-five-system-navigation-v227';`,'themed navigation'],
  [boundary,`const VERSION='${version}';`,'install boundary'],
  [boundary,"const REVISION='browser-install-boundary-v228-chat-escape-install-only-pwa-v1';",'install-only boundary revision'],
  [boundary,"browserRuntimePolicy:'installed-display-only'",'browser install boundary policy'],
  [campusHtml,`Civweave Working Campus · v${version}`,'Working Campus title'],
  [campusHtml,`<b class="version-chip">v${version}</b>`,'Working Campus chip'],
  [campusLoader,`system-routes-v227.js?v=${version}-five-system-route-contract-v227`,'Working Campus route loader'],
  [workerCore,`const VERSION = '${version}';`,'service-worker core'],
  [workerWrapper,`system-routes-v227.js?v=${version}-five-system-route-contract-v227`,'worker route import'],
  [workerWrapper,`service-worker-core-v208.js?v=${version}-chat-convergence-v250-installer-brand-v1-working-campus-return-v425-install-only-pwa-v1`,'worker core import'],
  [workerWrapper,'service-worker-shell-repair-v225.js?v=shell-self-repair-v225-install-only-pwa-v1-local-first','local-first shell repair import'],
  [workerWrapper,'service-worker-release-coherence-v220.js?v=release-coherence-v226-local-first','local-first release coherence import'],
  [workerWrapper,'service-worker-canonical-navigation-v227.js?v=canonical-five-system-navigation-v227-local-first','local-first canonical navigation import'],
  [legacyWorker,`service-worker-v203.js?v=${version}-code-coherence-v288-lightweight-shell-v208-legacy-v156-bridge-v209-working-campus-return-v425`,'legacy worker bridge']
];
for(const [source,token,label] of required)check(source.includes(token),`${label} is not synchronized to Civweave ${version}: missing ${token}`);

check(!installerHtml.includes('open-online-campus-v225'),'Installer still exposes the retired browser fallback.');
check(!installerHtml.includes('/app/installer-online-fallback-v225.js'),'Installer still loads the retired browser fallback runtime.');
check(workerCore.includes("const BUILD = 'lightweight-shell-v208-installer-brand-v1-working-campus-return-v425';"),'Service-worker core cache epoch lost the Working Campus return repair.');
check(workerCore.includes("'/app/working-campus-return-guard-v425.js'"),'Service-worker shell no longer precaches the Working Campus return guard.');
check(campusHtml.includes('/app/working-campus-return-guard-v425.js?v=working-campus-return-v425'),'Working Campus does not load the return guard.');
check(campusHtml.indexOf('/app/working-campus-return-guard-v425.js')<campusHtml.indexOf('/app/install-boundary-v146.js'),'Working Campus return guard must load before the install boundary.');
check(headers.includes('/app/install-boundary-v146.js\n  Cache-Control: no-cache'),'Install boundary must revalidate during an explicit update/package transaction.');
check(headers.includes('/app/installed-entry-v146.html\n  Cache-Control: no-cache'),'Installed entry HTML update source must remain revalidatable during explicit package acquisition.');
check(integrity.version===version&&workerCore.includes(`const VERSION = '${integrity.version}';`),'Worker core and shell-integrity manifest are release-incoherent.');

for(const token of [
  'Civweave installs in two local stages',
  'browser-install-boundary-v228-chat-escape-install-only-pwa-v1',
  'working-campus-return-v425-install-only-pwa-v1',
  'shell-self-repair-v225-install-only-pwa-v1-local-first',
  "'/app/working-campus-return-guard-v425.js'",
  'localFirstInstaller'
])check(syncSource.includes(token),`Release synchronizer would erase the local-first install contract: missing ${token}`);

console.log(JSON.stringify({ok:true,version,committedTreeVerified:true,verifierMutation:false,shellIntegrityCoherent:true,workingCampusReturnGuard:'v425',browserRuntime:'installed-display-cache-only',localCampusRequiredForLaunch:true,runtimeNetworkFallback:false,installOnlyPwa:'v1',updateSourcesRevalidateOnlyDuringExplicitAcquisition:true},null,2));
