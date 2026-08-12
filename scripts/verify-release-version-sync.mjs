import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

await import('./sync-release-version-assets.mjs');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const canonicalVersion=(await read('VERSION')).trim();
const check=(condition,message)=>{if(!condition)throw new Error(message)};
const same=(actual,expected,label)=>check(actual===expected,`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`);
const versionConst=(source,suffix='')=>new RegExp(`const\\s+VERSION\\s*=\\s*['"]([^'"]+)['"]`).exec(source)?.[1]===suffix;
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
  gatewayEntry,
  localEntry,
  gatewayCompat,
  localCompat,
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
  read('server/gateway.mjs'),
  read('server/local.mjs'),
  read(`releases/${canonicalVersion}/server/server-gateway-v131.mjs`),
  read(`releases/${canonicalVersion}/server/server-local-v131.mjs`),
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
  `Install the shell. Open Civweave immediately. Download offline files only when you choose.`,
  `/app/manifest.webmanifest?v=${version}`,
  `/install-v130.js?v=${version}-lightweight-shell-v208`
])check(installerHtml.includes(token),`public/app/index.html is missing ${token}`);
check(!/navigator\.serviceWorker\.register\s*\(/.test(installerHtml),'Installer page reintroduced a second service-worker registration owner.');
check(installRuntime.includes(`const VERSION = '${version}';`),'Installer runtime is stale.');
check(installRuntime.includes(`const WORKER_URL = \`/service-worker-v203.js?v=\${WORKER_BUILD}&revision=\${WORKER_SCRIPT_REVISION}\`;`),'Installer runtime no longer owns the versioned service-worker URL.');
check(/navigator\.serviceWorker\.register\s*\(\s*WORKER_URL/.test(installRuntime),'Installer runtime no longer owns service-worker registration.');
same(manifest.name,`Civweave v${version}`,'manifest name');
const manifestStart=new URL(manifest.start_url,'https://civweave.invalid');
same(manifestStart.pathname,'/app/installed-entry-v146.html','manifest updater start path');
same(manifestStart.searchParams.get('installed'),'1','manifest installed authorization');
same(manifestStart.searchParams.get('version'),null,'manifest start URL release pin');
check((manifest.shortcuts||[]).length===5&&(manifest.shortcuts||[]).every(shortcut=>new URL(shortcut.url,'https://civweave.invalid').pathname==='/app/installed-entry-v146.html'),'Manifest shortcuts no longer enter through the updater-first boundary.');
check(installedEntryHtml.includes(`/app/installed-entry-v146.js?v=${version}`),'Installed entry HTML is stale.');
for(const token of [
  `const FALLBACK_VERSION='${version}';`,
  'authorize();',
  "fetch(`/app/manifest.webmanifest?boot=${Date.now()}`,{cache:'no-store'})",
  "updateViaCache:'none'",
  'await registration.update()',
  "candidate.postMessage({type:'SKIP_WAITING'})",
  'await refreshWorker(releaseVersion)',
  "const requested=params.get('system')||params.get('target')||'civweave';",
  'routes.urlFor(',
  "new URL('/app/working-campus-v156.html',location.origin)"
])check(installedEntryRuntime.includes(token),`Updater-first installed entry is missing ${token}`);
check(installedEntryRuntime.indexOf('await refreshWorker(releaseVersion)')<installedEntryRuntime.indexOf('const requested='),'Installed entry routes before refreshing the worker.');
check(!installedEntryRuntime.includes("new URL('/app/index.html',location.origin)"),'Normal browser launcher still routes through the installer.');
check(!installedEntryRuntime.includes("installer.searchParams.set('install','required')"),'Normal browser launcher still manufactures an install-required redirect.');
check(routes.includes(`const VERSION='${version}';`),'Five-system route contract version is stale.');
for(const pathname of ['/app/working-campus-v156.html','/app/cabinets/living-school/index.html','/app/realm-console-v140.html','/app/fellowfare-cabinet-v144.html','/app/anarchadia-console-v139.html'])check(routes.includes(`pathname:'${pathname}'`),`Route contract is missing ${pathname}.`);
check(nav.includes(`const VERSION='${version}-five-system-navigation-v227';`),'Themed navigation version is stale.');
check(nav.includes('ROUTES.navigate'),'Themed navigation bypasses the route contract.');
check(workerCore.includes(`const VERSION = '${version}';`),'Service-worker core version is stale.');
check(workerWrapper.includes(`/app/system-routes-v227.js?v=${version}-five-system-route-contract-v227`),'Worker route contract revision is stale.');
check(workerWrapper.includes(`/service-worker-core-v208.js?v=${version}-chat-convergence-v250`),'Worker core revision is stale.');
check(workerWrapper.includes('/service-worker-code-coherence-v288.js?v=1.0.91-code-coherence-v288'),'Worker code coherence layer is missing.');
check(workerWrapper.indexOf('/service-worker-code-coherence-v288.js')<workerWrapper.indexOf('/service-worker-core-v208.js'),'Worker code coherence does not precede generic app caching.');
check(workerWrapper.includes('/service-worker-installer-state-v280.js?v=installer-state-machines-v280'),'Worker installer state layer is missing.');
check(workerWrapper.includes('/service-worker-shell-integrity-v281.js?v=shell-integrity-v281'),'Worker shell integrity layer is missing.');
check(workerWrapper.includes('/service-worker-offline-v211-override.js?v=offline-campus-current-graph-v280&policy=resumable-pause-v280'),'Worker offline resumable-current-graph revision is stale.');
check(workerWrapper.includes('/service-worker-campus-completion-v246.js?v=campus-retired-completion-v246'),'Worker campus completion layer is missing.');
check(workerWrapper.includes('/service-worker-chat-repair-v245.js?v=chat-css-contract-v343&purge=chat-css-contract-v343'),'Worker lost the current stale-chat cache migration lane.');
check(workerWrapper.indexOf('/service-worker-canonical-navigation-v227.js')>workerWrapper.indexOf('/service-worker-shell-repair-v225.js'),'Canonical navigation is not the final navigation policy.');
check(legacyWorker.includes(`/service-worker-v203.js?v=${version}-code-coherence-v288-lightweight-shell-v208-legacy-v156-bridge-v209`),'Legacy worker bridge is stale.');
for(const token of [
  `const VERSION='${version}';`,
  "const REVISION='chat-convergence-v250-navigation-lifecycle-v424';",
  "const INSTALLER='/app/index.html';",
  'const ADDITIONS_VERSION=`${requestedRelease}-chat-convergence-v250-navigation-lifecycle-v424`;',
  'version:VERSION,allowed',
  "canonicalPolicy:'five-system-first-class-routes-v242-canonical-chat-owner'",
  "guideWorkspaceRevision:'v250-v242-canonical-owner'",
  "navigationLifecycleRevision:'v424-head-capture-bfcache-resume'",
  'canonicalSystemCount:5',
  'canonicalAutoScripts:0',
  "canonicalSubsystemCompatibility:'route-version-settings-only-no-legacy-additions'"
])check(installBoundary.includes(token),`Install boundary is missing ${token}.`);
const experienceStart=installBoundary.indexOf('const SYSTEM_EXPERIENCE_SCRIPTS=['),experienceEnd=installBoundary.indexOf('];',experienceStart),experience=installBoundary.slice(experienceStart,experienceEnd);
check(experience.includes('GUIDE_WORKSPACE'),'Canonical experience no longer boots the v242 workspace.');
check(!experience.includes('PERSISTENT_GUIDE_CHAT_SCRIPT')&&!experience.includes('PERSISTENT_GUIDE_VIEWPORT_SCRIPT'),'Canonical experience restored a retired v215/v216 chat owner.');
check(!installBoundary.includes("const RELEASE_VERSION_SCRIPT='/app/release-version-v1.js';")&&!installBoundary.includes('addScript(RELEASE_VERSION_SCRIPT)'),'Install boundary reintroduced the retired canonical version loader.');
check(releaseRuntime.includes("fetch('/app/manifest.webmanifest'")&&releaseRuntime.includes("querySelectorAll('.version,.version-chip,[data-civweave-version]')"),'Visible-version synchronizer is incomplete.');
const versionSelectedCanonicalLoader=source=>/readFile\s*\(\s*path\.join\s*\(\s*root\s*,\s*['"]VERSION['"]/.test(source)&&/path\.join\s*\(\s*root\s*,\s*['"]releases['"]\s*,\s*version\s*,\s*['"]server['"]\s*\)/.test(source);
check(versionSelectedCanonicalLoader(gatewayEntry),'Stable gateway entry no longer selects the VERSION canonical implementation.');
check(versionSelectedCanonicalLoader(localEntry),'Stable local entry no longer selects the VERSION canonical implementation.');
check(versionConst(gatewayCompat,`${version}-render-installed-runtime-v132`),'Gateway canonical wrapper version is stale.');
check(new RegExp(`const\\s+VERSION\\s*=\\s*['"]${version.replaceAll('.','\\.')}['"]`).test(localCompat)&&localCompat.includes(`?build=${version}`),'Local canonical server version is stale.');
check(workingCampus.includes(`Civweave Working Campus · v${version}`)&&workingCampus.includes(`<b class="version-chip">v${version}</b>`),'Working Campus visible release is stale.');
check(workingCampus.includes('/app/install-boundary-v146.js?v=chat-convergence-v250-navigation-lifecycle-v424'),'Working Campus boundary cache identity is stale.');
check(campusLoader.includes(`system-routes-v227.js?v=${version}-five-system-route-contract-v227`),'Working Campus route loader version is stale.');
check(campusPart4.includes(`version:'${version}'`),'Working Campus realm travel version is stale.');
for(const token of [
  "await patch('public/index.html'",
  "await patch('public/app/index.html'",
  "await patch('public/app/manifest.webmanifest'",
  "manifest.start_url='/app/installed-entry-v146.html?installed=1';",
  "await patch('public/app/system-routes-v227.js'",
  "await patch('public/app/themed-system-nav-v178.js'",
  "await patch('public/app/working-campus-v156.js'",
  "await patch('public/app/working-campus-v156.part4.txt'",
  'launcher entry revision',
  'installer title',
  'worker route contract revision',
  'five-system route version',
  'install-boundary release-aware additions revision',
  'navigation-lifecycle-v424',
  'code-coherence-v288'
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
  const pattern=new RegExp(`(?:(?:Civweave|Commonweave) v|const VERSION = '|const VERSION='|version:'|version=)(\\d+\\.\\d+\\.\\d+)`,'g');
  for(const match of source.matchAll(pattern))if(match[1]!==version)throw new Error(`${label} still exposes ${match[1]} instead of ${version}.`);
}
console.log(JSON.stringify({ok:true,version,packageVersion:pkg.version,canonicalSystems:5,routeMatrixVersioned:true,workerPackageNavigation:true,codeCoherence:'v288',offlineRevision:'offline-campus-current-graph-v280',offlinePolicy:'resumable-pause-v280',shellIntegrity:'shell-integrity-v281',canonicalChatOwner:'guide-workspace-v242',navigationLifecycle:'v424',legacyCompatibility:'noncanonical-only',gatewayStableEntry:true,localStableEntry:true,buildTimeSynchronization:true,browserInstallerLoopGuard:true,updaterFirstInstalledLaunch:true,manifestReleasePin:false,installerRecoveryOnly:true,installerRegistrationOwner:'install-v130.js'},null,2));
