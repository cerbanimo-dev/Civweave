(()=>{
'use strict';

const VERSION='1.0.120-shared-guide-surface-v236-avatar-v346-party-chat-v1-human-bubble-v1';
if(globalThis.CivweaveSharedGuideSurfaceV236Loader?.version===VERSION)return;

function liveHead(){
  const head=document.head;
  return document.documentElement?.isConnected&&head?.isConnected?head:null;
}
function load(src,onload,readyCheck){
  const path=new URL(src,location.href).pathname;
  const existing=[...document.scripts].find(script=>{try{return new URL(script.src,location.href).pathname===path}catch{return false}});
  if(existing){
    if(onload){
      if(existing.dataset.civweaveReady==='true'||readyCheck?.())queueMicrotask(onload);
      else existing.addEventListener('load',onload,{once:true});
    }
    return existing;
  }
  const head=liveHead();
  if(!head)return null;
  const script=document.createElement('script');
  script.src=src;
  script.async=false;
  script.onload=()=>{script.dataset.civweaveReady='true';onload?.()};
  script.onerror=()=>console.warn('[Civweave] Failed to load shared guide dependency:',src);
  if(!head.isConnected)return null;
  head.append(script);
  return script;
}
function loadStyle(href){
  const path=new URL(href,location.href).pathname;
  if([...document.styleSheets].some(sheet=>{try{return new URL(sheet.href,location.href).pathname===path}catch{return false}}))return false;
  const head=liveHead();
  if(!head)return false;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href=href;
  link.dataset.civweaveSharedGuideStyle='v265';
  if(!head.isConnected)return false;
  head.append(link);
  return true;
}
function install(){
  if(!liveHead())return false;
  loadStyle('/app/mobile-guide-scroll-v256.css?v=1.0.57-v256');
  loadStyle('/app/weaveling-scroll-owner-v265.css?v=1.0.57-v265');
  load('/app/guide-stream-thinking-v249.js?v=1.0.118-v249-navigation-lifecycle-v424',null,()=>Boolean(globalThis.CivweaveGuideStreamThinkingV249));
  load('/app/gemini-device-direct-v257.js?v=1.0.57-v257',()=>{
    load('/extensions/civweave-gemini-interactions-v159.js?v=1.0.57-v257',null,()=>Boolean(globalThis.CivweaveGeminiInteractionsV159));
  },()=>Boolean(globalThis.CivweaveGeminiDeviceDirectV257));
  load('/app/intention-planner-v141.js?v=1.0.57-v265-review-materialization',()=>{
    load('/app/weaveling-plan-materialization-v265.js?v=1.0.57-v265',()=>{
      load('/app/shared-guide-surface-v236-core-v244.js?v=1.0.118-v425-bubble-only',()=>{
        load('/app/shared-intention-party-chat-v1.js?v=1.0.0-party-chat-v1',()=>{
          try{dispatchEvent(new CustomEvent('civweave:shared-intention-party-ready',{detail:{version:VERSION}}))}catch{}
        },()=>Boolean(globalThis.CivweaveSharedIntentionPartyChatV1));
        load('/app/human-message-bubble-v1.js?v=1.0.0-human-message-bubble-v1',()=>{
          try{dispatchEvent(new CustomEvent('civweave:human-message-bubble-ready',{detail:{version:VERSION}}))}catch{}
        },()=>Boolean(globalThis.CivweaveHumanMessageBubbleV1));
        load('/app/shared-chat-face-icons-v255.js?v=avatar-v346-visible',()=>{
          try{dispatchEvent(new CustomEvent('civweave:shared-chat-face-icons-ready',{detail:{version:VERSION}}))}catch{}
        },()=>Boolean(globalThis.CivweaveSharedChatFaceIconsV255));
        load('/app/living-school-chat-workbench-v255.js?v=1.0.57-v265-learning-pathway',()=>{
          try{dispatchEvent(new CustomEvent('civweave:living-school-chat-workbench-ready',{detail:{version:VERSION}}))}catch{}
        },()=>Boolean(globalThis.CivweaveLivingSchoolChatWorkbenchV255));
      },()=>Boolean(globalThis.CivweaveSharedGuideSurfaceV236));
    },()=>Boolean(globalThis.CivweaveWeavelingPlanMaterializationV265));
  },()=>Boolean(globalThis.CivweaveIntentionPlanner));
  return true;
}

install();
addEventListener('pageshow',()=>queueMicrotask(install));

globalThis.CivweaveSharedGuideSurfaceV236Loader=Object.freeze({version:VERSION,plannerMaterialization:'v265',partyChat:'v1',partyIdentity:'anonymous-role-only',humanMessagingAttention:'v1',scrollOwnership:'document-v265',preloadedDependencyReadyCheck:true,streamThinking:'v249',navigationLifecycle:'v424',surfaceMode:'bubble-only',avatarRuntime:'v346-visible',install});
})();