import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const PORT=18806;
const origin=`http://127.0.0.1:${PORT}`;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dataDir=await mkdtemp(path.join(os.tmpdir(),'commonweave-installer-recovery-v206-'));
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
    '/app/knowledge-school-installer-v1.css',
    '/app/knowledge-school-seeds-v1.js',
    '/app/knowledge-school-installer-v1.js',
    '/app/pwa-update-controller-v204.js'
  ])await expectRoute(route);
  await expectRoute('/app/pwa-update-controller-v204.js',{headers:{'x-commonweave-package':'update-controls'}});
  await expectRoute('/downloads/knowledge-schools/catalog.json',{contentType:'application/json'});
  const catalog=JSON.parse(await readFile(path.join(root,'public/downloads/knowledge-schools/catalog.json'),'utf8'));
  const firstZip=catalog.schools?.[0]?.zip_file;
  assert(firstZip,'knowledge school catalog has no ZIP records');
  await expectRoute(`/downloads/knowledge-schools/${firstZip}`,{method:'HEAD',contentType:'application/zip'});

  const files={
    shell:await readFile(path.join(root,'public/service-worker-v203.js'),'utf8'),
    images:await readFile(path.join(root,'public/service-worker-shared-images-v203.js'),'utf8'),
    update:await readFile(path.join(root,'public/service-worker-update-v204.js'),'utf8'),
    critical:await readFile(path.join(root,'public/service-worker-critical-v199.js'),'utf8'),
    composite:await readFile(path.join(root,'public/service-worker-v156.js'),'utf8'),
    base:await readFile(path.join(root,'public/service-worker.js'),'utf8')
  };
  assert(files.base.includes('const BASE_PACKAGE_RECOVERY_REVISION='),'base worker recovery identifier is not isolated');
  assert(!files.base.includes('const PACKAGE_RECOVERY_REVISION='),'generic base worker recovery identifier still collides');
  assert(files.shell.includes('update-recovery-v206'),'top-level worker revision was not bumped');
  assert(files.composite.includes('base-r53-isolated-recovery-v206'),'composite worker still imports the colliding base revision');
  const stripImports=source=>source.replace(/^importScripts\([^\n]+\);\s*$/gm,'');
  new vm.Script([
    files.images,
    files.update,
    files.critical,
    files.base,
    stripImports(files.composite)
  ].join('\n'),{filename:'commonweave-composite-service-worker-v206.js'});

  const gateway=await readFile(path.join(root,'server-gateway-v131.mjs'),'utf8');
  for(const token of [
    "['install','update-controls'].includes",
    "pathname === '/app/knowledge-school-seeds-v1.js'",
    "pathname === '/app/pwa-update-controller-v204.js'",
    "pathname.startsWith('/downloads/knowledge-schools/')"
  ])assert(gateway.includes(token),`gateway recovery is missing ${token}`);
  console.log(JSON.stringify({
    ok:true,
    directInstallerAssets:4,
    updateHeaderAccepted:true,
    knowledgeCatalogServed:true,
    knowledgeZipServed:firstZip,
    workerGlobalCollision:false,
    workerRevision:'v206'
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
