export * from './living-school-cleanroom-core-v218-base.mjs';

import {
  state,
  clean,
  clip,
  now,
  uid,
  moduleFor,
  normalizeModule,
  persist,
  copy,
  progressFor,
} from './living-school-cleanroom-core-v218-base.mjs';
import {ensureModuleVideo} from '../../video-learning-contract-v1.mjs?v=video-atlas-v1';

const RECOVERY_SCHEMA='civweave.living-school-generation-recovery.v1';
const DESIGN_PURPOSE='living-school-research-grounded-curriculum-v218.1';
const STRUCTURE_PURPOSE='living-school-structure-single-v221';
const BATCH_SIZE=1;
const REQUIRED_QUIZ_TYPES=['multiple-choice','multi-select','short-answer'];

async function runtimeReady(){
  await globalThis.CivweaveFamilyAILoaderV105?.ensure?.();
  const runtime=globalThis.CivweaveModelRuntime;
  if(!runtime?.generate)throw new Error('The shared model runtime is unavailable.');
  return runtime;
}
function deterministicProvider(provider){return ['','bundled','packaged','reflex','minilm','local-reflex','deterministic','manual','semantic-local'].includes(clean(provider,120).toLowerCase());}
function providerName(config={}){return clean(config.provider||config.route||config.engine,120).toLowerCase();}
function tierConfig(config,tier){
  const next={...(config||{})};
  if(providerName(next)!=='gemini')return next;
  const router=globalThis.CivweaveGeminiTaskTierRouterV213;
  const model=tier==='complex'?(router?.complexModel||'gemini-3.7-flash'):(router?.smallModel||'gemini-3.1-flash-lite');
  return{...next,provider:'gemini',route:'gemini',model};
}
function resultText(result){
  const direct=[result?.outputText,result?.text,result?.output,result?.content,result?.responseText].find(value=>typeof value==='string'&&value.trim());
  if(direct)return clean(direct,64000);
  if(result?.outputJson&&typeof result.outputJson==='object')try{return clean(JSON.stringify(result.outputJson),64000)}catch{}
  return'';
}
function actualRoute(result,config={}){return{provider:clean(result?.actual?.provider||result?.provider||config.provider||config.route||'shared',120),model:clean(result?.actual?.model||result?.model||config.model||'',180)}}
function sourceRows(current){return(current.sources||[]).slice(0,16).map(source=>({id:clean(source.id,180),title:clean(source.title,320),url:clean(source.url,2000),quality:clean(source.quality,120),use:clean(source.use,120),notes:clean(source.notes,5000),verified:Boolean(source.verified),provenance:clean(source.provenance,160),provenanceFlag:clean(source.provenanceFlag,240)})).filter(source=>source.id);}
function sourcePacketText(current,sources){
  const research=current.research||{};
  const lines=[
    `Research status: ${clean(research.flag||research.mode||'available source packet',240)}`,
    clean(research.summary,6000),
    ...sources.map(source=>`\nSOURCE_ID ${source.id}\nTITLE: ${source.title}\nPROVENANCE: ${source.provenanceFlag||source.provenance||'unspecified'}\nPASSAGE: ${source.notes||'(no passage text)'}`)
  ];
  return clean(lines.filter(Boolean).join('\n'),52000);
}
function requestedData(data,count){return{title:clean(data.title,240),capability:clean(data.capability,2400),level:clean(data.level,80)||'beginner',count,mode:clean(data.mode,80)||'guided',proof:clean(data.proof,3000)||'A working artifact, explanation, and independent receipt.'};}
function batchIndices(indices,size=BATCH_SIZE){const rows=[];for(let i=0;i<indices.length;i+=size)rows.push(indices.slice(i,i+size));return rows;}
function generationIndex(module,indexFallback=0){const explicit=Number(module?.generationIndex);if(Number.isInteger(explicit)&&explicit>=0)return explicit;const match=clean(module?.id,120).match(/^module-(\d+)$/i);return match?Math.max(0,Number(match[1])-1):indexFallback;}
function historyEntry(attempt,requestedCount,completedCount,failedCount,label='structured pass'){return{attempt,label,requestedCount,completedCount,failedCount,at:now()};}
function saveRecovery(report,eventType='living-school-generation-recovery-updated'){
  const current=state();current.generationRecovery=report;persist(eventType,{status:report.status,requestId:report.requestId,requestedCount:report.requestedCount,completedCount:report.completedCount,failedCount:report.failedCount,structureAttempt:report.structureAttempt,researchAttempt:report.researchAttempt});return report;
}
function defaultSchool(data,count){
  const current=state(),capability=clean(data.capability,1200);
  return{id:current.school?.id||uid('school'),title:clean(data.title||capability,180)||'Untitled learning path',capability,level:data.level||'beginner',mode:data.mode||'guided',proof:clean(data.proof||'A working artifact, explanation, and independent receipt.',2400),createdAt:current.school?.createdAt||now(),updatedAt:now(),requestedModuleCount:count,modules:Array.from({length:count},(_,index)=>moduleFor(index,capability)),generation:{provider:'deterministic',model:'local curriculum compiler',generatedAt:now(),fallback:false,sourceCount:current.sources?.length||0,researchMode:current.research?.mode||'none',formatContract:'living-school-module-contract-v218.1'}};
}

async function generateDesignPacket(runtime,config,data,count,sources,previous=''){
  const current=state(),fallbackText=sourcePacketText(current,sources);
  const context={
    capability:data.capability,level:data.level,mode:data.mode,moduleCount:count,proofContract:data.proof,
    sources,research:current.research||{},previousPacket:clean(previous,12000),
    constraints:[
      'This is the reasoning and instructional-design pass, not the final Living School JSON pass.',
      `Plan exactly ${count} numbered modules with a coherent progression.`,
      'Use only supplied SOURCE_ID values when grounding claims; never invent citations, URLs, quotations, dates, or access claims.',
      'For every module include teaching points, cautions or uncertainty, practical work, assessment intent, and a concise video-search topic.',
      'Write enough substantive instructional guidance that a lightweight formatter can construct the final lessons without doing new research.',
      'Return readable Markdown/plain text, not JSON.'
    ]
  };
  const request={
    purpose:DESIGN_PURPOSE,taskTier:'complex',executionProfile:'agentic',
    config:{...tierConfig(config,'complex'),maxTokens:Math.max(Number(config.maxTokens)||0,8192),temperature:Math.min(Number(config.temperature)||0.25,0.35)},
    context,
    messages:[
      {role:'system',content:'You are Moss performing the research synthesis and instructional design pass for Living School. Produce a substantive human-readable teaching and curriculum design packet. Do not serialize the final application schema and do not return JSON.'},
      {role:'user',content:`Build the research-backed design packet for “${data.capability}”. Organize it as modules 1 through ${count}. The next pass is a lightweight formatter, so make the educational content, source mapping, exercises, assessment intent, and video topic for each module explicit.`}
    ]
  };
  try{
    const result=await runtime.generate(request),route=actualRoute(result,request.config),text=resultText(result);
    if(result?.status!=='success'||!text)throw new Error(result?.error?.message||result?.error||'The research/design model returned no usable packet.');
    return{status:'complete',content:clean(text,32000),provider:route.provider,model:route.model,generatedAt:now(),source:'flash-design-pass',error:''};
  }catch(error){
    if(!fallbackText)throw error;
    return{status:'source-packet-only',content:clean(fallbackText,32000),provider:'source-packet',model:'no additional synthesis',generatedAt:now(),source:'existing-research-packet',error:clean(error?.message||error,1200)};
  }
}

function moduleIssues(raw,index,knownSourceIds){
  const issues=[];const label=`Module ${index+1}`;
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return[`${label}: no structured module object was returned.`];
  for(const key of ['title','summary','objective','relevance','estimatedEffort','artifact'])if(!clean(raw[key],120))issues.push(`${key} missing`);
  for(const key of ['prerequisites','completionCriteria','learningObjectives','concepts'])if(!Array.isArray(raw[key])||!raw[key].length)issues.push(`${key} missing`);
  const blocks=Array.isArray(raw.lessonBlocks)?raw.lessonBlocks:[];
  if(blocks.length<3)issues.push(`lessonBlocks ${blocks.length}/3 minimum`);
  else for(const [bIndex,block] of blocks.entries()){
    if(!clean(block?.heading,80)||clean(block?.content,20000).length<240)issues.push(`lesson block ${bIndex+1} is too thin`);
    for(const sourceId of Array.isArray(block?.sourceIds)?block.sourceIds:[])if(sourceId&&!knownSourceIds.has(clean(sourceId,180)))issues.push(`lesson block ${bIndex+1} cites unknown SOURCE_ID ${clean(sourceId,180)}`);
  }
  const visual=raw.visualization;if(!visual||typeof visual!=='object'||!clean(visual.title,80)||!Array.isArray(visual.items)||!visual.items.length)issues.push('visualization incomplete');
  const practice=raw.practice;if(!practice||typeof practice!=='object'||!clean(practice.prompt,120)||!Array.isArray(practice.steps)||!practice.steps.length||!Array.isArray(practice.rubric)||!practice.rubric.length||!clean(practice.deliverable,120)||!clean(practice.completionCriteria,120))issues.push('practice contract incomplete');
  const quiz=raw.quiz&&typeof raw.quiz==='object'?raw.quiz:{},bank=Array.isArray(quiz.bank)?quiz.bank:[],attemptCount=Math.max(3,Math.min(5,Number(quiz.questionsPerAttempt||3)||3)),types=new Set(bank.map(question=>clean(question?.type,80).toLowerCase()));
  if(bank.length<attemptCount+2)issues.push(`quiz bank ${bank.length}/${attemptCount+2} minimum`);
  const missingTypes=REQUIRED_QUIZ_TYPES.filter(type=>!types.has(type));if(missingTypes.length)issues.push(`quiz missing ${missingTypes.join(', ')}`);
  if(!clean(quiz.remediation,120))issues.push('quiz remediation missing');
  if(!clean(raw.badge?.title,80)||!clean(raw.badge?.description,120))issues.push('badge incomplete');
  if(!clean(raw.xp?.domain,40)||!Number.isFinite(Number(raw.xp?.amount)))issues.push('XP contract incomplete');
  if(!clean(raw.navigation?.entry,80))issues.push('navigation entry missing');
  if(!clean(raw.cerbanimoQuest?.title,80)||!clean(raw.cerbanimoQuest?.brief,120)||!clean(raw.cerbanimoQuest?.proof,120))issues.push('Cerbanimo quest incomplete');
  return issues.slice(0,24);
}
function topObjects(text){
  const output=[],source=String(text||'').replace(/```(?:json)?/gi,'').replace(/```/g,'');let depth=0,start=-1,inString=false,escaped=false;
  for(let i=0;i<source.length;i++){
    const char=source[i];
    if(inString){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')inString=false;continue}
    if(char==='"'){inString=true;continue}
    if(char==='{'){if(depth===0)start=i;depth+=1;continue}
    if(char==='}'){depth=Math.max(0,depth-1);if(depth===0&&start>=0){const chunk=source.slice(start,i+1);try{output.push(JSON.parse(chunk))}catch{}start=-1}}
  }
  return output;
}
function candidateRows(result,text,targets){
  const candidates=[];const add=value=>{if(!value)return;if(Array.isArray(value)){value.forEach(add);return}if(typeof value!=='object')return;if(Array.isArray(value.modules)){value.modules.forEach(add);return}candidates.push(value)};
  add(result?.outputJson);
  if(text){try{add(JSON.parse(text))}catch{}for(const item of topObjects(text))add(item)}
  const rows=[],used=new Set();let sequential=0;
  for(const candidate of candidates){
    const module=candidate?.module&&typeof candidate.module==='object'?candidate.module:candidate;
    let oneBased=Number(candidate?.moduleIndex??candidate?.index??module?.moduleIndex??module?.index);
    let index=Number.isInteger(oneBased)?(oneBased>=1?oneBased-1:oneBased):targets[sequential++];
    if(!targets.includes(index)||used.has(index))continue;used.add(index);rows.push({index,module});
  }
  return rows;
}
function compactSources(sources){return sources.map(source=>({id:source.id,title:source.title,provenance:source.provenanceFlag||source.provenance,notes:clean(source.notes,2600)}));}
function structureSchema(index){
  const string={type:'string'},strings={type:'array',minItems:1,items:string};
  return{
    type:'object',required:['moduleIndex','module'],properties:{
      moduleIndex:{type:'integer',enum:[index+1]},
      module:{type:'object',required:['title','summary','objective','relevance','estimatedEffort','artifact','prerequisites','completionCriteria','learningObjectives','concepts','lessonBlocks','visualization','practice','quiz','badge','xp','navigation','cerbanimoQuest'],properties:{
        title:string,summary:string,objective:string,relevance:string,estimatedEffort:string,artifact:string,
        prerequisites:strings,completionCriteria:strings,learningObjectives:strings,
        concepts:{type:'array',minItems:1,items:{type:'object',required:['term','definition'],properties:{term:string,definition:string}}},
        lessonBlocks:{type:'array',minItems:3,items:{type:'object',required:['heading','content','sourceIds','provenance'],properties:{id:string,heading:string,content:string,sourceIds:{type:'array',items:string},provenance:string}}},
        visualization:{type:'object',required:['title','caption','items'],properties:{type:string,title:string,caption:string,items:{type:'array',minItems:1,items:{type:'object',required:['label','detail'],properties:{label:string,detail:string}}}}},
        practice:{type:'object',required:['prompt','steps','deliverable','rubric','completionCriteria'],properties:{prompt:string,steps:strings,deliverable:string,rubric:{type:'array',minItems:1,items:{type:'object',required:['criterion','weight'],properties:{criterion:string,weight:{type:'number'}}}},completionCriteria:string}},
        quiz:{type:'object',required:['questionsPerAttempt','bank','remediation'],properties:{questionsPerAttempt:{type:'integer'},passScore:{type:'number'},bank:{type:'array',minItems:5,items:{type:'object',required:['type','prompt'],properties:{id:string,type:{type:'string',enum:REQUIRED_QUIZ_TYPES},prompt:string,options:{type:'array',items:string},answer:{},explanation:string,concepts:{type:'array',items:string},rubric:{type:'array',items:{type:'object',properties:{id:string,label:string,points:{type:'number'},role:string,required:{type:'boolean'}}}},minWords:{type:'number'},maxWords:{type:'number'},provenance:string}}},remediation:string}},
        badge:{type:'object',required:['title','description'],properties:{title:string,description:string}},
        xp:{type:'object',required:['domain','amount'],properties:{domain:string,amount:{type:'number'}}},
        navigation:{type:'object',required:['entry'],properties:{entry:string,next:string}},
        cerbanimoQuest:{type:'object',required:['title','brief','proof'],properties:{title:string,brief:string,proof:string}}
      }}
    }
  };
}
async function structureBatch(runtime,config,data,count,design,sources,targets){
  const index=targets[0];
  const smallConfig={...tierConfig(config,'small'),maxTokens:Math.max(Number(config.maxTokens)||0,16384),temperature:Math.min(Number(config.temperature)||0.2,0.3)};
  const context={
    capability:data.capability,level:data.level,mode:data.mode,moduleCount:count,requestedModuleNumbers:[index+1],proofContract:data.proof,
    designPacket:clean(design.content,32000),sources:compactSources(sources),
    constraints:[
      'This is a formatting/construction pass. Do not perform new research or invent facts.',
      'Use the supplied design packet as the instructional authority and preserve its source mapping.',
      `Return exactly one complete JSON object for module ${index+1}.`,
      'The object must have exactly two top-level properties: moduleIndex (1-based) and module.',
      'The module must contain at least 3 substantive lesson blocks, a visualization, practice rubric, a complete mixed quiz bank, badge, XP, navigation, and Cerbanimo quest.',
      'Use only supplied SOURCE_ID values. If a statement is not source-backed, use provenance generated-unverified rather than inventing a citation.',
      'Do not include a video URL. Civweave resolves the required relevant video locally after the module validates.'
    ]
  };
  const result=await runtime.generate({
    purpose:STRUCTURE_PURPOSE,taskTier:'small',executionProfile:'interactive',config:smallConfig,context,schema:structureSchema(index),maxRepairAttempts:2,
    messages:[
      {role:'system',content:'You are Moss’s lightweight Living School formatter. Convert supplied researched instructional content into one complete application module without adding new research. Return only the schema-matching JSON object with moduleIndex and module properties.'},
      {role:'user',content:`Construct module ${index+1} of ${count}. Preserve the educational substance of the design packet. The module must be complete enough to use immediately; do not insert placeholders or generic scaffold text.`}
    ]
  });
  return{result,text:resultText(result),route:actualRoute(result,smallConfig)};
}
async function runStructurePass(runtime,config,data,count,design,sources,targets){
  const knownSourceIds=new Set(sources.map(source=>source.id)),completed=[],failures=[],batches=[];
  for(const indices of batchIndices(targets)){
    let result=null,text='',route={provider:providerName(config)||'shared',model:clean(config.model,180)},error='';
    try{
      const response=await structureBatch(runtime,config,data,count,design,sources,indices);result=response.result;text=response.text;route=response.route;
      if(result?.status!=='success'&&!text)error=clean(result?.error?.message||result?.error||`Formatting ended with ${result?.status||'an error'}.`,1200);
    }catch(caught){error=clean(caught?.message||caught,1200)}
    const rows=candidateRows(result,text,indices),byIndex=new Map(rows.map(row=>[row.index,row.module]));
    for(const index of indices){
      const raw=byIndex.get(index);
      let issues=raw?moduleIssues(raw,index,knownSourceIds):[error||`Module ${index+1} was not returned in a parseable structured object.`];
      if(!issues.length){
        try{
          const normalized=normalizeModule(raw,index,data.capability,'ai');normalized.generationIndex=index;
          await ensureModuleVideo(normalized,{subjectContext:data.capability});
          if(!normalized.video)issues=['Required module video could not be resolved.'];else completed.push({index,module:normalized,provider:route.provider,model:route.model});
        }catch(videoError){issues=[`Video requirement failed: ${clean(videoError?.message||videoError,1000)}`]}
      }
      if(issues.length)failures.push({index,status:raw?'partial':'failed',issues,raw:clean(raw?JSON.stringify(raw,null,2):(text||error),8000),provider:route.provider,model:route.model,at:now()});
    }
    batches.push({indices,status:indices.every(index=>completed.some(row=>row.index===index))?'complete':completed.some(row=>indices.includes(row.index))?'partial':'failed',provider:route.provider,model:route.model,raw:indices.some(index=>failures.some(row=>row.index===index))?clean(text||error,10000):'',at:now()});
  }
  return{completed,failures,batches};
}
function moduleReport(count,completed,failures,prior=[]){
  const completeMap=new Map(completed.map(row=>[row.index,row])),failureMap=new Map(failures.map(row=>[row.index,row])),priorMap=new Map((prior||[]).map(row=>[row.index,row]));
  return Array.from({length:count},(_,index)=>{
    if(completeMap.has(index)){const row=completeMap.get(index);return{index,status:'complete',title:clean(row.module?.title,220),issues:[],provider:row.provider,model:row.model,at:now()}}
    if(failureMap.has(index))return failureMap.get(index);
    return priorMap.get(index)||{index,status:'failed',issues:['No structured module has completed yet.'],raw:'',provider:'',model:'',at:now()};
  });
}
function candidateSchool(data,count,modules,design,route,requestId){
  const current=state(),ordered=[...modules].sort((a,b)=>generationIndex(a)-generationIndex(b));
  return{id:uid('school'),title:clean(data.title||data.capability,180)||'Untitled learning path',capability:clean(data.capability,1200),level:data.level||'beginner',mode:data.mode||'guided',proof:clean(data.proof,2400),createdAt:now(),updatedAt:now(),requestedModuleCount:count,modules:ordered,generation:{provider:route.provider||'shared',model:route.model||'',generatedAt:now(),fallback:false,partial:ordered.length<count,completedModuleCount:ordered.length,failedModuleCount:count-ordered.length,sourceCount:current.sources?.length||0,researchMode:current.research?.mode||'none',formatContract:'living-school-flash-design-lite-single-v221',requestId,designProvider:design.provider,designModel:design.model}};
}
function recoveryStatus(completed,count){return completed>=count?'complete':completed>0?'partial':'failed';}

export async function generateSchool(data){
  const current=state(),capability=clean(data.capability,1200),count=clip(data.count,1,8),fallback=defaultSchool(data,count);
  if(data.modelRoute!=='shared')return fallback;
  const requestId=uid('curriculum-run'),request=requestedData(data,count),sources=sourceRows(current);
  try{
    const runtime=await runtimeReady(),config=runtime.readSharedConfig?.('interactive');
    if(!config)throw new Error('Shared model configuration is unavailable.');
    const provider=providerName(config);if(deterministicProvider(provider))throw new Error('The selected shared route cannot generate full curriculum content.');
    const design=await generateDesignPacket(runtime,config,request,count,sources);
    const pass=await runStructurePass(runtime,config,request,count,design,sources,Array.from({length:count},(_,index)=>index));
    const modules=pass.completed.map(row=>row.module),route=pass.completed[0]?{provider:pass.completed[0].provider,model:pass.completed[0].model}:actualRoute(null,tierConfig(config,'small'));
    const school=candidateSchool(request,count,modules,design,route,requestId),completedCount=modules.length,failedCount=count-completedCount;
    const report={schema:RECOVERY_SCHEMA,requestId,status:recoveryStatus(completedCount,count),request,requestedCount:count,completedCount,failedCount,structureAttempt:1,researchAttempt:1,createdAt:now(),updatedAt:now(),unstructured:{...design},modules:moduleReport(count,pass.completed,pass.failures),batches:pass.batches,history:[historyEntry(1,count,completedCount,failedCount)],candidate:{...copy(school),modules:copy(modules)}};
    saveRecovery(report,'living-school-generation-first-pass-reported');
    if(!modules.length)return{...fallback,generation:{...fallback.generation,fallback:true,error:pass.failures.map(row=>`module ${row.index+1}: ${row.issues.join('; ')}`).join(' | ').slice(0,1800)||'No structured modules completed.',formatContract:'living-school-flash-design-lite-single-v221',requestId,recoveryAvailable:true}};
    return school;
  }catch(error){
    const design={status:'unavailable',content:sourcePacketText(current,sources),provider:'none',model:'none',generatedAt:now(),source:'existing-research-packet',error:clean(error?.message||error,1200)};
    const report={schema:RECOVERY_SCHEMA,requestId,status:'failed',request,requestedCount:count,completedCount:0,failedCount:count,structureAttempt:0,researchAttempt:1,createdAt:now(),updatedAt:now(),unstructured:design,modules:Array.from({length:count},(_,index)=>({index,status:'failed',issues:[clean(error?.message||error,1200)],raw:'',provider:'',model:'',at:now()})),batches:[],history:[historyEntry(0,count,0,count,'generation setup')],candidate:null};
    saveRecovery(report,'living-school-generation-first-pass-failed');
    return{...fallback,generation:{...fallback.generation,fallback:true,error:clean(error?.message||error,1800),formatContract:'living-school-flash-design-lite-single-v221',requestId,recoveryAvailable:true}};
  }
}

export async function regenerateLivingSchoolResearch(){
  const current=state(),report=current.generationRecovery;if(!report?.request)throw new Error('There is no recoverable Living School generation run.');
  const runtime=await runtimeReady(),config=runtime.readSharedConfig?.('interactive');if(!config)throw new Error('Shared model configuration is unavailable.');
  const sources=sourceRows(current),previous=report.unstructured?.content||'',design=await generateDesignPacket(runtime,config,report.request,report.requestedCount,sources,previous);
  report.unstructured=design;report.researchAttempt=Number(report.researchAttempt||0)+1;report.updatedAt=now();
  report.history=[...(report.history||[]),{attempt:report.researchAttempt,label:'research/design regenerated',requestedCount:report.requestedCount,completedCount:report.completedCount,failedCount:report.failedCount,at:now()}].slice(-20);
  saveRecovery(report,'living-school-generation-research-regenerated');return copy(report);
}

export async function regenerateLivingSchoolStructure(){
  const current=state(),report=current.generationRecovery;if(!report?.request)throw new Error('There is no recoverable Living School generation run.');
  const targets=(report.modules||[]).filter(row=>row.status!=='complete').map(row=>Number(row.index)).filter(Number.isInteger);
  if(!targets.length)return current.school;
  const runtime=await runtimeReady(),config=runtime.readSharedConfig?.('interactive');if(!config)throw new Error('Shared model configuration is unavailable.');
  const sources=sourceRows(current),design=report.unstructured;if(!design?.content)throw new Error('The unstructured research/design packet is unavailable. Regenerate it first.');
  const pass=await runStructurePass(runtime,config,report.request,report.requestedCount,design,sources,targets);
  const candidate=report.candidate&&typeof report.candidate==='object'?copy(report.candidate):candidateSchool(report.request,report.requestedCount,[],design,{provider:'shared',model:''},report.requestId);
  const moduleMap=new Map((candidate.modules||[]).map((module,index)=>[generationIndex(module,index),module]));for(const row of pass.completed)moduleMap.set(row.index,row.module);
  candidate.modules=[...moduleMap.entries()].sort((a,b)=>a[0]-b[0]).map(([,module])=>module);candidate.updatedAt=now();candidate.generation={...(candidate.generation||{}),provider:pass.completed[0]?.provider||candidate.generation?.provider||'shared',model:pass.completed[0]?.model||candidate.generation?.model||'',partial:candidate.modules.length<report.requestedCount,completedModuleCount:candidate.modules.length,failedModuleCount:Math.max(0,report.requestedCount-candidate.modules.length),generatedAt:now(),requestId:report.requestId,formatContract:'living-school-flash-design-lite-single-v221'};
  const nextModules=moduleReport(report.requestedCount,pass.completed,pass.failures,report.modules),completedCount=nextModules.filter(row=>row.status==='complete').length,failedCount=report.requestedCount-completedCount,nextAttempt=Number(report.structureAttempt||0)+1;
  report.modules=nextModules;report.batches=[...(report.batches||[]),...pass.batches].slice(-16);report.completedCount=completedCount;report.failedCount=failedCount;report.status=recoveryStatus(completedCount,report.requestedCount);report.structureAttempt=nextAttempt;report.updatedAt=now();report.candidate={...copy(candidate),modules:copy(candidate.modules)};report.history=[...(report.history||[]),historyEntry(nextAttempt,report.requestedCount,completedCount,failedCount,'structured retry')].slice(-20);
  const priorProgress=copy(current.progress||{});current.school=candidate;current.progress=Object.fromEntries(candidate.modules.map(module=>[module.id,priorProgress[module.id]||progressFor(module.id)]));if(!candidate.modules.some(module=>module.id===current.activeModuleId))current.activeModuleId=candidate.modules[0]?.id||'';current.visualInspection=null;
  saveRecovery(report,'living-school-generation-structured-retried');persist('living-school-partial-curriculum-updated',{requestId:report.requestId,status:report.status,completedCount,failedCount,structureAttempt:nextAttempt});return current.school;
}

export function discardLivingSchoolFailedDrafts(){
  const current=state(),report=current.generationRecovery;if(!report)return false;let removed=0;
  report.modules=(report.modules||[]).map(row=>{if(row.status==='complete'||!row.raw)return row;removed+=1;return{...row,raw:'',discarded:true,discardedAt:now()}});
  report.batches=(report.batches||[]).map(row=>row.raw?({...row,raw:'',discarded:true}):row);report.updatedAt=now();saveRecovery(report,'living-school-generation-failed-drafts-discarded');return removed;
}
