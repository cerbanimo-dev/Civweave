(()=>{
'use strict';

const VERSION='1.0.4';
const WORKER_URL='/service-worker-lud-package-v1.js?v=1.0.4';
const WORKER_SCOPE='/app/lud/';
const ENTRY_ROUTE='/app/lud/campus';
const ACTIVATION_TIMEOUT_MS=15000;
const COMMAND_TIMEOUT_MS=12000;
const DOWNLOAD_IDLE_TIMEOUT_MS=30000;
let latest=null,busy=false,bound=false,registrationPromise=null;
const $=selector=>document.querySelector(selector);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const number=value=>{const n=Number(value);return Number.isFinite(n)&&n>0?n:0};
function render(status=latest){
  if(!status)return;
  latest=status;
  const state=$('#lud-package-state'),meta=$('#lud-package-assets'),fill=$('#lud-progress-fill'),track=$('#lud-progress-track'),percent=$('#lud-progress-percent'),button=$('#download-lud-mode'),open=$('#open-lud-mode');
  if(!state||!meta||!fill||!track||!percent||!button)return;
  const total=number(status.total),downloaded=number(status.downloaded),failed=number(status.failedCount||status.failed?.length),ready=Boolean(status.ready),running=Boolean(status.running);
  let value=ready?100:(total?Math.floor(Math.min(downloaded,total)/total*100):0);if(!ready&&value>=100)value=99;
  fill.style.width=`${value}%`;track.setAttribute('aria-valuenow',String(value));percent.textContent=`${value}%`;
  state.textContent=ready?'ready offline':failed?'download failed':running||busy?'downloading':'not downloaded';
  meta.textContent=total?`${downloaded} / ${total} allowlisted files`:'explicit human-operated allowlist';
  button.disabled=busy||running;
  button.textContent=ready?'Open Lud Mode':'Download Lud Mode';
  if(open){open.hidden=!ready;open.href=status.entryRoute||ENTRY_ROUTE}
}
async function registration(){
  if(!('serviceWorker'in navigator))throw new Error('This browser does not support the Lud Mode offline worker.');
  if(!registrationPromise)registrationPromise=navigator.serviceWorker.register(WORKER_URL,{scope:WORKER_SCOPE,updateViaCache:'none'}).then(async reg=>{try{await reg.update()}catch{}return reg});
  return registrationPromise;
}
async function activeWorker(){
  const reg=await registration(),started=Date.now();
  while(Date.now()-started<ACTIVATION_TIMEOUT_MS){
    if(reg.waiting){try{reg.waiting.postMessage({type:'SKIP_WAITING'})}catch{}await pause(100);continue}
    if(reg.installing){if(reg.installing.state==='installed')try{reg.installing.postMessage({type:'SKIP_WAITING'})}catch{}await pause(100);continue}
    if(reg.active?.state==='activated')return reg.active;
    await pause(100);
  }
  throw new Error('Lud Mode worker activation timed out. Reload this page and try again.');
}
async function request(type,{onPacket=null,timeoutMs=COMMAND_TIMEOUT_MS}={}){
  const worker=await activeWorker();
  return new Promise((resolve,reject)=>{
    const channel=new MessageChannel();
    let timer=null,settled=false;
    const finish=(ok,value)=>{if(settled)return;settled=true;clearTimeout(timer);try{channel.port1.close()}catch{};ok?resolve(value):reject(value)};
    const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>finish(false,new Error(type==='DOWNLOAD_LUD_PACKAGE'?'The Lud Mode download stopped responding. Tap Download Lud Mode to retry.':'The Lud Mode package worker did not respond.')),timeoutMs)};
    arm();
    channel.port1.onmessage=event=>{
      arm();
      const packet=event.data||{};
      if(!['CIVWEAVE_LUD_PACKAGE_STATUS','CIVWEAVE_LUD_PACKAGE_PROGRESS'].includes(packet.type))return;
      onPacket?.(packet);
      if(type==='GET_LUD_PACKAGE_STATUS'&&packet.type==='CIVWEAVE_LUD_PACKAGE_STATUS')finish(true,packet);
      else if(type==='DOWNLOAD_LUD_PACKAGE'&&packet.type==='CIVWEAVE_LUD_PACKAGE_STATUS'&&!packet.running)finish(true,packet);
    };
    try{worker.postMessage({type,revision:VERSION},[channel.port2])}catch(error){finish(false,error)}
  });
}
async function refresh(){
  const help=$('#lud-help');
  try{const status=await request('GET_LUD_PACKAGE_STATUS');render(status)}catch(error){if(help)help.textContent=String(error?.message||error).slice(0,300);render({ready:false,running:false,total:0,downloaded:0,failed:[{message:String(error?.message||error)}],failedCount:1})}
}
function enter(){globalThis.CivweaveLudModeV1?.enable?.({source:'lud-download-page'});location.assign(latest?.entryRoute||ENTRY_ROUTE)}
async function click(){
  if(latest?.ready){enter();return}
  if(busy)return;
  busy=true;render({...latest,ready:false,running:true});
  const help=$('#lud-help');if(help)help.textContent='Downloading the human-operated package. No model weights or AI execution assets are in this manifest.';
  try{
    const status=await request('DOWNLOAD_LUD_PACKAGE',{timeoutMs:DOWNLOAD_IDLE_TIMEOUT_MS,onPacket:packet=>render(packet)});
    busy=false;render(status);
    if(help)help.textContent=status.ready?'Lud Mode is ready offline. Opening it enables the no-AI operating lane and human-authored-only discovery.':status.failed?.[0]?.message||'Lud Mode could not finish downloading.';
  }catch(error){
    busy=false;const message=String(error?.message||error);if(help)help.textContent=message.slice(0,300);render({...latest,ready:false,running:false,failed:[{message}],failedCount:1});
  }
}
function bind(){
  if(bound)return;bound=true;
  $('#download-lud-mode')?.addEventListener('click',click);
  $('#open-lud-mode')?.addEventListener('click',event=>{event.preventDefault();enter()});
  render({ready:false,running:false,total:0,downloaded:0,entryRoute:ENTRY_ROUTE});
  refresh();
}
globalThis.CivweaveLudInstallerV1=Object.freeze({version:VERSION,refresh,enter,status:()=>latest});
if(document.readyState==='loading')addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
