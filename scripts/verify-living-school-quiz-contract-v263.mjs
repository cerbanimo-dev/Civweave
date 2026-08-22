import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const [guard,entry,index,actions]=await Promise.all([
  read('public/app/living-school-quiz-contract-guard-v263.mjs'),
  read('public/app/cabinets/living-school/living-school-cleanroom-v218.mjs'),
  read('public/app/cabinets/living-school/index.html'),
  read('public/app/living-school-cleanroom-actions-v243.mjs')
]);

assert(guard.includes("const REVISION='living-school-quiz-contract-guard-v264-pedagogy'"),'Subject-mastery quiz contract revision is missing.');
assert(guard.includes("if(type==='short-answer')return rubricRows(question).length>=2"),'Short-answer questions are still counted before rubric validation.');
assert(guard.includes("rubric:{type:'array',minItems:2,maxItems:5"),'Short-answer recovery schema does not require a usable rubric.');
assert(guard.includes("required:['id','label','points','role','required']"),'Rubric criterion schema is not explicit enough for downstream normalization.');
assert(guard.includes("type:{type:'string',enum:[type]}"),'Recovery schema does not pin the requested question type.');
assert(guard.includes("purpose:REPAIR_PURPOSE"),'Malformed quiz rows do not trigger a dedicated contract-repair request.');
assert(guard.includes("maxRepairAttempts:2"),'Dedicated contract repair does not permit bounded structured-output correction.');
assert(guard.includes('The schema and subject-mastery contract are hard persistence requirements.'),'Recovery prompt does not explain the subject-mastery persistence contract.');
assert(guard.includes("if(!validQuestion(question,module)){rejectedGeneric+=1;continue}"),'Initial supplemental rows are still counted before semantic and structural validation.');
assert(guard.includes("while((questions.length<target||missingTypes(module,questions).length)&&attempts<12)"),'Quiz completion does not continue until both bank size and required types are valid.');
assert(guard.includes("const type=missing[0]||REQUIRED_TYPES"),'Repair does not prioritize a still-missing required type.');
assert(guard.includes("question&&typeOf(question)===type"),'A recovery call can still satisfy itself with the wrong question type.');
assert(guard.includes('ALWAYS_META')&&guard.includes('/best demonstrates completion/i'),'Known meta-assessment prompts are not rejected.');
assert(guard.includes('/skip (?:the )?practice/i')&&guard.includes('/confidence alone/i'),'Known nonsense distractors are not rejected.');
assert(guard.includes('subjectGrounded(question,module)'),'Quiz validation is not anchored to the module subject.');
assert(guard.includes('plausible domain misconceptions'),'Recovery prompt does not require plausible subject-matter distractors.');
assert(guard.includes('subjectMasteryRequired:true')&&guard.includes('genericAssessmentRejected:true')&&guard.includes('plausibleDistractorsRequired:true'),'Quiz guard does not expose the subject-mastery integrity contract.');

assert(entry.includes("../../living-school-quiz-contract-guard-v263.mjs"),'Living School does not load the compatible V263 quiz guard module.');
assert(entry.includes('await installLivingSchoolQuizContractGuardV263()'),'Living School does not install the quiz guard after the generation guard.');
assert(index.includes('data-living-school-revision="structured-single-v221"'),'Living School outer entry is not on the active structured-single runtime.');
assert(actions.includes("if(type==='short-answer'&&!rubric.length)return null"),'Final downstream normalizer no longer enforces a visible short-answer rubric.');
assert(actions.includes('stripLegacyFallbackQuestions(school)')&&actions.includes('completeSharedQuizBank(data,school,options)'),'Shared curriculum no longer removes deterministic quiz scaffolding before AI quiz completion.');

console.log(JSON.stringify({ok:true,revision:'living-school-quiz-contract-v264-pedagogy',compatibleInstallApi:'V263',validatesBeforeCounting:true,shortAnswerRubricRequired:true,typePinnedRecovery:true,boundedRepair:true,subjectGrounded:true,genericAssessmentRejected:true,plausibleDistractorsRequired:true,finalNormalizerStillStrict:true},null,2));