(()=>{
'use strict';

const VERSION='1.0.58-weaveling-model-first-plan-v266';
const PLAN_PURPOSE='weaveling-intention-model-plan-v266';
const ELIGIBLE_PROVIDERS=new Set(['gemini','ollama','openai-compatible','hosted']);
const REALMS=new Set(['living-school','cerbanimo','fellowfare']);
let patchedAssistant=null;
let patchedLoader=null;

if(globalThis.CivweaveWeavelingModelFirstPlanV266?.version===VERSION)return;

const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const clone=value=>{try{return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value))}catch{return value}};
const now=()=>new Date().toISOString();
const lower=value=>clean(value,120).toLowerCase();
const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

function providerOf(config={}){return lower(config.provider||config.route||config.engine)}
function modelCapable(config={}){return ELIGIBLE_PROVIDERS.has(providerOf(config))}
function planContext(){return{currentContext:{systemId:'civweave',roomId:'civweave.quad'},routingAnswer:{system:'civweave',room:'civweave.quad',mode:'Plan'},guide:{system:'civweave',name:'Weaveling'}}}
function shouldPlan(options={}){
  const planner=globalThis.CivweaveIntentionPlanner;
  if(!planner?.shouldCreate)return false;
  try{return Boolean(planner.shouldCreate({text:options.text,history:options.history,context:planContext()}))}catch{return false}
}
function compactHistory(history=[]){
  return (Array.isArray(history)?history:[]).slice(-18).map(row=>({
    role:row?.role==='assistant'?'assistant':row?.role==='system'?'system':'user',
    content:clean(row?.text||row?.content,4200)
  })).filter(row=>row.content);
}
function planSchema(){
  const path={type:'object',required:['realm','title','purpose','steps','completionCriteria','evidence'],properties:{
    realm:{type:'string',enum:['living-school','cerbanimo','fellowfare']},
    title:{type:'string'},purpose:{type:'string'},steps:{type:'array',minItems:1,maxItems:8,items:{type:'string'}},
    completionCriteria:{type:'string'},evidence:{type:'array',minItems:1,maxItems:8,items:{type:'string'}}
  }};
  return{type:'object',required:['wish','title','outcome','assumptions','paths','governance'],properties:{
    wish:{type:'string'},title:{type:'string'},outcome:{type:'string'},assumptions:{type:'array',maxItems:8,items:{type:'string'}},
    paths:{type:'array',minItems:1,maxItems:3,items:path},
    governance:{type:'object',required:['title','purpose','agreements','reviewQuestion'],properties:{
      title:{type:'string'},purpose:{type:'string'},agreements:{type:'array',minItems:1,maxItems:8,items:{type:'string'}},reviewQuestion:{type:'string'}
    }}
  }};
}
function pathType(realm){return realm==='living-school'?'learning':realm==='fellowfare'?'material-acquirement':'skilled-labor'}
function normalizePath(row,index,base){
  const realm=REALMS.has(lower(row?.realm))?lower(row.realm):'cerbanimo';
  const fallback=Array.isArray(base?.paths)?base.paths.find(path=>path?.realm===realm)||base.paths[index]:null;
  return{
    ...(fallback&&typeof fallback==='object'?clone(fallback):{}),
    id:clean(fallback?.id,180)||uid(realm==='living-school'?'learning':realm==='fellowfare'?'material':'skilled'),
    type:clean(fallback?.type,120)||pathType(realm),realm,
    title:clean(row?.title,320)||clean(fallback?.title,320)||'Move this path forward',
    purpose:clean(row?.purpose,1800)||clean(fallback?.purpose,1800),
    steps:(Array.isArray(row?.steps)?row.steps:[]).map(value=>clean(value,1000)).filter(Boolean).slice(0,8),
    completionCriteria:clean(row?.completionCriteria,1800)||clean(fallback?.completionCriteria,1800),
    evidence:(Array.isArray(row?.evidence)?row.evidence:[]).map(value=>clean(value,800)).filter(Boolean).slice(0,8),
    progress:[],status:'draft'
  };
}
function modelPlan(output,options,result){
  const planner=globalThis.CivweaveIntentionPlanner;
  const wish=clean(output?.wish,2400);
  if(!wish||!planner?.buildPlan)throw new Error('The configured model did not return a usable governing wish.');
  const base=planner.buildPlan({text:wish,history:[],context:planContext()});
  const rows=(Array.isArray(output?.paths)?output.paths:[]).filter(row=>REALMS.has(lower(row?.realm))).slice(0,3);
  if(!rows.length)throw new Error('The configured model did not return any usable realm paths.');
  const at=now(),provider=clean(result?.actual?.provider||result?.provider||'',120),model=clean(result?.actual?.model||result?.model||'',240);
  return{
    ...base,
    id:base?.id||uid('intention'),
    schema:base?.schema||'civweave.intention-weave.v1',
    wish,
    title:clean(output?.title,320)||clean(base?.title,320)||wish,
    outcome:clean(output?.outcome,2400)||clean(base?.outcome,2400),
    assumptions:(Array.isArray(output?.assumptions)?output.assumptions:[]).map(value=>clean(value,900)).filter(Boolean).slice(0,8),
    paths:rows.map((row,index)=>normalizePath(row,index,base)),
    governance:{
      ...(base?.governance||{}),realm:'anarchadia',
      title:clean(output?.governance?.title,320)||clean(base?.governance?.title,320)||'Consent and review',
      purpose:clean(output?.governance?.purpose,1800)||clean(base?.governance?.purpose,1800),
      agreements:(Array.isArray(output?.governance?.agreements)?output.governance.agreements:[]).map(value=>clean(value,900)).filter(Boolean).slice(0,8),
      reviewQuestion:clean(output?.governance?.reviewQuestion,1200)||clean(base?.governance?.reviewQuestion,1200),status:'draft'
    },
    state:'review',requiresExplicitActivation:true,createdAt:base?.createdAt||at,updatedAt:at,
    authorship:{kind:'model-authored-local-materialization',provider,model,revision:VERSION,sourceText:clean(options?.text,4000)}
  };
}
function materializeResult(plan,result,config){
  const planner=globalThis.CivweaveIntentionPlanner,item=planner?.persist?.(plan);
  if(!item)throw new Error('Civweave could not persist the model-authored intention weave.');
  const materializer=globalThis.CivweaveWeavelingPlanMaterializationV265;
  materializer?.materialize?.(plan,{source:'weaveling-model-first-v266'});
  const formatted=clean(planner?.format?.(plan),10000);
  const answer=[`I used the configured ${clean(result?.actual?.provider||result?.provider||config?.provider,80)||'shared'} model to synthesize the conversation into a real reviewable weave, then saved it locally as “${clean(plan.title,240)}”. Nothing is active yet.`,formatted].filter(Boolean).join('\n\n');
  const approvalGate={kind:'intention-activation',planId:item.id,state:'review',required:true,actions:['review','revise','activate']};
  return{
    response:{answer,choice:{mode:'Plan',system:'civweave',room:clean(plan?.routing?.room,240)||'civweave.quad',nextAction:'Review the saved weave, revise it, or activate it after review.'},assumptions:[...(plan.assumptions||[])],requiresConsent:true,confidence:.95,approvalGate},
    provider:result?.actual?.provider||result?.provider||config?.provider||'shared',requestedProvider:config?.provider||config?.route||'',model:result?.actual?.model||result?.model||config?.model||'',plan,planItemId:item.id,context:planContext(),fallbackFrom:null
  };
}
async function generateModelPlan(options={}){
  const runtime=globalThis.CivweaveModelRuntime,config=runtime?.readSharedConfig?.('interactive')||null;
  if(!runtime?.generate||!config||!modelCapable(config))return null;
  const messages=compactHistory(options.history);
  messages.push({role:'user',content:clean(options.text,8000)});
  const request={
    purpose:PLAN_PURPOSE,executionProfile:'interactive',
    config:{...config,timeoutMs:Math.min(Number(config.timeoutMs)||25000,25000),maxTokens:Math.max(Number(config.maxTokens)||0,8192),temperature:Math.min(Number(config.temperature)||0.25,0.4)},
    schema:planSchema(),
    context:{currentSystem:'civweave',latestRequest:clean(options.text,8000),requirements:[
      'Infer the governing intention from the whole conversation, not merely the latest command.',
      'If the latest user turn says make a plan from above, plan this, or similar meta-language, do not use that command as the wish or title. Recover the actual project or desired outcome from earlier turns.',
      'Create only realm paths that materially help the intention. Living School is learning, Cerbanimo is skilled work, FellowFare is materials/services. Anarchadia is represented in governance.',
      'Every path must have executable steps, observable completion criteria, and reviewable evidence.',
      'Do not activate, spend, publish, assign, purchase, vote, or commit. The result is a review draft.'
    ]},
    messages:[
      {role:'system',content:'You are Weaveling, Civweave’s central mirror and orchestrator. Synthesize the user’s real intention from the conversation into a concrete reviewable weave. Return strict JSON matching the schema. The latest line may be a meta-command such as “make a plan from the above”; recover the actual underlying wish from the preceding conversation. Do not merely repeat chat advice and do not claim activation.'},
      ...messages
    ]
  };
  const result=await runtime.generate(request);
  if(result?.status!=='success'||!result?.outputJson)throw new Error(result?.error?.message||result?.error||`The configured model ended plan synthesis with ${result?.status||'an error'}.`);
  const actualProvider=lower(result?.actual?.provider||result?.provider||config.provider);
  if(!ELIGIBLE_PROVIDERS.has(actualProvider))throw new Error(`The configured model route fell back to ${actualProvider||'a local route'} before producing the weave.`);
  const plan=modelPlan(result.outputJson,options,result);
  return materializeResult(plan,result,config);
}
async function modelFirstRespond(original,options={}){
  const system=lower(options?.systemId||'civweave')||'civweave';
  if(system!=='civweave'||!shouldPlan(options))return original(options);
  const runtime=globalThis.CivweaveModelRuntime,config=runtime?.readSharedConfig?.('interactive')||null;
  if(!config||!modelCapable(config))return original(options);
  try{return await generateModelPlan(options)}catch(error){
    const fallback=await original(options);
    if(fallback?.provider==='civweave-planner'){
      fallback.fallbackFrom={provider:config.provider||config.route||'shared',model:config.model||'',reason:clean(error?.message||error,1000)};
      fallback.response={...(fallback.response||{}),answer:`The configured ${clean(config.provider||config.route,80)||'shared'} model did not complete the intention synthesis (${clean(error?.message||error,500)}), so I used Civweave’s local deterministic planner as the offline-safe fallback.\n\n${clean(fallback.response?.answer,9000)}`};
    }
    return fallback;
  }
}
function patchAssistant(api=globalThis.CivweaveAssistantV141){
  if(!api?.respond)return false;
  if(api.respond?.__cwWeavelingModelFirstV266){patchedAssistant=api;return true}
  const originalFn=api.respond,original=originalFn.bind(api);
  const respond=options=>modelFirstRespond(original,options||{});
  respond.__cwWeavelingModelFirstV266=true;
  for(const key of Object.keys(originalFn)){try{respond[key]=originalFn[key]}catch{}}
  try{api.respond=respond;if(api.respond===respond){patchedAssistant=api;return true}}catch{}
  try{globalThis.CivweaveAssistantV141={...api,respond};patchedAssistant=globalThis.CivweaveAssistantV141;return true}catch{return false}
}
function patchLoader(loader=globalThis.CivweaveFamilyAILoaderV105){
  if(!loader?.ensure)return false;
  if(loader.ensure?.__cwWeavelingModelFirstV266){patchedLoader=loader;return true}
  const originalEnsure=loader.ensure.bind(loader);
  const ensure=async(...args)=>{const result=await originalEnsure(...args);patchAssistant();return result};
  ensure.__cwWeavelingModelFirstV266=true;
  try{loader.ensure=ensure;patchedLoader=loader;return true}catch{return false}
}
function start(){
  patchLoader();patchAssistant();
  addEventListener('civweave:guide-loader-reset',()=>queueMicrotask(()=>{patchLoader();patchAssistant()}));
  addEventListener('civweave:guide-workspace-ready',()=>queueMicrotask(()=>{patchLoader();patchAssistant()}));
  let ticks=0;const timer=setInterval(()=>{if(globalThis.CivweaveFamilyAILoaderV105!==patchedLoader)patchLoader();if(globalThis.CivweaveAssistantV141!==patchedAssistant||!globalThis.CivweaveAssistantV141?.respond?.__cwWeavelingModelFirstV266)patchAssistant();if(++ticks>=300)clearInterval(timer)},100);
}

globalThis.CivweaveWeavelingModelFirstPlanV266=Object.freeze({version:VERSION,patchAssistant,patchLoader,shouldPlan,generateModelPlan,modelCapable,policy:'configured-model-authors-weave-local-planner-is-explicit-fallback-v266'});
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
