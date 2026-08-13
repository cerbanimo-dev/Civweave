(()=>{
'use strict';
const VERSION='1.0.128-settings-parity-v317-retired-input';
if(globalThis.CivweaveSettingsParityV295?.version===VERSION)return;
function open(launcher){return globalThis.CivweaveSettingsGatewayV317?.open?.(launcher)||Promise.resolve(null)}
function scheduleManagement(layer){return Boolean(globalThis.CivweaveSettingsGatewayV317?.ensureManagement?.(layer))}
globalThis.CivweaveSettingsParityV295=Object.freeze({version:VERSION,retiredInputOwner:true,capturePhase:'none',canonicalCaptureDelegated:true,inputOwnership:false,settingsIndependentOfChat:true,inferenceDormantOnOpen:true,open,scheduleManagement,reason:'Compatibility facade only. Settings input and lazy loading belong to settings-gateway-v317.'});
})();
