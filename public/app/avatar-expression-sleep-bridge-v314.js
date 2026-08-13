(()=>{
'use strict';
const VERSION='1.0.0-avatar-expression-sleep-bridge-v314';
if(globalThis.CivweaveAvatarExpressionSleepBridgeV314?.version===VERSION)return;
const SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia'];
const ROOT_ID='cw-persistent-guide-chat-v215',SHARED_ROOT_ID='cw-shared-guide-surface-v236';
const failureLocks=new Map();let enforcing=false;
const clean=(value,max=160)=>String(value??'').trim().slice(0,max);
const safeSystem=value=>SYSTEMS.includes(String(value||''))?String(value):currentSystem();
function currentSystem(){const full=document.getElementById(ROOT_ID),shared=document.getElementById(SHARED_ROOT_ID);const value=full?.dataset?.guide||shared?.dataset?.system||full?.dataset?.pageSystem||document.documentElement?.dataset?.civweaveSystemRoute;return SYSTEMS.includes(value)?value:'civweave'}
function settings(){for(const controller of [globalThis.CivweaveAISettingsCleanroomV188,globalThis.CivweaveModelSettingsControllerV173,globalThis.CivweaveUnifiedAISettingsCompatV188,globalThis.CivweaveUnifiedAISettingsV175]){if(!controller?.readState)continue;try{const row=controller.readState();if(row)return row}catch{}}return null}
function deterministic(){const row=settings();if(row)return /deterministic/i.test(`${row.route||''} ${row.provider||''}`);return false}
function tinyAvailable(){try{return Boolean(globalThis.CivweaveAvatarExpressionDirectorV313?.status?.()?.tinyAvailable)}catch{return false}}
function reason(system){system=safeSystem(system);return failureLocks.get(system)?.reason||(deterministic()&&!tinyAvailable()?'deterministic-without-tinylm':'')}
function shouldSleep(system){return Boolean(reason(system))}
function publish(system,why=reason(system)){system=safeSystem(system);if(!why)return false;enforcing=true;try{dispatchEvent(new CustomEvent('civweave:avatar-expression',{detail:{version:VERSION,system,expression:'sleepy',source:'sleep-policy',sleepReason:why,updatedAt:Date.now()}}))}catch{}finally{queueMicrotask(()=>{enforcing=false})}return true}
function modelEvent(event){const detail=event?.detail||{},phase=clean(detail.phase||detail.status||'',80).toLowerCase(),system=safeSystem(detail.system||currentSystem());if(['failed','timeout','error','invalid-response'].includes(phase)){failureLocks.set(system,{reason:'model-failure',at:Date.now(),code:clean(detail.error?.code||detail.code)});publish(system,'model-failure');return}if(/^(partial|completed|generating|model-ready|started|token)$/.test(phase)||phase.includes('stream')){if(failureLocks.delete(system))queueMicrotask(()=>globalThis.CivweaveAvatarExpressionDirectorV313?.refresh?.())}}
function expressionEvent(event){if(enforcing)return;const detail=event?.detail||{},system=safeSystem(detail.system||currentSystem());if(shouldSleep(system)&&detail.expression!=='sleepy')queueMicrotask(()=>publish(system))}
function explicitFailure(event){const detail=event?.detail||{},system=safeSystem(detail.system||currentSystem());failureLocks.set(system,{reason:'model-failure',at:Date.now(),code:clean(detail.code)});publish(system,'model-failure')}
function sync(){for(const system of SYSTEMS)if(shouldSleep(system))publish(system);else if(!failureLocks.has(system))globalThis.CivweaveAvatarExpressionDirectorV313?.refresh?.();return status()}
function status(){return{version:VERSION,deterministic:deterministic(),tinyAvailable:tinyAvailable(),failures:Object.fromEntries(failureLocks),sleeping:Object.fromEntries(SYSTEMS.map(system=>[system,shouldSleep(system)]))}}
addEventListener('civweave:model-event',modelEvent);
['civweave:local-model-error','civweave:model-error','civweave:guide-model-error','civweave:chat-model-failed','civweave:local-chat-failure'].forEach(name=>addEventListener(name,explicitFailure));
addEventListener('civweave:avatar-expression',expressionEvent);
['civweave:model-settings-opened','civweave:model-settings-changed','civweave:ai-settings-changed','civweave:safe-mode-changed','civweave:local-model-downloaded','civweave:local-model-removed','civweave:avatar-expression-director-ready','civweave:shared-chat-face-icons-ready'].forEach(name=>addEventListener(name,()=>queueMicrotask(sync)));
queueMicrotask(sync);
globalThis.CivweaveAvatarExpressionSleepBridgeV314=Object.freeze({version:VERSION,shouldSleep,reason,sync,status,modelEvent,sleepOnModelFailure:true,sleepInDeterministicWithoutTinyLM:true});
})();
