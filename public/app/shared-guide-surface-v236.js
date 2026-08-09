(()=>{
'use strict';

const VERSION='1.0.57-shared-guide-surface-v236-v265-orchestration-materialization';
if(globalThis.CivweaveSharedGuideSurfaceV236Loader?.version===VERSION)return;

function load(src,onload){
  const path=new URL(src,location.href).pathname;
  const existing=[...document.scripts].find(script=>{try{return new URL(script.src,location.href).pathname===path}catch{return false}});
  if(existing){
    if(onload){
      if(existing.dataset.civweaveReady==='true')queueMicrotask(onload);
      else existing.addEventListener('load',onload,{once:true});
    }
    return existing;
  }
  const script=document.createElement('script');
  script.src=src;
  script.async=false;
  script.onload=()=>{script.dataset.civweaveReady='true';onload?.()};
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
  link.dataset.civweaveSharedGuideStyle='v265';
  document.head.append(link);
  return true;
}

loadStyle('/app/mobile-guide-scroll-v256.css?v=1.0.57-v256');
loadStyle('/app/weaveling-scroll-owner-v265.css?v=1.0.57-v265');
load('/app/gemini-device-direct-v257.js?v=1.0.57-v257',()=>{
  load('/extensions/civweave-gemini-interactions-v159.js?v=1.0.57-v257');
});
load('/app/intention-planner-v141.js?v=1.0.57-v265-review-materialization',()=>{
  load('/app/weaveling-plan-materialization-v265.js?v=1.0.57-v265',()=>{
    load('/app/shared-guide-surface-v236-core-v244.js?v=1.0.57-v265',()=>{
      load('/app/shared-chat-face-icons-v255.js?v=1.0.57-v257',()=>{
        try{dispatchEvent(new CustomEvent('civweave:shared-chat-face-icons-ready',{detail:{version:VERSION}}))}catch{}
      });
      load('/app/living-school-chat-workbench-v255.js?v=1.0.57-v265-learning-pathway',()=>{
        try{dispatchEvent(new CustomEvent('civweave:living-school-chat-workbench-ready',{detail:{version:VERSION}}))}catch{}
      });
    });
  });
});

globalThis.CivweaveSharedGuideSurfaceV236Loader=Object.freeze({version:VERSION,plannerMaterialization:'v265',scrollOwnership:'document-v265'});
})();
