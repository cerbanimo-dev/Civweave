(()=>{
'use strict';
const VERSION='230.2-retired-settings-v320';
if(globalThis.CivweaveAISettingsBindGuardV230?.version===VERSION)return;
function install(){return true}
globalThis.CivweaveAISettingsBindGuardV230=Object.freeze({version:VERSION,install,retired:true,compatibilityFacade:true,canonical:'CivweaveSettingsV320',prototypePatching:false,inputOwnership:false,presentationOwnership:false,reason:'No repair binding is needed. Settings input and presentation belong only to CivweaveSettingsV320.'});
})();
