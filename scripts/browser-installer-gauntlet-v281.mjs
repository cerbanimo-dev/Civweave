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
let offlinePackageRequests=0;

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
  let file=safePath(req.url||'/');
  if(!file){res.writeHead(403);res.end('forbidden');return}
  try{
    const stat=await fs.stat(file);
    if(stat.isDirectory())file=path.join(file,'index.html');
    const body=await fs.readFile(file);
    if(/^offline-campus/.test(String(req.headers['x-civweave-package']||'')))offlinePackageRequests+=1;
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

  console.log(JSON.stringify({ok:true,revision:'browser-installer-gauntlet-v307-observer-idle',idleFirstPaint:true,idleButtonMutations,shellWithoutCampusTraffic:true,noOptInAppOpen:true,explicitOptInStartsCampus:true,singleWriterController:true,offlinePackageRequests},null,2));
  await context.close();
}finally{
  await browser.close().catch(()=>{});
  server.closeAllConnections?.();
  await new Promise(resolve=>server.close(()=>resolve()));
}
