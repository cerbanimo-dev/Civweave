(()=>{
'use strict';
const VERSION='3.0.0-cerbanimo-chat-quest-capability-v3-gemini-provider-authority';
const TRANSPORT_SCHEMA=Object.freeze({type:'object'});
const GEMINI_CHAIN=Object.freeze(['gemini-3.7-flash','gemini-3.5-flash','gemini-3.1-flash-lite']);
const GEMINI_LITE='gemini-3.1-flash-lite';
const QUEST_INTENT=/\b(?:help\s+(?:me|us)\s+|(?:i|we)\s+(?:want|need|would\s+like|plan|intend|aim)\s+to\s+|please\s+)?(?:build|create|make|start|organize|launch|open|set\s*up|form|develop|design|run|establish|put\s+together|implement|complete|finish|deliver|ship|repair|fix|restore|migrate|deploy)\b/i;
const TEST=/^\s*(?:test|testing|ping|check|mic check)\s*[.!?]*\s*$/i;
if(globalThis.CivweaveCerbanimoChatQuestCapabilityV3?.version===VERSION)return;
let installed=false,timer=0;
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const now=()=>new Date().toISOString();
function v2(){return globalThis.CivweaveCerbanimoChatQuestCapabilityV2||null}
function selectedConfig(){
  try{const config=globalThis.CivweaveAssistantV141?.selectedConfig?.();if(config&&(config.provider||config.route||config.model))return config}catch{}
  try{const config=globalThis.CivweaveModelRuntime?.readSharedConfig?.('interactive');if(config&&(config.provider||config.route||config.model))return config}catch{}
  return null;
}
function provider(config={}){return clean(config.provider||config.route,120).toLowerCase()}
function packet(answer,nextAction='',extra={}){
  return{response:{answer,choice:{mode:'Build',system:'cerbanimo',room:'',nextAction},assumptions:Array.isArray(extra.assumptions)?extra.assumptions:[],requiresConsent:false,confidence:1},provider:extra.provider||'cerbanimo-endeavor-capability-v3',model:extra.model||'',action:extra.action||null,context:{guide:{system:'cerbanimo',name:'Kamiya'},capability:'endeavor-authoring',canonicalArtifact:'Endeavor',providerAuthority:'selected-provider'},fallbackFrom:null};
}
function requestContext(request={}){
  const history=(Array.isArray(request.history)?request.history:[]).slice(-8).map(row=>({role:clean(row?.role,40),text:clean(row?.text||row?.content,1000)})).filter(row=>row.text);
  return{schema:'civweave.cerbanimo.endeavor-authoring-request.v3',objective:clean(request.text,5000),recentConversation:history,constraints:['Return one executable Cerbanimo Endeavor, not advice or a tutorial.','Use 3 to 5 concise work units in dependency order.','Every work unit must include title, result, proof, and acceptanceCriteria.','Keep description under 420 characters and each work-unit field under 220 characters.','Do not claim that any real-world work has already happened.','Make reasonable assumptions when details are missing.','Return one complete JSON object only.']};
}
function taskContract(){return{schema:'civweave.ai-task.v2',kind:'quest-authoring',systemId:'cerbanimo',complexity:'routine',requirements:{profile:'interactive',requiresTools:false,externalResearch:false,code:false,planning:true,structuredOutput:true,vision:false,complexity:false}}}
function authoringRequest(context,config){
  return{purpose:'cerbanimo-endeavor-authoring-v3',executionProfile:'interactive',config,schema:TRANSPORT_SCHEMA,responseFormat:'json',maxRepairAttempts:0,context,task:taskContract(),capabilityRequirements:{profile:'interactive',requiresTools:false,externalResearch:false,planning:true,structuredOutput:true},messages:[{role:'system',content:'You are Kamiya, Cerbanimo’s Endeavor guide. Return exactly one complete JSON object with title, objective, description, workUnits, assumptions. Use 3 to 5 concise workUnits. Each workUnit must have title, result, proof, acceptanceCriteria. Keep every string short. No markdown, commentary, or text outside the JSON object.'},{role:'user',content:`Create the Endeavor for this request:\n${JSON.stringify(context)}`} ]};
}
function resultModel(result,config={}){return clean(result?.actual?.model||result?.requested?.model||result?.model||config.model,240).toLowerCase()}
function resultProvider(result,config={}){return clean(result?.actual?.provider||result?.requested?.provider||result?.provider||config.provider||config.route,120).toLowerCase()}
function providerErrorResult(error,config={}){
  const helper=v2()?.providerErrorResult;if(typeof helper==='function')return helper(error,config);
  const message=clean(error?.message||error,2400),match=message.match(/\bHTTP\s*(\d{3})\b/i);
  return{status:'provider-error',requested:{provider:provider(config),model:clean(config.model,240)},actual:{provider:provider(config),model:clean(config.model,240)},error:{status:match?Number(match[1]):undefined,code:clean(error?.code,120)||'PROVIDER_EXCEPTION',message}};
}
function transient(result,config){
  const helper=v2()?.geminiTransientFailure;if(typeof helper==='function')return helper(result,config);
  const status=Number(result?.error?.status||0),message=clean(result?.error?.message||'',3000);
  return resultProvider(result,config)==='gemini'&&(status===429||[500,502,503,504].includes(status)||/RESOURCE_EXHAUSTED|UNAVAILABLE|quota|rate.?limit|high demand|overloaded|temporar/i.test(message));
}
function nextGemini(model){const i=GEMINI_CHAIN.indexOf(clean(model,240).toLowerCase());return i>=0&&i<GEMINI_CHAIN.length-1?GEMINI_CHAIN[i+1]:''}
function attachGeminiFailover(result,models,success){
  if(models.length<2)return result;
  const meta={schema:'civweave.gemini-provider-authority-failover.v1',purpose:'cerbanimo-endeavor-authoring-v3',models:[...models],fromModel:models[0],toModel:models.at(-1),success:Boolean(success),provider:'gemini',crossProvider:false,at:now()};
  try{dispatchEvent(new CustomEvent('civweave:gemini-provider-authority-failover',{detail:meta}))}catch{}
  return{...result,geminiFailover:meta,geminiQuotaFailover:meta,diagnostics:[...(Array.isArray(result?.diagnostics)?result.diagnostics:[]),`Gemini-only failover: ${models.join(' → ')}`]};
}
async function generateGeminiOnly(runtime,request,config){
  const base=globalThis.CivweaveFastInteractiveV192?.base?.();
  let current;
  try{current=await runtime.generate(request)}catch(error){current=providerErrorResult(error,config)}
  if(!transient(current,config))return current;
  const start=resultModel(current,config)||clean(config.model,240).toLowerCase(),models=[start];
  if(!base?.generate)return attachGeminiFailover(current,models,false);
  let model=start;
  while(true){
    const next=nextGemini(model);if(!next)break;
    models.push(next);
    const nextConfig={...config,provider:'gemini',route:'gemini',model:next,stream:false};
    try{current=await base.generate({...request,executionProfile:'interactive',config:nextConfig,__civweaveGeminiProviderAuthority:true})}catch(error){current=providerErrorResult(error,nextConfig)}
    if(!transient(current,nextConfig))return attachGeminiFailover(current,models,true);
    model=next;
  }
  const exhausted=attachGeminiFailover(current,models,false),detail=clean(exhausted?.error?.message||'Gemini is temporarily unavailable.',1200);
  return{...exhausted,error:{...(exhausted?.error||{}),code:'GEMINI_ONLY_CHAIN_EXHAUSTED',message:`Gemini could not complete this Endeavor after trying ${models.join(' → ')}. No neuron-backed provider was used. ${detail}`}};
}
function resultObject(result){return v2()?.resultObject?.(result)||null}
function normalizePlan(value){return v2()?.normalizeQuestPlan?.(value)}
function malformed(result){return Boolean(v2()?.malformedJsonResult?.(result))}
function completionText(result){return clean(v2()?.completionText?.(result)||result?.outputText||result?.text||'',24000)}
function repairMessages(context,attempt){
  if(attempt===1)return[{role:'system',content:'The previous Gemini output was malformed JSON. Regenerate from scratch on Gemini Flash-Lite. Return exactly one complete JSON object with title, objective, description, workUnits, assumptions. Use exactly 4 workUnits. Each workUnit needs title, result, proof, acceptanceCriteria. Keep every field under 180 characters. Do not quote or continue the broken output. No markdown.'},{role:'user',content:`Hero request: ${clean(context.objective,4000)}\nRegenerate the complete Endeavor JSON from scratch.`}];
  return[{role:'system',content:'Return compact valid JSON only. No markdown. No prose before or after it. Use exactly this key shape: {"title":"...","objective":"...","description":"...","workUnits":[{"title":"...","result":"...","proof":"...","acceptanceCriteria":"..."}],"assumptions":[]}. Create exactly 3 workUnits. Keep every string under 120 characters. The entire answer must be one complete JSON object. Do not continue any previous output.'},{role:'user',content:`Build a compact Endeavor for: ${clean(context.objective,3000)}`}];
}
async function repairOnLite(runtime,context,config,attempt){
  const base=globalThis.CivweaveFastInteractiveV192?.base?.();
  if(!base?.generate)return{status:'provider-error',actual:{provider:'gemini',model:GEMINI_LITE},error:{code:'GEMINI_LITE_REPAIR_UNAVAILABLE',message:'Gemini Flash-Lite repair runtime is unavailable.'}};
  const repairConfig={...config,provider:'gemini',route:'gemini',model:GEMINI_LITE,stream:false,maxTokens:attempt===1?3000:2200,temperature:attempt===1?.05:0};
  const request={purpose:`cerbanimo-endeavor-authoring-lite-repair-v3-${attempt}`,executionProfile:'interactive',config:repairConfig,maxRepairAttempts:0,context,task:taskContract(),capabilityRequirements:{profile:'interactive',requiresTools:false,externalResearch:false,planning:true,structuredOutput:attempt===1},messages:repairMessages(context,attempt),...(attempt===1?{schema:TRANSPORT_SCHEMA,responseFormat:'json'}:{responseFormat:'text'})};
  try{return await base.generate({...request,__civweaveGeminiProviderAuthority:true,__civweaveGeminiLiteRepair:true})}catch(error){return providerErrorResult(error,repairConfig)}
}
function parsePlan(result){
  const object=resultObject(result);if(!object)throw new Error('Gemini did not return a parseable Endeavor JSON object.');
  const plan=normalizePlan(object);if(!plan)throw new Error('Gemini returned an incomplete Endeavor.');
  return plan;
}
async function planWithLiteRepair(runtime,initial,config,context){
  try{return{plan:parsePlan(initial),result:initial,repairAttempts:0}}catch(firstError){
    let last=initial,lastError=firstError;
    for(let attempt=1;attempt<=2;attempt+=1){
      last=await repairOnLite(runtime,context,config,attempt);
      if(transient(last,{provider:'gemini',route:'gemini',model:GEMINI_LITE})){lastError=new Error(clean(last?.error?.message||'Gemini Flash-Lite is temporarily unavailable.',1200));continue}
      try{return{plan:parsePlan(last),result:last,repairAttempts:attempt}}catch(error){lastError=error}
    }
    const detail=malformed(last)?clean(last?.structured?.errors?.join('; ')||lastError?.message,900):clean(lastError?.message,900);
    return{error:new Error(`Gemini Flash-Lite could not produce valid Endeavor JSON after two repair attempts. No neuron-backed provider was used.${detail?` ${detail}`:''}`),result:last,repairAttempts:2};
  }
}
async function ensureQuestEngine(){
  if(globalThis.CivweaveCerbanimoQuestV144?.createQuestFromInput&&globalThis.CivweaveCerbanimoQuestV144?.addQuest)return globalThis.CivweaveCerbanimoQuestV144;
  const existing=[...document.scripts].find(script=>{try{return new URL(script.src,location.href).pathname==='/app/cerbanimo-quest-engine-v144.js'}catch{return false}});
  if(existing){await new Promise(resolve=>{if(globalThis.CivweaveCerbanimoQuestV144)return resolve();existing.addEventListener('load',resolve,{once:true});setTimeout(resolve,1800)});return globalThis.CivweaveCerbanimoQuestV144||null}
  await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/app/cerbanimo-quest-engine-v144.js?v=quest-engine-r25-frame-bounded';script.async=false;script.onload=resolve;script.onerror=()=>reject(new Error('Cerbanimo Endeavor Engine could not load.'));document.head?.append(script)});
  return globalThis.CivweaveCerbanimoQuestV144||null;
}
async function createGeminiEndeavor(request={}){
  let config=selectedConfig();
  try{await globalThis.CivweaveFamilyAILoaderV105?.ensure?.();config=selectedConfig()||config}catch(error){return packet(`I could not start Endeavor generation. Nothing was created or saved.\n\nGeneration detail: ${clean(error?.message||error,900)}`,'Retry after Gemini is ready.',{provider:'gemini',model:clean(config?.model,240)})}
  const runtime=globalThis.CivweaveModelRuntime;
  if(!runtime?.generate||!config)return packet('I could not start Endeavor generation because Gemini is unavailable. Nothing was created or saved.','Retry after Gemini is ready.',{provider:'gemini',model:clean(config?.model,240)});
  const planConfig={...config,provider:'gemini',route:'gemini',maxTokens:Math.min(3200,Math.max(2200,Number(config.maxTokens)||2200)),temperature:Math.min(.2,Math.max(.05,Number(config.temperature)||.15)),stream:false},context=requestContext(request);
  try{
    const initial=await generateGeminiOnly(runtime,authoringRequest(context,planConfig),planConfig);
    if(transient(initial,planConfig)&&String(initial?.error?.code||'')==='GEMINI_ONLY_CHAIN_EXHAUSTED')throw new Error(initial.error.message);
    const normalized=await planWithLiteRepair(runtime,initial,planConfig,context);if(normalized.error)throw normalized.error;
    const result=normalized.result,plan=normalized.plan,model=resultModel(result,{model:GEMINI_LITE})||GEMINI_LITE,engine=await ensureQuestEngine();
    if(!engine?.createQuestFromInput||!engine?.addQuest)throw new Error('Cerbanimo Endeavor Engine is unavailable.');
    const sourceActionId=`kamiya-chat:${Date.now().toString(36)}:${Math.random().toString(36).slice(2,8)}`,description=[plan.description,plan.assumptions.length?`Assumptions:\n${plan.assumptions.map(item=>`- ${item}`).join('\n')}`:''].filter(Boolean).join('\n\n');
    const quest=engine.createQuestFromInput({title:plan.title,objective:plan.objective,description,steps:plan.workUnits.map(unit=>`${unit.title}: ${unit.result}`),acceptanceCriteria:plan.workUnits.map(unit=>`${unit.title} — ${unit.acceptanceCriteria}`),proofRequirements:plan.workUnits.map(unit=>`${unit.title} — ${unit.proof}`),source:'kamiya-chat-ai-quest',sourceActionId,sequential:true});
    if(Array.isArray(quest?.tasks))quest.tasks.forEach((task,index)=>{const criterion=clean(plan.workUnits[index]?.acceptanceCriteria,1200);if(criterion)task.acceptanceCriteria=[criterion]});
    const geminiFailover=result?.geminiFailover||initial?.geminiFailover||null;
    quest.authoring={mode:'model-json-application-validated',aiGenerated:true,provider:'gemini',model,providerAuthority:'gemini-only',crossProviderFailover:false,applicationValidator:'cerbanimo-endeavor-v3',repairAttempts:normalized.repairAttempts,geminiFailover,createdAt:now()};
    const added=engine.addQuest(quest,{activate:true});if(added?.ok===false)throw new Error(added.error||added.reason||'Cerbanimo rejected the generated Endeavor.');
    const saved=added?.quest||quest,count=Array.isArray(saved.tasks)?saved.tasks.length:plan.workUnits.length,first=clean(saved.tasks?.[0]?.title||plan.workUnits[0]?.title,220),notes=[];
    if(geminiFailover?.models?.length>1)notes.push(`Gemini failover: ${geminiFailover.models.join(' → ')}`);if(normalized.repairAttempts)notes.push(`Flash-Lite JSON repair attempts: ${normalized.repairAttempts}`);
    try{dispatchEvent(new CustomEvent('civweave:cerbanimo-chat-quest-created',{detail:{questId:saved.id,title:saved.title,taskCount:count,provider:'gemini',model,sourceActionId,repairAttempts:normalized.repairAttempts,providerAuthority:'gemini-only',crossProviderFailover:false,geminiFailover}}))}catch{}
    return packet(`Endeavor created: “${clean(saved.title||plan.title,240)}”\n\n${count} work unit${count===1?'':'s'} are active in Cerbanimo, each with a proof gate and completion criteria.${notes.length?`\n\n${notes.join(' · ')}`:''}`,first?`Start: ${first}`:'Open the Workboard to begin.',{provider:'gemini',model,assumptions:plan.assumptions,action:{kind:'cerbanimo-quest-created',system:'cerbanimo',state:'active',questId:saved.id||'',title:saved.title||plan.title,taskCount:count,source:'kamiya-chat-ai-quest',canonicalArtifact:'Endeavor'}});
  }catch(error){return packet(`I could not create the Endeavor. Nothing was saved.\n\nGeneration detail: ${clean(error?.message||error,1200)}`,'Retry the Endeavor or choose another AI model.',{provider:'gemini',model:GEMINI_LITE})}
}
async function handler(request,next){
  const text=clean(request?.text,12000);if(!text||TEST.test(text)||!QUEST_INTENT.test(text))return next(request);
  const config=selectedConfig();if(provider(config)!=='gemini')return v2()?.handler? v2().handler(request,next):next(request);
  return createGeminiEndeavor(request);
}
function register(){const chat=globalThis.CivweaveUnifiedChatSystemV1;if(!chat?.registerCapability)return false;chat.registerCapability('cerbanimo',handler);installed=true;try{dispatchEvent(new CustomEvent('civweave:cerbanimo-chat-quest-capability-ready',{detail:{version:VERSION,system:'cerbanimo',providerAuthority:'selected-provider',geminiAuthority:'gemini-only',crossProviderFailover:false,geminiLiteRepairAttempts:2}}))}catch{}return true}
function install(){register();setTimeout(register,220);return true}
for(const name of ['civweave:unified-chat-system-ready','civweave:guide-loader-reset','civweave:assistant-runtime-ready','pageshow'])addEventListener(name,()=>queueMicrotask(register));
install();let attempts=0;timer=setInterval(()=>{attempts+=1;register();if(installed&&attempts>=2||attempts>=8)clearInterval(timer)},250);addEventListener('pagehide',()=>clearInterval(timer),{once:true});
globalThis.CivweaveCerbanimoChatQuestCapabilityV3=Object.freeze({version:VERSION,install,handler,createGeminiEndeavor,generateGeminiOnly,planWithLiteRepair,repairOnLite,questIntent:text=>QUEST_INTENT.test(clean(text,12000)),providerAuthority:'selected-provider',geminiAuthority:'gemini-only',crossProviderFailover:false,geminiLiteRepairAttempts:2,state:()=>({installed})});
})();
