import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

await import('./sync-release-version-assets.mjs');

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const [versionText,packageText,indexHtml,manifestText,installRuntime,appIndex,installedEntry,installBoundary,releaseRuntime,workerCore,workerWrapper,legacyWorker,gateway,localServer,workingCampus,syncSource]=await Promise.all([
  read('VERSION'),
  read('package.json'),
  read('public/index.html'),
  read('public/app/manifest.webmanifest'),
  read('public/install-v130.js'),
  read('public/app/index.html'),
  read('public/app/installed-entry-v146.html'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/release-version-v1.js'),
  read('public/service-worker-core-v208.js'),
  read('public/service-worker-v203.js'),
  read('public/service-worker-v156.js'),
  read('server-gateway-v131.mjs'),
  read('server-local-v131.mjs'),
  read('public/app/working-campus-v156.html'),
  read('scripts/sync-release-version-assets.mjs')
]);

const version=versionText.trim();
const pkg=JSON.parse(packageText);
const manifest=JSON.parse(manifestText);

assert(/^\d+\.\d+\.\d+$/.test(version),'VERSION must contain a semantic release version.');
assert(pkg.version===version,`package.json ${pkg.version} does not match VERSION ${version}.`);

for(const token of [
  `<title>Install Commonweave v${version}</title>`,
  `<span class="version">v${version}</span>`,
  `Install Commonweave v${version}. The campus downloads automatically.`,
  `/app/manifest.webmanifest?v=${version}`,
  `/service-worker-v203.js?v=${version}-lightweight-shell-v208`,
  `/install-v130.js?v=${version}-lightweight-shell-v208`,
  `/app/offline-campus-status-v210.js?v=${version}-offline-retry-loop-v211`,
  `/app/required-campus-autostart-v1.js?v=${version}-required-campus-v1`
])assert(indexHtml.includes(token),`public/index.html is missing ${token}`);

assert(manifest.name===`Commonweave v${version}`,'Manifest name does not match the canonical release.');
assert(new URL(manifest.start_url,'https://commonweave.invalid').searchParams.get('version')===version,'Manifest start_url does not carry the canonical release.');
assert(installRuntime.includes(`const VERSION = '${version}';`),'Installer runtime does not use the canonical release.');
assert(appIndex.includes(`/app/installed-entry-v146.js?v=${version}`),'Stable app entry cache revision is stale.');
assert(installedEntry.includes(`/app/installed-entry-v146.js?v=${version}`),'Installed entry cache revision is stale.');
assert(workerCore.includes(`const VERSION = '${version}';`),'Service-worker core does not use the canonical release.');
assert(workerWrapper.includes(`/service-worker-core-v208.js?v=${version}-lightweight-shell-v208-retained-v218`),'Active worker wrapper is stale.');
assert(legacyWorker.includes(`/service-worker-v203.js?v=${version}-lightweight-shell-v208-legacy-v156-bridge-v209`),'Legacy worker bridge is stale.');
assert(installBoundary.includes(`version:'${version}'`),'Install boundary does not expose the canonical release.');
assert(installBoundary.includes("const RELEASE_VERSION_SCRIPT='/app/release-version-v1.js';")&&installBoundary.includes('addScript(RELEASE_VERSION_SCRIPT)'),'Install boundary does not load the visible-version synchronizer.');
assert(releaseRuntime.includes("fetch('/app/manifest.webmanifest'")&&releaseRuntime.includes("querySelectorAll('.version,.version-chip,[data-commonweave-version]')"),'Visible-version synchronizer is incomplete.');
assert(gateway.includes(`const VERSION = '${version}-render-installed-runtime-v132';`),'Gateway wrapper was not synchronized to the canonical release.');
assert(localServer.includes(`"const VERSION = '${version}';"`)&&localServer.includes(`?build=${version}`),'Local server wrapper was not synchronized to the canonical release.');
assert(workingCampus.includes(`Commonweave Working Campus · v${version}`)&&workingCampus.includes(`<b class="version-chip">v${version}</b>`),'Working Campus visible release is stale.');

for(const token of [
  "await patch('public/index.html'",
  "await patch('public/app/manifest.webmanifest'",
  "await patch('public/service-worker-core-v208.js'",
  "await patch('public/app/working-campus-v156.html'",
  "await patch('server-gateway-v131.mjs'",
  "await patch('server-local-v131.mjs'"
])assert(syncSource.includes(token),`Release synchronizer is missing ${token}.`);

for(const [label,source] of [['installer page',indexHtml],['manifest',manifestText],['installer runtime',installRuntime],['stable app entry',appIndex],['installed entry',installedEntry],['worker core',workerCore],['worker wrapper',workerWrapper],['legacy worker',legacyWorker],['working campus',workingCampus]]){
  const visibleReleasePattern=new RegExp(`(?:Commonweave v|const VERSION = '|version=|\\?v=)(\\d+\\.\\d+\\.\\d+)`,'g');
  for(const match of source.matchAll(visibleReleasePattern)){
    if(match[1]!==version)throw new Error(`${label} still exposes release ${match[1]} instead of ${version}.`);
  }
}

console.log(JSON.stringify({ok:true,version,packageVersion:pkg.version,installerVersion:true,manifestVersion:true,workerVersion:true,visibleVersionRuntime:true,workingCampusVersion:true,gatewayVersion:true,localVersion:true,buildTimeSynchronization:true},null,2));
