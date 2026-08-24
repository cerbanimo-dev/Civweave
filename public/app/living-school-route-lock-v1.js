(()=>{
'use strict';
const VERSION='1.2.0-living-school-route-lock-v1-interactive-design';
const ID='living-school-route-lock-v1';
const LIVE_RESEARCH='living-school-live-source-research-v260';
const DESIGN='living-school-research-grounded-curriculum-v218.1';
const GROUNDED_DESIGN='living-school-grounded-design-lite-v337';
const PRIORITY=100;
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
const lower=value=>clean(value,220).toLowerCase();
function isLivingSchoolPurpose(request={}){return /^living-school-/.test(lower(request?.purpose))}
function isDesignPass(request={}){
  const purpose=lower(request?.purpose),original=lower(request?.context?.livingSchoolOriginalPurpose);
  return purpose===DESIGN||purpose===GROUNDED_DESIGN||original===DESIGN||request?.context?.livingSchoolGroundedDesign===true;
}
function install(){
  const spine=globalThis.CivweaveFastInteractiveV192;
  if(!spine?.register)return false;
  spine.unregister?.(ID);
  spine.register(ID,{
    before(request){
      const purpose=lower(request?.purpose);
      if(!isLivingSchoolPurpose(request)||purpose===LIVE_RESEARCH)return request;
      const design=isDesignPass(request);
      return{
        ...request,
        taskTier:design?'complex':'small',
        executionProfile:'interactive',
        context:{...(request?.context||{}),livingSchoolRouteLock:VERSION,internalGeneration:!design,livingSchoolDesignHandoff:design?'strong-interactive-design-pass':'lightweight-followup'}
      };
    }
  },PRIORITY);
  try{dispatchEvent(new CustomEvent('civweave:living-school-route-lock-ready',{detail:{version:VERSION,priority:PRIORITY,liveResearchException:LIVE_RESEARCH,strongDesignPurpose:DESIGN,groundedDesignPurpose:GROUNDED_DESIGN,strongDesignProfile:'interactive',at:new Date().toISOString()}}))}catch{}
  return true;
}
function schedule(){queueMicrotask(install);setTimeout(install,0);setTimeout(install,120)}
for(const event of ['civweave:runtime-spine-ready','civweave:gemini-task-router-ready','civweave:assistant-runtime-ready','civweave:living-school-grounded-design-ready','pageshow'])addEventListener?.(event,schedule);
install();
globalThis.CivweaveLivingSchoolRouteLockV1=Object.freeze({version:VERSION,install,priority:PRIORITY,liveResearchException:LIVE_RESEARCH,strongDesignPurpose:DESIGN,groundedDesignPurpose:GROUNDED_DESIGN,strongDesignProfile:'interactive'});
})();