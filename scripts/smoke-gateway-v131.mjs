import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const PORT=18792,origin=`http://127.0.0.1:${PORT}`,VERSION='1.0.4',BUILD='1.0.4-install-only-fullscreen-family-gateway';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dataDir=await mkdtemp(path.join(os.tmpdir(),'commonweave-gateway-v104-')),output=[];
const child=spawn(process.execPath,['scripts/start-commonweave-v131.mjs'],{cwd:root,env:{...process.env,RENDER:'true',HOST:'127.0.0.1',PORT:String(PORT),DATA_DIR:dataDir},stdio:['ignore','pipe','pipe']});
child.stdout.on('data',chunk=>output.push(chunk.toString()));child.stderr.on('data',chunk=>output.push(chunk.toString()));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
async function wait(){let last;for(let i=0;i<80;i+=1){try{const response=await fetch(`${origin}/api/health`,{cache:'no-store'});if(response.ok)return response.json();last=new Error(`health ${response.status}`)}catch(error){last=error}await sleep(200)}throw last||new Error('gateway did not start')}
function requiredDeviceAssets(workerSource){
  const core=workerSource.match(/const CORE=(\[[\s\S]*?\]);\nconst DEVICE_REQUIRED=/);
  const required=workerSource.match(/const DEVICE_REQUIRED=(\[[\s\S]*?\]);\nasync function cacheRequired/);
  assert(core&&required,'service worker device package manifest could not be parsed');
  return Function(`"use strict";const CORE=${core[1]};return ${required[1]};`)();
}
try{
  const health=await wait();
  assert(output.join('').includes('Starting gateway runtime.'),'environment-aware start did not select the gateway on Render');
  assert(health.build===BUILD,`unexpected build ${health.build}`);
  assert(health.appVersion===VERSION,`unexpected version ${health.appVersion}`);
  assert(health.release?.appUrl===`${origin}/`,'release record does not point to the installer doorway');
  assert(health.release?.localInstallRequired===true,'gateway does not require installation');
  const rootResponse=await fetch(`${origin}/`,{cache:'no-store'}),rootHtml=await rootResponse.text();
  assert(rootResponse.ok,'gateway installer root failed');
  assert(rootHtml.includes('Install the five-system Commonweave family.'),'gateway root is not the v1.0.4 install-only page');
  assert(rootHtml.includes('LEAN OFFLINE SOFTWARE PACKAGE'),'gateway root does not describe the lean package');
  assert(rootHtml.includes('/service-worker.js')||rootHtml.includes('install-v130.js'),'gateway root does not boot the installer');
  assert(!rootHtml.includes('Open local campus'),'gateway root exposes browser-mode application access');
  for(const route of ['/loom/','/lite/','/app/realm-console-v140.html','/app/fullscreen-family-v104.html','/app/cabinet-mode-v142.html']){
    const response=await fetch(origin+route,{cache:'no-store'}),body=await response.json();
    assert(response.status===410,`${route} returned ${response.status}, expected install-required 410`);
    assert(body.localInstallRequired===true,`${route} does not explain installation`);
  }
  for(const route of ['/service-worker.js','/app/manifest.webmanifest','/install-v130.js','/install-v130.css','/app/logos/commonweave-icon-192.png']){
    const response=await fetch(origin+route,{cache:'no-store'});
    assert(response.ok,`installer asset ${route} returned ${response.status}`);
  }
  const packageHeaders={'x-commonweave-package':'install'};
  const workerSource=await readFile(path.join(root,'public','service-worker.js'),'utf8');
  const requiredAssets=[...new Set(requiredDeviceAssets(workerSource))];
  for(const route of requiredAssets){
    const response=await fetch(origin+route,{cache:'no-store',headers:{...packageHeaders,range:'bytes=0-0'}});
    assert(response.ok,`required device package asset ${route} returned ${response.status}`);
    await response.arrayBuffer();
  }
  const packageFamily=await fetch(`${origin}/app/fullscreen-family-v104.html`,{cache:'no-store',headers:packageHeaders});
  assert(packageFamily.ok,`marked family host fetch returned ${packageFamily.status}`);
  assert((await packageFamily.text()).includes('id="cwf104-frame"'),'marked package fetch returned the wrong family host');
  const packageLedger=await fetch(`${origin}/app/shared/commonweave-parity-ledger.json`,{cache:'no-store',headers:packageHeaders});
  assert(packageLedger.ok,`marked parity ledger route returned ${packageLedger.status}`);
  assert(packageLedger.headers.get('x-commonweave-device-package')==='parity-ledger','parity ledger response is missing its package marker');
  assert(packageLedger.headers.get('x-commonweave-software-family')==='1.0.4','parity ledger response is missing its software-family marker');
  assert(!packageLedger.headers.get('x-commonweave-cabinet-shells'),'lean parity ledger still advertises cabinet-shell hydration');
  const ledger=await packageLedger.json();
  assert(Array.isArray(ledger.systems)&&ledger.systems.length>=5,'reconstructed parity ledger is missing canonical systems');
  assert(ledger.systems.some(system=>system.id==='commonweave'),'reconstructed parity ledger is missing Commonweave');
  for(const system of ledger.systems)assert(!system.interfaceShell?.asset,`lean parity ledger unexpectedly hydrates ${system.id} cabinet art`);
  for(const route of ['/loom/','/lite/','/cabinetonly/']){
    const response=await fetch(origin+route,{cache:'no-store',headers:packageHeaders});
    assert(response.ok,`marked compatibility route ${route} returned ${response.status}`);
    const text=await response.text();
    assert(text.includes('id="cwf104-frame"'),`marked compatibility route ${route} did not return the full-screen family host`);
  }
  const telemetry=await fetch(`${origin}/api/boot-log`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'room-opened'})});
  assert(telemetry.status===204,`boot telemetry returned ${telemetry.status}`);
  const download=await fetch(`${origin}/downloads/Commonweave-Mobile-Install-Kit.zip`,{redirect:'manual'});
  assert(download.status===302,`download route returned ${download.status}`);
  assert(String(download.headers.get('location')||'').includes('github.com/cerbanimo-dev/Commonweave'),'download route does not redirect to the source release');
  const config=await fetch(`${origin}/api/config`,{cache:'no-store'}).then(response=>response.json());
  assert(config.appUrl===null,'public config advertises a browser-mode application');
  assert(config.installUrl===`${origin}/`,'public config does not advertise the installer');
  assert(config.features.includes('install-only-pwa'),'public config omits install-only mode');
  assert(config.features.includes('device-package-distribution'),'public config omits package distribution');
  assert(config.features.includes('fullscreen-software-family'),'public config omits the full-screen software family');
  assert(!config.features.includes('pwa-hosting'),'public config claims a live hosted PWA');
  console.log(JSON.stringify({ok:true,version:VERSION,build:BUILD,browserApplication:false,installer:true,markedPackageDistribution:true,requiredAssetCount:requiredAssets.length,cabinetShellHydration:false,markedVirtualRoutes:['/app/shared/commonweave-parity-ledger.json','/loom/','/lite/','/cabinetonly/'],ordinaryApplicationRoutes:410,downloadOrigin:'GitHub',gatewayFeatures:config.features},null,2));
}catch(error){console.error(output.join(''));throw error}
finally{child.kill('SIGTERM');await Promise.race([new Promise(resolve=>child.once('exit',resolve)),sleep(1500)]);if(!child.killed)child.kill('SIGKILL');await rm(dataDir,{recursive:true,force:true})}
