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
    if(/^offline-campus/.test(purpose))await new Promise(resolve=>setTimeout(resolve,35));
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

const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({serviceWorkers:'allow'});
  const page=await context.newPage();
  await page.goto(`${base}/app/index.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#package-state')?.textContent?.trim()==='ready',{timeout:60000});
  await page.waitForFunction(()=>/Pause download|Refresh offline campus/.test(document.querySelector('#download-offline-package')?.textContent||''),{timeout:60000});

  const firstAction=(await page.textContent('#download-offline-package'))?.trim()||'';
  assert.ok(['Pause download','Refresh offline campus'].includes(firstAction),`unexpected campus action: ${firstAction}`);

  if(firstAction==='Pause download'){
    await page.click('#download-offline-package');
    await page.waitForFunction(()=>document.querySelector('#download-offline-package')?.textContent?.trim()==='Resume download',{timeout:30000});
    assert.equal((await page.textContent('#offline-package-state'))?.trim(),'paused');

    await page.close();
    const reopened=await context.newPage();
    await reopened.goto(`${base}/app/index.html`,{waitUntil:'domcontentloaded'});
    await reopened.waitForFunction(()=>document.querySelector('#download-offline-package')?.textContent?.trim()==='Resume download',{timeout:30000});
    assert.equal((await reopened.textContent('#offline-package-state'))?.trim(),'paused','manual pause must survive a page restart');

    await reopened.click('#download-offline-package');
    await reopened.waitForFunction(()=>document.querySelector('#download-offline-package')?.textContent?.trim()==='Pause download',{timeout:30000});
    await context.setOffline(true);
    const offlineShell=await reopened.evaluate(()=>fetch('/app/index.html').then(response=>response.ok).catch(()=>false));
    assert.equal(offlineShell,true,'cached installer shell must remain readable offline');
    await context.setOffline(false);
    await reopened.click('#download-offline-package');
    await reopened.waitForFunction(()=>document.querySelector('#download-offline-package')?.textContent?.trim()==='Resume download',{timeout:30000});
    await reopened.close();
  }
  await context.close();

  const lowStorage=await browser.newContext({serviceWorkers:'allow'});
  await lowStorage.addInitScript(()=>{
    try{
      Object.defineProperty(navigator.storage,'estimate',{configurable:true,value:async()=>({usage:900,quota:1000})});
      Object.defineProperty(navigator.storage,'persisted',{configurable:true,value:async()=>false});
      Object.defineProperty(navigator.storage,'persist',{configurable:true,value:async()=>false});
    }catch{}
  });
  const lowPage=await lowStorage.newPage();
  await lowPage.goto(`${base}/app/index.html`,{waitUntil:'domcontentloaded'});
  await lowPage.waitForFunction(()=>document.documentElement.dataset.civweaveStorageState==='insufficient',{timeout:60000});
  const storageText=(await lowPage.textContent('#storage-state'))?.trim()||'';
  assert.match(storageText,/need .* more space/i,'low storage must become a visible blocking state');
  assert.notEqual((await lowPage.textContent('#offline-package-state'))?.trim(),'downloading','low-storage preflight must block campus autostart');
  await lowStorage.close();

  console.log('browser installer gauntlet v281: ok');
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
