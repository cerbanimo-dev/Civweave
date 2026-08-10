(()=>{
'use strict';

const VERSION='1.0.1';
const REVISION='experience-orchestrator-v295-launch-readiness';
const DEFAULT_TTL_MS=18000;
const PROTECTED_ROUTE_RE=/(?:^|\/)(?:checkout|payment|billing|auth|login|sign[-_]?in|sign[-_]?up|submit|confirmation?|destructive|recovery|error)(?:\/|$)/i;
const LAUNCH_MODULES=[
 ['/app/settings-parity-v295.js',()=>globalThis.CivweaveSettingsParityV295?.version==='1.0.97-settings-parity-v295'],
 ['/app/chat-fullscreen-v295.js',()=>globalThis.CivweaveChatFullscreenV295?.version==='1.0.97-chat-fullscreen-v295'],
 ['/app/saved-chat-store-v295.js',()=>globalThis.CivweaveSavedChatStoreV295?.version==='1.0.97-saved-chat-store-v295'],
 ['/app/saved-chat-ui-v295.js',()=>globalThis.CivweaveSavedChatUIV295?.version==='1.0.97-saved-chat-ui-v295'],
 ['/app/local-chat-runtime-v295.js',()=>globalThis.CivweaveLocalChatRuntimeV295?.version==='1.0.97-local-chat-runtime-v295'],
 ['/app/local-chat-owner-v295.js',()=>globalThis.CivweaveLocalChatOwnerV295?.version==='1.0.97-local-chat-owner-v295']
];
const SETTINGS_SELECTOR='[data-action="settings"],[data-settings],#lite-settings,[data-open-unified-ai-settings],#aiSettings,#modelSettings,#btnAISettings,[data-ai-settings],[data-ls-action="open-ai-settings"],#settings-button,#model-chip';
const LOCAL_SELECTION_KEY='civweave.local-ai.selection.v266';
let activeSlot=null,tokenCounter=0,launchPromise=null;

function now(){return Date.now()}
function routeText(value){return String(value||`${location.pathname}${location.search}`).slice(0,1800)}
function markedProtected(){const root=document.documentElement,body=document.body;if(root?.dataset?.protectedFlow==='true'||body?.dataset?.protectedFlow==='true')return true;return Boolean(document.querySelector?.('[data-protected-flow="true"],[data-critical-flow="true"],[data-destructive-confirmation="true"]'))}
function protectedFlow(context={}){if(context.userInteractionState?.critical===true||context.protectedFlow===true)return true;return PROTECTED_ROUTE_RE.test(routeText(context.route))||markedProtected()}
function clearExpired(){if(activeSlot&&activeSlot.expiresAt<=now())activeSlot=null}
function emit(type,detail={}){const event={type,source:'experience-orchestrator',timestamp:new Date().toISOString(),...detail};globalThis.dispatchEvent?.(new CustomEvent('civweave:experience-orchestrator',{detail:event}));return event}
function claim(experienceId,options={}){const id=String(experienceId||'').trim();if(!id)return Object.freeze({ok:false,reason:'missing_experience_id'});if(protectedFlow(options.context||{}))return Object.freeze({ok:false,reason:'protected_flow'});clearExpired();if(activeSlot&&activeSlot.experienceId!==id)return Object.freeze({ok:false,reason:'another_experience_active',activeExperience:activeSlot.experienceId});const token=`${id}:${++tokenCounter}:${now().toString(36)}`;activeSlot={experienceId:id,token,priority:Number(options.priority||0),expiresAt:now()+Math.max(1000,Number(options.ttlMs||DEFAULT_TTL_MS))};emit('EXPERIENCE_SLOT_CLAIMED',{experienceId:id,token,priority:activeSlot.priority});return Object.freeze({ok:true,token,experienceId:id})}
function release(tokenOrExperienceId){clearExpired();if(!activeSlot)return false;const value=String(tokenOrExperienceId||'');if(value!==activeSlot.token&&value!==activeSlot.experienceId)return false;const released=activeSlot;activeSlot=null;emit('EXPERIENCE_SLOT_RELEASED',{experienceId:released.experienceId});return true}
function status(){clearExpired();return Object.freeze({version:VERSION,revision:REVISION,active:activeSlot?{...activeSlot}:null,protectedFlow:protectedFlow(),launchReady:Boolean(globalThis.CivweaveLocalChatOwnerV295&&globalThis.CivweaveSettingsParityV295)})}

function loadOne(src,ready){
 if(ready?.())return Promise.resolve(true);
 const path=new URL(src,location.href).pathname,old=[...document.scripts].find(s=>s.src&&new URL(s.src,location.href).pathname===path);
 if(old)return new Promise((resolve,reject)=>{const done=()=>ready?.()?resolve(true):reject(new Error(`${path} loaded without becoming ready.`));old.addEventListener('load',done,{once:true});old.addEventListener('error',()=>reject(new Error(`Could not load ${path}.`)),{once:true});queueMicrotask(()=>{if(ready?.())resolve(true)})});
 return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=`${src}?v=1.0.97-v295`;s.async=false;s.dataset.civweaveLaunch='v295';s.onload=()=>ready?.()?resolve(true):reject(new Error(`${path} loaded without becoming ready.`));s.onerror=()=>reject(new Error(`Could not load ${path}.`));document.head.append(s)});
}
function ensureLaunchModules(){
 if(launchPromise)return launchPromise;
 launchPromise=(async()=>{for(const [src,ready] of LAUNCH_MODULES)await loadOne(src,ready);emit('LAUNCH_READINESS_READY',{revision:'v295',fiveChats:true,savedTabs:true,settingsParity:true,localFastPath:true});return true})().catch(error=>{launchPromise=null;emit('LAUNCH_READINESS_FAILED',{revision:'v295',message:String(error?.message||error)});return false});
 return launchPromise;
}
function localSelected(){try{const v=globalThis.CivweaveLocalModelDownloadV266?.selection?.()||JSON.parse(localStorage.getItem(LOCAL_SELECTION_KEY)||'{}');return Boolean(v?.active&&v?.id)}catch{return false}}
function activeSystem(){const s=globalThis.CivweavePersistentGuideChatV215?.activeWindow?.()||globalThis.CivweaveGuideWorkspaceV242?.state?.().activeWindow||document.documentElement.dataset.civweaveSystemRoute;return['civweave','living-school','cerbanimo','fellowfare','anarchadia'].includes(s)?s:'civweave'}
function earlySubmit(event){
 const form=event.target instanceof HTMLFormElement?event.target:null;if(!form?.matches?.('#cw-persistent-guide-chat-v215 [data-persistent-form]')||!localSelected())return;
 const input=form.querySelector('textarea,input[type="text"]'),text=String(input?.value||'').trim();if(!text)return;
 event.preventDefault();event.stopImmediatePropagation();
 void ensureLaunchModules().then(()=>globalThis.CivweaveLocalChatOwnerV295?.submit?.(activeSystem(),text,form));
}
function earlySettings(event){
 const target=event.target instanceof Element?event.target.closest(SETTINGS_SELECTOR):null;if(!target||target.closest('#cw-ai-settings-cleanroom-v188'))return;
 event.preventDefault();event.stopImmediatePropagation();
 void ensureLaunchModules().then(()=>globalThis.CivweaveSettingsParityV295?.open?.(target));
}

document.addEventListener('submit',earlySubmit,true);
document.addEventListener('click',earlySettings,true);
queueMicrotask(ensureLaunchModules);

const api=Object.freeze({version:VERSION,revision:REVISION,claim,release,status,protectedFlow,ensureLaunchModules,launchReadiness:'v295-five-chat-settings-local'});
globalThis.CivweaveExperienceOrchestratorV232=api;
globalThis.dispatchEvent?.(new CustomEvent('civweave:experience-orchestrator-ready',{detail:{version:VERSION,revision:REVISION}}));
})();