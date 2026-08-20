(()=>{
'use strict';

const VERSION='1.0.165-shared-guide-surface-v236-task-aware-local-stream';
if(globalThis.CivweaveSharedGuideSurfaceV236Loader?.version===VERSION)return;

let partyRequested=false;
let threadUiRequested=false;
function liveHead(){
  const head=document.head;
  return document.documentElement?.isConnected&&head?.isConnected?head:null;
}
function load(src,onload,readyCheck){
  const path=new URL(src,location.href).pathname;
  const existing=[...document.scripts].find(script=>{try{return new URL(script.src,location.href).pathname===path}catch{return false}});
  if(existing){
    const ready=readyCheck?.();
    if(ready){if(onload)queueMicrotask(onload);return existing}
    if(readyCheck&&existing.dataset.civweaveReady==='true'){
      try{existing.remove()}catch{}
      return load(src,onload,readyCheck);
    }
    if(onload)existing.addEventListener('load',onload,{once:true});
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
async function activateThreadUI(reason='guide-chat-opened'){
  threadUiRequested=true;
  try{
    const orchestrator=globalThis.CivweaveExperienceOrchestratorV232;
    if(typeof orchestrator?.ensureChatUiModules==='function'){
      const ready=await orchestrator.ensureChatUiModules();
      if(ready){globalThis.CivweaveSavedChatUIV295?.render?.(globalThis.CivweaveGuideChatSurfaceV350?.activeWindow?.());return true}
    }
  }catch{}
  return new Promise(resolve=>{
    const finish=()=>{try{globalThis.CivweaveSavedChatUIV295?.render?.(globalThis.CivweaveGuideChatSurfaceV350?.activeWindow?.())}catch{};resolve(Boolean(globalThis.CivweaveSavedChatUIV295))};
    if(globalThis.CivweaveSavedChatStoreV295&&globalThis.CivweaveSavedChatUIV295){finish();return}
    load('/app/saved-chat-store-v295.js?rev=1.0.164-thread-tabs-v352',()=>{
      load('/app/saved-chat-ui-v295.js?rev=1.0.166-thread-tabs-v354',finish,()=>globalThis.CivweaveSavedChatUIV295?.version==='1.0.166-saved-chat-ui-v354');
    },()=>globalThis.CivweaveSavedChatStoreV295?.version==='1.0.164-saved-chat-store-v352');
    setTimeout(finish,1600);
  });
}
function bindThreadActivation(){
  if(document.documentElement.dataset.civweaveThreadUiBound==='true')return;
  document.documentElement.dataset.civweaveThreadUiBound='true';
  addEventListener('civweave:guide-chat-opened',event=>void activateThreadUI(event?.type||'guide-chat-opened'));
  addEventListener('civweave:guide-chat-state',event=>{if(event?.detail?.open)void activateThreadUI('guide-chat-state-open')});
  addEventListener('pageshow',()=>{if(globalThis.CivweaveGuideChatSurfaceV350?.state?.().open)void activateThreadUI('pageshow-open-chat')});
  if(globalThis.CivweaveGuideChatSurfaceV350?.state?.().open)queueMicrotask(()=>void activateThreadUI('already-open-chat'));
}
function install(){
  if(!liveHead())return false;
  bindPartyActivation();
  bindThreadActivation();
  loadStyle('/app/mobile-guide-scroll-v256.css?v=1.0.57-v256');
  loadStyle('/app/weaveling-scroll-owner-v265.css?v=1.0.57-v265');
  load('/app/mobile-chat-visual-viewport-v1.js?v=1.0.1-long-thread-fit',null,()=>Boolean(globalThis.CivweaveMobileChatVisualViewportV1));
  load('/app/minilm-response-router-v347.js?v=1.3.0-minilm-primary',null,()=>Boolean(globalThis.CivweaveResponseRouterV347));
  load('/app/guide-generation-floor-v1.js?v=1.3.0-local-planner-authority',null,()=>globalThis.CivweaveGuideGenerationFloorV1?.version==='1.3.0-guide-generation-floor-v1-local-planner-authority');
  load('/app/minilm-decision-strip-v1.js?v=1.1.0-router-watch',null,()=>Boolean(globalThis.CivweaveMiniLMDecisionStripV1));
  load('/app/family-ai-loader-v105.js?v=1.0.132-standard-ai-lazy-local',null,()=>Boolean(globalThis.CivweaveFamilyAILoaderV105));
  load('/app/guide-provider-policy-v1.js?v=1.0.0-server-auto-local-first',null,()=>Boolean(globalThis.CivweaveGuideProviderPolicyV1));
  load('/app/guide-forward-failure-policy-v1.js?v=1.0.1-local-provider-pin',null,()=>Boolean(globalThis.CivweaveGuideForwardFailurePolicyV1));
  load('/app/guide-forward-failure-hardening-v1.js?v=1.2.1-local-provider-pin',null,()=>Boolean(globalThis.CivweaveGuideForwardFailureHardeningV1));
  load('/app/local-chat-bounded-recovery-v1.js?v=1.1.0-gemma4-q4',null,()=>globalThis.CivweaveLocalChatBoundedRecoveryV1?.version==='1.1.0-local-chat-bounded-recovery-v1-gemma4-q4'&&globalThis.CivweaveLocalChatBoundedRecoveryV1?.gemma4CompatibleQ4===true);
  load('/app/local-chat-runtime-v295.js?v=1.0.119-task-aware-streaming',null,()=>globalThis.CivweaveLocalChatRuntimeV295?.version==='1.0.119-local-chat-runtime-v305-task-aware-streaming');
  load('/app/local-provider-authority-v1.js?v=1.0.3-inference-core-first',null,()=>globalThis.CivweaveLocalProviderAuthorityV1?.version==='1.0.3-local-provider-authority-v1-inference-core-first');
  load('/app/guide-stream-thinking-v249.js?v=1.0.121-local-authority',null,()=>globalThis.CivweaveGuideStreamThinkingV249?.version==='1.0.121-guide-stream-thinking-v249-local-authority');
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
        load('/app/human-message-bubble-v1.js?v=1.1.0-human-message-standalone-v1',()=>{
          load('/app/human-chat-guild-context-v1.js?v=1.0.2-human-chat-standalone-v2',()=>{
            load('/app/human-chat-network-v1.js?v=1.0.0-human-chat-network-v1',()=>{
              try{dispatchEvent(new CustomEvent('civweave:human-chat-network-ready',{detail:{version:VERSION,contacts:true,groups:true,autoThreads:['guild','party'],presentation:'standalone-v2'}}))}catch{}
            },()=>Boolean(globalThis.CivweaveHumanChatNetworkV1));
          },()=>globalThis.CivweaveHumanChatGuildContextV1?.version==='1.0.2-human-chat-standalone-v2');
          try{dispatchEvent(new CustomEvent('civweave:human-message-bubble-ready',{detail:{version:VERSION,presentation:'standalone-v2'}}))}catch{}
        },()=>globalThis.CivweaveHumanMessageBubbleV1?.version==='1.1.0-human-message-standalone-v1');
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

globalThis.CivweaveSharedGuideSurfaceV236Loader=Object.freeze({version:VERSION,responseRouter:'minilm-v347-primary-v3',generationFloor:'guide-generation-floor-v1-local-planner-authority',routeDecisionStrip:'v1.1-router-watch',assistantLoader:'family-ai-loader-v105-on-demand',assistantLoaderEagerWarm:false,providerPolicy:'guide-provider-policy-v1-server-auto-local-first',failurePolicy:'guide-forward-failure-policy-v1-local-provider-pin',failureHardening:'guide-forward-failure-hardening-v1-local-provider-pin',providerAuthority:'local-provider-authority-v1-inference-core-first',localChatRuntime:'v295-task-aware-streaming',localFallbackRecovery:'bounded-local-recovery-v1-gemma4-q4',boundedLocalFallbackRecovery:true,stallReasonPreserved:true,fifteenMinuteChatFloorRetired:true,failureDirection:'forward-only',terminalGenerativeFallback:'automatic-server-auto-unless-local-pinned',deterministicAnswerFallback:false,deterministicTerminalVisible:false,deterministicAssistantPatchRetired:true,guildRequestDeduplicated:true,localProviderPinned:true,inferenceCoreFirst:true,fullLocalBootstrapBlocking:false,gemma4MobileRuntimeFloor:'4.3.0',bundledTransformersV4:'4.2.0',gemma4Q2RuntimeBlocked:true,gemma4CompatibleQ4:true,gemma4CompatibleModelId:'gemma4-e2b-it-q4f16',gemma4CompatibleModelRevision:'9f4bef82ea6e296bc69f8a2f5939f73af81b07a6',gemma4Q2FallbackLocalOnly:true,staleAuthorityRefresh:true,plannerMaterialization:'v265-structured-and-deterministic',partyChat:'v1-lazy',partyIdentity:'anonymous-role-only',partyAutostart:false,partyRequested:()=>partyRequested,activatePartyChat,humanMessagingAttention:'v1',humanChatNetwork:'v1',humanChatGuildContext:'active-host-session-v2',humanChatContacts:true,humanChatGroups:true,humanChatAutoThreads:['guild','party'],humanChatTransport:'e2ee-local-mesh-plus-cloudflare-mail-relay',humanChatBluetoothMeshFriendly:true,humanChatPresentation:'standalone-v2',humanChatSharesGuideSurface:false,humanTranslation:'en-ja-local-v1',translationPrivacy:'recipient-device-after-decryption',scrollOwnership:'mobile-flex-thread-log',mobileChatViewport:'visualViewport-v1.0.1-long-thread-fit',threadUi:'saved-chat-v354-lazy-on-open',threadUiRequested:()=>threadUiRequested,activateThreadUI,preloadedDependencyReadyCheck:true,streamThinking:'v249-local-authority-token-bridge',navigationLifecycle:'v424',surfaceMode:'bubble-only',launcherOwner:'guide-chat-surface-v350',avatarRuntime:'v346-visible',chatArchitecture:'one-core-five-themes-five-memory-folders',chatRuntime:'/app/unified-chat-system-v1.js',chatRuntimeVersion:'v1.0.4-learning-journey',capabilityPassover:'guide-capability-passover-v1.1.3-canonical-prompt',canonicalPromptBeforeMiniLM:true,artifactLanguage:'Weaveling=Quest; Moss=Learning Journey; Kamiya=Endeavor; Rook=Manifest',artifactLanguageContract:'/config/guide-artifact-language-v1.json',passoverResubmitsOriginal:true,standardAIOnly:true,localModelStartup:'request-driven-runtime-only',install});
})();