;(()=>{
'use strict';

const REVISION='campus-retired-completion-v249';
const INSTALL_BRIDGE='/app/pwa-install-prompt-v249.js';
const previousOfflineStatus=offlineStatus;
const previousDownloadOfflinePackage=downloadOfflinePackage;

function canonicalize(packet={}){
  const failed=Array.isArray(packet.failed)?packet.failed:[];
  const skipped=Array.isArray(packet.skipped)?packet.skipped:[];
  const assets=Array.isArray(packet.assets)?packet.assets.filter(Boolean):[];
  const failedCount=Math.max(0,Number(packet.failedCount??failed.length)||0);
  const skippedCount=Math.max(0,Number(packet.skippedCount??skipped.length)||0);
  const reportedTotal=Math.max(0,Number(packet.total||0)||0);
  const discovered=Math.max(0,Number(packet.discovered||0)||0);
  const downloaded=Math.max(0,Number((packet.downloaded??packet.successful??packet.completed)||0)||0);
  const skippedPaths=new Set(skipped.map(entry=>String(entry?.pathname||'')).filter(Boolean));
  const skippedOverlap=assets.reduce((count,path)=>count+(skippedPaths.has(String(path))?1:0),0);
  const alreadyExcludesSkipped=Boolean(skippedCount&&discovered&&reportedTotal+skippedCount===discovered);
  const totalIncludesRetired=Boolean(skippedCount&&reportedTotal&&!alreadyExcludesSkipped&&(
    skippedOverlap>0||
    (discovered&&discovered===reportedTotal)||
    (!failedCount&&downloaded+skippedCount>=reportedTotal)
  ));
  let total=reportedTotal||Math.max(0,discovered-skippedCount)||assets.length;
  if(totalIncludesRetired){
    const retired=skippedOverlap||Math.min(skippedCount,total);
    total=Math.max(downloaded,total-retired);
  }
  const ready=!packet.running&&failedCount===0&&total>0&&downloaded>=total;
  return{
    ...packet,
    failed,
    failedCount,
    skipped,
    skippedCount,
    total,
    downloaded:Math.min(downloaded,total||downloaded),
    completed:Math.min(Number((packet.completed??downloaded)||0)||0,total||downloaded),
    ready:Boolean(packet.ready)||ready,
    completionRevision:REVISION,
    retiredReferencesAccounted:totalIncludesRetired?skippedCount:0
  };
}

offlineStatus=async function offlineStatusV249(){
  const packet=canonicalize(await previousOfflineStatus());
  try{
    const current=await readOfflineMeta();
    if(current&&(packet.total!==current.total||packet.ready!==current.ready||packet.completionRevision!==current.completionRevision)){
      await writeOfflineMeta({...current,...packet,updatedAt:current.updatedAt||new Date().toISOString()});
    }
  }catch{}
  return packet;
};

downloadOfflinePackage=function downloadOfflinePackageV249(event){
  return Promise.resolve(previousDownloadOfflinePackage(event)).then(async packet=>{
    const canonical=canonicalize(packet||{});
    try{
      const current=await readOfflineMeta();
      if(current)await writeOfflineMeta({...current,...canonical,updatedAt:new Date().toISOString()});
    }catch{}
    return canonical;
  });
};

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    try{
      const response=await fetch(INSTALL_BRIDGE,{cache:'no-store'});
      if(response?.ok)await(await caches.open(RUNTIME_CACHE)).put(cacheKey(INSTALL_BRIDGE),response.clone());
    }catch{}
  })());
});

self.CivweaveCampusCompletionV246=Object.freeze({
  revision:REVISION,
  installBridge:INSTALL_BRIDGE,
  canonicalize,
  policy:'retired-references-do-not-block-current-campus-readiness'
});
})();