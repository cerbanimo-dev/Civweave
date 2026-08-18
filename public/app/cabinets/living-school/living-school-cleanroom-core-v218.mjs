import * as gate from '../../services/living-school/modules/project-gate.mjs';

export const VERSION='living-school-cleanroom-v218.2-modulewise-shared-curriculum';
export const STATE_KEY='civweave.living-school.cabinet.v151';
const OLD_KEY='civweave.living-school.cabinet.v150';
const INTAKE_KEY='civweave.living-school.intake.v152';
const INTENTION_KEY='civweave.intentions.v127';
export const OUTBOX_KEY='civweave.cerbanimo.project-handoff.outbox.v1';
const RESEARCHER='living-school-cleanroom-research-v218.1';

export const root=document.getElementById('living-school-root');
const toastNode=document.getElementById('lsc218-toast');
const progressLabel=document.getElementById('lsc218-progress-label');
const progressBar=document.getElementById('lsc218-progress-bar');

export const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[char]));
export const now=()=>new Date().toISOString();
export const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
export const clip=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
export const copy=value=>globalThis.structuredClone?globalThis.structuredClone(value):JSON.parse(JSON.stringify(value));
export function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
export function writeJson(key,value){localStorage.setItem(key,JSON.stringify(value));return value}
const freshGate=()=>gate.defaultProjectGate?.()||{status:'not-started',history:[],receiptIds:[]};
const titles=['Foundations and vocabulary','Observe the system','Practice the core workflow','Create and test an artifact','Explain evidence and tradeoffs','Transfer the capability','Teach or document the method','Final synthesis'];
const keyFor=value=>clean(value,1200).toLowerCase().replace(/\s+/g,' ').slice(0,500);
const validHttp=value=>{try{return['http:','https:'].includes(new URL(value).protocol)}catch{return false}};
const normalizeUse=value=>['core','supporting','counterpoint','example'].includes(clean(value,80).toLowerCase())?clean(value,80).toLowerCase():'supporting';
const normalizeQuality=value=>['authoritative','practitioner','community','commercial','contested'].includes(clean(value,80).toLowerCase())?clean(value,80).toLowerCase():'supporting';
const DETERMINISTIC_QUIZ_IDS=new Set(['mc-1','multi-1','short-1','scenario-1','short-2']);

function conceptRows(values,title,capability){
  const fallback=[{term:title.split(' ')[0]||'Foundation',definition:`A key idea used to build ${capability}.`}];
  const rows=Array.isArray(values)?values:[];
  const normalized=rows.map(item=>typeof item==='string'?{term:clean(item,120),definition:'A concept used in this module.'}:{term:clean(item?.term||item?.title,120),definition:clean(item?.definition||item?.description,1000)}).filter(item=>item.term);
  return normalized.length?normalized.slice(0,8):fallback;
}
function quizBank(index,title,capability){
  const prefix=`m${index+1}`,provenance='deterministic-compiler';
  return[
    {id:`${prefix}-mc-1`,type:'multiple-choice',prompt:`Which evidence best shows progress in ${title.toLowerCase()}?`,options:['A confident claim','A dated artifact with an explanation','A promise to try later','A copied definition'],answer:'A dated artifact with an explanation',explanation:'Inspectable evidence connects a claim to something another person can review.',concepts:[title],provenance},
    {id:`${prefix}-multi-1`,type:'multi-select',prompt:'Select every element that belongs in reviewable learning evidence.',options:['Artifact','Explanation','Revision note','Unsupported certainty'],answer:['Artifact','Explanation','Revision note'],explanation:'Evidence should reveal the work, the reasoning, and what changed after review.',concepts:['Evidence','Revision'],provenance},
    {id:`${prefix}-short-1`,type:'short-answer',prompt:`Explain how ${title.toLowerCase()} advances the capability and name one artifact that would prove it.`,rubric:[{id:'principle',label:'Explain the principle',points:4,role:'principle',required:true},{id:'application',label:'Apply it to the capability',points:3,role:'application',required:true},{id:'evidence',label:'Name inspectable evidence',points:3,role:'evidence',required:true}],minWords:24,maxWords:260,concepts:[title,capability],provenance},
    {id:`${prefix}-scenario-1`,type:'multiple-choice',prompt:'A learner has a polished explanation but no artifact. What is the best next step?',options:['Pass the module','Create a small artifact and connect it to the explanation','Add more confidence','Skip practice'],answer:'Create a small artifact and connect it to the explanation',explanation:'The module contract requires observable work, not prose alone.',concepts:['Artifact'],provenance},
    {id:`${prefix}-short-2`,type:'short-answer',prompt:'Name one uncertainty in this module and describe how you would verify or test it.',rubric:[{id:'uncertainty',label:'Names a real uncertainty',points:4,role:'principle',required:true},{id:'verification',label:'Provides a verification step',points:4,role:'action',required:true},{id:'limit',label:'Avoids overstating certainty',points:2,role:'evidence',required:true}],minWords:20,maxWords:220,concepts:['Uncertainty','Verification'],provenance}
  ];
}
export function isDeterministicQuizQuestion(question,index=-1){
  const id=clean(question?.id,160),provenance=clean(question?.provenance,120).toLowerCase();
  if(provenance==='deterministic-compiler'||/-fallback-\d+$/i.test(id))return true;
  if(index<0)return false;
  const match=id.match(/^m(\d+)-(.+)$/i);
  return Boolean(match&&Number(match[1])===index+1&&DETERMINISTIC_QUIZ_IDS.has(match[2].toLowerCase()));
}
export function moduleFor(index,capability){
  const title=titles[index]||`Module ${index+1}`,next=titles[index+1]||'the next capability step';
  const lesson=`Study ${title.toLowerCase()}. Connect it to the capability, identify one observable decision, and record evidence another person could inspect.`;
  const exercise=`Apply ${title.toLowerCase()} to a small example. Name what changed, what evidence exists, and what you would revise.`;
  return{
    id:`module-${index+1}`,title,
    summary:`A practical module for using ${title.toLowerCase()} to advance the stated capability.`,
    objective:`Use ${title.toLowerCase()} to advance: ${capability}`,
    relevance:`This matters because the learner must be able to demonstrate ${capability}, not merely describe it.`,
    prerequisites:index?[`Complete or review ${titles[index-1].toLowerCase()}.`]:['No specialist prerequisite; begin with the stated capability and source packet.'],
    estimatedEffort:index<2?'35–50 minutes':'50–75 minutes',
    artifact:`A dated ${title.toLowerCase()} artifact with an explanation and revision note.`,
    completionCriteria:[`The artifact visibly applies ${title.toLowerCase()}.`,'The learner explains one decision and one uncertainty.','A reviewer can inspect the evidence without relying on confidence alone.'],
    learningObjectives:[`Explain the role of ${title.toLowerCase()}.`,`Apply it to ${capability}.`,'Produce reviewable evidence and identify a revision.'],
    concepts:conceptRows([],title,capability),
    lessonBlocks:[
      {id:`module-${index+1}-lesson-1`,heading:'Core idea',content:lesson,sourceIds:[],provenance:'generated-unverified'},
      {id:`module-${index+1}-lesson-2`,heading:'Worked application',content:'Use a small example to compare a weak claim with a reviewable demonstration. Keep the distinction between established information, assumptions, and design choices visible.',sourceIds:[],provenance:'generated-unverified'}
    ],
    visualization:{type:'comparison',title:`${title}: claim versus evidence`,caption:'Inspect each item and connect it to the module artifact.',items:[{label:'Claim',detail:'What the learner says is true.'},{label:'Artifact',detail:'The observable work that supports the claim.'},{label:'Revision',detail:'What changed after testing or feedback.'}]},
    practice:{prompt:exercise,steps:['Choose a small example.','Create the artifact.','Explain one decision.','Record one uncertainty and revision.'],deliverable:`One ${title.toLowerCase()} artifact`,rubric:[{criterion:'Observable application',weight:40},{criterion:'Evidence and explanation',weight:35},{criterion:'Uncertainty and revision',weight:25}],completionCriteria:'The artifact, explanation, and revision note are all present.'},
    quiz:{questionsPerAttempt:3,passScore:80,bank:quizBank(index,title,capability),remediation:`Review the lesson blocks and rebuild the artifact before the next attempt. Continue with ${next} only after the missed concepts can be explained with evidence.`},
    badge:{title:`${title} demonstrated`,description:'Awarded after lesson evidence and a passing mixed-format quiz.'},
    xp:{domain:clean(capability,120)||'learning',amount:20},
    navigation:{entry:`Module ${index+1}: ${title}`,next:index<7?`module-${index+2}`:''},
    cerbanimoQuest:{title:`Practice ${title}`,brief:'Produce and test the module artifact in Cerbanimo.',proof:'Submit the artifact, completion criteria, and reviewable receipt.'},
    lesson,exercise,question:`How does ${title.toLowerCase()} support the capability, and what evidence would show that you used it well?`
  };
}
function normalizeQuizRows(raw,index){
  const source=raw&&typeof raw==='object'?raw:{},count=clip(source.questionsPerAttempt||3,3,5);
  const rows=(Array.isArray(source.bank)?source.bank:[]).map((item,qIndex)=>{
    const type=['multiple-choice','multi-select','short-answer','scenario'].includes(clean(item?.type,40))?clean(item.type,40):'short-answer';
    const options=(Array.isArray(item?.options)?item.options:[]).map(value=>clean(value,300)).filter(Boolean).slice(0,8);
    const answer=Array.isArray(item?.answer)?item.answer.map(value=>clean(value,300)).filter(Boolean):clean(item?.answer,1000);
    return{id:clean(item?.id,120)||`module-${index+1}-q-${qIndex+1}`,type:type==='scenario'?'multiple-choice':type,prompt:clean(item?.prompt,2200),options,answer,explanation:clean(item?.explanation,1800),concepts:(Array.isArray(item?.concepts)?item.concepts:[]).map(value=>clean(value,120)).filter(Boolean).slice(0,6),rubric:(Array.isArray(item?.rubric)?item.rubric:[]).map((criterion,cIndex)=>({id:clean(criterion?.id,80)||`criterion-${cIndex+1}`,label:clean(criterion?.label,300),points:clip(criterion?.points||1,1,10),role:clean(criterion?.role,80)||'evidence',required:criterion?.required!==false})).slice(0,6),minWords:clip(item?.minWords||20,8,500),maxWords:clip(item?.maxWords||280,20,1200),provenance:clean(item?.provenance,120)};
  }).filter(item=>item.prompt);
  return{source,count,rows};
}
const quizEnvelope=(source,count,rows)=>({questionsPerAttempt:count,passScore:clip(source.passScore||80,60,100),bank:rows.slice(0,12),remediation:clean(source.remediation,2400)||'Review the lesson blocks and revise the artifact before another attempt.'});
export function normalizeAIQuiz(raw,index){const {source,count,rows}=normalizeQuizRows(raw,index);return quizEnvelope(source,count,rows.filter(question=>!isDeterministicQuizQuestion(question,index)));}
export function normalizeDeterministicQuiz(raw,index,title,capability){const {source,count,rows}=normalizeQuizRows(raw,index),fallback=quizBank(index,title,capability);while(rows.length<count+2)rows.push({...fallback[rows.length%fallback.length],id:`module-${index+1}-fallback-${rows.length+1}`,provenance:'deterministic-compiler'});return quizEnvelope(source,count,rows);}
export function normalizeModule(item,index,capability,quizMode='ai'){
  const fallback=moduleFor(index,capability),source=item&&typeof item==='object'?item:{};
  const lessonBlocks=(Array.isArray(source.lessonBlocks)?source.lessonBlocks:[]).map((block,bIndex)=>({id:clean(block?.id,120)||`module-${index+1}-lesson-${bIndex+1}`,heading:clean(block?.heading,300)||`Lesson block ${bIndex+1}`,content:clean(block?.content,8000),sourceIds:(Array.isArray(block?.sourceIds)?block.sourceIds:[]).map(value=>clean(value,180)).filter(Boolean).slice(0,8),provenance:clean(block?.provenance,120)||'generated-unverified'})).filter(block=>block.content);
  const concepts=conceptRows(source.concepts||fallback.concepts,source.title||fallback.title,capability);
  const practiceSource=source.practice&&typeof source.practice==='object'?source.practice:{};
  const visualizationSource=source.visualization&&typeof source.visualization==='object'?source.visualization:{};
  const quiz=quizMode==='deterministic'?normalizeDeterministicQuiz(source.quiz,index,source.title||fallback.title,capability):normalizeAIQuiz(source.quiz,index);
  return{...fallback,...source,id:clean(source.id,120)||`module-${index+1}`,title:clean(source.title,180)||fallback.title,summary:clean(source.summary,1800)||fallback.summary,objective:clean(source.objective,1200)||fallback.objective,relevance:clean(source.relevance,1800)||fallback.relevance,prerequisites:(Array.isArray(source.prerequisites)?source.prerequisites:fallback.prerequisites).map(value=>clean(value,500)).filter(Boolean).slice(0,8),estimatedEffort:clean(source.estimatedEffort,120)||fallback.estimatedEffort,artifact:clean(source.artifact,1600)||fallback.artifact,completionCriteria:(Array.isArray(source.completionCriteria)?source.completionCriteria:fallback.completionCriteria).map(value=>clean(value,600)).filter(Boolean).slice(0,8),learningObjectives:(Array.isArray(source.learningObjectives)?source.learningObjectives:fallback.learningObjectives).map(value=>clean(value,600)).filter(Boolean).slice(0,8),concepts,lessonBlocks:lessonBlocks.length?lessonBlocks:fallback.lessonBlocks,visualization:{type:['network','flow','timeline','cycle','comparison','matrix','tree'].includes(clean(visualizationSource.type,40))?clean(visualizationSource.type,40):fallback.visualization.type,title:clean(visualizationSource.title,300)||fallback.visualization.title,caption:clean(visualizationSource.caption,1200)||fallback.visualization.caption,items:(Array.isArray(visualizationSource.items)?visualizationSource.items:fallback.visualization.items).map(row=>typeof row==='string'?{label:clean(row,200),detail:''}:{label:clean(row?.label||row?.title,200),detail:clean(row?.detail||row?.description,1200)}).filter(row=>row.label).slice(0,10)},practice:{prompt:clean(practiceSource.prompt||source.exercise,4000)||fallback.practice.prompt,steps:(Array.isArray(practiceSource.steps)?practiceSource.steps:fallback.practice.steps).map(value=>clean(value,700)).filter(Boolean).slice(0,10),deliverable:clean(practiceSource.deliverable||source.artifact,1200)||fallback.practice.deliverable,rubric:(Array.isArray(practiceSource.rubric)?practiceSource.rubric:fallback.practice.rubric).map(row=>({criterion:clean(row?.criterion||row?.label,300),weight:clip(row?.weight||row?.points||1,1,100)})).filter(row=>row.criterion).slice(0,8),completionCriteria:clean(practiceSource.completionCriteria,1600)||fallback.practice.completionCriteria},quiz,badge:{title:clean(source.badge?.title,240)||fallback.badge.title,description:clean(source.badge?.description,1000)||fallback.badge.description},xp:{domain:clean(source.xp?.domain,120)||fallback.xp.domain,amount:clip(source.xp?.amount||fallback.xp.amount,0,1000)},navigation:{entry:clean(source.navigation?.entry,300)||fallback.navigation.entry,next:clean(source.navigation?.next,120)||fallback.navigation.next},cerbanimoQuest:{title:clean(source.cerbanimoQuest?.title,300)||fallback.cerbanimoQuest.title,brief:clean(source.cerbanimoQuest?.brief,1800)||fallback.cerbanimoQuest.brief,proof:clean(source.cerbanimoQuest?.proof,1800)||fallback.cerbanimoQuest.proof},lesson:clean(source.lesson,8000)||lessonBlocks[0]?.content||fallback.lesson,exercise:clean(source.exercise,4000)||practiceSource.prompt||fallback.exercise,question:clean(source.question,2200)||source.quiz?.bank?.[0]?.prompt||fallback.question};
}

function baseState(){return{schema:'living-school-cleanroom-v218',version:VERSION,updatedAt:now(),research:{mode:'none',status:'idle',query:'',startedAt:'',completedAt:'',sourceCount:0,summary:'',errors:[]},sources:[],curriculum:null,projectGate:freshGate(),receipts:[],settings:{safeMode:true,modelRoute:'shared'}};}
export let currentState=(()=>{const prior=readJson(STATE_KEY,null)||readJson(OLD_KEY,null)||baseState();return{...baseState(),...prior,research:{...baseState().research,...(prior?.research||{})},settings:{...baseState().settings,...(prior?.settings||{})},sources:Array.isArray(prior?.sources)?prior.sources:[],receipts:Array.isArray(prior?.receipts)?prior.receipts:[]};})();
export const saveState=()=>writeJson(STATE_KEY,{...currentState,updatedAt:now()});
export const setState=patch=>{currentState={...currentState,...patch,updatedAt:now()};saveState();return currentState;};
export function toast(message){if(toastNode){toastNode.textContent=clean(message,500);toastNode.hidden=false;clearTimeout(toast._timer);toast._timer=setTimeout(()=>{toastNode.hidden=true},5000)}}
export function setProgress(label,value){if(progressLabel)progressLabel.textContent=clean(label,300);if(progressBar){progressBar.value=clip(value,0,100);progressBar.setAttribute('aria-valuenow',String(progressBar.value))}}
export function deterministicSchool(data){const count=clip(data.count,1,8),modules=Array.from({length:count},(_,index)=>normalizeModule(moduleFor(index,data.capability),index,data.capability,'deterministic'));return{schema:'living-school-curriculum-v218.1',title:clean(data.title,180)||`${clean(data.capability,120)} learning path`,capability:clean(data.capability,1200),level:clean(data.level,80)||'mixed',mode:clean(data.mode,80)||'guided',proof:clean(data.proof,2400)||'Working artifact plus reviewable evidence',modules,generation:{provider:'deterministic-compiler',model:'',generatedAt:now(),fallback:true,sourceCount:currentState.sources.length,researchMode:currentState.research?.mode||'none',formatContract:'living-school-module-contract-v218.1'}};}

function questionSchema(){return{type:'object',required:['type','prompt'],properties:{id:{type:'string'},type:{type:'string'},prompt:{type:'string'},options:{type:'array',items:{type:'string'}},answer:{},explanation:{type:'string'},concepts:{type:'array',items:{type:'string'}},rubric:{type:'array',items:{type:'object',properties:{id:{type:'string'},label:{type:'string'},points:{type:'number'},role:{type:'string'},required:{type:'boolean'}}}},minWords:{type:'number'},maxWords:{type:'number'}}};}
function moduleSchema(){
  const question=questionSchema();
  return{type:'object',required:['title','summary','objective','relevance','prerequisites','estimatedEffort','artifact','completionCriteria','learningObjectives','concepts','lessonBlocks','visualization','practice','quiz','badge','xp','navigation','cerbanimoQuest'],properties:{title:{type:'string'},summary:{type:'string'},objective:{type:'string'},relevance:{type:'string'},prerequisites:{type:'array',items:{type:'string'}},estimatedEffort:{type:'string'},artifact:{type:'string'},completionCriteria:{type:'array',items:{type:'string'}},learningObjectives:{type:'array',items:{type:'string'}},concepts:{type:'array',items:{type:'object',required:['term','definition'],properties:{term:{type:'string'},definition:{type:'string'}}}},lessonBlocks:{type:'array',items:{type:'object',required:['heading','content','sourceIds','provenance'],properties:{heading:{type:'string'},content:{type:'string'},sourceIds:{type:'array',items:{type:'string'}},provenance:{type:'string'}}}},visualization:{type:'object',required:['type','title','caption','items'],properties:{type:{type:'string'},title:{type:'string'},caption:{type:'string'},items:{type:'array',items:{type:'object',required:['label','detail'],properties:{label:{type:'string'},detail:{type:'string'}}}}}},practice:{type:'object',required:['prompt','steps','deliverable','rubric','completionCriteria'],properties:{prompt:{type:'string'},steps:{type:'array',items:{type:'string'}},deliverable:{type:'string'},rubric:{type:'array',items:{type:'object',required:['criterion','weight'],properties:{criterion:{type:'string'},weight:{type:'number'}}}},completionCriteria:{type:'string'}}},quiz:{type:'object',required:['questionsPerAttempt','passScore','bank','remediation'],properties:{questionsPerAttempt:{type:'number'},passScore:{type:'number'},bank:{type:'array',items:question},remediation:{type:'string'}}},badge:{type:'object',required:['title','description'],properties:{title:{type:'string'},description:{type:'string'}}},xp:{type:'object',required:['domain','amount'],properties:{domain:{type:'string'},amount:{type:'number'}}},navigation:{type:'object',required:['entry','next'],properties:{entry:{type:'string'},next:{type:'string'}}},cerbanimoQuest:{type:'object',required:['title','brief','proof'],properties:{title:{type:'string'},brief:{type:'string'},proof:{type:'string'}}}}};
}
function moduleEnvelopeSchema(){return{type:'object',required:['module'],properties:{module:moduleSchema()}};}
async function runtimeReady(){for(let attempt=0;attempt<80;attempt++){const runtime=globalThis.CivweaveModelRuntime;if(runtime?.generate&&runtime?.readSharedConfig)return runtime;await new Promise(resolve=>setTimeout(resolve,50))}throw new Error('Shared model runtime is unavailable.');}

export async function generateSchool(data){
  const fallback=deterministicSchool(data);
  if(data.modelRoute!=='shared')return fallback;
  try{
    const runtime=await runtimeReady(),config=runtime.readSharedConfig?.('interactive');
    if(!config)throw new Error('Shared model configuration is unavailable.');
    const provider=clean(config.provider||config.route).toLowerCase();
    if(['','bundled','packaged','reflex','minilm','local-reflex','deterministic','manual'].includes(provider))throw new Error('The selected shared route cannot generate full curriculum content.');
    const count=clip(data.count,1,8),sources=currentState.sources.slice(0,16).map(source=>({id:source.id,title:source.title,url:source.url,quality:source.quality,use:source.use,notes:source.notes,verified:Boolean(source.verified),provenance:source.provenance,provenanceFlag:source.provenanceFlag}));
    const moduleConfig={...config,maxTokens:Math.max(Number(config.maxTokens)||0,6144),temperature:Math.min(Number(config.temperature)||0.2,0.3)};
    const modules=[];
    let lastResult=null;
    for(let index=0;index<count;index+=1){
      setProgress(`Generating module ${index+1} of ${count}`,Math.round((index/count)*90));
      const priorTitles=modules.map(module=>module.title);
      const result=await runtime.generate({purpose:`living-school-module-${index+1}-of-${count}-v218.2`,executionProfile:'interactive',config:moduleConfig,schema:moduleEnvelopeSchema(),context:{capability:data.capability,level:data.level,mode:data.mode,moduleIndex:index,moduleNumber:index+1,moduleCount:count,proofContract:data.proof,priorModuleTitles:priorTitles,research:currentState.research,sources,contentContract:{module:['title','summary','objective','relevance','prerequisites','estimated effort','artifact','completion criteria','learning objectives'],lesson:['concepts with definitions','multiple readable lesson blocks','paragraph-level sourceIds and provenance','worked application','uncertainty markers'],visualization:['type: network|flow|timeline|cycle|comparison|matrix|tree','title','caption','inspectable items'],practice:['prompt','steps','deliverable','weighted rubric','completion criteria'],quiz:['3-5 questions per attempt','bank at least two questions larger than attempt','mixed multiple-choice, multi-select, and short-answer','feedback and targeted remediation','visible short-answer rubrics'],rewards:['badge','skill XP domain and exact amount'],handoff:['Cerbanimo practice quest and proof contract']},constraints:['Generate only this one module.','Use only supplied source IDs.','Never invent citations, URLs, quotations, dates, or access claims.','Every lesson block must include sourceIds when grounded, otherwise provenance must be generated-unverified.','Mark uncertainty explicitly.','Question banks must be larger than each attempt and include mixed question types.','Do not repeat prior module titles or objectives.','Speak only as Moss and never impersonate another Civweave guide.']},messages:[{role:'system',content:'You are Moss, Living School learning guide. Build exactly one complete curriculum module as strict JSON inside a top-level module property. Teach in readable content blocks, not a thin outline. Satisfy the complete Living School module contract. Preserve paragraph-level provenance. A claim without a supplied source ID must be labeled generated-unverified. Include practical artifacts, weighted rubrics, mixed quizzes, feedback, targeted remediation, a badge, exact Skill XP, navigation, and a Cerbanimo practice quest. Never impersonate another guide.'},{role:'user',content:`Create module ${index+1} of ${count} for this observable capability: ${data.capability}. Level: ${data.level}. Mode: ${data.mode}. Proof contract: ${data.proof||'working artifact plus reviewable evidence'}. Prior modules: ${priorTitles.length?priorTitles.join(' | '):'none'}. Research mode: ${currentState.research?.mode||'unavailable'}.`} ]});
      lastResult=result;
      const raw=result?.outputJson?.module||result?.outputJson;
      if(result?.status!=='success'||!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error(result?.error?.message||result?.error||`Shared AI did not return module ${index+1}.`);
      const normalized=normalizeModule(raw,index,data.capability,'ai');
      if(!normalized.lessonBlocks?.length||!normalized.quiz?.bank?.length)throw new Error(`Shared AI returned incomplete module ${index+1}; refusing deterministic padding.`);
      modules.push(normalized);
    }
    setProgress('Shared curriculum ready',100);
    return{...fallback,title:clean(data.title,180)||fallback.title,capability:clean(data.capability,1200)||fallback.capability,proof:clean(data.proof,2400)||fallback.proof,modules,generation:{provider:lastResult?.actual?.provider||lastResult?.provider||config.provider||'shared',model:lastResult?.actual?.model||lastResult?.model||config.model||'',generatedAt:now(),fallback:false,sourceCount:sources.length,researchMode:currentState.research?.mode||'none',formatContract:'living-school-module-contract-v218.2-modulewise'}};
  }catch(error){
    setProgress('Shared curriculum generation failed',0);
    return{...fallback,generation:{...fallback.generation,fallback:true,error:clean(error.message,500)}};
  }
}

export function sourceRecord(item={}){const url=clean(item.url,4000);return{id:clean(item.id,180)||uid('source'),title:clean(item.title||url,500)||'Untitled source',url:validHttp(url)?url:'',quality:normalizeQuality(item.quality),use:normalizeUse(item.use),notes:clean(item.notes,2400),verified:Boolean(item.verified),provenance:clean(item.provenance,120)||RESEARCHER,provenanceFlag:clean(item.provenanceFlag,120),addedAt:item.addedAt||now(),key:keyFor(url||item.title||uid('source-key'))};}
export function mergeSources(rows=[]){const byKey=new Map(currentState.sources.map(source=>[source.key||keyFor(source.url||source.title),source]));for(const row of rows){const record=sourceRecord(row),prior=byKey.get(record.key);byKey.set(record.key,prior?{...prior,...record,id:prior.id,addedAt:prior.addedAt}:{...record});}currentState={...currentState,sources:[...byKey.values()].slice(0,120),updatedAt:now()};saveState();return currentState.sources;}
export function projectGateStatus(){return currentState.projectGate||freshGate();}
export function updateProjectGate(patch={}){currentState={...currentState,projectGate:{...projectGateStatus(),...patch},updatedAt:now()};saveState();return currentState.projectGate;}
export function addReceipt(receipt){const row={id:clean(receipt?.id,180)||uid('receipt'),type:clean(receipt?.type,80)||'learning',createdAt:receipt?.createdAt||now(),...receipt};currentState={...currentState,receipts:[row,...currentState.receipts].slice(0,100),updatedAt:now()};saveState();return row;}
export function currentIntention(){const intake=readJson(INTAKE_KEY,null),intentions=readJson(INTENTION_KEY,[]);if(intake?.intention)return clean(intake.intention,1200);const active=(Array.isArray(intentions)?intentions:[]).find(item=>item?.active!==false&&clean(item?.text||item?.wish,1200));return clean(active?.text||active?.wish,1200);}
export function resetState(){currentState=baseState();saveState();return currentState;}
