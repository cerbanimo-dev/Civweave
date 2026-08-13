(()=>{
'use strict';
const VERSION='188.1-retired-settings-gateway-v317';
const REVISION='317.0-single-settings-gateway';
if(globalThis.CivweaveSettingsDelegationV188?.version===VERSION)return;
function open(launcher){return globalThis.CivweaveSettingsGatewayV317?.open?.(launcher)||Promise.resolve(null)}
globalThis.CivweaveSettingsDelegationV188=Object.freeze({version:VERSION,revision:REVISION,retired:true,listenerCount:0,inputOwnership:false,mutationObserver:false,polling:false,timers:false,open});
})();
