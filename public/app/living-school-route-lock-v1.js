(()=>{
'use strict';
const VERSION='1.0.0-living-school-route-lock-v1';
const ID='living-school-route-lock-v1';
const LIVE_RESEARCH='living-school-live-source-research-v260';
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
const lower=value=>clean(value,220).toLowerCase();
function isLivingSchoolPurpose(request={}){return /^living-school-/.test(lower(request?.purpose))}
function install(){
  const spine=globalThis.CivweaveFastInteractiveV192;
  if(!spine?.register)return false;
  spine.unregister?.(ID);
  spine.register(ID,{
    before(request){
      const purpose=lower(request?.purpose);
      if(!isLivingSchoolPurpose(request)||purpose===LIVE_RESEARCH)return request;
      return{
        ...request,
        taskTier:'small',
        executionProfile:'interactive',
        context:{...(request?.context||{}),livingSchoolRouteLock:VERSION,internalGeneration:true}
      };
    }
  },260);
  try{dispatchEvent(new CustomEvent('civweave:living-school-route-lock-ready',{detail:{version:VERSION,priority:260,liveResearchException:LIVE_RESEARCH,at:new Date().toISOString()}}))}catch{}
  return true;
}
function schedule(){queueMicrotask(install);setTimeout(install,0);setTimeout(install,120)}
for(const event of ['civweave:runtime-spine-ready','civweave:gemini-task-router-ready','civweave:assistant-runtime-ready','pageshow'])addEventListener?.(event,schedule);
install();
globalThis.CivweaveLivingSchoolRouteLockV1=Object.freeze({version:VERSION,install,priority:260,liveResearchException:LIVE_RESEARCH});
})();