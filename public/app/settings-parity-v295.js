(()=>{
'use strict';
const VERSION='1.0.129-settings-parity-v320-compat';
if(globalThis.CivweaveSettingsParityV295?.version===VERSION)return;
function open(launcher){return globalThis.CivweaveSettingsV320?.open?.(launcher)||null}
function scheduleManagement(layer){return Boolean(globalThis.CivweaveSettingsV320?.ensureManagement?.(layer))}
globalThis.CivweaveSettingsParityV295=Object.freeze({version:VERSION,compatibilityFacade:true,canonical:'CivweaveSettingsV320',retiredInputOwner:true,capturePhase:'none',inputOwnership:false,presentationOwnership:false,credentialOwnership:false,domCreation:false,settingsIndependentOfChat:true,inferenceDormantOnOpen:true,open,scheduleManagement,reason:'Compatibility facade only. Settings input, presentation, credentials, and section layout belong to CivweaveSettingsV320.'});
})();
