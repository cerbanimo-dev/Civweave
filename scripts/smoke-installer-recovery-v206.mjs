import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

await import('./sync-release-version-assets.mjs');
await import('./sync-release-coherence-v220.mjs');
await import('./generate-prelive-metadata-v281.mjs');

const PORT=18806;
const origin=`http://127.0.0.1:${PORT}`;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const releaseVersion=(await readFile(path.join(root,'VERSION'),'utf8')).trim();
const expectedWorkerImport=`importScripts('/service-worker-v203.js?v=${releaseVersion}-code-coherence-v288-lightweight-shell-v208-legacy-v156-bridge-v209-working-campus-return-v425')`;
const dataDir=await mkdtemp(path.join(os.tmpdir(),'civweave-installer-recovery-v281-'));
const output=[];
const child=spawn(process.execPath,['scripts/start-civweave-v131.mjs'],{
  cwd:root,
  env:{...process.env,RENDER:'true',HOST:'127.0.0.1',PORT:String(PORT),DATA_DIR:dataDir},
  stdio:['ignore','pipe','pipe']
});
child.stdout.on('data',chunk=>output.push(chunk.toString()));
child.stderr.on('data',chunk=>output.push(chunk.toString()));

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

async function wait(){
  let last;
  for(let i=0;i<100;i+=1){
    try{
      const response=await fetch(`${origin}/api/health`,{cache:'no-store'});
      if(response.ok)return response.json();
      last=new Error(`health ${response.status}`);
    }catch(error){last=error}
    await sleep(200);
  }
  throw last||new Error('gateway did not start');
}

async function expectRoute(route,{method='GET',headers={},contentType='',status=200}={}){
  const response=await fetch(origin+route,{method,headers,cache:'no-store',redirect:'manual'});
  assert(response.status===status,`${route} returned ${response.status}, expected ${status}`);
  assert(![301,302,307,308].includes(response.status),`${route} redirected instead of serving the package asset`);
  if(contentType)assert(String(response.headers.get('content-type')||'').includes(contentType),`${route} returned ${response.headers.get('content-type')||'no content type'}`);
  if(method!=='HEAD')await response.arrayBuffer();
}

try{
  assert(/^\d+\.\d+\.\d+$/.test(releaseVersion),`Invalid canonical VERSION: ${releaseVersion}`);
  await wait();
  for(const route of [
    '/service-worker-v156.js',
    '/service-worker-v203.js',
    '/service-worker-code-coherence-v288.js',
    '/service-worker-core-v208.js',
    '/service-worker-living-school-cleanroom-v218.js',
    '/service-worker-installer-state-v280.js',
    '/service-worker-shell-integrity-v281.js',
    '/service-worker-offline-v211-override.js',
    '/app/shell-integrity-v281.json',
    '/app/offline-package-v208.json',
    '/app/installer-state-machine-v280.js',
    '/app/installer-storage-guard-v281.js',
    '/app/campus-background-download-v241.js',
    '/app/knowledge-school-installer-v1.css',
    '/app/knowledge-school-seeds-v1.js',
    '/app/knowledge-school-installer-v1.js',
    '/app/pwa-update-controller-v204.js',
    '/app/working-campus-return-guard-v425.js'
  ])await expectRoute(route);
  for(const purpose of ['update-controls','shell-install','offline-manifest','offline-campus']){
    await expectRoute('/app/offline-package-v208.json',{headers:{'x-civweave-package':purpose},contentType:'application/json'});
  }
  await expectRoute('/downloads/knowledge-schools/catalog.json',{contentType:'application/json'});
  const catalog=JSON.parse(await readFile(path.join(root,'public/downloads/knowledge-schools/catalog.json'),'utf8'));
  const firstZip=catalog.schools?.[0]?.zip_file;
  assert(firstZip,'knowledge school catalog has no ZIP records');
  await expectRoute(`/downloads/knowledge-schools/${firstZip}`,{method:'HEAD',contentType:'application/zip'});

  const files={
    wrapper:await readFile(path.join(root,'public/service-worker-v203.js'),'utf8'),
    coherence:await readFile(path.join(root,'public/service-worker-code-coherence-v288.js'),'utf8'),
    core:await readFile(path.join(root,'public/service-worker-core-v208.js'),'utf8'),
    cleanroom:await readFile(path.join(root,'public/service-worker-living-school-cleanroom-v218.js'),'utf8'),
    installer:await readFile(path.join(root,'public/service-worker-installer-state-v280.js'),'utf8'),
    integrity:await readFile(path.join(root,'public/service-worker-shell-integrity-v281.js'),'utf8'),
    offline:await readFile(path.join(root,'public/service-worker-offline-v211-override.js'),'utf8'),
    background:await readFile(path.join(root,'public/app/campus-background-download-v241.js'),'utf8'),
    storage:await readFile(path.join(root,'public/app/installer-storage-guard-v281.js'),'utf8'),
    legacy:await readFile(path.join(root,'public/service-worker-v156.js'),'utf8'),
    base:await readFile(path.join(root,'public/service-worker.js'),'utf8')
  };
  assert(files.base.includes('const BASE_PACKAGE_RECOVERY_REVISION='),'base worker recovery identifier is not isolated');
  assert(!files.base.includes('const PACKAGE_RECOVERY_REVISION='),'generic base worker recovery identifier still collides');

  const cleanImport="importScripts('/service-worker-living-school-cleanroom-v218.js";
  const coherenceImport="importScripts('/service-worker-code-coherence-v288.js";
  const coreImport="importScripts('/service-worker-core-v208.js";
  const installerImport="importScripts('/service-worker-installer-state-v280.js";
  const integrityImport="importScripts('/service-worker-shell-integrity-v281.js";
  const offlineImport="importScripts('/service-worker-offline-v211-override.js";
  for(const token of [cleanImport,coherenceImport,coreImport,installerImport,integrityImport,offlineImport])assert(files.wrapper.includes(token),`active worker is missing ${token}`);
  assert(files.wrapper.includes('working-campus-return-v425'),'active worker does not force the v425 return-guard epoch');
  assert(files.wrapper.includes('offline-campus-current-graph-v280')&&files.wrapper.includes('policy=resumable-pause-v280'),'active worker does not carry the v280 resumable campus policy');
  assert(files.wrapper.indexOf(cleanImport)<files.wrapper.indexOf(coherenceImport)&&files.wrapper.indexOf(coherenceImport)<files.wrapper.indexOf(coreImport)&&files.wrapper.indexOf(coreImport)<files.wrapper.indexOf(installerImport)&&files.wrapper.indexOf(installerImport)<files.wrapper.indexOf(integrityImport)&&files.wrapper.indexOf(integrityImport)<files.wrapper.indexOf(offlineImport),'worker hardening layer order is incorrect');
  assert(files.coherence.includes("const CW_CODE_COHERENCE_VERSION = '1.0.91-code-coherence-v288'")&&files.coherence.includes('event.stopImmediatePropagation()')&&files.coherence.includes("'/app/local-ai/bootstrap-v266.js'"),'v288 executable-code coherence layer is incomplete');
  assert(files.core.includes("const BUILD = 'lightweight-shell-v208-installer-brand-v1-working-campus-return-v425'")&&files.core.includes("'/app/working-campus-return-guard-v425.js'")&&files.core.includes('DOWNLOAD_OFFLINE_PACKAGE'),'retained lightweight/offline core is incomplete');
  assert(!/importScripts\(/.test(files.core),'retained lightweight core imports the retired layered stack');
  assert(files.cleanroom.includes("const REVISION='living-school-cleanroom-v218'")&&files.cleanroom.includes('event.stopImmediatePropagation()'),'Living School worker retirement boundary is incomplete');
  assert(files.installer.includes("'/app/installer-storage-guard-v281.js'"),'installer state worker does not pin the storage guard');
  assert(files.integrity.includes("crypto.subtle.digest('SHA-256'")&&files.integrity.includes('STAGING_CACHE')&&files.integrity.includes('lastKnownGoodCache'),'verified shell staging/last-known-good fallback is incomplete');
  assert(
    files.offline.includes("const V211_REVISION = 'offline-campus-current-graph-v280'")&&
    files.offline.includes("const V211_POLICY = 'resumable-pause-v280'")&&
    files.offline.includes("const V211_SYNC_TAG = 'civweave-campus-resume-v280'")&&
    files.offline.includes('downloadedAssets')&&
    files.offline.includes('joinedExisting: true')&&
    files.offline.includes('pauseSupported: true')&&
    files.offline.includes('resumablePerFile: true')&&
    files.offline.includes('backgroundSafe: true'),
    'resumable current-graph offline retry override is incomplete'
  );
  assert(files.background.includes('DOWNLOAD_OFFLINE_PACKAGE')&&files.background.includes('height:4px')&&files.background.includes("navigator.serviceWorker.addEventListener('message'"),'canonical page background campus continuation is incomplete');
  assert(files.storage.includes('requiredFreeBytes')&&files.storage.includes('navigator.storage'),'installer storage preflight is incomplete');
  assert(files.legacy.includes(expectedWorkerImport),`legacy worker does not import the active ${releaseVersion} v425 wrapper`);

  const bridgeBody=files.legacy.replace(/importScripts\('\/service-worker-v203\.js[^\n]+\);/,'');
  new vm.Script(`${bridgeBody}\n${files.cleanroom}\n${files.coherence}\n${files.core}\n${files.installer}\n${files.integrity}\n${files.offline}`,{filename:'civweave-v288-bridged-worker.js'});
  console.log(JSON.stringify({
    ok:true,
    releaseVersion,
    directInstallerAssets:19,
    packagePurposeHeadersAccepted:4,
    knowledgeCatalogServed:true,
    knowledgeZipServed:firstZip,
    workerGlobalCollision:false,
    codeCoherence:true,
    backgroundCampus:true,
    storagePreflight:true,
    shellIntegrity:true,
    workingCampusReturn:'v425',
    workerRevision:'v288-code-coherence-v281-integrity-v280-resumable-campus-v425'
  },null,2));
}catch(error){
  console.error(output.join(''));
  throw error;
}finally{
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolve=>child.once('exit',resolve)),sleep(1500)]);
  if(!child.killed)child.kill('SIGKILL');
  await rm(dataDir,{recursive:true,force:true});
}