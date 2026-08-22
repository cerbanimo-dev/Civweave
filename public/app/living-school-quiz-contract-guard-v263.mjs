const REVISION='living-school-quiz-contract-guard-v264-pedagogy';
const QUIZ_PURPOSE='living-school-quiz-delta-completion-v258';
const REPAIR_PURPOSE='living-school-quiz-question-contract-repair-v263';
const REQUIRED_TYPES=['multiple-choice','multi-select','short-answer'];
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const STOP_WORDS=new Set(['about','after','again','against','also','another','before','being','between','could','each','from','have','into','module','should','their','there','these','they','this','those','through','using','what','when','where','which','while','with','would','your','learner','learning','practice','exercise','artifact','objective','capability']);
const ALWAYS_META=[/best demonstrates completion/i,/demonstrates completion of (?:the|this) module/i,/skip (?:the )?practice/i,/confidence alone/i,/invent(?:ed)? (?:a )?citation/i,/ignore (?:the )?module objective/i,/unrelated artifact/i,/assessment intent/i,/connect this point to the module objective/i];
const PROCESS_META=[/reviewable learning evidence/i,/reviewable evidence/i,/generated-unverified/i,/source-backed versus generated/i,/replace supplied evidence/i];

function promptKey(question){return clean(question?.prompt,2400).toLowerCase().replace(/\s+/g,' ')}
function typeOf(question){return clean(question?.type,80).toLowerCase()}
function words(value){return new Set(clean(value,24000).toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(word=>word.length>=4&&!STOP_WORDS.has(word)))}
function researchSubject(module){return /research|source|evidence|provenance|verification|fact.?check|citation/i.test([module?.title,module?.objective,...(Array.isArray(module?.learningObjectives)?module.learningObjectives:[]),...(Array.isArray(module?.concepts)?module.concepts.map(row=>row?.term):[])].filter(Boolean).join(' '))}
function metaText(value,module){const text=clean(value,12000);if(ALWAYS_META.some(pattern=>pattern.test(text)))return true;return !researchSubject(module)&&PROCESS_META.some(pattern=>pattern.test(text))}
function subjectAnchors(module){return words([module?.title,module?.objective,...(Array.isArray(module?.learningObjectives)?module.learningObjectives:[]),...(Array.isArray(module?.concepts)?module.concepts.map(row=>row?.term):[])].filter(Boolean).join(' '))}
function questionText(question){return[question?.prompt,...(Array.isArray(question?.options)?question.options:[]),question?.explanation,...(Array.isArray(question?.concepts)?question.concepts:[])].filter(Boolean).join(' ')}
function subjectGrounded(question,module){const anchors=subjectAnchors(module);if(!anchors.size)return true;const tokens=words(questionText(question));for(const anchor of anchors)if(tokens.has(anchor))return true;return false}
function rubricRows(question){
  return (Array.isArray(question?.rubric)?question.rubric:[]).map((row,index)=>({
    id:clean(row?.id,80)||`criterion-${index+1}`,
    label:clean(row?.label,320),
    points:Number(row?.points),
    role:clean(row?.role,80)||'evidence',
    required:row?.required!==false
  })).filter(row=>row.label&&Number.isFinite(row.points)&&row.points>0);
}
function validQuestion(question,module){
  const type=typeOf(question),prompt=clean(question?.prompt,2400);
  if(!REQUIRED_TYPES.includes(type)||!prompt||metaText(questionText(question),module)||!subjectGrounded(question,module))return false;
  const options=(Array.isArray(question?.options)?question.options:[]).map(value=>clean(value,400)).filter(Boolean);
  if(type==='multiple-choice'){
    const answer=clean(question?.answer,1200);
    return options.length>=2&&Boolean(answer)&&options.includes(answer);
  }
  if(type==='multi-select'){
    const answers=Array.isArray(question?.answer)?question.answer.map(value=>clean(value,400)).filter(Boolean):[];
    return options.length>=2&&answers.length>0&&answers.every(answer=>options.includes(answer));
  }
  if(type==='short-answer')return rubricRows(question).length>=2;
  return false;
}
function validRows(output,module){
  const moduleId=clean(module?.moduleId,180),rows=Array.isArray(output?.modules)?output.modules:[];
  const row=rows.find(item=>clean(item?.moduleId,180)===moduleId)||rows[0];
  return (Array.isArray(row?.questions)?row.questions:[]).filter(question=>validQuestion(question,module));
}
function missingTypes(module,questions){
  const have=new Set(questions.map(typeOf));
  return (Array.isArray(module?.missingTypes)?module.missingTypes:[]).map(value=>clean(value,80).toLowerCase()).filter(type=>REQUIRED_TYPES.includes(type)&&!have.has(type));
}
function targetCount(module){return Math.max(1,Number(module?.minimumAdditionalQuestions||0),Array.isArray(module?.missingTypes)?module.missingTypes.length:0)}

function criterionSchema(){return{type:'object',required:['id','label','points','role','required'],properties:{id:{type:'string'},label:{type:'string'},points:{type:'number'},role:{type:'string'},required:{type:'boolean'}}}}
function questionSchema(type){
  const common={id:{type:'string'},type:{type:'string',enum:[type]},prompt:{type:'string'},explanation:{type:'string'},concepts:{type:'array',items:{type:'string'}}};
  if(type==='short-answer')return{type:'object',required:['type','prompt','rubric','minWords','maxWords'],properties:{...common,rubric:{type:'array',minItems:2,maxItems:5,items:criterionSchema()},minWords:{type:'number'},maxWords:{type:'number'}}};
  if(type==='multi-select')return{type:'object',required:['type','prompt','options','answer','explanation'],properties:{...common,options:{type:'array',minItems:2,maxItems:8,items:{type:'string'}},answer:{type:'array',minItems:1,maxItems:8,items:{type:'string'}}}};
  return{type:'object',required:['type','prompt','options','answer','explanation'],properties:{...common,options:{type:'array',minItems:2,maxItems:8,items:{type:'string'}},answer:{type:'string'}}};
}
function repairSchema(moduleId,type){return{
  type:'object',required:['modules'],properties:{modules:{type:'array',minItems:1,maxItems:1,items:{type:'object',required:['moduleId','questions'],properties:{moduleId:{type:'string',enum:[moduleId]},questions:{type:'array',minItems:1,maxItems:1,items:questionSchema(type)}}}}}
}}
function compactModule(module){return{
  moduleId:clean(module?.moduleId,180),title:clean(module?.title,320),objective:clean(module?.objective,1800),
  learningObjectives:(Array.isArray(module?.learningObjectives)?module.learningObjectives:[]).map(value=>clean(value,700)).filter(Boolean).slice(0,10),
  concepts:(Array.isArray(module?.concepts)?module.concepts:[]).map(row=>({term:clean(row?.term,180),definition:clean(row?.definition,1000)})).filter(row=>row.term).slice(0,10),
  lessonBlocks:(Array.isArray(module?.lessonBlocks)?module.lessonBlocks:[]).map(block=>({heading:clean(block?.heading,320),content:clean(block?.content,2600),sourceIds:(Array.isArray(block?.sourceIds)?block.sourceIds:[]).map(value=>clean(value,180)).filter(Boolean).slice(0,8),provenance:clean(block?.provenance,160)})).slice(0,8),
  existingQuestions:(Array.isArray(module?.existingQuestions)?module.existingQuestions:[]).map(question=>({type:typeOf(question),prompt:clean(question?.prompt,1600),options:(Array.isArray(question?.options)?question.options:[]).map(value=>clean(value,300)).filter(Boolean).slice(0,8)})).slice(0,12)
}}
function repairPrompt(module,type,attempt){
  const contract=type==='short-answer'
    ? 'Return one short-answer question. It MUST include rubric with 2-5 criterion objects. Every criterion MUST include id, label, points, role, and required. Score subject accuracy, explanation, comparison, reasoning, or application—not generic evidence compliance.'
    : type==='multi-select'
      ? 'Return one multi-select question with at least two plausible subject-matter options and a non-empty answer array containing the correct option labels exactly as written.'
      : 'Return one multiple-choice question with at least two plausible subject-matter options and one non-empty answer string exactly matching the correct option label.';
  return[
    `Repair exactly one missing ${type} question for Living School module ${clean(module?.moduleId,180)}.`,
    contract,
    'Test a fact, concept, relationship, mechanism, distinction, or applied judgment actually taught in MODULE MATERIAL.',
    'Make the prompt self-contained and name or clearly invoke the actual subject or one of its concepts.',
    'For distractors, use plausible domain misconceptions—not silly choices that merely violate the learning workflow.',
    'Never ask which action demonstrates completion. Never use skipping practice, confidence alone, invented citations, ignoring the objective, unrelated artifacts, or reviewable-evidence compliance as distractors.',
    'Do not repeat or lightly paraphrase any existing question.',
    'Return exactly one module and exactly one question in the required JSON shape.',
    `Attempt ${attempt}.`,
    `MODULE MATERIAL:\n${clean(JSON.stringify(compactModule(module)),26000)}`
  ].join('\n\n');
}
async function repairOne(baseGenerate,request,module,type,attempt){
  const config={...(request?.config||{}),maxTokens:Math.max(Number(request?.config?.maxTokens)||0,4096),temperature:Math.min(Number(request?.config?.temperature)||0.2,0.2)};
  const result=await baseGenerate({
    ...request,
    purpose:REPAIR_PURPOSE,
    executionProfile:'interactive',
    config,
    schema:repairSchema(clean(module?.moduleId,180),type),
    maxRepairAttempts:2,
    context:{capability:request?.context?.capability,level:request?.context?.level,proofContract:request?.context?.proofContract,quizContractRepair:true,module:compactModule(module),requiredType:type,requirements:['Return exactly one valid question.','Obey the type-specific schema exactly.','Test subject mastery, not module-completion behavior.','Do not invent curriculum content outside the supplied module.']},
    messages:[
      {role:'system',content:'You are Moss repairing one malformed, generic, or missing Living School quiz question. Return strict JSON only. The schema and subject-mastery contract are hard persistence requirements.'},
      {role:'user',content:repairPrompt(module,type,attempt)}
    ]
  });
  if(result?.status!=='success')return null;
  const question=validRows(result.outputJson,module)[0];
  return question&&typeOf(question)===type?question:null;
}

async function enforceQuizContract(baseGenerate,request,initial){
  if(initial?.status!=='success')return initial;
  const modules=Array.isArray(request?.context?.modules)?request.context.modules:[];
  if(!modules.length)return initial;
  const initialRows=Array.isArray(initial?.outputJson?.modules)?initial.outputJson.modules:[];
  const combined=[];
  let latest=initial,repairCalls=0,rejectedGeneric=0;
  for(const module of modules){
    const moduleId=clean(module?.moduleId,180),target=targetCount(module);
    const row=initialRows.find(item=>clean(item?.moduleId,180)===moduleId)||initialRows[0];
    const seen=new Set((Array.isArray(module?.existingQuestions)?module.existingQuestions:[]).map(promptKey).filter(Boolean));
    const questions=[];
    for(const question of (Array.isArray(row?.questions)?row.questions:[])){
      if(!validQuestion(question,module)){rejectedGeneric+=1;continue}
      const key=promptKey(question);if(!key||seen.has(key))continue;
      seen.add(key);questions.push(question);
    }
    let attempts=0;
    while((questions.length<target||missingTypes(module,questions).length)&&attempts<12){
      attempts+=1;
      const missing=missingTypes(module,questions);
      const type=missing[0]||REQUIRED_TYPES[(questions.length+attempts-1)%REQUIRED_TYPES.length];
      const repaired=await repairOne(baseGenerate,request,module,type,attempts);
      repairCalls+=1;
      if(!repaired)continue;
      const key=promptKey(repaired);if(!key||seen.has(key))continue;
      seen.add(key);questions.push(repaired);
    }
    combined.push({moduleId,questions:questions.slice(0,Math.max(target,questions.length))});
  }
  return{...latest,status:'success',outputJson:{modules:combined},outputText:JSON.stringify({modules:combined}),livingSchoolQuizContract:{revision:REVISION,repairCalls,rejectedGeneric,validatesBeforeCounting:true,subjectMasteryRequired:true}};
}

export async function installLivingSchoolQuizContractGuardV263(){
  if(globalThis.CivweaveLivingSchoolQuizContractGuardV263?.installed&&globalThis.CivweaveLivingSchoolQuizContractGuardV263?.revision===REVISION)return globalThis.CivweaveLivingSchoolQuizContractGuardV263;
  const runtime=globalThis.CivweaveModelRuntime;
  if(!runtime?.generate)throw new Error('The shared model runtime is unavailable for the Living School quiz contract guard.');
  if(runtime.livingSchoolQuizContractGuardRevision===REVISION)return runtime;
  const baseGenerate=runtime.generate.bind(runtime);
  const generate=async request=>request?.purpose===QUIZ_PURPOSE?enforceQuizContract(baseGenerate,request,await baseGenerate(request)):baseGenerate(request);
  const wrapped=Object.freeze({...runtime,generate,generateInteractive:request=>generate({...request,executionProfile:'interactive'}),generateAgentic:request=>generate({...request,executionProfile:'agentic'}),livingSchoolQuizContractGuardRevision:REVISION});
  globalThis.CivweaveModelRuntime=wrapped;
  const api=Object.freeze({installed:true,revision:REVISION,validatesBeforeCounting:true,shortAnswerRubricRequired:true,typeSpecificRecoverySchema:true,subjectMasteryRequired:true,genericAssessmentRejected:true,plausibleDistractorsRequired:true});
  globalThis.CivweaveLivingSchoolQuizContractGuardV263=api;
  try{dispatchEvent(new CustomEvent('civweave:living-school-quiz-contract-ready',{detail:api}))}catch{}
  return api;
}
