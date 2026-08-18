export * from './living-school-cleanroom-core-v218-base.mjs';

import {
  state,
  clean,
  clip,
  now,
  uid,
  moduleFor,
  normalizeModule,
} from './living-school-cleanroom-core-v218-base.mjs';

function questionSchema(){
  return {type:'object',required:['type','prompt'],properties:{
    id:{type:'string'},type:{type:'string'},prompt:{type:'string'},
    options:{type:'array',items:{type:'string'}},answer:{},explanation:{type:'string'},
    concepts:{type:'array',items:{type:'string'}},
    rubric:{type:'array',items:{type:'object',properties:{id:{type:'string'},label:{type:'string'},points:{type:'number'},role:{type:'string'},required:{type:'boolean'}}}},
    minWords:{type:'number'},maxWords:{type:'number'}
  }};
}
function moduleSchema(){
  const question=questionSchema();
  return {type:'object',required:['title','summary','objective','relevance','prerequisites','estimatedEffort','artifact','completionCriteria','learningObjectives','concepts','lessonBlocks','visualization','practice','quiz','badge','xp','navigation','cerbanimoQuest'],properties:{
    title:{type:'string'},summary:{type:'string'},objective:{type:'string'},relevance:{type:'string'},
    prerequisites:{type:'array',items:{type:'string'}},estimatedEffort:{type:'string'},artifact:{type:'string'},
    completionCriteria:{type:'array',items:{type:'string'}},learningObjectives:{type:'array',items:{type:'string'}},
    concepts:{type:'array',items:{type:'object',required:['term','definition'],properties:{term:{type:'string'},definition:{type:'string'}}}},
    lessonBlocks:{type:'array',items:{type:'object',required:['heading','content','sourceIds','provenance'],properties:{heading:{type:'string'},content:{type:'string'},sourceIds:{type:'array',items:{type:'string'}},provenance:{type:'string'}}}},
    visualization:{type:'object',required:['type','title','caption','items'],properties:{type:{type:'string'},title:{type:'string'},caption:{type:'string'},items:{type:'array',items:{type:'object',required:['label','detail'],properties:{label:{type:'string'},detail:{type:'string'}}}}}},
    practice:{type:'object',required:['prompt','steps','deliverable','rubric','completionCriteria'],properties:{prompt:{type:'string'},steps:{type:'array',items:{type:'string'}},deliverable:{type:'string'},rubric:{type:'array',items:{type:'object',required:['criterion','weight'],properties:{criterion:{type:'string'},weight:{type:'number'}}}},completionCriteria:{type:'string'}}},
    quiz:{type:'object',required:['questionsPerAttempt','passScore','bank','remediation'],properties:{questionsPerAttempt:{type:'number'},passScore:{type:'number'},bank:{type:'array',items:question},remediation:{type:'string'}}},
    badge:{type:'object',required:['title','description'],properties:{title:{type:'string'},description:{type:'string'}}},
    xp:{type:'object',required:['domain','amount'],properties:{domain:{type:'string'},amount:{type:'number'}}},
    navigation:{type:'object',required:['entry','next'],properties:{entry:{type:'string'},next:{type:'string'}}},
    cerbanimoQuest:{type:'object',required:['title','brief','proof'],properties:{title:{type:'string'},brief:{type:'string'},proof:{type:'string'}}}
  }};
}
function moduleEnvelopeSchema(){return {type:'object',required:['module'],properties:{module:moduleSchema()}};}
async function runtimeReady(){
  await globalThis.CivweaveFamilyAILoaderV105?.ensure?.();
  const runtime=globalThis.CivweaveModelRuntime;
  if(!runtime?.generate)throw new Error('The shared model runtime is unavailable.');
  return runtime;
}
function deterministicProvider(provider){return ['','bundled','packaged','reflex','minilm','local-reflex','deterministic','manual','semantic-local'].includes(clean(provider,120).toLowerCase());}
function modulePrompt(index,count,data,priorTitles){
  return `Create module ${index+1} of ${count} for this observable capability: ${data.capability}. Level: ${data.level}. Mode: ${data.mode}. Proof contract: ${data.proof||'working artifact plus reviewable evidence'}. Prior modules: ${priorTitles.length?priorTitles.join(' | '):'none'}.`;
}
async function generateOne(runtime,config,data,index,count,sources,priorTitles){
  const context={
    capability:data.capability,level:data.level,mode:data.mode,moduleIndex:index,moduleNumber:index+1,moduleCount:count,
    proofContract:data.proof,priorModuleTitles:priorTitles,sources,
    constraints:[
      'Generate only this one module.','Use only supplied source IDs.','Never invent citations, URLs, quotations, dates, or access claims.',
      'Every lesson block must include sourceIds when grounded, otherwise provenance must be generated-unverified.',
      'Mark uncertainty explicitly.','Question banks must be larger than each attempt and include mixed question types.',
      'Do not repeat prior module titles or objectives.','Speak only as Moss and never impersonate another Civweave guide.'
    ]
  };
  const messages=[
    {role:'system',content:'You are Moss, Living School learning guide. Build exactly one complete curriculum module as JSON inside a top-level module property. Teach in readable content blocks. Include practical artifacts, weighted rubrics, mixed quizzes, feedback, remediation, a badge, exact Skill XP, navigation, and a Cerbanimo practice quest. Never impersonate another guide.'},
    {role:'user',content:modulePrompt(index,count,data,priorTitles)}
  ];
  const baseRequest={purpose:`living-school-module-${index+1}-of-${count}-v219`,executionProfile:'interactive',config:{...config,maxTokens:Math.max(Number(config.maxTokens)||0,6144),temperature:Math.min(Number(config.temperature)||0.2,0.3)},context,messages};
  let result=await runtime.generate({...baseRequest,schema:moduleEnvelopeSchema()});
  if(result?.status==='success'&&result?.outputJson&&typeof result.outputJson==='object')return result;
  const errorText=clean(result?.error?.message||result?.error,1000);
  if(!/structured|json|schema|parse|output/i.test(errorText))return result;
  result=await runtime.generate({...baseRequest,schema:undefined,responseSchema:undefined,responseFormat:'json',context:{...context,constraints:[...context.constraints,'Return valid JSON. The top-level object must contain exactly one module property.']}});
  return result;
}

export async function generateSchool(data){
  const current=state();
  const capability=clean(data.capability,1200),count=clip(data.count,1,8);
  const deterministic={id:current.school?.id||uid('school'),title:clean(data.title||capability,180)||'Untitled learning path',capability,level:data.level||'beginner',mode:data.mode||'guided',proof:clean(data.proof||'A working artifact, explanation, and independent receipt.',2400),createdAt:current.school?.createdAt||now(),updatedAt:now(),modules:Array.from({length:count},(_,index)=>moduleFor(index,capability)),generation:{provider:'deterministic',model:'local curriculum compiler',generatedAt:now(),fallback:false,sourceCount:current.sources?.length||0,researchMode:current.research?.mode||'none',formatContract:'living-school-module-contract-v218.1'}};
  if(data.modelRoute!=='shared')return deterministic;
  try{
    const runtime=await runtimeReady(),config=runtime.readSharedConfig?.('interactive');
    if(!config)throw new Error('Shared model configuration is unavailable.');
    const provider=clean(config.provider||config.route,120).toLowerCase();
    if(deterministicProvider(provider))throw new Error('The selected shared route cannot generate full curriculum content.');
    const sources=(current.sources||[]).slice(0,16).map(source=>({id:source.id,title:source.title,url:source.url,quality:source.quality,use:source.use,notes:source.notes,verified:Boolean(source.verified),provenance:source.provenance,provenanceFlag:source.provenanceFlag}));
    const modules=[];let lastResult=null;
    for(let index=0;index<count;index+=1){
      const result=await generateOne(runtime,config,data,index,count,sources,modules.map(module=>module.title));
      lastResult=result;
      const raw=result?.outputJson?.module||result?.outputJson;
      if(result?.status!=='success'||!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error(result?.error?.message||result?.error||`Shared AI did not return module ${index+1}.`);
      const normalized=normalizeModule(raw,index,capability,'ai');
      if(!normalized.lessonBlocks?.length||!normalized.quiz?.bank?.length)throw new Error(`Shared AI returned incomplete module ${index+1}; refusing deterministic padding.`);
      modules.push(normalized);
    }
    return{...deterministic,modules,updatedAt:now(),generation:{provider:lastResult?.actual?.provider||lastResult?.provider||config.provider||'shared',model:lastResult?.actual?.model||lastResult?.model||config.model||'',generatedAt:now(),fallback:false,sourceCount:sources.length,researchMode:current.research?.mode||'none',formatContract:'living-school-module-contract-v219-modulewise'}};
  }catch(error){return{...deterministic,generation:{...deterministic.generation,fallback:true,error:clean(error.message,500)}}}
}
