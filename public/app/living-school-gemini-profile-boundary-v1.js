(()=>{
'use strict';
const VERSION='1.0.0-living-school-gemini-profile-boundary-v1';
const ID='living-school-gemini-profile-boundary-v1';
const DESIGN='living-school-research-grounded-curriculum-v218.1';
const COMPLEX_MODEL='gemini-3.7-flash';
const clean=(value,max=400)=>String(value??'').trim().slice(0,max);
const lower=value=>clean(value,220).toLowerCase();
function enforce(request={}){
  if(lower(request?.purpose)!==DESIGN)return request;
  const config={...(request.config||{})},provider=lower(config.provider||config.route||config.engine);
  return{...request,taskTier:'complex',executionProfile:'interactive',config:provider==='gemini'?{...config,provider:'gemini',route:'gemini',model:COMPLEX_MODEL}:config,context:{...(request.context||{}),livingSchoolGeminiProfileBoundary:VERSION,singleStrongDesignProfile:'interactive'}};
}
function install(){
  const spine=globalThis.CivweaveFastInteractiveV192;if(!spine?.register)return false;
  spine.unregister?.(ID);spine.register(ID,{before:enforce},30);
  try{dispatchEvent(new CustomEvent('civweave:living-school-gemini-profile-boundary-ready',{detail:{version:VERSION,purpose:DESIGN,model:COMPLEX_MODEL,profile:'interactive',priority:30,at:new Date().toISOString()}}))}catch{}
  return true;
}
function schedule(){queueMicrotask(install);setTimeout(install,0)}
for(const event of ['civweave:runtime-spine-ready','civweave:gemini-task-router-ready','pageshow'])addEventListener?.(event,schedule);
install();
globalThis.CivweaveLivingSchoolGeminiProfileBoundaryV1=Object.freeze({version:VERSION,install,enforce,purpose:DESIGN,model:COMPLEX_MODEL,profile:'interactive'});
})();