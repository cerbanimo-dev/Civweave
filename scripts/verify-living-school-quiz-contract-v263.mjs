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

assert(guard.includes("const REVISION='living-school-quiz-contract-guard-v263'"),'v263 quiz contract revision is missing.');
assert(guard.includes("if(type==='short-answer')return rubricRows(question).length>=2"),'Short-answer questions are still counted before rubric validation.');
assert(guard.includes("rubric:{type:'array',minItems:2,maxItems:5"),'Short-answer recovery schema does not require a usable rubric.');
assert(guard.includes("required:['id','label','points','role','required']"),'Rubric criterion schema is not explicit enough for downstream normalization.');
assert(guard.includes("type:{type:'string',enum:[type]}"),'Recovery schema does not pin the requested question type.');
assert(guard.includes("purpose:REPAIR_PURPOSE"),'Malformed quiz rows do not trigger a dedicated contract-repair request.');
assert(guard.includes("maxRepairAttempts:2"),'Dedicated contract repair does not permit bounded structured-output correction.');
assert(guard.includes('The schema is a hard persistence contract, not a suggestion.'),'Short-answer recovery prompt does not explain the persistence contract.');
assert(guard.includes("if(!validQuestion(question))continue"),'Initial supplemental rows are still counted before full validation.');
assert(guard.includes("while((questions.length<target||missingTypes(module,questions).length)&&attempts<12)"),'Quiz completion does not continue until both bank size and required types are valid.');
assert(guard.includes("const type=missing[0]||REQUIRED_TYPES"),'Repair does not prioritize a still-missing required type.');
assert(guard.includes("question&&typeOf(question)===type"),'A recovery call can still satisfy itself with the wrong question type.');

assert(entry.includes("../../living-school-quiz-contract-guard-v263.mjs?v=short-answer-rubric-v263"),'Living School does not load the v263 quiz contract guard.');
assert(entry.includes('await installLivingSchoolQuizContractGuardV263()'),'Living School does not install the v263 guard after the v262 generation guard.');
assert(entry.includes("quizIntegrity:'ai-only-v263-short-answer-contract'"),'Living School does not expose the v263 quiz integrity revision.');
assert(index.includes("living-school-cleanroom-v218.mjs?v=research-first-v218.1-v304-nonblocking-boot"),'Living School outer entry does not load the current nonblocking clean-room module.');
assert(actions.includes("if(type==='short-answer'&&!rubric.length)return null"),'Final downstream normalizer no longer enforces a visible short-answer rubric.');

console.log(JSON.stringify({ok:true,revision:'living-school-quiz-contract-v263',validatesBeforeCounting:true,shortAnswerRubricRequired:true,typePinnedRecovery:true,boundedRepair:true,nonblockingOuterBoot:true,finalNormalizerStillStrict:true},null,2));
