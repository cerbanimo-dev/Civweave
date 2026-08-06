import {readFile,writeFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'..');
const sourcePath=path.join(dir,'smoke-service-worker-registration-watchdog-v207-legacy.mjs');
const runtimePath=path.join(dir,'.smoke-service-worker-registration-watchdog-v207.runtime.mjs');
const installerPath=path.join(root,'public/install-v130.js');
let source=await readFile(sourcePath,'utf8');
const installerSource=await readFile(installerPath,'utf8');
const revision=installerSource.match(/const\s+WORKER_SCRIPT_REVISION\s*=\s*['"]([^'"]+)['"]/)?.[1];
if(!revision)throw new Error('Watchdog verifier could not resolve the current worker revision.');
source=source.replaceAll('stable-entry-v217',revision);

const boundaryBefore="assert(boundarySource.includes(\"const ADDITIONS_VERSION='v207-registration-watchdog'\"),'Installed pages do not cache-bust the v207 update controller.');";
const boundaryAfter="assert(boundarySource.includes(\"const PWA_UPDATE_SCRIPT='/app/pwa-update-controller-v204.js'\"),'Installed boundary no longer names the shared update controller.');\nassert(boundarySource.includes('addScript(PWA_UPDATE_SCRIPT)'),'Installed boundary no longer loads the shared update controller.');\nassert.match(boundarySource,/const ADDITIONS_VERSION='v[^']+'/,'Installed boundary does not cache-bust shared additions.');";
if(!source.includes(boundaryBefore))throw new Error('Watchdog verifier compatibility patch could not find the retired v207 additions assertion.');
source=source.replace(boundaryBefore,boundaryAfter);

const workerReadBefore="const workerSource=await fs.readFile('public/service-worker-v203.js','utf8');";
const workerReadAfter="const workerWrapperSource=await fs.readFile('public/service-worker-v203.js','utf8');\nconst workerCoreSource=await fs.readFile('public/service-worker-core-v208.js','utf8');\nconst livingSchoolWorkerSource=await fs.readFile('public/service-worker-living-school-cleanroom-v218.js','utf8');\nconst workerSource=workerWrapperSource+'\\n'+workerCoreSource;";
if(!source.includes(workerReadBefore))throw new Error('Watchdog verifier could not find the direct worker read.');
source=source.replace(workerReadBefore,workerReadAfter);

const workerAssertionsBefore=`assert(workerSource.startsWith('// GENERATED: lightweight-shell-v208 core + offline-campus-seed-provenance-v211'),'Generated lightweight worker marker is missing.');
assert(workerSource.includes("const BUILD = 'lightweight-shell-v208'"),'Verified lightweight worker core is missing.');
assert(workerSource.includes("const V211_REVISION = 'offline-campus-seed-provenance-v211'"),'Offline retry-loop repair is missing.');`;
const workerAssertionsAfter=`assert(workerWrapperSource.includes("importScripts('/service-worker-living-school-cleanroom-v218.js"),'Active worker wrapper omits Living School cache retirement.');
assert(workerWrapperSource.includes("importScripts('/service-worker-core-v208.js"),'Active worker wrapper omits the retained lightweight core.');
assert(workerWrapperSource.indexOf('service-worker-living-school-cleanroom-v218.js')<workerWrapperSource.indexOf('service-worker-core-v208.js'),'Living School retirement does not load before the retained core.');
assert(workerCoreSource.startsWith('// GENERATED: lightweight-shell-v208 core + offline-campus-seed-provenance-v211'),'Retained lightweight core marker is missing.');
assert(workerCoreSource.includes("const BUILD = 'lightweight-shell-v208'"),'Verified lightweight worker core is missing.');
assert(workerCoreSource.includes("const V211_REVISION = 'offline-campus-seed-provenance-v211'"),'Offline retry-loop repair is missing.');
assert(livingSchoolWorkerSource.includes("const REVISION='living-school-cleanroom-v218'"),'Living School clean-room worker revision is missing.');`;
if(!source.includes(workerAssertionsBefore))throw new Error('Watchdog verifier could not find direct worker assertions.');
source=source.replace(workerAssertionsBefore,workerAssertionsAfter);

await writeFile(runtimePath,source,'utf8');
try{await import(pathToFileURL(runtimePath).href+`?run=${Date.now()}`)}finally{await unlink(runtimePath).catch(()=>{})}
