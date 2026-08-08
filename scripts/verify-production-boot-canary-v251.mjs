#!/usr/bin/env node

const expected=String(process.env.CIVWEAVE_EXPECTED_VERSION||'').trim();
const rawTargets=String(process.env.CIVWEAVE_PRODUCTION_URLS||'https://civweave.pages.dev,https://commonweave-host-node-9l1u.onrender.com');
const attempts=Math.max(1,Number.parseInt(process.env.CIVWEAVE_PROBE_ATTEMPTS||'1',10)||1);
const delayMs=Math.max(0,Number.parseInt(process.env.CIVWEAVE_PROBE_DELAY_MS||'15000',10)||0);

if(!/^\d+\.\d+\.\d+$/.test(expected))throw new Error('CIVWEAVE_EXPECTED_VERSION must be a semantic version.');
const targets=rawTargets.split(',').map(value=>value.trim()).filter(Boolean).map(value=>new URL(value));
if(!targets.length)throw new Error('CIVWEAVE_PRODUCTION_URLS must contain at least one base URL.');
for(const target of targets)if(target.protocol!=='https:')throw new Error(`Production canary requires HTTPS: ${target.href}`);

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const token=attempt=>`${Date.now()}-${attempt}-${Math.random().toString(36).slice(2)}`;

async function get(base,path,attempt){
  const url=new URL(path,base);
  url.searchParams.set('deployment_canary',token(attempt));
  const response=await fetch(url,{redirect:'follow',headers:{'cache-control':'no-cache, no-store, max-age=0','pragma':'no-cache','accept':'*/*'}});
  if(!response.ok)throw new Error(`${url.pathname} returned HTTP ${response.status}`);
  return{url:response.url,text:await response.text(),headers:response.headers};
}
function requireToken(source,token,label){if(!source.includes(token))throw new Error(`${label} is missing ${token}`)}

async function probe(base,attempt){
  const [manifestResponse,entryResponse,workerResponse]=await Promise.all([
    get(base,'/app/manifest.webmanifest',attempt),
    get(base,'/app/installed-entry-v146.js',attempt),
    get(base,'/service-worker-v203.js',attempt)
  ]);
  let manifest;
  try{manifest=JSON.parse(manifestResponse.text)}catch{throw new Error('manifest.webmanifest did not return JSON')}
  if(manifest.name!==`Civweave v${expected}`)throw new Error(`manifest reports ${JSON.stringify(manifest.name)} instead of Civweave v${expected}`);
  if(manifest.start_url!=='/app/installed-entry-v146.html?installed=1')throw new Error(`manifest start_url is ${JSON.stringify(manifest.start_url)}`);

  const entry=entryResponse.text;
  requireToken(entry,`const FALLBACK_VERSION='${expected}';`,'installed entry');
  requireToken(entry,`version:'${expected}-chat-convergence-v250'`,'installed entry');
  requireToken(entry,"updateViaCache:'none'",'installed entry');
  requireToken(entry,'await registration.update()','installed entry');
  requireToken(entry,"candidate.postMessage({type:'SKIP_WAITING'})",'installed entry');
  requireToken(entry,'revision=chat-convergence-v250','installed entry');

  const worker=workerResponse.text;
  requireToken(worker,`/app/system-routes-v227.js?v=${expected}-five-system-route-contract-v227`,'service worker');
  requireToken(worker,`/service-worker-core-v208.js?v=${expected}-chat-convergence-v250`,'service worker');
  requireToken(worker,"/service-worker-chat-repair-v245.js?v=chat-convergence-v250",'service worker');
  requireToken(worker,"self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting())})",'service worker');

  return{
    base:base.origin,
    version:expected,
    manifest:new URL(manifestResponse.url).pathname,
    installedEntry:new URL(entryResponse.url).pathname,
    serviceWorker:new URL(workerResponse.url).pathname,
    chatRevision:'chat-convergence-v250'
  };
}

let last=[];
for(let attempt=1;attempt<=attempts;attempt+=1){
  const settled=await Promise.all(targets.map(async base=>{
    try{return{ok:true,result:await probe(base,attempt)}}catch(error){return{ok:false,base:base.origin,error:error instanceof Error?error.message:String(error)}}
  }));
  const failures=settled.filter(row=>!row.ok);
  if(!failures.length){
    const results=settled.map(row=>row.result);
    console.log(JSON.stringify({ok:true,expected,attempt,targets:results},null,2));
    process.exit(0);
  }
  last=failures;
  console.error(`Production boot canary attempt ${attempt}/${attempts} failed: ${failures.map(row=>`${row.base}: ${row.error}`).join(' | ')}`);
  if(attempt<attempts)await sleep(delayMs);
}
throw new Error(`Production boot canary did not converge on v${expected}: ${last.map(row=>`${row.base}: ${row.error}`).join(' | ')}`);
