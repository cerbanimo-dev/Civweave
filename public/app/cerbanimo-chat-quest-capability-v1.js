(()=>{
'use strict';
const VERSION='1.0.2-cerbanimo-chat-quest-capability-v1-gemini-quota-failover';
const QUEST_SCHEMA=Object.freeze({
  type:'object',
  required:['title','objective','description','workUnits','assumptions'],
  properties:{
    title:{type:'string'},
    objective:{type:'string'},
    description:{type:'string'},
    workUnits:{type:'array',minItems:3,maxItems:12,items:{type:'object',required:['title','result','proof','acceptanceCriteria'],properties:{title:{type:'string'},result:{type:'string'},proof:{type:'string'},acceptanceCriteria:{type:'string'}}}},
    assumptions:{type:'array',maxItems:8,items:{type:'string'}}
  }
});
const LOCAL_PROVIDERS=new Set(['downloaded-local','generative-local','local-ai','smollm2','smollm3','qwen','browser']);
const GEMINI_QUOTA_CHAIN=Object.freeze(['gemini-3.7-flash','gemini-3.5-flash','gemini-3.1-flash-lite']);
const QUEST_INTENT=/\b(?:help\s+(?:me|us)\s+|(?:i|we)\s+(?:want|need|would\s+like|plan|intend|aim)\s+to\s+|please\s+)?(?:build|create|make|start|organize|launch|open|set\s*up|form|develop|design|run|establish|put\s+together|implement|complete|finish|deliver|ship|repair|fix|restore|migrate|deploy)\b/i;
if(globalThis.CivweaveCerbanimoChatQuestCapabilityV1?.version===VERSION)return;
let installed=false,timer=0;
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback=null)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const now=()=>new Date().toISOString();
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
function modelObject(result){
  if(result?.outputJson&&typeof result.outputJson==='object'&&!Array.isArray(result.outputJson))return result.outputJson;
  if(result?.choices?.[0]?.message?.parsed&&typeof result.choices[0].message.parsed==='object')return result.choices[0].message.parsed;
  const text=completionText(result).replace(/<think>[\s\S]*?<\/think>/gi,'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  return parse(text,null);
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
function nextGeminiQuotaModel(model){
  const value=clean(model,240).toLowerCase(),index=GEMINI_QUOTA_CHAIN.indexOf(value);
  return index>=0&&index<GEMINI_QUOTA_CHAIN.length-1?GEMINI_QUOTA_CHAIN[index+1]:'';
}
function quotaFailoverResult(result,models,success){
  const route=models.filter(Boolean),message=`Gemini quota failover: ${route.join(' → ')}${success?' succeeded.':' exhausted.'}`;
  const detail={schema:'civweave.gemini-quota-failover.v1',purpose:'cerbanimo-quest-authoring-v1',models:route,fromModel:route[0]||'',toModel:route.at(-1)||'',success:Boolean(success),at:now()};
  try{dispatchEvent(new CustomEvent('civweave:gemini-quota-failover',{detail}))}catch{}
  if(success)return{...result,diagnostics:[...(Array.isArray(result?.diagnostics)?result.diagnostics:[]),message],geminiQuotaFailover:detail,fallback:{...(result?.fallback||{}),used:true,provider:'gemini',reason:'quota-model-failover',fromModel:detail.fromModel,model:detail.toModel}};
  return{...result,diagnostics:[...(Array.isArray(result?.diagnostics)?result.diagnostics:[]),message],geminiQuotaFailover:detail,error:{...(result?.error||{}),code:'GEMINI_QUOTA_CHAIN_EXHAUSTED',message:`Gemini quota is currently exhausted across ${route.join(' → ')}.`}};
}
async function generateQuestModel(runtime,modelRequest,config){
  const first=await runtime.generate(modelRequest);
  if(!geminiQuotaFailure(first,config))return first;
  const startModel=resultModel(first,config),models=[startModel],base=globalThis.CivweaveFastInteractiveV192?.base?.();
  if(!base?.generate)return quotaFailoverResult(first,models,false);
  let current=first,currentModel=startModel,next=nextGeminiQuotaModel(currentModel);
  while(next){
    models.push(next);
    try{dispatchEvent(new CustomEvent('civweave:gemini-quota-failover-attempt',{detail:{schema:'civweave.gemini-quota-failover-attempt.v1',purpose:'cerbanimo-quest-authoring-v1',fromModel:currentModel,toModel:next,at:now()}}))}catch{}
    current=await base.generate({...modelRequest,executionProfile:'interactive',config:{...(config||{}),provider:'gemini',route:'gemini',model:next},__civweaveGeminiQuotaFailover:true});
    if(!geminiQuotaFailure(current,{...config,provider:'gemini',route:'gemini',model:next}))return quotaFailoverResult(current,models,true);
    currentModel=next;next=nextGeminiQuotaModel(currentModel);
  }
  return quotaFailoverResult(current,models,false);
}
function normalizeUnit(item,index){
  if(!item||typeof item!=='object')return null;
  const title=clean(item.title||item.name,220),result=clean(item.result||item.outcome||item.objective,1200),proof=clean(item.proof||item.evidence,1200),acceptanceCriteria=clean(item.acceptanceCriteria||item.acceptance||item.doneWhen,1200);
  if(!title||!result||!proof||!acceptanceCriteria)return null;
  return{id:`work-${index+1}`,title,result,proof,acceptanceCriteria};
}
function normalizeQuestPlan(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('The selected AI did not return a structured Quest object.');
  const workUnits=(Array.isArray(value.workUnits)?value.workUnits:Array.isArray(value.tasks)?value.tasks:Array.isArray(value.milestones)?value.milestones:[]).map(normalizeUnit).filter(Boolean).slice(0,12);
  if(workUnits.length<3)throw new Error('The selected AI returned fewer than three complete Quest work units.');
  const title=clean(value.title,240),objective=clean(value.objective||value.goal,1800),description=clean(value.description||value.summary,3000),assumptions=(Array.isArray(value.assumptions)?value.assumptions:[]).map(item=>clean(item,700)).filter(Boolean).slice(0,8);
  if(!title||!objective||!description)throw new Error('The selected AI returned an incomplete Quest header.');
  return{title,objective,description,workUnits,assumptions};
}
function questPacket(answer,nextAction='',extra={}){
  return{response:{answer,choice:{mode:'Build',system:'cerbanimo',room:'',nextAction},assumptions:Array.isArray(extra.assumptions)?extra.assumptions:[],requiresConsent:false,confidence:1},provider:extra.provider||'cerbanimo-quest-capability',model:extra.model||'',action:extra.action||null,context:{guide:{system:'cerbanimo',name:'Kamiya'},capability:'quest-authoring',canonicalArtifact:'Quest'},fallbackFrom:null};
}
async function ensureQuestEngine(){
  if(globalThis.CivweaveCerbanimoQuestV144?.createQuestFromInput&&globalThis.CivweaveCerbanimoQuestV144?.addQuest)return globalThis.CivweaveCerbanimoQuestV144;
  const existing=[...document.scripts].find(script=>{try{return new URL(script.src,location.href).pathname==='/app/cerbanimo-quest-engine-v144.js'}catch{return false}});
  if(existing){await new Promise(resolve=>{if(globalThis.CivweaveCerbanimoQuestV144)return resolve();existing.addEventListener('load',resolve,{once:true});setTimeout(resolve,1800)});return globalThis.CivweaveCerbanimoQuestV144||null}
  await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/app/cerbanimo-quest-engine-v144.js?v=quest-engine-r25-frame-bounded';script.async=false;script.onload=resolve;script.onerror=()=>reject(new Error('Cerbanimo Quest Engine could not load.'));document.head?.append(script)});
  return globalThis.CivweaveCerbanimoQuestV144||null;
}
async function createQuest(request={}){
  let config=selectedConfig();
  try{await globalThis.CivweaveFamilyAILoaderV105?.ensure?.();config=selectedConfig()||config}catch(error){return questPacket(`I could not start Quest generation. Nothing was created or saved.\n\nGeneration detail: ${clean(error?.message||error,900)}`,'Retry after the selected AI runtime is ready.',{provider:'cerbanimo-quest-model-error',model:clean(config?.model,240)})}
  const runtime=globalThis.CivweaveModelRuntime;
  if(!runtime?.generate||!config)return questPacket('I could not start Quest generation because the selected AI runtime is unavailable. Nothing was created or saved.','Retry after the selected AI runtime is ready.',{provider:'cerbanimo-quest-model-unavailable',model:clean(config?.model,240)});
  const requestedProvider=clean(config.provider||config.route,120).toLowerCase(),planConfig={...config,maxTokens:Math.min(2400,Math.max(1200,Number(config.maxTokens)||1600)),temperature:Math.min(.35,Math.max(.1,Number(config.temperature)||.22))};
  const history=(Array.isArray(request.history)?request.history:[]).slice(-8).map(row=>({role:clean(row?.role,40),text:clean(row?.text||row?.content,1200)})).filter(row=>row.text);
  const context={schema:'civweave.cerbanimo.quest-authoring-request.v1',objective:clean(request.text,5000),recentConversation:history,constraints:['Return one executable Cerbanimo Quest, not advice or a tutorial.','Use 3 to 12 concrete work units in dependency order.','Every work unit must name its visible result, inspectable proof, and acceptance criteria.','Do not claim that any real-world work has already happened.','Make reasonable assumptions when details are missing and list those assumptions explicitly.','Return strict JSON matching the supplied schema.']};
  try{
    const modelRequest={purpose:'cerbanimo-quest-authoring-v1',executionProfile:'interactive',config:planConfig,schema:QUEST_SCHEMA,responseFormat:'json',context,task:{schema:'civweave.ai-task.v2',kind:'quest-authoring',systemId:'cerbanimo',complexity:'routine',requirements:{profile:'interactive',requiresTools:false,externalResearch:false,code:false,planning:true,structuredOutput:true,vision:false,complexity:false}},capabilityRequirements:{profile:'interactive',requiresTools:false,externalResearch:false,planning:true,structuredOutput:true},messages:[{role:'system',content:'You are Kamiya, Cerbanimo’s Endeavor guide. Convert the Hero’s build request into an executable Quest for the Cerbanimo Quest Engine. Return strict JSON only. Create work units with visible results, inspectable proof, and unambiguous acceptance criteria. Do not answer with a prose roadmap and do not claim work has already been completed.'},{role:'user',content:`Create the Cerbanimo Quest from this request:\n${JSON.stringify(context)}`}]};
    const result=await generateQuestModel(runtime,modelRequest,planConfig);
    if(!['success','fallback'].includes(result?.status))throw new Error(result?.error?.message||result?.error||`The selected AI ended with ${result?.status||'an error'}.`);
    const provider=clean(result?.actual?.provider||result?.provider||config.provider||config.route,120),model=clean(result?.actual?.model||result?.model||config.model,240),actualProvider=provider.toLowerCase();
    if(LOCAL_PROVIDERS.has(requestedProvider)&&!LOCAL_PROVIDERS.has(actualProvider))throw new Error(`The selected local model was bypassed by ${provider||'another provider'}, so Kamiya refused to create the Quest.`);
    const plan=normalizeQuestPlan(modelObject(result));
    const engine=await ensureQuestEngine();
    if(!engine?.createQuestFromInput||!engine?.addQuest)throw new Error('Cerbanimo Quest Engine is unavailable.');
    const sourceActionId=`kamiya-chat:${Date.now().toString(36)}:${Math.random().toString(36).slice(2,8)}`;
    const description=[plan.description,plan.assumptions.length?`Assumptions:\n${plan.assumptions.map(item=>`- ${item}`).join('\n')}`:''].filter(Boolean).join('\n\n');
    const quest=engine.createQuestFromInput({title:plan.title,objective:plan.objective,description,steps:plan.workUnits.map(unit=>`${unit.title}: ${unit.result}`),acceptanceCriteria:plan.workUnits.map(unit=>`${unit.title} — ${unit.acceptanceCriteria}`),proofRequirements:plan.workUnits.map(unit=>`${unit.title} — ${unit.proof}`),source:'kamiya-chat-ai-quest',sourceActionId,sequential:true});
    if(Array.isArray(quest?.tasks))quest.tasks.forEach((task,index)=>{const criterion=clean(plan.workUnits[index]?.acceptanceCriteria,1200);if(criterion)task.acceptanceCriteria=[criterion]});
    const added=engine.addQuest(quest,{activate:true});
    if(added?.ok===false)throw new Error(added.error||added.reason||'Cerbanimo rejected the generated Quest.');
    const saved=added?.quest||quest,count=Array.isArray(saved.tasks)?saved.tasks.length:plan.workUnits.length,first=clean(saved.tasks?.[0]?.title||plan.workUnits[0]?.title,220);
    try{dispatchEvent(new CustomEvent('civweave:cerbanimo-chat-quest-created',{detail:{questId:saved.id,title:saved.title,taskCount:count,provider,model,sourceActionId,geminiQuotaFailover:result?.geminiQuotaFailover||null}}))}catch{}
    return questPacket(`Quest created: “${clean(saved.title||plan.title,240)}”\n\n${count} work unit${count===1?'':'s'} are active in Cerbanimo, each with a proof gate and completion criteria.${result?.geminiQuotaFailover?.success?`\n\nGemini quota failover used: ${result.geminiQuotaFailover.models.join(' → ')}.`:''}${plan.assumptions.length?`\n\nAssumptions recorded: ${plan.assumptions.join('; ')}`:''}`,first?`Start: ${first}`:'Open the Workboard to begin.',{provider,model,assumptions:plan.assumptions,action:{kind:'cerbanimo-quest-created',system:'cerbanimo',state:'active',questId:saved.id||'',title:saved.title||plan.title,taskCount:count,source:'kamiya-chat-ai-quest',canonicalArtifact:'Quest',geminiQuotaFailover:result?.geminiQuotaFailover||null}});
  }catch(error){return questPacket(`I could not create the Quest. Nothing was saved.\n\nGeneration detail: ${clean(error?.message||error,1200)}`,'Retry the Quest or choose another AI model.',{provider:requestedProvider||'cerbanimo-quest-generation-error',model:clean(config?.model,240)})}
}
async function handler(request,next){
  const text=clean(request?.text,12000);
  if(!text||/^\s*(?:test|testing|ping|check|mic check)\s*[.!?]*\s*$/i.test(text))return next(request);
  if(!QUEST_INTENT.test(text))return next(request);
  return createQuest(request);
}
function install(){
  const chat=globalThis.CivweaveUnifiedChatSystemV1;
  if(!chat?.registerCapability)return false;
  chat.registerCapability('cerbanimo',handler);installed=true;
  try{dispatchEvent(new CustomEvent('civweave:cerbanimo-chat-quest-capability-ready',{detail:{version:VERSION,system:'cerbanimo',structuredQuestAuthoring:true,deterministicQuestCreation:false,geminiQuotaFailover:GEMINI_QUOTA_CHAIN}}))}catch{}
  return true;
}
for(const name of ['civweave:unified-chat-system-ready','civweave:guide-loader-reset','civweave:assistant-runtime-ready','pageshow'])addEventListener(name,()=>queueMicrotask(install));
install();let attempts=0;timer=setInterval(()=>{attempts+=1;install();if(installed||attempts>=240)clearInterval(timer)},125);addEventListener('pagehide',()=>clearInterval(timer),{once:true});
globalThis.CivweaveCerbanimoChatQuestCapabilityV1=Object.freeze({version:VERSION,install,handler,createQuest,questIntent:text=>QUEST_INTENT.test(clean(text,12000)),completionText,modelObject,normalizeQuestPlan,geminiQuotaFailure,nextGeminiQuotaModel,generateQuestModel,geminiQuotaChain:GEMINI_QUOTA_CHAIN,schema:QUEST_SCHEMA,state:()=>({installed})});
})();