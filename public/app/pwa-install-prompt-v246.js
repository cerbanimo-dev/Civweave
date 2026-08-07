(()=>{
'use strict';

const VERSION='pwa-install-prompt-v246';
let promptEvent=null;
let installed=false;

function standalone(){
  return navigator.standalone===true||['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches);
}
function publish(type,detail={}){
  try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,standalone:standalone(),installed,...detail}}))}catch{}
}
function capture(event){
  event.preventDefault();
  promptEvent=event;
  publish('civweave:pwa-install-prompt-ready',{available:true});
}
function onInstalled(){
  installed=true;
  promptEvent=null;
  publish('civweave:pwa-installed',{available:false});
}

addEventListener('beforeinstallprompt',capture);
addEventListener('appinstalled',onInstalled);

const api=Object.freeze({
  version:VERSION,
  available:()=>Boolean(promptEvent),
  peek:()=>promptEvent,
  consume(){const value=promptEvent;promptEvent=null;return value},
  restore(event){if(event)promptEvent=event;return Boolean(promptEvent)},
  standalone,
  state:()=>({available:Boolean(promptEvent),installed,standalone:standalone()})
});

globalThis.CivweavePWAInstallV246=api;
publish('civweave:pwa-install-bridge-ready',{available:Boolean(promptEvent)});
})();
