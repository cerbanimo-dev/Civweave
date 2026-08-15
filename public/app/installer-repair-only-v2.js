(()=>{
'use strict';

const REVISION='installer-repair-only-v2-cache-distinct-lazy-hub-tools';
const CANONICAL_NEXT_PATHS=new Set([
  '/app/working-campus-v156.html',
  '/app/cabinets/living-school/index.html',
  '/app/realm-console-v140.html',
  '/app/fellowfare-cabinet-v144.html',
  '/app/anarchadia-console-v139.html',
  '/app/installed-entry-v146.html',
  '/app/installed-entry-v146'
]);
const stateNode=document.getElementById('package-state');
const assetsNode=document.getElementById('package-assets');
const installButton=document.getElementById('install-app');
const updateButton=document.getElementById('check-update');
const helpNode=document.getElementById('install-help');
let repairing=false;
let hubToolsStarted=false;

function installedDisplay(){
  return navigator.standalone===true||['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches);
}
function releaseVersion(){
  const visible=document.querySelector('.version')?.textContent||'';
  return visible.match(/\d+\.\d+\.\d+/)?.[0]||'1.0.144';
}
function failed(){
  return /^(?:failed|needs? repair|repair required|error)\b/i.test(String(stateNode?.textContent||'').trim());
}
function installedEntryUrl(){
  const url=new URL('/app/installed-entry-v146.html',location.origin);
  url.searchParams.set('installed','1');
  url.searchParams.set('system','civweave');
  url.searchParams.set('source','installer-repair-only-v2');
  return url.href;
}
function resumeRequiredNext(){
  const params=new URLSearchParams(location.search);
  const required=params.get('install')==='required'||params.has('installrequired');
  const rawNext=params.get('next');
  if(!required||!rawNext||!installedDisplay())return false;
  let target;
  try{target=new URL(rawNext,location.origin)}catch{return false}
  if(target.origin!==location.origin||!CANONICAL_NEXT_PATHS.has(target.pathname))return false;
  target.searchParams.delete('install');
  target.searchParams.delete('installrequired');
  target.searchParams.delete('next');
  target.searchParams.set('installed','1');
  target.searchParams.set('source','installer-required-next-installed-only-v2');
  location.replace(target.href);
  return true;
}

function installHostNodeLobby(){
  if(document.querySelector('script[data-civweave-host-node-lobby]'))return false;
  const appendLobby=()=>{
    if(document.querySelector('script[data-civweave-host-node-lobby]'))return false;
    const lobby=document.createElement('script');
    lobby.src=`/app/host-node-installer-lobby-v1.js?v=${releaseVersion()}-hub-login-v1`;
    lobby.async=true;
    lobby.dataset.civweaveHostNodeLobby='v3';
    document.head.append(lobby);
    return true;
  };
  if(globalThis.CivweaveHostNodeSessionV1)return appendLobby();
  const existing=document.querySelector('script[data-civweave-host-node-session]');
  if(existing){existing.addEventListener('load',appendLobby,{once:true});return true}
  const script=document.createElement('script');
  script.src=`/app/host-node-session-v1.js?v=${releaseVersion()}-hub-login-v1`;
  script.async=true;
  script.dataset.civweaveHostNodeSession='v1';
  script.addEventListener('load',appendLobby,{once:true});
  document.head.append(script);
  return true;
}

function installHubRecovery(){
  const sources=[
    '/app/host-node-session-export-v1.js',
    '/app/host-node-session-import-v1.js',
    '/app/hub-recovery-api-v1.js',
    '/app/hub-recovery-ui-v1.js',
    '/app/hub-mail-claim-v1.js'
  ];
  let delay=0;
  for(const src of sources){
    if(document.querySelector(`script[src^="${src}"]`))continue;
    const script=document.createElement('script');
    script.src=`${src}?v=${releaseVersion()}-hub-recovery-v1`;
    script.async=false;
    setTimeout(()=>document.head.append(script),delay++);
  }
  return true;
}

function hubGate(){return document.querySelector('[data-civweave-hub-tools-gate]')}
function setHubGateStatus(message,{busy=false}={}){
  const gate=hubGate();
  const status=gate?.querySelector('[data-civweave-hub-tools-status]');
  const button=gate?.querySelector('[data-civweave-load-hub-tools]');
  if(status)status.textContent=message;
  if(button){
    button.disabled=busy;
    button.textContent=busy?'Loading Hub & account tools…':'Load Hub & account tools';
  }
}
function finishHubGateWhenReady(){
  const gate=hubGate();
  if(!gate)return;
  let checks=0;
  const timer=setInterval(()=>{
    checks+=1;
    if(document.getElementById('cw-host-node-lobby')){
      clearInterval(timer);
      gate.remove();
      return;
    }
    if(checks>=40){
      clearInterval(timer);
      hubToolsStarted=false;
      setHubGateStatus('Hub tools did not finish loading. The installer is still usable; retry when you need Hub or recovery features.');
    }
  },200);
  addEventListener('pagehide',()=>clearInterval(timer),{once:true});
}
function loadHubTools(){
  if(hubToolsStarted)return false;
  hubToolsStarted=true;
  setHubGateStatus('Loading Hub login and account-recovery tools because you requested them.',{busy:true});
  installHostNodeLobby();
  installHubRecovery();
  finishHubGateWhenReady();
  return true;
}
function installHubToolsGate(){
  if(hubGate()||document.getElementById('cw-host-node-lobby'))return false;
  const gate=document.createElement('section');
  gate.className='status-card';
  gate.dataset.civweaveHubToolsGate=REVISION;
  gate.setAttribute('aria-labelledby','cw-hub-tools-gate-title');
  gate.innerHTML=`<small>OPTIONAL HUB & ACCOUNT TOOLS</small><h3 id="cw-hub-tools-gate-title">Connect to a Hub only when you need it</h3><p>Hub login, capacity search, Passport recovery, and recovery-mail tools stay dormant during installer startup.</p><div class="card-actions"><button type="button" data-civweave-load-hub-tools>Load Hub & account tools</button></div><p class="install-help" role="status" data-civweave-hub-tools-status>Nothing from the Hub/account stack runs until you choose this.</p>`;
  const knowledge=document.querySelector('.knowledge-card');
  const installCard=document.querySelector('.install-card');
  if(knowledge?.parentNode)knowledge.parentNode.insertBefore(gate,knowledge);
  else if(installCard?.parentNode)installCard.insertAdjacentElement('afterend',gate);
  else document.querySelector('main')?.append(gate);
  gate.querySelector('[data-civweave-load-hub-tools]')?.addEventListener('click',loadHubTools);
  return true;
}

async function currentWorker(){
  try{
    const registration=await navigator.serviceWorker?.getRegistration?.('/');
    return registration?.active||navigator.serviceWorker?.controller||registration?.waiting||registration?.installing||null;
  }catch{return navigator.serviceWorker?.controller||null}
}
async function requestRepair(){
  const worker=await currentWorker();
  if(!worker)throw new Error('The Civweave app worker is unavailable.');
  return new Promise((resolve,reject)=>{
    const channel=new MessageChannel();
    const timer=setTimeout(()=>{
      try{channel.port1.close()}catch{}
      reject(new Error('Shell repair stopped responding.'));
    },90000);
    channel.port1.onmessage=event=>{
      clearTimeout(timer);
      try{channel.port1.close()}catch{}
      resolve(event.data||null);
    };
    try{worker.postMessage({type:'REPAIR_DEVICE_PACKAGE'},[channel.port2])}
    catch(error){clearTimeout(timer);reject(error)}
  });
}
async function repairInstalledShell(){
  if(repairing)return;
  repairing=true;
  if(installButton){installButton.disabled=true;installButton.textContent='Repairing shell…'}
  if(updateButton){updateButton.disabled=true;updateButton.textContent='Repairing shell…'}
  if(helpNode)helpNode.textContent='Rebuilding only the small verified Civweave shell. Campus, model, media, and knowledge-school storage are untouched.';
  try{
    const packet=await requestRepair();
    if(packet?.type!=='CIVWEAVE_DEVICE_PACKAGE_REPAIR')throw new Error('The app worker did not acknowledge shell repair.');
    if(!packet.ready){
      const first=Array.isArray(packet.failures)&&packet.failures[0];
      throw new Error(first?.message||packet.error||'The verified shell is still incomplete.');
    }
    if(stateNode)stateNode.textContent='ready';
    if(assetsNode&&packet.assetCount)assetsNode.textContent=`${packet.presentCount||packet.assetCount}/${packet.assetCount} shell files`;
    if(updateButton){updateButton.disabled=false;updateButton.textContent='Check release'}
    if(installedDisplay()){
      if(helpNode)helpNode.textContent='Civweave shell repaired. Opening the installed app.';
      location.assign(installedEntryUrl());
    }else{
      if(helpNode)helpNode.textContent='Civweave shell repaired. Install or open Civweave from your device app launcher; the campus does not run in a browser tab.';
      if(installButton){installButton.disabled=false;installButton.textContent='Install Civweave'}
      queueMicrotask(()=>globalThis.CivweavePWAInstallV250?.refresh?.());
    }
  }catch(error){
    if(stateNode)stateNode.textContent='needs repair';
    if(helpNode)helpNode.textContent=`Shell repair could not complete: ${error?.message||error}. Saved campus, model, media, and school storage was preserved.`;
    if(installButton){installButton.disabled=false;installButton.textContent='Repair shell'}
    if(updateButton){updateButton.disabled=false;updateButton.textContent='Repair shell'}
  }finally{repairing=false}
}
function apply(){
  if(repairing||!failed())return;
  if(installButton){
    installButton.disabled=false;
    if(installButton.textContent!=='Repair shell')installButton.textContent='Repair shell';
    if(installButton.dataset.civweaveRepairOnly!==REVISION)installButton.dataset.civweaveRepairOnly=REVISION;
  }
  if(updateButton&&updateButton.textContent!=='Repair shell')updateButton.textContent='Repair shell';
  if(helpNode&&!helpNode.dataset.civweaveRepairOnly){
    helpNode.dataset.civweaveRepairOnly=REVISION;
    helpNode.textContent=`${helpNode.textContent} Browser launch is disabled; repair the shell here, then use the installed app.`;
  }
}

document.addEventListener('click',event=>{
  const target=event.target instanceof Element?event.target.closest('#install-app'):null;
  if(!target||!failed())return;
  event.preventDefault();
  event.stopImmediatePropagation();
  repairInstalledShell();
},true);
updateButton?.addEventListener('click',event=>{
  if(!failed())return;
  event.preventDefault();
  event.stopImmediatePropagation();
  repairInstalledShell();
},true);

if(resumeRequiredNext())return;
if(!installedDisplay()){
  document.documentElement.dataset.civweaveBrowserRuntime='installer-only';
  if(new URLSearchParams(location.search).get('install')==='required'&&helpNode){
    helpNode.textContent='Civweave must be installed before the campus can open. Browser-tab runtime is disabled.';
  }
}
const observer=new MutationObserver(apply);
observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
addEventListener('pagehide',()=>observer.disconnect(),{once:true});
installHubToolsGate();
apply();

const api=Object.freeze({
  revision:REVISION,
  installedDisplay,
  installedEntryUrl,
  repairInstalledShell,
  installHostNodeLobby,
  installHubRecovery,
  installHubToolsGate,
  loadHubTools,
  resumeRequiredNext,
  browserRuntimePolicy:'installer-only-until-installed-display',
  repairMessage:'REPAIR_DEVICE_PACKAGE',
  storagePolicy:'preserve-campus-model-media-school-storage',
  hubToolsPolicy:'explicit-user-load-only',
  firstPaintHubWork:false,
  cacheDistinctPath:true,
  sourceTruth:true,
  staticLauncherCleanup:false
});
globalThis.CivweaveInstallerRepairOnlyV2=api;
globalThis.CivweaveInstallerRepairOnlyV1=api;
})();
