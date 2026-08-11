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
const OFFLINE_FETCH_DELAY_MS=250;
const HARD_TIMEOUT_MS=180000;
const phase=name=>console.log(`[browser-gauntlet-v281] ${name}`);
const hardTimeout=setTimeout(()=>{
  console.error(`[browser-gauntlet-v281] hard timeout after ${HARD_TIMEOUT_MS} ms`);
  process.exit(124);
},HARD_TIMEOUT_MS);
let offlinePackageRequests=0;

const contentTypes={
  '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8',
  '.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.woff2':'font/woff2'
};

function safePath(url){
  const pathname=decodeURIComponent(new URL(url,base).pathname);
  const relative=pathname.replace(/^\/+/, '');
  const candidate=path.resolve(publicDir,relative||'index.html');
  if(!candidate.startsWith(`${publicDir}${path.sep}`)&&candidate!==path.join(publicDir,'index.html'))return null;
  return candidate;
}

const server=http.createServer(async(req,res)=>{
  let file=safePath(req.url||'/');
  if(!file){res.writeHead(403);res.end('forbidden');return}
  try{
    const stat=await fs.stat(file);
    if(stat.isDirectory())file=path.join(file,'index.html');
    const body=await fs.readFile(file);
    const purpose=String(req.headers['x-civweave-package']||'');
    if(/^offline-campus/.test(purpose)){
      offlinePackageRequests+=1;
      await new Promise(resolve=>setTimeout(resolve,OFFLINE_FETCH_DELAY_MS));
    }
    res.writeHead(200,{
      'content-type':contentTypes[path.extname(file).toLowerCase()]||'application/octet-stream',
      'cache-control':'no-store',
      'service-worker-allowed':'/'
    });
    res.end(body);
  }catch{
    res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});
    res.end('not found');
  }
});
await new Promise((resolve,reject)=>server.listen(port,host,error=>error?reject(error):resolve()));
phase('local server ready');

const browser=await chromium.launch({headless:true});
try{
  phase('fresh context');
  const context=await browser.newContext({serviceWorkers:'allow'});
  const page=await context.newPage();
  const browserErrors=[];
  page.on('pageerror',error=>browserErrors.push(`pageerror: ${error?.message||error}`));
  page.on('console',message=>{if(message.type()==='error')browserErrors.push(`console: ${message.text()}`)});
  page.on('requestfailed',request=>browserErrors.push(`requestfailed: ${request.url()} :: ${request.failure()?.errorText||'unknown'}`));
  await page.goto(`${base}/app/index.html`,{waitUntil:'domcontentloaded'});
  phase('installer first paint');
  await page.waitForTimeout(800);

  assert.equal((await page.textContent('#package-state'))?.trim().toLowerCase(),'not prepared','first paint must not prepare the shell automatically');
  assert.equal(await page.isEnabled('#install-app'),true,'install action must be immediately usable');
  assert.equal((await page.textContent('#download-offline-package'))?.trim(),'Download offline campus','offline campus must be an explicit action');
  assert.equal(offlinePackageRequests,0,'first paint must not start offline-campus traffic');
  const eagerResources=await page.evaluate(()=>performance.getEntriesByType('resource').map(entry=>entry.name));
  assert.equal(eagerResources.some(url=>url.includes('required-campus-autostart-v1.js')),false,'obsolete campus autostart script must not load');
  assert.equal(eagerResources.some(url=>url.includes('video-atlas-installer-v1.js')),false,'video atlas must not load before the knowledge section is used');
  assert.equal(eagerResources.some(url=>url.includes('open-learning-media-installer-v1.mjs')),false,'open media installer must not load on first paint');
  assert.equal(eagerResources.some(url=>url.includes('installer-state-machine-v280.js')),false,'pause/resume controller must remain lazy before a campus request');
  phase('idle first paint confirmed');

  await page.click('#check-update');
  try{
    await page.waitForFunction(()=>document.querySelector('#package-state')?.textContent?.trim().toLowerCase()==='ready',undefined,{timeout:45000});
  }catch(error){
    const diagnostics=await page.evaluate(async()=>{
      const registration=await navigator.serviceWorker?.getRegistration?.('/').catch(()=>null);
      return{
        packageState:document.querySelector('#package-state')?.textContent?.trim()||null,
        packageAssets:document.querySelector('#package-assets')?.textContent?.trim()||null,
        installHelp:document.querySelector('#install-help')?.textContent?.trim()||null,
        controller:navigator.serviceWorker?.controller?.state||null,
        active:registration?.active?.state||null,
        waiting:registration?.waiting?.state||null,
        installing:registration?.installing?.state||null,
        scriptURL:(registration?.active||registration?.waiting||registration?.installing)?.scriptURL||null
      };
    }).catch(()=>({evaluation:'failed'}));
    console.error('[browser-gauntlet-v281] shell readiness diagnostics',JSON.stringify({diagnostics,browserErrors},null,2));
    throw error;
  }
  assert.equal(offlinePackageRequests,0,'shell preparation must not start the offline campus');
  assert.notEqual((await page.textContent('#offline-package-state'))?.trim(),'downloading','campus must remain idle after shell preparation');
  phase('shell ready without campus traffic');

  await page.click('#download-offline-package');
  await page.waitForFunction(()=>document.querySelector('#download-offline-package')?.textContent?.trim()==='Pause download',undefined,{timeout:45000});
  assert.ok(offlinePackageRequests>0,'explicit campus action must begin offline package traffic');
  phase('explicit campus download started');

  await page.click('#download-offline-package');
  await page.waitForFunction(()=>document.querySelector('#download-offline-package')?.textContent?.trim()==='Resume download',undefined,{timeout:20000});
  assert.equal((await page.textContent('#offline-package-state'))?.trim(),'paused');
  const optedIn=await page.evaluate(()=>globalThis.CivweaveOfflineCampusStatusV210?.last?.explicitOptIn===true);
  assert.equal(optedIn,true,'manual campus request must persist explicit opt-in in worker status');
  phase('pause confirmed');

  const installedLaunch=await context.newPage();
  await installedLaunch.goto(`${base}/app/installed-entry-v146.html?installed=1&system=civweave`,{waitUntil:'domcontentloaded'});
  await installedLaunch.waitForURL(url=>new URL(url).pathname==='/app/working-campus-v156.html',{timeout:30000});
  const installedLaunchPath=new URL(installedLaunch.url()).pathname;
  assert.equal(installedLaunchPath,'/app/working-campus-v156.html','installed PWA entry must route to Working Campus');
  assert.notEqual(installedLaunchPath,'/app/index.html','installed PWA entry must never substitute the installer');
  await installedLaunch.waitForTimeout(1900);
  const pausedRequests=offlinePackageRequests;
  await installedLaunch.waitForTimeout(600);
  assert.equal(offlinePackageRequests,pausedRequests,'opening the app must not restart a deliberately paused campus');
  phase('installed entry bypassed installer without restarting pause');
  await installedLaunch.close();

  await page.close();
  const reopened=await context.newPage();
  await reopened.goto(`${base}/app/index.html`,{waitUntil:'domcontentloaded'});
  await reopened.waitForFunction(()=>document.querySelector('#download-offline-package')?.textContent?.trim()==='Resume offline campus',undefined,{timeout:30000});
  assert.notEqual((await reopened.textContent('#offline-package-state'))?.trim(),'downloading','reopening installer must not auto-resume a paused campus');
  phase('pause survived page restart');

  await reopened.click('#download-offline-package');
  await reopened.waitForFunction(()=>document.querySelector('#download-offline-package')?.textContent?.trim()==='Pause download',undefined,{timeout:30000});
  phase('manual resume confirmed');
  await context.setOffline(true);
  const offlineShell=await reopened.evaluate(()=>fetch('/app/index.html').then(response=>response.ok).catch(()=>false));
  assert.equal(offlineShell,true,'cached installer shell must remain readable offline');
  phase('cached shell confirmed offline');
  await context.setOffline(false);
  await reopened.click('#download-offline-package');
  await reopened.waitForFunction(()=>document.querySelector('#download-offline-package')?.textContent?.trim()==='Resume download',undefined,{timeout:20000});
  phase('pause after reconnect confirmed');
  await reopened.close();
  await context.close();

  phase('no-opt-in app-open context');
  const noOptIn=await browser.newContext({serviceWorkers:'allow'});
  const noOptInPage=await noOptIn.newPage();
  await noOptInPage.goto(`${base}/app/index.html`,{waitUntil:'domcontentloaded'});
  await noOptInPage.click('#check-update');
  await noOptInPage.waitForFunction(()=>document.querySelector('#package-state')?.textContent?.trim().toLowerCase()==='ready',undefined,{timeout:45000});
  const beforeNoOptInLaunch=offlinePackageRequests;
  const noOptInCampus=await noOptIn.newPage();
  await noOptInCampus.goto(`${base}/app/working-campus-v156.html?installed=1`,{waitUntil:'domcontentloaded'});
  await noOptInCampus.waitForTimeout(2400);
  assert.equal(offlinePackageRequests,beforeNoOptInLaunch,'Working Campus must not begin an offline download without explicit opt-in');
  phase('working campus respects no-opt-in state');
  await noOptIn.close();

  phase('low-storage context');
  const lowStorage=await browser.newContext({serviceWorkers:'allow'});
  await lowStorage.addInitScript(()=>{
    try{
      if(navigator.storage)Object.defineProperty(navigator.storage,'estimate',{configurable:true,value:async()=>({usage:900,quota:1000})});
    }catch{}
  });
  const lowPage=await lowStorage.newPage();
  const beforeLowStorage=offlinePackageRequests;
  await lowPage.goto(`${base}/app/index.html`,{waitUntil:'domcontentloaded'});
  await lowPage.waitForTimeout(500);
  assert.equal(document?.undefined,undefined); // keep Node assertion context explicit
  assert.equal(offlinePackageRequests,beforeLowStorage,'low-storage first paint must still be idle');
  await lowPage.click('#download-offline-package');
  await lowPage.waitForFunction(()=>document.documentElement.dataset.civweaveStorageState==='insufficient',undefined,{timeout:45000});
  const help=(await lowPage.textContent('#install-help'))?.trim()||'';
  assert.match(help,/more browser storage is needed/i,'low storage must become a visible blocking state after explicit request');
  assert.equal(offlinePackageRequests,beforeLowStorage,'low-storage preflight must block campus traffic');
  phase('low-storage block confirmed on demand');
  await lowStorage.close();

  assert.equal(browserErrors.filter(error=>!error.includes('favicon')).length,0,`browser errors:\n${browserErrors.join('\n')}`);
  console.log(JSON.stringify({
    ok:true,
    revision:'browser-installer-gauntlet-v300',
    offlineFetchDelayMs:OFFLINE_FETCH_DELAY_MS,
    hardTimeoutMs:HARD_TIMEOUT_MS,
    idleFirstPaint:true,
    shellWithoutCampusTraffic:true,
    explicitCampusStart:true,
    installedLaunch:true,
    pauseRestartResume:true,
    noOptInBackgroundStart:true,
    offlineShell:true,
    lowStorageBlockedOnDemand:true,
    offlinePackageRequests
  },null,2));
}finally{
  clearTimeout(hardTimeout);
  await browser.close().catch(()=>{});
  server.closeAllConnections?.();
  await new Promise(resolve=>server.close(()=>resolve()));
}