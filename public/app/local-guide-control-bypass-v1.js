(()=>{
'use strict';
const VERSION='1.0.0-local-guide-control-bypass-v1';
if(globalThis.CivweaveLocalGuideControlBypassV1?.version===VERSION)return;
let patched=null,timer=0;
const clean=value=>String(value??'').trim();
function controlKind(text=''){
  const value=clean(text).toLowerCase().replace(/[!?.,]+$/,'').trim();
  if(/^(?:test|testing|ping|check|mic check)$/.test(value))return'test';
  if(/^(?:hi|hello|hey|good morning|good afternoon|good evening)$/.test(value))return'greeting';
  if(/^(?:thanks|thank you|thx|got it|okay|ok)$/.test(value))return'ack';
  if(/\b(?:are you (?:real|alive|sentient|a real boy)|who are you|what are you|are you a person)\b/.test(value))return'identity';
  return'';
}
function patch(){
  const api=globalThis.CivweaveAssistantV141,current=api?.respond;if(!api||typeof current!=='function')return false;
  if(current.__cwLocalGuideControlBypassV1&&current.__cwLocalGuideControlBypassVersion===VERSION){patched=current;return true}
  if(!current.__civweaveLocalProviderAuthorityV1||typeof current.__prior!=='function')return false;
  const local=current.bind(api),deterministic=current.__prior.bind(api);
  const respond=async args=>controlKind(args?.text)?deterministic(args||{}):local(args||{});
  respond.__cwLocalGuideControlBypassV1=true;respond.__cwLocalGuideControlBypassVersion=VERSION;respond.__prior=current;
  for(const key of ['__civweaveLocalProviderAuthorityV1','__civweaveLocalProviderAuthorityVersion','__cwPlatformGuideGuardsV1','__cwUnifiedChatSystemV1','__weavelingPlanJsonV190','__guideIdentityIntegrityV216','__cwGuideCapabilityPassoverV1','__deterministicModeV175','__cwMossLearningGoalPlannerV1'])if(current[key])respond[key]=current[key];
  try{api.respond=respond}catch{}if(api.respond!==respond){try{globalThis.CivweaveAssistantV141={...api,respond}}catch{return false}}
  patched=globalThis.CivweaveAssistantV141?.respond||respond;
  try{dispatchEvent(new CustomEvent('civweave:local-guide-control-bypass-ready',{detail:{version:VERSION,controls:['test','greeting','ack','identity']}}))}catch{}
  return true
}
for(const name of ['civweave:local-provider-authority-installed','civweave:assistant-runtime-ready','civweave:guide-loader-reset','civweave:unified-chat-system-ready','pageshow'])addEventListener(name,()=>queueMicrotask(patch));
patch();let attempts=0;timer=setInterval(()=>{attempts+=1;patch();if(attempts>=240)clearInterval(timer)},125);addEventListener('pagehide',()=>clearInterval(timer),{once:true});
globalThis.CivweaveLocalGuideControlBypassV1=Object.freeze({version:VERSION,patch,controlKind,state:()=>Object.freeze({installed:Boolean(patched)})});
})();