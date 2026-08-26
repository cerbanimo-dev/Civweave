(()=>{
'use strict';
const VERSION='2.3.0-living-school-runtime-route-v2-provider-neutral';
const ID='living-school-runtime-route-v2';
const DESIGN_PURPOSE='living-school-research-grounded-curriculum-v218.1';
const GROUNDED_RESEARCH_MODES=new Set(['live-agentic','local-synthesized','local-downloaded','manual-sources','model-derived-unverified']);
const clean=(value,max=64000)=>String(value??'').trim().slice(0,max);
const lower=value=>clean(value,220).toLowerCase();
function normalizeUrl(value){try{const url=new URL(clean(value,2400));url.hash='';return url.href}catch{return''}}
function sourceAllowlist(request={}){return(Array.isArray(request?.context?.sources)?request.context.sources:[]).map(source=>({id:clean(source?.id,180),title:clean(source?.title,320),url:clean(source?.url,2000),notes:clean(source?.notes,5000)})).filter(source=>source.id)}
function designRequest(request={}){return lower(request?.purpose)===DESIGN_PURPOSE&&GROUNDED_RESEARCH_MODES.has(lower(request?.context?.research?.mode))}
function prepare(request={}){
  if(!designRequest(request))return request;
  const config={...(request.config||{})},provider=lower(config.provider||config.route||config.engine),terminalPrimary=request?.context?.livingSchoolTerminalPrimary===true;
  const boundary='Living School strong-design boundary: this is the single strong instructional-design call for the curriculum run. Use the provider and model selected in Civweave Settings/runtime routing; do not substitute another provider or model here. The evidence pass is already complete. Use only supplied SOURCE_ID values for grounded claims, label unsupported instructional inference GENERATED-UNVERIFIED, do not perform new research, do not invent sources or URLs, and output only plain-text video search topics rather than media links. Civweave owns rewards/economy metadata.';
  return{...request,purpose:DESIGN_PURPOSE,taskTier:'complex',executionProfile:'interactive',config,context:{...(request.context||{}),livingSchoolRuntimeRoute:VERSION,livingSchoolSingleStrongDesign:terminalPrimary?false:true,livingSchoolSelectedProvider:provider||'',providerSelectionOwner:'civweave-runtime',providerNeutral:true},messages:[...(Array.isArray(request.messages)?request.messages:[]),{role:'system',content:boundary}]};
}
function sanitizeGroundedDesign(result,request){
  if(!designRequest(request)||result?.status!=='success'||!clean(result?.outputText,64000))return result;
  const allowed=new Set(sourceAllowlist(request).map(source=>normalizeUrl(source.url)).filter(Boolean));let changed=false,text=clean(result.outputText,64000);
  text=text.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi,(match,label,url)=>{const normalized=normalizeUrl(url);if(normalized&&allowed.has(normalized))return match;changed=true;return clean(label,500)});
  text=text.replace(/https?:\/\/[^\s)\]}>"']+/gi,raw=>{const trimmed=raw.replace(/[.,;:!?]+$/,''),normalized=normalizeUrl(trimmed);if(normalized&&allowed.has(normalized))return raw;changed=true;return''});
  text=text.replace(/[ \t]+\n/g,'\n').replace(/ {2,}/g,' ').trim();
  return{...result,outputText:text,diagnostics:[...(result.diagnostics||[]),...(changed?['Living School removed URLs outside the supplied research-source allowlist from the single strong design result.']:[])]};
}
function install(){
  const spine=globalThis.CivweaveFastInteractiveV192;if(!spine?.register)return false;
  spine.unregister?.('living-school-runtime-route-v1');spine.unregister?.(ID);
  spine.register(ID,{before:prepare,after:sanitizeGroundedDesign},190);
  try{dispatchEvent(new CustomEvent('civweave:living-school-runtime-route-ready',{detail:{version:VERSION,mode:'middleware-only',singleStrongDesign:true,terminalOwnerAware:true,providerNeutral:true,providerSelectionOwner:'civweave-runtime',globalRuntimeWrapping:false,at:new Date().toISOString()}}))}catch{}
  return true;
}
function schedule(){queueMicrotask(install);setTimeout(install,0)}
for(const event of ['civweave:runtime-spine-ready','civweave:model-runtime-ready','civweave:assistant-runtime-ready','pageshow'])addEventListener?.(event,schedule);
install();
const api=Object.freeze({version:VERSION,install,prepare,sanitizeGroundedDesign,designRequest,bridge:true,mode:'middleware-only',singleStrongDesign:true,terminalOwnerAware:true,providerNeutral:true,providerSelectionOwner:'civweave-runtime'});
globalThis.CivweaveLivingSchoolRuntimeRouteV2=api;
globalThis.CivweaveLivingSchoolRuntimeRouteV1=api;
})();
