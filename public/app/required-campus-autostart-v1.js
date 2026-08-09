(()=>{
'use strict';

const STATUS_FALLBACK_MS=8000;
const startedAt=Date.now();
let autoStarted=false;
let timer=0;

const $=selector=>document.querySelector(selector);

function replaceText(node,replacements){
  if(!node)return;
  const current=node.textContent||'';
  let next=current;
  for(const [pattern,replacement] of replacements)next=next.replace(pattern,replacement);
  if(next!==current)node.textContent=next;
}
function installAssetLockboardLink(){
  if(document.querySelector('[data-cw-asset-lockboard-link]'))return;
  const actions=[...document.querySelectorAll('.status-card .card-actions')].at(-1);
  if(!actions)return;
  const link=document.createElement('a');link.href=['/app','asset-lockboard-v239.html'].join('/');link.textContent='Visual asset lockboard';link.dataset.cwAssetLockboardLink='v239';actions.append(link);
}
function applyRequiredCampusLanguage(){
  replaceText($('#install-help'),[
    [/the optional offline campus can be downloaded or refreshed separately\./gi,'The required campus downloads automatically and can be refreshed here.'],
    [/download the optional offline campus whenever you want the full local copy\./gi,'The required campus download starts automatically and resumes here if interrupted.'],
    [/the optional offline campus can continue downloading independently\./gi,'The required campus continues downloading independently and resumes if interrupted.'],
    [/the optional offline campus is separate\./gi,'The required campus downloads separately and resumes automatically.'],
    [/download the offline campus whenever useful\./gi,'The required campus download starts automatically once the shell is ready.'],
    [/downloading the optional campus pack\./gi,'Downloading the required campus.'],
    [/optional campus files/gi,'campus files'],[/optional offline campus/gi,'required offline campus'],[/optional campus pack/gi,'required campus download']
  ]);
  const mode=$('#local-mode');if(mode&&/optional resumable campus/i.test(mode.textContent||''))mode.textContent='small shell · required resumable campus · separate optional model and school storage';
}
function latestStatus(){return globalThis.CivweaveOfflineCampusStatusV210?.last||null}
function campusIsReady(){const status=latestStatus();if(status?.ready)return true;return /^ready offline\b/i.test($('#offline-package-state')?.textContent||'')}
function campusIsRunning(){const status=latestStatus();if(status?.running)return true;return /^downloading\b/i.test($('#offline-package-state')?.textContent||'')}
function statusHasSettled(){return Boolean(latestStatus())||Date.now()-startedAt>=STATUS_FALLBACK_MS}
function publishRuntimeGate(){
  const ready=campusIsReady(),button=$('#install-app');
  if(button){button.dataset.campusLaunchReady=ready?'true':'false';button.classList.toggle('cw-campus-waiting',!ready&&Boolean(globalThis.CivweavePWAInstallV246?.standalone?.()))}
  document.documentElement.dataset.civweaveDownloadedRuntime=ready?'ready':'blocked';
  globalThis.CivweavePWAInstallV246?.refresh?.();
  try{dispatchEvent(new CustomEvent('civweave:downloaded-runtime-gate',{detail:{ready,revision:'required-campus-autostart-v266'}}))}catch{}
  return ready;
}
function tryAutoStart(){
  applyRequiredCampusLanguage();publishRuntimeGate();
  if(autoStarted||campusIsReady()||campusIsRunning()||!statusHasSettled())return;
  const button=$('#download-offline-package');if(!button||button.disabled)return;
  autoStarted=true;button.click();
}
function stopTimer(){if(timer){clearInterval(timer);timer=0}}
function onStatus(){tryAutoStart();publishRuntimeGate();if(autoStarted||campusIsReady())stopTimer()}
function startWatching(){
  installAssetLockboardLink();
  addEventListener('civweave:offline-campus-status',onStatus);
  navigator.serviceWorker?.addEventListener?.('controllerchange',onStatus);
  addEventListener('appinstalled',onStatus);
  timer=setInterval(onStatus,500);setTimeout(stopTimer,60000);onStatus();
}
function destroy(){stopTimer();removeEventListener('civweave:offline-campus-status',onStatus);navigator.serviceWorker?.removeEventListener?.('controllerchange',onStatus);removeEventListener('appinstalled',onStatus)}

addEventListener('pagehide',destroy,{once:true});
if(document.readyState==='loading')addEventListener('DOMContentLoaded',startWatching,{once:true});else startWatching();
})();
