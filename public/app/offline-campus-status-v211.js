(()=>{
'use strict';

const VERSION='1.0.40-offline-campus-status-v211-first-input-safe';
const WORKER_REVISION='offline-campus-current-graph-v280';
const STATUS_TYPES=new Set([
  'CIVWEAVE_OFFLINE_PACKAGE_STATUS',
  'CIVWEAVE_OFFLINE_PACKAGE_PROGRESS'
]);
const $=selector=>document.querySelector(selector);
const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number.isFinite(value)?value:min));
let statusActivated=false;

function normalize(status={}){
  const failed=Array.isArray(status.failed)?status.failed:[];
  const skipped=Array.isArray(status.skipped)?status.skipped:[];
  const assets=Array.isArray(status.assets)?status.assets.filter(Boolean):[];
  const failedCount=Math.max(0,Number(status.failedCount??failed.length)||0);
  const skippedCount=Math.max(0,Number(status.skippedCount??skipped.length)||0);
  const reportedTotal=Math.max(0,Number(status.total||0)||0);
  const discovered=Math.max(0,Number(status.discovered||0)||0);
  const rawCompleted=Math.max(0,Number(status.completed||0)||0);
  const hasAttempted=status.attempted!==undefined&&status.attempted!==null&&Number.isFinite(Number(status.attempted));
  const legacyAttemptSemantics=!hasAttempted&&status.revision==='lightweight-shell-v208';
  const rawDownloaded=Math.max(0,Number(status.downloaded??status.successful??(legacyAttemptSemantics?rawCompleted-failedCount:rawCompleted))||0);

  let total=reportedTotal||Math.max(0,discovered-skippedCount)||assets.length;
  const assetPaths=new Set(assets.map(String));
  const skippedOverlap=skipped.reduce((count,entry)=>{
    const path=String(entry?.pathname||'');
    return count+(path&&assetPaths.has(path)?1:0);
  },0);
  const totalAlreadyExcludesSkipped=Boolean(skippedCount&&discovered&&total+skippedCount===discovered);
  const legacyTotalIncludesSkipped=Boolean(skippedCount&&total&&!totalAlreadyExcludesSkipped&&(
    (discovered&&discovered===total)||
    skippedOverlap>0||
    (!failedCount&&rawDownloaded+skippedCount>=total)
  ));
  if(legacyTotalIncludesSkipped){
    const retirementCount=skippedOverlap||Math.min(skippedCount,total);
    total=Math.max(rawDownloaded,total-retirementCount);
  }

  const attempted=clamp(hasAttempted?Number(status.attempted):rawCompleted,0,total||Number.MAX_SAFE_INTEGER);
  const downloaded=clamp(rawDownloaded,0,total||Number.MAX_SAFE_INTEGER);
  const computedReady=!status.running&&failedCount===0&&total>0&&downloaded>=total;
  const ready=(Boolean(status.ready)||computedReady)&&failedCount===0&&(!total||downloaded>=total);
  return{...status,assets,failed,failedCount,skipped:[],skippedCount:0,total,attempted,downloaded,ready,retiredCount:0,legacyTotalIncludesSkipped};
}

function formatBytes(bytes){
  const value=Number(bytes||0);
  if(!value)return'';
  if(value<1024*1024)return`${Math.max(1,Math.round(value/1024))} KB`;
  return`${(value/(1024*1024)).toFixed(value>=10*1024*1024?0:1)} MB`;
}

function render(status){
  const packet=normalize(status);
  const state=$('#offline-package-state');
  const assets=$('#offline-package-assets');
  const button=$('#download-offline-package');
  const requiredFailures=packet.failed.some(entry=>entry?.required===true||entry?.pathname==='package');
  if(state){
    if(packet.running)state.textContent='downloading';
    else if(packet.ready)state.textContent='ready offline';
    else if(packet.failedCount&&requiredFailures)state.textContent=`${packet.failedCount} required file${packet.failedCount===1?'':'s'} need retry`;
    else if(packet.failedCount)state.textContent=`${packet.failedCount} file${packet.failedCount===1?'':'s'} need retry`;
    else state.textContent=packet.downloaded?'partially downloaded':'not downloaded';
  }
  if(assets){
    const count=packet.total?`${Math.min(packet.downloaded,packet.total)}/${packet.total} current files`:'not measured';
    const checked=packet.failedCount&&packet.attempted>packet.downloaded?` · ${Math.min(packet.attempted,packet.total)}/${packet.total} checked`:'';
    const size=formatBytes(packet.bytes);
    assets.textContent=`${count}${checked}${size?` · ${size}`:''}`;
  }
  if(button){
    if(packet.running)button.textContent=packet.total?`Downloading ${Math.min(packet.attempted,packet.total)}/${packet.total}…`:'Discovering campus files…';
    else if(packet.ready)button.textContent='Refresh offline campus';
    else if(packet.failedCount&&requiredFailures)button.textContent=`Retry ${packet.failedCount} required file${packet.failedCount===1?'':'s'}`;
    else if(packet.failedCount)button.textContent=`Retry ${packet.failedCount} missing file${packet.failedCount===1?'':'s'}`;
    else if(packet.downloaded)button.textContent='Resume offline campus';
    else button.textContent='Download offline campus';
  }
  document.documentElement.dataset.offlineCampusStatusRevision=VERSION;
  api.last=packet;
  try{dispatchEvent(new CustomEvent('civweave:offline-campus-status',{detail:packet}))}catch{}
  return packet;
}

function askWorker(worker,type,timeoutMs=6000){
  return new Promise(resolve=>{
    if(!worker)return resolve(null);
    const channel=new MessageChannel();
    const timer=setTimeout(()=>{channel.port1.close();resolve(null)},timeoutMs);
    channel.port1.onmessage=event=>{
      clearTimeout(timer);
      channel.port1.close();
      resolve(event.data||null);
    };
    try{worker.postMessage({type},[channel.port2])}catch{clearTimeout(timer);resolve(null)}
  });
}

async function currentWorker(){
  const serviceWorker=typeof navigator!=='undefined'?navigator.serviceWorker:null;
  const controller=serviceWorker?.controller||null;
  const registration=await serviceWorker?.getRegistration?.('/').catch(()=>null);
  return registration?.active||registration?.waiting||controller||null;
}

async function askCurrentStatus(){
  const worker=await currentWorker();
  const serviceWorker=typeof navigator!=='undefined'?navigator.serviceWorker:null;
  const packet=await askWorker(worker||serviceWorker?.controller,'GET_OFFLINE_PACKAGE_STATUS');
  if(STATUS_TYPES.has(packet?.type))render(packet);
  return packet||null;
}

function activateStatus(){
  if(statusActivated)return false;
  statusActivated=true;
  void askCurrentStatus();
  return true;
}

const api={version:VERSION,workerRevision:WORKER_REVISION,normalize,render,last:null,activate:activateStatus,eagerStatusLookup:false,firstInputSafe:true};
globalThis.CivweaveOfflineCampusStatusV211=api;
globalThis.CivweaveOfflineCampusStatusV210=api;
const serviceWorker=typeof navigator!=='undefined'?navigator.serviceWorker:null;
serviceWorker?.addEventListener('message',event=>{
  if(STATUS_TYPES.has(event.data?.type))render(event.data);
});
const activationTarget=$('#campus-install-progress')||$('#download-offline-package');
activationTarget?.addEventListener?.('pointerdown',activateStatus,{once:true,passive:true});
activationTarget?.addEventListener?.('focusin',activateStatus,{once:true});
addEventListener('civweave:offline-campus-status-requested',activateStatus);
serviceWorker?.addEventListener('controllerchange',()=>{if(statusActivated)setTimeout(askCurrentStatus,0)});

})();