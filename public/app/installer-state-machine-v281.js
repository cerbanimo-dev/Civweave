(()=>{
'use strict';

const REVISION='installer-state-authority-v281';
const SYNC_TAG='civweave-campus-resume-v281';
const STATUS_TYPES=new Set(['CIVWEAVE_OFFLINE_PACKAGE_STATUS','CIVWEAVE_OFFLINE_PACKAGE_PROGRESS']);
let campusStatus=null;
let pausing=false;
let storagePhase='measuring';
let storageText='calculating storage…';
let installObserved=false;
let installAvailable=false;

const $=selector=>document.querySelector(selector);
const numeric=value=>{const n=Number(value);return Number.isFinite(n)&&n>0?n:0};

function standalone(){
  return navigator.standalone===true||['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches);
}

function formatBytes(bytes){
  const value=Number(bytes||0);
  if(!Number.isFinite(value)||value<=0)return'';
  if(value<1024*1024)return`${Math.max(1,Math.round(value/1024))} KB`;
  if(value<1024*1024*1024)return`${(value/(1024*1024)).toFixed(value>=100*1024*1024?0:1)} MB`;
  return`${(value/(1024*1024*1024)).toFixed(value>=10*1024*1024*1024?0:1)} GB`;
}

function ensureStateRow(id,label,beforeSelector){
  if(document.getElementById(id))return document.getElementById(id);
  const list=$('.package-state');
  if(!list)return null;
  const row=document.createElement('div');
  const dt=document.createElement('dt');
  const dd=document.createElement('dd');
  dt.textContent=label;
  dd.id=id;
  dd.textContent='checking';
  row.append(dt,dd);
  const before=beforeSelector?list.querySelector(beforeSelector):null;
  if(before)list.insertBefore(row,before.closest('div'));
  else list.append(row);
  return dd;
}

function normalizeCampus(status={}){
  const failed=Array.isArray(status.failed)?status.failed:[];
  const total=numeric(status.total||status.discovered);
  const downloaded=Math.min(total||Number.MAX_SAFE_INTEGER,numeric(status.downloaded??status.successful??status.completed));
  return{
    ...status,
    failed,
    failedCount:numeric(status.failedCount??failed.length),
    total,
    downloaded,
    running:Boolean(status.running)&&!status.paused,
    paused:Boolean(status.paused),
    interrupted:Boolean(status.interrupted),
    ready:Boolean(status.ready)&&(!total||downloaded>=total)&&!failed.length
  };
}

function campusFromGlobal(){
  const latest=globalThis.CivweaveOfflineCampusStatusV211?.last||globalThis.CivweaveOfflineCampusStatusV210?.last;
  return latest?normalizeCampus(latest):campusStatus;
}

function renderInstallation(){
  const node=ensureStateRow('installation-state','Installation','#package-state');
  if(!node)return;
  const text=standalone()||installObserved?'installed':installAvailable?'ready to install':'browser-managed';
  if(node.textContent!==text)node.textContent=text;
}

async function measureStorage(){
  const node=ensureStateRow('storage-state','Storage',null);
  storagePhase='measuring';
  storageText='calculating storage…';
  if(node&&node.textContent!==storageText)node.textContent=storageText;
  try{
    const estimate=await navigator.storage?.estimate?.();
    const usage=numeric(estimate?.usage);
    const quota=numeric(estimate?.quota);
    if(quota){
      const available=Math.max(0,quota-usage);
      storageText=`${formatBytes(usage)||'0 MB'} used · ${formatBytes(available)||'0 MB'} available`;
      storagePhase='known';
    }else{
      storageText='browser-managed storage';
      storagePhase='unavailable';
    }
  }catch{
    storageText='browser-managed storage';
    storagePhase='unavailable';
  }
  if(node&&node.textContent!==storageText)node.textContent=storageText;
  document.documentElement.dataset.civweaveStorageState=storagePhase;
}

function ensurePauseButton(){
  let button=$('#pause-offline-package');
  if(button)return button;
  const anchor=$('#download-offline-package');
  if(!anchor?.parentNode)return null;
  button=document.createElement('button');
  button.id='pause-offline-package';
  button.type='button';
  button.className='campus-retry';
  button.textContent='Pause download';
  button.hidden=true;
  button.addEventListener('click',event=>{
    event.preventDefault();
    event.stopPropagation();
    void pauseCampus();
  });
  anchor.insertAdjacentElement('afterend',button);
  return button;
}

function ensureControlStatus(){
  let node=$('#offline-campus-control-status');
  if(node)return node;
  const box=$('#campus-install-progress');
  if(!box)return null;
  node=document.createElement('span');
  node.id='offline-campus-control-status';
  node.className='sr-only';
  node.setAttribute('role','status');
  node.setAttribute('aria-live','polite');
  box.append(node);
  return node;
}

function announce(message=''){
  const node=ensureControlStatus();
  if(node&&node.textContent!==message)node.textContent=message;
}

function renderProgress(input=campusFromGlobal()||{}){
  const packet=normalizeCampus(input);
  campusStatus=packet;
  if(!packet.running)pausing=false;
  const box=$('#campus-install-progress');
  const track=$('#offline-campus-progress-track');
  const fill=$('#offline-campus-progress-fill');
  const percentNode=$('#offline-campus-progress-percent');
  const pauseButton=ensurePauseButton();
  const total=packet.total;
  const downloaded=packet.downloaded;
  const percent=packet.ready?100:total?Math.min(99,Math.floor(downloaded/total*100)):0;

  if(fill&&fill.style.width!==`${percent}%`)fill.style.width=`${percent}%`;
  if(percentNode&&percentNode.textContent!==`${percent}%`)percentNode.textContent=`${percent}%`;
  if(track&&track.getAttribute('aria-valuenow')!==String(percent))track.setAttribute('aria-valuenow',String(percent));
  if(box){
    const state=packet.ready?'ready':packet.failedCount?'failed':packet.running?'running':packet.paused?'paused':'idle';
    if(box.dataset.state!==state)box.dataset.state=state;
  }
  if(pauseButton){
    pauseButton.hidden=!packet.running;
    pauseButton.disabled=pausing;
    pauseButton.textContent=pausing?'Pausing…':'Pause download';
  }
  const campusState=packet.ready?'complete':packet.running?'downloading':packet.paused?'paused':packet.interrupted?'interrupted':downloaded?'partial':'absent';
  if(document.documentElement.dataset.civweaveCampusState!==campusState)document.documentElement.dataset.civweaveCampusState=campusState;
  return packet;
}

async function currentWorker(){
  try{
    const registration=await navigator.serviceWorker?.getRegistration?.('/');
    return registration?.active||navigator.serviceWorker?.controller||registration?.waiting||null;
  }catch{
    return navigator.serviceWorker?.controller||null;
  }
}

async function askWorker(type,timeoutMs=6000){
  const worker=await currentWorker();
  if(!worker)return null;
  return new Promise(resolve=>{
    const channel=new MessageChannel();
    const timer=setTimeout(()=>{try{channel.port1.close()}catch{};resolve(null)},timeoutMs);
    channel.port1.onmessage=event=>{
      clearTimeout(timer);
      try{channel.port1.close()}catch{}
      resolve(event.data||null);
    };
    try{worker.postMessage({type},[channel.port2])}catch{clearTimeout(timer);resolve(null)}
  });
}

async function registerResumeSync(){
  try{
    const registration=await navigator.serviceWorker?.ready;
    if(registration?.sync?.register)await registration.sync.register(SYNC_TAG);
  }catch{}
}

async function pauseCampus(){
  if(pausing)return;
  const current=campusFromGlobal()||campusStatus||{};
  if(!current.running)return;
  pausing=true;
  renderProgress(current);
  announce('Pausing offline campus download…');
  const packet=await askWorker('PAUSE_OFFLINE_PACKAGE',8000);
  if(STATUS_TYPES.has(packet?.type))renderProgress(packet);
  else await refreshCampusStatus();
  pausing=false;
  renderProgress(campusFromGlobal()||campusStatus||{});
  announce('Offline campus download paused.');
}

async function refreshCampusStatus(){
  const packet=await askWorker('GET_OFFLINE_PACKAGE_STATUS');
  if(STATUS_TYPES.has(packet?.type))return renderProgress(packet);
  return renderProgress();
}

function reconcile(){
  renderInstallation();
  renderProgress();
  document.documentElement.dataset.civweaveInstallerStateRevision=REVISION;
}

function bind(){
  ensureStateRow('installation-state','Installation','#package-state');
  ensureStateRow('storage-state','Storage',null);
  ensurePauseButton();
  ensureControlStatus();

  addEventListener('beforeinstallprompt',()=>{installObserved=false;installAvailable=true;renderInstallation()});
  addEventListener('appinstalled',()=>{installObserved=true;installAvailable=false;renderInstallation()});
  addEventListener('civweave:offline-campus-status',event=>{if(event.detail)renderProgress(event.detail)});
  navigator.serviceWorker?.addEventListener?.('message',event=>{if(STATUS_TYPES.has(event.data?.type))renderProgress(event.data)});
  navigator.serviceWorker?.addEventListener?.('controllerchange',()=>setTimeout(()=>{void refreshCampusStatus()},120));
  addEventListener('online',()=>{if(!(campusFromGlobal()||{}).paused)void registerResumeSync()});

  void measureStorage();
  void refreshCampusStatus();
  void registerResumeSync();
  reconcile();
}

const api=Object.freeze({
  revision:REVISION,
  syncTag:SYNC_TAG,
  refresh:()=>{reconcile();return refreshCampusStatus()},
  pause:pauseCampus,
  measureStorage,
  get campus(){return campusStatus},
  get storage(){return{phase:storagePhase,text:storageText}}
});

globalThis.CivweaveInstallerStateV281=api;
// Compatibility sentinel: prevents any older lazy loader from starting the retired v280 writer.
if(!globalThis.CivweaveInstallerStateV280)globalThis.CivweaveInstallerStateV280=api;

if(document.readyState==='loading')addEventListener('DOMContentLoaded',bind,{once:true});
else bind();
})();
