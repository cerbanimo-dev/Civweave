(()=>{
'use strict';
const VERSION='1.0.71-gemini-task-tier-router-v325-living-school-boundaries';
const SMALL_MODEL='gemini-3.1-flash-lite';
const COMPLEX_MODEL='gemini-3.7-flash';
const SETTINGS_KEY='civweave.universal-ai.v127';
const PROFILES_KEY='civweave-model-profiles-v1';
const NOTICE_ID='cw-gemini-task-tier-notice-v213';
const STYLE_ID='cw-gemini-task-tier-style-v213';
const MIDDLEWARE_ID='gemini-task-tier-v271';
const LIVING_SCHOOL_DESIGN_PURPOSE='living-school-research-grounded-curriculum-v218.1';
const LIVING_SCHOOL_FLASH_LITE_PURPOSES=new Set([
  'living-school-structure-single-v221',
  'living-school-module-depth-expansion-v262',
  'living-school-quiz-delta-completion-v258',
  'living-school-quiz-question-contract-repair-v263'
]);
let noticeTimer=null;
if(globalThis.CivweaveGeminiTaskTierRouterV213?.version===VERSION)return;
const clean=(value,max=24000)=>String(value??'').trim().slice(0,max);
const lower=value=>clean(value).toLowerCase();
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const providerName=value=>lower(value)==='gemini'?'gemini':lower(value);
function requestText(request={}){
  const messages=Array.isArray(request.messages)?request.messages:[];
  const messageText=messages.filter(item=>lower(item?.role||'')!=='system').map(item=>typeof item==='string'?item:item?.content??item?.text??'').join('\n');
  const context=request.context&&typeof request.context==='object'?request.context:{};
  return clean([request.purpose,request.prompt,request.text,request.task,request.instructions,request.systemId,request.realm,context.userMessage,context.objective,context.purpose,context.guide?.system,messageText].filter(Boolean).join('\n'),70000);
}
function explicitTier(request={}){
  const value=lower(request.taskTier||request.modelTier||request.complexity||request.executionClass||'');
  if(['complex','agentic','research','planning','code','heavy','advanced'].includes(value))return'complex';
  if(['small','simple','routine','light','interactive','quick'].includes(value))return'small';
  return'';
}
function capabilityRequirements(request={}){
  const broker=globalThis.CivweaveAICapabilityBrokerV268;
  const generic=broker?.requirements?.(request)||{};
  const text=lower(requestText(request));
  const planning=Boolean(generic.planning||/\b(project plan|implementation plan|work plan|lesson plan|learning plan|curriculum plan|roadmap|milestones?|work breakdown|project architecture|system design|quest draft|quest plan|reviewable weave|multi[- ]?step plan)\b/.test(text));
  const research=Boolean(generic.externalResearch||/\b(research|deep research|source discovery|find sources|citations?|bibliograph|literature review|fact[- ]?check|evidence synthesis|compare sources)\b/.test(text));
  const code=Boolean(generic.code||/\b(code generation|generated code|implementation patch|software architecture|debugging|refactor)\b/.test(text));
  const profile=generic.profile==='agentic'||request.agentic===true||request.background===true?'agentic':'interactive';
  return Object.freeze({...generic,profile,planning,externalResearch:research,code});
}
function livingSchoolFlashLitePurpose(request={}){return LIVING_SCHOOL_FLASH_LITE_PURPOSES.has(lower(request.purpose));}
function classify(runtime,request={}){
  const requirements=capabilityRequirements(request);
  if(livingSchoolFlashLitePurpose(request))return{tier:'small',reason:'Living School repair/fill maintenance',requirements};
  const explicit=explicitTier(request);
  if(explicit)return{tier:explicit,reason:explicit==='complex'?'explicit complex-task request':'explicit lightweight request',requirements};
  if(requirements.profile==='agentic'||requirements.requiresTools)return{tier:'complex',reason:'agentic or tool-using flow',requirements};
  if(requirements.externalResearch)return{tier:'complex',reason:'research and source synthesis',requirements};
  if(requirements.planning)return{tier:'complex',reason:'multi-step planning',requirements};
  const context=request.context&&typeof request.context==='object'?request.context:{};
  const system=lower(request.systemId||request.realm||context.guide?.system||context.currentContext?.systemId||'');
  if(requirements.code&&['cerbanimo','anarchadia','civweave'].includes(system))return{tier:'complex',reason:`${system||'Civweave'} code generation`,requirements};
  const complexPurpose=/\b(plan|planner|planning|research|agent|agentic|source|browse|automation|code|patch|implementation|architecture|curriculum-generation|content-generation|quest-generation|proposal-generation)\b/.test(lower(request.purpose));
  if(complexPurpose)return{tier:'complex',reason:'complex generation purpose',requirements};
  return{tier:'small',reason:'routine interactive request',requirements};
}
function effectiveConfig(runtime,request,profile){
  const requested=request?.config&&typeof request.config==='object'?request.config:{};
  let stored={};
  try{stored=runtime?.readSharedConfig?.(profile)||runtime?.readSharedConfig?.('interactive')||{}}catch{}
  return{...stored,...requested};
}
function isGemini(runtime,request,profile){const config=effectiveConfig(runtime,request,profile);return providerName(config.provider||config.route||config.engine)==='gemini';}
function appendSystemBoundary(request,text){
  const messages=Array.isArray(request?.messages)?request.messages.map(message=>({...message})):[];
  messages.push({role:'system',content:text});
  return{...request,messages};
}
function prepareLivingSchoolDesign(request){
  if(lower(request?.purpose)!==LIVING_SCHOOL_DESIGN_PURPOSE)return request;
  return appendSystemBoundary(request,'Living School design boundary: produce instructional design only. Do not invent or recommend Acorn pricing, Button labor values, XP amounts, grants, bonuses, payouts, wages, currency values, curriculum valuation, or any ledger/economy metadata. Civweave attaches rewards after validated curriculum storage. Provenance boundary: use only the supplied source packet and SOURCE_ID values. Do not invent a bibliography, author, publication, URL, study, law, date, or named source that is not present in the supplied source material.');
}
function designEconomyViolation(result,request){
  if(lower(request?.purpose)!==LIVING_SCHOOL_DESIGN_PURPOSE||result?.status!=='success')return result;
  const text=clean(result?.outputText||result?.text||result?.output||'',64000);
  if(!text)return result;
  const contaminated=/\b(?:Acorns?|Buttons?|XP|curriculum\s+(?:package\s+)?valuation|labor\s+worth|labour\s+worth|skill\s+ledger|value\s+accounting|completion\s+grant|wage\s+valuation)\b/i.test(text);
  if(!contaminated)return result;
  return{...result,status:'invalid-response',outputText:'',outputJson:undefined,error:{code:'LIVING_SCHOOL_DESIGN_ECONOMY_BOUNDARY',message:'Living School rejected the research/design packet because the model authored economy or reward metadata. No additional 3.7 repair call was made.'},diagnostics:[...(result.diagnostics||[]),'Living School design packet failed the application-owned economy boundary.']};
}
function migrateStoredGeminiPolicy(){
  try{
    const saved=parse(localStorage.getItem(SETTINGS_KEY),{}),profiles=parse(localStorage.getItem(PROFILES_KEY),{}),interactive=profiles.interactive&&typeof profiles.interactive==='object'?profiles.interactive:saved;
    if(providerName(interactive?.provider||interactive?.route)!=='gemini')return false;
    const endpoint=interactive.endpoint||saved.endpoint||'https://generativelanguage.googleapis.com/v1beta';
    const small={...interactive,route:'gemini',provider:'gemini',model:SMALL_MODEL,endpoint},complex={...interactive,route:'gemini',provider:'gemini',model:COMPLEX_MODEL,endpoint};
    localStorage.setItem(PROFILES_KEY,JSON.stringify({...profiles,interactive:small,agentic:complex,agenticEnabled:true,geminiRouting:'capability-spine-v271'}));
    localStorage.setItem(SETTINGS_KEY,JSON.stringify({...saved,...small,consent:Boolean(small.externalConsent??saved.consent),agenticEnabled:true,geminiRouting:'capability-spine-v271'}));
    return true;
  }catch{return false}
}
function migrateGeminiProfiles(runtime){
  migrateStoredGeminiPolicy();
  if(!runtime?.readSharedConfig||!runtime?.saveSharedConfig)return false;
  let interactive=null;try{interactive=runtime.readSharedConfig('interactive')}catch{}
  if(providerName(interactive?.provider||interactive?.route)!=='gemini')return false;
  const endpoint=interactive.endpoint||'https://generativelanguage.googleapis.com/v1beta';
  runtime.saveSharedConfig({...interactive,provider:'gemini',route:'gemini',model:SMALL_MODEL,endpoint},{profile:'interactive'});
  runtime.saveSharedConfig({...interactive,provider:'gemini',route:'gemini',model:COMPLEX_MODEL,endpoint},{profile:'agentic',enabled:true});
  return true;
}
function installStyle(){
  if(typeof document==='undefined'||document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`#${NOTICE_ID}{position:fixed;left:50%;top:max(12px,env(safe-area-inset-top));transform:translateX(-50%);z-index:2147483646;width:min(680px,calc(100vw - 24px));padding:12px 15px;border:1px solid rgba(120,232,255,.55);border-radius:14px;background:rgba(5,15,35,.96);box-shadow:0 16px 48px rgba(0,0,0,.45);color:#f5fbff;font:600 14px/1.4 system-ui,sans-serif;text-align:center;pointer-events:none}#${NOTICE_ID}[hidden]{display:none!important}#cw-gemini-routing-note-v213{padding:13px 15px;border:1px solid rgba(120,232,255,.35);border-radius:13px;background:#071a2a;color:#dff9ff}#cw-gemini-routing-note-v213 b{display:block;margin-bottom:4px;color:#8eeeff}`;document.head.append(style);
}
function disclose(decision,model,request={}){
  const detail={schema:'civweave.gemini-task-routing.v2',version:VERSION,tier:decision.tier,reason:decision.reason,requirements:decision.requirements,model,smallModel:SMALL_MODEL,complexModel:COMPLEX_MODEL,purpose:clean(request.purpose,160),at:new Date().toISOString()};
  try{dispatchEvent(new CustomEvent('civweave:gemini-task-tier-selected',{detail}))}catch{}
  if(typeof document==='undefined'||decision.tier!=='complex')return detail;
  installStyle();let notice=document.getElementById(NOTICE_ID);if(!notice){notice=document.createElement('div');notice.id=NOTICE_ID;notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');document.body.append(notice)}
  notice.textContent=`Capability routing selected Gemini 3.7 Flash for ${decision.reason}. Routine requests use Gemini 3.1 Flash-Lite.`;notice.hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{if(notice?.isConnected)notice.hidden=true},7000);return detail;
}
function patchSettings(){
  if(typeof document==='undefined')return;
  installStyle();
  const form=document.querySelector('[data-cw-cleanroom-form]');
  if(!form)return;
  const route=form.elements?.namedItem?.('route'),model=form.elements?.namedItem?.('model'),remote=form.querySelector('[data-panel="remote"]'),gemini=providerName(route?.value)==='gemini';
  const canonicalV322=form.dataset.settingsTabs==='1'&&Boolean(form.querySelector('[data-gemini-presets]'));
  if(model){
    if(gemini){model.value=SMALL_MODEL;model.readOnly=true;if(canonicalV322)model.removeAttribute('aria-describedby');else model.setAttribute('aria-describedby','cw-gemini-routing-note-v213')}
    else{model.readOnly=false;model.removeAttribute('aria-describedby')}
  }
  const note=form.querySelector('#cw-gemini-routing-note-v213');
  if(canonicalV322){note?.remove();return}
  if(gemini&&remote){
    let legacyNote=note;
    if(!legacyNote){legacyNote=document.createElement('div');legacyNote.id='cw-gemini-routing-note-v213';legacyNote.innerHTML='<b>Capability-aware Gemini routing</b><span>Routine requests use Gemini 3.1 Flash-Lite. Planning, research, code generation, and agentic work use Gemini 3.7 Flash. Capability classification is provider-neutral; Gemini selection happens only after Gemini is the chosen provider.</span>';remote.insertBefore(legacyNote,remote.querySelector('.cw-clean-secret-row')||remote.lastElementChild)}
    legacyNote.hidden=false;
  }else if(note)note.hidden=true;
}
function middleware(){
  return{
    before(request,ctx){
      const prepared=prepareLivingSchoolDesign(request),decision=classify(ctx.baseRuntime||globalThis.CivweaveModelRuntime,prepared),profile=decision.tier==='complex'?'agentic':'interactive';
      if(!isGemini(ctx.baseRuntime||globalThis.CivweaveModelRuntime,prepared,profile))return prepared;
      migrateGeminiProfiles(ctx.baseRuntime||globalThis.CivweaveModelRuntime);
      const model=decision.tier==='complex'?COMPLEX_MODEL:SMALL_MODEL,meta=disclose(decision,model,prepared);
      return{...prepared,executionProfile:profile,taskTier:decision.tier,capabilityRequirements:decision.requirements,config:{...(prepared.config||{}),provider:'gemini',route:'gemini',model},__civweaveGeminiRouting:meta};
    },
    after(result,request){
      const bounded=designEconomyViolation(result,request),meta=request?.__civweaveGeminiRouting;
      if(!meta||!bounded||typeof bounded!=='object')return bounded;
      return{...bounded,taskRouting:meta};
    }
  };
}
function install(){
  const spine=globalThis.CivweaveFastInteractiveV192;
  if(!spine?.register)return false;
  migrateGeminiProfiles(spine.base?.()||globalThis.CivweaveModelRuntime);
  spine.register(MIDDLEWARE_ID,middleware(),40);
  try{dispatchEvent(new CustomEvent('civweave:gemini-task-router-ready',{detail:{version:VERSION,smallModel:SMALL_MODEL,complexModel:COMPLEX_MODEL,middleware:MIDDLEWARE_ID,at:new Date().toISOString()}}))}catch{}
  return true;
}
addEventListener?.('civweave:runtime-spine-ready',install);
addEventListener?.('civweave:model-settings-saved',()=>{migrateStoredGeminiPolicy();patchSettings();queueMicrotask(install)});
addEventListener?.('civweave:model-settings-opened',()=>queueMicrotask(patchSettings));
if(typeof document!=='undefined'){document.addEventListener('change',event=>{if(event.target?.name==='route')queueMicrotask(patchSettings)});document.addEventListener('submit',event=>{if(event.target?.matches?.('[data-cw-cleanroom-form]'))patchSettings()},true);if(document.readyState==='loading')addEventListener('DOMContentLoaded',patchSettings,{once:true});else patchSettings();}
migrateStoredGeminiPolicy();install();
globalThis.CivweaveGeminiTaskTierRouterV213=Object.freeze({version:VERSION,smallModel:SMALL_MODEL,complexModel:COMPLEX_MODEL,capabilityRequirements,classify:request=>classify(globalThis.CivweaveFastInteractiveV192?.base?.()||globalThis.CivweaveModelRuntime||{},request),install,patchSettings,migrateStored:migrateStoredGeminiPolicy,migrate:()=>migrateGeminiProfiles(globalThis.CivweaveFastInteractiveV192?.base?.()||globalThis.CivweaveModelRuntime),middlewareId:MIDDLEWARE_ID,canonicalSettingsPresentation:true});
})();