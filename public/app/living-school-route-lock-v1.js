(()=>{
'use strict';
const VERSION='1.3.0-living-school-route-lock-v1-single-strong-session';
const ID='living-school-route-lock-v1';
const LIVE_RESEARCH='living-school-live-source-research-v260';
const DESIGN='living-school-research-grounded-curriculum-v218.1';
const PRIORITY=100;
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
const lower=value=>clean(value,220).toLowerCase();
function isLivingSchoolPurpose(request={}){return /^living-school-/.test(lower(request?.purpose))}
function generationActive(){
  if(typeof document==='undefined')return false;
  const root=document.documentElement,button=document.querySelector('[data-ls-action="generate-curriculum"]');
  const label=clean(button?.textContent,240).toLowerCase();
  return root?.dataset?.livingSchoolGenerationActive==='true'||root?.dataset?.livingSchoolRunRailActive==='true'||button?.getAttribute?.('aria-busy')==='true'||Boolean(button?.disabled&&/researching|generating|regenerating|completing/.test(label));
}
function isDesignPass(request={}){
  const purpose=lower(request?.purpose),original=lower(request?.context?.livingSchoolOriginalPurpose);
  return purpose===DESIGN||original===DESIGN;
}
function route(request={}){
  const purpose=lower(request?.purpose),active=generationActive(),living=isLivingSchoolPurpose(request),design=isDesignPass(request);
  if(!active&&!living)return request;
  if(!active&&purpose===LIVE_RESEARCH)return request;
  if(active&&purpose===LIVE_RESEARCH)return request;
  const strong=design;
  return{
    ...request,
    taskTier:strong?'complex':'small',
    executionProfile:'interactive',
    context:{
      ...(request?.context||{}),
      livingSchoolRouteLock:VERSION,
      livingSchoolGenerationSession:active,
      internalGeneration:!strong,
      livingSchoolDesignHandoff:strong?'single-strong-interactive-design-pass':'lite-or-local-followup'
    }
  };
}
function install(){
  const spine=globalThis.CivweaveFastInteractiveV192;
  if(!spine?.register)return false;
  spine.unregister?.(ID);
  spine.register(ID,{before:route},PRIORITY);
  try{dispatchEvent(new CustomEvent('civweave:living-school-route-lock-ready',{detail:{version:VERSION,priority:PRIORITY,liveResearchException:LIVE_RESEARCH,strongDesignPurpose:DESIGN,strongDesignProfile:'interactive',sessionWideFollowupDowngrade:true,at:new Date().toISOString()}}))}catch{}
  return true;
}
function schedule(){queueMicrotask(install);setTimeout(install,0);setTimeout(install,120)}
for(const event of ['civweave:runtime-spine-ready','civweave:gemini-task-router-ready','civweave:assistant-runtime-ready','civweave:living-school-grounded-design-ready','pageshow'])addEventListener?.(event,schedule);
install();
globalThis.CivweaveLivingSchoolRouteLockV1=Object.freeze({version:VERSION,install,route,priority:PRIORITY,liveResearchException:LIVE_RESEARCH,strongDesignPurpose:DESIGN,strongDesignProfile:'interactive',generationActive});
})();