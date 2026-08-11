(()=>{
'use strict';

const VERSION='1.0.4';
const REVISION='experience-orchestrator-v298-mobile-chat-queue';
const DEFAULT_TTL_MS=18000;
const PROTECTED_ROUTE_RE=/(?:^|\/)(?:checkout|payment|billing|auth|login|sign[-_]?in|sign[-_]?up|submit|confirmation?|destructive|recovery|error)(?:\/|$)/i;
const SETTINGS_MODULE=['/app/settings-parity-v295.js',()=>globalThis.CivweaveSettingsParityV295?.version==='1.0.99-settings-parity-v296'];
const CHAT_MODULES=[
 ['/app/chat-fullscreen-v295.js',()=>globalThis.CivweaveChatFullscreenV295?.version==='1.0.105-chat-fullscreen-v298'],
 ['/app/saved-chat-store-v295.js',()=>globalThis.CivweaveSavedChatStoreV295?.version==='1.0.97-saved-chat-store-v295'],
 ['/app/saved-chat-ui-v295.js',()=>globalThis.CivweaveSavedChatUIV295?.version==='1.0.97-saved-chat-ui-v295'],
 ['/app/local-chat-runtime-v295.js',()=>globalThis.CivweaveLocalChatRuntimeV295?.version==='1.0.104-local-chat-runtime-v297'],
 ['/app/local-chat-owner-v295.js',()=>globalThis.CivweaveLocalChatOwnerV295?.version==='1.0.105-local-chat-owner-v298']
];
const SETTINGS_SELECTOR='[data-action="settings"],[data-settings],#lite-settings,[data-open-unified-ai-settings],#aiSettings,#modelSettings,#btnAISettings,[data-ai-settings],[data-ls-action="open-ai-settings"],#settings-button,#model-chip';
const LOCAL_SELECTION_KEY='civweave.local-ai.selection.v266';
const LEGACY_BYPASS='civweaveSettingsLegacyBypass';
let activeSlot=null,tokenCounter=0,launchPromise=null,settingsPromise=null,chatPromise=null;

function now(){return Date.now()}
function routeText(value){return String(value||`${location.pathname}${location.search}`).slice(0,1800)}
function markedProtected(){const root=document.documentElement,body=document.body;if(root?.dataset?.protectedFlow==='true'||body?.dataset?.protectedFlow==='true')return true;return Boolean(document.querySelector?.('[data-protected-flow="true"],[data-critical-flow="true"],[data-destructive-confirmation="true"]'))}
function protectedFlow(context={}){if(context.userInteractionState?.critical===true||context.protectedFlow===true)return true;return PROTECTED_ROUTE_RE.test(routeText(context.route))||markedProtected()}
function clearExpired(){if(activeSlot&&activeSlot.expiresAt<=now())activeSlot=null}
function emit(type,detail={}){const event={type,source:'experience-orchestrator',timestamp:new Date().toISOString(),...detail};globalThis.dispatchEvent?.(new CustomEvent('civweave:experience-orchestrator',{detail:event}));return event}
function claim(experienceId,options={}){const id=String(experienceId||'').trim();if(!id)return Object.freeze({ok:false,reason:'missing_experience_id'});if(protectedFlow(options.context||{}))return Object.freeze({ok:false,reason:'protected_flow'});clearExpired();if(activeSlot&&activeSlot.experienceId!==id)return Object.freeze({ok:false,reason:'another_experience_active',activeExperience:activeSlot.experienceId});const token=`${id}:${++tokenCounter}:${now().toString(36)}`;activeSlot={experienceId:id,token,priority:Number(options.priority||0),expiresAt:now()+Math.max(1000,Number(options.ttlMs||DEFAULT_TTL_MS))};emit('EXPERIENCE_SLOT_CLAIMED',{experienceId:id,token,priority:activeSlot.priority});return Object.freeze({ok:true,token,experienceId:id})}
function release(tokenOrExperienceId){clearExpired();if(!activeSlot)return false;const value=String(tokenOrExperienceId||'');if(value!==activeSlot.token&&value!==activeSlot.experienceId)return false;const released=activeSlot;activeSlot=null;emit('EXPERIENCE_SLOT_RELEASED',{experienceId:released.experienceId});return true}
function status(){clearExpired();return Object.freeze({version:VERSION,revision:REVISION,active:activeSlot?{...activeSlot}:null,protectedFlow:protectedFlow(),settingsReady:Boolean(globalThis.CivweaveSettingsParityV295),chatReady:Boolean(globalThis.CivweaveLocalChatOwnerV295),launchReady:Boolean(globalThis.CivweaveLocalChatOwnerV295&&globalThis.CivweaveSettingsParityV295)})}

function appendScript(src,ready,kind){return new Promise((resolve,reject)=>{const s=document.createElement('script'),joiner=src.includes('?')?'&':'?';s.src=`${src}${joiner}v=1.0.105-v298`;s.async=false;s.dataset.civweaveLaunch=kind;const path=new URL(src,location.href).pathname,timer=setTimeout(()=>reject(new Error(`${path} did not become ready.`)),8000);s.onload=()=>{clearTimeout(timer);ready?.()?resolve(true):reject(new Error(`${path} loaded without becoming ready.`))};s.onerror=()=>{clearTimeout(timer);reject(new Error(`Could not load ${path}.`))};document.head.append(s)})}
function loadOne(src,ready,kind='v298'){if(ready?.())return Promise.resolve(true);return appendScript(src,ready,kind)}
function ensureSettingsModule(){if(globalThis.CivweaveSettingsParityV295?.version==='1.0.99-settings-parity-v296')return Promise.resolve(true);if(settingsPromise)return settingsPromise;const [src,ready]=SETTINGS_MODULE;settingsPromise=loadOne(src,ready,'v298-settings').then(()=>{emit('SETTINGS_READINESS_READY',{revision:'v298',independentOfChat:true});return true}).catch(error=>{settingsPromise=null;emit('SETTINGS_READINESS_FAILED',{revision:'v298',message:String(error?.message||error)});return false});return settingsPromise}
function ensureChatModules(){if(CHAT_MODULES.every(([,ready])=>ready?.()))return Promise.resolve(true);if(chatPromise)return chatPromise;chatPromise=(async()=>{for(const [src,ready] of CHAT_MODULES)await loadOne(src,ready,'v298-chat');emit('CHAT_READINESS_READY',{revision:'v298',fiveChats:true,savedTabs:true,localFastPath:true,androidKeyboardFix:true,localStageWatchdog:true,localFifoQueue:true,structuralComposerRepair:true});return true})().catch(error=>{chatPromise=null;emit('CHAT_READINESS_FAILED',{revision:'v298',message:String(error?.message||error)});return false});return chatPromise}
function ensureLaunchModules(){if(launchPromise)return launchPromise;launchPromise=Promise.all([ensureSettingsModule(),ensureChatModules()]).then(([settings,chat])=>{const ok=Boolean(settings&&chat);emit(ok?'LAUNCH_READINESS_READY':'LAUNCH_READINESS_PARTIAL',{revision:'v298',settings,chat});if(!ok)launchPromise=null;return ok});return launchPromise}
function localSelected(){try{const v=globalThis.CivweaveLocalModelDownloadV266?.selection?.()||JSON.parse(localStorage.getItem(LOCAL_SELECTION_KEY)||'{}');return Boolean(v?.active&&v?.id)}catch{return false}}
function activeSystem(){const s=globalThis.CivweavePersistentGuideChatV215?.activeWindow?.()||globalThis.CivweaveGuideWorkspaceV242?.state?.().activeWindow||document.documentElement.dataset.civweaveSystemRoute;return['civweave','living-school','cerbanimo','fellowfare','anarchadia'].includes(s)?s:'civweave'}
function legacyBypass(target){return target?.dataset?.[LEGACY_BYPASS]==='1'}
function releaseLegacySettingsClick(target){if(!target?.click)return false;target.dataset[LEGACY_BYPASS]='1';try{target.click()}catch{}queueMicrotask(()=>{try{delete target.dataset[LEGACY_BYPASS]}catch{}});return true}
async function openSettingsIndependent(target){const settingsReady=await ensureSettingsModule();if(settingsReady){try{const layer=await globalThis.CivweaveSettingsParityV295?.open?.(target);if(layer)return true}catch{}}const controller=globalThis.CivweaveAISettingsCleanroomV188||globalThis.CivweaveModelSettingsControllerV173||globalThis.CivweaveUnifiedAISettingsV175;try{return Boolean(controller?.open?.(target))}catch{return false}}
function earlyLocalSubmit(event){
 const form=event.target instanceof HTMLFormElement?event.target:null;if(!form?.matches?.('#cw-persistent-guide-chat-v215 [data-persistent-form]')||!localSelected())return;
 const input=form.querySelector('textarea,input[type="text"]'),text=String(input?.value||'').trim();if(!text)return;
 const system=activeSystem();event.preventDefault();event.stopImmediatePropagation();if(input)input.value='';form.dataset.civweaveLocalQueue='pending';
 void ensureChatModules().then(ready=>{const accepted=Boolean(ready&&globalThis.CivweaveLocalChatOwnerV295?.enqueue?.(system,text,form));form.dataset.civweaveLocalQueue=accepted?'queued':'failed';if(!accepted&&input&&!input.value)input.value=text;return accepted})
}
function earlySettings(event){const target=event.target instanceof Element?event.target.closest(SETTINGS_SELECTOR):null;if(!target||target.closest('#cw-ai-settings-cleanroom-v188')||legacyBypass(target))return;event.preventDefault();event.stopImmediatePropagation();void openSettingsIndependent(target).then(opened=>{if(!opened)releaseLegacySettingsClick(target)})}

globalThis.addEventListener('submit',earlyLocalSubmit,true);
document.addEventListener('click',earlySettings,true);
queueMicrotask(()=>{void ensureSettingsModule();void ensureChatModules()});

const api=Object.freeze({version:VERSION,revision:REVISION,claim,release,status,protectedFlow,ensureSettingsModule,ensureChatModules,ensureLaunchModules,openSettingsIndependent,launchReadiness:'v298-fullscreen-composer-local-fifo'});
globalThis.CivweaveExperienceOrchestratorV232=api;
globalThis.dispatchEvent?.(new CustomEvent('civweave:experience-orchestrator-ready',{detail:{version:VERSION,revision:REVISION}}));
})();
