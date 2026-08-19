;(()=>{
'use strict';

const LOW_PRESSURE_REVISION='offline-campus-low-pressure-v1';
const LOW_PRESSURE_GRAPH_REVISION='offline-campus-current-graph-v280';
const LOW_PRESSURE_POLICY='resumable-low-pressure-mobile-v1';
const LOW_PRESSURE_REFERENCE_POLICY='current-manifest-only-v282';
const LOW_PRESSURE_YIELD_MS=18;
const LOW_PRESSURE_TEXT_LIMIT=1500000;
let lowPressureDownloadPromise=null;

const lowPressurePause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function lowPressurePacket(meta={}){
  const assets=[...new Set((Array.isArray(meta.assets)?meta.assets:[]).filter(Boolean))];
  const downloadedAssets=[...new Set((Array.isArray(meta.downloadedAssets)?meta.downloadedAssets:[]).filter(pathname=>assets.includes(pathname)))];
  const failed=Array.isArray(meta.failed)?meta.failed:[];
  const downloaded=Math.max(0,Math.min(assets.length,Number(meta.downloaded??downloadedAssets.length)||0));
  const running=Boolean(meta.running);
  const paused=Boolean(meta.paused);
  const ready=Boolean(meta.ready)&&!running&&!paused&&failed.length===0&&assets.length>0&&downloaded>=assets.length;
  return{
    type:'CIVWEAVE_OFFLINE_PACKAGE_STATUS',
    mode:'resumable-low-pressure-campus',
    version:VERSION,
    revision:LOW_PRESSURE_GRAPH_REVISION,
    runtimeRevision:LOW_PRESSURE_REVISION,
    policy:LOW_PRESSURE_POLICY,
    referencePolicy:LOW_PRESSURE_REFERENCE_POLICY,
    cache:OFFLINE_CACHE,
    ready,running,paused,
    interrupted:Boolean(meta.interrupted),
    resumeSupported:true,
    resumeStrategy:'single-file-checkpoint-and-yield',
    completed:downloaded,
    attempted:Math.max(0,Number(meta.attempted??downloaded)||0),
    downloaded,
    successful:downloaded,
    downloadedAssets,
    total:assets.length,
    discovered:assets.length,
    failed,
    failedCount:failed.length,
    skipped:Array.isArray(meta.skipped)?meta.skipped:[],
    skippedCount:Array.isArray(meta.skipped)?meta.skipped.length:0,
    bytes:Math.max(0,Number(meta.bytes)||0),
    updatedAt:meta.updatedAt||null,
    assets
  };
}

async function lowPressureBroadcast(packet){
  try{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){try{client.postMessage(packet)}catch{}}
  }catch{}
}

async function lowPressureStatus(){
  const current=await readOfflineMeta();
  if(current)return lowPressurePacket({...current,running:Boolean(current.running&&lowPressureDownloadPromise),interrupted:Boolean(current.running&&!lowPressureDownloadPromise)});
  const manifest=await loadOfflineManifest().catch(()=>({seeds:[],assets:[]}));
  return lowPressurePacket({ready:false,running:false,paused:false,attempted:0,downloaded:0,assets:[...new Set([...(manifest.seeds||[]),...(manifest.assets||[])])],downloadedAssets:[],failed:[],bytes:0,updatedAt:null});
}

async function lowPressureRun(event){
  const manifest=await loadOfflineManifest();
  const previous=await readOfflineMeta()||{};
  const maxAssets=Math.max(50,Math.min(1500,Number(manifest.maxAssets||700)));
  const maxDepth=Math.max(1,Math.min(12,Number(manifest.maxDepth||8)));
  const required=new Set([...(manifest.seeds||[]),...(manifest.assets||[])]);
  const initial=[...new Set([...(manifest.seeds||[]),...(manifest.assets||[]),...((previous.assets||[]).filter(Boolean))])].slice(0,maxAssets);
  const queue=initial.map(pathname=>({pathname,depth:0,required:required.has(pathname)}));
  const queued=new Set(initial);
  const processed=new Set();
  const downloaded=new Set((previous.downloadedAssets||[]).filter(pathname=>queued.has(pathname)));
  const failed=new Map((previous.failed||[]).filter(entry=>entry?.pathname&&required.has(entry.pathname)).map(entry=>[entry.pathname,entry]));
  let attempted=0;
  let bytes=Math.max(0,Number(previous.bytes)||0);

  const checkpoint=async({running=true,ready=false,forceBroadcast=false}={})=>{
    const assets=[...queued];
    const downloadedAssets=assets.filter(pathname=>downloaded.has(pathname));
    const packet=lowPressurePacket({ready,running,paused:false,attempted,downloaded:downloadedAssets.length,downloadedAssets,assets,failed:[...failed.values()],bytes,updatedAt:new Date().toISOString()});
    await writeOfflineMeta(packet);
    const outbound={...packet,type:running?'CIVWEAVE_OFFLINE_PACKAGE_PROGRESS':packet.type};
    post(event,outbound);
    if(forceBroadcast||attempted%4===0||!running)await lowPressureBroadcast(outbound);
    return packet;
  };

  await checkpoint({running:true,forceBroadcast:true});

  while(queue.length&&processed.size<maxAssets){
    const item=queue.shift();
    if(!item||processed.has(item.pathname))continue;
    processed.add(item.pathname);attempted+=1;
    try{
      const preferNetwork=!downloaded.has(item.pathname)&&/\.(?:html?|css|m?js|json|webmanifest|md|txt)$/i.test(item.pathname);
      const {response,contentLength}=await cacheOfflineAsset(item.pathname,{preferNetwork});
      downloaded.add(item.pathname);failed.delete(item.pathname);bytes+=Math.max(0,Number(contentLength)||0);
      const type=String(response.headers.get('content-type')||'');
      if(item.depth<maxDepth&&TEXT_CONTENT.test(type)){
        const text=await response.clone().text();
        if(text.length<=LOW_PRESSURE_TEXT_LIMIT){
          for(const pathname of discoverReferences(text,new URL(item.pathname,self.location.origin),manifest)){
            if(queued.size>=maxAssets||queued.has(pathname))continue;
            queued.add(pathname);queue.push({pathname,depth:item.depth+1,required:required.has(pathname)});
          }
        }
      }
    }catch(error){
      downloaded.delete(item.pathname);
      if(item.required)failed.set(item.pathname,{pathname:item.pathname,message:error?.message||String(error),status:Number(error?.status||0),attempts:Math.max(1,Number(failed.get(item.pathname)?.attempts||0)+1),required:true});
      else queued.delete(item.pathname);
    }
    await checkpoint({running:true});
    await lowPressurePause(LOW_PRESSURE_YIELD_MS);
  }

  const ready=queue.length===0&&failed.size===0;
  return checkpoint({running:false,ready,forceBroadcast:true});
}

offlinePacket=lowPressurePacket;
offlineStatus=lowPressureStatus;
downloadOfflinePackage=function downloadOfflinePackageLowPressure(event){
  if(lowPressureDownloadPromise){
    return lowPressureDownloadPromise.then(packet=>{post(event,packet);return packet});
  }
  lowPressureDownloadPromise=lowPressureRun(event).finally(()=>{lowPressureDownloadPromise=null});
  return lowPressureDownloadPromise;
};

self.CivweaveOfflineLowPressureV1=Object.freeze({revision:LOW_PRESSURE_REVISION,policy:LOW_PRESSURE_POLICY,concurrency:1,yieldMs:LOW_PRESSURE_YIELD_MS,textLimit:LOW_PRESSURE_TEXT_LIMIT,get active(){return Boolean(lowPressureDownloadPromise)}});
})();