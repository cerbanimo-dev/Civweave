(()=>{
'use strict';

const VERSION='1.0.6-offline-campus-status-v210';
const STATUS_TYPES=new Set([
  'COMMONWEAVE_OFFLINE_PACKAGE_STATUS',
  'COMMONWEAVE_OFFLINE_PACKAGE_PROGRESS'
]);
const $=selector=>document.querySelector(selector);
const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number.isFinite(value)?value:min));

function normalize(status={}){
  const failed=Array.isArray(status.failed)?status.failed:[];
  const failedCount=Math.max(0,Number(status.failedCount??failed.length)||0);
  const total=Math.max(0,Number(status.total||status.discovered||0)||0);
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
  return{...status,failed,failedCount,total,attempted,downloaded,ready};
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
  if(state){
    if(packet.running)state.textContent='downloading';
    else if(packet.ready)state.textContent='ready offline';
    else if(packet.failedCount)state.textContent=`${packet.failedCount} file${packet.failedCount===1?'':'s'} need retry`;
    else state.textContent=packet.downloaded?'partially downloaded':'not downloaded';
  }
  if(assets){
    const count=packet.total?`${Math.min(packet.downloaded,packet.total)}/${packet.total} files`:'not measured';
    const checked=packet.failedCount&&packet.attempted>packet.downloaded?` · ${Math.min(packet.attempted,packet.total)}/${packet.total} checked`:'';
    const size=formatBytes(packet.bytes);
    assets.textContent=`${count}${checked}${size?` · ${size}`:''}`;
  }
  if(button){
    if(packet.running)button.textContent=packet.total?`Downloading ${Math.min(packet.attempted,packet.total)}/${packet.total}…`:'Discovering campus files…';
    else if(packet.ready)button.textContent='Refresh offline campus';
    else if(packet.failedCount)button.textContent=`Retry ${packet.failedCount} missing file${packet.failedCount===1?'':'s'}`;
    else if(packet.downloaded)button.textContent='Resume offline campus';
    else button.textContent='Download offline campus';
  }
  document.documentElement.dataset.offlineCampusStatusRevision=VERSION;
  globalThis.CommonweaveOfflineCampusStatusV210={version:VERSION,normalize,render,last:packet};
  return packet;
}

function askCurrentStatus(){
  const worker=navigator.serviceWorker?.controller;
  if(!worker)return;
  const channel=new MessageChannel();
  const timer=setTimeout(()=>channel.port1.close(),6000);
  channel.port1.onmessage=event=>{
    clearTimeout(timer);
    if(STATUS_TYPES.has(event.data?.type))render(event.data);
    channel.port1.close();
  };
  try{worker.postMessage({type:'GET_OFFLINE_PACKAGE_STATUS'},[channel.port2])}catch{}
}

navigator.serviceWorker?.addEventListener('message',event=>{
  if(STATUS_TYPES.has(event.data?.type))render(event.data);
});
addEventListener('load',askCurrentStatus,{once:true});
navigator.serviceWorker?.addEventListener('controllerchange',()=>setTimeout(askCurrentStatus,0));

})();
