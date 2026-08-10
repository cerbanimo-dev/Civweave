;(()=>{
'use strict';

const REVISION='installed-shell-repair-v293';
let repairPromise=null;

function reply(event,packet){
  try{event.ports?.[0]?.postMessage(packet)}catch{}
  try{event.source?.postMessage?.(packet)}catch{}
}

async function repairShell(){
  if(repairPromise)return repairPromise;
  repairPromise=(async()=>{
    const result=await cacheShell();
    const status=await shellStatus();
    return{
      ...status,
      type:'CIVWEAVE_DEVICE_PACKAGE_REPAIR',
      repairRevision:REVISION,
      repaired:Boolean(status.ready),
      integrity:result?.integrity||null,
      integrityRevision:result?.integrityRevision||status.integrityRevision||null,
      optionalFailures:Array.isArray(result?.optionalFailures)?result.optionalFailures:[]
    };
  })().finally(()=>{repairPromise=null});
  return repairPromise;
}

self.addEventListener('message',event=>{
  if(event.data?.type!=='REPAIR_DEVICE_PACKAGE')return;
  event.waitUntil(repairShell().then(packet=>reply(event,packet)).catch(error=>{
    reply(event,{
      type:'CIVWEAVE_DEVICE_PACKAGE_REPAIR',
      version:typeof VERSION==='string'?VERSION:null,
      revision:typeof BUILD==='string'?BUILD:null,
      repairRevision:REVISION,
      ready:false,
      repaired:false,
      error:error?.message||String(error),
      failures:Array.isArray(error?.failures)?error.failures:[]
    });
  }));
});

self.CivweaveInstalledShellRepairV293=Object.freeze({
  revision:REVISION,
  message:'REPAIR_DEVICE_PACKAGE',
  policy:'verified-shell-only-preserve-campus-model-school-storage'
});
})();
