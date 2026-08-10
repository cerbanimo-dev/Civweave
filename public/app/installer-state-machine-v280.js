(()=>{
'use strict';

const REVISION='installer-state-machines-v280';
const SYNC_TAG='civweave-campus-resume-v280';
const STATUS_TYPES=new Set(['CIVWEAVE_OFFLINE_PACKAGE_STATUS','CIVWEAVE_OFFLINE_PACKAGE_PROGRESS']);
let campusStatus=null;
let installObserved=false;
let installAvailable=false;
let pausing=false;
let shellPhase='checking';
let storagePhase='measuring';
let storageText='calculating storage…';
let refreshTimer=0;

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
  const latest=globalThis.CivweaveOfflineCampusStatusV210?.last;
  return latest?normalizeCampus(latest):campusStatus;
}

function renderInstallation(){
  const node=ensureStateRow('installation-state','Installation','#package-state');
  if(!node)return;
  const text=standalone()||installObserved?'installed':installAvailable||/^install civweave/i.test($('#install-app')?.textContent||'')?'ready to install':'browser-managed';
  if(node.textContent!==text)node.textContent=text;
}

function detectShellPhase(){
  const node=$('#package-state');
  const raw=String(node?.textContent||'').trim().toLowerCase();
  if(/ready/.test(raw))return'ready';
  if(/failed|repair|error/.test(raw))return'needs-repair';
  return'checking';
}

function renderShell(){
  shellPhase=detectShellPhase();
  const state=$('#package-state');
  if(state){
    const text=shellPhase==='ready'?'ready':shellPhase==='needs-repair'?'needs repair':'checking';
    if(state.textContent!==text)state.textContent=text;
  }
  const mode=$('#local-mode');
  const lanes='small shell · required resumable campus · separate optional model and school storage';
  if(mode&&mode.textContent!==lanes)mode.textContent=lanes;
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

function shellReady(){return detectShellPhase()==='ready'}

function renderCampus(input=campusFromGlobal()||{}){
  const packet=normalizeCampus(input);
  campusStatus=packet;
  if(!packet.running&&!packet.pauseRequested)pausing=false;
  const state=$('#offline-package-state');
  const assets=$('#offline-package-assets');
  const button=$('#download-offline-package');
  const box=$('#campus-install-progress');
  const track=$('#offline-campus-progress-track');
  const fill=$('#offline-campus-progress-fill');
  const percentNode=$('#offline-campus-progress-percent');
  const total=packet.total;
  const downloaded=packet.downloaded;
  const percent=packet.ready?100:total?Math.min(99,Math.floor(downloaded/total*100)):0;

  if(state){
    let text='waiting to download';
    if(packet.running)text=pausing?'pausing':'downloading';
    else if(packet.ready)text='ready offline';
    else if(packet.paused)text='paused';
    else if(packet.interrupted)text='ready to resume';
    else if(packet.failedCount)text=`${packet.failedCount} file${packet.failedCount===1?'':'s'} need retry`;
    else if(downloaded)text='ready to resume';
    else if(!total)text='calculating campus…';
    if(state.textContent!==text)state.textContent=text;
  }

  if(assets){
    const count=total?`${downloaded}/${total} files`:'calculating campus size…';
    const size=formatBytes(packet.bytes);
    const text=size?`${count} · ${size}`:count;
    if(assets.textContent!==text)assets.textContent=text;
  }

  if(fill&&fill.style.width!==`${percent}%`)fill.style.width=`${percent}%`;
  if(percentNode&&percentNode.textContent!==`${percent}%`)percentNode.textContent=`${percent}%`;
  if(track&&track.getAttribute('aria-valuenow')!==String(percent))track.setAttribute('aria-valuenow',String(percent));
  const boxState=packet.ready?'ready':packet.paused?'paused':packet.failedCount?'failed':packet.running?'running':'preparing';
  if(box&&box.dataset.state!==boxState)box.dataset.state=boxState;

  if(button){
    const shouldDisable=!shellReady()||pausing;
    let text='Download offline campus';
    if(pausing)text='Pausing…';
    else if(packet.running)text='Pause download';
    else if(packet.ready)text='Refresh offline campus';
    else if(packet.paused||packet.interrupted||packet.failedCount||downloaded)text='Resume download';
    if(button.hidden)button.hidden=false;
    if(button.disabled!==shouldDisable)button.disabled=shouldDisable;
    if(button.textContent!==text)button.textContent=text;
  }

  const campusState=packet.ready?'complete':packet.running?'downloading':packet.paused?'paused':packet.interrupted?'interrupted':downloaded?'partial':'absent';
  if(document.documentElement.dataset.civweaveCampusState!==campusState)document.documentElement.dataset.civweaveCampusState=campusState;
  renderHelp();
  return packet;
}

function renderInstallButton(){
  const button=$('#install-app');
  if(!button)return;
  if(standalone()||installObserved){
    const text=shellPhase==='needs-repair'?'Repair shell':'Open Civweave';
    if(button.textContent!==text)button.textContent=text;
  }
}

function renderHelp(){
  const node=$('#install-help');
  if(!node)return;
  const campus=campusStatus||{};
  let text='The small Civweave shell is preparing. The campus download is a separate resumable storage lane.';
  if(shellPhase==='needs-repair'){
    text=(standalone()||installObserved)
      ?'Civweave is installed, but its small app shell needs repair. Campus, model, and school storage will be preserved.'
      :'The small app shell needs repair before installation. Existing campus, model, and school storage will be preserved.';
  }else if(shellPhase==='ready'&&(standalone()||installObserved)){
    if(campus.running)text='Civweave is installed. The campus is downloading in the background; you can open Civweave now.';
    else if(campus.paused)text='Civweave is installed. Campus download paused; saved files are preserved and can resume from this device.';
    else if(campus.ready)text='Civweave is installed and the offline campus is ready.';
    else text='Civweave is installed. The campus can resume per file without blocking launch.';
  }else if(shellPhase==='ready'){
    if(campus.running)text='The app shell is ready. The campus is already downloading independently, so installation does not need to wait.';
    else text='The app shell is ready. Install Civweave now; the campus uses a separate resumable download lane.';
  }
  if(node.textContent!==text)node.textContent=text;
}

function currentWorker(){
  return navigator.serviceWorker?.getRegistration?.('/').then(reg=>reg?.active||navigator.serviceWorker?.controller||reg?.waiting||null).catch(()=>navigator.serviceWorker?.controller||null);
}

async function askWorker(type,timeoutMs=6000){
  const worker=await currentWorker();
  if(!worker)return null;
  return new Promise(resolve=>{
    const channel=new MessageChannel();
    const timer=setTimeout(()=>{try{channel.port1.close()}catch{};resolve(null)},timeoutMs);
    channel.port1.onmessage=event=>{clearTimeout(timer);try{channel.port1.close()}catch{};resolve(event.data||null)};
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
  pausing=true;
  renderCampus(campusStatus||{});
  const packet=await askWorker('PAUSE_OFFLINE_PACKAGE',8000);
  if(STATUS_TYPES.has(packet?.type))renderCampus(packet);
  setTimeout(()=>refreshCampusStatus(),220);
  setTimeout(()=>{if(pausing){pausing=false;refreshCampusStatus()}},12000);
}

async function refreshCampusStatus(){
  const packet=await askWorker('GET_OFFLINE_PACKAGE_STATUS');
  if(STATUS_TYPES.has(packet?.type))renderCampus(packet);
  else renderCampus();
}

function onCampusButton(event){
  const button=event.currentTarget;
  const packet=campusFromGlobal()||campusStatus||{};
  if(packet.running||pausing){
    event.preventDefault();
    event.stopImmediatePropagation();
    pauseCampus();
    return;
  }
  if(packet.paused&&!event.isTrusted){
    event.preventDefault();
    event.stopImmediatePropagation();
    renderCampus(packet);
    return;
  }
  pausing=false;
  registerResumeSync();
  if(button&&button.disabled)button.disabled=false;
}

function reconcile(){
  renderInstallation();
  renderShell();
  renderInstallButton();
  renderCampus();
  document.documentElement.dataset.civweaveInstallerStateRevision=REVISION;
}

function bind(){
  ensureStateRow('installation-state','Installation','#package-state');
  ensureStateRow('storage-state','Storage',null);
  const campusButton=$('#download-offline-package');
  campusButton?.addEventListener('click',onCampusButton,true);

  addEventListener('beforeinstallprompt',()=>{installObserved=false;installAvailable=true;setTimeout(reconcile,0)});
  addEventListener('appinstalled',()=>{installObserved=true;installAvailable=false;setTimeout(reconcile,0)});
  addEventListener('civweave:offline-campus-status',event=>{
    if(event.detail)renderCampus(event.detail);
    else renderCampus();
  });
  navigator.serviceWorker?.addEventListener?.('message',event=>{
    if(STATUS_TYPES.has(event.data?.type))renderCampus(event.data);
  });
  navigator.serviceWorker?.addEventListener?.('controllerchange',()=>setTimeout(()=>{reconcile();refreshCampusStatus()},120));
  addEventListener('online',()=>{if(!(campusFromGlobal()||{}).paused)registerResumeSync()});

  const packageState=$('#package-state');
  if(packageState&&'MutationObserver'in globalThis){
    new MutationObserver(()=>queueMicrotask(()=>{renderShell();renderInstallButton();renderHelp()})).observe(packageState,{childList:true,characterData:true,subtree:true});
  }
  if('MutationObserver'in globalThis){
    let campusQueued=false;
    const queueCampus=()=>{
      if(campusQueued)return;
      campusQueued=true;
      queueMicrotask(()=>{campusQueued=false;renderCampus()});
    };
    const observer=new MutationObserver(queueCampus);
    for(const node of [$('#offline-package-state'),$('#offline-package-assets'),$('#download-offline-package')]){
      if(node)observer.observe(node,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['disabled','hidden']});
    }
  }

  measureStorage();
  refreshCampusStatus();
  registerResumeSync();
  reconcile();
  refreshTimer=setInterval(reconcile,650);
  addEventListener('pagehide',()=>{if(refreshTimer)clearInterval(refreshTimer)},{once:true});
}

globalThis.CivweaveInstallerStateV280=Object.freeze({
  revision:REVISION,
  syncTag:SYNC_TAG,
  refresh:()=>{reconcile();return refreshCampusStatus()},
  pause:pauseCampus,
  measureStorage,
  get campus(){return campusStatus},
  get shell(){return shellPhase},
  get storage(){return{phase:storagePhase,text:storageText}}
});

if(document.readyState==='loading')addEventListener('DOMContentLoaded',bind,{once:true});
else bind();
})();
