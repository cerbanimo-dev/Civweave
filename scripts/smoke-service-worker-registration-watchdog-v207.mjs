import {readFile,writeFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'..');
await import('./sync-release-version-assets.mjs');
await import('./sync-release-coherence-v220.mjs');
await import('./generate-prelive-metadata-v281.mjs');

const legacyPath=path.join(dir,'smoke-service-worker-registration-watchdog-v207-legacy.mjs');
const runtimePath=path.join(dir,'.smoke-service-worker-registration-watchdog-v207.runtime.mjs');
const installer=await readFile(path.join(root,'public/install-v130.js'),'utf8');
const updater=await readFile(path.join(root,'public/app/pwa-update-controller-v204.js'),'utf8');
const release=(await readFile(path.join(root,'VERSION'),'utf8')).trim();
const revision=installer.match(/const\s+WORKER_SCRIPT_REVISION\s*=\s*['"]([^'"]+)['"]/)?.[1];
const updaterVersion=updater.match(/const\s+VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1];
if(!revision||!updaterVersion)throw new Error('Could not resolve current watchdog revisions.');

let source=await readFile(legacyPath,'utf8');
const replace=(before,after,label)=>{
  if(!source.includes(before))throw new Error(`Watchdog compatibility patch missed ${label}.`);
  source=source.replace(before,after);
};
source=source.replaceAll('stable-entry-v217',revision).replaceAll('v207-registration-watchdog',updaterVersion).replaceAll('1.0.7',release);
replace("const indexSource=await fs.readFile('public/index.html','utf8');","const indexSource=await fs.readFile('public/app/index.html','utf8');",'installer entry path');
source=source.replaceAll('context.window=context;','context.addEventListener=()=>{};context.removeEventListener=()=>{};context.window=context;');
replace("location:{assigned:null,assign(url){this.assigned=String(url)},reload(){}}","location:{pathname:'/',assigned:null,assign(url){this.assigned=String(url)},reload(){}}",'location fixture');
replace("readyState:'complete',documentElement:{},head:{append(){}}","readyState:'complete',documentElement:{isConnected:true,dataset:{}},head:{isConnected:true,append(){}}",'document fixture');
replace("body:{append(node){if(node.dataset?.civweaveUpdateControl!==undefined)updateButton=node}}","body:{isConnected:true,append(node){if(node.dataset?.civweaveUpdateControl!==undefined)updateButton=node}}",'body fixture');

replace(
  `assert(boundarySource.includes("const ADDITIONS_VERSION='${updaterVersion}'"),'Installed pages do not cache-bust the v207 update controller.');`,
  "assert(boundarySource.includes(\"const PWA_UPDATE_SCRIPT='/app/pwa-update-controller-v204.js'\"),'Installed boundary lost the shared update controller.');\nassert(boundarySource.includes(\"navigationLifecycleRevision:'v424-head-capture-bfcache-resume'\"),'Installed boundary lost BFCache resume support.');",
  'retired additions cache assertion'
);
replace(
  "assert(indexSource.includes('offline-retry-loop-v211'),'Gateway does not cache-bust the retry-loop repair.');",
  `assert(indexSource.includes('/install-v130.js?v=${release}-lightweight-shell-v208'),'Gateway no longer pins the current installer release.');`,
  'retired gateway retry token'
);
replace(
  "assert(statusSource.includes('registration.update()'),'Offline status repair does not force-check the current worker.');",
  "assert(!statusSource.includes('registration.update()'),'Offline status reader must not compete with the installer watchdog.');\nassert(statusSource.includes('function currentWorker()'),'Offline status reader lost current-worker discovery.');",
  'retired offline-status updater ownership'
);
replace(
  "const workerSource=await fs.readFile('public/service-worker-v203.js','utf8');",
  "const workerWrapperSource=await fs.readFile('public/service-worker-v203.js','utf8');\nconst workerCoreSource=await fs.readFile('public/service-worker-core-v208.js','utf8');\nconst livingSchoolWorkerSource=await fs.readFile('public/service-worker-living-school-cleanroom-v218.js','utf8');\nconst installerStateWorkerSource=await fs.readFile('public/service-worker-installer-state-v280.js','utf8');\nconst integrityWorkerSource=await fs.readFile('public/service-worker-shell-integrity-v281.js','utf8');\nconst offlineOverrideSource=await fs.readFile('public/service-worker-offline-v211-override.js','utf8');\nconst workerSource=workerWrapperSource+'\\n'+workerCoreSource+'\\n'+installerStateWorkerSource+'\\n'+integrityWorkerSource+'\\n'+offlineOverrideSource;",
  'layered worker reads'
);
replace(
  `assert(workerSource.startsWith('// GENERATED: lightweight-shell-v208 core + offline-campus-seed-provenance-v211'),'Generated lightweight worker marker is missing.');\nassert(workerSource.includes("const BUILD = 'lightweight-shell-v208'"),'Verified lightweight worker core is missing.');\nassert(workerSource.includes("const V211_REVISION = 'offline-campus-seed-provenance-v211'"),'Offline retry-loop repair is missing.');`,
  `assert(workerWrapperSource.includes("importScripts('/service-worker-core-v208.js"),'Active worker wrapper lost the retained core.');\nassert(workerWrapperSource.includes("importScripts('/service-worker-offline-v211-override.js"),'Active worker wrapper lost the offline retry override.');\nassert(workerWrapperSource.includes('offline-campus-current-graph-v280'),'Active worker wrapper lost the current offline graph revision.');\nassert(workerWrapperSource.includes('policy=resumable-pause-v280'),'Active worker wrapper lost the resumable policy.');\nassert(workerCoreSource.includes("const BUILD = 'lightweight-shell-v208-installer-brand-v1-working-campus-return-v425'"),'Worker core lost the current cache epoch.');\nassert(installerStateWorkerSource.includes("'/app/installer-storage-guard-v281.js'"),'Installer-state worker lost the storage guard.');\nassert(integrityWorkerSource.includes('lastKnownGoodCache'),'Shell integrity lost last-known-good recovery.');\nassert(offlineOverrideSource.includes("const V211_REVISION = 'offline-campus-current-graph-v280'"),'Offline override lost the current graph revision.');\nassert(livingSchoolWorkerSource.includes("const REVISION='living-school-cleanroom-v218'"),'Living School worker revision is missing.');`,
  'retired monolithic worker assertions'
);

await writeFile(runtimePath,source,'utf8');
try{
  await import(pathToFileURL(runtimePath).href+`?run=${Date.now()}`);
}catch(error){
  console.error(`::error title=Service Worker Registration Watchdog v207::${String(error?.message||error).replace(/[\r\n%]/g,' ')}`);
  throw error;
}finally{
  await unlink(runtimePath).catch(()=>{});
}
