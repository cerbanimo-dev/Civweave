import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const root=path.join(repo,'public','downloads','knowledge-schools');
const catalogPath=path.join(root,'catalog.json');
const maxCloudflareAssetBytes=24*1024*1024;
const read=relative=>fs.readFile(path.join(repo,relative),'utf8');
const assertIncludes=(source,tokens,label)=>{for(const token of tokens)if(!source.includes(token))throw new Error(`${label} is missing ${token}`)};
const assertMatches=(source,pattern,label)=>{if(!pattern.test(source))throw new Error(`${label} is missing ${pattern}`)};
async function sha256(file){const data=await fs.readFile(file);return crypto.createHash('sha256').update(data).digest('hex')}

const catalog=JSON.parse(await fs.readFile(catalogPath,'utf8'));
if(catalog.schema!=='civweave.knowledge-school-catalog.v1')throw new Error('Unexpected knowledge-school catalog schema.');
if(!Array.isArray(catalog.schools)||catalog.schools.length!==11)throw new Error(`Expected 11 schools, found ${catalog.schools?.length??0}.`);
const articleCount=catalog.schools.reduce((sum,school)=>sum+Number(school.counts?.articles||0),0);
if(articleCount!==1001)throw new Error(`Expected 1001 articles, found ${articleCount}.`);
if(catalog.reconciliation?.crossroads_articles!==0||catalog.reconciliation?.crossroads_titles?.length)throw new Error('Knowledge-school catalog still contains unassigned crossroads articles.');
const slugs=new Set();let compressedBytes=0;
for(const school of catalog.schools){
  if(!school.school_slug||slugs.has(school.school_slug))throw new Error(`Duplicate or missing school slug: ${school.school_slug}`);
  slugs.add(school.school_slug);
  if(!String(school.zip_file).startsWith('schools/')||String(school.zip_file).includes('..'))throw new Error(`Unsafe school ZIP path: ${school.zip_file}`);
  const file=path.join(root,school.zip_file),stat=await fs.stat(file);
  if(!stat.isFile())throw new Error(`Missing school ZIP: ${school.zip_file}`);
  if(stat.size!==Number(school.zip_bytes))throw new Error(`Size mismatch for ${school.zip_file}: ${stat.size} != ${school.zip_bytes}`);
  if(stat.size>maxCloudflareAssetBytes)throw new Error(`${school.zip_file} exceeds the 24 MiB release-asset boundary.`);
  if(await sha256(file)!==school.zip_sha256)throw new Error(`SHA-256 mismatch for ${school.zip_file}`);
  compressedBytes+=stat.size;
}
for(const [name,batch] of Object.entries(catalog.recommended_batches||{})){
  if(!Array.isArray(batch)||!batch.length)throw new Error(`Empty recommended batch: ${name}`);
  for(const slug of batch)if(!slugs.has(slug))throw new Error(`Batch ${name} references unknown school ${slug}`);
}
if((catalog.recommended_batches?.['complete-foundations']||[]).length!==11)throw new Error('complete-foundations must include all eleven schools.');
for(const relative of ['catalog.json','civweave-school-catalog.sqlite','RECONCILIATION.json','SHA256SUMS','README.md','batch_unpack_schools.py']){
  const stat=await fs.stat(path.join(root,relative));if(!stat.isFile())throw new Error(`Missing knowledge-school support file: ${relative}`);
}

const [index,helper,installer,installRuntime,boundary,installedEntry,updateController,updateWorker,workerWrapper,workerCore,installerStateWorker,integrityWorker,offlineOverride,storageGuard,cleanroomWorker]=await Promise.all([
  read('public/app/index.html'),read('public/app/knowledge-school-seeds-v1.js'),read('public/app/knowledge-school-installer-v1.js'),
  read('public/install-v130.js'),read('public/app/install-boundary-v146.js'),read('public/app/installed-entry-v146.js'),read('public/app/pwa-update-controller-v204.js'),
  read('public/service-worker-update-v204.js'),read('public/service-worker-v203.js'),read('public/service-worker-core-v208.js'),
  read('public/service-worker-installer-state-v280.js'),read('public/service-worker-shell-integrity-v281.js'),read('public/service-worker-offline-v211-override.js'),
  read('public/app/installer-storage-guard-v281.js'),read('public/service-worker-living-school-cleanroom-v218.js')
]);
assertIncludes(index,['knowledge-school-list','knowledge-school-seeds-v1.js','knowledge-school-installer-v1.js','data-lazy-offline-tools','Optional tools are dormant until this section is used.'],'installer page');
assertIncludes(helper,["CACHE_NAME='cwknowledge-school-seeds-v2'","LEGACY_CACHE_NAMES=['civweave-knowledge-schools-v1']",'migrateLegacyCaches','cachedCurrent','navigator.storage.persist()','async function save(',"phase:'cached'",'record?.download_url','legacySeedUrl','seedUrls','matchCachedSeed','X-Civweave-Source-URL'],'knowledge helper');
if(helper.includes('serviceWorker.register'))throw new Error('Optional school staging must not register or replace the core service worker.');
assertIncludes(installer,['neededSchools','Save selected library','Download ${needed.length}',"progress.phase==='cached'",'saved offline'],'knowledge installer');
assertMatches(installRuntime,/const\s+LIBRARY_CACHE\s*=\s*['"]cwknowledge-school-seeds-v2['"]/, 'app installer protected library cache');
assertIncludes(installRuntime,['migrateKnowledgeCache','protectedCache','waitForCurrentWorker'],'app installer runtime');
assertIncludes(boundary,["const PWA_UPDATE_SCRIPT='/app/pwa-update-controller-v204.js'",'PWA_UPDATE_SCRIPT',"guideWorkspaceRevision:'v250-v242-canonical-owner'", "campusBackgroundDownloadRevision:'v241-worker-owned-download-bottom-progress-rail'"],'install boundary');
assertIncludes(installedEntry,["updateViaCache:'none'",'await registration.update()',"candidate.postMessage({type:'SKIP_WAITING'})","fetch(`/app/manifest.webmanifest?boot=${Date.now()}`,{cache:'no-store'})"],'updater-first installed entry');
if(installedEntry.indexOf('await refreshWorker(releaseVersion)')>installedEntry.indexOf('const requested='))throw new Error('Installed entry routes before refreshing the worker.');
assertIncludes(updateController,['data-civweave-update-control',"setState('Check updates'","setState('Restart to update'",'withTimeout(registration.update()','migrateKnowledgeCache',"const LIBRARY_CACHE='cwknowledge-school-seeds-v2'"],'installed update controller');
assertIncludes(updateWorker,["const CACHE='cwupdate-visible-v207'","'/app/pwa-update-controller-v204.js'","knowledgeCache:'cwknowledge-school-seeds-v2'"],'update service-worker lane');
assertIncludes(workerWrapper,[
  "importScripts('/service-worker-living-school-cleanroom-v218.js",
  "importScripts('/service-worker-core-v208.js",
  "importScripts('/service-worker-installer-state-v280.js",
  "importScripts('/service-worker-shell-integrity-v281.js",
  "importScripts('/service-worker-offline-v211-override.js",
  'offline-campus-current-graph-v280','policy=resumable-pause-v280',
  "/service-worker-chat-repair-v245.js?v=chat-css-contract-v343&purge=chat-css-contract-v343"
],'active worker wrapper');
if(!(
  workerWrapper.indexOf('service-worker-living-school-cleanroom-v218.js')<workerWrapper.indexOf('service-worker-core-v208.js')&&
  workerWrapper.indexOf('service-worker-core-v208.js')<workerWrapper.indexOf('service-worker-installer-state-v280.js')&&
  workerWrapper.indexOf('service-worker-installer-state-v280.js')<workerWrapper.indexOf('service-worker-shell-integrity-v281.js')&&
  workerWrapper.indexOf('service-worker-shell-integrity-v281.js')<workerWrapper.indexOf('service-worker-offline-v211-override.js')
))throw new Error('Hardened worker composition order is incorrect.');
assertIncludes(workerCore,['lightweight-shell-v208',"'cwupdate-'",'DOWNLOAD_OFFLINE_PACKAGE'],'retained service-worker core');
assertIncludes(installerStateWorker,["'/app/installer-storage-guard-v281.js'",'shellRequired: true','campusAutostartRequired: false'],'installer state worker');
if(installerStateWorker.includes("'/app/required-campus-autostart-v1.js'"))throw new Error('Disabled campus autostart must not be pinned into the installer shell.');
assertIncludes(integrityWorker,["crypto.subtle.digest('SHA-256'",'STAGING_CACHE','lastKnownGoodCache','Integrity mismatch'],'shell integrity worker');
assertIncludes(offlineOverride,[
  'offline-campus-current-graph-v280',"V211_POLICY = 'resumable-pause-v280'","V211_SYNC_TAG = 'civweave-campus-resume-v280'",
  'CivweaveOfflineCampusV211','current-manifest-only-v282','skipped: []','skippedCount: 0','V211_BATCH_SIZE = 16','downloadedAssets','pauseSupported: true','resumablePerFile: true','backgroundSafe: true'
],'offline retry override');
assertIncludes(storageGuard,['navigator.storage','requiredFreeBytes',"civweaveStorageState='insufficient'"],'campus storage guard');
assertIncludes(cleanroomWorker,["const REVISION='living-school-cleanroom-v218'",'event.stopImmediatePropagation()'],'Living School cache boundary');
for(const source of [helper,installer,installRuntime,boundary,installedEntry,updateController,updateWorker,workerWrapper,workerCore,installerStateWorker,integrityWorker,offlineOverride,storageGuard,cleanroomWorker])new Function(source);
console.log(JSON.stringify({schools:catalog.schools.length,articles:articleCount,compressedBytes,compressedMiB:Number((compressedBytes/1024/1024).toFixed(2)),largestSchoolMiB:Number((Math.max(...catalog.schools.map(school=>school.zip_bytes))/1024/1024).toFixed(2)),crossroads:catalog.reconciliation.crossroads_articles,knowledgeCache:'cwknowledge-school-seeds-v2',externalOriginReady:true,legacyOriginCacheCompatible:true,installedUpdateOwner:'installed-entry-v146',manualUpdateControl:'visible-v207-registration-watchdog',workerComposition:'v281-integrity-v280-resumable-campus-v343-chat-css-repair',currentFilesSkipRedownload:true,backgroundCampus:true,storagePreflight:true,shellIntegrity:true},null,2));
