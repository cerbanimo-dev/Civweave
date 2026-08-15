'use strict';

(() => {
  const VERSION='legacy-v156-bridge-v209-interface-rebase-v1';
  const reply=(event,packet)=>{
    try{event.ports?.[0]?.postMessage(packet)}catch{}
    try{event.source?.postMessage?.(packet)}catch{}
  };
  self.addEventListener('message',event=>{
    if(event.data?.type==='GET_SHARED_IMAGE_STATUS')reply(event,{type:'CIVWEAVE_SHARED_IMAGE_STATUS',version:VERSION,ready:true,present:0,total:0,missing:[],legacyBridge:true});
    if(event.data?.type==='GET_CRITICAL_BOOT_STATUS')reply(event,{type:'CIVWEAVE_CRITICAL_BOOT_STATUS',version:VERSION,mode:'flat',ready:true,present:0,total:0,missing:[],legacyBridge:true});
    if(event.data?.type==='GET_ADDITIONS_STATUS')reply(event,{type:'CIVWEAVE_ADDITIONS_STATUS',version:VERSION,ready:true,assetCount:0,presentCount:0,missing:[],legacyBridge:true});
  });
})();

importScripts('/service-worker-v203.js?v=1.0.160-interface-rebase-v1-legacy-v156-bridge-v209');
