(()=>{
'use strict';

const VERSION='1.0.50-shared-guide-surface-v236-v255-face-icon-loader';
if(globalThis.CivweaveSharedGuideSurfaceV236Loader?.version===VERSION)return;

function load(src,onload){
  const script=document.createElement('script');
  script.src=src;
  script.async=false;
  script.onload=onload||null;
  script.onerror=()=>console.warn('[Civweave] Failed to load shared guide dependency:',src);
  document.head.append(script);
  return script;
}

load('/app/shared-guide-surface-v236-core-v244.js?v=1.0.50',()=>{
  load('/app/shared-chat-face-icons-v255.js?v=1.0.50',()=>{
    try{dispatchEvent(new CustomEvent('civweave:shared-chat-face-icons-ready',{detail:{version:VERSION}}))}catch{}
  });
});

globalThis.CivweaveSharedGuideSurfaceV236Loader=Object.freeze({version:VERSION});
})();
