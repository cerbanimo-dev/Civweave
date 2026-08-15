(()=>{
'use strict';
const VERSION='1.0.31-visual-model-settings-v132-compat-v320';
if(globalThis.CivweaveVisualModelSettings?.version===VERSION)return;
const api=Object.freeze({version:VERSION,compatibilityFacade:true,canonical:'CivweaveSettingsV320',authority:'settings-v320',inputOwnership:false,presentationOwnership:false,domCreation:false,documentClickListeners:0,open(launcher){return globalThis.CivweaveSettingsV320?.open?.(launcher)||null},close(reason){return globalThis.CivweaveSettingsV320?.close?.(reason)||false},readState(){return globalThis.CivweaveSettingsV320?.readState?.()||{route:'deterministic',provider:'deterministic'}}});
globalThis.CivweaveVisualModelSettings=api;
})();
