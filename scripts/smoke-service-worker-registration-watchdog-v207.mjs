import {readFile,writeFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'..');
await import('./sync-release-version-assets.mjs');
await import('./sync-release-coherence-v220.mjs');
await import('./generate-prelive-metadata-v281.mjs');
const sourcePath=path.join(dir,'smoke-service-worker-registration-watchdog-v207-legacy.mjs');
const runtimePath=path.join(dir,'.smoke-service-worker-registration-watchdog-v207.runtime.mjs');
const installerPath=path.join(root,'public/install-v130.js');
const updaterPath=path.join(root,'public/app/pwa-update-controller-v204.js');
let source=await readFile(sourcePath,'utf8');
const installerSource=await readFile(installerPath,'utf8');
const updaterSource=await readFile(updaterPath,'utf8');
const releaseVersion=(await readFile(path.join(root,'VERSION'),'utf8')).trim();
const revision=installerSource.match(/const\s+WORKER_SCRIPT_REVISION\s*=\s*['"]([^'"]+)['"]/)?.[1];
const updaterVersion=updaterSource.match(/const\s+VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1];
if(!revision)throw new Error('Watchdog verifier could not resolve the current worker revision.');
if(!updaterVersion)throw new Error('Watchdog verifier could not resolve the current updater revision.');
source=source.replaceAll('stable-entry-v217',revision);
source=source.replaceAll('v207-registration-watchdog',updaterVersion);
source=source.replaceAll('1.0.7',releaseVersion);
source=source.replace("const indexSource=await fs.readFile('public/index.html','utf8');","const indexSource=await fs.readFile('public/app/index.html','utf8');");
source=source.replaceAll('context.window=context;','context.addEventListener=()=>{};context.removeEventListener=()=>{};context.window=context;');
source=source.replace("location:{assigned:null,assign(url){this.assigned=String(url)},reload(){}}","location:{pathname:'/',assigned:null,assign(url){this.assigned=String(url)},reload(){}}");
source=source.replace("readyState:'complete',documentElement:{},head:{append(){}}","readyState:'complete',documentElement:{isConnected:true,dataset:{}},head:{isConnected:true,append(){}}");
source=source.replace("body:{append(node){if(node.dataset?.civweaveUpdateControl!==undefined)updateButton=node}}","body:{isConnected:true,append(node){if(node.dataset?.civweaveUpdateControl!==undefined)updateButton=node}}");

const boundaryBefore=`assert(boundarySource.includes("const ADDITIONS_VERSION='${updaterVersion}'"),'Installed pages do not cache-bust the v207 update controller.');`;
const boundaryAfter="assert(boundarySource.includes(\"const PWA_UPDATE_SCRIPT='/app/pwa-update-controller-v204.js'\"),'Installed boundary no longer names the shared update controller.');\nassert(boundarySource.includes('PWA_UPDATE_SCRIPT'),'Installed boundary no longer retains the update controller for noncanonical compatibility surfaces.');\nassert(boundarySource.includes(\"canonicalSubsystemCompatibility:'route-version-settings-only-no-legacy-additions'\"),'Canonical realms no longer declare the minimal startup corridor.');\nassert(boundarySource.includes('const requestedRelease=/^\\\\d+\\\\.\\\\d+\\\\.\\\\d+$/.test(params.get(\\'version\\')||\\'\\')?params.get(\\'version\\'):VERSION;'),'Installed boundary no longer validates the requested release before deriving cache identity.');\nassert(boundarySource.includes('const ADDITIONS_VERSION=`${requestedRelease}-chat-convergence-v250`;'),'Installed boundary does not derive the shared experience cache identity from the active release.');\nassert(!boundarySource.includes(\"const ADDITIONS_VERSION='v1.0.36\"),'Installed boundary restored a frozen shared-experience cache identity.');";
if(!source.includes(boundaryBefore))throw new Error('Watchdog verifier compatibility patch could not find the retired updater additions assertion.');
source=source.replace(boundaryBefore,boundaryAfter);

const statusBefore="assert(statusSource.includes('registration.update()'),'Offline status repair does not force-check the current worker.');";
const statusAfter="assert(!statusSource.includes('registration.update()'),'Offline status reader must not compete with the installer update watchdog.');\nassert(!statusSource.includes('SKIP_WAITING'),'Offline status reader must not activate workers behind the installer watchdog.');\nassert(statusSource.includes('function currentWorker()'),'Offline status reader no longer discovers the current worker.');\nassert(statusSource.includes('civweave:offline-campus-status'),'Offline status reader no longer publishes normalized progress events.');";
if(!source.includes(statusBefore))throw new Error('Watchdog verifier could not find the retired offline-status update assertion.');
source=source.replace(statusBefore,statusAfter);

const workerReadBefore="const workerSource=await fs.readFile('public/service-worker-v203.js','utf8');";
const workerReadAfter="const workerWrapperSource=await fs.readFile('public/service-worker-v203.js','utf8');\nconst workerCoreSource=await fs.readFile('public/service-worker-core-v208.js','utf8');\nconst livingSchoolWorkerSource=await fs.readFile('public/service-worker-living-school-cleanroom-v218.js','utf8');\nconst installerStateWorkerSource=await fs.readFile('public/service-worker-installer-state-v280.js','utf8');\nconst integrityWorkerSource=await fs.readFile('public/service-worker-shell-integrity-v281.js','utf8');\nconst offlineOverrideSource=await fs.readFile('public/service-worker-offline-v211-override.js','utf8');\nconst workerSource=workerWrapperSource+'\\n'+workerCoreSource+'\\n'+installerStateWorkerSource+'\\n'+integrityWorkerSource+'\\n'+offlineOverrideSource;";
if(!source.includes(workerReadBefore))throw new Error('Watchdog verifier could not find the direct worker read.');
source=source.replace(workerReadBefore,workerReadAfter);

const workerAssertionsBefore=`assert(workerSource.startsWith('// GENERATED: lightweight-shell-v208 core + offline-campus-seed-provenance-v211'),'Generated lightweight worker marker is missing.');
assert(workerSource.includes("const BUILD = 'lightweight-shell-v208'"),'Verified lightweight worker core is missing.');
assert(workerSource.includes("const V211_REVISION = 'offline-campus-seed-provenance-v211'"),'Offline retry-loop repair is missing.');`;
const workerAssertionsAfter=`assert(workerWrapperSource.includes("importScripts('/service-worker-living-school-cleanroom-v218.js"),'Active worker wrapper omits Living School cache retirement.');
assert(workerWrapperSource.includes("importScripts('/service-worker-core-v208.js"),'Active worker wrapper omits the retained lightweight core.');
assert(workerWrapperSource.includes("importScripts('/service-worker-installer-state-v280.js"),'Active worker wrapper omits the installer-state asset pin.');
assert(workerWrapperSource.includes("importScripts('/service-worker-shell-integrity-v281.js"),'Active worker wrapper omits shell integrity.');
assert(workerWrapperSource.includes("importScripts('/service-worker-offline-v211-override.js"),'Active worker wrapper omits the offline retry override.');
assert(workerWrapperSource.includes('offline-campus-current-graph-v280'),'Active worker wrapper omits the resumable current-graph offline revision.');
assert(workerWrapperSource.includes('policy=resumable-pause-v280'),'Active worker wrapper omits the resumable/pause policy.');
assert(workerWrapperSource.includes("/service-worker-chat-repair-v245.js?v=chat-bubble-anchor-v342&purge=chat-bubble-anchor-v342"),'Active worker wrapper omits the current stale-chat cache migration.');
assert(workerWrapperSource.indexOf('service-worker-living-school-cleanroom-v218.js')<workerWrapperSource.indexOf('service-worker-core-v208.js'),'Living School retirement does not load before the retained core.');
assert(workerWrapperSource.indexOf('service-worker-core-v208.js')<workerWrapperSource.indexOf('service-worker-installer-state-v280.js'),'Installer-state pin does not load after the core globals.');
assert(workerWrapperSource.indexOf('service-worker-installer-state-v280.js')<workerWrapperSource.indexOf('service-worker-shell-integrity-v281.js'),'Integrity does not see the final required shell asset list.');
assert(workerWrapperSource.indexOf('service-worker-shell-integrity-v281.js')<workerWrapperSource.indexOf('service-worker-offline-v211-override.js'),'Offline override does not load after verified shell staging.');
assert(workerCoreSource.includes("const BUILD = 'lightweight-shell-v208'"),'Verified lightweight worker core is missing.');
assert(installerStateWorkerSource.includes("'/app/installer-storage-guard-v281.js'"),'Installer-state worker does not pin the storage guard.');
assert(integrityWorkerSource.includes("crypto.subtle.digest('SHA-256'")&&integrityWorkerSource.includes('lastKnownGoodCache'),'Verified shell integrity/last-known-good policy is missing.');
assert(offlineOverrideSource.includes("const V211_REVISION = 'offline-campus-current-graph-v280'"),'Resumable current-graph offline retry repair is missing.');
assert(offlineOverrideSource.includes("const V211_POLICY = 'resumable-pause-v280'"),'Resumable campus policy is missing.');
assert(offlineOverrideSource.includes('downloadedAssets')&&offlineOverrideSource.includes('pauseSupported: true'),'Per-file resume/pause contract is missing.');
assert(offlineOverrideSource.includes('stale-not-rediscovered'),'Current-graph repair does not retire stale package assets.');
assert(livingSchoolWorkerSource.includes("const REVISION='living-school-cleanroom-v218'"),'Living School clean-room worker revision is missing.');`;
if(!source.includes(workerAssertionsBefore))throw new Error('Watchdog verifier could not find direct worker assertions.');
source=source.replace(workerAssertionsBefore,workerAssertionsAfter);

await writeFile(runtimePath,source,'utf8');
try{await import(pathToFileURL(runtimePath).href+`?run=${Date.now()}`)}finally{await unlink(runtimePath).catch(()=>{})}
