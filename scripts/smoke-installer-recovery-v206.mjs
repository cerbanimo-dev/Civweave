import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const PORT=18806;
const origin=`http://127.0.0.1:${PORT}`;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dataDir=await mkdtemp(path.join(os.tmpdir(),'commonweave-installer-recovery-v209-'));
const output=[];
const child=spawn(process.execPath,['scripts/start-commonweave-v131.mjs'],{
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
    try{const response=await fetch(`${origin}/api/health`,{cache:'no-store'});if(response.ok)return response.json();last=new Error(`health ${response.status}`)}catch(error){last=error}
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
  await wait();
  for(const route of [
    '/service-worker-v156.js',
    '/service-worker-v203.js',
    '/app/offline-package-v208.json',
    '/app/knowledge-school-installer-v1.css',
    '/app/knowledge-school-seeds-v1.js',
    '/app/knowledge-school-installer-v1.js',
    '/app/pwa-update-controller-v204.js'
  ])await expectRoute(route);
  for(const purpose of ['update-controls','shell-install','offline-manifest','offline-campus']){
    await expectRoute('/app/offline-package-v208.json',{headers:{'x-commonweave-package':purpose},contentType:'application/json'});
  }
  await expectRoute('/downloads/knowledge-schools/catalog.json',{contentType:'application/json'});
  const catalog=JSON.parse(await readFile(path.join(root,'public/downloads/knowledge-schools/catalog.json'),'utf8'));
  const firstZip=catalog.schools?.[0]?.zip_file;
  assert(firstZip,'knowledge school catalog has no ZIP records');
  await expectRoute(`/downloads/knowledge-schools/${firstZip}`,{method:'HEAD',contentType:'application/zip'});

  const files={
    active:await readFile(path.join(root,'public/service-worker-v203.js'),'utf8'),
    legacy:await readFile(path.join(root,'public/service-worker-v156.js'),'utf8'),
    base:await readFile(path.join(root,'public/service-worker.js'),'utf8')
  };
  assert(files.base.includes('const BASE_PACKAGE_RECOVERY_REVISION='),'base worker recovery identifier is not isolated');
  assert(!files.base.includes('const PACKAGE_RECOVERY_REVISION='),'generic base worker recovery identifier still collides');
  assert(files.active.includes("const BUILD = 'lightweight-shell-v208'"),'active worker is not the lightweight shell');
  assert(!/importScripts\(/.test(files.active),'active lightweight worker imports the retired layered stack');
  assert(files.active.includes('DOWNLOAD_OFFLINE_PACKAGE'),'active worker lacks resumable campus hydration');
  assert(files.legacy.includes('legacy-v156-bridge-v209'),'legacy worker bridge revision is missing');
  assert(files.legacy.includes("importScripts('/service-worker-v203.js?v=1.0.6-lightweight-shell-v208-legacy-v156-bridge-v209')"),'legacy worker does not import the active lightweight worker');
  assert(!/^[ \t]*importScripts\('\/service-worker\.js/m.test(files.legacy),'legacy bridge executes the retired base worker');
  assert(!/^[ \t]*importScripts\('\/service-worker-critical-v199\.js/m.test(files.legacy),'legacy bridge executes the retired critical coordinator');
  const bridgeBody=files.legacy.replace(/importScripts\('\/service-worker-v203\.js[^\n]+\);/,'');
  new vm.Script(`${bridgeBody}\n${files.active}`,{filename:'commonweave-v209-bridged-lightweight-worker.js'});

  const gateway=await readFile(path.join(root,'server-gateway-v131.mjs'),'utf8');
  for(const token of [
    "const packageInstall = Boolean(String(req.headers['x-commonweave-package'] || '').trim())",
    "pathname === '/service-worker-v203.js'",
    "pathname === '/app/knowledge-school-seeds-v1.js'",
    "pathname === '/app/pwa-update-controller-v204.js'",
    "pathname.startsWith('/downloads/knowledge-schools/')"
  ])assert(gateway.includes(token),`gateway recovery is missing ${token}`);
  console.log(JSON.stringify({
    ok:true,
    directInstallerAssets:7,
    packagePurposeHeadersAccepted:4,
    knowledgeCatalogServed:true,
    knowledgeZipServed:firstZip,
    workerGlobalCollision:false,
    workerRevision:'v209-legacy-bridge-lightweight-shell'
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
