(()=>{
'use strict';
const VERSION='188.2-retired-settings-v320';
const REVISION='320.0-single-settings-owner';
if(globalThis.CivweaveSettingsDelegationV188?.version===VERSION)return;
function open(launcher){return globalThis.CivweaveSettingsV320?.open?.(launcher)||null}
globalThis.CivweaveSettingsDelegationV188=Object.freeze({version:VERSION,revision:REVISION,retired:true,compatibilityFacade:true,canonical:'CivweaveSettingsV320',listenerCount:0,inputOwnership:false,presentationOwnership:false,credentialOwnership:false,mutationObserver:false,polling:false,timers:false,open});
})();
