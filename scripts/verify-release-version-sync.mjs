import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

await import('./sync-release-version-assets.mjs');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const check=(condition,message)=>{if(!condition)throw new Error(message)};
const same=(actual,expected,label)=>check(actual===expected,`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`);
const [versionText,packageText,launcherHtml,manifestText,installRuntime,installerHtml,installedEntryHtml,installedEntryRuntime,routes,nav,installBoundary,releaseRuntime,workerCore,workerWrapper,offlineRuntime,canonicalNavigation,legacyWorker,gateway,localServer,workingCampus,campusLoader,campusPart4,syncSource]=await Promise.all([
  read('VERSION'),read('package.json'),read('public/index.html'),read('public/app/manifest.webmanifest'),read('public/install-v130.js'),read('public/app/index.html'),read('public/app/installed-entry-v146.html'),read('public/app/installed-entry-v146.js'),read('public/app/system-routes-v227.js'),read('public/app/themed-system-nav-v178.js'),read('public/app/install-boundary-v146.js'),read('public/app/release-version-v1.js'),read('public/service-worker-core-v208.js'),read('public/service-worker-v203.js'),read('public/service-worker-offline-runtime-boundary-v266.js'),read('public/service-worker-canonical-navigation-v227.js'),read('public/service-worker-v156.js'),read('server-gateway-v131.mjs'),read('server-local-v131.mjs'),read('public/app/working-campus-v156.html'),read('public/app/working-campus-v156.js'),read('public/app/working-campus-v156.part4.txt'),read('scripts/sync-release-version-assets.mjs')
]);
const version=versionText.trim(),pkg=JSON.parse(packageText),manifest=JSON.parse(manifestText);
check(/^\d+\.\d+\.\d+$/.test(version),'VERSION must contain a semantic release version.');
same(pkg.version,version,'package.json version');

for(const token of ['<title>Civweave</title>',`/app/civweave-brand.js?v=${version}`,`/app/installed-entry-v146.js?v=${version}`,"new URL('/app/index.html',location.origin)","source','host-bootstrap'"])check(launcherHtml.includes(token),`public/index.html is missing ${token}`);
check(!launcherHtml.includes("new URL('/app/working-campus-v156.html',location.origin)"),'Hosted root directly launches Working Campus instead of installer/update/recovery.');
check(!launcherHtml.includes("source','web-root'"),'Hosted root still exposes retired live-runtime provenance.');

for(const token of [
  `<title>Install Civweave v${version}</title>`,
  `<span class="version">v${version}</span>`,
  `Install Civweave v${version}. The campus downloads before runtime opens.`,
  'This hosted page is only the installer, updater, and recovery dock.',
  'pages are package-only at runtime',
  'will not silently substitute the live website',
  `/app/manifest.webmanifest?v=${version}`,
  `/install-v130.js?v=${version}-lightweight-shell-v208`
])check(installerHtml.includes(token),`public/app/index.html is missing ${token}`);
for(const forbidden of ['Open online campus','launch=online','Open Civweave online'])check(!installerHtml.includes(forbidden),`Installer reintroduced live-runtime fallback text: ${forbidden}`);
check(!/navigator\.serviceWorker\.register\s*\(/.test(installerHtml),'Installer page reintroduced a second service-worker registration owner.');
check(installRuntime.includes(`const VERSION = '${version}';`),'Installer runtime is stale.');
check(installRuntime.includes('navigator.serviceWorker.register'),'Installer runtime no longer owns service-worker registration.');

same(manifest.name,`Civweave v${version}`,'manifest name');
const manifestStart=new URL(manifest.start_url,'https://civweave.invalid');
same(manifestStart.pathname,'/app/installed-entry-v146.html','manifest updater start path');
same(manifestStart.searchParams.get('installed'),'1','manifest installed marker');
same(manifestStart.searchParams.get('version'),null,'manifest start URL release pin');
check((manifest.shortcuts||[]).length===5&&(manifest.shortcuts||[]).every(shortcut=>new URL(shortcut.url,'https://civweave.invalid').pathname==='/app/installed-entry-v146.html'),'Manifest shortcuts no longer enter through updater-first boundary.');

check(installedEntryHtml.includes(`/app/installed-entry-v146.js?v=${version}`),'Installed entry HTML is stale.');
for(const token of [`const FALLBACK_VERSION='${version}';`,'authorize();',"fetch(`/app/manifest.webmanifest?boot=${Date.now()}`,{cache:'no-store'})","updateViaCache:'none'",'await registration.update()',"candidate.postMessage({type:'SKIP_WAITING'})",'await refreshWorker(releaseVersion)',"const requested=params.get('system')||params.get('target')||'civweave';",'routes.urlFor('])check(installedEntryRuntime.includes(token),`Updater-first installed entry is missing ${token}`);
check(installedEntryRuntime.indexOf('await refreshWorker(releaseVersion)')<installedEntryRuntime.indexOf('const requested='),'Installed entry routes before refreshing the worker.');

check(routes.includes(`const VERSION='${version}';`),'Five-system route contract version is stale.');
check(routes.includes('intrinsicAuthorization:false'),'Route contract no longer proves recognition is non-authorizing.');
check(routes.includes("authorizationPolicy:'explicit-launch-or-in-app-navigation-only'"),'Route authorization policy marker is missing.');
check(!/if\(typeof document[^\n]+authorize\(\)/.test(routes),'Route contract authorizes merely by loading on a canonical page.');
for(const pathname of ['/app/working-campus-v156.html','/app/cabinets/living-school/index.html','/app/realm-console-v140.html','/app/fellowfare-cabinet-v144.html','/app/anarchadia-console-v139.html'])check(routes.includes(`pathname:'${pathname}'`),`Route contract is missing ${pathname}.`);
check(nav.includes(`const VERSION='${version}-five-system-navigation-v227';`),'Themed navigation version is stale.');
check(nav.includes('ROUTES.navigate'),'Themed navigation bypasses explicit in-app route authorization.');

for(const token of [
  `const VERSION='${version}';`,
  "const REVISION='chat-convergence-v250';",
  "const RUNTIME_REVISION='downloaded-runtime-boundary-v266';",
  "const INSTALLER='/app/index.html';",
  'const ADDITIONS_VERSION=`${requestedRelease}-chat-convergence-v250`;',
  "canonicalPolicy:'five-system-first-class-routes-v242-canonical-chat-owner'",
  "runtimeCanonicalPolicy:'five-system-first-class-routes-v266-downloaded-runtime-only'",
  "runtimeAuthorizationPolicy:'standalone-or-preauthorized-session-never-route-intrinsic'",
  "runtimeSourcePolicy:'current-downloaded-package-never-live-site-fallback'",
  "guideWorkspaceRevision:'v250-v242-canonical-owner'",
  'canonicalSystemCount:5',
  'canonicalAutoScripts:0',
  'onlineSelfHeal:false'
])check(installBoundary.includes(token),`Install boundary is missing ${token}.`);
check(!/function systemSurface\(\)[\s\S]{0,300}authorize\(\)/.test(installBoundary),'Install-boundary route recognition implicitly authorizes a hosted runtime.');
const experienceStart=installBoundary.indexOf('const SYSTEM_EXPERIENCE_SCRIPTS=['),experienceEnd=installBoundary.indexOf('];',experienceStart),experience=installBoundary.slice(experienceStart,experienceEnd);
check(experience.includes('GUIDE_WORKSPACE'),'Canonical experience no longer boots the v242 workspace.');
check(!experience.includes('PERSISTENT_GUIDE_CHAT_SCRIPT')&&!experience.includes('PERSISTENT_GUIDE_VIEWPORT_SCRIPT'),'Canonical experience restored a retired v215/v216 chat owner.');

check(workerCore.includes(`const VERSION = '${version}';`),'Service-worker core version is stale.');
check(workerWrapper.includes(`/app/system-routes-v227.js?v=${version}-five-system-route-contract-v227`),'Worker route contract revision is stale.');
check(workerWrapper.includes(`/service-worker-offline-runtime-boundary-v266.js?v=${version}-downloaded-runtime-boundary-v266`),'Worker downloaded-runtime boundary revision is stale.');
check(workerWrapper.includes(`/service-worker-core-v208.js?v=${version}-chat-convergence-v250`),'Worker core revision is stale.');
check(workerWrapper.includes('/service-worker-offline-v211-override.js?v=offline-campus-current-graph-v238'),'Worker offline current-graph revision is stale.');
check(workerWrapper.includes('/service-worker-canonical-navigation-v227.js?v=canonical-package-navigation-v266'),'Worker canonical package navigation revision is stale.');
check(workerWrapper.includes('/service-worker-chat-repair-v245.js?v=chat-convergence-v250'),'Worker lost stale-chat migration lane.');
check(workerWrapper.indexOf('/service-worker-offline-runtime-boundary-v266.js')<workerWrapper.indexOf('/service-worker-core-v208.js'),'Downloaded-runtime boundary must execute before generic service-worker core.');
check(workerWrapper.indexOf('/service-worker-canonical-navigation-v227.js')>workerWrapper.indexOf('/service-worker-shell-repair-v225.js'),'Canonical package navigation is not the final navigation policy.');
for(const token of ['canonical-runtime-current-downloaded-package-only-no-live-site-fallback',"headers.set('x-civweave-runtime-source','downloaded-package')",'event.stopImmediatePropagation()','package-miss'])check(offlineRuntime.includes(token),`Downloaded-runtime worker is missing ${token}.`);
for(const token of ['exact-route-current-package-first-no-live-network-runtime-fallback','runtimeNetworkFallback:false','currentPackage(pathname)'])check(canonicalNavigation.includes(token),`Canonical navigation is missing ${token}.`);
const runtimeBranch=canonicalNavigation.slice(canonicalNavigation.indexOf('networkFirst=async function canonicalFiveSystemPackageFirst'),canonicalNavigation.indexOf('self.CivweaveCanonicalNavigationV227'));
check(runtimeBranch.length>0&&!runtimeBranch.includes('fetch('),'Canonical runtime navigation can still fetch the hosted route.');
check(legacyWorker.includes(`/service-worker-v203.js?v=${version}-lightweight-shell-v208-legacy-v156-bridge-v209`),'Legacy worker bridge is stale.');

check(releaseRuntime.includes("fetch('/app/manifest.webmanifest'")&&releaseRuntime.includes("querySelectorAll('.version,.version-chip,[data-civweave-version]')"),'Visible-version synchronizer is incomplete.');
check(new RegExp(`const\\s+VERSION\\s*=\\s*['"]${version.replaceAll('.','\\.')}['"]`).test(localServer)&&localServer.includes(`?build=${version}`),'Local server version is stale.');
check(gateway.includes(`${version}-render-installed-runtime-v132`),'Gateway wrapper version is stale.');
check(workingCampus.includes(`Civweave Working Campus · v${version}`)&&workingCampus.includes(`<b class="version-chip">v${version}</b>`),'Working Campus visible release is stale.');
check(campusLoader.includes(`system-routes-v227.js?v=${version}-five-system-route-contract-v227`),'Working Campus route loader version is stale.');
check(campusPart4.includes(`version:'${version}'`),'Working Campus realm travel version is stale.');

for(const token of [
  "await patch('public/index.html'",
  'Hosted root must remain installer-only.',
  'Hosted root must never launch Working Campus directly.',
  "await patch('public/app/index.html'",
  'Installer resurrected a live campus runtime fallback.',
  "await patch('public/app/manifest.webmanifest'",
  "manifest.start_url='/app/installed-entry-v146.html?installed=1';",
  "await patch('public/app/system-routes-v227.js'",
  "await patch('public/app/themed-system-nav-v178.js'",
  "await patch('public/service-worker-offline-runtime-boundary-v266.js'",
  'Downloaded runtime boundary must load before the general service-worker core.',
  'Install boundary lost explicit runtime authorization.',
  'Install boundary lost downloaded-package runtime policy.'
])check(syncSource.includes(token),`Release synchronizer is missing regression fence ${token}.`);

console.log(JSON.stringify({ok:true,version,packageVersion:pkg.version,canonicalSystems:5,hostedRoot:'installer-only',installerRecoveryOnly:true,updaterFirstInstalledLaunch:true,runtimeAuthorization:'standalone-or-preauthorized-session',canonicalRuntime:'downloaded-package-only',canonicalNetworkFallback:false,routeIntrinsicAuthorization:false,workerPackageNavigation:true,canonicalChatOwner:'guide-workspace-v242',gatewayVersion:true,localVersion:true,buildTimeSynchronization:true,installerRegistrationOwner:'install-v130.js'},null,2));
