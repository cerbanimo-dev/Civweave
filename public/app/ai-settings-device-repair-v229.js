(()=>{
'use strict';
const VERSION='229.2-retired-settings-v320';
if(globalThis.CivweaveAISettingsRepairV229?.version===VERSION)return;
function migrateOnDemand(){return false}
globalThis.CivweaveAISettingsRepairV229=Object.freeze({version:VERSION,retired:true,compatibilityFacade:true,canonical:'CivweaveSettingsV320',inputOwnership:false,presentationOwnership:false,credentialOwnership:false,startupWork:false,automaticListeners:false,migrateOnDemand,reason:'Credential persistence is owned by CivweaveSettingsV320; this retired repair module performs no automatic work.'});
})();
