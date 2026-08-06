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

const before="assert(boundarySource.includes(\"const ADDITIONS_VERSION='v207-registration-watchdog'\"),'Installed pages do not cache-bust the v207 update controller.');";
const after="assert(boundarySource.includes(\"const PWA_UPDATE_SCRIPT='/app/pwa-update-controller-v204.js'\"),'Installed boundary no longer names the shared update controller.');\nassert(boundarySource.includes('addScript(PWA_UPDATE_SCRIPT)'),'Installed boundary no longer loads the shared update controller.');\nassert.match(boundarySource,/const ADDITIONS_VERSION='v[^']+'/,'Installed boundary does not cache-bust shared additions.');";
if(!source.includes(before))throw new Error('Watchdog verifier compatibility patch could not find the retired v207 additions assertion.');
source=source.replace(before,after);

await writeFile(runtimePath,source,'utf8');
try{
  await import(pathToFileURL(runtimePath).href+`?run=${Date.now()}`);
}finally{
  await unlink(runtimePath).catch(()=>{});
}
