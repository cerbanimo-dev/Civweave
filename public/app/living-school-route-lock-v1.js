(()=>{
'use strict';
const VERSION='1.6.0-living-school-route-lock-v1-prompt-scrub';
const ID='living-school-route-lock-v1';
const POST_ID='living-school-route-lock-post-router-v1';
const LIVE_RESEARCH='living-school-live-source-research-v260';
const DESIGN='living-school-research-grounded-curriculum-v218.1';
const COMPLEX_MODEL='gemini-3.7-flash';
// This must run before the generic MiniLM response router (priority 120).
// Living School owns its own research, safety, pedagogy, and recovery contracts;
// conversational answer review must never replace an internal generation result.
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
  const baseContext={
    ...(request?.context||{}),
    livingSchoolRouteLock:VERSION,
    livingSchoolGenerationSession:active,
    responseReviewOwner:'living-school',
    responseRouterBypass:'internal-generation'
  };
  if(purpose===LIVE_RESEARCH)return{...request,__civweaveSkipResponseRouter:true,context:{...baseContext,internalGeneration:true,livingSchoolDesignHandoff:'live-research'}};
  const strong=design;
  return{
    ...request,
    __civweaveSkipResponseRouter:true,
    taskTier:strong?'complex':'small',
    executionProfile:'interactive',
    context:{
      ...baseContext,
      internalGeneration:!strong,
      livingSchoolDesignHandoff:strong?'single-strong-interactive-design-pass':'lite-or-local-followup'
    }
  };
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
  const config={...(request.config||{})},provider=lower(config.provider||config.route||config.engine),messages=scrubLegacyEconomyBoundary(request.messages);
  return{
    ...request,
    messages,
    __civweaveSkipResponseRouter:true,
    taskTier:'complex',
    executionProfile:'interactive',
    config:provider==='gemini'?{...config,provider:'gemini',route:'gemini',model:COMPLEX_MODEL}:config,
    context:{...(request.context||{}),livingSchoolPostRouterBoundary:VERSION,singleStrongDesignProfile:'interactive',responseReviewOwner:'living-school',responseRouterBypass:'internal-generation',legacyEconomyPromptScrubbed:true}
  };
}
function install(){
  const spine=globalThis.CivweaveFastInteractiveV192;
  if(!spine?.register)return false;
  spine.unregister?.(ID);spine.unregister?.(POST_ID);
  spine.register(ID,{before:route},PRIORITY);
  spine.register(POST_ID,{before:postRouter},POST_PRIORITY);
  try{dispatchEvent(new CustomEvent('civweave:living-school-route-lock-ready',{detail:{version:VERSION,priority:PRIORITY,postRouterPriority:POST_PRIORITY,liveResearchException:LIVE_RESEARCH,strongDesignPurpose:DESIGN,strongDesignModel:COMPLEX_MODEL,strongDesignProfile:'interactive',sessionWideFollowupDowngrade:true,responseRouterBypass:true,legacyEconomyPromptScrubbed:true,at:new Date().toISOString()}}))}catch{}
  return true;
}
function schedule(){queueMicrotask(install);setTimeout(install,0);setTimeout(install,120)}
for(const event of ['civweave:runtime-spine-ready','civweave:gemini-task-router-ready','civweave:assistant-runtime-ready','civweave:living-school-grounded-design-ready','pageshow'])addEventListener?.(event,schedule);
install();
globalThis.CivweaveLivingSchoolRouteLockV1=Object.freeze({version:VERSION,install,route,postRouter,priority:PRIORITY,postRouterPriority:POST_PRIORITY,liveResearchException:LIVE_RESEARCH,strongDesignPurpose:DESIGN,strongDesignModel:COMPLEX_MODEL,strongDesignProfile:'interactive',generationActive,responseRouterBypass:true,scrubLegacyEconomyBoundary});
})();