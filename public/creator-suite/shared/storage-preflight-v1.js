(()=>{
'use strict';
const DEFAULT_MINIMUM_FREE=64*1024*1024;
async function estimate(options={}){
  const minimumFreeBytes=Math.max(0,Number(options.minimumFreeBytes??DEFAULT_MINIMUM_FREE));
  let usage=null,quota=null,persisted=null;
  if(navigator.storage?.estimate){try{const value=await navigator.storage.estimate();usage=Number.isFinite(value.usage)?value.usage:null;quota=Number.isFinite(value.quota)?value.quota:null}catch{}}
  if(navigator.storage?.persisted){try{persisted=await navigator.storage.persisted()}catch{}}
  const freeBytes=quota!=null&&usage!=null?Math.max(0,quota-usage):null;
  return{schema:'civweave.creator-storage-preflight.v1',usageBytes:usage,quotaBytes:quota,freeBytes,persisted,minimumFreeBytes,ok:freeBytes==null?true:freeBytes>=minimumFreeBytes,estimateSupported:Boolean(navigator.storage?.estimate),persistenceSupported:Boolean(navigator.storage?.persist)};
}
async function requestPersistence(){if(!navigator.storage?.persist)return false;try{return Boolean(await navigator.storage.persist())}catch{return false}}
function formatBytes(value){if(value==null||!Number.isFinite(value))return'Unknown';const units=['B','KB','MB','GB','TB'];let number=Math.max(0,value),unit=0;while(number>=1024&&unit<units.length-1){number/=1024;unit+=1}return`${number>=10||unit===0?number.toFixed(0):number.toFixed(1)} ${units[unit]}`}
globalThis.CivweaveCreatorStoragePreflightV1=Object.freeze({estimate,requestPersistence,formatBytes,defaultMinimumFreeBytes:DEFAULT_MINIMUM_FREE});
})();
