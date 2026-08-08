(()=>{
'use strict';

const VERSION='1.0.51-shared-guide-surface-v236-v256-mobile-scroll-gemini-fallback';
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
function loadStyle(href){
  const path=new URL(href,location.href).pathname;
  if([...document.styleSheets].some(sheet=>{try{return new URL(sheet.href,location.href).pathname===path}catch{return false}}))return false;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href=href;
  link.dataset.civweaveSharedGuideStyle='v256';
  document.head.append(link);
  return true;
}

loadStyle('/app/mobile-guide-scroll-v256.css?v=1.0.51-v256');
load('/extensions/civweave-gemini-interactions-v159.js?v=1.0.51-v256');
load('/app/shared-guide-surface-v236-core-v244.js?v=1.0.51-v256',()=>{
  load('/app/shared-chat-face-icons-v255.js?v=1.0.51-v256',()=>{
    try{dispatchEvent(new CustomEvent('civweave:shared-chat-face-icons-ready',{detail:{version:VERSION}}))}catch{}
  });
  load('/app/living-school-chat-workbench-v255.js?v=1.0.51-v256',()=>{
    try{dispatchEvent(new CustomEvent('civweave:living-school-chat-workbench-ready',{detail:{version:VERSION}}))}catch{}
  });
});

globalThis.CivweaveSharedGuideSurfaceV236Loader=Object.freeze({version:VERSION});
})();
