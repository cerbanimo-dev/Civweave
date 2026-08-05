(()=>{
'use strict';

const VERSION='1.0.6-offline-campus-status-v211';
const WORKER_REVISION='offline-campus-seed-provenance-v211';
const STATUS_TYPES=new Set([
  'COMMONWEAVE_OFFLINE_PACKAGE_STATUS',
  'COMMONWEAVE_OFFLINE_PACKAGE_PROGRESS'
]);
const $=selector=>document.querySelector(selector);
const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number.isFinite(value)?value:min));

function normalize(status={}){
  const failed=Array.isArray(status.failed)?status.failed:[];
  const skipped=Array.isArray(status.skipped)?status.skipped:[];
  const failedCount=Math.max(0,Number(status.failedCount??failed.length)||0);
  const skippedCount=Math.max(0,Number(status.skippedCount??skipped.length)||0);
  const total=Math.max(0,Number(status.total||status.discovered-skippedCount||0)||0);
  const rawCompleted=Math.max(0,Number(status.completed||0)||0);
  const hasAttempted=status.attempted!==undefined&&status.attempted!==null&&Number.isFinite(Number(status.attempted));
  const legacyAttemptSemantics=!hasAttempted&&status.revision==='lightweight-shell-v208';
  const attempted=clamp(hasAttempted?Number(status.attempted):rawCompleted,0,total||Number.MAX_SAFE_INTEGER);
  const downloaded=clamp(
    Number(status.downloaded??status.successful??(legacyAttemptSemantics?rawCompleted-failedCount:rawCompleted)),
    0,
    total||Number.MAX_SAFE_INTEGER
  );
  const ready=Boolean(status.ready)&&failedCount===0&&(!total||downloaded>=total);
  return{...status,failed,failedCount,skipped,skippedCount,total,attempted,downloaded,ready};
}

function formatBytes(bytes){
  const value=Number(bytes||0);
  if(!value)return'';
  if(value<1024*1024)return`${Math.max(1,Math.round(value/1024))} KB`;
  return`${(value/(1024*1024)).toFixed(value>=10*1024*1024?0:1)} MB`;
}

const api={version:VERSION,workerRevision:WORKER_REVISION,normalize,render,last:null};

function render(status){
  const packet=normalize(status);
  const state=$('#offline-package-state');
  const assets=$('#offline-package-assets');
  const button=$('#download-offline-package');
  if(state){
    if(packet.running)state.textContent='downloading';
    else if(packet.ready)state.textContent=packet.skippedCount?`ready offline · ${packet.skippedCount} stale reference${packet.skippedCount===1?'':'s'} skipped`:'ready offline';
    else if(packet.failedCount)state.textContent=`${packet.failedCount} required file${packet.failedCount===1?'':'s'} need retry`;
    else state.textContent=packet.downloaded?'partially downloaded':'not downloaded';
  }
  if(assets){
    const count=packet.total?`${Math.min(packet.downloaded,packet.total)}/${packet.total} files`:'not measured';
    const checked=packet.failedCount&&packet.attempted>packet.downloaded?` · ${Math.min(packet.attempted,packet.total)}/${packet.total} checked`:'';
    const skipped=packet.skippedCount?` · ${packet.skippedCount} stale skipped`:'';
    const size=formatBytes(packet.bytes);
    assets.textContent=`${count}${checked}${skipped}${size?` · ${size}`:''}`;
  }
  if(button){
    if(packet.running)button.textContent=packet.total?`Downloading ${Math.min(packet.attempted,packet.total)}/${packet.total}…`:'Discovering campus files…';
    else if(packet.ready)button.textContent='Refresh offline campus';
    else if(packet.failedCount)button.textContent=`Retry ${packet.failedCount} required file${packet.failedCount===1?'':'s'}`;
    else if(packet.downloaded)button.textContent='Resume offline campus';
    else button.textContent='Download offline campus';
  }
  document.documentElement.dataset.offlineCampusStatusRevision=VERSION;
  api.last=packet;
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

async function ensureCurrentWorker(){
  const controller=navigator.serviceWorker?.controller;
  const version=await askWorker(controller,'GET_VERSION');
  if(version?.revision===WORKER_REVISION)return controller;
  const registration=await navigator.serviceWorker?.getRegistration?.('/').catch(()=>null);
  if(!registration)return controller;
  try{await registration.update()}catch{return controller}
  if(registration.waiting)registration.waiting.postMessage({type:'SKIP_WAITING'});
  const installing=registration.installing;
  installing?.addEventListener('statechange',()=>{
    if(installing.state==='installed')installing.postMessage({type:'SKIP_WAITING'});
  });
  return registration.active||controller;
}

async function askCurrentStatus(){
  const worker=await ensureCurrentWorker();
  const packet=await askWorker(worker||navigator.serviceWorker?.controller,'GET_OFFLINE_PACKAGE_STATUS');
  if(STATUS_TYPES.has(packet?.type))render(packet);
}

globalThis.CommonweaveOfflineCampusStatusV210=api;
navigator.serviceWorker?.addEventListener('message',event=>{
  if(STATUS_TYPES.has(event.data?.type))render(event.data);
});
addEventListener('load',askCurrentStatus,{once:true});
navigator.serviceWorker?.addEventListener('controllerchange',()=>setTimeout(askCurrentStatus,0));

})();
