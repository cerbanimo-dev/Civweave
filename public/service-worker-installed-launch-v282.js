;(()=>{
'use strict';

// Installed launches are an app-shell boundary, never an installer fallback.
const V282_REVISION='installed-pwa-launch-v282';
const V282_ENTRY_PATH='/app/installed-entry-v146.html';

async function v282InstalledAppEntry(request){
  let response=await findCached(V282_ENTRY_PATH);
  if(!response){
    try{
      const fetched=await fetchFresh(V282_ENTRY_PATH,'installed-app-entry');
      if(responseLooksValid(fetched,V282_ENTRY_PATH)){
        response=await normalizeStableAppEntryResponse(fetched);
        await (await caches.open(SHELL_CACHE)).put(cacheKey(V282_ENTRY_PATH),response.clone());
      }
    }catch{}
  }

  if(!response){
    return new Response('Civweave is installed, but its local launch entry is unavailable. Repair the app shell when you are back online.',{
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
  if(request.method==='HEAD')return new Response(null,{status:normalized.status,statusText:normalized.statusText,headers});
  const body=await normalized.clone().arrayBuffer();
  return new Response(body,{status:normalized.status,statusText:normalized.statusText,headers});
}

stableAppEntry=v282InstalledAppEntry;
self.CivweaveInstalledLaunchV282=Object.freeze({
  revision:V282_REVISION,
  entryPath:V282_ENTRY_PATH,
  policy:'installed-entry-never-installer-substitution'
});
})();
