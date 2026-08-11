(()=>{
'use strict';

const VERSION='1.0.0';
const REVISION='campus-background-download-v304-explicit-opt-in';
const OPT_IN_KEY='civweave.offline-campus.explicit-opt-in.v304';
const STATUS_TYPES=new Set(['CIVWEAVE_OFFLINE_PACKAGE_STATUS','CIVWEAVE_OFFLINE_PACKAGE_PROGRESS']);
const ROOT_ID='cw-campus-background-v241';
const STYLE_ID='cw-campus-background-style-v241';
const COMPLETE_HIDE_MS=1400;
let activeWorker=null;
let downloadActive=false;
let lastStatus=null;
let retryTimer=0;

function optedIn(){
  try{return localStorage.getItem(OPT_IN_KEY)==='1'}catch{return false}
}

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
#${ROOT_ID}{position:fixed;z-index:2147483598;left:0;right:0;bottom:0;height:4px;pointer-events:none;overflow:hidden;background:#ffffff18;opacity:1;transition:opacity .24s ease,height .2s ease,background .2s ease}
#${ROOT_ID}[hidden]{display:none!important}
#${ROOT_ID} .cw-campus-fill{height:100%;width:100%;transform:scaleX(0);transform-origin:left center;background:linear-gradient(90deg,#7adfff,#b88cff,#ff72bd,#ffd16a,#7ff0c9);transition:transform .2s ease-out}
#${ROOT_ID}[data-state="retry"]{height:5px;background:#ffbd4a33}
#${ROOT_ID}[data-state="retry"] .cw-campus-fill{background:linear-gradient(90deg,#ff9d42,#ffd36e)}
#${ROOT_ID}[data-state="offline"],#${ROOT_ID}[data-state="paused"]{background:#9ba4bb26}
#${ROOT_ID}[data-state="offline"] .cw-campus-fill,#${ROOT_ID}[data-state="paused"] .cw-campus-fill{background:linear-gradient(90deg,#7f8aa6,#c7cbd5)}
#${ROOT_ID}.is-complete{opacity:0}
@media(prefers-reduced-motion:reduce){#${ROOT_ID},#${ROOT_ID} .cw-campus-fill{transition:none}}
`;
  document.head.append(style);
}

function ensureRoot(){
  if(!optedIn())return null;
  installStyle();
  let root=document.getElementById(ROOT_ID);
  if(root)return root;
  root=document.createElement('div');
  root.id=ROOT_ID;
  root.hidden=true;
  root.setAttribute('role','progressbar');
  root.setAttribute('aria-label','Offline campus download');
  root.innerHTML='<div class="cw-campus-fill"></div>';
  document.body?.append(root);
  return root;
}

function normalize(status={}){
  const failed=Array.isArray(status.failed)?status.failed:[];
  const failedCount=Math.max(0,Number(status.failedCount??failed.length)||0);
  const total=Math.max(0,Number(status.total||0)||0);
  const attempted=Math.max(0,Number(status.attempted??status.completed??0)||0);
  const downloaded=Math.max(0,Math.min(total||Number.MAX_SAFE_INTEGER,Number(status.downloaded??status.successful??status.completed??0)||0));
  const paused=Boolean(status.paused);
  const running=Boolean(status.running)&&!paused;
  const ready=Boolean(status.ready)&&failedCount===0&&(!total||downloaded>=total);
  return{...status,failed,failedCount,total,attempted,downloaded,running,paused,ready};
}

function render(status){
  const packet=normalize(status);
  lastStatus=packet;
  if(!optedIn())return packet;
  const root=ensureRoot();
  if(!root)return packet;
  const fill=root.querySelector('.cw-campus-fill');
  const total=packet.total||0;
  const progress=packet.ready?1:total?Math.max(0,Math.min(1,packet.downloaded/total)):0.02;
  fill?.style?.setProperty('transform',`scaleX(${progress})`);
  root.hidden=false;
  root.classList.remove('is-complete');
  root.setAttribute('aria-valuemin','0');
  root.setAttribute('aria-valuemax',String(total||100));
  root.setAttribute('aria-valuenow',String(total?packet.downloaded:Math.round(progress*100)));
  if(packet.ready){
    root.dataset.state='ready';
    root.title='Offline campus ready';
    setTimeout(()=>{if(lastStatus?.ready){root.classList.add('is-complete');setTimeout(()=>{if(lastStatus?.ready)root.hidden=true},260)}},COMPLETE_HIDE_MS);
  }else if(packet.paused){
    root.dataset.state='paused';
    root.title=`Campus ${packet.downloaded}/${packet.total||'?'} · paused`;
  }else if(packet.failedCount){
    root.dataset.state='retry';
    root.title=`Campus ${packet.downloaded}/${packet.total||'?'} · ${packet.failedCount} file${packet.failedCount===1?'':'s'} waiting for retry`;
  }else if(navigator.onLine===false){
    root.dataset.state='offline';
    root.title=`Campus ${packet.downloaded}/${packet.total||'?'} · waiting for connection`;
  }else{
    root.dataset.state='downloading';
    root.title=total?`Campus ${packet.downloaded}/${total} · ${Math.round(progress*100)}%`:'Discovering campus files';
  }
  return packet;
}

function askWorker(worker,type,timeoutMs=6000){
  return new Promise(resolve=>{
    if(!worker)return resolve(null);
    const channel=new MessageChannel();
    const timer=setTimeout(()=>{try{channel.port1.close()}catch{};resolve(null)},timeoutMs);
    channel.port1.onmessage=event=>{clearTimeout(timer);try{channel.port1.close()}catch{};resolve(event.data||null)};
    try{worker.postMessage({type},[channel.port2])}catch{clearTimeout(timer);resolve(null)}
  });
}

async function currentWorker(){
  const serviceWorker=navigator.serviceWorker;
  const registration=await serviceWorker?.getRegistration?.('/').catch(()=>null);
  return registration?.active||serviceWorker?.controller||registration?.waiting||null;
}

function scheduleRetry(delay=1600){
  if(retryTimer)clearTimeout(retryTimer);
  retryTimer=setTimeout(()=>{
    retryTimer=0;
    if(optedIn()&&navigator.onLine!==false&&!lastStatus?.paused)resume('scheduled_retry');
  },delay);
}

async function resume(reason='page_opened'){
  if(!optedIn()||downloadActive||navigator.onLine===false||!('serviceWorker'in navigator))return false;
  activeWorker=activeWorker||await currentWorker();
  if(!activeWorker)return false;
  const status=await askWorker(activeWorker,'GET_OFFLINE_PACKAGE_STATUS');
  if(STATUS_TYPES.has(status?.type))render(status);
  if(status?.ready||status?.paused)return true;
  downloadActive=true;
  const channel=new MessageChannel();
  channel.port1.onmessage=event=>{
    const packet=event.data||{};
    if(STATUS_TYPES.has(packet.type))render(packet);
    if(packet.type==='CIVWEAVE_OFFLINE_PACKAGE_STATUS'&&!packet.running){
      downloadActive=false;
      try{channel.port1.close()}catch{}
      if(optedIn()&&!packet.ready&&!packet.paused&&navigator.onLine!==false)scheduleRetry(2200);
    }
  };
  try{
    activeWorker.postMessage({type:'DOWNLOAD_OFFLINE_PACKAGE',background:true,reason,revision:REVISION},[channel.port2]);
    return true;
  }catch{
    downloadActive=false;
    try{channel.port1.close()}catch{}
    return false;
  }
}

function start(){
  if(!('serviceWorker'in navigator))return false;
  navigator.serviceWorker.addEventListener('message',event=>{if(optedIn()&&STATUS_TYPES.has(event.data?.type))render(event.data)});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{activeWorker=null;if(optedIn())setTimeout(()=>resume('controller_changed'),400)});
  addEventListener('online',()=>{if(optedIn())resume('connection_restored')});
  addEventListener('offline',()=>{if(optedIn()&&lastStatus&&!lastStatus.ready)render(lastStatus)});
  if(optedIn()){
    const begin=()=>setTimeout(()=>resume('canonical_page_opened'),1500);
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',begin,{once:true});
    else begin();
  }
  return true;
}

const api=Object.freeze({version:VERSION,revision:REVISION,optInKey:OPT_IN_KEY,start,resume,render,normalize,get last(){return lastStatus},get explicitOptIn(){return optedIn()}});
globalThis.CivweaveCampusBackgroundDownloadV241=api;
start();
})();