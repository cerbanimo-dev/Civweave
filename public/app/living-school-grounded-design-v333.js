(()=>{
'use strict';
const VERSION='1.0.0-living-school-grounded-design-v333';
const ID='living-school-grounded-design-v333';
const DESIGN='living-school-research-grounded-curriculum-v218.1';
const GROUNDED='living-school-grounded-design-lite-v333';
const MODES=new Set(['live-agentic','local-synthesized','local-downloaded','manual-sources','model-derived-unverified']);
const ECONOMY=/\b(?:Acorns?|Buttons?|XP|curriculum\s+(?:package\s+)?valuation|labor\s+worth|labour\s+worth|skill\s+ledger|completion\s+grant|reward\s+contract|wage\s+valuation|ledger\s+metadata|payouts?|wages?|currency\s+values?|bonuses?|grants?)\b/i;
const clean=(value,max=64000)=>String(value??'').trim().slice(0,max);
const lower=value=>clean(value,220).toLowerCase();
function sanitize(text){
  const rows=clean(text).split(/\r?\n/),kept=[];let removed=0;
  for(const row of rows){if(ECONOMY.test(row)){removed++;continue}kept.push(row)}
  return{text:kept.join('\n').replace(/\n{3,}/g,'\n\n').trim(),removed};
}
function install(){
  const spine=globalThis.CivweaveFastInteractiveV192;if(!spine?.register)return false;
  spine.unregister?.(ID);
  spine.register(ID,{
    before(request){
      if(lower(request?.purpose)!==DESIGN||!MODES.has(lower(request?.context?.research?.mode)))return request;
      const messages=[...(Array.isArray(request.messages)?request.messages:[]),{role:'system',content:'The research/evidence pass is complete. Produce instructional design only. Never output Civweave economy or reward metadata. Do not output Acorns, Buttons, XP, grants, payouts, wages, pricing, labor valuation, currency values, ledger metadata, or a reward contract. Use a SOURCE_ID only for claims actually supported by that source passage. Unsupported material must be marked GENERATED-UNVERIFIED with no SOURCE_ID. Do not output media URLs; provide only plain-text video search topics.'}];
      return{...request,purpose:GROUNDED,taskTier:'small',executionProfile:'interactive',messages,context:{...(request.context||{}),livingSchoolOriginalPurpose:DESIGN,livingSchoolGroundedDesign:true,applicationOwnedEconomyBoundary:true}};
    },
    after(result,request){
      if(lower(request?.purpose)!==GROUNDED||result?.status!=='success')return result;
      const raw=clean(result?.outputText||result?.text||result?.output||'');if(!raw)return result;
      const bounded=sanitize(raw);
      if(!bounded.text)return{...result,status:'invalid-response',outputText:'',outputJson:undefined,error:{code:'LIVING_SCHOOL_GROUNDED_DESIGN_EMPTY_AFTER_BOUNDARY',message:'Living School removed provider-authored economy metadata and no instructional design remained.'}};
      return{...result,outputText:bounded.text,diagnostics:[...(result.diagnostics||[]),...(bounded.removed?[`Living School removed ${bounded.removed} provider-authored economy/reward line${bounded.removed===1?'':'s'} before storing grounded design.`]:[])]};
    }
  },160);
  try{dispatchEvent(new CustomEvent('civweave:living-school-grounded-design-ready',{detail:{version:VERSION,purpose:GROUNDED,applicationOwnedEconomyBoundary:true,at:new Date().toISOString()}}))}catch{}
  return true;
}
for(const event of ['civweave:runtime-spine-ready','civweave:gemini-task-router-ready','civweave:living-school-runtime-route-ready'])addEventListener?.(event,()=>queueMicrotask(install));
install();
globalThis.CivweaveLivingSchoolGroundedDesignV333=Object.freeze({version:VERSION,install,purpose:GROUNDED,sanitize});
})();