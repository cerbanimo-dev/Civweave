import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const publicDir=path.join(root,'public');
const host='127.0.0.1';
const port=4173;
const base=`http://${host}:${port}`;
const OPT_IN_KEY='civweave.offline-campus.explicit-opt-in.v304';
const DISCOVERY_SEED_PATH='/app/__gauntlet-discovery-seed.html';
const RETIRED_DISCOVERY_PATH='/app/__gauntlet-retired-reference.js';
let offlinePackageRequests=0;
let discoverySeedRequests=0;
let retiredDiscoveryRequests=0;

function safePath(url){
  const pathname=decodeURIComponent(new URL(url,base).pathname);
  const relative=pathname.replace(/^\/+/, '');
  const candidate=path.resolve(publicDir,relative||'index.html');
  if(!candidate.startsWith(`${publicDir}${path.sep}`)&&candidate!==path.join(publicDir,'index.html'))return null;
  return candidate;
}
const waitUntil=async(predicate,timeoutMs=10000,intervalMs=50)=>{
  const started=Date.now();
  while(Date.now()-started<timeoutMs){if(predicate())return true;await new Promise(resolve=>setTimeout(resolve,intervalMs))}
  return Boolean(predicate());
};

const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
  const requestUrl=new URL(req.url||'/',base);
  const pathname=decodeURIComponent(requestUrl.pathname);
  const packagePurpose=String(req.headers['x-civweave-package']||'');
  if(/^offline-campus/.test(packagePurpose))offlinePackageRequests+=1;

  if(pathname==='/app/offline-package-v208.json'&&packagePurpose==='offline-manifest'){
    const manifest=JSON.parse(await fs.readFile(path.join(publicDir,'app','offline-package-v208.json'),'utf8'));
    manifest.seeds=[...new Set([...(manifest.seeds||[]),DISCOVERY_SEED_PATH])];
    const body=Buffer.from(`${JSON.stringify(manifest,null,2)}\n`);
    res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','service-worker-allowed':'/'});
    res.end(body);
    return;
  }

  if(pathname===DISCOVERY_SEED_PATH){
    discoverySeedRequests+=1;
    const body=Buffer.from(`<!doctype html><html><body><script src="${RETIRED_DISCOVERY_PATH}"></script></body></html>`);
    res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','service-worker-allowed':'/'});
    res.end(body);
    return;
  }

  if(pathname===RETIRED_DISCOVERY_PATH){
    retiredDiscoveryRequests+=1;
    const body=Buffer.from('<!doctype html><html><body>retired route fallback</body></html>');
    res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','service-worker-allowed':'/'});
    res.end(body);
    return;
  }

  let file=safePath(req.url||'/');
  if(!file){res.writeHead(403);res.end('forbidden');return}
  try{
    const stat=await fs.stat(file);
    if(stat.isDirectory())file=path.join(file,'index.html');
    const body=await fs.readFile(file);
    res.writeHead(200,{'content-type':types[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store','service-worker-allowed':'/'});
    res.end(body);
  }catch{res.writeHead(404);res.end('not found')}
});
await new Promise((resolve,reject)=>server.listen(port,host,error=>error?reject(error):resolve()));

const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({serviceWorkers:'allow'});
  const page=await context.newPage();
  await page.goto(`${base}/app/index.html`,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(900);
  assert.equal((await page.textContent('#package-state'))?.trim().toLowerCase(),'not prepared','first paint must remain idle');
  assert.equal(await page.isEnabled('#install-app'),true,'Install must be usable immediately');
  assert.equal(await page.evaluate(()=>globalThis.CivweavePWAInstallV250?.observerPolicy),'idempotent-writes-coalesced-refresh','Install bridge must publish its observer feedback-loop guard');
  const idleButtonMutations=await page.evaluate(()=>new Promise(resolve=>{
    const button=document.querySelector('#install-app');
    if(!button){resolve(-1);return}
    let count=0;
    const observer=new MutationObserver(rows=>{count+=rows.length});
    observer.observe(button,{attributes:true,attributeFilter:['disabled'],childList:true});
    setTimeout(()=>{observer.disconnect();resolve(count)},250);
  }));
  assert.equal(idleButtonMutations,0,'idle Install button must not mutate itself through its observer');
  assert.equal(offlinePackageRequests,0,'first paint must make zero offline-campus requests');
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),OPT_IN_KEY),null,'first paint must not opt in');
  const eager=await page.evaluate(()=>performance.getEntriesByType('resource').map(entry=>entry.name));
  assert.equal(eager.some(url=>url.includes('required-campus-autostart-v1.js')),false,'legacy autostart script must not load');
  assert.equal(eager.some(url=>url.includes('installer-state-machine-v281.js')),false,'campus state controller must stay lazy');
  assert.equal(eager.some(url=>url.includes('installer-state-machine-v280.js')),false,'retired v280 page writer must never load');
  assert.equal(eager.some(url=>url.includes('knowledge-school-seeds-v1.js')),false,'knowledge tools must stay lazy');
  assert.equal(eager.some(url=>url.includes('video-atlas-installer-v1.js')),false,'video atlas must stay lazy');
  assert.equal(eager.some(url=>url.includes('open-learning-media-installer-v1.mjs')),false,'open media must stay lazy');

  await page.click('#check-update');
  await page.waitForFunction(()=>document.querySelector('#package-state')?.textContent?.trim().toLowerCase()==='ready',undefined,{timeout:45000});
  assert.equal(offlinePackageRequests,0,'shell preparation must not start the campus');
  assert.equal(discoverySeedRequests,0,'offline-only gauntlet seed must not participate in shell preparation');
  assert.equal(retiredDiscoveryRequests,0,'retired discovered reference must not participate in shell preparation');
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),OPT_IN_KEY),null,'shell preparation must not opt in');

  const campus=await context.newPage();
  const beforeCampusOpen=offlinePackageRequests;
  await campus.goto(`${base}/app/working-campus-v156.html?installed=1`,{waitUntil:'domcontentloaded'});
  await campus.waitForTimeout(2200);
  assert.equal(offlinePackageRequests,beforeCampusOpen,'Working Campus must not start offline transfer without opt-in');
  await campus.close();

  await page.click('#download-offline-package');
  await page.waitForFunction(key=>localStorage.getItem(key)==='1',OPT_IN_KEY,{timeout:5000});
  await page.waitForFunction(()=>globalThis.CivweaveInstallerStateV281!=null,undefined,{timeout:10000});
  await page.waitForFunction(()=>document.querySelector('#offline-package-state')?.textContent?.trim().toLowerCase()==='downloading'||document.querySelector('#offline-package-state')?.textContent?.trim().toLowerCase()==='ready offline',undefined,{timeout:45000});
  const resourcesAfterOptIn=await page.evaluate(()=>performance.getEntriesByType('resource').map(entry=>entry.name));
  assert.equal(resourcesAfterOptIn.some(url=>url.includes('installer-state-machine-v280.js')),false,'retired v280 page writer must remain absent after opt-in');
  assert.ok(resourcesAfterOptIn.some(url=>url.includes('installer-state-machine-v281.js')),'explicit campus action must load the v281 controller');
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),OPT_IN_KEY),'1','explicit campus action must persist opt-in');
  assert.equal(await waitUntil(()=>offlinePackageRequests>0,10000),true,'explicit campus action must begin offline traffic');

  try{
    await page.waitForFunction(()=>document.querySelector('#offline-package-state')?.textContent?.trim().toLowerCase()==='ready offline',undefined,{timeout:90000});
  }catch(error){
    const diagnostic=await page.evaluate(async()=>{
      const summarize=packet=>packet?{
        type:packet.type||null,
        revision:packet.revision||null,
        ready:Boolean(packet.ready),
        running:Boolean(packet.running),
        paused:Boolean(packet.paused),
        interrupted:Boolean(packet.interrupted),
        attempted:Number(packet.attempted||0),
        downloaded:Number(packet.downloaded??packet.completed??0),
        total:Number(packet.total||0),
        discovered:Number(packet.discovered||0),
        failedCount:Number(packet.failedCount||packet.failed?.length||0),
        failures:(packet.failed||[]).slice(0,30).map(entry=>({pathname:entry?.pathname||'',status:Number(entry?.status||0),attempts:Number(entry?.attempts||0),required:Boolean(entry?.required),message:String(entry?.message||'').slice(0,180)})),
        updatedAt:packet.updatedAt||null
      }:null;
      let workerStatus=null;
      try{
        const registration=await navigator.serviceWorker.getRegistration('/');
        const worker=registration?.active;
        if(worker){
          workerStatus=await new Promise(resolve=>{
            const channel=new MessageChannel();
            const timer=setTimeout(()=>resolve({timeout:true}),5000);
            channel.port1.onmessage=event=>{clearTimeout(timer);resolve(event.data||null)};
            worker.postMessage({type:'GET_OFFLINE_PACKAGE_STATUS'},[channel.port2]);
          });
        }
      }catch(workerError){workerStatus={error:workerError?.message||String(workerError)}}
      return {
        ui:{
          state:document.querySelector('#offline-package-state')?.textContent?.trim()||'',
          assets:document.querySelector('#offline-package-assets')?.textContent?.trim()||'',
          button:document.querySelector('#download-offline-package')?.textContent?.trim()||'',
          help:document.querySelector('#install-help')?.textContent?.trim()||''
        },
        reader:summarize(globalThis.CivweaveOfflineCampusStatusV211?.last||null),
        worker:summarize(workerStatus)||workerStatus
      };
    });
    throw new Error(`Offline campus did not reach ready state: ${JSON.stringify({offlinePackageRequests,discoverySeedRequests,retiredDiscoveryRequests,diagnostic},null,2)}`,{cause:error});
  }
  const finalStatus=await page.evaluate(()=>globalThis.CivweaveOfflineCampusStatusV211?.last||null);
  assert.ok(finalStatus?.ready,'first offline-campus pass must finish ready');
  assert.equal(finalStatus?.failedCount,0,'retired discovered references must not remain retry failures');
  assert.equal(discoverySeedRequests>0,true,'gauntlet did not exercise the offline-only discovery seed');
  assert.equal(retiredDiscoveryRequests>0,true,'gauntlet did not exercise the retired discovered-reference fallback');
  assert.equal((await page.textContent('#download-offline-package'))?.trim(),'Refresh offline campus','completed campus must not advertise missing-file retries');

  await context.addInitScript(()=>{
    try{Object.defineProperty(navigator,'standalone',{configurable:true,get:()=>true})}catch{}
  });
  const installedLaunch=await context.newPage();
  await installedLaunch.goto(`${base}/app/installed-entry-v146.html?installed=1`,{waitUntil:'domcontentloaded'});
  await installedLaunch.waitForURL(url=>url.pathname==='/app/working-campus-v156.html',{timeout:20000});
  await installedLaunch.waitForSelector('#weaveling-chat-form',{state:'attached',timeout:15000});
  await installedLaunch.waitForSelector('.campus [data-realm="living-school"]',{state:'attached',timeout:15000});
  const routedUrl=new URL(installedLaunch.url());
  assert.equal(routedUrl.pathname,'/app/working-campus-v156.html','installed start entry did not route to Working Campus');
  assert.equal(routedUrl.searchParams.get('installed'),'1','installed launch lost installed authorization at the campus boundary');
  await installedLaunch.waitForTimeout(5200);
  assert.equal(new URL(installedLaunch.url()).pathname,'/app/working-campus-v156.html','Working Campus did not survive the startup recovery watchdog');
  assert.equal(await installedLaunch.locator('#weaveling-chat-form').count(),1,'Working Campus shell disappeared after installed launch');
  await installedLaunch.close();

  console.log(JSON.stringify({ok:true,revision:'browser-installer-gauntlet-v311-offline-final-diagnostics',idleFirstPaint:true,idleButtonMutations,shellWithoutCampusTraffic:true,noOptInAppOpen:true,explicitOptInStartsCampus:true,singleWriterController:true,offlinePackageRequests,discoverySeedRequests,retiredDiscoveryRequests,offlineReady:finalStatus?.ready===true,failedCount:Number(finalStatus?.failedCount||0),installedStartReachesCampus:true,installedCampusSurvivesWatchdog:true},null,2));
  await context.close();
}finally{
  await browser.close().catch(()=>{});
  server.closeAllConnections?.();
  await new Promise(resolve=>server.close(()=>resolve()));
}
