(()=>{
'use strict';
const VERSION='229.1-retired-settings-gateway-v317';
if(globalThis.CivweaveAISettingsRepairV229?.version===VERSION)return;
function migrateOnDemand(){return false}
globalThis.CivweaveAISettingsRepairV229=Object.freeze({version:VERSION,retired:true,inputOwnership:false,startupWork:false,automaticListeners:false,migrateOnDemand,reason:'Credential persistence is owned by the canonical Settings controller and invoked only after Settings is opened.'});
})();
