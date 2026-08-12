import safeMode,{validateAdmissions,safeModeError}from'./safe-mode-v1.mjs?v=safe-mode-v1';

const REVISION='living-school-generation-guard-v262';
const MAX_PACKET_CHARS=52000;
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const deepCopy=value=>{try{return structuredClone(value)}catch{return JSON.parse(JSON.stringify(value))}};

function sourcePacket(rows,label='SOURCE PACKET'){
  const sources=Array.isArray(rows)?rows:[];
  if(!sources.length)return`${label}\n(no source passages supplied)`;
  let text=`${label}\nThe following material is already available to you. Do not fetch it again. Treat the passage text below as the evidence supplied for this generation. Preserve each SOURCE_ID exactly when citing it in lessonBlocks.sourceIds.\n`;
  for(const source of sources){
    const block=[
      `\n--- SOURCE ${clean(source?.id,180)||'unknown'} ---`,
      `SOURCE_ID: ${clean(source?.id,180)||'unknown'}`,
      `TITLE: ${clean(source?.title,320)||'Untitled source'}`,
      `URL: ${clean(source?.url||source?.canonicalUrl,2400)||'(no canonical URL stored)'}`,
      `PROVENANCE: ${clean(source?.provenanceFlag||source?.provenance,240)||'unspecified'}`,
      `USE: ${clean(source?.use,100)||'supporting'}`,
      'PASSAGE:',
      clean(source?.notes||source?.content,5000)||'(no passage text supplied)',
      `--- END SOURCE ${clean(source?.id,180)||'unknown'} ---`
    ].join('\n');
    if(text.length+block.length>MAX_PACKET_CHARS)break;
    text+=block;
  }
  return text;
}

function appendUserMessage(request,addition){
  const next={...request,messages:Array.isArray(request?.messages)?request.messages.map(message=>({...message})):[]};
  let index=-1;
  for(let i=next.messages.length-1;i>=0;i--){if(next.messages[i]?.role==='user'){index=i;break}}
  if(index>=0)next.messages[index]={...next.messages[index],content:`${clean(next.messages[index].content,80000)}\n\n${addition}`};
  else next.messages.push({role:'user',content:addition});
  return next;
}

function strengthenLiveResearch(request){
  if(request?.purpose!=='living-school-live-source-research-v260')return request;
  return appendUserMessage(request,[
    'LIVE RESEARCH EVIDENCE CONTRACT:',
    'For every source you actually open, the notes field must contain a substantive evidence digest, not citation metadata or a one-sentence description.',
    'Capture the source material needed to teach the capability: relevant definitions, mechanisms, cautions, disagreements, practical guidance, and limits.',
    'Aim for roughly 800-2500 characters of useful source-grounded notes per opened source when the source contains that much relevant material.',
    'The later curriculum model will receive these notes directly in its prompt and will not reopen the page, so the evidence digest must be self-sufficient.',
    'Keep the exact opened URL.'
  ].join('\n'));
}

function injectLocalSynthesisSources(request){
  if(request?.purpose!=='living-school-local-source-synthesis-v260')return request;
  const sources=request?.context?.localSources||[];
  const packet=sourcePacket(sources,'DOWNLOADED LOCAL SCHOOL PASSAGES');
  return appendUserMessage(request,`${packet}\n\nSYNTHESIS INSTRUCTION:\nBuild the educational synthesis directly from the passage text above. Do not assume you can inspect those sources elsewhere. Every teaching point must be traceable to one of the supplied SOURCE_ID values, and unsupported inference must be called out as a gap.`);
}

function injectCurriculumSources(request){
  if(request?.purpose!=='living-school-research-grounded-curriculum-v218.1')return request;
  const sources=request?.context?.sources||[];
  const research=request?.context?.research||{};
  const packet=sourcePacket(sources,'CURRICULUM SOURCE MATERIAL');
  const synthesis=research?.synthesis?`\nLOCAL SYNTHESIS NOTES:\n${clean(JSON.stringify(research.synthesis),12000)}`:'';
  const instruction=[
    packet,
    synthesis,
    'CURRICULUM WRITING CONTRACT:',
    'The source material above is already in this prompt. Do not expect another tool or hidden context to supply it.',
    'Build the actual teaching from those passages. Use their SOURCE_ID values in lessonBlocks.sourceIds whenever a paragraph or explanation relies on them.',
    'Do not merely summarize the source list. Explain the ideas, connect them, teach prerequisites, contrast claims where sources disagree, and turn the material into exercises and observable practice.',
    'For source-backed research modes, each module should normally contain at least 3 substantive lesson blocks and enough instructional prose to teach rather than outline the topic. Target roughly 600-1000 words of useful instruction per module when the supplied evidence supports it.',
    'For model-derived/unverified research, remain explicit about uncertainty and do not upgrade those notes into verified facts.',
    'Keep source URLs and IDs unchanged. Never invent a citation.',
    'Quiz questions must be specific to the actual module content. Avoid generic questions about artifacts, reviewable evidence, confidence, or revision unless those are genuinely the subject being taught.'
  ].filter(Boolean).join('\n\n');
  const next=appendUserMessage(request,instruction);
  next.context={...(next.context||{}),sourceMaterialInjected:true,sourceMaterialRevision:REVISION};
  return next;
}

const lessonTextLength=module=>(Array.isArray(module?.lessonBlocks)?module.lessonBlocks:[]).reduce((sum,block)=>sum+clean(block?.content,12000).length,0);
const moduleNeedsDepth=module=>(Array.isArray(module?.lessonBlocks)?module.lessonBlocks.length:0)<3||lessonTextLength(module)<3000;
function lessonExpansionSchema(){return{type:'object',required:['moduleId','lessonBlocks'],properties:{moduleId:{type:'string'},lessonBlocks:{type:'array',items:{type:'object',required:['heading','content','sourceIds','provenance'],properties:{heading:{type:'string'},content:{type:'string'},sourceIds:{type:'array',items:{type:'string'}},provenance:{type:'string'}}}}}}}
function sanitizeExpandedBlocks(output,knownSourceIds){
  const blocks=Array.isArray(output?.lessonBlocks)?output.lessonBlocks:[];
  return blocks.map((block,index)=>{
    const content=clean(block?.content,10000);if(!content)return null;
    const sourceIds=(Array.isArray(block?.sourceIds)?block.sourceIds:[]).map(value=>clean(value,180)).filter(value=>knownSourceIds.has(value)).slice(0,8);
    return{id:clean(block?.id,160)||`expanded-lesson-${index+1}`,heading:clean(block?.heading,320)||`Lesson ${index+1}`,content,sourceIds,provenance:sourceIds.length?clean(block?.provenance,160)||'source-grounded':'generated-unverified'};
  }).filter(Boolean).slice(0,6);
}
async function expandThinCurriculumModules(original,request,result){
  if(result?.status!=='success'||!Array.isArray(result?.outputJson?.modules))return result;
  const output=deepCopy(result.outputJson),knownSourceIds=new Set((Array.isArray(request?.context?.sources)?request.context.sources:[]).map(source=>clean(source?.id,180)).filter(Boolean));
  let changed=false;
  for(let index=0;index<output.modules.length;index++){
    const module=output.modules[index];
    if(!moduleNeedsDepth(module))continue;
    const moduleId=clean(module?.id,180)||`module-${index+1}`;
    const existing=(Array.isArray(module?.lessonBlocks)?module.lessonBlocks:[]).map(block=>({heading:clean(block?.heading,320),content:clean(block?.content,5000),sourceIds:(Array.isArray(block?.sourceIds)?block.sourceIds:[]).map(value=>clean(value,180)).filter(Boolean),provenance:clean(block?.provenance,160)}));
    const expansionPrompt=[
      `EXPAND ONE CURRICULUM MODULE ONLY: ${moduleId}`,
      `Title: ${clean(module?.title,320)}`,
      `Objective: ${clean(module?.objective,1800)}`,
      `Learning objectives: ${clean(JSON.stringify(module?.learningObjectives||[]),3000)}`,
      `Concepts: ${clean(JSON.stringify(module?.concepts||[]),5000)}`,
      `Existing lesson blocks that must be preserved and deepened: ${clean(JSON.stringify(existing),14000)}`,
      'Return 3-5 substantive lesson blocks totaling roughly 600-1000 words when the supplied evidence supports that depth.',
      'Teach the material rather than merely outlining it. Include definitions, mechanisms, worked examples, practical implications, cautions or uncertainty, and transitions between ideas where appropriate.',
      'Use only SOURCE_ID values already present in the source packet above. Do not invent sources, URLs, quotations, studies, dates, or claims.',
      'Preserve all useful ideas from the existing lesson blocks but rewrite them into a coherent, richer lesson. Do not change the rest of the module.'
    ].join('\n');
    let expansionRequest={...request,purpose:'living-school-module-depth-expansion-v262',schema:lessonExpansionSchema(),context:{...(request.context||{}),moduleId,moduleIndex:index,depthExpansion:true},messages:Array.isArray(request.messages)?request.messages.map(message=>({...message})):[]};
    expansionRequest=appendUserMessage(expansionRequest,expansionPrompt);
    const expansion=await original(expansionRequest);
    if(expansion?.status!=='success')continue;
    const blocks=sanitizeExpandedBlocks(expansion.outputJson,knownSourceIds);
    if(blocks.length<3)continue;
    const expandedLength=blocks.reduce((sum,block)=>sum+block.content.length,0);
    if(expandedLength<=lessonTextLength(module))continue;
    output.modules[index]={...module,lessonBlocks:blocks};
    changed=true;
  }
  if(!changed)return result;
  return{...result,outputJson:output,outputText:JSON.stringify(output)};
}

function questionKey(question){return clean(question?.prompt,2400).toLowerCase().replace(/\s+/g,' ')}
function validQuestionRows(output,moduleId){
  const modules=Array.isArray(output?.modules)?output.modules:[];
  const row=modules.find(item=>clean(item?.moduleId,180)===moduleId)||modules[0];
  return Array.isArray(row?.questions)?row.questions.filter(question=>clean(question?.prompt,2400)):[];
}
function missingTypes(originalMissing,collected){
  const have=new Set(collected.map(question=>clean(question?.type,80).toLowerCase()));
  return (Array.isArray(originalMissing)?originalMissing:[]).filter(type=>!have.has(clean(type,80).toLowerCase()));
}
function exactQuizSchema(schema,count){
  const next=deepCopy(schema||{});
  try{
    next.properties.modules.minItems=1;
    next.properties.modules.maxItems=1;
    const questions=next.properties.modules.items.properties.questions;
    questions.minItems=Math.max(1,count);
    questions.maxItems=Math.max(1,count);
  }catch{}
  return next;
}
function modulePrompt(module,needed,types,round){
  return [
    `QUIZ DELTA FOR ONE MODULE ONLY: ${clean(module?.moduleId,180)}`,
    `Return exactly ${needed} genuinely new question${needed===1?'':'s'} for this module in the JSON modules[0].questions array.`,
    types.length?`The new set MUST include these still-missing types: ${types.join(', ')}.`:'Required type coverage is already present; use any allowed type that best tests the module.',
    'Do not return fewer questions than requested.',
    'Do not return another module.',
    'Do not repeat or lightly paraphrase an existing question.',
    'Every question must test the supplied lesson content, concepts, practice, or capability rather than generic learning-process boilerplate.',
    `Completion round: ${round}.`
  ].join('\n');
}

async function completeQuizPerModule(original,request){
  if(request?.purpose!=='living-school-quiz-delta-completion-v258')return original(request);
  const modules=Array.isArray(request?.context?.modules)?request.context.modules:[];
  if(modules.length<=0)return original(request);
  const combined=[];
  let lastSuccess=null,lastFailure=null;
  for(const module of modules){
    const moduleId=clean(module?.moduleId,180),target=Math.max(1,Number(module?.minimumAdditionalQuestions||0),Array.isArray(module?.missingTypes)?module.missingTypes.length:0);
    const collected=[],seen=new Set((Array.isArray(module?.existingQuestions)?module.existingQuestions:[]).map(questionKey).filter(Boolean));
    const maxRounds=Math.min(8,Math.max(4,target+3));
    let forceSingle=false;
    for(let round=1;round<=maxRounds;round++){
      const outstanding=missingTypes(module?.missingTypes,collected),remaining=Math.max(0,target-collected.length);
      if(remaining===0&&!outstanding.length)break;
      const requestedTypes=forceSingle&&outstanding.length?[outstanding[0]]:outstanding;
      const needed=forceSingle?1:Math.max(1,remaining,requestedTypes.length);
      const oneModule={...module,minimumAdditionalQuestions:needed,missingTypes:requestedTypes};
      let perRequest={...request,context:{...(request.context||{}),modules:[oneModule],quizDeltaMode:forceSingle?'single-question-recovery':'single-module-iterative',quizDeltaRound:round},schema:exactQuizSchema(request.schema,needed)};
      perRequest=appendUserMessage(perRequest,modulePrompt(oneModule,needed,requestedTypes,round));
      const result=await original(perRequest);
      if(result?.status!=='success'){
        lastFailure=result;
        forceSingle=true;
        continue;
      }
      lastSuccess=result;
      let added=0;
      for(const question of validQuestionRows(result.outputJson,moduleId)){
        const key=questionKey(question);
        if(!key||seen.has(key))continue;
        seen.add(key);collected.push(question);added+=1;
      }
      if(added<needed)forceSingle=true;
    }
    combined.push({moduleId,questions:collected});
  }
  if(!lastSuccess)return lastFailure||original(request);
  return{...lastSuccess,status:'success',outputJson:{modules:combined},outputText:JSON.stringify({modules:combined})};
}

export async function installLivingSchoolGenerationGuard(){
  if(globalThis.CivweaveLivingSchoolGenerationGuardV262?.installed)return globalThis.CivweaveLivingSchoolGenerationGuardV262;
  await globalThis.CivweaveFamilyAILoaderV105?.ensure?.();
  const runtime=globalThis.CivweaveModelRuntime;
  if(!runtime?.generate)throw new Error('The shared model runtime is unavailable for the Living School generation guard.');
  if(runtime.livingSchoolGenerationGuardRevision===REVISION)return runtime;
  const originalGenerate=runtime.generate.bind(runtime);
  const generate=async request=>{
    let next=strengthenLiveResearch(request);
    next=injectLocalSynthesisSources(next);
    next=injectCurriculumSources(next);
    const safe=safeMode.read();
    if(safe.enabled&&next?.purpose==='living-school-research-grounded-curriculum-v218.1'){
      const sources=Array.isArray(next?.context?.sources)?next.context.sources:[];
      if(!sources.length)throw safeModeError('curriculum generation',{ai:{categories:['no-validated-sources']}});
      const reviewed=await validateAdmissions(originalGenerate,sources,{kind:'curriculum-source'});
      const rejected=reviewed.find(row=>!row.review.admitted);
      if(rejected)throw safeModeError(`source “${clean(rejected.item?.title,180)||'Untitled'}”`,rejected.review);
      next={...next,context:{...(next.context||{}),safeSourceAdmissions:reviewed.map(row=>({id:row.item?.id,review:row.review}))}};
    }
    if(next?.purpose==='living-school-quiz-delta-completion-v258')return completeQuizPerModule(originalGenerate,next);
    if(next?.purpose==='living-school-research-grounded-curriculum-v218.1')return expandThinCurriculumModules(originalGenerate,next,await originalGenerate(next));
    const result=await originalGenerate(next);
    if(safe.enabled&&next?.purpose==='living-school-live-source-research-v260'&&result?.status==='success'){
      const sources=Array.isArray(result?.outputJson?.sources)?result.outputJson.sources:[];
      const reviewed=await validateAdmissions(originalGenerate,sources,{kind:'researched-source'});
      const admitted=reviewed.filter(row=>row.review.admitted).map(row=>({...row.item,safeAdmission:row.review}));
      if(!admitted.length)throw safeModeError('the researched source set',reviewed.find(row=>!row.review.admitted)?.review||{ai:{categories:['no-admitted-sources']}});
      const output={...result.outputJson,sources:admitted,safeAdmission:{revision:safeMode.revision,reviewed:reviewed.length,admitted:admitted.length,rejected:reviewed.length-admitted.length}};
      return{...result,outputJson:output,outputText:JSON.stringify(output)};
    }
    return result;
  };
  const wrapped=Object.freeze({...runtime,generate,generateInteractive:request=>generate({...request,executionProfile:'interactive'}),generateAgentic:request=>generate({...request,executionProfile:'agentic'}),livingSchoolGenerationGuardRevision:REVISION});
  globalThis.CivweaveModelRuntime=wrapped;
  const api=Object.freeze({installed:true,revision:REVISION,sourceMaterialPromptInjection:true,localPassagePromptInjection:true,liveEvidenceDigest:true,moduleDepthRepair:true,quizDeltaMode:'single-module-iterative-with-single-question-recovery'});
  globalThis.CivweaveLivingSchoolGenerationGuardV262=api;
  try{dispatchEvent(new CustomEvent('civweave:living-school-generation-guard-ready',{detail:api}))}catch{}
  return api;
}
