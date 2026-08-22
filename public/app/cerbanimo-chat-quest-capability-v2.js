(()=>{
'use strict';
const VERSION='2.0.0-cerbanimo-chat-quest-capability-v2-recoverable-json';
const TRANSPORT_SCHEMA=Object.freeze({type:'object'});
const GEMINI_QUOTA_CHAIN=Object.freeze(['gemini-3.7-flash','gemini-3.5-flash','gemini-3.1-flash-lite']);
const LOCAL_PROVIDERS=new Set(['downloaded-local','generative-local','local-ai','smollm2','smollm3','qwen','browser']);
const QUEST_INTENT=/\b(?:help\s+(?:me|us)\s+|(?:i|we)\s+(?:want|need|would\s+like|plan|intend|aim)\s+to\s+|please\s+)?(?:build|create|make|start|organize|launch|open|set\s*up|form|develop|design|run|establish|put\s+together|implement|complete|finish|deliver|ship|repair|fix|restore|migrate|deploy)\b/i;
const TEST=/^\s*(?:test|testing|ping|check|mic check)\s*[.!?]*\s*$/i;
if(globalThis.CivweaveCerbanimoChatQuestCapabilityV2?.version===VERSION)return;
let installed=false,timer=0;
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback=null)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const now=()=>new Date().toISOString();
const okStatus=result=>['success','fallback'].includes(String(result?.status||'').toLowerCase());
function completionText(value,depth=0){
  if(depth>6||value==null)return'';
  if(typeof value==='string'){
    const text=value.trim();
    if(!text)return'';
    if((text.startsWith('{')||text.startsWith('['))&&text.length<5_000_000){const parsed=parse(text,null);if(parsed){const nested=completionText(parsed,depth+1);if(nested)return nested}}
    return text;
  }
  if(typeof value!=='object')return'';
  const message=value?.choices?.[0]?.message;
  if(typeof message?.content==='string'&&message.content.trim())return message.content.trim();
  if(Array.isArray(message?.content)){
    const text=message.content.map(part=>typeof part==='string'?part:part?.text||part?.content||'').filter(Boolean).join('');
    if(text.trim())return text.trim();
  }
  if(typeof value?.choices?.[0]?.text==='string'&&value.choices[0].text.trim())return value.choices[0].text.trim();
  for(const candidate of [value.outputText,value.text,value.response,value.output,value.result,value.data]){const nested=completionText(candidate,depth+1);if(nested)return nested}
  return'';
}
function resultObject(result){
  for(const candidate of [result?.outputJson,result?.recoverablePayload,result?.choices?.[0]?.message?.parsed])if(candidate&&typeof candidate==='object'&&!Array.isArray(candidate))return candidate;
  const text=completionText(result).replace(/<think>[\s\S]*?<\/think>/gi,'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const parsed=parse(text,null);
  return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:null;
}
function selectedConfig(){
  try{const config=globalThis.CivweaveAssistantV141?.selectedConfig?.();if(config&&(config.provider||config.route||config.model))return config}catch{}
  try{const config=globalThis.CivweaveModelRuntime?.readSharedConfig?.('interactive');if(config&&(config.provider||config.route||config.model))return config}catch{}
  return null;
}
function resultProvider(result,config={}){return clean(result?.actual?.provider||result?.requested?.provider||result?.provider||config.provider||config.route,120).toLowerCase()}
function resultModel(result,config={}){return clean(result?.actual?.model||result?.requested?.model||result?.model||config.model,240).toLowerCase()}
function geminiQuotaFailure(result,config={}){
  if(!result||typeof result!=='object'||resultProvider(result,config)!=='gemini')return false;
  const status=Number(result?.error?.status??result?.statusCode??result?.status_code??0),message=clean(result?.error?.message||result?.error||result?.diagnostic||'',6000);
  return status===429||/\b(?:HTTP\s*429|RESOURCE_EXHAUSTED|quota exceeded|quota failure|rate[- ]?limit(?:ed|ing)?)\b/i.test(message);
}
function nextGeminiModel(model){const index=GEMINI_QUOTA_CHAIN.indexOf(clean(model,240).toLowerCase());return index>=0&&index<GEMINI_QUOTA_CHAIN.length-1?GEMINI_QUOTA_CHAIN[index+1]:''}
function failoverMeta(models,success){return{schema:'civweave.gemini-quota-failover.v2',purpose:'cerbanimo-endeavor-authoring-v2',models:models.filter(Boolean),fromModel:models[0]||'',toModel:models.at(-1)||'',success:Boolean(success),at:now()}}
function attachFailover(result,models,success){
  if(models.length<2)return result;
  const meta=failoverMeta(models,success),message=`Gemini quota failover: ${meta.models.join(' → ')}${success?' succeeded.':' stopped without a valid model result.'}`;
  try{dispatchEvent(new CustomEvent('civweave:gemini-quota-failover',{detail:meta}))}catch{}
  return{...result,geminiQuotaFailover:meta,diagnostics:[...(Array.isArray(result?.diagnostics)?result.diagnostics:[]),message],fallback:{...(result?.fallback||{}),used:success||Boolean(result?.fallback?.used),provider:'gemini',reason:'quota-model-failover',fromModel:meta.fromModel,model:meta.toModel}};
}
async function generateQuestModel(runtime,request,config,{direct=false,startModel=''}={}){
  const base=globalThis.CivweaveFastInteractiveV192?.base?.(),initialModel=clean(startModel||config?.model,240).toLowerCase();
  let result;
  if(direct&&base?.generate)result=await base.generate({...request,executionProfile:'interactive',config:{...(config||{}),provider:'gemini',route:'gemini',model:initialModel},__civweaveGeminiQuotaFailover:true});
  else result=await runtime.generate(request);
  if(!geminiQuotaFailure(result,config))return result;
  const actualStart=resultModel(result,{...config,model:initialModel})||initialModel,models=[actualStart];
  if(!base?.generate)return attachFailover(result,models,false);
  let current=result,currentModel=actualStart,next=nextGeminiModel(currentModel);
  while(next){
    models.push(next);
    try{dispatchEvent(new CustomEvent('civweave:gemini-quota-failover-attempt',{detail:{schema:'civweave.gemini-quota-failover-attempt.v2',purpose:'cerbanimo-endeavor-authoring-v2',fromModel:currentModel,toModel:next,at:now()}}))}catch{}
    current=await base.generate({...request,executionProfile:'interactive',config:{...(config||{}),provider:'gemini',route:'gemini',model:next},__civweaveGeminiQuotaFailover:true});
    if(!geminiQuotaFailure(current,{...config,provider:'gemini',route:'gemini',model:next}))return attachFailover(current,models,okStatus(current));
    currentModel=next;next=nextGeminiModel(currentModel);
  }
  const meta=failoverMeta(models,false);
  return{...attachFailover(current,models,false),geminiQuotaFailover:meta,error:{...(current?.error||{}),code:'GEMINI_QUOTA_CHAIN_EXHAUSTED',message:`Gemini quota is currently exhausted across ${models.join(' → ')}.`}};
}
function normalizeUnit(item,index){
  if(!item||typeof item!=='object')return null;
  const title=clean(item.title||item.name,220),result=clean(item.result||item.outcome||item.objective||item.deliverable,1400),proof=clean(item.proof||item.evidence||item.proofRequirement,1200),acceptanceCriteria=clean(item.acceptanceCriteria||item.acceptance||item.doneWhen||item.completionCriteria,1200);
  if(!title||!result||!proof||!acceptanceCriteria)return null;
  return{id:`work-${index+1}`,title,result,proof,acceptanceCriteria};
}
function normalizeQuestPlan(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('The selected AI did not return a JSON Endeavor object.');
  const rawUnits=Array.isArray(value.workUnits)?value.workUnits:Array.isArray(value.tasks)?value.tasks:Array.isArray(value.milestones)?value.milestones:Array.isArray(value.steps)?value.steps:[];
  const workUnits=rawUnits.map(normalizeUnit).filter(Boolean).slice(0,12);
  if(workUnits.length<3)throw new Error(`The selected AI returned ${workUnits.length} complete work units; at least 3 are required.`);
  const title=clean(value.title||value.name,240),objective=clean(value.objective||value.goal||value.outcome,1800),description=clean(value.description||value.summary||value.brief,3000),assumptions=(Array.isArray(value.assumptions)?value.assumptions:[]).map(item=>clean(item,700)).filter(Boolean).slice(0,8);
  if(!title||!objective||!description)throw new Error('The selected AI returned an incomplete Endeavor header.');
  return{title,objective,description,workUnits,assumptions};
}
function validationDetails(result){const errors=Array.isArray(result?.structured?.errors)?result.structured.errors:[];return errors.map(item=>clean(item,260)).filter(Boolean).slice(0,4)}
function packet(answer,nextAction='',extra={}){
  return{response:{answer,choice:{mode:'Build',system:'cerbanimo',room:'',nextAction},assumptions:Array.isArray(extra.assumptions)?extra.assumptions:[],requiresConsent:false,confidence:1},provider:extra.provider||'cerbanimo-endeavor-capability',model:extra.model||'',action:extra.action||null,context:{guide:{system:'cerbanimo',name:'Kamiya'},capability:'endeavor-authoring',canonicalArtifact:'Endeavor'},fallbackFrom:null};
}
function requestContext(request={}){
  const history=(Array.isArray(request.history)?request.history:[]).slice(-8).map(row=>({role:clean(row?.role,40),text:clean(row?.text||row?.content,1200)})).filter(row=>row.text);
  return{schema:'civweave.cerbanimo.endeavor-authoring-request.v2',objective:clean(request.text,5000),recentConversation:history,constraints:['Return one executable Cerbanimo Endeavor, not advice or a tutorial.','Use 3 to 12 concrete work units in dependency order.','Every work unit must include title, result, proof, and acceptanceCriteria.','Do not claim that any real-world work has already happened.','Make reasonable assumptions when details are missing and list them.','Return one JSON object only.']};
}
function modelRequest(context,config,purpose='cerbanimo-endeavor-authoring-v2',messages=null){
  return{purpose,executionProfile:'interactive',config,schema:TRANSPORT_SCHEMA,responseFormat:'json',maxRepairAttempts:0,context,task:{schema:'civweave.ai-task.v2',kind:'quest-authoring',systemId:'cerbanimo',complexity:'routine',requirements:{profile:'interactive',requiresTools:false,externalResearch:false,code:false,planning:true,structuredOutput:true,vision:false,complexity:false}},capabilityRequirements:{profile:'interactive',requiresTools:false,externalResearch:false,planning:true,structuredOutput:true},messages:messages||[{role:'system',content:'You are Kamiya, Cerbanimo’s Endeavor guide. Convert the Hero’s request into one executable Endeavor. Return exactly one JSON object. Required top-level fields: title, objective, description, workUnits, assumptions. workUnits must contain 3 to 12 objects, each with title, result, proof, acceptanceCriteria. Do not return prose, markdown, or a roadmap outside the JSON object.'},{role:'user',content:`Create the Cerbanimo Endeavor from this request:\n${JSON.stringify(context)}`}]};
}
function repairMessages(context,result,error){
  const candidate=resultObject(result)||completionText(result)||'';
  return[{role:'system',content:'Repair a Cerbanimo Endeavor JSON object. Return exactly one JSON object and nothing else. Required fields: title, objective, description, workUnits, assumptions. workUnits must contain 3 to 12 objects with title, result, proof, acceptanceCriteria. Preserve the Hero’s objective. Do not invent completed real-world work.'},{role:'user',content:`Hero request:\n${clean(context.objective,5000)}\n\nThe previous candidate was rejected because: ${clean(error?.message||error,800)}\n\nCandidate to repair:\n${clean(typeof candidate==='string'?candidate:JSON.stringify(candidate),18000)}`}];
}
async function planFromResult(runtime,result,request,config,context){
  try{return{plan:normalizeQuestPlan(resultObject(result)),result,repaired:false}}catch(firstError){
    const provider=resultProvider(result,config),model=resultModel(result,config)||clean(config.model,240).toLowerCase();
    if(!model)return{error:firstError,result};
    const repairConfig={...config,provider:provider||config.provider,route:provider||config.route,model,stream:false,maxTokens:Math.min(2400,Math.max(1200,Number(config.maxTokens)||1600)),temperature:.1};
    const repairRequest=modelRequest(context,repairConfig,'cerbanimo-endeavor-authoring-repair-v2',repairMessages(context,result,firstError));
    let repaired;
    if(provider==='gemini')repaired=await generateQuestModel(runtime,repairRequest,repairConfig,{direct:true,startModel:model});
    else repaired=await runtime.generate(repairRequest);
    if(!okStatus(repaired)&&!repaired?.recoverablePayload)return{error:new Error(validationDetails(repaired).join('; ')||repaired?.error?.message||`The repair model ended with ${repaired?.status||'an error'}.`),result:repaired};
    try{return{plan:normalizeQuestPlan(resultObject(repaired)),result:repaired,repaired:true}}catch(secondError){return{error:secondError,result:repaired}}
  }
}
async function ensureQuestEngine(){
  if(globalThis.CivweaveCerbanimoQuestV144?.createQuestFromInput&&globalThis.CivweaveCerbanimoQuestV144?.addQuest)return globalThis.CivweaveCerbanimoQuestV144;
  const existing=[...document.scripts].find(script=>{try{return new URL(script.src,location.href).pathname==='/app/cerbanimo-quest-engine-v144.js'}catch{return false}});
  if(existing){await new Promise(resolve=>{if(globalThis.CivweaveCerbanimoQuestV144)return resolve();existing.addEventListener('load',resolve,{once:true});setTimeout(resolve,1800)});return globalThis.CivweaveCerbanimoQuestV144||null}
  await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/app/cerbanimo-quest-engine-v144.js?v=quest-engine-r25-frame-bounded';script.async=false;script.onload=resolve;script.onerror=()=>reject(new Error('Cerbanimo Endeavor Engine could not load.'));document.head?.append(script)});
  return globalThis.CivweaveCerbanimoQuestV144||null;
}
async function createEndeavor(request={}){
  let config=selectedConfig();
  try{await globalThis.CivweaveFamilyAILoaderV105?.ensure?.();config=selectedConfig()||config}catch(error){return packet(`I could not start Endeavor generation. Nothing was created or saved.\n\nGeneration detail: ${clean(error?.message||error,900)}`,'Retry after the selected AI runtime is ready.',{provider:'cerbanimo-endeavor-model-error',model:clean(config?.model,240)})}
  const runtime=globalThis.CivweaveModelRuntime;
  if(!runtime?.generate||!config)return packet('I could not start Endeavor generation because the selected AI runtime is unavailable. Nothing was created or saved.','Retry after the selected AI runtime is ready.',{provider:'cerbanimo-endeavor-model-unavailable',model:clean(config?.model,240)});
  const requestedProvider=clean(config.provider||config.route,120).toLowerCase(),planConfig={...config,maxTokens:Math.min(2400,Math.max(1200,Number(config.maxTokens)||1600)),temperature:Math.min(.3,Math.max(.1,Number(config.temperature)||.2)),stream:false},context=requestContext(request);
  try{
    const requestPacket=modelRequest(context,planConfig),initial=await generateQuestModel(runtime,requestPacket,planConfig);
    if(!okStatus(initial)&&!initial?.recoverablePayload){
      const detail=validationDetails(initial).join('; ');
      throw new Error(detail||initial?.error?.message||`The selected AI ended with ${initial?.status||'an error'}.`);
    }
    const normalized=await planFromResult(runtime,initial,requestPacket,planConfig,context);
    if(normalized.error)throw normalized.error;
    const result=normalized.result,plan=normalized.plan,provider=clean(result?.actual?.provider||result?.provider||config.provider||config.route,120),model=clean(result?.actual?.model||result?.model||config.model,240),actualProvider=provider.toLowerCase();
    if(LOCAL_PROVIDERS.has(requestedProvider)&&!LOCAL_PROVIDERS.has(actualProvider))throw new Error(`The selected local model was bypassed by ${provider||'another provider'}, so Kamiya refused to create the Endeavor.`);
    const engine=await ensureQuestEngine();
    if(!engine?.createQuestFromInput||!engine?.addQuest)throw new Error('Cerbanimo Endeavor Engine is unavailable.');
    const sourceActionId=`kamiya-chat:${Date.now().toString(36)}:${Math.random().toString(36).slice(2,8)}`;
    const description=[plan.description,plan.assumptions.length?`Assumptions:\n${plan.assumptions.map(item=>`- ${item}`).join('\n')}`:''].filter(Boolean).join('\n\n');
    const quest=engine.createQuestFromInput({title:plan.title,objective:plan.objective,description,steps:plan.workUnits.map(unit=>`${unit.title}: ${unit.result}`),acceptanceCriteria:plan.workUnits.map(unit=>`${unit.title} — ${unit.acceptanceCriteria}`),proofRequirements:plan.workUnits.map(unit=>`${unit.title} — ${unit.proof}`),source:'kamiya-chat-ai-quest',sourceActionId,sequential:true});
    if(Array.isArray(quest?.tasks))quest.tasks.forEach((task,index)=>{const criterion=clean(plan.workUnits[index]?.acceptanceCriteria,1200);if(criterion)task.acceptanceCriteria=[criterion]});
    quest.authoring={mode:'model-json-application-validated',aiGenerated:true,provider,model,transportSchema:'json-object',applicationValidator:'cerbanimo-endeavor-v2',repaired:Boolean(normalized.repaired),geminiQuotaFailover:result?.geminiQuotaFailover||initial?.geminiQuotaFailover||null,createdAt:now()};
    const added=engine.addQuest(quest,{activate:true});
    if(added?.ok===false)throw new Error(added.error||added.reason||'Cerbanimo rejected the generated Endeavor.');
    const saved=added?.quest||quest,count=Array.isArray(saved.tasks)?saved.tasks.length:plan.workUnits.length,first=clean(saved.tasks?.[0]?.title||plan.workUnits[0]?.title,220),failover=result?.geminiQuotaFailover||initial?.geminiQuotaFailover;
    try{dispatchEvent(new CustomEvent('civweave:cerbanimo-chat-quest-created',{detail:{questId:saved.id,title:saved.title,taskCount:count,provider,model,sourceActionId,repaired:Boolean(normalized.repaired),geminiQuotaFailover:failover||null}}))}catch{}
    const notes=[];if(failover?.models?.length>1)notes.push(`Gemini failover: ${failover.models.join(' → ')}`);if(normalized.repaired)notes.push('structured output repaired once before validation');
    return packet(`Endeavor created: “${clean(saved.title||plan.title,240)}”\n\n${count} work unit${count===1?'':'s'} are active in Cerbanimo, each with a proof gate and completion criteria.${notes.length?`\n\n${notes.join(' · ')}`:''}${plan.assumptions.length?`\n\nAssumptions recorded: ${plan.assumptions.join('; ')}`:''}`,first?`Start: ${first}`:'Open the Workboard to begin.',{provider,model,assumptions:plan.assumptions,action:{kind:'cerbanimo-quest-created',system:'cerbanimo',state:'active',questId:saved.id||'',title:saved.title||plan.title,taskCount:count,source:'kamiya-chat-ai-quest',canonicalArtifact:'Endeavor'}});
  }catch(error){return packet(`I could not create the Endeavor. Nothing was saved.\n\nGeneration detail: ${clean(error?.message||error,1200)}`,'Retry the Endeavor or choose another AI model.',{provider:requestedProvider||'cerbanimo-endeavor-generation-error',model:clean(config?.model,240)})}
}
async function handler(request,next){const text=clean(request?.text,12000);if(!text||TEST.test(text)||!QUEST_INTENT.test(text))return next(request);return createEndeavor(request)}
function install(){const chat=globalThis.CivweaveUnifiedChatSystemV1;if(!chat?.registerCapability)return false;chat.registerCapability('cerbanimo',handler);installed=true;try{dispatchEvent(new CustomEvent('civweave:cerbanimo-chat-quest-capability-ready',{detail:{version:VERSION,system:'cerbanimo',structuredEndeavorAuthoring:true,transportSchema:'json-object',applicationValidation:true,boundedRepair:1,geminiQuotaChain:GEMINI_QUOTA_CHAIN}}))}catch{}return true}
for(const name of ['civweave:unified-chat-system-ready','civweave:guide-loader-reset','civweave:assistant-runtime-ready','pageshow'])addEventListener(name,()=>queueMicrotask(install));
install();let attempts=0;timer=setInterval(()=>{attempts+=1;install();if(installed||attempts>=240)clearInterval(timer)},125);addEventListener('pagehide',()=>clearInterval(timer),{once:true});
globalThis.CivweaveCerbanimoChatQuestCapabilityV2=Object.freeze({version:VERSION,install,handler,createEndeavor,questIntent:text=>QUEST_INTENT.test(clean(text,12000)),completionText,resultObject,normalizeQuestPlan,geminiQuotaFailure,nextGeminiModel,transportSchema:TRANSPORT_SCHEMA,geminiQuotaChain:GEMINI_QUOTA_CHAIN,state:()=>({installed})});
})();
