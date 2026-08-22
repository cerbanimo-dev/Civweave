(()=>{
'use strict';
const VERSION='1.1.0-living-school-assessment-curator-v338';
const ID='living-school-assessment-curator-v337';
const PURPOSE='living-school-structure-single-v221';
const COMPILER='grounded-design-compiler-v338+assessment-curator-v338';
const SCAFFOLD_PROVENANCE='deterministic-compiler';
const clean=(value,max=64000)=>String(value??'').trim().slice(0,max);
const strip=value=>clean(value,8000).replace(/\*\*/g,'').replace(/__+/g,'').replace(/`+/g,'').replace(/\s+/g,' ').trim();
const sentence=value=>{const text=strip(value),match=text.match(/^(.+?[.!?])(?:\s|$)/);return clean(match?.[1]||text,700)};
const cap=value=>{const text=strip(value);return text?text[0].toUpperCase()+text.slice(1):text};
const ACTION=/^(?:identify|compare|contrast|distinguish|choose|select|diagnose|calculate|plan|design|explain|apply|classify|categorize|describe|map|draft|create|develop|prioritize|recommend|decide|match|outline|name|define|evaluate|translate|synthesize|integrate|analyze|analyse|interpret|construct|formulate|propose|justify|organize|organise|adapt)\b/i;
const META=/\b(?:learner(?:'s|’s)?\s+(?:ability|understanding|knowledge)|this\s+module|the\s+module|lesson\s+blocks?|module\s+objective|learning\s+objective|assessment\s+intent|curriculum|rubric|source\s+packet|what\s+was\s+taught|as\s+taught\s+in)\b/i;
function directAssessment(raw,objective,title){
  let text=strip(raw)
    .replace(/^(?:evaluate|assess|verify|test|determine|measure)\s+(?:whether\s+)?(?:the\s+)?learner(?:'s|’s)?\s+(?:ability|understanding|knowledge)\s+(?:to|of)\s+/i,'')
    .replace(/^(?:evaluate|assess|verify|test|determine|measure)\s+(?:whether\s+)?(?:the\s+)?learner\s+(?:can|understands?|knows?)\s+/i,'')
    .replace(/^(?:evaluate|assess|verify|test|determine|measure)\s+(?:the\s+)?learner(?:'s|’s)?\s+/i,'')
    .replace(/^ability\s+to\s+/i,'');
  if(!text||META.test(text))text=strip(objective);
  text=text.replace(/^understand\s+/i,'Explain ').replace(/^demonstrate\s+(?:an\s+)?understanding\s+of\s+/i,'Explain ');
  if(!ACTION.test(text))text=`Explain ${text||title}`;
  text=cap(text).replace(/[.!?]+$/,'');
  if(/^(?:categorize|classify|compare|contrast|distinguish|choose|select|recommend|decide|diagnose|plan|design|apply|evaluate|translate|synthesize|integrate|analyze|analyse|interpret|propose)\b/i.test(text)&&!/\b(?:why|reason|justify|explain)\b/i.test(text))text+=' and explain your reasoning';
  return`${text}.`;
}
function curateQuiz(module,index,assessment,exercise){
  const blocks=(module.lessonBlocks||[]).slice(0,3),heads=blocks.map(row=>strip(row.heading)),facts=blocks.map(row=>sentence(row.content));
  const options=[...new Set([...facts,'A separate claim not established in the supplied lesson material.'])].slice(0,4);while(options.length<4)options.push(`Alternative ${options.length+1}.`);
  const concepts=[...heads,'A separate consideration not established in the lesson material'];
  const directObjective=directAssessment(module.objective,module.objective,module.title),directIntent=directAssessment(assessment,module.objective,module.title);
  const practice=strip(exercise)||`Apply ${module.title} to a realistic project situation.`;
  const bank=[
    {id:`m${index}-mc-1`,type:'multiple-choice',prompt:`Which explanation best fits “${heads[0]}”?`,options,answer:facts[0],explanation:`This explanation describes ${heads[0]}.`,concepts:[heads[0]],provenance:SCAFFOLD_PROVENANCE},
    {id:`m${index}-multi-1`,type:'multi-select',prompt:`Select the considerations relevant when carrying out this task: ${practice}`,options:concepts,answer:heads,explanation:`The practical task draws on ${heads.join(', ')}.`,concepts:heads,provenance:SCAFFOLD_PROVENANCE},
    {id:`m${index}-short-1`,type:'short-answer',prompt:directObjective,rubric:[{id:'accuracy',label:'Uses the subject concepts accurately',points:4,role:'principle',required:true},{id:'application',label:'Applies them to a concrete situation',points:3,role:'application',required:true},{id:'reasoning',label:'Explains the reasoning clearly',points:3,role:'evidence',required:true}],minWords:35,maxWords:320,concepts:heads,provenance:SCAFFOLD_PROVENANCE},
    {id:`m${index}-mc-2`,type:'multiple-choice',prompt:`Which option most directly applies “${heads[1]||heads[0]}” to the practical task?`,options:[practice,...facts.filter(Boolean).slice(0,3)].slice(0,4),answer:practice,explanation:`The practical task is the application defined for ${heads[1]||heads[0]}.`,concepts:[heads[1]||heads[0]],provenance:SCAFFOLD_PROVENANCE},
    {id:`m${index}-short-2`,type:'short-answer',prompt:directIntent,rubric:[{id:'subject',label:'Answers the subject-matter question directly',points:4,role:'principle',required:true},{id:'reasoning',label:'Supports the answer with relevant reasoning',points:3,role:'evidence',required:true},{id:'application',label:'Connects the answer to a realistic situation when appropriate',points:3,role:'application',required:true}],minWords:35,maxWords:360,concepts:heads,provenance:SCAFFOLD_PROVENANCE}
  ];
  const leaked=bank.filter(q=>META.test(q.prompt));
  if(leaked.length)throw Object.assign(new Error(`Living School assessment curation rejected ${leaked.length} curriculum-meta learner prompt${leaked.length===1?'':'s'}.`),{code:'LIVING_SCHOOL_META_ASSESSMENT_REJECTED'});
  return{questionsPerAttempt:3,passScore:80,bank,remediation:`Revisit ${heads.join(', ')} and retry the subject questions you missed.`};
}
function assessmentFromDesign(design,index){
  const regex=new RegExp(`^#{1,6}\\s*Module\\s+${index}\\b[\\s\\S]*?(?=^#{1,6}\\s*Module\\s+${index+1}\\b|$)`,'im'),section=String(design||'').match(regex)?.[0]||'';
  const match=section.match(/^\s*\*\*(?:Assessment Intent|Assessment)\s*:\*\*\s*(.+)$/im)||section.match(/^\s*(?:Assessment Intent|Assessment)\s*:\s*(.+)$/im);
  return strip(match?.[1]||'');
}
function exerciseFromDesign(design,index){
  const regex=new RegExp(`^#{1,6}\\s*Module\\s+${index}\\b[\\s\\S]*?(?=^#{1,6}\\s*Module\\s+${index+1}\\b|$)`,'im'),section=String(design||'').match(regex)?.[0]||'';
  const match=section.match(/^\s*\*\*(?:Exercise|Practice|Practical Work)\s*:\*\*\s*(.+)$/im)||section.match(/^\s*(?:Exercise|Practice|Practical Work)\s*:\s*(.+)$/im);
  return strip(match?.[1]||'');
}
function install(){
  const spine=globalThis.CivweaveFastInteractiveV192,base=globalThis.CivweaveLivingSchoolGroundedCompilerV336;if(!spine?.register||typeof base?.compile!=='function')return false;
  spine.unregister?.(ID);
  spine.register(ID,{async handle(request){
    if(clean(request?.purpose,180).toLowerCase()!==PURPOSE)return{handled:false};
    const provider=clean(request?.config?.provider||request?.config?.route,80).toLowerCase();if(provider!=='gemini')return{handled:false};
    try{
      const payload=base.compile(request),index=Number(payload.moduleIndex)||1,design=clean(request?.context?.designPacket,64000),assessment=assessmentFromDesign(design,index),exercise=exerciseFromDesign(design,index);
      payload.module.quiz=curateQuiz(payload.module,index,assessment,exercise);
      payload.module.completionCriteria=(payload.module.completionCriteria||[]).map(row=>strip(row).replace(/^Respond to the assessment intent:\s*/i,'Complete the subject assessment: '));
      const result={schema:'civweave-model-result-1.0',requestId:request.requestId||`ls-v338-${Date.now().toString(36)}`,purpose:PURPOSE,status:'success',outputText:JSON.stringify(payload),outputJson:payload,usage:{inputTokens:0,outputTokens:0,totalTokens:0,costCents:0,remainingCents:0},stream:{requested:false,used:false},structured:{requested:true,valid:true,repairAttempts:0},fallback:{used:false},requested:{provider,model:clean(request?.config?.model,180),executionProfile:'interactive'},actual:{provider:'civweave',model:COMPILER},diagnostics:['Living School compiled the grounded design packet without a second serialization call.','The temporary compiler quiz satisfies the structure contract only; deterministic-compiler provenance causes it to be stripped before the dedicated AI assessment pass persists the curriculum.']};
      return{handled:true,result};
    }catch(error){return{handled:true,result:{schema:'civweave-model-result-1.0',requestId:request.requestId||`ls-v338-${Date.now().toString(36)}`,purpose:PURPOSE,status:'invalid-response',outputText:'',usage:{},stream:{requested:false,used:false},structured:{requested:true,valid:false,repairAttempts:0},fallback:{used:false},actual:{provider:'civweave',model:COMPILER},error:{code:clean(error?.code||'LIVING_SCHOOL_ASSESSMENT_CURATOR_FAILED',160),message:clean(error?.message||error,2400)}}}}
  }},300);
  try{dispatchEvent(new CustomEvent('civweave:living-school-assessment-curator-ready',{detail:{version:VERSION,middleware:ID,learnerFacing:true,rejectsMetaPrompts:true,temporaryScaffold:true,aiAssessmentRequiredBeforePersistence:true,at:new Date().toISOString()}}))}catch{}
  return true;
}
for(const event of ['civweave:runtime-spine-ready','civweave:living-school-grounded-compiler-ready','civweave:living-school-runtime-route-ready'])addEventListener?.(event,()=>queueMicrotask(install));
install();
globalThis.CivweaveLivingSchoolAssessmentCuratorV337=Object.freeze({version:VERSION,install,directAssessment,curateQuiz,metaPattern:META,temporaryScaffold:true,aiAssessmentRequiredBeforePersistence:true});
})();