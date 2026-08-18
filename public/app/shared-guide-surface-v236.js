(()=>{
'use strict';

const VERSION='1.0.148-shared-guide-surface-v236-canonical-prompt';
if(globalThis.CivweaveSharedGuideSurfaceV236Loader?.version===VERSION)return;

let partyRequested=false;
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
function activatePartyChat(reason='explicit-party-use'){
  partyRequested=true;
  return load('/app/shared-intention-party-chat-v1.js?v=1.0.1-party-chat-lazy-v1',()=>{
    try{dispatchEvent(new CustomEvent('civweave:shared-intention-party-ready',{detail:{version:VERSION,reason,lazy:true}}))}catch{}
  },()=>Boolean(globalThis.CivweaveSharedIntentionPartyChatV1));
}
function onPartyRequest(event){
  if(event?.type==='civweave:open-human-thread'&&event?.detail?.source!=='party')return;
  activatePartyChat(event?.type||'explicit-party-use');
}
function bindPartyActivation(){
  if(document.documentElement.dataset.civweavePartyLazyBound==='true')return;
  document.documentElement.dataset.civweavePartyLazyBound='true';
  addEventListener('civweave:open-human-thread',onPartyRequest);
  addEventListener('civweave:party-activate-request',onPartyRequest);
  addEventListener('civweave:shared-intention-party-use',onPartyRequest);
}
function install(){
  if(!liveHead())return false;
  bindPartyActivation();
  loadStyle('/app/mobile-guide-scroll-v256.css?v=1.0.57-v256');
  loadStyle('/app/weaveling-scroll-owner-v265.css?v=1.0.57-v265');
  load('/app/minilm-response-router-v347.js?v=1.3.0-minilm-primary',null,()=>Boolean(globalThis.CivweaveResponseRouterV347));
  load('/app/guide-generation-floor-v1.js?v=1.0.0-floor-900',null,()=>Boolean(globalThis.CivweaveGuideGenerationFloorV1));
  load('/app/minilm-decision-strip-v1.js?v=1.1.0-router-watch',null,()=>Boolean(globalThis.CivweaveMiniLMDecisionStripV1));
  load('/app/family-ai-loader-v105.js?v=1.0.132-standard-ai-lazy-local',null,()=>Boolean(globalThis.CivweaveFamilyAILoaderV105));
  load('/app/guide-provider-policy-v1.js?v=1.0.0-server-auto-local-first',null,()=>Boolean(globalThis.CivweaveGuideProviderPolicyV1));
  load('/app/guide-forward-failure-policy-v1.js?v=1.0.0-forward-only-guild-handoff',null,()=>Boolean(globalThis.CivweaveGuideForwardFailurePolicyV1));
  load('/app/guide-forward-failure-hardening-v1.js?v=1.2.0-router-stable',null,()=>Boolean(globalThis.CivweaveGuideForwardFailureHardeningV1));
  load('/app/guide-stream-thinking-v249.js?v=1.0.118-v249-navigation-lifecycle-v424',null,()=>Boolean(globalThis.CivweaveGuideStreamThinkingV249));
  load('/app/gemini-device-direct-v257.js?v=1.0.57-v257',()=>{
    load('/extensions/civweave-gemini-interactions-v159.js?v=1.0.57-v257',null,()=>Boolean(globalThis.CivweaveGeminiInteractionsV159));
  },()=>Boolean(globalThis.CivweaveGeminiDeviceDirectV257));
  load('/app/intention-planner-v141.js?v=1.0.57-v265-review-materialization',()=>{
    load('/app/weaveling-plan-materialization-v265.js?v=1.0.57-v265',()=>{
      load('/app/shared-guide-surface-v236-core-v244.js?v=1.0.128-canonical-artifacts',()=>{
        globalThis.CivweaveSharedGuideSurfaceV236?.repairSurface?.();
        load('/app/unified-chat-system-v1.js?v=1.0.4-learning-journey',()=>{
          load('/app/guide-capability-passover-v1.js?v=1.1.3-canonical-prompt',()=>{
            try{dispatchEvent(new CustomEvent('civweave:guide-capability-passover-ready',{detail:{version:VERSION,artifactLanguage:'canonical-v1',canonicalPromptBeforeMiniLM:true}}))}catch{}
          },()=>Boolean(globalThis.CivweaveGuideCapabilityPassoverV1));
          try{dispatchEvent(new CustomEvent('civweave:unified-chat-system-ready',{detail:{version:VERSION}}))}catch{}
        },()=>Boolean(globalThis.CivweaveUnifiedChatSystemV1));
        load('/app/human-message-bubble-v1.js?v=1.0.0-human-message-bubble-v1',()=>{
          try{dispatchEvent(new CustomEvent('civweave:human-message-bubble-ready',{detail:{version:VERSION}}))}catch{}
        },()=>Boolean(globalThis.CivweaveHumanMessageBubbleV1));
        load('/app/local-ai/translation-packs-v1.js?v=translation-packs-v1',()=>{
          try{dispatchEvent(new CustomEvent('civweave:translation-workflow-ready',{detail:{version:VERSION}}))}catch{}
        },()=>Boolean(globalThis.CivweaveTranslationPacksV1));
        load('/app/shared-chat-face-icons-v255.js?v=1.0.115-header-clearance-v1',()=>{
          try{dispatchEvent(new CustomEvent('civweave:shared-chat-face-icons-ready',{detail:{version:VERSION}}))}catch{}
        },()=>Boolean(globalThis.CivweaveSharedChatFaceIconsV255));
      },()=>Boolean(globalThis.CivweaveSharedGuideSurfaceV236));
    },()=>Boolean(globalThis.CivweaveWeavelingPlanMaterializationV265));
  },()=>Boolean(globalThis.CivweaveIntentionPlanner));
  return true;
}

install();
addEventListener('pageshow',()=>queueMicrotask(()=>{install();globalThis.CivweaveSharedGuideSurfaceV236?.repairSurface?.()}));

globalThis.CivweaveSharedGuideSurfaceV236Loader=Object.freeze({version:VERSION,responseRouter:'minilm-v347-primary-v3',generationFloor:'guide-generation-floor-v1-900-tokens',routeDecisionStrip:'v1.1-router-watch',assistantLoader:'family-ai-loader-v105-on-demand',assistantLoaderEagerWarm:false,providerPolicy:'guide-provider-policy-v1-server-auto-local-first',failurePolicy:'guide-forward-failure-policy-v1',failureHardening:'guide-forward-failure-hardening-v1-router-stable',failureDirection:'forward-only',terminalGenerativeFallback:'automatic-server-auto',deterministicAnswerFallback:false,deterministicTerminalVisible:false,deterministicAssistantPatchRetired:true,guildRequestDeduplicated:true,plannerMaterialization:'v265-structured-and-deterministic',partyChat:'v1-lazy',partyIdentity:'anonymous-role-only',partyAutostart:false,partyRequested:()=>partyRequested,activatePartyChat,humanMessagingAttention:'v1',humanTranslation:'en-ja-local-v1',translationPrivacy:'recipient-device-after-decryption',scrollOwnership:'document-v265',preloadedDependencyReadyCheck:true,streamThinking:'v249',navigationLifecycle:'v424',surfaceMode:'bubble-only',launcherOwner:'guide-chat-surface-v350',avatarRuntime:'v346-visible',chatArchitecture:'one-core-five-themes-five-memory-folders',chatRuntime:'/app/unified-chat-system-v1.js',chatRuntimeVersion:'v1.0.4-learning-journey',capabilityPassover:'guide-capability-passover-v1.1.3-canonical-prompt',canonicalPromptBeforeMiniLM:true,artifactLanguage:'Weaveling=Quest; Moss=Learning Journey; Kamiya=Endeavor; Rook=Manifest',artifactLanguageContract:'/config/guide-artifact-language-v1.json',passoverResubmitsOriginal:true,standardAIOnly:true,localModelStartup:'request-driven-only',install});
})();