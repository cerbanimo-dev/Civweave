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
  const box=$('#luddite-install-progress'),state=$('#luddite-package-state'),meta=$('#luddite-package-assets'),fill=$('#luddite-progress-fill'),track=$('#luddite-progress-track'),percent=$('#luddite-progress-percent'),button=$('#download-luddite-mode'),open=$('#open-luddite-mode');
  if(!box||!state||!meta||!fill||!track||!percent||!button)return;
  const total=number(status.total),downloaded=number(status.downloaded),failed=number(status.failedCount||status.failed?.length),ready=Boolean(status.ready),running=Boolean(status.running);
  let value=ready?100:(total?Math.floor(Math.min(downloaded,total)/total*100):0);if(!ready&&value>=100)value=99;
  fill.style.width=`${value}%`;track.setAttribute('aria-valuenow',String(value));percent.textContent=`${value}%`;
  box.dataset.state=ready?'ready':failed?'failed':running?'running':'idle';
  state.textContent=ready?'ready · no AI package':failed?'download failed':running?'downloading human-operated package':'not downloaded';
  meta.textContent=total?`${downloaded} / ${total} allowlisted files`:'explicit allowlist · no model assets';
  button.disabled=busy||running;
  button.textContent=ready?'Open Luddite Mode':'Download Luddite Mode';
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
async function refresh(){try{await send('GET_LUDDITE_PACKAGE_STATUS')}catch(error){const node=$('#luddite-package-state');if(node)node.textContent=String(error?.message||error).slice(0,180)}}
function enter(){globalThis.CivweaveLudditeModeV1?.enable?.({source:'installer'});location.href='/app/luddite-campus-v1.html'}
async function click(){
  if(latest?.ready){enter();return}
  busy=true;render(latest||{running:true,total:0,downloaded:0});
  const help=$('#luddite-help');if(help)help.textContent='Downloading only the human-operated Luddite Mode files. No model or AI runtime assets are in this manifest.';
  try{await send('DOWNLOAD_LUDDITE_PACKAGE')}catch(error){busy=false;if(help)help.textContent=String(error?.message||error).slice(0,300);render({...latest,running:false,failed:[{message:String(error?.message||error)}],failedCount:1})}
}
function onMessage(event){const packet=event.data;if(!packet||!['CIVWEAVE_LUDDITE_PACKAGE_STATUS','CIVWEAVE_LUDDITE_PACKAGE_PROGRESS'].includes(packet.type))return;busy=Boolean(packet.running);render(packet);const help=$('#luddite-help');if(help&&packet.ready)help.textContent='Luddite Mode is ready. Opening it enables the no-AI operating lane and its human-authored-only feed.';if(help&&packet.failedCount)help.textContent=packet.failed?.[0]?.message||'Luddite Mode could not finish downloading.'}
function bind(){
  if(bound)return;bound=true;
  $('#download-luddite-mode')?.addEventListener('click',click);
  $('#open-luddite-mode')?.addEventListener('click',event=>{event.preventDefault();enter()});
  navigator.serviceWorker?.addEventListener?.('message',onMessage);
  render({ready:false,running:false,total:0,downloaded:0});refresh();
}
globalThis.CivweaveLudditeInstallerV1=Object.freeze({version:VERSION,refresh,enter,status:()=>latest});
if(document.readyState==='loading')addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
