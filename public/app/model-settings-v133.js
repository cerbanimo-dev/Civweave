(()=>{
'use strict';
const VERSION='1.0.31-model-settings-v133-compat-v320';
if(globalThis.CivweaveModelSettingsV133?.version===VERSION)return;
const canonical=()=>globalThis.CivweaveSettingsV320||null;
const api=Object.freeze({version:VERSION,compatibilityFacade:true,canonical:'CivweaveSettingsV320',authority:'settings-v320',inputOwnership:false,presentationOwnership:false,credentialOwnership:false,domCreation:false,documentClickListeners:0,open(launcher){return canonical()?.open?.(launcher)||null},close(reason){return canonical()?.close?.(reason)||false},ensure(){return canonical()?.ensure?.()||Promise.resolve(false)},readState(){return canonical()?.readState?.()||{route:'deterministic',provider:'deterministic'}},inlineMarkup(){return '<section class="cw-ai-inline-card"><h2>Compass settings</h2><p>AI, language, safety, and downloaded-model controls now live in the single shared Settings menu.</p><button type="button" data-open-unified-ai-settings>Open Settings</button></section>'}});
globalThis.CivweaveModelSettingsV133=api;
})();
