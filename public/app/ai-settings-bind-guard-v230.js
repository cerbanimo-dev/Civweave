(()=>{
'use strict';
const VERSION='230.1-retired-settings-gateway-v317';
if(globalThis.CivweaveAISettingsBindGuardV230?.version===VERSION)return;
function install(){return true}
globalThis.CivweaveAISettingsBindGuardV230=Object.freeze({version:VERSION,install,retired:true,prototypePatching:false,inputOwnership:false,reason:'The controller close lookup is fixed at source. Settings input belongs only to settings-gateway-v317.'});
})();
