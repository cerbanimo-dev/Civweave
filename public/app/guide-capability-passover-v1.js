(()=>{
'use strict';

const VERSION='1.2.0-guide-capability-passover-v1-artifact-references';
const ROOT_ID='cw-persistent-guide-chat-v215';
const SYSTEMS=['civweave','living-school','cerbanimo','fellowfare','anarchadia'];

// Internal artifact classes are compatibility identifiers. They are never the
// source of user-facing terminology.
const OWNER=Object.freeze({weave:'civweave',curriculum:'living-school',quest:'cerbanimo',resource:'fellowfare',governance:'anarchadia'});
const CANONICAL=Object.freeze({
  civweave:Object.freeze({guide:'Weaveling',system:'Civweave',artifact:'Quest',plural:'Quests',internalArtifactClass:'weave',role:'Quest guide and central orchestrator'}),
  'living-school':Object.freeze({guide:'Moss',system:'Living School',artifact:'Learning Journey',plural:'Learning Journeys',internalArtifactClass:'curriculum',role:'Learning Journey guide'}),
  cerbanimo:Object.freeze({guide:'Kamiya',system:'Cerbanimo',artifact:'Endeavor',plural:'Endeavors',internalArtifactClass:'quest',role:'Endeavor guide'}),
  fellowfare:Object.freeze({guide:'Rook',system:'FellowFare',artifact:'Manifest',plural:'Manifests',internalArtifactClass:'resource',role:'Manifest guide and Quartermaster'}),
  anarchadia:Object.freeze({guide:'Merlin',system:'Anarchadia',artifact:'governance proposal',plural:'governance proposals',internalArtifactClass:'governance',role:'Civic and automation guide'})
});
const GUIDE=Object.freeze(Object.fromEntries(Object.entries(CANONICAL).map(([system,value])=>[system,{name:value.guide,label:value.system,focus:value.role.toLowerCase()}])));
const ARTIFACT_LABEL=Object.freeze({weave:'Quest',curriculum:'Learning Journey',quest:'Endeavor',resource:'Manifest',governance:'governance proposal'});
const MODE=Object.freeze({civweave:'Plan','living-school':'Learn',cerbanimo:'Build',fellowfare:'Acquire',anarchadia:'Govern'});
const DECLARED_KIND=Object.freeze({weave:'campus-weave',curriculum:'learning-path',quest:'quest-draft',resource:'resource-manifest',governance:'governance-draft'});
const STORE_PREFIX='civweave.guide-capability-passover.v1';
const STYLE_ID='cw-guide-capability-passover-v1-style';
const BUILD=/\b(build|create|make|generate|draft|design|develop|structure|prepare|start|plan|produce|write|compose|file|submit|set up|implement|ship|revise|update|want|need|help)\b/i;
const DIRECT_CANONICAL=/\b(?:build|create|make|generate|draft|design|develop|structure|prepare|start|plan|produce|write|compose|file|submit|set up|revise|update|want(?:\s+to)?|need(?:\s+to)?)\s+(?:me\s+|us\s+)?(?:(?:a|an|the|this|that|new)\s+)?(learning journey|endeavou?r|manifest|quest|feature[- ]request|bug report|bug[- ]?fix(?: request)?)s?\b/i;
const TINY_LOCAL_MODELS=new Set(['smollm2-135m-instruct-q8-wasm','smollm2-360m-instruct-q4f16']);
let assistantPatched=false;
let clickBound=false;
let promptSpine=null;

const compact=(value,max=12000)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const preserve=(value,max=12000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const now=()=>new Date().toISOString();
const uid=()=>`passover-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
function systemFor(options={}){const value=compact(options.systemId||options?.context?.guide?.system,80).toLowerCase();return SYSTEMS.includes(value)?value:'civweave'}
function ownerFor(artifact){return OWNER[compact(artifact,80)]||''}
function canonicalFor(system){return CANONICAL[SYSTEMS.includes(system)?system:'civweave']}
function artifactForSystem(system){return canonicalFor(system).internalArtifactClass}
function canonicalTermArtifact(term){
  const value=compact(term,80).toLowerCase();
  if(value==='learning journey')return'curriculum';
  if(value==='endeavor'||value==='endeavour')return'quest';
  if(value==='manifest')return'resource';
  if(value==='quest')return'weave';
  if(/^(?:feature[- ]request|bug report|bug[- ]?fix(?: request)?)$/.test(value))return'governance';
  return'';
}
function technicalManifestContext(t){return/\b(web|pwa|package|npm|json|xml|app|application|deployment|docker|kubernetes|webmanifest|manifest\.json)\b/.test(t)}
function directCanonicalArtifact(t){
  const match=t.match(DIRECT_CANONICAL),artifact=canonicalTermArtifact(match?.[1]);
  if(artifact==='resource'&&technicalManifestContext(t))return'';
  return artifact;
}
function mentionedCanonicalArtifact(t){
  const mentions=[];
  for(const [pattern,artifact] of [[/\blearning journeys?\b/,'curriculum'],[/\bendeavou?rs?\b/,'quest'],[/\bmanifests?\b/,'resource'],[/\bquests?\b/,'weave']]){
    const match=t.match(pattern);if(match&&!(artifact==='resource'&&technicalManifestContext(t)))mentions.push({artifact,index:match.index??Number.MAX_SAFE_INTEGER});
  }
  if(!mentions.length)return'';
  mentions.sort((a,b)=>a.index-b.index);
  return mentions[0].artifact;
}
function explicitCanonicalArtifact(t){return directCanonicalArtifact(t)||mentionedCanonicalArtifact(t)}
function candidateDetails(text){
  const value=compact(text,8000),t=value.toLowerCase();if(!value)return{artifact:'',explicitCanonical:false};
  const building=BUILD.test(t);
  if(!building)return{artifact:'',explicitCanonical:false};

  // A directly requested canonical artifact wins. Compatibility aliases are
  // checked next so context such as "for this Quest" cannot steal a request
  // for a productive project, learning plan, or resource manifest.
  const direct=directCanonicalArtifact(t);if(direct)return{artifact:direct,explicitCanonical:true};

  if(/\b(curriculum|course|syllabus|learning path|learning pathway|learning program|learning plan|learning content|educational content|teaching content|lesson plan|study plan|training plan|training program|skill tree)\b/.test(t))return{artifact:'curriculum',explicitCanonical:false};
  if(/\b(resource manifest|skill manifest|procurement plan|sourcing plan|materials? list|inventory plan|resource plan|resource request|resource offer)\b/.test(t))return{artifact:'resource',explicitCanonical:false};
  if(/\b(proposal|policy|rule change|charter|governance plan|motion|vote plan|civic change|community agreement)\b/.test(t))return{artifact:'governance',explicitCanonical:false};
  if(/\b(cross[- ]realm|multi[- ]realm|across (?:the )?realms?|whole civweave|civweave-wide|intention plan|coordinated intention)\b/.test(t))return{artifact:'weave',explicitCanonical:false};
  if(/\b(productive project|project|project plan|work plan|implementation plan|deliverable|prototype|feature|software product|repair plan|program of work|codebase work)\b/.test(t))return{artifact:'quest',explicitCanonical:false};

  const mentioned=mentionedCanonicalArtifact(t);if(mentioned)return{artifact:mentioned,explicitCanonical:true};
  return{artifact:'',explicitCanonical:false};
}
function candidateArtifact(text){return candidateDetails(text).artifact}
function offerKey(system){return`${STORE_PREFIX}.${system}`}
function readOffer(system){try{return parse(localStorage.getItem(offerKey(system)),null)}catch{return null}}
function writeOffer(offer){try{localStorage.setItem(offerKey(offer.sourceSystem),JSON.stringify(offer))}catch{}return offer}
const referenceAccepting=new Set();
function referenceFailure(code,error){return{ok:false,code,error,inferenceInvocations:0}}
function referenceKey(system){return`${STORE_PREFIX}.reference.${system}`}
function referenceSnapshot(value){if(!value||typeof value!=='object')return null;const out={};for(const key of ['schema','id','kind','state','sourceSystem','targetSystem','ownerSystem','artifactClass','targetArtifactClass','artifactRef','artifactRevision','createdAt','acceptedAt','resubmit','materialized','destinationValidation'])if(Object.hasOwn(value,key))out[key]=value[key];out.consent={declared:value.consent?.declared===true,scope:'artifact-reference-only'};return out}
function readArtifactReferenceOffer(sourceSystem){if(!SYSTEMS.includes(sourceSystem))return null;try{const raw=localStorage.getItem(referenceKey(sourceSystem));return raw&&raw.length<=6000?referenceSnapshot(parse(raw,null)):null}catch{return null}}
function validateArtifactReference(input){
  if(!SYSTEMS.includes(input?.sourceSystem)||!SYSTEMS.includes(input?.targetSystem)||input.sourceSystem===input.targetSystem)return referenceFailure('PASSOVER_REFERENCE_TARGET_INVALID','Choose distinct canonical source and destination guides.');
  // This source adapter is intentionally narrow. Other owners must supply their
  // own saved-record/revision contract; a guide ID is never proof of ownership.
  if(input.sourceSystem!=='civweave'||input.ownerSystem!=='civweave'||input.artifactClass!=='weave')return referenceFailure('PASSOVER_REFERENCE_SOURCE_UNSUPPORTED','Only saved Weaveling Quest references have an implemented source adapter.');
  const targetClass=input.targetArtifactClass||artifactForSystem(input.targetSystem);
  if(ownerFor(targetClass)!==input.targetSystem)return referenceFailure('PASSOVER_REFERENCE_TARGET_INVALID','The destination artifact class must belong to its canonical guide.');
  if(typeof input.artifactRef!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,179}$/.test(input.artifactRef))return referenceFailure('PASSOVER_REFERENCE_INVALID','Supply an exact saved Quest identifier.');
  const revision=input.artifactRevision;if(!(Number.isInteger(revision)&&revision>0||typeof revision==='string'&&revision.length>0&&revision.length<=120))return referenceFailure('PASSOVER_REFERENCE_REVISION_INVALID','Supply the exact saved artifact revision.');
  let rows;try{rows=parse(localStorage.getItem('civweave.intentions.v127'),[])}catch{return referenceFailure('PASSOVER_REFERENCE_READ_FAILED','The canonical Quest ledger could not be read.');}
  const row=Array.isArray(rows)&&rows.find(item=>item?.kind==='weave-plan'&&(item.id===input.artifactRef||item.plan?.id===input.artifactRef)),plan=row?.plan;
  if(!plan||plan.id!==input.artifactRef||plan.schema!=='civweave.intention-weave.v1')return referenceFailure('PASSOVER_REFERENCE_NOT_FOUND','The saved Quest reference no longer exists.');
  const actualRevision=plan.authoring?.receipt?.artifactRevision||plan.updatedAt||row.updatedAt;
  if(actualRevision!==revision)return referenceFailure('PASSOVER_REFERENCE_REVISION_CONFLICT','The saved Quest revision changed. Offer its current reference explicitly.');
  return{ok:true,targetArtifactClass:targetClass};
}
function offerArtifactReference(input={}){
  if(input.consent?.declared!==true)return referenceFailure('PASSOVER_REFERENCE_CONSENT_REQUIRED','Explicit consent is required to offer this saved artifact reference.');
  const validation=validateArtifactReference(input);if(!validation.ok)return validation;
  const offer={schema:'civweave.guide-capability-passover.v1',id:uid(),kind:'artifact-reference',state:'offered',sourceSystem:input.sourceSystem,targetSystem:input.targetSystem,ownerSystem:input.ownerSystem,artifactClass:input.artifactClass,targetArtifactClass:validation.targetArtifactClass,artifactRef:input.artifactRef,artifactRevision:input.artifactRevision,consent:{declared:true,scope:'artifact-reference-only'},createdAt:now(),acceptedAt:null,resubmit:false,materialized:false,destinationValidation:'required'};
  try{localStorage.setItem(referenceKey(offer.sourceSystem),JSON.stringify(offer))}catch{return referenceFailure('PASSOVER_REFERENCE_SAVE_FAILED','The reference offer could not be saved on this device.');}
  try{dispatchEvent(new CustomEvent('civweave:guide-artifact-reference-offered',{detail:{...offer}}))}catch{}
  return{ok:true,offer,inferenceInvocations:0};
}
async function acceptArtifactReference(input={}){
  if(input.confirmed!==true)return referenceFailure('PASSOVER_REFERENCE_CONSENT_REQUIRED','Explicitly accept the saved reference before opening another guide.');
  const offer=readArtifactReferenceOffer(input.sourceSystem);
  if(!offer||offer.kind!=='artifact-reference'||offer.id!==input.id||offer.sourceSystem!==input.sourceSystem||offer.targetSystem!==input.targetSystem||offer.artifactRef!==input.artifactRef||offer.artifactRevision!==input.artifactRevision||offer.consent?.declared!==true)return referenceFailure('PASSOVER_REFERENCE_OFFER_CONFLICT','Accept the exact current source, destination, saved artifact reference and revision.');
  const validation=validateArtifactReference(offer);if(!validation.ok)return validation;
  if(offer.state==='transferred-reference')return{ok:true,unchanged:true,offer,inferenceInvocations:0};
  if(offer.state!=='offered'||referenceAccepting.has(offer.id))return referenceFailure('PASSOVER_REFERENCE_BUSY','This reference transfer is already in progress.');
  const surface=globalThis.CivweaveGuideChatSurfaceV350||globalThis.CivweavePersistentGuideChatV215;
  if(typeof surface?.open!=='function'&&typeof surface?.switchGuide!=='function')return referenceFailure('PASSOVER_REFERENCE_DESTINATION_UNAVAILABLE','The shared destination guide cannot open yet.');
  referenceAccepting.add(offer.id);
  try{
    const opened=typeof surface.open==='function'?await surface.open({guide:offer.targetSystem,focus:true}):await surface.switchGuide(offer.targetSystem,{open:true,focus:true});
    if(opened===false)return referenceFailure('PASSOVER_REFERENCE_DESTINATION_UNAVAILABLE','The shared destination guide did not open.');
    const currentOffer=readArtifactReferenceOffer(offer.sourceSystem),currentValidation=validateArtifactReference(offer);
    if(currentOffer?.id!==offer.id)return referenceFailure('PASSOVER_REFERENCE_OFFER_CONFLICT','The current offer changed while the destination was opening.');
    if(!currentValidation.ok)return currentValidation;
    const next={...offer,state:'transferred-reference',acceptedAt:now(),materialized:false,destinationValidation:'required'};
    try{localStorage.setItem(referenceKey(offer.sourceSystem),JSON.stringify(next))}catch{return referenceFailure('PASSOVER_REFERENCE_SAVE_FAILED','The guide opened, but the reference transfer receipt could not be saved.');}
    try{dispatchEvent(new CustomEvent('civweave:guide-artifact-reference-transferred',{detail:{...next}}))}catch{}
    return{ok:true,offer:next,inferenceInvocations:0};
  }catch(error){return referenceFailure('PASSOVER_REFERENCE_DESTINATION_UNAVAILABLE',compact(error?.message||error,900));}finally{referenceAccepting.delete(offer.id)}
}

function canonicalPrompt(system,tiny=false){
  const own=canonicalFor(system);
  const vocabulary='Canonical Civweave artifact language: Weaveling creates Quests; Moss creates Learning Journeys; Kamiya creates Endeavors; Rook creates Manifests. A Quest is the cross-realm intention and route. A Learning Journey develops demonstrable capability. An Endeavor is productive work and may serve a Quest, but is not itself a Quest. A Manifest gathers skills, resources, materials, services, needs, and offers. Never call Kamiya a Questwright and never call a Kamiya artifact a Quest. Legacy internal words such as weave, curriculum, quest-draft, resource-manifest, or artifact classes are implementation details and must not redefine or leak into user-facing ownership.';
  const world='Call a person using Civweave a Hero, collaborating Heroes a Party, a host community a Guild, its operator a Guildkeeper, the regional charter role a Charterkeeper, and the map the Guild Map. Rook is the Quartermaster guide, not the Guild operator.';
  const identity=`You are ${own.guide}, ${own.role}. Your canonical artifact is ${own.artifact}.`;
  if(tiny)return`${identity} ${vocabulary} ${world} Be direct. Do not invent saved state, prices, votes, tool use, or execution. Consequential actions require explicit Hero approval. Return valid JSON with keys answer, choice, assumptions, requiresConsent, confidence, questDraft.`;
  return`Civweave canonical guide language v1. ${identity}\n\n${vocabulary}\n\n${world}\n\nUse these terms naturally and preserve the selected guide identity. Do not revive Hub, Hub Node, Node Steward, Territory Steward, Guild Steward, Questwright, or user-facing learning-path terminology.`;
}
function canonicalPromptRequest(request={}){
  const purpose=compact(request.purpose,240);if(!/^civweave-guide-response(?:-v141)?/.test(purpose)||request.__civweaveGuideLanguageApplied==='canonical-artifacts-v1')return request;
  const system=systemFor(request),messages=Array.isArray(request.messages)?request.messages.map(row=>({...row})):[],provider=compact(request?.config?.provider||request?.config?.route,80).toLowerCase(),model=compact(request?.config?.model,160),tiny=provider==='downloaded-local'&&TINY_LOCAL_MODELS.has(model);
  if(tiny){const recent=messages.filter(row=>row?.role!=='system').slice(-3);return{...request,messages:[{role:'system',content:canonicalPrompt(system,true)},...recent],__civweaveGuideLanguageApplied:'canonical-artifacts-v1',guidePromptProfile:'tiny-canonical-artifacts-v1'}}
  const prompt=canonicalPrompt(system,false),firstSystem=messages.findIndex(row=>row?.role==='system');
  if(firstSystem<0)messages.unshift({role:'system',content:prompt});else messages[firstSystem]={...messages[firstSystem],content:`${prompt}\n\n${messages[firstSystem].content||''}`};
  return{...request,messages,__civweaveGuideLanguageApplied:'canonical-artifacts-v1',guidePromptProfile:'canonical-artifacts-v1'};
}
function registerPromptMiddleware(){
  const spine=globalThis.CivweaveFastInteractiveV192;if(!spine?.register)return false;if(promptSpine===spine)return true;
  spine.register('canonical-guide-artifact-language-v1',{before:request=>({request:canonicalPromptRequest(request),state:{canonicalArtifactLanguage:true}})},130);promptSpine=spine;
  try{dispatchEvent(new CustomEvent('civweave:canonical-guide-language-installed',{detail:{version:VERSION,priority:130,beforeMiniLM:true}}))}catch{}
  return true;
}

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
#${ROOT_ID} .cw-capability-passover-v1{margin-top:8px;display:flex;align-items:center;gap:7px;flex-wrap:wrap}
#${ROOT_ID} .cw-capability-passover-v1 button{min-height:36px;padding:8px 12px;border:1px solid var(--guide-accent,#d8dde7);border-radius:10px;background:color-mix(in srgb,var(--guide-accent,#d8dde7) 22%,#0b1420);color:#fff;font:800 12px/1.2 Inter,system-ui,sans-serif;cursor:pointer}
#${ROOT_ID} .cw-capability-passover-v1 button:disabled{opacity:.68;cursor:default}
`;
  document.head?.append(style);
}

function canonicalizeText(system,value){
  let text=String(value??'');
  if(system==='living-school'){
    text=text.replace(/\blearning[- ]paths\b/gi,'Learning Journeys').replace(/\blearning[- ]path\b/gi,'Learning Journey');
  }else if(system==='cerbanimo'){
    text=text.replace(/\bQuestwright\b/g,'Endeavor guide').replace(/\bquests\b/gi,match=>match[0]===match[0].toUpperCase()?'ENDEAVORS':'Endeavors').replace(/\bquest\b/gi,match=>match[0]===match[0].toUpperCase()?'ENDEAVOR':'Endeavor');
  }else if(system==='fellowfare'){
    text=text.replace(/\bresource manifests\b/gi,'Manifests').replace(/\bresource manifest\b/gi,'Manifest').replace(/\bskill manifests\b/gi,'Manifests').replace(/\bskill manifest\b/gi,'Manifest');
  }
  return text;
}
function canonicalizeResult(result,system){
  if(!result||typeof result!=='object')return result;
  const next={...result};
  if(result.response&&typeof result.response==='object'){
    next.response={...result.response};
    if(typeof next.response.answer==='string')next.response.answer=canonicalizeText(system,next.response.answer);
    if(next.response.choice&&typeof next.response.choice==='object')next.response.choice={...next.response.choice,nextAction:canonicalizeText(system,next.response.choice.nextAction||'')};
  }
  next.context={...(result.context||{}),canonicalArtifactLanguage:{guide:canonicalFor(system).guide,artifact:canonicalFor(system).artifact,plural:canonicalFor(system).plural,internalArtifactClass:canonicalFor(system).internalArtifactClass}};
  return next;
}
function applySurfaceLanguage(){
  const root=document.getElementById(ROOT_ID),surface=globalThis.CivweaveGuideChatSurfaceV350||globalThis.CivweavePersistentGuideChatV215;if(!root||!surface)return false;
  const system=surface.activeWindow?.()||surface.state?.().activeSystem||'civweave',language=canonicalFor(system),role=root.querySelector('[data-guide-role]');
  if(role)role.textContent=language.role;
  root.dataset.canonicalArtifact=language.artifact;
  return true;
}

function publishRoute(route,artifact,sourceSystem){
  const base=route&&typeof route==='object'?route:{},canonical=ARTIFACT_LABEL[artifact]||artifact;
  const detail={schema:'civweave.response-route.v1',lengthClass:base.lengthClass||'fast',taskClass:base.taskClass||'structured-artifact',artifactClass:artifact,canonicalArtifactName:canonical,networkRequired:true,complexity:Number(base.complexity)||0,confidence:Number(base.confidence)||.98,source:base.source?`${base.source}+canonical-capability-owner`:'canonical-capability-owner-passover',tier:base.tier||null,reviewRequired:Boolean(base.reviewRequired),reviewTier:base.reviewTier||null,provider:'capability-passover',system:sourceSystem,capabilityPassover:true};
  try{dispatchEvent(new CustomEvent('civweave:response-route',{detail}))}catch{}
  return detail;
}
async function confirmedArtifact(text,sourceSystem,candidate){
  let route=null;
  try{
    const router=globalThis.CivweaveResponseRouterV347;
    if(typeof router?.classify==='function')route=await router.classify(text,{purpose:'guide-capability-owner-passover',executionProfile:'interactive',context:{guide:{system:sourceSystem}},task:{systemId:sourceSystem}});
  }catch{}
  const routed=compact(route?.artifactClass,80),details=candidateDetails(text),artifact=details.explicitCanonical?candidate:(OWNER[routed]?routed:candidate);
  return{artifact,route:publishRoute(route,artifact,sourceSystem)};
}
function handoffResult(options,sourceSystem,targetSystem,artifact,route){
  const source=GUIDE[sourceSystem]||GUIDE.civweave,target=GUIDE[targetSystem]||GUIDE.civweave,label=ARTIFACT_LABEL[artifact]||'specialized artifact';
  const sourceText=preserve(options?.text,12000),plural=CANONICAL[targetSystem]?.plural||`${label}s`,answer=`Talk to ${target.name} in ${target.label} for this. ${target.name} makes ${plural}, so I’ll keep ${source.name} focused on ${source.focus} instead of duplicating that capability here.`;
  const handoff={schema:'civweave.guide-capability-passover.v1',id:uid(),kind:'guide-capability-passover',sourceSystem,targetSystem,sourceText,artifactClass:artifact,canonicalArtifactName:label,label:`Pass to ${target.name}`,createdAt:now(),resubmit:true,open:true};
  return{response:{answer,choice:{mode:MODE[targetSystem]||'Plan',system:targetSystem,room:'',nextAction:`Use “Pass to ${target.name}” to send your request to ${target.name} and open that chat.`},assumptions:[],requiresConsent:false,confidence:.99,handoffSystem:targetSystem},provider:'unified-chat-passover',model:'canonical-capability-owner-router',handoff,responseRouting:route,context:{guide:{system:sourceSystem,name:source.name},capability:'passover',requestedArtifact:artifact,canonicalArtifactName:label,capabilityOwner:targetSystem},fallbackFrom:null};
}
async function maybePassover(options={}){
  const sourceSystem=systemFor(options),text=preserve(options.text,12000),candidate=candidateArtifact(text),candidateOwner=ownerFor(candidate);if(!candidate||!candidateOwner||candidateOwner===sourceSystem)return null;
  const confirmed=await confirmedArtifact(text,sourceSystem,candidate),targetSystem=ownerFor(confirmed.artifact);if(!targetSystem||targetSystem===sourceSystem)return null;
  return handoffResult(options,sourceSystem,targetSystem,confirmed.artifact,confirmed.route);
}
function prepareOwnedRequest(options={}){
  const sourceSystem=systemFor(options),details=candidateDetails(options.text),artifact=details.artifact;
  if(!artifact||ownerFor(artifact)!==sourceSystem)return options;
  return{...options,artifactKind:DECLARED_KIND[artifact]||options.artifactKind,context:{...(options.context||{}),canonicalArtifactLanguage:{guide:canonicalFor(sourceSystem).guide,artifact:canonicalFor(sourceSystem).artifact,plural:canonicalFor(sourceSystem).plural,internalArtifactClass:artifact}}};
}
function remember(result){
  const handoff=result?.handoff;if(!handoff?.sourceSystem)return null;
  const offer={...handoff,answer:compact(result?.response?.answer,10000),acceptedAt:null};writeOffer(offer);scheduleDecorate();
  try{dispatchEvent(new CustomEvent('civweave:guide-passover-offered',{detail:offer}))}catch{}
  return offer;
}
function hasResponseLayer(fn,flag){let current=fn,depth=0;while(typeof current==='function'&&depth<16){if(current[flag])return true;current=current.__prior;depth++}return false}
function patchAssistant(){
  const api=globalThis.CivweaveAssistantV141,originalFn=api?.respond;if(!originalFn)return false;
  if(hasResponseLayer(originalFn,'__cwGuideCapabilityPassoverV1')){assistantPatched=true;return true}
  const original=originalFn.bind(api),respond=async options=>{
    const sourceSystem=systemFor(options||{}),passover=await maybePassover(options||{});if(passover){remember(passover);return canonicalizeResult(passover,sourceSystem)}
    const result=await original(prepareOwnedRequest(options||{}));return canonicalizeResult(result,sourceSystem);
  };
  respond.__cwGuideCapabilityPassoverV1=true;
  respond.__prior=originalFn;
  for(const key of ['__cwUnifiedChatSystemV1','__weavelingPlanJsonV190','__guideIdentityIntegrityV216','__deterministicModeV175'])if(originalFn[key])respond[key]=originalFn[key];
  try{api.respond=respond;assistantPatched=api.respond===respond}catch{}
  if(!assistantPatched){try{globalThis.CivweaveAssistantV141={...api,respond};assistantPatched=true}catch{}}
  return assistantPatched;
}
function matchingArticle(root,offer){
  const rows=[...root.querySelectorAll('[data-log] article[data-role="assistant"]')];
  return rows.find(row=>compact(row.querySelector('.cw350-bubble')?.textContent,10000).startsWith(offer.answer))||null;
}
function decorate(){
  installStyle();applySurfaceLanguage();const root=document.getElementById(ROOT_ID),surface=globalThis.CivweaveGuideChatSurfaceV350||globalThis.CivweavePersistentGuideChatV215;if(!root||!surface)return false;
  const sourceSystem=surface.activeWindow?.()||surface.state?.().activeSystem||'',offer=readOffer(sourceSystem);if(!offer?.answer||!SYSTEMS.includes(offer.targetSystem))return false;
  const article=matchingArticle(root,offer);if(!article)return false;const host=article.querySelector(':scope > div')||article;
  let box=host.querySelector('.cw-capability-passover-v1');if(!box){box=document.createElement('div');box.className='cw-capability-passover-v1';host.append(box)}
  let button=box.querySelector('button');if(!button){button=document.createElement('button');button.type='button';box.append(button)}
  button.dataset.passoverSource=offer.sourceSystem;button.dataset.passoverId=offer.id;button.disabled=Boolean(offer.acceptedAt);button.textContent=offer.acceptedAt?`Passed to ${GUIDE[offer.targetSystem]?.name||'guide'}`:offer.label||`Pass to ${GUIDE[offer.targetSystem]?.name||'guide'}`;
  return true;
}
function scheduleDecorate(){if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>decorate());else setTimeout(decorate,0)}
async function acceptOffer(sourceSystem,id){
  const offer=readOffer(sourceSystem);if(!offer||offer.id!==id||offer.acceptedAt)return false;
  const surface=globalThis.CivweaveGuideChatSurfaceV350||globalThis.CivweavePersistentGuideChatV215;if(!surface?.submitText||!SYSTEMS.includes(offer.targetSystem)||!preserve(offer.sourceText))return false;
  writeOffer({...offer,acceptedAt:now()});decorate();surface.switchGuide?.(offer.targetSystem,{open:true,focus:false});
  let ok=false;try{ok=(await surface.submitText(offer.sourceText,offer.targetSystem))!==false}catch{}
  if(!ok){writeOffer({...offer,acceptedAt:null});scheduleDecorate();return false}
  surface.open?.({guide:offer.targetSystem,focus:true});
  try{dispatchEvent(new CustomEvent('civweave:guide-passover-accepted',{detail:{...offer,acceptedAt:now()}}))}catch{}
  return true;
}
function bindClick(){
  if(clickBound)return;clickBound=true;
  addEventListener('click',event=>{const button=event.target?.closest?.('.cw-capability-passover-v1 button');if(!button)return;event.preventDefault();event.stopPropagation();if(button.disabled)return;button.disabled=true;void acceptOffer(compact(button.dataset.passoverSource,80),compact(button.dataset.passoverId,120))},true);
}
function synchronize(){patchAssistant();registerPromptMiddleware();bindClick();scheduleDecorate();document.documentElement.dataset.civweaveCapabilityPassover='v1';document.documentElement.dataset.civweaveGuideArtifactLanguage='canonical-v1';return true}
function start(){
  synchronize();
  for(const name of ['civweave:assistant-runtime-ready','civweave:response-router-installed','civweave:runtime-spine-ready','civweave:unified-chat-system-ready','civweave:guide-chat-ready','civweave:guide-chat-opened','civweave:guide-chat-state','civweave:realm-guide-thread-changed','pageshow'])addEventListener(name,()=>queueMicrotask(synchronize));
}

const api=Object.freeze({version:VERSION,owners:OWNER,systems:SYSTEMS,canonicalLanguage:CANONICAL,canonicalFor,artifactForSystem,candidateArtifact,candidateDetails,explicitCanonicalArtifact,directCanonicalArtifact,mentionedCanonicalArtifact,canonicalPrompt,canonicalPromptRequest,registerPromptMiddleware,ownerFor,maybePassover,prepareOwnedRequest,acceptOffer,offerArtifactReference,acceptArtifactReference,readArtifactReferenceOffer,decorate,synchronize,preservesLivingSchoolGenerator:true,passoverResubmitsOriginal:true,artifactReferenceResubmits:false,canonicalUserFacingTerms:true,canonicalPromptBeforeMiniLM:true});
globalThis.CivweaveGuideCapabilityPassoverV1=api;
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
