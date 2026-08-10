import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [wrapperSource,coreSource,cleanupSource,installerStateSource,overrideSource,manifestSource,backgroundSource]=await Promise.all([
  readFile(path.join(root,'public/service-worker-v203.js'),'utf8'),
  readFile(path.join(root,'public/service-worker-core-v208.js'),'utf8'),
  readFile(path.join(root,'public/service-worker-living-school-cleanroom-v218.js'),'utf8'),
  readFile(path.join(root,'public/service-worker-installer-state-v280.js'),'utf8'),
  readFile(path.join(root,'public/service-worker-offline-v211-override.js'),'utf8'),
  readFile(path.join(root,'public/app/offline-package-v208.json'),'utf8'),
  readFile(path.join(root,'public/app/campus-background-download-v241.js'),'utf8')
]);
const manifest=JSON.parse(manifestSource);
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const workerPackage=`${wrapperSource}\n${coreSource}\n${installerStateSource}\n${overrideSource}`;

const cleanImport="importScripts('/service-worker-living-school-cleanroom-v218.js";
const coreImport="importScripts('/service-worker-core-v208.js";
const installerStateImport="importScripts('/service-worker-installer-state-v280.js?v=installer-state-machines-v280'";
const offlineImport="importScripts('/service-worker-offline-v211-override.js?v=offline-campus-current-graph-v280&policy=resumable-pause-v280'";
assert(wrapperSource.includes(cleanImport),'Generated worker omits the Living School clean-room boundary.');
assert(wrapperSource.includes(coreImport),'Generated worker omits the retained lightweight core.');
assert(wrapperSource.includes(installerStateImport),'Generated worker omits the resumable installer state layer.');
assert(wrapperSource.includes(offlineImport),'Generated worker lost the v280 resumable current-graph offline identity.');
assert(wrapperSource.indexOf(cleanImport)<wrapperSource.indexOf(coreImport),'Living School retirement does not load before the generic core.');
assert(wrapperSource.indexOf(coreImport)<wrapperSource.indexOf(installerStateImport),'Installer state does not load after the core.');
assert(wrapperSource.indexOf(installerStateImport)<wrapperSource.indexOf(offlineImport),'Offline override does not load after installer state.');
assert(workerPackage.includes("const BUILD = 'lightweight-shell-v208'"),'Verified lightweight shell core is missing.');
assert(workerPackage.includes("const LIBRARY_CACHE='cwknowledge-school-seeds-v2'")||workerPackage.includes('cwknowledge-'),'Protected knowledge storage markers are missing from the worker package.');

assert(installerStateSource.includes('installer-state-machines-v280'),'Installer state revision is missing.');
assert(installerStateSource.includes("'/app/installer-state-machine-v280.js'")&&installerStateSource.includes('shellRequired: true'),'Installer state worker does not require the page-side resumable state machine in the shell.');
assert(overrideSource.includes("const V211_REVISION = 'offline-campus-current-graph-v280'"),'v280 current-graph retry repair is missing from the worker package.');
assert(overrideSource.includes("const V211_POLICY = 'resumable-pause-v280'"),'Resumable campus policy marker is missing.');
assert(overrideSource.includes("const V211_SYNC_TAG = 'civweave-campus-resume-v280'"),'Background resume sync tag is missing.');
assert(overrideSource.includes('const V211_BATCH_SIZE = 16'),'Offline background concurrency is not the expected bounded value.');
assert(overrideSource.includes("reason: 'stale-not-rediscovered'"),'Old package assets are not explicitly retired when the current graph stops referencing them.');
assert(overrideSource.includes("reason: entry.status === 404 || entry.status === 410 ? 'not-found' : 'retry-ledger-retired'"),'Same-revision optional failures are not retired from the retry ledger.');
assert(overrideSource.includes("const initialAssets = [...new Set((manifest.seeds || []).filter(Boolean))]"),'Previous package assets can still seed the next dependency crawl.');
assert(!/const initialAssets[^\n]+previousAssets/.test(overrideSource),'Previous package assets still nominate themselves for the next release.');
assert(overrideSource.includes('const preferNetwork = !sameRelease && V211_DISCOVERY_TEXT.test(item.pathname)'),'Same-release retries still force network refreshes for the full text graph.');
assert(overrideSource.includes('const previousDownloadedAssets = sameRelease'),'Per-file resume checkpoints are missing.');
assert(overrideSource.includes('let v211DownloadPromise = null'),'Worker does not serialize concurrent background campus requests.');
assert(overrideSource.includes('let v211PauseRequested = false'),'Worker does not retain pause state.');
assert(overrideSource.includes('self.clients?.matchAll?.'),'Worker does not broadcast progress across PWA navigation.');
assert(overrideSource.includes('backgroundSafe: true'),'Worker does not publish background continuity support.');
assert(overrideSource.includes('resumablePerFile: true'),'Worker does not publish per-file resume support.');
assert(overrideSource.includes('pauseSupported: true'),'Worker does not publish pause support.');
assert(backgroundSource.includes("activeWorker.postMessage({type:'DOWNLOAD_OFFLINE_PACKAGE',background:true"),'Canonical page runtime does not resume the worker-owned download.');
assert(backgroundSource.includes('height:4px'),'Background progress UI is not the requested small bottom rail.');
assert(backgroundSource.includes("navigator.serviceWorker.addEventListener('message'"),'Background progress rail does not receive worker broadcasts.');
assert(!/self\[['"]import['"]\s*\+\s*['"]Scripts['"]\]/.test(coreSource),'Retained core still depends on the temporary wrapper import.');
assert(cleanupSource.includes("const REVISION='living-school-cleanroom-v218'"),'Living School cache retirement revision is missing.');

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
assert(manifest.revision==='canonical-background-campus-v241-systems-mesh-v251','Offline manifest does not preserve the canonical campus graph revision.');
assert(manifest.phoneLedgerRevision==='phone-ledger-r1','Offline manifest does not identify the phone-ledger extension revision.');
for(const asset of ['/app/local-first-policy-v131.js','/app/local-object-mesh-v146.js','/app/shared/civweave-contribution-mesh-v1.js','/app/phone-ledger-bootstrap-v1.js'])assert(manifest.assets.includes(asset),`Offline manifest omits phone-ledger asset ${asset}.`);
for(const retired of ['/app/fullscreen-family-v104.html','/app/services/fellowfare/cabinet.html','/app/services/anarchadia/workbench.html','/app/anarchadia-governance-v145.html','/app/anarchadia-sovereignty-v146.html'])assert(!manifest.seeds.includes(retired),`Retired overlapping seed ${retired} returned to the required crawl.`);

let persisted=null;
const listeners=new Map();
const self={
  addEventListener:(type,handler)=>listeners.set(type,handler),
  clients:{matchAll:async()=>[]}
};
const context=vm.createContext({
  console,Date,Map,Set,Promise,Number,String,Array,Math,URL,RegExp,self,
  VERSION:'1.0.76',OFFLINE_CACHE:'civweave-offline-test',
  offlinePacket:()=>({}),offlineStatus:async()=>({}),downloadOfflinePackage:async()=>({}),
  writeOfflineMeta:async packet=>{persisted=packet;return packet},
  loadOfflineManifest:async()=>({seeds:[]}),readOfflineMeta:async()=>null,
  cacheOfflineAsset:async()=>{throw new Error('not used by metadata tests')},
  discoverReferences:()=>[],TEXT_CONTENT:/text/,post:()=>{}
});
vm.runInContext(overrideSource,context,{filename:'service-worker-offline-v211-override.js'});
const api=self.CivweaveOfflineCampusV211;
assert(api?.revision==='offline-campus-current-graph-v280','Current-graph metadata migration API is unavailable.');
assert(api?.policy==='resumable-pause-v280','Resumable worker policy is unavailable.');
assert(api?.syncTag==='civweave-campus-resume-v280','Resume sync tag is unavailable.');
assert(api?.batchSize===16,'Background API does not publish bounded concurrency 16.');
assert(api?.currentGraphOnly===true,'Current-graph API does not declare current-manifest ownership.');
assert(api?.backgroundSafe===true,'Background continuity flag is missing.');
assert(api?.resumablePerFile===true,'Per-file resume flag is missing.');
assert(api?.pauseSupported===true,'Pause support flag is missing.');
assert(listeners.has('message')&&listeners.has('sync'),'Pause and background-sync listeners were not registered.');

const seeds=Array.from({length:10},(_,index)=>`/app/seed-${index}.html`);
const assets=Array.from({length:205},(_,index)=>`/app/discovered-${index}.js`);
const failedPaths=assets.slice(-19);
const legacy={revision:'offline-campus-current-graph-v238',ready:false,running:true,completed:205,total:205,assets,failed:failedPaths.map(pathname=>({pathname,message:`${pathname} is unavailable.`})),bytes:17*1024*1024};
const migrated=await api.migrateMeta(legacy,{seeds});
assert(migrated.ready===false,'A previous package snapshot incorrectly declared the new dependency graph ready.');
assert(migrated.running===false,'Interrupted old download was incorrectly left running.');
assert(migrated.interrupted===true,'Interrupted old download was not marked for resume.');
assert(migrated.total===205,`Legacy cache candidates should remain visible until the current graph is crawled; received ${migrated.total}.`);
assert(migrated.failedCount===0,'Optional legacy failures remained in the retry queue.');
assert(migrated.skippedCount===19,`Expected 19 quarantined legacy references, received ${migrated.skippedCount}.`);
assert(persisted?.revision==='offline-campus-current-graph-v280','Migrated metadata was not persisted with the v280 graph revision.');

persisted=null;
const haunted={revision:'offline-campus-current-graph-v280',version:'1.0.76',ready:false,running:false,attempted:235,downloaded:218,total:235,assets:[seeds[0],...assets.slice(0,234)],failed:failedPaths.slice(0,17).map(pathname=>({pathname,message:'old retry ghost',required:false})),skipped:[]};
const sanitized=await api.sanitizeRetryMeta(haunted,{seeds});
assert(sanitized.failedCount===0,`Same-revision haunted retry ledger retained ${sanitized.failedCount} optional failures.`);
assert(sanitized.skippedCount===17,`Expected the exact 17 inherited retry ghosts to be retired; got ${sanitized.skippedCount}.`);
assert(sanitized.ready===false,'Sanitizing metadata must still require a current-graph crawl before declaring ready.');
assert(persisted?.failedCount===0,'Sanitized same-revision retry state was not persisted.');

persisted=null;
const requiredFailure=await api.migrateMeta({revision:'lightweight-shell-v208',completed:2,total:2,assets:[seeds[0],'/app/optional.js'],failed:[{pathname:seeds[0],message:'required seed unavailable'}]},{seeds});
assert(requiredFailure.ready===false,'A required seed failure was incorrectly hidden.');
assert(requiredFailure.failedCount===1,'Required seed failure left the retry queue.');
assert(requiredFailure.skippedCount===0,'Required seed failure was quarantined as optional.');

console.log(JSON.stringify({ok:true,revision:api.revision,policy:api.policy,syncTag:api.syncTag,workerComposition:'v218-cleanroom-plus-retained-core-plus-v280-resumable-campus',canonicalSeeds:manifest.seeds.length,phoneLedgerRevision:manifest.phoneLedgerRevision,legacyCacheCandidates:migrated.total,staleReferencesSkipped:migrated.skippedCount,sameRevisionRetryGhostsRetired:sanitized.skippedCount,requiredFailuresPreserved:requiredFailure.failedCount,batchSize:api.batchSize,currentGraphOnly:api.currentGraphOnly,backgroundSafe:api.backgroundSafe,resumablePerFile:api.resumablePerFile,pauseSupported:api.pauseSupported},null,2));