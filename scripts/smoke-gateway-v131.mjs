import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const PORT=18792,origin=`http://127.0.0.1:${PORT}`,VERSION='1.0.31',BUILD='1.0.31-local-first-gateway';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dataDir=await mkdtemp(path.join(os.tmpdir(),'commonweave-gateway-v131-')),output=[];
const child=spawn(process.execPath,['server-gateway-v131.mjs'],{cwd:root,env:{...process.env,HOST:'127.0.0.1',PORT:String(PORT),DATA_DIR:dataDir},stdio:['ignore','pipe','pipe']});
child.stdout.on('data',chunk=>output.push(chunk.toString()));child.stderr.on('data',chunk=>output.push(chunk.toString()));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
async function wait(){let last;for(let i=0;i<60;i+=1){try{const response=await fetch(`${origin}/api/health`,{cache:'no-store'});if(response.ok)return response.json();last=new Error(`health ${response.status}`)}catch(error){last=error}await sleep(200)}throw last||new Error('gateway did not start')}
try{
  const health=await wait();
  assert(health.build===BUILD,`unexpected build ${health.build}`);
  assert(health.appVersion===VERSION,`unexpected version ${health.appVersion}`);
  assert(health.release?.appUrl===null,'gateway advertises a remotely hosted app');
  assert(health.release?.localInstallRequired===true,'gateway does not require local installation');
  assert(String(health.release?.sourceUrl||'').includes('github.com/cerbanimo-dev/Commonweave'),'gateway source URL missing');
  const rootResponse=await fetch(`${origin}/`,{cache:'no-store'}),rootHtml=await rootResponse.text();
  assert(rootResponse.ok,'gateway root failed');
  assert(rootHtml.includes('Commonweave runs locally.'),'gateway root does not explain local mode');
  assert(!rootHtml.includes('/service-worker.js'),'gateway root attempts to install a service worker');
  assert(!rootHtml.includes('/loom/'),'gateway root links to the hosted campus');
  for(const route of ['/loom/','/lite/','/app/realm-console-v140.html','/service-worker.js','/diagnostics.html']){
    const response=await fetch(origin+route,{cache:'no-store'}),body=await response.json();
    assert(response.status===410,`${route} returned ${response.status}, expected 410`);
    assert(body.localInstallRequired===true,`${route} does not explain local installation`);
  }
  const telemetry=await fetch(`${origin}/api/boot-log`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'room-opened'})});
  assert(telemetry.status===204,`boot telemetry returned ${telemetry.status}`);
  const telemetryRead=await fetch(`${origin}/api/boot-logs`);
  assert(telemetryRead.status===204,`boot log reader returned ${telemetryRead.status}`);
  const download=await fetch(`${origin}/downloads/Commonweave-Mobile-Install-Kit.zip`,{redirect:'manual'});
  assert(download.status===302,`download route returned ${download.status}`);
  assert(String(download.headers.get('location')||'').includes('github.com/cerbanimo-dev/Commonweave'),'download route does not redirect away from Render');
  const config=await fetch(`${origin}/api/config`,{cache:'no-store'}).then(response=>response.json());
  assert(config.appUrl===null,'public config advertises a hosted app');
  assert(config.seedUrl===null,'public config advertises a Render-hosted seed');
  assert(!config.features.includes('pwa-hosting'),'public config still claims PWA hosting');
  assert(config.features.includes('release-advertising'),'public config lost release advertising');
  console.log(JSON.stringify({ok:true,version:VERSION,build:BUILD,hostedCampus:false,bootTelemetry:false,downloadOrigin:'GitHub',gatewayFeatures:config.features},null,2));
}catch(error){console.error(output.join(''));throw error}
finally{child.kill('SIGTERM');await Promise.race([new Promise(resolve=>child.once('exit',resolve)),sleep(1500)]);if(!child.killed)child.kill('SIGKILL');await rm(dataDir,{recursive:true,force:true})}
