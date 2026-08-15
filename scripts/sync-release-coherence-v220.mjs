import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=(await readFile(path.join(root,'VERSION'),'utf8')).trim();
const read=relative=>readFile(path.join(root,relative),'utf8');
if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('VERSION must contain a semantic release version.');

const [
  installerPage,
  installer,
  installedEntry,
  installBoundary,
  worker,
  bootstrapWorker,
  navigationSafety,
  canonicalNavigation,
  releaseCoherence,
  installedLaunch,
  localAICoherence,
  codeCoherence,
  livingSchool,
  shellRepair,
  minilmAdapter
]=await Promise.all([
  read('public/app/index.html'),
  read('public/install-v130.js'),
  read('public/app/installed-entry-v146.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/service-worker-v203.js'),
  read('public/service-worker-install-v1.js'),
  read('public/service-worker-navigation-safety-v224.js'),
  read('public/service-worker-canonical-navigation-v227.js'),
  read('public/service-worker-release-coherence-v220.js'),
  read('public/service-worker-installed-launch-v282.js'),
  read('public/service-worker-local-ai-coherence-v307.js'),
  read('public/service-worker-code-coherence-v288.js'),
  read('public/service-worker-living-school-cleanroom-v218.js'),
  read('public/service-worker-shell-repair-v225.js'),
  read('public/app/models/all-minilm-l6-v2/adapter.js')
]);

assert.doesNotMatch(installerPage,/navigator\.serviceWorker\.register\s*\(/,'Installer page must delegate worker ownership to install-v130.js.');
assert.doesNotMatch(installerPage,/open-online-campus|Browser fallback/i,'Installer must not advertise an online runtime fallback.');
assert.match(installerPage,/Civweave installs in two local stages\. The campus is required;/,'Installer must describe the required local campus honestly.');
assert.match(installer,/BOOTSTRAP_BUILD='installer-bootstrap-v1-local-first'/,'Installer lost the local-first bootstrap revision.');
assert.match(installer,/ensureLocalPackage/,'PWA install must wait for the local campus package.');
assert.match(installer,/x-civweave-package':'campus-preflight'/,'Campus acquisition must be marked as an explicit package action.');
assert.match(installer,/Installation will wait rather than fall back to an online runtime\./,'Installer must fail closed instead of substituting an online runtime.');

assert.match(installedEntry,/allowProvision:localDeveloper\(\)/,'Production installed launch must not provision the full worker implicitly.');
assert.match(installedEntry,/installed-entry-local-package-required/,'Missing local campus must return to package installation.');
assert.match(installedEntry,/browserRuntimePolicy:'installed-display-cache-only'/,'Installed runtime must advertise cache-only behavior.');
assert.match(installedEntry,/localCampusReady/,'Installed launch must verify the local campus before routing.');
assert.match(installBoundary,/browserRuntimePolicy:'installed-display-only'/,'Ordinary browser documents must remain outside the installed runtime boundary.');

const workerTokens=[
  `/app/system-routes-v227.js?v=${version}-five-system-route-contract-v227`,
  '/service-worker-living-school-cleanroom-v218.js?v=living-school-cleanroom-v218-local-first',
  `/service-worker-local-ai-coherence-v307.js?v=${version}-local-ai-code-coherence-v307-local-first`,
  '/service-worker-code-coherence-v288.js?v=1.0.92-code-coherence-v288-language-v2-local-first',
  '/service-worker-installed-launch-v282.js?v=installed-pwa-launch-v294-campus-recovery-local-first',
  '/service-worker-release-coherence-v220.js?v=release-coherence-v226-local-first',
  '/service-worker-navigation-safety-v224.js?v=navigation-redirect-safety-v224-local-first',
  '/service-worker-shell-repair-v225.js?v=shell-self-repair-v225-install-only-pwa-v1-local-first',
  '/service-worker-canonical-navigation-v227.js?v=canonical-five-system-navigation-v227-local-first'
];
for(const token of workerTokens)assert.ok(worker.includes(token),`Generated worker lost local-first module epoch ${token}.`);

assert.match(bootstrapWorker,/runtimeNetworkFallback: false/,'Bootstrap runtime must not fetch missing application files.');
assert.match(bootstrapWorker,/offlinePackageOptional: false/,'Local campus must not be mislabeled optional.');
assert.match(bootstrapWorker,/localCampusRequiredForLaunch: true/,'Bootstrap must require a complete local campus before launch.');
assert.match(bootstrapWorker,/error: 'LOCAL_PACKAGE_REQUIRED'/,'Bootstrap must fail visibly when a local package is missing.');

for(const [name,source,policy] of [
  ['navigation safety',navigationSafety,'cache-only-runtime-explicit-package-acquisition'],
  ['canonical navigation',canonicalNavigation,'exact-route-cache-only-never-runtime-network-fallback'],
  ['release coherence',releaseCoherence,'version-pinned-cache-only-runtime-explicit-update-only'],
  ['installed launch',installedLaunch,'installed-entry-then-local-working-campus-never-network-fallback'],
  ['local AI coherence',localAICoherence,'explicit-package-install-cache-only-runtime'],
  ['code coherence',codeCoherence,'explicit-package-install-cache-only-runtime'],
  ['Living School',livingSchool,'cache-only-runtime']
]){
  assert.ok(source.includes(policy),`${name} lost local-first policy ${policy}.`);
  assert.match(source,/runtimeNetworkFallback:\s*false/,`${name} must explicitly forbid runtime network fallback.`);
}
assert.match(shellRepair,/runtimeAutoRepair:\s*false/,'Checking shell status must not trigger a repair download.');
assert.match(shellRepair,/explicit-repair-only-report-missing-without-runtime-fetch/,'Shell repair must require an explicit repair action.');

assert.match(minilmAdapter,/sameOriginDownloadsOnly:true/,'MiniLM browser acquisition must remain same-origin.');
assert.match(minilmAdapter,/remoteModelHostsAllowed:false/,'MiniLM browser runtime must reject direct remote model hosts.');
assert.match(minilmAdapter,/x-civweave-package':'minilm-model-install'/,'MiniLM acquisition must be an explicit package action.');
assert.doesNotMatch(minilmAdapter,/https?:\/\//i,'MiniLM browser adapter must not contain a direct remote model URL.');

console.log(JSON.stringify({
  ok:true,
  version,
  revision:'release-coherence-v226-local-first',
  changed:[],
  runtimeNetworkFallback:false,
  localCampusRequiredForLaunch:true,
  packageAcquisition:'explicit-only',
  browserRuntime:'installed-display-cache-only',
  miniLM:'same-origin-explicit-package-only'
},null,2));
