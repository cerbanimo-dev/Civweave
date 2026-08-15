;(()=>{
'use strict';

const V282_REVISION='installed-pwa-launch-v294-campus-recovery-local-first';
const V282_ENTRY_PATH='/app/installed-entry-v146.html';
const V282_CAMPUS_PATH='/app/working-campus-v156.html';

async function v282Resolve(pathname){
  return findCached(pathname);
}

function v282CampusRecoveryLauncher(request){
  const target=new URL(V282_CAMPUS_PATH,self.location.origin);
  target.searchParams.set('installed','1');
  target.searchParams.set('version',VERSION);
  target.searchParams.set('launch','installed-entry-recovery-v294');
  const href=`${target.pathname}${target.search}`;
  const body=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Cache-Control" content="no-store"><title>Opening Civweave</title></head><body><p>Opening Civweave…</p><script>location.replace(${JSON.stringify(href)})<\/script><noscript><a href="${href}">Open Civweave</a></noscript></body></html>`;
  const headers={
    'content-type':'text/html; charset=utf-8',
    'cache-control':'no-store',
    'x-civweave-installed-launch':V282_REVISION,
    'x-civweave-installed-recovery':'working-campus',
    'x-civweave-local-first':'cache-only-runtime'
  };
  if(request.method==='HEAD')return new Response(null,{status:200,headers});
  return new Response(body,{status:200,headers});
}

async function v282InstalledAppEntry(request){
  const response=await v282Resolve(V282_ENTRY_PATH);
  if(!response){
    const campus=await v282Resolve(V282_CAMPUS_PATH);
    if(campus&&responseLooksValid(campus,V282_CAMPUS_PATH))return v282CampusRecoveryLauncher(request);
    return new Response('Civweave is installed, but its local launch entry and Working Campus are unavailable. Open the local package installer to repair this device package.',{
      status:503,
      headers:{
        'content-type':'text/plain; charset=utf-8',
        'cache-control':'no-store',
        'x-civweave-installed-launch':V282_REVISION,
        'x-civweave-local-first':'package-required'
      }
    });
  }

  const normalized=await normalizeStableAppEntryResponse(response);
  const headers=new Headers(normalized.headers);
  headers.set('x-civweave-installed-launch',V282_REVISION);
  headers.set('x-civweave-installed-recovery','not-needed');
  headers.set('x-civweave-local-first','cache-only-runtime');
  if(request.method==='HEAD')return new Response(null,{status:normalized.status,statusText:normalized.statusText,headers});
  const body=await normalized.clone().arrayBuffer();
  return new Response(body,{status:normalized.status,statusText:normalized.statusText,headers});
}

stableAppEntry=v282InstalledAppEntry;
self.CivweaveInstalledLaunchV282=Object.freeze({
  revision:V282_REVISION,
  entryPath:V282_ENTRY_PATH,
  campusRecoveryPath:V282_CAMPUS_PATH,
  policy:'installed-entry-then-local-working-campus-never-network-fallback',
  runtimeNetworkFallback:false
});
})();
