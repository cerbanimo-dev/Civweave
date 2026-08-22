import safeMode,{validateAdmissions,safeModeError}from'./safe-mode-v1.mjs?v=safe-mode-v1';

const REVISION='living-school-generation-guard-v264-pedagogy';
const MAX_PACKET_CHARS=52000;
const CURRICULUM_PURPOSE='living-school-research-grounded-curriculum-v218.1';
const STRUCTURE_PURPOSE='living-school-structure-single-v221';
const QUIZ_PURPOSE='living-school-quiz-delta-completion-v258';
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const deepCopy=value=>{try{return structuredClone(value)}catch{return JSON.parse(JSON.stringify(value))}};
const STOP_WORDS=new Set(['about','after','again','against','also','another','before','being','between','could','each','from','have','into','module','should','their','there','these','they','this','those','through','using','what','when','where','which','while','with','would','your','learner','learning','practice','exercise','artifact','objective','capability']);
const META_PATTERNS=[
  /best demonstrates completion/i,
  /demonstrates completion of (?:the|this) module/i,
  /skip (?:the )?practice/i,
  /confidence alone/i,
  /invent(?:ed)? (?:a )?citation/i,
  /ignore (?:the )?module objective/i,
  /unrelated artifact/i,
  /reviewable learning evidence/i,
  /replace supplied evidence/i,
  /assessment intent/i,
  /generated-unverified/i,
  /source-backed versus generated/i,
  /connect this point to the module objective/i,
  /one project decision it changes, one piece of evidence to inspect/i
];

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
  if(request?.purpose!==CURRICULUM_PURPOSE)return request;
  const sources=request?.context?.sources||[];
  const research=request?.context?.research||{};
  const packet=sourcePacket(sources,'CURRICULUM SOURCE MATERIAL');
  const synthesis=research?.synthesis?`\nLOCAL SYNTHESIS NOTES:\n${clean(JSON.stringify(research.synthesis),12000)}`:'';
  const instruction=[
    packet,
    synthesis,
    'CURRICULUM WRITING CONTRACT — SUBJECT MASTERY FIRST:',
    'The source material above is already in this prompt. Do not expect another tool or hidden context to supply it.',
    'Build the actual teaching from those passages. Use their SOURCE_ID values in lessonBlocks.sourceIds whenever a paragraph or explanation relies on them.',
    'Write for a learner who wants to understand and do the subject, not for a system that wants to verify workflow compliance.',
    'Each module must answer a distinct subject-matter question and add new knowledge or skill. Across modules, avoid recycling the same objective, exercise pattern, explanation frame, or assessment frame.',
    'Do not merely summarize the source list. Explain definitions, mechanisms, distinctions, causes, tradeoffs, worked examples, failure modes, practical implications, and uncertainty when the evidence supports them.',
    'For source-backed research modes, each module should normally contain at least 3 substantive lesson blocks and enough instructional prose to teach rather than outline the topic. Target roughly 600-1000 words of useful instruction per module when the supplied evidence supports it.',
    'Concept definitions are a compact glossary. Lesson blocks must deepen or apply those concepts rather than repeat the definition verbatim.',
    'Never append a generic “learning application” sentence to each concept or paragraph. Do not repeat boilerplate about identifying a decision, inspecting evidence, recording uncertainty, revising an artifact, or proving completion unless that is actually the subject being taught.',
    'When the upstream request asks for “assessment intent,” interpret it as the concrete subject knowledge or judgment to test. Do not emit the phrase “assessment intent” in learner-facing content.',
    'Practice must resemble a real decision, diagnosis, construction, comparison, calculation, explanation, or other authentic use of the subject. Give the learner enough scenario detail to act; do not make the task merely “review the lesson,” “record evidence,” or “state uncertainty.”',
    'Quiz questions must test facts, concepts, relationships, mechanisms, distinctions, or applied judgment taught in the module. Every question must be answerable from specific lesson content.',
    'Multiple-choice distractors must be plausible subject-matter misconceptions. Never use absurd compliance distractors such as skipping practice, relying on confidence, inventing citations, ignoring the objective, or making an unrelated artifact.',
    'Do not ask what action “best demonstrates completion,” what counts as “reviewable evidence,” or how to comply with the learning workflow unless the curriculum subject itself is learning science, research methods, evidence evaluation, or provenance.',
    'Relevance, objectives, completion criteria, rubrics, remediation, and Cerbanimo practice should name the actual subject skill. Avoid generic phrases such as “this module advances the capability,” “observable project decision,” or “reviewable evidence.”',
    'For model-derived/unverified research, remain explicit about uncertainty and do not upgrade those notes into verified facts. Keep provenance in metadata rather than repeatedly teaching the learner about Civweave provenance labels.',
    'Keep source URLs and IDs unchanged. Never invent a citation.'
  ].filter(Boolean).join('\n\n');
  const next=appendUserMessage(request,instruction);
  next.context={...(next.context||{}),sourceMaterialInjected:true,sourceMaterialRevision:REVISION,pedagogyContract:'subject-mastery-v1'};
  return next;
}

function injectStructurePedagogy(request){
  if(request?.purpose!==STRUCTURE_PURPOSE)return request;
  const instruction=[
    'SUBJECT-MASTERY CONSTRUCTION CONTRACT:',
    'You are formatting researched teaching into the application schema, not generating generic learning scaffolding.',
    'Preserve the design packet’s subject substance. Rewrite only as needed for clarity, schema fit, and removal of duplicated or meta instructional-design language.',
    'Do not surface internal phrases such as “assessment intent,” “grounded design packet,” “observable project decision,” “reviewable evidence,” “generated-unverified guidance,” or “learning application.” Provenance belongs in provenance/sourceIds fields.',
    'Concept definitions must be concise. Lesson blocks must elaborate, contrast, demonstrate, or apply them; do not copy a concept definition verbatim into a lesson block.',
    'Give each lesson block a distinct instructional job. Do not repeat headings, sentences, examples, or the same generic application suffix across blocks.',
    'Practice steps must be concrete subject actions and should reference the actual concepts, materials, conditions, or decisions in the module.',
    'Every quiz question must be self-contained, specific to this module, and anchored to its concepts or lesson content.',
    'Use plausible domain distractors. Never use “skip the practice,” “rely on confidence,” “invent a citation,” “ignore the objective,” or “produce an unrelated artifact” as distractors.',
    'Do not ask which action demonstrates module completion. Assess understanding of the subject itself.',
    'Short-answer prompts must require explanation or application of module concepts; rubrics should score subject accuracy and reasoning, not generic evidence compliance.',
    'Remediation must point to the misunderstood subject concept or relationship, not merely tell the learner to review the module or rebuild an artifact.',
    'If the design packet does not support a factual claim, omit the claim or keep it clearly uncertain rather than filling space with generic prose.'
  ].join('\n');
  const next=appendUserMessage(request,instruction);
  next.context={...(next.context||{}),pedagogyContract:'subject-mastery-v1',pedagogyRevision:REVISION};
  return next;
}

function words(value){
  return new Set(clean(value,24000).toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(word=>word.length>=4&&!STOP_WORDS.has(word)));
}
function overlap(left,right){
  const a=words(left),b=words(right);if(!a.size||!b.size)return 0;
  let common=0;for(const token of a)if(b.has(token))common+=1;
  return common/Math.min(a.size,b.size);
}
function metaText(value){const text=clean(value,12000);return META_PATTERNS.some(pattern=>pattern.test(text));}
function subjectAnchors(module){
  const values=[module?.title,module?.objective,...(Array.isArray(module?.learningObjectives)?module.learningObjectives:[])];
  for(const concept of Array.isArray(module?.concepts)?module.concepts:[])values.push(concept?.term);
  return words(values.filter(Boolean).join(' '));
}
function subjectGrounded(value,module){
  const anchors=subjectAnchors(module);if(!anchors.size)return true;
  const tokens=words(value);for(const anchor of anchors)if(tokens.has(anchor))return true;
  return false;
}
function questionText(question){return[question?.prompt,...(Array.isArray(question?.options)?question.options:[]),question?.explanation,...(Array.isArray(question?.concepts)?question.concepts:[])].filter(Boolean).join(' ')}
function usefulQuestion(question,module){
  const prompt=clean(question?.prompt,2400);if(!prompt||metaText(prompt)||metaText(questionText(question)))return false;
  return subjectGrounded(questionText(question),module);
}
function structureModule(result){
  const output=result?.outputJson;if(!output||typeof output!=='object'||Array.isArray(output))return null;
  return output.module&&typeof output.module==='object'&&!Array.isArray(output.module)?output.module:output;
}
function structureQualityIssues(result){
  if(result?.status!=='success')return[];
  const module=structureModule(result);if(!module)return['no structured module object was available for pedagogical review'];
  const issues=[];
  if(metaText(module?.relevance))issues.push('relevance contains learning-process boilerplate');
  const objectives=Array.isArray(module?.learningObjectives)?module.learningObjectives:[];
  if(objectives.some(metaText))issues.push('learning objectives contain provenance or assessment-process boilerplate');
  const criteria=Array.isArray(module?.completionCriteria)?module.completionCriteria:[];
  if(criteria.some(metaText))issues.push('completion criteria contain internal learning-process language');
  const concepts=Array.isArray(module?.concepts)?module.concepts:[];
  const blocks=Array.isArray(module?.lessonBlocks)?module.lessonBlocks:[];
  const headingKeys=new Set();
  for(const block of blocks){
    const heading=clean(block?.heading,320).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    if(heading&&headingKeys.has(heading))issues.push(`lesson heading “${clean(block?.heading,120)}” is repeated`);
    headingKeys.add(heading);
    if(metaText(block?.content))issues.push(`lesson block “${clean(block?.heading,120)||'untitled'}” contains templated learning-process prose`);
    for(const concept of concepts){
      const definition=clean(concept?.definition,1600),content=clean(block?.content,10000);
      if(definition.length>=80&&content.toLowerCase().includes(definition.toLowerCase())){issues.push(`lesson block “${clean(block?.heading,120)||'untitled'}” repeats a concept definition verbatim`);break}
    }
  }
  for(let i=0;i<blocks.length;i++)for(let j=i+1;j<blocks.length;j++)if(overlap(blocks[i]?.content,blocks[j]?.content)>=0.78)issues.push(`lesson blocks ${i+1} and ${j+1} are substantially repetitive`);
  const practice=module?.practice&&typeof module.practice==='object'?module.practice:{};
  if(metaText(practice?.prompt))issues.push('practice prompt is about learning-process compliance rather than the subject');
  const steps=Array.isArray(practice?.steps)?practice.steps:[];
  if(steps.length>=3&&steps.filter(step=>subjectGrounded(step,module)).length<2)issues.push('practice steps are not sufficiently anchored to the subject');
  const bank=Array.isArray(module?.quiz?.bank)?module.quiz.bank:[];
  const seen=new Set();
  for(const [index,question] of bank.entries()){
    const key=clean(question?.prompt,2400).toLowerCase().replace(/\s+/g,' ');
    if(key&&seen.has(key))issues.push(`quiz question ${index+1} repeats another prompt`);
    seen.add(key);
    if(!usefulQuestion(question,module))issues.push(`quiz question ${index+1} is meta, generic, or not anchored to module content`);
  }
  return [...new Set(issues)].slice(0,16);
}
function qualityRepairPrompt(issues){
  return[
    'PEDAGOGICAL QUALITY REPAIR REQUIRED:',
    ...issues.map(issue=>`- ${issue}`),
    'Reconstruct the same requested module from the supplied design packet and source material.',
    'Keep the schema exactly unchanged. Do not add new research or new citations.',
    'Replace generic learning-workflow language with subject-specific teaching, practice, and assessment.',
    'Remove repetition instead of paraphrasing the same sentence several times.',
    'All quiz questions must test actual module knowledge or applied judgment with plausible domain distractors.'
  ].join('\n');
}
async function enforceStructureQuality(original,request){
  const first=await original(request);if(first?.status!=='success')return first;
  let issues=structureQualityIssues(first);if(!issues.length)return first;
  let repair=appendUserMessage(request,qualityRepairPrompt(issues));
  repair={...repair,context:{...(repair.context||{}),pedagogyRepair:true,pedagogyRepairIssues:issues,pedagogyRevision:REVISION}};
  const second=await original(repair);issues=structureQualityIssues(second);
  if(second?.status==='success'&&!issues.length)return{...second,livingSchoolPedagogy:{revision:REVISION,repaired:true}};
  return{...second,status:'error',outputJson:null,outputText:'',error:{message:`Living School rejected a structurally valid but pedagogically weak module: ${issues.join('; ')||'the repaired output still failed the subject-mastery contract'}.`},livingSchoolPedagogy:{revision:REVISION,rejected:true,issues}};
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
      'Make each block do a distinct job and do not copy concept definitions verbatim into the prose.',
      'Do not append generic learning-application, evidence, uncertainty, or revision boilerplate.',
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
function validQuestionRows(output,module){
  const moduleId=clean(module?.moduleId,180),modules=Array.isArray(output?.modules)?output.modules:[];
  const row=modules.find(item=>clean(item?.moduleId,180)===moduleId)||modules[0];
  return Array.isArray(row?.questions)?row.questions.filter(question=>usefulQuestion(question,module)):[];
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
    'Every question must test a fact, concept, relationship, mechanism, distinction, or applied judgment actually taught in the supplied module.',
    'Make the prompt self-contained and explicitly anchored to the module subject or one of its named concepts.',
    'For selected-response questions, use plausible subject-matter misconceptions as distractors.',
    'Never use skipping practice, confidence alone, invented citations, ignoring objectives, unrelated artifacts, reviewable evidence, or module-completion compliance as distractors or answers.',
    `Completion round: ${round}.`
  ].join('\n');
}

async function completeQuizPerModule(original,request){
  if(request?.purpose!==QUIZ_PURPOSE)return original(request);
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
      let perRequest={...request,context:{...(request.context||{}),modules:[oneModule],quizDeltaMode:forceSingle?'single-question-recovery':'single-module-iterative',quizDeltaRound:round,pedagogyContract:'subject-mastery-v1'},schema:exactQuizSchema(request.schema,needed)};
      perRequest=appendUserMessage(perRequest,modulePrompt(oneModule,needed,requestedTypes,round));
      const result=await original(perRequest);
      if(result?.status!=='success'){
        lastFailure=result;
        forceSingle=true;
        continue;
      }
      lastSuccess=result;
      let added=0;
      for(const question of validQuestionRows(result.outputJson,oneModule)){
        const key=questionKey(question);
        if(!key||seen.has(key))continue;
        seen.add(key);collected.push(question);added+=1;
      }
      if(added<needed)forceSingle=true;
    }
    combined.push({moduleId,questions:collected});
  }
  if(!lastSuccess)return lastFailure||original(request);
  return{...lastSuccess,status:'success',outputJson:{modules:combined},outputText:JSON.stringify({modules:combined}),livingSchoolPedagogy:{revision:REVISION,subjectQuizFilter:true}};
}

export async function installLivingSchoolGenerationGuard(){
  if(globalThis.CivweaveLivingSchoolGenerationGuardV262?.installed&&globalThis.CivweaveLivingSchoolGenerationGuardV262?.revision===REVISION)return globalThis.CivweaveLivingSchoolGenerationGuardV262;
  await globalThis.CivweaveFamilyAILoaderV105?.ensure?.();
  const runtime=globalThis.CivweaveModelRuntime;
  if(!runtime?.generate)throw new Error('The shared model runtime is unavailable for the Living School generation guard.');
  if(runtime.livingSchoolGenerationGuardRevision===REVISION)return runtime;
  const originalGenerate=runtime.generate.bind(runtime);
  const generate=async request=>{
    let next=strengthenLiveResearch(request);
    next=injectLocalSynthesisSources(next);
    next=injectCurriculumSources(next);
    next=injectStructurePedagogy(next);
    const safe=safeMode.read();
    if(safe.enabled&&next?.purpose===CURRICULUM_PURPOSE){
      const sources=Array.isArray(next?.context?.sources)?next.context.sources:[];
      if(!sources.length)throw safeModeError('curriculum generation',{ai:{categories:['no-validated-sources']}});
      const reviewed=await validateAdmissions(originalGenerate,sources,{kind:'curriculum-source'});
      const rejected=reviewed.find(row=>!row.review.admitted);
      if(rejected)throw safeModeError(`source “${clean(rejected.item?.title,180)||'Untitled'}”`,rejected.review);
      next={...next,context:{...(next.context||{}),safeSourceAdmissions:reviewed.map(row=>({id:row.item?.id,review:row.review}))}};
    }
    if(next?.purpose===QUIZ_PURPOSE)return completeQuizPerModule(originalGenerate,next);
    if(next?.purpose===STRUCTURE_PURPOSE)return enforceStructureQuality(originalGenerate,next);
    if(next?.purpose===CURRICULUM_PURPOSE)return expandThinCurriculumModules(originalGenerate,next,await originalGenerate(next));
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
  const api=Object.freeze({installed:true,revision:REVISION,sourceMaterialPromptInjection:true,localPassagePromptInjection:true,liveEvidenceDigest:true,moduleDepthRepair:true,subjectMasteryPrompt:true,structurePedagogyRepair:true,repetitionGate:true,metaAssessmentGate:true,quizDeltaMode:'single-module-iterative-with-single-question-recovery'});
  globalThis.CivweaveLivingSchoolGenerationGuardV262=api;
  try{dispatchEvent(new CustomEvent('civweave:living-school-generation-guard-ready',{detail:api}))}catch{}
  return api;
}
