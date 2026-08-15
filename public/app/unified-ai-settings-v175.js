(()=>{
'use strict';
const VERSION='1.0.8-unified-settings-compat-v320';
if(globalThis.CivweaveUnifiedAISettingsCompatV320?.version===VERSION)return;
const canonical=()=>globalThis.CivweaveSettingsV320||null;
const api=Object.freeze({version:VERSION,compatibilityFacade:true,retiredRuntime:true,canonical:'CivweaveSettingsV320',authority:'settings-v320',inputOwnership:false,presentationOwnership:false,domCreation:false,open(launcher){return canonical()?.open?.(launcher)||null},close(reason){return canonical()?.close?.(reason)||false},ensure(){return canonical()?.ensure?.()||Promise.resolve(false)},readState(){return canonical()?.readState?.()||{route:'deterministic',provider:'deterministic'}}});
globalThis.CivweaveUnifiedAISettingsCompatV320=api;
})();
