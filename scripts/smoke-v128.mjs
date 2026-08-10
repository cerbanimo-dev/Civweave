import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT=18789;
const origin=`http://127.0.0.1:${PORT}`;
const VERSION='1.0.28';
const BUILD='1.0.28-parity-ledger-foundation';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dataDir=await mkdtemp(path.join(os.tmpdir(),'civweave-v128-'));
const output=[];
const child=spawn(process.execPath,['releases/1.0.81/server/launch-archived.mjs'],{cwd:root,env:{...process.env,HOST:'127.0.0.1',PORT:String(PORT),DATA_DIR:dataDir},stdio:['ignore','pipe','pipe']});
child.stdout.on('data',chunk=>output.push(chunk.toString()));child.stderr.on('data',chunk=>output.push(chunk.toString()));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
async function wait(){let last;for(let i=0;i<40;i+=1){try{const response=await fetch(`${origin}/api/health`,{cache:'no-store'});if(response.ok)return response.json();last=new Error(`health ${response.status}`)}catch(error){last=error}await sleep(250)}throw last||new Error('host did not start')}
try{
  const health=await wait();
  assert(health.build===BUILD,`unexpected build ${health.build}`);
  assert(health.appVersion===VERSION,`unexpected app version ${health.appVersion}`);
  assert(String(health.release?.appUrl||'').includes('/loom/'),`release appUrl did not point to /loom/: ${health.release?.appUrl}`);

  const hubResponse=await fetch(`${origin}/loom/`,{cache:'no-store'});const hub=await hubResponse.text();
  assert(hubResponse.ok,`loom returned ${hubResponse.status}`);
  assert(hubResponse.headers.get('x-civweave-version')===VERSION,'loom version header missing');
  assert(hub.includes('/app/loom-v128.js'),'clean hub runtime missing');
  assert(hub.includes('data-realm="living-school"'),'building routes missing');
  assert(!hub.includes('1.0.21'),'v1.0.21 marker survived in clean hub');
  assert(!hub.includes('civweave-pocket-campus.cwseed'),'seed download survived in clean hub');
  assert(!hub.includes('serviceWorker.register'),'clean hub registers a service worker');
  assert(!hub.includes('civweave-world.js'),'legacy world runtime survived in clean hub');

  const hubJs=await fetch(`${origin}/app/loom-v128.js`,{cache:'no-store'}).then(response=>response.text());
  assert(hubJs.includes('/loom/realm/'),'clean hub does not route buildings to isolated realms');
  assert(!hubJs.includes('.cwseed'),'clean hub runtime requests the legacy seed');
  assert(!hubJs.includes('location.reload'),'clean hub runtime contains a reload call');

  for(const realm of ['living-school','cerbanimo','fellowfare','anarchadia']){
    const response=await fetch(`${origin}/loom/realm/${realm}/`,{cache:'no-store'});const html=await response.text();
    assert(response.ok,`${realm} shell returned ${response.status}`);
    assert(html.includes('/app/realm-v128.js'),`${realm} did not use isolated realm runtime`);
    assert(!html.includes('1.0.21'),`${realm} shell contains v1.0.21`);
  }

  for(const asset of ['/app/assets/world/town-square-home.webp','/app/services/living-school/visual-assets/core/home.webp','/app/services/cerbanimo/assets/visual/nexus.webp','/app/services/fellowfare/assets/mall/main-atrium.webp','/app/services/anarchadia/assets/screens/home-portrait.webp']){
    const response=await fetch(origin+asset,{cache:'no-store'});assert(response.ok,`asset failed ${asset}: ${response.status}`);
  }



  const ledgerResponse=await fetch(`${origin}/app/shared/civweave-parity-ledger.json`,{cache:'no-store'});const ledger=await ledgerResponse.json();
  assert(ledgerResponse.ok,`parity ledger returned ${ledgerResponse.status}`);
  assert(ledger.schema==='civweave.parity-ledger.v1','parity ledger schema mismatch');
  assert(ledger.systems.length===5,`expected 5 systems, got ${ledger.systems.length}`);
  assert(ledger.capabilities.length>=100,`expected at least 100 capabilities, got ${ledger.capabilities.length}`);
  assert(ledger.capabilities.every(item=>item.visual?.status&&item.lite?.status),'a capability is missing renderer mappings');

  const liteResponse=await fetch(`${origin}/lite/?system=cerbanimo&room=quest`,{cache:'no-store'});const lite=await liteResponse.text();
  assert(liteResponse.ok,`lite returned ${liteResponse.status}`);
  assert(lite.includes('/app/lite-v128.js'),'lite runtime missing');
  assert(lite.includes('Open Visual'),'lite visual counterpart missing');

  for(const service of ['living-school','cerbanimo','fellowfare','anarchadia']){
    const response=await fetch(`${origin}/lite/source/${service}/`,{cache:'no-store'});const text=await response.text();
    assert(response.ok,`${service} lite source returned ${response.status}`);
    assert(text.includes(`<base href="/app/services/${service}/">`),`${service} lite source base missing`);
    assert(text.includes('__CIVWEAVE_LITE_SOURCE__'),`${service} lite source marker missing`);
  }

  for(const legacy of ['/app/','/campus/']){
    const response=await fetch(origin+legacy,{redirect:'manual',cache:'no-store'});assert(response.status===302,`${legacy} returned ${response.status}`);assert(response.headers.get('location')==='/loom/',`${legacy} redirected to ${response.headers.get('location')}`);
  }

  const seed=await fetch(`${origin}/downloads/civweave-pocket-campus.cwseed`,{redirect:'manual',cache:'no-store'});
  assert(seed.status===204,`retired seed request returned ${seed.status}`);
  assert(seed.headers.get('x-civweave-seed-status')==='retired','retired seed marker missing');

  await fetch(`${origin}/api/boot-log`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'v128-smoke',detail:{source:'scripts/smoke-v128.mjs'}})});
  const logs=await fetch(`${origin}/api/boot-logs`,{cache:'no-store'}).then(response=>response.json());
  assert(logs.version===VERSION,'boot log version mismatch');assert(logs.build===BUILD,'boot log build mismatch');assert(logs.logs.some(entry=>entry.kind==='client:v128-smoke'),'boot log did not retain smoke event');assert(logs.logs.some(entry=>entry.kind==='legacy-seed-request-retired'),'retired seed request was not logged');
  console.log(JSON.stringify({ok:true,version:VERSION,build:BUILD,hubBytes:hub.length,bootLogCount:logs.count},null,2));
}catch(error){console.error(output.join(''));throw error}
finally{child.kill('SIGTERM');await Promise.race([new Promise(resolve=>child.once('exit',resolve)),sleep(1500)]);if(!child.killed)child.kill('SIGKILL');await rm(dataDir,{recursive:true,force:true})}
