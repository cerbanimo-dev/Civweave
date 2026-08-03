import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const PORT=18792,origin=`http://127.0.0.1:${PORT}`,VERSION='1.0.32',BUILD='1.0.32-install-only-package-gateway';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dataDir=await mkdtemp(path.join(os.tmpdir(),'commonweave-gateway-v131-')),output=[];
const child=spawn(process.execPath,['scripts/start-commonweave-v131.mjs'],{cwd:root,env:{...process.env,RENDER:'true',HOST:'127.0.0.1',PORT:String(PORT),DATA_DIR:dataDir},stdio:['ignore','pipe','pipe']});
child.stdout.on('data',chunk=>output.push(chunk.toString()));child.stderr.on('data',chunk=>output.push(chunk.toString()));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
async function wait(){let last;for(let i=0;i<80;i+=1){try{const response=await fetch(`${origin}/api/health`,{cache:'no-store'});if(response.ok)return response.json();last=new Error(`health ${response.status}`)}catch(error){last=error}await sleep(200)}throw last||new Error('gateway did not start')}
try{
  const health=await wait();
  assert(output.join('').includes('Starting gateway runtime.'),'environment-aware start did not select the gateway on Render');
  assert(health.build===BUILD,`unexpected build ${health.build}`);
  assert(health.appVersion===VERSION,`unexpected version ${health.appVersion}`);
  assert(health.release?.appUrl===`${origin}/`,'release record does not point to the installer doorway');
  assert(health.release?.localInstallRequired===true,'gateway does not require installation');
  const rootResponse=await fetch(`${origin}/`,{cache:'no-store'}),rootHtml=await rootResponse.text();
  assert(rootResponse.ok,'gateway installer root failed');
  assert(rootHtml.includes('Install Commonweave to enter the campus.'),'gateway root is not the install-only page');
  assert(rootHtml.includes('/service-worker.js')||rootHtml.includes('install-v130.js'),'gateway root does not boot the installer');
  assert(!rootHtml.includes('Open local campus'),'gateway root exposes browser-mode application access');
  for(const route of ['/loom/','/lite/','/app/realm-console-v140.html','/app/cabinet-mode-v142.html']){
    const response=await fetch(origin+route,{cache:'no-store'}),body=await response.json();
    assert(response.status===410,`${route} returned ${response.status}, expected install-required 410`);
    assert(body.localInstallRequired===true,`${route} does not explain installation`);
  }
  for(const route of ['/service-worker.js','/app/manifest.webmanifest','/install-v130.js','/install-v130.css','/app/logos/commonweave-icon-192.png']){
    const response=await fetch(origin+route,{cache:'no-store'});
    assert(response.ok,`installer asset ${route} returned ${response.status}`);
  }
  const packageHeaders={'x-commonweave-package':'install'};
  const packageAsset=await fetch(`${origin}/app/realm-console-v140.html`,{cache:'no-store',headers:packageHeaders});
  assert(packageAsset.ok,`marked device-package fetch returned ${packageAsset.status}`);
  assert((await packageAsset.text()).includes('Commonweave Realm Console'),'marked package fetch returned the wrong document');
  const packageLoom=await fetch(`${origin}/loom/`,{cache:'no-store',headers:packageHeaders});
  assert(packageLoom.ok,`marked Loom package route returned ${packageLoom.status}`);
  const loomText=await packageLoom.text();
  assert(loomText.includes('/app/assets/world/town-square-home.webp'),'marked Loom package route returned the wrong hub document');
  const packageLite=await fetch(`${origin}/lite/`,{cache:'no-store',headers:packageHeaders});
  assert(packageLite.ok,`marked Lite package route returned ${packageLite.status}`);
  const liteText=await packageLite.text();
  assert(liteText.includes('id="cabinet-link"'),'marked Lite package route returned the wrong document');
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
  assert(!config.features.includes('pwa-hosting'),'public config claims a live hosted PWA');
  console.log(JSON.stringify({ok:true,version:VERSION,build:BUILD,browserCampus:false,installer:true,markedPackageDistribution:true,markedVirtualRoutes:['/loom/','/lite/'],ordinaryApplicationRoutes:410,downloadOrigin:'GitHub',gatewayFeatures:config.features},null,2));
}catch(error){console.error(output.join(''));throw error}
finally{child.kill('SIGTERM');await Promise.race([new Promise(resolve=>child.once('exit',resolve)),sleep(1500)]);if(!child.killed)child.kill('SIGKILL');await rm(dataDir,{recursive:true,force:true})}
