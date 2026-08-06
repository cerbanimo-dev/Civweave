import { spawn } from 'node:child_process';
import { mkdtemp, rm, stat, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT=18791;
const origin=`http://127.0.0.1:${PORT}`;
const VERSION='1.0.30';
const BUILD='1.0.30-offline-mesh-cabinet-runtime';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dataDir=await mkdtemp(path.join(os.tmpdir(),'civweave-v130-'));
const output=[];
const child=spawn(process.execPath,['server-v130.mjs'],{cwd:root,env:{...process.env,HOST:'127.0.0.1',PORT:String(PORT),DATA_DIR:dataDir},stdio:['ignore','pipe','pipe']});
child.stdout.on('data',chunk=>output.push(chunk.toString()));child.stderr.on('data',chunk=>output.push(chunk.toString()));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
async function wait(){let last;for(let i=0;i<50;i+=1){try{const response=await fetch(`${origin}/api/health`,{cache:'no-store'});if(response.ok)return response.json();last=new Error(`health ${response.status}`)}catch(error){last=error}await sleep(250)}throw last||new Error('host did not start')}
try{
  const health=await wait();
  assert(health.build===BUILD,`unexpected build ${health.build}`);
  assert(health.appVersion===VERSION,`unexpected app version ${health.appVersion}`);
  assert(String(health.release?.appUrl||'').includes('/loom/'),`release appUrl did not point to /loom/: ${health.release?.appUrl}`);

  const gatewayResponse=await fetch(`${origin}/`,{cache:'no-store'});const gateway=await gatewayResponse.text();
  assert(gatewayResponse.ok,`gateway returned ${gatewayResponse.status}`);
  assert(gateway.includes('Install Civweave'),'installer gateway missing');
  assert(gateway.includes('/install-v130.js'),'installer runtime missing');
  assert(gateway.includes('/downloads/civweave-pocket-campus.cwseed'),'campus seed link missing');
  assert(!gateway.includes('location.replace'),'installer gateway auto-redirects into the app');

  const manifest=await fetch(`${origin}/app/manifest.webmanifest`,{cache:'no-store'}).then(response=>response.json());
  assert(manifest.start_url.includes('/loom/'),'manifest start_url is not the local campus');
  assert(manifest.scope==='/','manifest does not cover the whole local campus');
  assert(manifest.id==='/civweave-local','manifest identity mismatch');

  const workerResponse=await fetch(`${origin}/service-worker.js`,{cache:'no-store'});const worker=await workerResponse.text();
  assert(workerResponse.ok,'root service worker failed');
  assert(workerResponse.headers.get('service-worker-allowed')==='/','root service worker scope header missing');
  assert(worker.includes("civweave-static-${VERSION}"),'versioned static cache missing');
  assert(worker.includes("'SKIP_WAITING'"),'explicit update activation missing');
  assert(worker.includes('/app/assets/cabinets/civweave.webp'),'cabinet assets are not precached');

  const hubResponse=await fetch(`${origin}/loom/`,{cache:'no-store'});const hub=await hubResponse.text();
  assert(hubResponse.ok,`loom returned ${hubResponse.status}`);
  assert(hubResponse.headers.get('x-civweave-version')===VERSION,'loom version header missing');
  assert(hub.includes('v1.0.30'),'visible v1.0.30 marker missing');
  assert(hub.includes('/app/v130-cabinet-launcher.js'),'mini cabinet launcher missing');
  assert(hub.includes('/app/pwa-v130.js'),'PWA bootstrap missing');
  assert(hub.includes('data-action="chat"'),'Weaveling control missing');

  const hubJs=await fetch(`${origin}/app/loom-v128.js`,{cache:'no-store'}).then(response=>response.text());
  assert(hubJs.includes("const VERSION='1.0.30'"),'hub runtime version mismatch');
  assert(hubJs.includes('parsed==null?fallback:parsed'),'null-safe persisted-state parser missing');
  assert(!hubJs.includes("const history=parse(localStorage.getItem(CHAT_KEY),[]);"),'unsafe chat history access survived');

  const launcher=await fetch(`${origin}/app/v130-cabinet-launcher.js`,{cache:'no-store'}).then(response=>response.text());
  assert(launcher.includes('cw-cabinet-launcher'),'mini cabinet control missing');
  assert(launcher.includes('showModal'),'workstation is not opened as an overlay');
  assert(!launcher.includes('location.assign(workstationUrl'),'launcher still navigates away from the world');

  const ledgerResponse=await fetch(`${origin}/app/shared/civweave-parity-ledger.json`,{cache:'no-store'});const ledger=await ledgerResponse.json();
  assert(ledgerResponse.ok,'ledger failed');
  assert(ledger.version===VERSION,`ledger version ${ledger.version}`);
  assert(ledger.systems.length===5,'system count mismatch');
  assert(ledger.capabilities.length>=100,'capability count mismatch');
  for(const system of ledger.systems){
    const asset=system.interfaceShell?.asset;
    assert(asset&&!system.interfaceShell?.assetParts,'cabinet shell did not move to a direct asset');
    const response=await fetch(origin+asset,{cache:'no-store'});
    const bytes=new Uint8Array(await response.arrayBuffer());
    assert(response.ok,`cabinet failed ${system.id}`);
    assert(new TextDecoder().decode(bytes.slice(0,4))==='RIFF',`cabinet is not RIFF ${system.id}`);
    assert(new TextDecoder().decode(bytes.slice(8,12))==='WEBP',`cabinet is not WebP ${system.id}`);
  }

  const liteResponse=await fetch(`${origin}/lite/?system=cerbanimo&room=quest&embed=1`,{cache:'no-store'});const lite=await liteResponse.text();
  assert(liteResponse.ok,'lite failed');
  assert(lite.includes('/app/lite-v129-core.js?v=1.0.30'),'lite cache-bust missing');
  assert(lite.includes('/app/pwa-v130.js'),'lite PWA bootstrap missing');
  const liteCore=await fetch(`${origin}/app/lite-v129-core.js`,{cache:'no-store'}).then(response=>response.text());
  assert(!liteCore.includes('atob('),'corrupt client-side cabinet base64 loader survived');
  assert(!liteCore.includes('assetParts'),'legacy cabinet chunks survived');
  assert(liteCore.includes('/app/assets/cabinets/'),'direct cabinet fallback missing');
  const baseCss=await fetch(`${origin}/app/lite-v129-base.css`,{cache:'no-store'}).then(response=>response.text());
  const componentsCss=await fetch(`${origin}/app/lite-v129-components.css`,{cache:'no-store'}).then(response=>response.text());
  assert(baseCss.includes('contain:layout paint size'),'cabinet projection containment missing');
  assert(componentsCss.includes('overflow-wrap:anywhere'),'workstation overflow guard missing');

  const seedStat=await stat(path.join(root,'public/downloads/civweave-pocket-campus.cwseed'));
  assert(seedStat.size>1024,'campus seed is empty');
  const seed=await fetch(`${origin}/downloads/civweave-pocket-campus.cwseed`,{cache:'no-store'});
  assert(seed.status===200,`campus seed returned ${seed.status}`);
  await seed.body?.cancel();

  const recovery=await fetch(`${origin}/recover.html`,{cache:'no-store'}).then(response=>response.text());
  assert(recovery.includes('v1.0.30'),'recovery version mismatch');
  assert(recovery.includes('/service-worker.js'),'recovery does not reinstall root worker');

  await fetch(`${origin}/api/boot-log`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'v130-smoke',detail:{source:'scripts/smoke-v130.mjs'}})});
  const logs=await fetch(`${origin}/api/boot-logs`,{cache:'no-store'}).then(response=>response.json());
  assert(logs.version===VERSION,'boot log version mismatch');
  assert(logs.build===BUILD,'boot log build mismatch');
  assert(logs.logs.some(entry=>entry.kind==='client:v130-smoke'),'smoke event missing');
  console.log(JSON.stringify({ok:true,version:VERSION,build:BUILD,systems:ledger.systems.length,capabilities:ledger.capabilities.length,seedBytes:seedStat.size,bootLogCount:logs.count},null,2));
}catch(error){console.error(output.join(''));throw error}
finally{child.kill('SIGTERM');await Promise.race([new Promise(resolve=>child.once('exit',resolve)),sleep(1500)]);if(!child.killed)child.kill('SIGKILL');await rm(dataDir,{recursive:true,force:true})}
