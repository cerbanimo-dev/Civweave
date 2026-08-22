(()=>{
'use strict';
const VERSION='2.2.0-cerbanimo-chat-quest-capability-v2-malformed-json-repair';
const TRANSPORT_SCHEMA=Object.freeze({type:'object'});
const GEMINI_QUOTA_CHAIN=Object.freeze(['gemini-3.7-flash','gemini-3.5-flash','gemini-3.1-flash-lite']);
const CLOUDFLARE_FALLBACK=Object.freeze({provider:'cloudflare-workers-ai',route:'cloudflare-workers-ai',model:'@cf/zai-org/glm-4.7-flash'});
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
function recoverableStructuredResult(result){
  if(okStatus(result)||result?.recoverablePayload)return true;
  return String(result?.status||'').toLowerCase()==='invalid-response'&&Boolean(completionText(result));
}
function validationDetails(result){const errors=Array.isArray(result?.structured?.errors)?result.structured.errors:[];return errors.map(item=>clean(item,320)).filter(Boolean).slice(0,4)}
function malformedJsonResult(result){
  if(String(result?.status||'').toLowerCase()!=='invalid-response')return false;
  const detail=[...validationDetails(result),clean(result?.error?.message,1200)].join(' ');
  if(/(?:not valid JSON|Unterminated string|Unexpected end|Unexpected token|Expected .*JSON|JSON.*position|end of JSON)/i.test(detail))return true;
  const text=completionText(result);return Boolean(text)&&!parse(text.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''),null);
}
function selectedConfig(){
  try{const config=globalThis.CivweaveAssistantV141?.selectedConfig?.();if(config&&(config.provider||config.route||config.model))return config}catch{}
  try{const config=globalThis.CivweaveModelRuntime?.readSharedConfig?.('interactive');if(config&&(config.provider||config.route||config.model))return config}catch{}
  return null;
}
function resultProvider(result,config={}){return clean(result?.actual?.provider||result?.requested?.provider||result?.provider||config.provider||config.route,120).toLowerCase()}
function resultModel(result,config={}){return clean(result?.actual?.model||result?.requested?.model||result?.model||config.model,240).toLowerCase()}
function resultErrorMessage(result){return clean(result?.error?.message||result?.error||result?.diagnostic||result?.fallbackFrom?.reason||'',6000)}
function resultErrorStatus(result){
  for(const candidate of [result?.error?.status,result?.error?.code,result?.statusCode,result?.status_code,result?.error?.raw?.error?.code,result?.error?.details?.code]){
    const value=Number(candidate);if(Number.isInteger(value)&&value>=100&&value<=599)return value;
  }
  const match=resultErrorMessage(result).match(/\bHTTP\s*(\d{3})\b/i);return match?Number(match[1]):0;
}
function providerErrorResult(error,config={}){
  const provider=clean(config.provider||config.route,120).toLowerCase(),model=clean(config.model,240).toLowerCase(),message=clean(error?.message||error,6000);
  let status=0;for(const candidate of [error?.status,error?.statusCode,error?.status_code,error?.code,error?.cause?.status,error?.cause?.statusCode]){const value=Number(candidate);if(Number.isInteger(value)&&value>=100&&value<=599){status=value;break}}
  if(!status){const match=message.match(/\bHTTP\s*(\d{3})\b/i);if(match)status=Number(match[1])}
  return{status:'provider-error',requested:{provider,model},actual:{provider,model},error:{status:status||undefined,code:clean(error?.code,120)||'PROVIDER_EXCEPTION',message}};
}
function geminiQuotaFailure(result,config={}){
  if(!result||typeof result!=='object'||resultProvider(result,config)!=='gemini')return false;
  const status=resultErrorStatus(result),message=resultErrorMessage(result);
  return status===429||/\b(?:HTTP\s*429|RESOURCE_EXHAUSTED|quota exceeded|quota failure|rate[- ]?limit(?:ed|ing)?)\b/i.test(message);
}
function geminiTransientFailure(result,config={}){
  if(!result||typeof result!=='object'||resultProvider(result,config)!=='gemini')return false;
  const status=resultErrorStatus(result),message=resultErrorMessage(result);
  return geminiQuotaFailure(result,config)||[500,502,503,504].includes(status)||/\b(?:HTTP\s*(?:500|502|503|504)|UNAVAILABLE|high demand|temporar(?:y|ily) unavailable|service unavailable|overloaded|backend error|upstream error)\b/i.test(message);
}
function nextGeminiModel(model){const index=GEMINI_QUOTA_CHAIN.indexOf(clean(model,240).toLowerCase());return index>=0&&index<GEMINI_QUOTA_CHAIN.length-1?GEMINI_QUOTA_CHAIN[index+1]:''}
function failoverMeta(models,success,triggerResult=null){return{schema:'civweave.gemini-transient-failover.v3',purpose:'cerbanimo-endeavor-authoring-v2',models:models.filter(Boolean),fromModel:models[0]||'',toModel:models.at(-1)||'',success:Boolean(success),triggerStatus:resultErrorStatus(triggerResult)||null,triggerMessage:resultErrorMessage(triggerResult)||'',at:now()}}
function attachFailover(result,models,success,triggerResult=result){
  if(models.length<2&&!triggerResult)return result;
  const meta=failoverMeta(models,success,triggerResult),message=`Gemini transient failover: ${meta.models.join(' → ')}${success?' succeeded.':' exhausted without a valid model result.'}`;
  try{dispatchEvent(new CustomEvent('civweave:gemini-transient-failover',{detail:meta}))}catch{}
  return{...result,geminiFailover:meta,geminiQuotaFailover:meta,diagnostics:[...(Array.isArray(result?.diagnostics)?result.diagnostics:[]),message],fallback:{...(result?.fallback||{}),used:success||Boolean(result?.fallback?.used),provider:'gemini',reason:'transient-model-failover',fromModel:meta.fromModel,model:meta.toModel}};
}
function providerFailoverMeta(models,triggerResult,success){return{schema:'civweave.cross-provider-failover.v1',purpose:'cerbanimo-endeavor-authoring-v2',fromProvider:'gemini',fromModels:models.filter(Boolean),toProvider:CLOUDFLARE_FALLBACK.provider,toModel:CLOUDFLARE_FALLBACK.model,triggerStatus:resultErrorStatus(triggerResult)||null,triggerMessage:resultErrorMessage(triggerResult)||'',success:Boolean(success),at:now()}}
async function cloudflareAfterGemini(runtime,request,config,geminiResult,models){
  const fallbackConfig={...(config||{}),...CLOUDFLARE_FALLBACK,workersAiModel:CLOUDFLARE_FALLBACK.model,cloudflareModel:CLOUDFLARE_FALLBACK.model,stream:false};
  try{dispatchEvent(new CustomEvent('civweave:endeavor-provider-failover-attempt',{detail:providerFailoverMeta(models,geminiResult,false)}))}catch{}
  let result;
  try{result=await runtime.generate({...request,executionProfile:'interactive',config:fallbackConfig,__civweaveGeminiProviderFailover:true})}
  catch(error){result={status:'provider-error',requested:{provider:CLOUDFLARE_FALLBACK.provider,model:CLOUDFLARE_FALLBACK.model},actual:{provider:CLOUDFLARE_FALLBACK.provider,model:CLOUDFLARE_FALLBACK.model},error:{code:'CLOUDFLARE_FALLBACK_EXCEPTION',message:clean(error?.message||error,1200)}}}
  const success=recoverableStructuredResult(result),meta=providerFailoverMeta(models,geminiResult,success),geminiMeta=geminiResult?.geminiFailover||geminiResult?.geminiQuotaFailover||failoverMeta(models,false,geminiResult);
  try{dispatchEvent(new CustomEvent('civweave:endeavor-provider-failover',{detail:meta}))}catch{}
  const diagnostics=[...(Array.isArray(result?.diagnostics)?result.diagnostics:[]),`Provider failover: Gemini → Cloudflare Workers AI${success?' succeeded.':' failed.'}`];
  if(success)return{...result,geminiFailover:geminiMeta,geminiQuotaFailover:geminiMeta,providerFailover:meta,diagnostics,fallback:{...(result?.fallback||{}),used:true,provider:CLOUDFLARE_FALLBACK.provider,reason:'gemini-transient-provider-failover',fromProvider:'gemini',model:CLOUDFLARE_FALLBACK.model}};
  const cloudflareDetail=resultErrorMessage(result)||`ended with ${result?.status||'an error'}`,geminiDetail=resultErrorMessage(geminiResult)||'temporary Gemini capacity failure';
  return{...result,geminiFailover:geminiMeta,geminiQuotaFailover:geminiMeta,providerFailover:meta,diagnostics,error:{...(result?.error||{}),code:'ENDEAVOR_PROVIDER_FAILOVER_EXHAUSTED',message:`Gemini was temporarily unavailable (${geminiDetail}). Cloudflare Workers AI fallback also failed: ${cloudflareDetail}`}};
}
async function generateQuestModel(runtime,request,config,{direct=false,startModel=''}={}){
  const base=globalThis.CivweaveFastInteractiveV192?.base?.(),initialModel=clean(startModel||config?.model,240).toLowerCase(),initialConfig=direct?{...(config||{}),provider:'gemini',route:'gemini',model:initialModel}:config;
  let result;
  try{
    if(direct&&base?.generate)result=await base.generate({...request,executionProfile:'interactive',config:initialConfig,__civweaveGeminiQuotaFailover:true});
    else result=await runtime.generate(request);
  }catch(error){result=providerErrorResult(error,initialConfig)}
  if(!geminiTransientFailure(result,config))return result;
  const actualStart=resultModel(result,{...config,model:initialModel})||initialModel,priorModels=Array.isArray(result?.geminiFailover?.models)?result.geminiFailover.models:Array.isArray(result?.geminiQuotaFailover?.models)?result.geminiQuotaFailover.models:[],models=priorModels.length?[...priorModels]:[actualStart];
  let current=result,currentModel=models.at(-1)||actualStart,next=nextGeminiModel(currentModel);
  if(base?.generate){
    while(next){
      models.push(next);
      try{dispatchEvent(new CustomEvent('civweave:gemini-transient-failover-attempt',{detail:{schema:'civweave.gemini-transient-failover-attempt.v3',purpose:'cerbanimo-endeavor-authoring-v2',fromModel:currentModel,toModel:next,triggerStatus:resultErrorStatus(current)||null,at:now()}}))}catch{}
      const nextConfig={...(config||{}),provider:'gemini',route:'gemini',model:next};
      try{current=await base.generate({...request,executionProfile:'interactive',config:nextConfig,__civweaveGeminiQuotaFailover:true})}catch(error){current=providerErrorResult(error,nextConfig)}
      if(!geminiTransientFailure(current,nextConfig))return attachFailover(current,models,okStatus(current),result);
      currentModel=next;next=nextGeminiModel(currentModel);
    }
  }
  const exhausted=attachFailover(current,models,false,current);
  return cloudflareAfterGemini(runtime,request,config,exhausted,models);
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
function packet(answer,nextAction='',extra={}){
  return{response:{answer,choice:{mode:'Build',system:'cerbanimo',room:'',nextAction},assumptions:Array.isArray(extra.assumptions)?extra.assumptions:[],requiresConsent:false,confidence:1},provider:extra.provider||'cerbanimo-endeavor-capability',model:extra.model||'',action:extra.action||null,context:{guide:{system:'cerbanimo',name:'Kamiya'},capability:'endeavor-authoring',canonicalArtifact:'Endeavor'},fallbackFrom:null};
}
function requestContext(request={}){
  const history=(Array.isArray(request.history)?request.history:[]).slice(-8).map(row=>({role:clean(row?.role,40),text:clean(row?.text||row?.content,1200)})).filter(row=>row.text);
  return{schema:'civweave.cerbanimo.endeavor-authoring-request.v2',objective:clean(request.text,5000),recentConversation:history,constraints:['Return one executable Cerbanimo Endeavor, not advice or a tutorial.','Use 3 to 6 concise work units in dependency order; prefer 5.','Every work unit must include title, result, proof, and acceptanceCriteria.','Keep title under 90 characters, result under 260, proof under 220, acceptanceCriteria under 220, and description under 500.','Do not claim that any real-world work has already happened.','Make reasonable assumptions when details are missing and list them.','Return one complete JSON object only.']};
}
function modelRequest(context,config,purpose='cerbanimo-endeavor-authoring-v2',messages=null){
  return{purpose,executionProfile:'interactive',config,schema:TRANSPORT_SCHEMA,responseFormat:'json',maxRepairAttempts:0,context,task:{schema:'civweave.ai-task.v2',kind:'quest-authoring',systemId:'cerbanimo',complexity:'routine',requirements:{profile:'interactive',requiresTools:false,externalResearch:false,code:false,planning:true,structuredOutput:true,vision:false,complexity:false}},capabilityRequirements:{profile:'interactive',requiresTools:false,externalResearch:false,planning:true,structuredOutput:true},messages:messages||[{role:'system',content:'You are Kamiya, Cerbanimo’s Endeavor guide. Convert the Hero’s request into one executable Endeavor. Return exactly one complete JSON object. Required top-level fields: title, objective, description, workUnits, assumptions. Use 3 to 6 concise workUnits, preferably 5; each must contain title, result, proof, acceptanceCriteria. Keep strings concise so the JSON always closes cleanly. Do not return prose, markdown, or a roadmap outside the JSON object.'},{role:'user',content:`Create the Cerbanimo Endeavor from this request:\n${JSON.stringify(context)}`}]};
}
function repairMessages(context,result,error){
  const malformed=malformedJsonResult(result),candidate=resultObject(result)||completionText(result)||'';
  if(malformed)return[{role:'system',content:'Regenerate a Cerbanimo Endeavor from scratch because the previous JSON was malformed or truncated. Do not continue or quote the broken fragment. Return exactly one complete JSON object and nothing else. Required fields: title, objective, description, workUnits, assumptions. Use exactly 5 concise workUnits, each with title, result, proof, acceptanceCriteria. Keep every string short enough that the object closes well within the output limit. Preserve the Hero’s objective and do not invent completed real-world work.'},{role:'user',content:`Hero request:\n${clean(context.objective,5000)}\n\nBuild a fresh complete Endeavor JSON object. The previous output was discarded because it did not close as valid JSON.`}];
  return[{role:'system',content:'Repair a Cerbanimo Endeavor JSON object. Return exactly one complete JSON object and nothing else. Required fields: title, objective, description, workUnits, assumptions. workUnits must contain 3 to 6 concise objects with title, result, proof, acceptanceCriteria. Preserve the Hero’s objective. Do not invent completed real-world work.'},{role:'user',content:`Hero request:\n${clean(context.objective,5000)}\n\nThe previous candidate was rejected because: ${clean(error?.message||error,800)}\n\nCandidate to repair:\n${clean(typeof candidate==='string'?candidate:JSON.stringify(candidate),12000)}`}];
}
async function planFromResult(runtime,result,request,config,context){
  try{return{plan:normalizeQuestPlan(resultObject(result)),result,repaired:false}}catch(firstError){
    const provider=resultProvider(result,config),model=resultModel(result,config)||clean(config.model,240).toLowerCase();
    if(!model)return{error:firstError,result};
    const repairConfig={...config,provider:provider||config.provider,route:provider||config.route,model,stream:false,maxTokens:Math.min(3600,Math.max(2400,Number(config.maxTokens)||2400)),temperature:.05};
    const repairRequest=modelRequest(context,repairConfig,'cerbanimo-endeavor-authoring-repair-v2',repairMessages(context,result,firstError));
    let repaired;
    if(provider==='gemini')repaired=await generateQuestModel(runtime,repairRequest,repairConfig,{direct:true,startModel:model});
    else repaired=await runtime.generate(repairRequest);
    if(!recoverableStructuredResult(repaired))return{error:new Error(validationDetails(repaired).join('; ')||repaired?.error?.message||`The repair model ended with ${repaired?.status||'an error'}.`),result:repaired};
    try{return{plan:normalizeQuestPlan(resultObject(repaired)),result:repaired,repaired:true}}catch(secondError){
      const detail=validationDetails(repaired).join('; ');
      if(malformedJsonResult(repaired)&&detail)return{error:new Error(`The repair model also returned malformed JSON: ${detail}`),result:repaired};
      return{error:secondError,result:repaired};
    }
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
  const requestedProvider=clean(config.provider||config.route,120).toLowerCase(),planConfig={...config,maxTokens:Math.min(3200,Math.max(2200,Number(config.maxTokens)||2200)),temperature:Math.min(.25,Math.max(.05,Number(config.temperature)||.15)),stream:false},context=requestContext(request);
  try{
    const requestPacket=modelRequest(context,planConfig),initial=await generateQuestModel(runtime,requestPacket,planConfig);
    if(!recoverableStructuredResult(initial)){
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
    const geminiFailover=result?.geminiFailover||result?.geminiQuotaFailover||initial?.geminiFailover||initial?.geminiQuotaFailover||null,providerFailover=result?.providerFailover||initial?.providerFailover||null;
    quest.authoring={mode:'model-json-application-validated',aiGenerated:true,provider,model,transportSchema:'json-object',applicationValidator:'cerbanimo-endeavor-v2',repaired:Boolean(normalized.repaired),repairReason:normalized.repaired?(malformedJsonResult(initial)?'malformed-json':'application-validation'):'',geminiFailover,geminiQuotaFailover:geminiFailover,providerFailover,createdAt:now()};
    const added=engine.addQuest(quest,{activate:true});
    if(added?.ok===false)throw new Error(added.error||added.reason||'Cerbanimo rejected the generated Endeavor.');
    const saved=added?.quest||quest,count=Array.isArray(saved.tasks)?saved.tasks.length:plan.workUnits.length,first=clean(saved.tasks?.[0]?.title||plan.workUnits[0]?.title,220);
    try{dispatchEvent(new CustomEvent('civweave:cerbanimo-chat-quest-created',{detail:{questId:saved.id,title:saved.title,taskCount:count,provider,model,sourceActionId,repaired:Boolean(normalized.repaired),repairReason:quest.authoring.repairReason,geminiFailover,geminiQuotaFailover:geminiFailover,providerFailover}}))}catch{}
    const notes=[];if(geminiFailover?.models?.length>1)notes.push(`Gemini failover: ${geminiFailover.models.join(' → ')}`);if(providerFailover?.success)notes.push(`Provider failover: Gemini → Cloudflare Workers AI (${providerFailover.toModel})`);if(normalized.repaired)notes.push(malformedJsonResult(initial)?'truncated JSON regenerated once before validation':'structured output repaired once before validation');
    return packet(`Endeavor created: “${clean(saved.title||plan.title,240)}”\n\n${count} work unit${count===1?'':'s'} are active in Cerbanimo, each with a proof gate and completion criteria.${notes.length?`\n\n${notes.join(' · ')}`:''}${plan.assumptions.length?`\n\nAssumptions recorded: ${plan.assumptions.join('; ')}`:''}`,first?`Start: ${first}`:'Open the Workboard to begin.',{provider,model,assumptions:plan.assumptions,action:{kind:'cerbanimo-quest-created',system:'cerbanimo',state:'active',questId:saved.id||'',title:saved.title||plan.title,taskCount:count,source:'kamiya-chat-ai-quest',canonicalArtifact:'Endeavor'}});
  }catch(error){return packet(`I could not create the Endeavor. Nothing was saved.\n\nGeneration detail: ${clean(error?.message||error,1200)}`,'Retry the Endeavor or choose another AI model.',{provider:requestedProvider||'cerbanimo-endeavor-generation-error',model:clean(config?.model,240)})}
}
async function handler(request,next){const text=clean(request?.text,12000);if(!text||TEST.test(text)||!QUEST_INTENT.test(text))return next(request);return createEndeavor(request)}
function install(){const chat=globalThis.CivweaveUnifiedChatSystemV1;if(!chat?.registerCapability)return false;chat.registerCapability('cerbanimo',handler);installed=true;try{dispatchEvent(new CustomEvent('civweave:cerbanimo-chat-quest-capability-ready',{detail:{version:VERSION,system:'cerbanimo',structuredEndeavorAuthoring:true,transportSchema:'json-object',applicationValidation:true,boundedRepair:1,malformedJsonRecovery:true,geminiQuotaChain:GEMINI_QUOTA_CHAIN,geminiTransientStatuses:[429,500,502,503,504],providerFallback:CLOUDFLARE_FALLBACK}}))}catch{}return true}
for(const name of ['civweave:unified-chat-system-ready','civweave:guide-loader-reset','civweave:assistant-runtime-ready','pageshow'])addEventListener(name,()=>queueMicrotask(install));
install();let attempts=0;timer=setInterval(()=>{attempts+=1;install();if(installed||attempts>=240)clearInterval(timer)},125);addEventListener('pagehide',()=>clearInterval(timer),{once:true});
globalThis.CivweaveCerbanimoChatQuestCapabilityV2=Object.freeze({version:VERSION,install,handler,createEndeavor,questIntent:text=>QUEST_INTENT.test(clean(text,12000)),completionText,resultObject,normalizeQuestPlan,recoverableStructuredResult,malformedJsonResult,geminiQuotaFailure,geminiTransientFailure,nextGeminiModel,resultErrorStatus,providerErrorResult,transportSchema:TRANSPORT_SCHEMA,geminiQuotaChain:GEMINI_QUOTA_CHAIN,providerFallback:CLOUDFLARE_FALLBACK,state:()=>({installed})});
})();