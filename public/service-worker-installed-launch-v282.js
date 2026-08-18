;(()=>{
'use strict';

// Installed launches are an app-shell boundary, never an installer fallback.
const V282_REVISION='installed-pwa-launch-v295-entry-integrity';
const V282_ENTRY_PATH='/app/installed-entry-v146.html';
const V282_CAMPUS_PATH='/app/working-campus-v156.html';
const V282_ENTRY_MARKERS=[
  'CivweaveInstalledLaunchGateV1',
  'id="boot-title"',
  '/app/installed-entry-v146.js'
];

async function v282EntryResponseValid(response){
  if(!responseLooksValid(response,V282_ENTRY_PATH))return false;
  const type=String(response.headers?.get?.('content-type')||'');
  if(type&&!/text\/html/i.test(type))return false;
  try{
    const text=await response.clone().text();
    return V282_ENTRY_MARKERS.every(marker=>text.includes(marker));
  }catch{return false}
}

async function v282ResolveInstalledEntry(cacheName){
  // The installed start document must be network-first while online. A stale
  // text/html response can otherwise strand the PWA before its bootstrap JS
  // gets a chance to refresh or repair the service worker.
  try{
    const fetched=await fetchFresh(V282_ENTRY_PATH,'installed-app-entry');
    if(await v282EntryResponseValid(fetched)){
      await (await caches.open(cacheName)).put(cacheKey(V282_ENTRY_PATH),fetched.clone());
      return fetched;
    }
  }catch{}
  const cached=await findCached(V282_ENTRY_PATH);
  return await v282EntryResponseValid(cached)?cached:null;
}

async function v282Resolve(pathname,purpose,cacheName){
  let response=await findCached(pathname);
  if(response)return response;
  try{
    const fetched=await fetchFresh(pathname,purpose);
    if(!responseLooksValid(fetched,pathname))return null;
    response=fetched;
    await (await caches.open(cacheName)).put(cacheKey(pathname),response.clone());
    return response;
  }catch{return null}
}

function v282CampusRecoveryLauncher(request){
  const target=new URL(V282_CAMPUS_PATH,self.location.origin);
  target.searchParams.set('installed','1');
  target.searchParams.set('version',VERSION);
  target.searchParams.set('launch','installed-entry-recovery-v295');
  const href=`${target.pathname}${target.search}`;
  const body=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#061019"><meta http-equiv="Cache-Control" content="no-store"><title>Opening Civweave</title><style>html,body{margin:0;min-height:100%;background:#061019;color:#f5fbff;font:16px/1.5 system-ui}body{display:grid;place-items:center;padding:24px}p{color:#b8cad5}</style></head><body><main><strong>Opening Civweave…</strong><p>The installed launch document was stale, so Civweave is opening the Working Campus directly.</p></main><script>location.replace(${JSON.stringify(href)})<\/script><noscript><a href="${href}">Open Civweave</a></noscript></body></html>`;
  const headers={
    'content-type':'text/html; charset=utf-8',
    'cache-control':'no-store',
    'x-civweave-installed-launch':V282_REVISION,
    'x-civweave-installed-recovery':'working-campus'
  };
  if(request.method==='HEAD')return new Response(null,{status:200,headers});
  return new Response(body,{status:200,headers});
}

async function v282InstalledAppEntry(request){
  const response=await v282ResolveInstalledEntry(SHELL_CACHE);
  if(!response){
    const campus=await v282Resolve(V282_CAMPUS_PATH,'installed-campus-recovery',RUNTIME_CACHE);
    if(campus&&responseLooksValid(campus,V282_CAMPUS_PATH))return v282CampusRecoveryLauncher(request);
    return new Response('Civweave is installed, but its local launch entry and Working Campus are unavailable. Repair the app shell when you are back online.',{
      status:503,
      headers:{
        'content-type':'text/plain; charset=utf-8',
        'cache-control':'no-store',
        'x-civweave-installed-launch':V282_REVISION
      }
    });
  }

  const normalized=await normalizeStableAppEntryResponse(response);
  const headers=new Headers(normalized.headers);
  headers.set('x-civweave-installed-launch',V282_REVISION);
  headers.set('x-civweave-installed-entry-integrity','marker-validated');
  headers.set('x-civweave-installed-recovery','not-needed');
  if(request.method==='HEAD')return new Response(null,{status:normalized.status,statusText:normalized.statusText,headers});
  const body=await normalized.clone().arrayBuffer();
  return new Response(body,{status:normalized.status,statusText:normalized.statusText,headers});
}

stableAppEntry=v282InstalledAppEntry;
self.CivweaveInstalledLaunchV282=Object.freeze({
  revision:V282_REVISION,
  entryPath:V282_ENTRY_PATH,
  entryMarkers:[...V282_ENTRY_MARKERS],
  entryResponseValid:v282EntryResponseValid,
  campusRecoveryPath:V282_CAMPUS_PATH,
  entryPolicy:'network-first-marker-validated-cache-fallback',
  policy:'validated-installed-entry-then-working-campus-never-installer-substitution'
});
})();
