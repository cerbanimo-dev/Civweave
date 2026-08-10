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
    if(/^offline-campus/.test(purpose))await new Promise(resolve=>setTimeout(resolve,OFFLINE_FETCH_DELAY_MS));
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
  phase('installer page loaded');
  try{
    await page.waitForFunction(()=>{
      const state=document.querySelector('#package-state')?.textContent?.trim().toLowerCase();
      return state==='ready'||state==='failed'||state==='needs repair';
    },undefined,{timeout:45000});
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
  const shellState=(await page.textContent('#package-state'))?.trim().toLowerCase()||'';
  if(shellState!=='ready'){
    const help=(await page.textContent('#install-help'))?.trim()||'';
    throw new Error(`installer shell entered ${shellState||'unknown'} state: ${help}`);
  }
  phase('shell ready');
  await page.waitForFunction(()=>document.querySelector('#download-offline-package')?.textContent?.trim()==='Pause download',undefined,{timeout:45000});
  phase('campus downloading');

  const firstAction=(await page.textContent('#download-offline-package'))?.trim()||'';
  assert.equal(firstAction,'Pause download','fresh browser gauntlet must catch the campus while it is still downloading');

  await page.click('#download-offline-package');
  await page.waitForFunction(()=>document.querySelector('#download-offline-package')?.textContent?.trim()==='Resume download',undefined,{timeout:20000});
  assert.equal((await page.textContent('#offline-package-state'))?.trim(),'paused');
  phase('pause confirmed');

  await page.close();
  const reopened=await context.newPage();
  await reopened.goto(`${base}/app/index.html`,{waitUntil:'domcontentloaded'});
  await reopened.waitForFunction(()=>document.querySelector('#download-offline-package')?.textContent?.trim()==='Resume download',undefined,{timeout:30000});
  assert.equal((await reopened.textContent('#offline-package-state'))?.trim(),'paused','manual pause must survive a page restart');
  phase('pause survived page restart');

  await reopened.click('#download-offline-package');
  await reopened.waitForFunction(()=>document.querySelector('#download-offline-package')?.textContent?.trim()==='Pause download',undefined,{timeout:20000});
  phase('resume confirmed');
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

  phase('low-storage context');
  const lowStorage=await browser.newContext({serviceWorkers:'allow'});
  await lowStorage.addInitScript(()=>{
    globalThis.__CivweaveStorageTestOverrideV281={usage:900,quota:1000,persistent:false};
  });
  const lowPage=await lowStorage.newPage();
  await lowPage.goto(`${base}/app/index.html`,{waitUntil:'domcontentloaded'});
  await lowPage.waitForFunction(()=>document.documentElement.dataset.civweaveStorageState==='insufficient',undefined,{timeout:30000});
  const storageText=(await lowPage.textContent('#storage-state'))?.trim()||'';
  assert.match(storageText,/need .* more space/i,'low storage must become a visible blocking state');
  assert.notEqual((await lowPage.textContent('#offline-package-state'))?.trim(),'downloading','low-storage preflight must block campus autostart');
  phase('low-storage block confirmed');
  await lowStorage.close();

  console.log(JSON.stringify({
    ok:true,
    revision:'browser-installer-gauntlet-v281',
    offlineFetchDelayMs:OFFLINE_FETCH_DELAY_MS,
    hardTimeoutMs:HARD_TIMEOUT_MS,
    pauseRestartResume:true,
    offlineShell:true,
    lowStorageBlocked:true
  },null,2));
}finally{
  clearTimeout(hardTimeout);
  await browser.close().catch(()=>{});
  server.closeAllConnections?.();
  await new Promise(resolve=>server.close(()=>resolve()));
}
