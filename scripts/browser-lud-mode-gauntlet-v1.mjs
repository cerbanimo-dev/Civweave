import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const publicDir=path.join(root,'public');
const host='127.0.0.1';
const port=4174;
const base=`http://${host}:${port}`;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8'};
let htmlRedirects=0;
let canonicalCampusRequests=0;
let serverClosed=false;

function publicPath(pathname){
  const relative=pathname.replace(/^\/+/, '');
  const candidate=path.resolve(publicDir,relative||'index.html');
  if(!candidate.startsWith(`${publicDir}${path.sep}`)&&candidate!==path.join(publicDir,'index.html'))return null;
  return candidate;
}
function githubEscape(value){return String(value??'').replace(/%/g,'%25').replace(/\r/g,'%0D').replace(/\n/g,'%0A')}
async function stopServer(){
  if(serverClosed)return;
  serverClosed=true;
  server.closeAllConnections?.();
  await new Promise(resolve=>server.close(()=>resolve()));
}

const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url||'/',base);
  const pathname=decodeURIComponent(url.pathname);
  const common={'cache-control':'no-store','service-worker-allowed':'/'};

  if(pathname==='/app/lud/campus.html'){
    htmlRedirects+=1;
    res.writeHead(308,{...common,location:'/app/lud/campus'});
    res.end();
    return;
  }
  if(pathname==='/app/lud/campus'){
    canonicalCampusRequests+=1;
    const file=path.join(publicDir,'app','lud','campus.html');
    const body=await fs.readFile(file);
    res.writeHead(200,{...common,'content-type':'text/html; charset=utf-8'});
    res.end(body);
    return;
  }

  let file=publicPath(pathname);
  if(!file){res.writeHead(403,common);res.end('forbidden');return}
  try{
    const stat=await fs.stat(file);
    if(stat.isDirectory())file=path.join(file,'index.html');
    const body=await fs.readFile(file);
    res.writeHead(200,{...common,'content-type':types[path.extname(file).toLowerCase()]||'application/octet-stream'});
    res.end(body);
  }catch{
    res.writeHead(404,{...common,'content-type':'text/plain; charset=utf-8'});
    res.end('not found');
  }
});

await new Promise((resolve,reject)=>server.listen(port,host,error=>error?reject(error):resolve()));
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({serviceWorkers:'allow'});
  const page=await context.newPage();
  await page.goto(`${base}/app/lud/`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>globalThis.CivweaveLudInstallerV1!=null,undefined,{timeout:10000});
  await page.waitForFunction(()=>document.querySelector('#lud-package-state')?.textContent?.trim().toLowerCase()==='not downloaded',undefined,{timeout:15000});

  await page.click('#download-lud-mode');
  await page.waitForFunction(()=>document.querySelector('#lud-package-state')?.textContent?.trim().toLowerCase()==='ready offline',undefined,{timeout:30000});
  assert.equal((await page.locator('#lud-progress-percent').textContent())?.trim(),'100%','Lud package did not finish at 100%');
  assert.equal(await page.locator('#open-lud-mode').getAttribute('href'),'/app/lud/campus','Open Lud Mode must use the canonical extensionless route');
  assert.equal(await page.locator('#open-lud-mode').isVisible(),true,'Open Lud Mode must become visible after the package is ready');
  assert.ok(htmlRedirects>0,'gauntlet did not exercise the Cloudflare-style .html redirect during package download');
  assert.ok(canonicalCampusRequests>0,'gauntlet did not fetch the canonical campus route during package download');

  const beforeOpenCanonicalRequests=canonicalCampusRequests;
  await page.click('#open-lud-mode');
  await page.waitForURL(url=>url.pathname==='/app/lud/campus',{timeout:15000});
  await page.waitForSelector('#author-form',{state:'attached',timeout:10000});
  await page.waitForSelector('#cw-host-node-lobby',{state:'attached',timeout:10000});
  await page.waitForFunction(()=>/^AC-[A-F0-9]{8}$/.test(document.querySelector('#lud-passport-id')?.textContent?.trim()||''),undefined,{timeout:10000});
  assert.equal((await page.locator('h1').textContent())?.trim(),'Lud Mode','Lud campus did not render after canonical navigation');
  assert.ok(canonicalCampusRequests>beforeOpenCanonicalRequests,'opening downloaded Lud Mode while online should refresh the canonical campus route before cache fallback');
  const firstPassport=(await page.locator('#lud-passport-id').textContent())?.trim();
  assert.match(firstPassport||'',/^AC-[A-F0-9]{8}$/,'Lud Mode did not create a Passport');
  assert.equal(await page.locator('#cw-host-node-lobby').count(),1,'Lud Mode did not expose the canonical Guild lobby');

  const controller=await page.evaluate(()=>({
    controlled:Boolean(navigator.serviceWorker.controller),
    scriptURL:navigator.serviceWorker.controller?.scriptURL||''
  }));
  assert.equal(controller.controlled,true,'Lud campus is not controlled by its dedicated service worker');
  assert.match(controller.scriptURL,/service-worker-lud-package-v1\.js/,'wrong service worker controls the Lud campus');

  const requestsBeforeOfflineReload=canonicalCampusRequests;
  await stopServer();
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded',timeout:15000});
  await page.waitForSelector('#author-form',{state:'attached',timeout:10000});
  await page.waitForSelector('#cw-host-node-lobby',{state:'attached',timeout:10000});
  assert.equal(new URL(page.url()).pathname,'/app/lud/campus','offline reload left the canonical Lud route');
  assert.equal((await page.locator('h1').textContent())?.trim(),'Lud Mode','Lud campus did not survive offline reload');
  assert.equal(canonicalCampusRequests,requestsBeforeOfflineReload,'offline Lud reload reached the stopped origin instead of falling back to the package cache');
  assert.equal((await page.locator('#lud-passport-id').textContent())?.trim(),firstPassport,'Lud Passport changed across offline reload');

  const resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(entry=>new URL(entry.name).pathname));
  assert.ok(resources.includes('/app/content-provenance-v1.js'),'offline Lud campus did not load the provenance runtime');
  assert.ok(resources.includes('/app/lud-manual-authoring-v1.js'),'offline Lud campus did not load manual authoring');
  assert.ok(resources.includes('/app/shared/civweave-passport-identity-v1.js'),'offline Lud campus did not load Passport identity');
  assert.ok(resources.includes('/app/host-node-session-v1.js'),'offline Lud campus did not load the shared Guild session owner');
  assert.ok(resources.includes('/app/quest-arc-chronicle-v1.js'),'offline Lud campus did not load the Quest Arc Chronicle core');
  assert.equal(resources.some(resource=>resource.includes('/local-ai/')||resource.includes('/models/')||resource.includes('family-ai-loader')||resource.includes('guide-chat')),false,'Lud campus loaded an AI runtime dependency');

  console.log(JSON.stringify({
    ok:true,
    revision:'browser-lud-mode-gauntlet-v1',
    cloudflareCleanUrlRedirectExercised:htmlRedirects>0,
    canonicalEntry:'/app/lud/campus',
    onlineRefresh:true,
    originStoppedBeforeOfflineReload:true,
    offlineFallback:true,
    questArcOffline:true,
    passportPersistent:true,
    guildLobby:true,
    dedicatedWorker:true,
    aiRuntimeRequests:false
  },null,2));
  await context.close();
}catch(error){
  if(process.env.GITHUB_ACTIONS)console.error(`::error file=scripts/browser-lud-mode-gauntlet-v1.mjs::${githubEscape(error?.stack||error?.message||error)}`);
  throw error;
}finally{
  await browser.close().catch(()=>{});
  await stopServer();
}