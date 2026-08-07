(()=>{
'use strict';

const VERSION='pwa-install-prompt-v246';
const ENTRY='/app/?system=civweave&installed=1';
let promptEvent=null;
let installed=false;
let prompting=false;

function standalone(){
  return navigator.standalone===true||['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches);
}
function help(message){
  const node=document.querySelector('#install-help');
  if(node)node.textContent=message;
}
function installButton(){return document.querySelector('#install-app')}
function publish(type,detail={}){
  try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,standalone:standalone(),installed,...detail}}))}catch{}
}
function refreshButton(){
  const button=installButton();
  if(!button||button.disabled)return;
  if(standalone()){
    button.textContent='Open Civweave';
    help('Civweave is installed as an app. The campus can keep downloading in the background.');
    return;
  }
  if(promptEvent){
    button.textContent='Install Civweave';
    help('Civweave is ready for a real browser-native app install. Tap Install Civweave.');
  }
}
function capture(event){
  event.preventDefault();
  promptEvent=event;
  publish('civweave:pwa-install-prompt-ready',{available:true});
  queueMicrotask(refreshButton);
}
function onInstalled(){
  installed=true;
  promptEvent=null;
  prompting=false;
  publish('civweave:pwa-installed',{available:false});
  queueMicrotask(refreshButton);
}
async function ownInstallClick(event){
  const button=event.target?.closest?.('#install-app');
  if(!button||button.disabled||prompting)return;
  if(/reset app shell/i.test(button.textContent||''))return;
  if(standalone()){
    event.preventDefault();
    event.stopImmediatePropagation();
    location.assign(ENTRY);
    return;
  }
  const prompt=promptEvent;
  event.preventDefault();
  event.stopImmediatePropagation();
  if(!prompt){
    help('Chrome has not offered a true Civweave app-install prompt yet. Do not use Create shortcut: that only links back to the website. Tap Check release or reload this installer after the shell is ready.');
    button.textContent='Install prompt not ready';
    return;
  }
  prompting=true;
  promptEvent=null;
  button.disabled=true;
  button.textContent='Opening app install…';
  try{
    await prompt.prompt();
    const choice=await prompt.userChoice.catch(()=>null);
    if(choice?.outcome==='accepted'){
      installed=true;
      help('Civweave app installation accepted. You can open it immediately while the required campus continues downloading.');
      button.textContent='Installing Civweave…';
    }else{
      help('Civweave app installation was dismissed. Reload this installer when you want Chrome to offer the native install again.');
      button.disabled=false;
      button.textContent='Reload to install';
    }
  }catch(error){
    help(`The native Civweave install prompt could not open: ${error?.message||error}. Reload this installer and try again.`);
    button.disabled=false;
    button.textContent='Reload to install';
  }finally{
    prompting=false;
  }
}

addEventListener('beforeinstallprompt',capture);
addEventListener('appinstalled',onInstalled);
document.addEventListener('click',ownInstallClick,true);
addEventListener('DOMContentLoaded',refreshButton,{once:true});

const api=Object.freeze({
  version:VERSION,
  available:()=>Boolean(promptEvent),
  peek:()=>promptEvent,
  consume(){const value=promptEvent;promptEvent=null;return value},
  restore(event){if(event)promptEvent=event;return Boolean(promptEvent)},
  standalone,
  refresh:refreshButton,
  state:()=>({available:Boolean(promptEvent),installed,prompting,standalone:standalone()})
});

globalThis.CivweavePWAInstallV246=api;
publish('civweave:pwa-install-bridge-ready',{available:Boolean(promptEvent)});
})();
