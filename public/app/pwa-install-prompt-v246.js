(()=>{
'use strict';

const VERSION='pwa-install-prompt-v266-downloaded-runtime';
const ENTRY='/app/working-campus-v156.html?installed=1&navigation=downloaded-package-v266';
const BOOT_KEY='civweave.install-boundary.boot.v227';
let promptEvent=null;
let installed=false;
let prompting=false;
let buttonObserver=null;

function standalone(){return navigator.standalone===true||['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches)}
function campusReady(){
  const status=globalThis.CivweaveOfflineCampusStatusV210?.last;
  if(status?.ready===true)return true;
  return /^ready offline\b/i.test(document.querySelector('#offline-package-state')?.textContent||'');
}
function authorizeRuntime(){try{sessionStorage.setItem(BOOT_KEY,'1')}catch{}return true}
function help(message){const node=document.querySelector('#install-help');if(node&&node.textContent!==message)node.textContent=message}
function installButton(){return document.querySelector('#install-app')}
function publish(type,detail={}){try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,standalone:standalone(),installed,campusReady:campusReady(),...detail}}))}catch{}}
function refreshButton(){
  const button=installButton();
  if(!button||/reset app shell/i.test(button.textContent||''))return;
  if(standalone()){
    const ready=campusReady();
    button.disabled=!ready;
    button.textContent=ready?'Open downloaded Civweave':'Finishing campus download…';
    help(ready?'Civweave is installed and the required campus is ready. Open the downloaded device package.':'Civweave is installed. The required campus is still downloading; runtime opening stays locked so the hosted website cannot substitute for missing local files.');
    return;
  }
  if(promptEvent){
    button.disabled=false;
    button.textContent='Install Civweave';
    help('Civweave is ready for a real browser-native app install. The required campus continues downloading to the device.');
    return;
  }
  if(!prompting){
    button.textContent='Install Civweave';
    help('Waiting for Chrome to offer the real Civweave app-install prompt. Do not use Create shortcut: that only links back to the installer website.');
  }
}
function observeButton(){
  const button=installButton();if(!button)return;
  buttonObserver?.disconnect();
  buttonObserver=new MutationObserver(()=>queueMicrotask(refreshButton));
  buttonObserver.observe(button,{attributes:true,attributeFilter:['disabled'],childList:true,subtree:true});
  refreshButton();
}
function capture(event){event.preventDefault();promptEvent=event;publish('civweave:pwa-install-prompt-ready',{available:true});queueMicrotask(refreshButton)}
function onInstalled(){installed=true;promptEvent=null;prompting=false;publish('civweave:pwa-installed',{available:false});queueMicrotask(refreshButton)}
async function ownInstallClick(event){
  const button=event.target?.closest?.('#install-app');
  if(!button||prompting)return;
  if(/reset app shell/i.test(button.textContent||''))return;
  if(standalone()){
    event.preventDefault();event.stopImmediatePropagation();
    if(!campusReady()){
      help('The app is installed, but the required campus is not complete yet. Civweave will stay on the installer rather than falling back to the live website.');
      return;
    }
    authorizeRuntime();
    location.assign(ENTRY);
    return;
  }
  const prompt=promptEvent;
  event.preventDefault();event.stopImmediatePropagation();
  if(!prompt){
    help('Chrome has not offered a true Civweave app-install prompt yet. Do not use Create shortcut: that only links back to the installer website. Tap Check release or reload this installer after the shell is ready.');
    return;
  }
  prompting=true;promptEvent=null;button.disabled=true;button.textContent='Opening app install…';
  try{
    await prompt.prompt();
    const choice=await prompt.userChoice.catch(()=>null);
    if(choice?.outcome==='accepted'){
      installed=true;
      help(campusReady()?'Civweave app installation accepted. The downloaded campus is ready to open.':'Civweave app installation accepted. The required campus is still downloading; the app runtime stays locked until that local package is complete.');
      button.textContent='Installing Civweave…';
    }else{
      help('Civweave app installation was dismissed. Reload this installer when you want Chrome to offer the native install again.');
      button.disabled=false;button.textContent='Reload to install';
    }
  }catch(error){
    help(`The native Civweave install prompt could not open: ${error?.message||error}. Reload this installer and try again.`);
    button.disabled=false;button.textContent='Reload to install';
  }finally{prompting=false}
}
function onCampusStatus(){queueMicrotask(refreshButton)}

addEventListener('beforeinstallprompt',capture);
addEventListener('appinstalled',onInstalled);
addEventListener('civweave:offline-campus-status',onCampusStatus);
document.addEventListener('click',ownInstallClick,true);
if(document.readyState==='loading')addEventListener('DOMContentLoaded',observeButton,{once:true});else observeButton();
addEventListener('pagehide',()=>{buttonObserver?.disconnect();removeEventListener('civweave:offline-campus-status',onCampusStatus)},{once:true});

const api=Object.freeze({version:VERSION,available:()=>Boolean(promptEvent),peek:()=>promptEvent,consume(){const value=promptEvent;promptEvent=null;return value},restore(event){if(event)promptEvent=event;return Boolean(promptEvent)},standalone,campusReady,authorizeRuntime,refresh:refreshButton,state:()=>({available:Boolean(promptEvent),installed,prompting,standalone:standalone(),campusReady:campusReady()})});
globalThis.CivweavePWAInstallV246=api;
publish('civweave:pwa-install-bridge-ready',{available:Boolean(promptEvent)});
})();
