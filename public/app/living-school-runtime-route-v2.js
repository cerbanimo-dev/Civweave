(()=>{
'use strict';
const VERSION='2.4.0-living-school-runtime-route-v2-provider-handoff';
const ID='living-school-runtime-route-v2';
const DESIGN_PURPOSE='living-school-research-grounded-curriculum-v218.1';
const GROUNDED_RESEARCH_MODES=new Set(['live-agentic','local-synthesized','local-downloaded','manual-sources','model-derived-unverified']);
const PROFILE_KEY='civweave-model-profiles-v1';
const LEGACY_KEY='civweave.universal-ai.v127';
const AUTHORITY_PATH='/app/selected-provider-authority-v1.js';
const AUTHORITY_VERSION='1.1.0-selected-provider-authority-v1-all-routes';
let authorityPromise=null;
const clean=(value,max=64000)=>String(value??'').trim().slice(0,max);
const lower=value=>clean(value,220).toLowerCase();
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
function objectFrom(storage,key){try{const value=parse(storage?.getItem?.(key),{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch{return{}}}
function providerOf(value={}){return lower(value?.provider||value?.route||value?.engine)}
function normalizeUrl(value){try{const url=new URL(clean(value,2400));url.hash='';return url.href}catch{return''}}
function sourceAllowlist(request={}){return(Array.isArray(request?.context?.sources)?request.context.sources:[]).map(source=>({id:clean(source?.id,180),title:clean(source?.title,320),url:clean(source?.url,2000),notes:clean(source?.notes,5000)})).filter(source=>source.id)}
function designRequest(request={}){return lower(request?.purpose)===DESIGN_PURPOSE&&GROUNDED_RESEARCH_MODES.has(lower(request?.context?.research?.mode))}
function persistedSelection(){
  try{const value=globalThis.CivweaveSelectedProviderAuthorityV1?.persistedInteractive?.();if(providerOf(value))return value}catch{}
  try{const value=globalThis.CivweaveSettingsV320?.readState?.();if(providerOf(value))return value}catch{}
  const profiles=objectFrom(globalThis.localStorage,PROFILE_KEY),interactive=profiles?.interactive;
  if(providerOf(interactive))return interactive;
  const legacy=objectFrom(globalThis.localStorage,LEGACY_KEY);if(providerOf(legacy))return legacy;
  return null;
}
function patchSharedConfig(){
  const runtime=globalThis.CivweaveModelRuntime;if(!runtime?.readSharedConfig||!runtime?.generate)return false;
  if(runtime.__livingSchoolProviderConfigBridgeV1===VERSION)return true;
  const previous=runtime.readSharedConfig.bind(runtime);
  const readSharedConfig=(profile='interactive')=>{
    const prior=previous(profile);if(clean(profile,40).toLowerCase()!=='interactive')return prior;
    const selected=persistedSelection();if(!providerOf(selected))return prior;
    return{...(prior&&typeof prior==='object'?prior:{}),...selected};
  };
  globalThis.CivweaveModelRuntime={...runtime,readSharedConfig,__livingSchoolProviderConfigBridgeV1:VERSION};
  try{globalThis.CivweaveSelectedProviderAuthorityV1?.install?.()}catch{}
  try{dispatchEvent(new CustomEvent('civweave:living-school-provider-handoff-ready',{detail:{version:VERSION,provider:providerOf(readSharedConfig('interactive')||{}),at:new Date().toISOString()}}))}catch{}
  return true;
}
function ensureAuthority(){
  if(globalThis.CivweaveSelectedProviderAuthorityV1){try{globalThis.CivweaveSelectedProviderAuthorityV1.install?.()}catch{};patchSharedConfig();return Promise.resolve(true)}
  if(authorityPromise)return authorityPromise;
  if(typeof document==='undefined'||!document.head)return Promise.resolve(false);
  authorityPromise=new Promise(resolve=>{
    const ready=()=>{const ok=Boolean(globalThis.CivweaveSelectedProviderAuthorityV1);if(ok){try{globalThis.CivweaveSelectedProviderAuthorityV1.install?.()}catch{};patchSharedConfig()}resolve(ok)};
    const existing=[...(document.scripts||[])].find(node=>{try{return new URL(node.src,location.href).pathname===AUTHORITY_PATH}catch{return false}});
    if(existing){existing.addEventListener?.('load',ready,{once:true});setTimeout(ready,1800);return}
    const script=document.createElement('script');script.src=`${AUTHORITY_PATH}?v=${encodeURIComponent(AUTHORITY_VERSION)}`;script.async=false;script.onload=ready;script.onerror=()=>resolve(false);document.head.append(script);
  }).finally(()=>{authorityPromise=null});
  return authorityPromise;
}
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
  void ensureAuthority();patchSharedConfig();
  const spine=globalThis.CivweaveFastInteractiveV192;if(!spine?.register)return false;
  spine.unregister?.('living-school-runtime-route-v1');spine.unregister?.(ID);
  spine.register(ID,{before:prepare,after:sanitizeGroundedDesign},190);
  try{dispatchEvent(new CustomEvent('civweave:living-school-runtime-route-ready',{detail:{version:VERSION,mode:'middleware-only',singleStrongDesign:true,terminalOwnerAware:true,providerNeutral:true,providerSelectionOwner:'civweave-runtime',providerHandoffBridge:true,globalRuntimeWrapping:false,at:new Date().toISOString()}}))}catch{}
  return true;
}
function schedule(){queueMicrotask(install);setTimeout(install,0);setTimeout(install,160)}
for(const event of ['civweave:runtime-spine-ready','civweave:model-runtime-ready','civweave:assistant-runtime-ready','civweave:model-config-changed','civweave:selected-provider-authority-enforced','pageshow'])addEventListener?.(event,schedule);
install();
const api=Object.freeze({version:VERSION,install,prepare,sanitizeGroundedDesign,designRequest,persistedSelection,patchSharedConfig,ensureAuthority,bridge:true,mode:'middleware-only',singleStrongDesign:true,terminalOwnerAware:true,providerNeutral:true,providerSelectionOwner:'civweave-runtime',providerHandoffBridge:true});
globalThis.CivweaveLivingSchoolRuntimeRouteV2=api;
globalThis.CivweaveLivingSchoolRuntimeRouteV1=api;
})();
