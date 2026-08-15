(()=>{
'use strict';

const VERSION='1.0.0';
const WORKER_URL='/service-worker-v203.js?v=1.0.162-lightweight-shell-v208&revision=release-coherence-v226';
let latest=null,busy=false,bound=false;
const $=selector=>document.querySelector(selector);
const number=value=>{const n=Number(value);return Number.isFinite(n)&&n>0?n:0};
function render(status=latest){
  if(!status)return;
  latest=status;
  const state=$('#lud-package-state'),meta=$('#lud-package-assets'),fill=$('#lud-progress-fill'),track=$('#lud-progress-track'),percent=$('#lud-progress-percent'),button=$('#download-lud-mode'),open=$('#open-lud-mode');
  if(!state||!meta||!fill||!track||!percent||!button)return;
  const total=number(status.total),downloaded=number(status.downloaded),failed=number(status.failedCount||status.failed?.length),ready=Boolean(status.ready),running=Boolean(status.running);
  let value=ready?100:(total?Math.floor(Math.min(downloaded,total)/total*100):0);if(!ready&&value>=100)value=99;
  fill.style.width=`${value}%`;track.setAttribute('aria-valuenow',String(value));percent.textContent=`${value}%`;
  state.textContent=ready?'ready offline':failed?'download failed':running?'downloading':'not downloaded';
  meta.textContent=total?`${downloaded} / ${total} allowlisted files`:'explicit human-operated allowlist';
  button.disabled=busy||running;
  button.textContent=ready?'Open Lud Mode':'Download Lud Mode';
  if(open)open.hidden=!ready;
}
async function registration(){
  if(!('serviceWorker'in navigator))throw new Error('This browser does not support the Civweave offline worker.');
  const existing=await navigator.serviceWorker.getRegistration('/');
  if(existing)return existing;
  return navigator.serviceWorker.register(WORKER_URL,{scope:'/'});
}
async function activeWorker(){const reg=await registration();await navigator.serviceWorker.ready;return reg.active||reg.waiting||reg.installing||navigator.serviceWorker.controller}
async function send(type){const worker=await activeWorker();if(!worker)throw new Error('Civweave service worker is not active yet.');worker.postMessage({type,revision:VERSION})}
async function refresh(){try{await send('GET_LUD_PACKAGE_STATUS')}catch(error){const node=$('#lud-package-state');if(node)node.textContent=String(error?.message||error).slice(0,180)}}
function enter(){globalThis.CivweaveLudModeV1?.enable?.({source:'lud-download-page'});location.href='/app/lud/campus.html'}
async function click(){
  if(latest?.ready){enter();return}
  busy=true;render(latest||{running:true,total:0,downloaded:0});
  const help=$('#lud-help');if(help)help.textContent='Downloading the human-operated package. No model weights or AI execution assets are in this manifest.';
  try{await send('DOWNLOAD_LUD_PACKAGE')}catch(error){busy=false;if(help)help.textContent=String(error?.message||error).slice(0,300);render({...latest,running:false,failed:[{message:String(error?.message||error)}],failedCount:1})}
}
function onMessage(event){const packet=event.data;if(!packet||!['CIVWEAVE_LUD_PACKAGE_STATUS','CIVWEAVE_LUD_PACKAGE_PROGRESS'].includes(packet.type))return;busy=Boolean(packet.running);render(packet);const help=$('#lud-help');if(help&&packet.ready)help.textContent='Lud Mode is ready offline. Opening it enables the no-AI operating lane and human-authored-only discovery.';if(help&&packet.failedCount)help.textContent=packet.failed?.[0]?.message||'Lud Mode could not finish downloading.'}
function bind(){
  if(bound)return;bound=true;
  $('#download-lud-mode')?.addEventListener('click',click);
  $('#open-lud-mode')?.addEventListener('click',event=>{event.preventDefault();enter()});
  navigator.serviceWorker?.addEventListener?.('message',onMessage);
  render({ready:false,running:false,total:0,downloaded:0});refresh();
}
globalThis.CivweaveLudInstallerV1=Object.freeze({version:VERSION,refresh,enter,status:()=>latest});
if(document.readyState==='loading')addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
