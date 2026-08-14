#!/usr/bin/env node

import {pathToFileURL} from 'node:url';

export function parseSemver(value,label='version'){
  const text=String(value||'').trim();
  const match=/^(\d+)\.(\d+)\.(\d+)$/.exec(text);
  if(!match)throw new Error(`${label} must be a semantic version.`);
  return{text,parts:match.slice(1).map(Number)};
}
export function compareSemver(left,right){
  const a=parseSemver(left,'left version').parts;
  const b=parseSemver(right,'right version').parts;
  for(let index=0;index<3;index+=1){if(a[index]!==b[index])return a[index]>b[index]?1:-1;}
  return 0;
}
export function assertProductionVersion({expected,deployed,allowNewer=false}){
  parseSemver(expected,'expected version');
  parseSemver(deployed,'deployed version');
  const comparison=compareSemver(deployed,expected);
  if(allowNewer){
    if(comparison<0)throw new Error(`deployed Civweave v${deployed} is older than required production floor v${expected}`);
  }else if(comparison!==0){
    throw new Error(`deployed Civweave v${deployed} does not exactly match expected v${expected}`);
  }
  return deployed;
}
export function deployedVersionFromManifest(manifest){
  const name=String(manifest?.name||'');
  const match=/^Civweave v(\d+\.\d+\.\d+)$/.exec(name);
  if(!match)throw new Error(`manifest name is not a Civweave semantic release: ${JSON.stringify(name)}`);
  return match[1];
}

async function main(){
  const expected=String(process.env.CIVWEAVE_EXPECTED_VERSION||'').trim();
  const allowNewer=/^(?:1|true|yes)$/i.test(String(process.env.CIVWEAVE_ALLOW_NEWER_VERSION||''));
  const rawTargets=String(process.env.CIVWEAVE_PRODUCTION_URLS||'https://commonweave.pages.dev,https://commonweave-host-node-9l1u.onrender.com');
  const attempts=Math.max(1,Number.parseInt(process.env.CIVWEAVE_PROBE_ATTEMPTS||'1',10)||1);
  const delayMs=Math.max(0,Number.parseInt(process.env.CIVWEAVE_PROBE_DELAY_MS||'15000',10)||0);

  parseSemver(expected,'CIVWEAVE_EXPECTED_VERSION');
  const targets=rawTargets.split(',').map(value=>value.trim()).filter(Boolean).map(value=>new URL(value));
  if(!targets.length)throw new Error('CIVWEAVE_PRODUCTION_URLS must contain at least one base URL.');
  for(const target of targets)if(target.protocol!=='https:')throw new Error(`Production canary requires HTTPS: ${target.href}`);

  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const token=attempt=>`${Date.now()}-${attempt}-${Math.random().toString(36).slice(2)}`;
  function describeError(error){
    if(!(error instanceof Error))return String(error);
    const parts=[error.message];
    let cause=error.cause;
    const seen=new Set();
    while(cause&&typeof cause==='object'&&!seen.has(cause)){
      seen.add(cause);
      const code=typeof cause.code==='string'?cause.code:'';
      const message=typeof cause.message==='string'?cause.message:'';
      const detail=[code,message].filter(Boolean).join(': ');
      if(detail&&!parts.includes(detail))parts.push(detail);
      cause=cause.cause;
    }
    return parts.join(' -> ');
  }

  async function get(base,path,attempt){
    const url=new URL(path,base);
    url.searchParams.set('deployment_canary',token(attempt));
    let response;
    try{
      response=await fetch(url,{redirect:'follow',headers:{'cache-control':'no-cache, no-store, max-age=0','pragma':'no-cache','accept':'*/*'}});
    }catch(error){
      throw new Error(`${url.pathname} fetch failed: ${describeError(error)}`,{cause:error});
    }
    if(!response.ok)throw new Error(`${url.pathname} returned HTTP ${response.status}`);
    return{url:response.url,text:await response.text(),headers:response.headers};
  }
  function requireToken(source,required,label){if(!source.includes(required))throw new Error(`${label} is missing ${required}`)}

  async function probe(base,attempt){
    const [manifestResponse,entryResponse,workerResponse,settingsResponse]=await Promise.all([
      get(base,'/app/manifest.webmanifest',attempt),
      get(base,'/app/installed-entry-v146.js',attempt),
      get(base,'/service-worker-v203.js',attempt),
      get(base,'/app/local-ai/settings-panel-v267.js',attempt)
    ]);
    let manifest;
    try{manifest=JSON.parse(manifestResponse.text)}catch{throw new Error('manifest.webmanifest did not return JSON')}
    const deployed=deployedVersionFromManifest(manifest);
    assertProductionVersion({expected,deployed,allowNewer});
    if(manifest.start_url!=='/app/installed-entry-v146.html?installed=1')throw new Error(`manifest start_url is ${JSON.stringify(manifest.start_url)}`);

    const entry=entryResponse.text;
    requireToken(entry,`const FALLBACK_VERSION='${deployed}';`,'installed entry');
    requireToken(entry,`version:'${deployed}-boot-recovery-v426`,'installed entry');
    requireToken(entry,"updateViaCache:'none'",'installed entry');
    requireToken(entry,'registration.update()','installed entry');
    requireToken(entry,'bounded(registration.update()','installed entry');
    requireToken(entry,"candidate.postMessage({type:'SKIP_WAITING'})",'installed entry');
    requireToken(entry,'revision=boot-recovery-v426','installed entry');
    requireToken(entry,"fetch(`/app/manifest.webmanifest?boot=${Date.now()}`,{cache:'no-store'",'installed entry');
    requireToken(entry,'bounded(fetch(','installed entry');
    requireToken(entry,"browserRuntimePolicy:'installed-display-only'",'installed entry');

    const worker=workerResponse.text;
    requireToken(worker,`/app/system-routes-v227.js?v=${deployed}-five-system-route-contract-v227`,'service worker');
    requireToken(worker,`/service-worker-core-v208.js?v=${deployed}-chat-convergence-v250`,'service worker');
    requireToken(worker,"/service-worker-chat-repair-v245.js?v=chat-css-contract-v343&purge=chat-css-contract-v343",'service worker');
    requireToken(worker,"self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting())})",'service worker');

    const settings=settingsResponse.text;
    requireToken(settings,"cacheIntegrityOnDemand:true",'local AI settings');
    requireToken(settings,"openPath:'snapshot-first-v287'",'local AI settings');
    requireToken(settings,'Large cached weights are not inspected while the menu is opening.','local AI settings');

    return{
      base:base.origin,
      expected,
      version:deployed,
      policy:allowNewer?'at-least-expected':'exact',
      manifest:new URL(manifestResponse.url).pathname,
      installedEntry:new URL(entryResponse.url).pathname,
      serviceWorker:new URL(workerResponse.url).pathname,
      localAISettings:new URL(settingsResponse.url).pathname,
      launchRevision:'boot-recovery-v426',
      boundedUpdate:true,
      activeChatRepairRevision:'chat-css-contract-v343',
      mobileAISettingsRevision:'snapshot-first-v287'
    };
  }

  let last=[];
  for(let attempt=1;attempt<=attempts;attempt+=1){
    const settled=await Promise.all(targets.map(async base=>{
      try{return{ok:true,result:await probe(base,attempt)}}catch(error){return{ok:false,base:base.origin,error:describeError(error)}}
    }));
    const failures=settled.filter(row=>!row.ok);
    if(!failures.length){
      const results=settled.map(row=>row.result);
      console.log(JSON.stringify({ok:true,expected,allowNewer,attempt,targets:results},null,2));
      return;
    }
    last=failures;
    console.error(`Production boot canary attempt ${attempt}/${attempts} failed: ${failures.map(row=>`${row.base}: ${row.error}`).join(' | ')}`);
    if(attempt<attempts)await sleep(delayMs);
  }
  throw new Error(`Production boot canary did not satisfy ${allowNewer?'floor':'exact'} v${expected}: ${last.map(row=>`${row.base}: ${row.error}`).join(' | ')}`);
}

const entry=process.argv[1]?pathToFileURL(process.argv[1]).href:'';
if(import.meta.url===entry)await main();