import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

await import('./smoke-installer-resume-state-v280.mjs');
await import('./generate-prelive-metadata-v281.mjs');

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const [wrapperSource,overrideSource,manifestSource,backgroundSource]=await Promise.all([
  read('public/service-worker-v203.js'),
  read('public/service-worker-offline-v211-override.js'),
  read('public/app/offline-package-v208.json'),
  read('public/app/campus-background-download-v241.js')
]);
const manifest=JSON.parse(manifestSource);
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

assert(wrapperSource.includes("importScripts('/service-worker-living-school-cleanroom-v218.js"),'Generated worker omits the Living School clean-room boundary.');
assert(wrapperSource.includes("importScripts('/service-worker-core-v208.js"),'Generated worker omits the retained lightweight core.');
assert(wrapperSource.includes("importScripts('/service-worker-installer-state-v280.js"),'Generated worker omits installer state pinning.');
assert(wrapperSource.includes("importScripts('/service-worker-shell-integrity-v281.js"),'Generated worker omits shell integrity verification.');
assert(wrapperSource.includes("importScripts('/service-worker-offline-v211-override.js"),'Generated worker omits the offline retry override.');
assert(wrapperSource.includes('offline-campus-current-graph-v280'),'Generated worker lost the resumable current-graph identity.');
assert(wrapperSource.includes('policy=resumable-pause-v280'),'Generated worker lost the resumable/pause policy.');
assert(wrapperSource.includes('references=current-manifest-only-v282'),'Generated worker lost the current-manifest-only reference policy.');
assert(wrapperSource.indexOf('service-worker-core-v208.js')<wrapperSource.indexOf('service-worker-installer-state-v280.js'),'Installer state must extend the retained core arrays.');
assert(wrapperSource.indexOf('service-worker-installer-state-v280.js')<wrapperSource.indexOf('service-worker-shell-integrity-v281.js'),'Integrity must see the final required shell asset set.');
assert(wrapperSource.indexOf('service-worker-shell-integrity-v281.js')<wrapperSource.indexOf('service-worker-offline-v211-override.js'),'Offline package policy must load after shell integrity.');

for(const token of [
  "const V211_REVISION = 'offline-campus-current-graph-v280'",
  "const V211_POLICY = 'resumable-pause-v280'",
  "const V211_REFERENCE_POLICY = 'current-manifest-only-v282'",
  "const V211_SYNC_TAG = 'civweave-campus-resume-v280'",
  'const V211_BATCH_SIZE = 16',
  'let v211DownloadPromise = null',
  'let v211PauseRequested = false',
  'downloadedAssets',
  'joinedExisting: true',
  "event.data?.type !== 'PAUSE_OFFLINE_PACKAGE'",
  "event.tag !== V211_SYNC_TAG",
  'pauseSupported: true',
  'resumablePerFile: true',
  'backgroundSafe: true'
])assert(overrideSource.includes(token),`Resumable campus worker is missing ${token}.`);

assert(backgroundSource.includes("const OPT_IN_KEY='civweave.offline-campus.explicit-opt-in.v304'"),'In-app background downloader lost the explicit campus opt-in boundary.');
assert(backgroundSource.includes("if(status?.ready||status?.paused)return true"),'In-app background downloader does not stop auto-resume for a deliberate pause.');
assert(backgroundSource.includes("if(optedIn()&&navigator.onLine!==false&&!lastStatus?.paused)resume('scheduled_retry')"),'Scheduled retry is not gated by both explicit opt-in and pause state.');
assert(backgroundSource.includes("if(optedIn()&&!packet.ready&&!packet.paused&&navigator.onLine!==false)scheduleRetry(2200)"),'Worker completion can schedule retry without honoring explicit opt-in and deliberate pause.');
assert(backgroundSource.includes("activeWorker.postMessage({type:'DOWNLOAD_OFFLINE_PACKAGE',background:true"),'Canonical page runtime does not resume the worker-owned download.');
assert(backgroundSource.includes("navigator.serviceWorker.addEventListener('message'"),'Background progress rail does not receive worker broadcasts.');

const expectedSeeds=[
  '/app/installed-entry-v146.html',
  '/app/cw-reward-ledger-v2.js',
  '/app/cw-reward-receivers-v2.js',
  '/app/cw-reward-legacy-bridge-v2.js',
  '/app/cw-reward-surfaces-v2.js',
  '/app/civweave-systems-mesh-v251.js',
  '/app/working-campus-v156.html',
  '/app/cabinets/living-school/index.html',
  '/app/realm-console-v140.html',
  '/app/fellowfare-cabinet-v144.html',
  '/app/anarchadia-console-v139.html'
];
assert(JSON.stringify(manifest.seeds)===JSON.stringify(expectedSeeds),`Offline manifest must seed exactly installed entry + reward runtimes + Systems Mesh + five canonical systems; got ${manifest.seeds.length} seeds.`);
assert(manifest.revision==='canonical-background-campus-v241-systems-mesh-v251','Offline manifest does not identify the approved Systems Mesh seed revision.');
assert(manifest.preflight?.revision==='campus-storage-budget-v281','Offline manifest is missing the storage preflight budget.');

console.log(JSON.stringify({
  ok:true,
  revision:'offline-campus-current-graph-v280',
  policy:'resumable-pause-v280',
  referencePolicy:'current-manifest-only-v282',
  canonicalSeeds:manifest.seeds.length,
  perFileCheckpointing:true,
  duplicateRequestsJoin:true,
  manualPause:true,
  explicitOptInRequired:true,
  pauseSurvivesBackgroundRetry:true,
  backgroundSync:true,
  storageBudget:true
},null,2));
