(()=>{
'use strict';
const VERSION='1.0.0-living-school-grounded-purpose-v332';
const ID='living-school-grounded-purpose-v332';
const DESIGN='living-school-research-grounded-curriculum-v218.1';
const GROUNDED='living-school-grounded-design-lite-v332';
const MODES=new Set(['live-agentic','local-synthesized','local-downloaded','manual-sources','model-derived-unverified']);
const clean=v=>String(v??'').trim().toLowerCase();
function install(){
  const spine=globalThis.CivweaveFastInteractiveV192;
  if(!spine?.register)return false;
  spine.unregister?.(ID);
  spine.register(ID,{before(request){
    if(clean(request?.purpose)!==DESIGN||!MODES.has(clean(request?.context?.research?.mode)))return request;
    return{...request,purpose:GROUNDED,taskTier:'small',executionProfile:'interactive',context:{...(request.context||{}),livingSchoolOriginalPurpose:DESIGN,livingSchoolGroundedDesign:true}};
  }},120);
  try{dispatchEvent(new CustomEvent('civweave:living-school-grounded-purpose-ready',{detail:{version:VERSION,purpose:GROUNDED,at:new Date().toISOString()}}))}catch{}
  return true;
}
for(const event of ['civweave:runtime-spine-ready','civweave:gemini-task-router-ready','civweave:living-school-runtime-route-ready'])addEventListener?.(event,()=>queueMicrotask(install));
install();
globalThis.CivweaveLivingSchoolGroundedPurposeV332=Object.freeze({version:VERSION,install,purpose:GROUNDED});
})();