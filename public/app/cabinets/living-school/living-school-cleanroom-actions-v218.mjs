/* confidence-weighted-validation-v1 */
import '../../shared/civweave-validation-confidence-v1.js';
import * as rubric from '../../services/living-school/modules/rubric-engine.mjs';
import * as gate from '../../services/living-school/modules/project-gate.mjs';
import * as bridge from '../../services/living-school/modules/cerbanimo-bridge.mjs';
import{state,replaceState,persist,toast,award,activeModule,progressFor,availablePaths,fields,field,formFor,clean,uid,now,copy,readJson,writeJson,STATE_KEY,OUTBOX_KEY,freshState,normalizeState,researchCapability,generateSchool,quizQuestions}from'./living-school-cleanroom-core-v218.mjs';

const answerNodes=(scope,index)=>[...scope.querySelectorAll(`[name="quiz-${index}"]`)];
const quizAnswer=(scope,index,type)=>{
  const nodes=answerNodes(scope,index);
  if(type==='multi-select')return nodes.filter(node=>node.checked).map(node=>node.value);
  if(type==='multiple-choice')return nodes.find(node=>node.checked)?.value||'';
  return clean(nodes[0]?.value,12000);
};
const sameSet=(left,right)=>{
  const a=[...(Array.isArray(left)?left:[])].map(String).sort(),b=[...(Array.isArray(right)?right:[])].map(String).sort();
  return a.length===b.length&&a.every((value,index)=>value===b[index]);
};
const confidenceApi=()=>{const api=globalThis.CivweaveValidationConfidenceV1;if(!api)throw new Error('Weighted validation confidence runtime is unavailable.');return api};
const validationForAssessment=(module,progress,results,score,threshold)=>{
  const correlationId=`assessment:${module.id}`;
  const evidence=results.map(result=>({id:`question:${result.questionId}`,validatorId:`question:${module.id}:${result.questionId}`,family:result.authority==='deterministic-test'?'deterministic-test':/model/.test(String(result.authority||''))?'model-rubric':'deterministic-rubric',provenance:result.authority||'deterministic-rubric',verdict:result.passed?'pass':'fail',confidence:Number(result.confidence)||.8,score:Number(result.score||0)/100,threshold:Number(result.rubricThreshold??.6),correlationId}));
  evidence.push({id:`module-score:${module.id}`,validatorId:`module-score:${module.id}`,family:'deterministic-rubric',provenance:'module-pass-score-rubric',verdict:score>=threshold?'pass':'fail',confidence:.92,score:score/100,threshold:threshold/100,correlationId});
  if(progress.lessonComplete&&progress.note)evidence.push({id:`lesson-artifact:${module.id}`,validatorId:`lesson-artifact:${module.id}`,family:'artifact-inspection',provenance:'learner-lesson-artifact',verdict:'pass',confidence:.82,score:1,threshold:.6,correlationId:`lesson:${module.id}`});
  return confidenceApi().aggregate(evidence);
};
const validationForFinal=(evaluation,gateReceipt,finalId)=>confidenceApi().aggregate([
  {id:`final-rubric:${finalId}`,validatorId:`final-rubric:${finalId}`,family:/model/.test(String(evaluation.authority||''))?'model-rubric':'deterministic-rubric',provenance:evaluation.authority||'deterministic-rubric',verdict:evaluation.ok&&!evaluation.uncertain?'pass':'fail',confidence:Number(evaluation.confidence)||.75,score:Number(evaluation.score||0)/100,threshold:.6,correlationId:finalId},
  {id:`cerbanimo-receipt:${gateReceipt?.receiptId||finalId}`,validatorId:`cerbanimo-receipt:${gateReceipt?.receiptId||finalId}`,family:'artifact-inspection',provenance:'accepted-cerbanimo-project-receipt',verdict:gateReceipt?'pass':'fail',confidence:.9,score:gateReceipt?1:0,threshold:.6,correlationId:gateReceipt?.receiptId||finalId}
]);
const busyLabel=(target,label)=>{target.disabled=true;target.textContent=label};

export const actions={
  'apply-path':async target=>{
    const id=clean(field('pathId',formFor(target)),180),path=availablePaths().find(item=>item.id===id);
    if(!path)throw new Error('That path is unavailable.');
    const s=state();s.activePathId=id;s.pathContext=path;persist('learning-path-selected',{pathId:id});toast(`Using ${path.title}`);
  },
  'research-sources':async target=>{
    const data=fields(target,['capability']);
    if(!clean(data.capability))throw new Error('Name an observable capability.');
    busyLabel(target,'Researching sources…');
    const packet=await researchCapability(data.capability,{force:true});
    persist('living-school-research-completed',{capability:data.capability,mode:packet.mode,sourceCount:packet.sources?.length||0,provider:packet.provider,model:packet.model,flag:packet.flag});
    toast(packet.mode==='live-agentic'?`Research complete: ${packet.sources.length} live sources.`:`Research complete with ${packet.flag.toLowerCase()}.`);
  },
  'generate-curriculum':async target=>{
    const data=fields(target,['title','capability','level','count','mode','modelRoute','proof']);
    if(!clean(data.capability))throw new Error('Name an observable capability.');
    busyLabel(target,state().school?'Researching before regeneration…':'Researching before generation…');
    const packet=await researchCapability(data.capability,{force:false});
    persist('living-school-research-ready',{capability:data.capability,mode:packet.mode,sourceCount:packet.sources?.length||state().research?.sourceCount||0,reused:Boolean(packet.reused)});
    target.textContent=state().school?'Regenerating curriculum…':'Generating curriculum…';
    const s=state(),school=await generateSchool(data),old=s.school?.modules||[],nextProgress={};
    school.modules.forEach((item,index)=>nextProgress[item.id]=s.progress[old[index]?.id]||progressFor(item.id));
    s.school=school;s.activeModuleId=school.modules[0].id;s.progress=nextProgress;s.settings={...s.settings,modelRoute:data.modelRoute,mode:data.mode};s.visualInspection=null;
    persist('curriculum-generated',{schoolId:school.id,researchMode:s.research?.mode||'none',sourceCount:s.sources.length,formatContract:school.generation.formatContract,fallback:school.generation.fallback});
    toast(school.generation.fallback?`Moss built a complete local fallback after research: ${school.generation.error||'shared generation unavailable'}`:'Moss researched first and generated the formatted curriculum.');
  },
  'select-module':async target=>{
    const id=clean(target.dataset.moduleId,180),s=state();
    if(s.school?.modules?.some(item=>item.id===id)){s.activeModuleId=id;s.visualInspection=null;persist('module-selected',{moduleId:id})}
  },
  'inspect-visual-item':async target=>{
    const module=activeModule(),index=Number(target.dataset.visualIndex||0),item=module?.visualization?.items?.[index];
    if(!module||!item)return;
    const s=state();s.visualInspection={moduleId:module.id,index};persist('module-visual-inspected',{moduleId:module.id,index,label:item.label});
  },
  'save-lesson':async target=>{
    const module=activeModule(),note=clean(field('lessonNote',formFor(target)),8000);
    if(!module||!note)throw new Error('Add a working note.');
    const s=state(),progress=progressFor(module.id),first=!progress.lessonComplete;
    s.progress[module.id]={...progress,lessonComplete:true,note,evidence:[...(progress.evidence||[]),{id:uid('evidence'),type:'lesson-note',detail:{note},at:now()}].slice(-50)};
    if(first)award(5,'Lesson evidence recorded',module.id);
    persist('lesson-completed',{moduleId:module.id});toast('Lesson evidence saved.');
  },
  'evaluate-assessment':async target=>{
    const module=activeModule(),scope=formFor(target);
    if(!module)throw new Error('Choose a module.');
    const s=state(),progress=progressFor(module.id),questions=quizQuestions(module,progress);
    if(!questions.length)throw new Error('This module has no assessment bank.');
    const results=[];
    for(const [index,question] of questions.entries()){
      const response=quizAnswer(scope,index,question.type);
      if(question.type==='multiple-choice'){
        const ok=String(response)===String(question.answer);
        results.push({questionId:question.id,type:question.type,response,score:ok?100:0,passed:ok,confidence:.995,authority:'deterministic-test',rubricThreshold:.5,feedback:ok?'Correct.':question.explanation||'Review this concept.',concepts:question.concepts||[]});
      }else if(question.type==='multi-select'){
        const ok=sameSet(response,question.answer);
        results.push({questionId:question.id,type:question.type,response,score:ok?100:0,passed:ok,confidence:.995,authority:'deterministic-test',rubricThreshold:.5,feedback:ok?'Correct.':question.explanation||'Review every applicable element.',concepts:question.concepts||[]});
      }else{
        const answer=clean(response,12000);
        const evaluation=rubric.evaluateShortAnswer?.({prompt:question.prompt,response:answer,lessonExcerpt:(module.lessonBlocks||[]).map(block=>block.content).join('\n'),criteria:question.rubric?.length?question.rubric:[{id:'principle',label:'Explain the principle',points:4,role:'principle',required:true},{id:'application',label:'Apply it',points:3,role:'application',required:true},{id:'evidence',label:'Name evidence',points:3,role:'evidence',required:true}],minWords:question.minWords||20,maxWords:question.maxWords||280})||{ok:answer.split(/\s+/).length>=20,uncertain:false,score:75,feedback:'Local review.'};
        results.push({questionId:question.id,type:question.type,response:answer,score:Number(evaluation.score||0),passed:Boolean(evaluation.ok&&!evaluation.uncertain),uncertain:Boolean(evaluation.uncertain),confidence:Number(evaluation.confidence||.65),authority:evaluation.authority||'deterministic-rubric-assisted',rubricThreshold:.6,feedback:evaluation.feedback||'',concepts:question.concepts||[]});
      }
    }
    const unanswered=results.some(result=>Array.isArray(result.response)?!result.response.length:!clean(result.response,12000));
    const score=Math.round(results.reduce((sum,result)=>sum+Number(result.score||0),0)/Math.max(1,results.length));
    const threshold=Number(module.quiz?.passScore||80),validation=validationForAssessment(module,progress,results,score,threshold),passed=!unanswered&&validation.verifiedPass&&!results.some(result=>result.uncertain);
    const missed=[...new Set(results.filter(result=>!result.passed).flatMap(result=>result.concepts||[]))].filter(Boolean);
    const feedback=passed
      ?`Passed with ${score}%. The artifact and mixed-format check are ready for the next module.`
      :`${unanswered?'Answer every question. ':''}${missed.length?`Targeted review: ${missed.join(', ')}. `:''}${module.quiz?.remediation||'Review the lesson blocks and revise the artifact before trying again.'}`;
    const first=passed&&!progress.assessmentPassed,attempt={id:uid('attempt'),questionIds:questions.map(question=>question.id),results,score,passed,validation,feedback,at:now()};
    s.progress[module.id]={...progress,assessmentPassed:passed,validationConfidence:validation,attempts:[...(progress.attempts||[]),attempt].slice(-12),evidence:[...(progress.evidence||[]),{id:uid('evidence'),type:'mixed-assessment',detail:attempt,at:now()}].slice(-50)};
    if(first)award(Number(module.xp?.amount||15),`Module assessment passed: ${module.xp?.domain||'learning'}`,module.id);
    persist('assessment-evaluated',{moduleId:module.id,passed,score,confidence:validation.passConfidence,decision:validation.decision,evidenceFamilies:validation.diversity.familyCount,questionCount:questions.length,missed});
    toast(passed?'Assessment passed.':`Saved for targeted revision: ${missed.join(', ')||'review the module evidence'}.`);
  },
  'add-source':async target=>{
    const data=fields(target,['sourceTitle','sourceUrl','sourceNotes']);
    if(!clean(data.sourceTitle))throw new Error('Add a source title.');
    const s=state();s.sources=[...s.sources,{id:uid('source'),title:clean(data.sourceTitle,300),url:clean(data.sourceUrl,1000),notes:clean(data.sourceNotes,3000),quality:'manual',use:'supporting',verified:false,provenance:'learner-added',provenanceFlag:'LEARNER-ADDED · NOT LIVE-VERIFIED',at:now()}].slice(-100);
    persist('source-added');toast('Source attached.');
  },
  'remove-source':async target=>{const s=state();s.sources=s.sources.filter(item=>item.id!==target.dataset.sourceId);persist('source-removed')},
  'prefill-practicum':async()=>{
    const module=activeModule();if(!module)throw new Error('Choose a module.');
    const quest=module.cerbanimoQuest||{},s=state();
    s.practicum={id:s.practicum?.id||uid('practicum'),title:quest.title||`Practice ${module.title}`,artifact:s.practicum?.artifact||module.artifact||'',proof:quest.proof||module.practice?.completionCriteria||'',updatedAt:now()};
    persist('practicum-prefilled',{moduleId:module.id});toast('Cerbanimo practice quest loaded into the practicum.');
  },
  'save-practicum':async target=>{
    const data=fields(target,['practicumTitle','practicumArtifact','practicumProof']);
    if(!clean(data.practicumTitle)||!clean(data.practicumArtifact))throw new Error('Add a title and artifact.');
    const s=state();s.practicum={id:s.practicum?.id||uid('practicum'),title:clean(data.practicumTitle,300),artifact:clean(data.practicumArtifact,5000),proof:clean(data.practicumProof,5000),updatedAt:now()};
    s.projectGate=gate.normalizeProjectGate?.({...s.projectGate,status:'ready-to-submit',projectRef:s.practicum.id,brief:s.practicum,updatedAt:now()})||s.projectGate;
    persist('practicum-saved');toast('Practicum saved.');
  },
  'create-handoff':async()=>{
    const s=state();if(!s.practicum)throw new Error('Save a practicum first.');
    const request={schema:'civweave.cerbanimo.project-request.v1',requestId:uid('request'),sourceSystem:'living-school',targetSystem:'cerbanimo',capability:s.school?.capability||'',practicum:copy(s.practicum),createdAt:now(),status:'ready'},outbox=readJson(OUTBOX_KEY,[]);
    writeJson(OUTBOX_KEY,[...(Array.isArray(outbox)?outbox:[]),request].slice(-100));
    s.projectGate=gate.normalizeProjectGate?.({...s.projectGate,status:'submitted',requestId:request.requestId,updatedAt:now()})||s.projectGate;
    persist('cerbanimo-handoff-created');toast('Cerbanimo request created.');
  },
  'import-receipt':async target=>{
    const text=clean(field('receiptJson',formFor(target)),30000);if(!text)throw new Error('Paste a receipt.');
    const raw=JSON.parse(text),receipt=bridge.normalizeProjectReceipt?.(raw)||raw,s=state(),result=gate.applyReceipt?.(s.projectGate,receipt)||{changed:true,gate:{...s.projectGate,status:receipt.status||'accepted',lastReceipt:receipt}};
    if(!result.changed)throw new Error(`Receipt rejected: ${result.reason||'invalid'}`);
    s.projectGate=result.gate;s.receipts=[...s.receipts,receipt].slice(-100);persist('cerbanimo-receipt-applied');toast(`Project gate: ${result.gate.status}`);
  },
  'open-cerbanimo':async()=>location.assign('/app/cabinet-only-v144.html?system=cerbanimo&from=living-school&capability=cerbanimo.create-quest'),
  'evaluate-final':async target=>{
    const s=state();if(!(gate.canUnlockFinalTest?.(s.projectGate)||Boolean(s.projectGate?.status==='accepted'&&s.projectGate?.lastReceipt)))throw new Error('An accepted Cerbanimo receipt is required.');
    const answer=clean(field('finalAnswer',formFor(target)),16000);if(!answer)throw new Error('Write the final explanation.');
    const evaluation=rubric.evaluateShortAnswer?.({prompt:'Explain capability, evidence, uncertainty, and revision.',response:answer,lessonExcerpt:`Capability: ${s.school?.capability||''}. Artifact: ${s.practicum?.artifact||''}.`,criteria:[{id:'capability',label:'Capability',points:3,role:'principle',required:true},{id:'evidence',label:'Evidence',points:4,role:'evidence',required:true},{id:'limits',label:'Limits',points:3,role:'action',required:true}],minWords:30,maxWords:420})||{ok:answer.split(/\s+/).length>=30,uncertain:false,score:80,feedback:'Local final review.'};
    const finalId=uid('final'),validation=validationForFinal(evaluation,s.projectGate.lastReceipt,finalId),passed=validation.verifiedPass&&!evaluation.uncertain,first=passed&&!s.final?.passed;s.final={id:finalId,answer,score:Number(evaluation.score||0),passed,validationConfidence:validation,feedback:evaluation.feedback,receiptId:s.projectGate.lastReceipt?.receiptId,at:now()};
    if(first)award(25,'Final competency passed',s.final.id);persist('final-assessment-evaluated',{passed});toast(passed?'Final competency passed.':'Saved for revision.');
  },
  'issue-credential':async()=>{
    const s=state();if(!s.final?.passed)throw new Error('Pass the final competency check first.');
    s.credential=s.credential||{schema:'civweave.learning-credential.v1',credentialId:uid('credential'),title:s.school?.title||'Living School capability',capability:s.school?.capability||'',learner:s.passport.displayName,schoolId:s.school?.id||'',receiptId:s.projectGate.lastReceipt?.receiptId||'',issuedAt:now()};
    persist('credential-issued',{credentialId:s.credential.credentialId});toast('Portable credential issued.');
  },
  'save-profile':async target=>{const s=state();s.passport={...s.passport,displayName:clean(field('displayName',formFor(target)),100)||'Local learner'};persist('passport-updated')},
  'copy-record':async()=>{if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable.');await navigator.clipboard.writeText(JSON.stringify({...state(),exportedAt:now()},null,2));toast('Record copied.')},
  'restore-record':async target=>{const restored=JSON.parse(clean(field('restoreJson',formFor(target)),500000));writeJson(`${STATE_KEY}.backup.${Date.now()}`,state());replaceState(normalizeState(restored));persist('cleanroom-record-restored');toast('Record restored without legacy navigation state.')},
  'reset-record':async()=>{writeJson(`${STATE_KEY}.backup.${Date.now()}`,state());replaceState(freshState());persist('cleanroom-record-reset');toast('Reset complete. Backup preserved.')}
};
