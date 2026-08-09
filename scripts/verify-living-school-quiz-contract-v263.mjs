import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const [guard,entry,index,actions,deadlines]=await Promise.all([
  read('public/app/living-school-quiz-contract-guard-v263.mjs'),
  read('public/app/cabinets/living-school/living-school-cleanroom-v218.mjs'),
  read('public/app/cabinets/living-school/index.html'),
  read('public/app/living-school-cleanroom-actions-v243.mjs'),
  read('public/app/living-school-deadline-guard-v266.mjs')
]);

assert(guard.includes("const REVISION='living-school-quiz-contract-guard-v266-bounded'"),'v266 bounded quiz contract revision is missing.');
assert(guard.includes("const PRIMARY_PURPOSE='living-school-quiz-contract-primary-v266'"),'Primary bounded quiz request does not bypass the legacy nested loop.');
assert(guard.includes('const MAX_REPAIRS_PER_MODULE=3'),'Quiz repair is not explicitly bounded per module.');
assert(guard.includes("if(type==='short-answer')return rubricRows(question).length>=2"),'Short-answer questions are still counted before rubric validation.');
assert(guard.includes("rubric:{type:'array',minItems:2,maxItems:5"),'Short-answer recovery schema does not require a usable rubric.');
assert(guard.includes("required:['id','label','points','role','required']"),'Rubric criterion schema is not explicit enough for downstream normalization.');
assert(guard.includes("type:{type:'string',enum:[type]}"),'Recovery schema does not pin the requested question type.');
assert(guard.includes("purpose:REPAIR_PURPOSE"),'Malformed quiz rows do not trigger a dedicated contract-repair request.');
assert(guard.includes('maxRepairAttempts:1'),'Dedicated contract repair must not start another nested structured-output retry loop.');
assert(guard.includes('The schema is a hard persistence contract, not a suggestion.'),'Short-answer recovery prompt does not explain the persistence contract.');
assert(guard.includes("if(!validQuestion(question))continue"),'Initial supplemental rows are still counted before full validation.');
assert(guard.includes('attempts<MAX_REPAIRS_PER_MODULE'),'Quiz completion does not enforce the bounded per-module repair ceiling.');
assert(!guard.includes('attempts<12'),'The old twelve-attempt repair loop is still reachable.');
assert(guard.includes("const type=missing[0]||REQUIRED_TYPES"),'Repair does not prioritize a still-missing required type.');
assert(guard.includes("question&&typeOf(question)===type"),'A recovery call can still satisfy itself with the wrong question type.');
assert(guard.includes('nestedLegacyLoopBypassed:true'),'Bounded quiz contract does not declare that the v262 nested loop is bypassed.');
assert(guard.includes('config:boundedConfig(request?.config,9000)'),'Type-specific repairs do not carry a hard provider deadline.');

assert(entry.includes("../../living-school-quiz-contract-guard-v263.mjs?v=bounded-short-answer-v266"),'Living School does not cache-bust the bounded quiz contract guard.');
assert(entry.includes("../../living-school-deadline-guard-v266.mjs?v=provider-deadlines-v266"),'Living School does not load the provider deadline guard.');
assert(entry.includes('await installLivingSchoolQuizContractGuardV263()'),'Living School does not install the quiz contract guard after the v262 generation guard.');
assert(entry.includes('await installLivingSchoolDeadlineGuardV266()'),'Living School does not install hard provider deadlines after the quiz guard.');
assert(entry.includes("quizIntegrity:'ai-only-v266-bounded-short-answer-contract'"),'Living School does not expose the bounded AI-only quiz integrity revision.');
assert(index.includes('v266-bounded-deadlines'),'Living School entry does not cache-bust the bounded quiz/deadline repair.');
assert(actions.includes("if(type==='short-answer'&&!rubric.length)return null"),'Final downstream normalizer no longer enforces a visible short-answer rubric.');
assert(deadlines.includes("['living-school-quiz-delta-completion-v258',10000]"),'Quiz completion does not receive a hard top-level provider deadline.');

console.log(JSON.stringify({ok:true,revision:'living-school-quiz-contract-v266-bounded',validatesBeforeCounting:true,shortAnswerRubricRequired:true,typePinnedRecovery:true,maxRepairsPerModule:3,nestedLegacyLoopBypassed:true,providerDeadline:true,finalNormalizerStillStrict:true},null,2));