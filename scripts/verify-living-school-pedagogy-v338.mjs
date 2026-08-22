import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const [designSource,compilerSource,curatorSource,generationGuard,quizGuard,actionsSource,coreBase]=await Promise.all([
  read('public/app/living-school-grounded-design-v337.js'),
  read('public/app/living-school-grounded-compiler-v336.js'),
  read('public/app/living-school-assessment-curator-v337.js'),
  read('public/app/living-school-generation-guard-v262.mjs'),
  read('public/app/living-school-quiz-contract-guard-v263.mjs'),
  read('public/app/living-school-cleanroom-actions-v243.mjs'),
  read('public/app/cabinets/living-school/living-school-cleanroom-core-v218-base.mjs')
]);

for(const token of ['SUBJECT MASTERY FIRST','authentic use','plausible subject-matter misconceptions','structureQualityIssues'])assert(generationGuard.includes(token),`Generation guard is missing pedagogy contract token: ${token}`);
for(const token of ['subjectMasteryRequired:true','genericAssessmentRejected:true','plausibleDistractorsRequired:true'])assert(quizGuard.includes(token),`Quiz guard is missing subject-mastery enforcement: ${token}`);
for(const token of ['Assessment authoring boundary','Why It Matters','Practice Steps','**Lesson Block 1: Specific heading.**','Do not repeat concept definitions as lesson prose'])assert(designSource.includes(token),`Grounded design prompt is missing required authoring guidance: ${token}`);
assert(!compilerSource.includes('Learning application (GENERATED-UNVERIFIED): connect this point to the module objective'),'Compiler still contains the repetitive generic learning-application filler.');
assert(!compilerSource.includes('Which action best demonstrates completion of the module practice?'),'Compiler still contains the meta module-completion assessment.');
for(const token of ['LIVING_SCHOOL_DESIGN_LESSON_BLOCK_TOO_THIN','noGenericLessonPadding:true',"SCAFFOLD_PROVENANCE='deterministic-compiler'"])assert(compilerSource.includes(token),`Compiler is missing anti-filler behavior: ${token}`);
assert(curatorSource.includes("SCAFFOLD_PROVENANCE='deterministic-compiler'"),'Assessment curator does not mark compiler questions as temporary deterministic scaffolding.');
assert(curatorSource.includes('aiAssessmentRequiredBeforePersistence:true'),'Assessment curator does not expose the AI-before-persistence contract.');
assert(coreBase.includes('isDeterministicQuizQuestion')&&coreBase.includes('normalizeAIQuiz'),'Core normalization no longer strips deterministic quiz scaffolding from AI curriculum.');
assert(actionsSource.includes('stripLegacyFallbackQuestions(school)'),'Shared curriculum path no longer strips deterministic quiz scaffolding.');
assert(actionsSource.includes('return completeSharedQuizBank(data,school,options)'),'Shared curriculum path no longer completes the bank through the AI assessment pass.');

const registrations=[];
const context={
  console,Date,setTimeout,clearTimeout,
  queueMicrotask:fn=>fn(),
  addEventListener:()=>{},
  dispatchEvent:()=>{},
  CustomEvent:class CustomEvent{constructor(type,init){this.type=type;this.detail=init?.detail}},
  CivweaveFastInteractiveV192:{register:(id,handler,priority)=>registrations.push({id,handler,priority}),unregister:()=>{}}
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(compilerSource,context,{filename:'living-school-grounded-compiler-v336.js'});
vm.runInContext(curatorSource,context,{filename:'living-school-assessment-curator-v337.js'});
const compiler=context.CivweaveLivingSchoolGroundedCompilerV336;
const curator=context.CivweaveLivingSchoolAssessmentCuratorV337;
assert.equal(typeof compiler?.compile,'function','Grounded compiler compile API is unavailable.');
assert.equal(typeof curator?.curateQuiz,'function','Assessment curator API is unavailable.');

const paragraph=(topic,detail)=>`${topic} matters because ${detail}. In practice, the decision changes when site conditions, available labor, and intended outcomes change. A useful comparison considers the mechanism, the tradeoff, and the consequence of choosing the wrong approach. This explanation is intentionally substantive enough to teach the idea rather than merely naming it.`;
const sourceId='source-gardening';
const design=`## Module 1: Garden Purpose and Scale
Objective: Distinguish leisure-oriented gardening from production-focused cultivation and use the distinction to classify a proposed site.
Why It Matters: The intended purpose changes how a garden should be sized, maintained, and evaluated.
Concepts:
- Cultivation intent — The primary reason plants are grown, such as household use, community use, aesthetics, or production.
- Scale — The amount of space, labor, and output involved in a growing project.
- Production focus — A priority on reliable food output rather than primarily decorative or leisure goals.
**Lesson Block 1: Cultivation Intent.**
${paragraph('Cultivation intent','a project designed for household enjoyment makes different choices from one expected to supply regular produce')} SOURCE_ID: ${sourceId}
**Lesson Block 2: Scale and Labor.**
${paragraph('Scale and labor','larger or more production-focused sites require recurring labor, scheduling, and realistic yield expectations')} SOURCE_ID: ${sourceId}
**Lesson Block 3: Matching Site to Purpose.**
${paragraph('Matching site to purpose','a site should be judged against the actual goal instead of treated as suitable merely because plants can grow there')} SOURCE_ID: ${sourceId}
Exercise: Classify three proposed urban sites as leisure/aesthetic or production-focused and justify each classification from purpose, scale, and labor needs.
Practice Steps:
1. Identify the intended use of each site.
2. Compare the space and recurring labor available at each site.
3. Classify each site and justify the classification using the three concepts.
Assessment Intent: A neighborhood has a small courtyard tended by two volunteers and wants weekly produce for a food pantry. Is the stated production goal realistic for the site as described, and what additional information would you need before deciding?
Remediation Focus: Revisit the relationship among cultivation intent, scale, labor, and production expectations.
Video Search Topic: urban gardening scale production community garden`;
const request={context:{requestedModuleNumbers:[1],moduleCount:1,capability:'Plan an urban garden around realistic cultivation goals.',designPacket:design,sources:[{id:sourceId}]}};
const payload=compiler.compile(request);
const module=payload.module;
assert.equal(module.lessonBlocks.length,3,'Compiler did not preserve the three authored lesson blocks.');
assert(module.lessonBlocks.every(block=>block.content.length>=240),'Compiler produced a thin lesson block.');
const serialized=JSON.stringify(module);
assert(!serialized.includes('Learning application (GENERATED-UNVERIFIED)'), 'Compiled module contains generic learning-application filler.');
assert(!serialized.includes('grounded design packet'), 'Compiled learner-facing module leaks internal design-packet language.');
assert(!serialized.includes('assessment intent'), 'Compiled learner-facing module leaks assessment-authoring language.');
assert(!serialized.includes('reviewable evidence'), 'Compiled learner-facing module leaks evidence-workflow boilerplate.');
assert(module.practice.steps.some(step=>/cultivation|scale|labor|site/i.test(step)),'Practice steps are not anchored to the subject.');
assert(module.completionCriteria.every(row=>!/source-backed|generated-unverified|assessment intent/i.test(row)),'Completion criteria contain internal provenance or assessment-process language.');
assert(module.quiz.bank.every(question=>question.provenance==='deterministic-compiler'),'Compiler quiz bank is not marked as temporary deterministic scaffolding.');
assert(!module.quiz.bank.some(question=>/best demonstrates completion|skip the practice|confidence alone|invented citation|ignore the module objective/i.test(JSON.stringify(question))),'Compiler quiz contains known meta-assessment anti-patterns.');

const curated=curator.curateQuiz(module,1,'Classify a new site and explain the reasoning.',module.practice.prompt);
assert.equal(curated.bank.length,5,'Assessment curator no longer satisfies the temporary five-question structure contract.');
assert(curated.bank.every(question=>question.provenance==='deterministic-compiler'),'Curated temporary questions would survive AI curriculum normalization.');
assert(!curated.bank.some(question=>/best demonstrates completion|skip the practice|confidence alone|invented citation|ignore the module objective/i.test(JSON.stringify(question))),'Curator reintroduced a known meta-assessment anti-pattern.');

const thinDesign=design.replace(paragraph('Cultivation intent','a project designed for household enjoyment makes different choices from one expected to supply regular produce'),'Gardening can have different goals.');
assert.throws(()=>compiler.compile({...request,context:{...request.context,designPacket:thinDesign}}),error=>error?.code==='LIVING_SCHOOL_DESIGN_LESSON_BLOCK_TOO_THIN','Thin AI-authored lessons are padded or accepted instead of rejected.');

console.log(JSON.stringify({ok:true,revision:'living-school-pedagogy-v338',subjectMasteryPrompt:true,compilerFormatAligned:true,noCompilerPadding:true,noMetaCompletionQuiz:true,temporaryQuizScaffolding:true,aiQuizBeforePersistence:true,thinLessonRejected:true},null,2));