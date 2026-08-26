(()=>{
'use strict';
const VERSION='1.7.0-living-school-route-lock-v1-provider-neutral';
const ID='living-school-route-lock-v1';
const POST_ID='living-school-route-lock-post-router-v1';
const LIVE_RESEARCH='living-school-live-source-research-v260';
const DESIGN='living-school-research-grounded-curriculum-v218.1';
// This must run before the generic MiniLM response router (priority 120).
// Living School owns its research, safety, pedagogy, and recovery contracts;
// provider/model selection remains owned by the shared runtime and provider routers.
const PRIORITY=300;
const POST_PRIORITY=30;
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
  const baseContext={...(request?.context||{}),livingSchoolRouteLock:VERSION,livingSchoolGenerationSession:active,responseReviewOwner:'living-school',responseRouterBypass:'internal-generation',providerSelectionOwner:'civweave-runtime'};
  if(purpose===LIVE_RESEARCH)return{...request,__civweaveSkipResponseRouter:true,context:{...baseContext,internalGeneration:true,livingSchoolDesignHandoff:'live-research'}};
  return{...request,__civweaveSkipResponseRouter:true,taskTier:design?'complex':'small',executionProfile:'interactive',context:{...baseContext,internalGeneration:!design,livingSchoolDesignHandoff:design?'single-strong-interactive-design-pass':'lite-or-local-followup'}};
}
function scrubLegacyEconomyBoundary(messages=[]){
  return(Array.isArray(messages)?messages:[]).filter(message=>{
    if(lower(message?.role)!=='system')return true;
    const content=String(message?.content||'');
    if(/Living School design boundary:/i.test(content)&&/Acorn pricing|Button labor values|XP amounts|ledger\/economy metadata/i.test(content))return false;
    return true;
  });
}
function postRouter(request={}){
  if(!isDesignPass(request))return request;
  return{...request,messages:scrubLegacyEconomyBoundary(request.messages),__civweaveSkipResponseRouter:true,taskTier:'complex',executionProfile:'interactive',context:{...(request.context||{}),livingSchoolPostRouterBoundary:VERSION,singleStrongDesignProfile:'interactive',responseReviewOwner:'living-school',responseRouterBypass:'internal-generation',legacyEconomyPromptScrubbed:true,providerSelectionOwner:'civweave-runtime'}};
}
function install(){
  const spine=globalThis.CivweaveFastInteractiveV192;if(!spine?.register)return false;
  spine.unregister?.(ID);spine.unregister?.(POST_ID);
  spine.register(ID,{before:route},PRIORITY);spine.register(POST_ID,{before:postRouter},POST_PRIORITY);
  try{dispatchEvent(new CustomEvent('civweave:living-school-route-lock-ready',{detail:{version:VERSION,priority:PRIORITY,postRouterPriority:POST_PRIORITY,liveResearchException:LIVE_RESEARCH,strongDesignPurpose:DESIGN,strongDesignModel:'runtime-selected',strongDesignProfile:'interactive',providerSelectionOwner:'civweave-runtime',providerNeutral:true,sessionWideFollowupDowngrade:true,responseRouterBypass:true,legacyEconomyPromptScrubbed:true,at:new Date().toISOString()}}))}catch{}
  return true;
}
function schedule(){queueMicrotask(install);setTimeout(install,0);setTimeout(install,120)}
for(const event of ['civweave:runtime-spine-ready','civweave:model-runtime-ready','civweave:assistant-runtime-ready','civweave:living-school-grounded-design-ready','pageshow'])addEventListener?.(event,schedule);
install();
globalThis.CivweaveLivingSchoolRouteLockV1=Object.freeze({version:VERSION,install,route,postRouter,priority:PRIORITY,postRouterPriority:POST_PRIORITY,liveResearchException:LIVE_RESEARCH,strongDesignPurpose:DESIGN,strongDesignModel:'runtime-selected',strongDesignProfile:'interactive',providerSelectionOwner:'civweave-runtime',providerNeutral:true,generationActive,responseRouterBypass:true,scrubLegacyEconomyBoundary});
})();
