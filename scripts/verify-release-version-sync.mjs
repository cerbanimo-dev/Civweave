import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

await import('./sync-release-version-assets.mjs');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const check=(condition,message)=>{if(!condition)throw new Error(message)};
const same=(actual,expected,label)=>check(actual===expected,`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`);
const [
  versionText,
  packageText,
  launcherHtml,
  manifestText,
  installRuntime,
  installerHtml,
  installedEntryHtml,
  installedEntryRuntime,
  routes,
  nav,
  installBoundary,
  releaseRuntime,
  workerCore,
  workerWrapper,
  legacyWorker,
  gateway,
  localServer,
  workingCampus,
  campusLoader,
  campusPart4,
  syncSource
]=await Promise.all([
  read('VERSION'),
  read('package.json'),
  read('public/index.html'),
  read('public/app/manifest.webmanifest'),
  read('public/install-v130.js'),
  read('public/app/index.html'),
  read('public/app/installed-entry-v146.html'),
  read('public/app/installed-entry-v146.js'),
  read('public/app/system-routes-v227.js'),
  read('public/app/themed-system-nav-v178.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/release-version-v1.js'),
  read('public/service-worker-core-v208.js'),
  read('public/service-worker-v203.js'),
  read('public/service-worker-v156.js'),
  read('server-gateway-v131.mjs'),
  read('server-local-v131.mjs'),
  read('public/app/working-campus-v156.html'),
  read('public/app/working-campus-v156.js'),
  read('public/app/working-campus-v156.part4.txt'),
  read('scripts/sync-release-version-assets.mjs')
]);
const version=versionText.trim(),pkg=JSON.parse(packageText),manifest=JSON.parse(manifestText);
check(/^\d+\.\d+\.\d+$/.test(version),'VERSION must contain a semantic release version.');
same(pkg.version,version,'package.json version');
for(const token of [
  '<title>Civweave</title>',
  `/app/civweave-brand.js?v=${version}`,
  `/app/installed-entry-v146.js?v=${version}`,
  '/app/index.html'
])check(launcherHtml.includes(token),`public/index.html is missing ${token}`);
for(const token of [
  `<title>Install Civweave v${version}</title>`,
  `<span class="version">v${version}</span>`,
  `Install Civweave v${version}. The campus downloads automatically.`,
  `/app/manifest.webmanifest?v=${version}`,
  `/service-worker-v203.js?v=${version}-lightweight-shell-v208`,
  `/install-v130.js?v=${version}-lightweight-shell-v208`
])check(installerHtml.includes(token),`public/app/index.html is missing ${token}`);
same(manifest.name,`Civweave v${version}`,'manifest name');
same(new URL(manifest.start_url,'https://civweave.invalid').searchParams.get('version'),version,'manifest start URL version');
check(installRuntime.includes(`const VERSION = '${version}';`),'Installer runtime is stale.');
check(installedEntryHtml.includes(`/app/installed-entry-v146.js?v=${version}`),'Installed entry HTML is stale.');
check(installedEntryRuntime.includes("new URL('/app/index.html',location.origin)"),'Browser launcher does not target the real installer.');
check(installedEntryRuntime.includes("installer.searchParams.set('install','required')"),'Browser launcher does not preserve the install-required marker.');
check(routes.includes(`const VERSION='${version}';`),'Five-system route contract version is stale.');
for(const pathname of ['/app/working-campus-v156.html','/app/cabinets/living-school/index.html','/app/realm-console-v140.html','/app/fellowfare-cabinet-v144.html','/app/anarchadia-console-v139.html'])check(routes.includes(`pathname:'${pathname}'`),`Route contract is missing ${pathname}.`);
check(nav.includes(`const VERSION='${version}-five-system-navigation-v227';`),'Themed navigation version is stale.');
check(nav.includes('ROUTES.navigate'),'Themed navigation bypasses the route contract.');
check(workerCore.includes(`const VERSION = '${version}';`),'Service-worker core version is stale.');
check(workerWrapper.includes(`/app/system-routes-v227.js?v=${version}-five-system-route-contract-v227`),'Worker route contract revision is stale.');
check(workerWrapper.includes(`/service-worker-core-v208.js?v=${version}-lightweight-shell-v208-retained-v218`),'Worker core revision is stale.');
check(workerWrapper.indexOf('/service-worker-canonical-navigation-v227.js')>workerWrapper.indexOf('/service-worker-shell-repair-v225.js'),'Canonical navigation is not the final worker policy.');
check(legacyWorker.includes(`/service-worker-v203.js?v=${version}-lightweight-shell-v208-legacy-v156-bridge-v209`),'Legacy worker bridge is stale.');
for(const token of [
  `const VERSION='${version}';`,
  "const INSTALLER='/app/index.html';",
  `const ADDITIONS_VERSION='v${version}-canonical-core-only-v226';`,
  `version:'${version}'`,
  "'/app/system-routes-v227.js'",
  "canonicalPolicy:'five-system-first-class-routes-civweave-core-only'",
  'canonicalSystemCount:5',
  'canonicalAutoScripts:0'
])check(installBoundary.includes(token),`Install boundary is missing ${token}.`);
check(!installBoundary.includes("const RELEASE_VERSION_SCRIPT='/app/release-version-v1.js';")&&!installBoundary.includes('addScript(RELEASE_VERSION_SCRIPT)'),'Install boundary reintroduced the retired canonical version loader.');
check(releaseRuntime.includes("fetch('/app/manifest.webmanifest'")&&releaseRuntime.includes("querySelectorAll('.version,.version-chip,[data-civweave-version]')"),'Visible-version synchronizer is incomplete.');
check(gateway.includes(`const VERSION = '${version}-render-installed-runtime-v132';`),'Gateway wrapper version is stale.');
check(localServer.includes(`"const VERSION = '${version}';"`)&&localServer.includes(`?build=${version}`),'Local server version is stale.');
check(workingCampus.includes(`Civweave Working Campus · v${version}`)&&workingCampus.includes(`<b class="version-chip">v${version}</b>`),'Working Campus visible release is stale.');
check(campusLoader.includes(`system-routes-v227.js?v=${version}-five-system-route-contract-v227`),'Working Campus route loader version is stale.');
check(campusPart4.includes(`version:'${version}'`),'Working Campus realm travel version is stale.');
for(const token of [
  "await patch('public/index.html'",
  "await patch('public/app/index.html'",
  "await patch('public/app/system-routes-v227.js'",
  "await patch('public/app/themed-system-nav-v178.js'",
  "await patch('public/app/working-campus-v156.js'",
  "await patch('public/app/working-campus-v156.part4.txt'",
  'launcher entry revision',
  'installer title',
  'worker route contract revision',
  'five-system route version'
])check(syncSource.includes(token),`Release synchronizer is missing ${token}.`);
for(const [label,source] of [
  ['launcher',launcherHtml],
  ['installer',installerHtml],
  ['manifest',manifestText],
  ['installer runtime',installRuntime],
  ['installed entry HTML',installedEntryHtml],
  ['installed entry runtime',installedEntryRuntime],
  ['route contract',routes],
  ['navigation',nav],
  ['boundary',installBoundary],
  ['worker core',workerCore],
  ['worker wrapper',workerWrapper],
  ['legacy worker',legacyWorker],
  ['working campus',workingCampus],
  ['campus loader',campusLoader],
  ['campus travel',campusPart4]
]){
  const pattern=new RegExp(`(?:(?:Civweave|Civweave) v|const VERSION = '|const VERSION='|version:'|version=)(\\d+\\.\\d+\\.\\d+)`,'g');
  for(const match of source.matchAll(pattern))if(match[1]!==version)throw new Error(`${label} still exposes ${match[1]} instead of ${version}.`);
}
console.log(JSON.stringify({ok:true,version,packageVersion:pkg.version,canonicalSystems:5,routeMatrixVersioned:true,workerPackageNavigation:true,canonicalCoreOnly:true,legacyCompatibility:true,gatewayVersion:true,localVersion:true,buildTimeSynchronization:true,browserInstallerLoopGuard:true},null,2));
