'use strict';

(()=>{
  const VERSION='1.0.60-local-model-background-v267';
  const PREFIX='cw-local-ai-v267::';
  const MODEL_CACHE='civweave-model-generative-v266';
  const META_CACHE='civweave-model-download-meta-v267';
  const META_ROOT='/__civweave/local-ai/background/';

  const clean=value=>String(value??'').slice(0,500);
  function parts(registration){
    const raw=String(registration?.id||'');
    if(!raw.startsWith(PREFIX))return null;
    const tokens=raw.split('::');
    if(tokens.length<3)return null;
    let modelId='';
    try{modelId=decodeURIComponent(tokens[1]||'')}catch{modelId=tokens[1]||''}
    return{jobId:raw,modelId,revision:tokens[2]||''};
  }
  function metaRequest(jobId){return new Request(new URL(`${META_ROOT}${encodeURIComponent(jobId)}.json`,self.location.origin).href)}
  async function writeMeta(jobId,value){
    const cache=await caches.open(META_CACHE);
    const body=JSON.stringify({schema:'civweave.local-ai.background.v267',version:VERSION,jobId,...value,updatedAt:new Date().toISOString()});
    await cache.put(metaRequest(jobId),new Response(body,{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}}));
  }
  async function broadcast(packet){
    try{
      const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
      for(const client of windows)client.postMessage({type:'CIVWEAVE_LOCAL_MODEL_BACKGROUND',version:VERSION,...packet});
    }catch{}
  }
  async function copyRecords(registration){
    const cache=await caches.open(MODEL_CACHE);
    const records=await registration.matchAll();
    let bytes=0,copied=0;
    for(const record of records){
      const response=await record.responseReady;
      if(!response?.ok)throw new Error(`${new URL(record.request.url).pathname} returned ${response?.status||0}`);
      bytes+=Number(response.headers.get('content-length')||0);
      await cache.put(record.request,response);
      copied+=1;
    }
    return{bytes,copied};
  }
  async function settle(event,status){
    const info=parts(event.registration);if(!info)return;
    const registration=event.registration;
    let detail={status,modelId:info.modelId,revision:info.revision,downloaded:Number(registration.downloaded||0),downloadTotal:Number(registration.downloadTotal||0),failureReason:clean(registration.failureReason||'')};
    if(status==='ready'){
      const copied=await copyRecords(registration);
      detail={...detail,...copied,downloaded:Number(registration.downloaded||copied.bytes||0)};
    }
    await writeMeta(info.jobId,detail);
    await broadcast({jobId:info.jobId,...detail});
    try{await event.updateUI?.({title:status==='ready'?'Civweave local model ready':status==='aborted'?'Civweave model download cancelled':'Civweave model download needs attention'})}catch{}
  }

  self.addEventListener('backgroundfetchsuccess',event=>{if(parts(event.registration))event.waitUntil(settle(event,'ready'))});
  self.addEventListener('backgroundfetchfailure',event=>{if(parts(event.registration))event.waitUntil(settle(event,'error'))});
  self.addEventListener('backgroundfetchabort',event=>{if(parts(event.registration))event.waitUntil(settle(event,'aborted'))});
  self.addEventListener('backgroundfetchclick',event=>{
    const info=parts(event.registration);if(!info)return;
    event.waitUntil((async()=>{
      const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
      const target=windows.find(client=>'focus'in client);
      if(target){await target.focus();target.postMessage({type:'CIVWEAVE_LOCAL_MODEL_BACKGROUND_CLICK',modelId:info.modelId,jobId:info.jobId});return}
      await self.clients.openWindow?.('/app/working-campus-v156.html?localModelDownloads=1');
    })());
  });
})();
