(()=>{
'use strict';
const VERSION='1.0.7-unified-settings-compat-v188';
if(globalThis.CommonweaveUnifiedAISettingsCompatV188?.version===VERSION)return;
function controller(){return globalThis.CommonweaveAISettingsCleanroomV188||globalThis.CommonweaveModelSettingsControllerV173||null;}
const api=Object.freeze({
  version:VERSION,
  retiredRuntime:true,
  authority:'ai-settings-cleanroom-v188',
  providerRuntimeOnOpen:false,
  legacySettingsCapture:false,
  open(launcher){return controller()?.open?.(launcher)||null;},
  close(reason){return controller()?.close?.(reason)||false;},
  ensure(){return controller()?.ensure?.()||Promise.resolve(false);},
  readState(){return controller()?.readState?.()||{route:'deterministic',provider:'deterministic'};},
  renderInline(target){return controller()?.renderInline?.(target)||null;},
});
globalThis.CommonweaveUnifiedAISettingsCompatV188=api;
if(!globalThis.CommonweaveUnifiedAISettingsV175)globalThis.CommonweaveUnifiedAISettingsV175=api;
})();
