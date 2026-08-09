import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const [viewport,repairs,workspace,sharedLoader,sharedCore,entry,core,generationGuard,quizGuard,deadlineGuard,localResearch,localActions,knowledge,pkg]=await Promise.all([
  read('public/app/persistent-guide-viewport-v216.js'),read('public/app/regression-fixes-v243.js'),read('public/app/guide-workspace-v242.js'),
  read('public/app/shared-guide-surface-v236.js'),read('public/app/shared-guide-surface-v236-core-v244.js'),read('public/app/cabinets/living-school/living-school-cleanroom-v218.mjs'),
  read('public/app/cabinets/living-school/living-school-cleanroom-core-v218.mjs'),read('public/app/living-school-generation-guard-v262.mjs'),read('public/app/living-school-quiz-contract-guard-v263.mjs'),read('public/app/living-school-deadline-guard-v266.mjs'),
  read('public/app/living-school-local-research-v243.mjs'),read('public/app/living-school-cleanroom-actions-v243.mjs'),read('public/app/knowledge-school-runtime-v243.mjs'),read('package.json')
]);
const sharedGuide=`${sharedLoader}\n${sharedCore}`;

assert(viewport.includes("const REGRESSION_FIXES='/app/regression-fixes-v243.js?v=guide-interaction-r2'"));assert(viewport.includes('installRegressionFixes()'));assert(!viewport.includes('CHAT_OWNER_REPAIR')&&!viewport.includes('chat-single-owner-v245.js'));
assert(repairs.includes("dialog button[data-close]")&&repairs.includes("control.type='button'"));assert(!repairs.includes("document.addEventListener('pointerup',onPointerUp,true)"));assert(!repairs.includes('queueMicrotask(()=>control.click())');assert(repairs.includes('/app/assets/ai/kamiya-welcoming-v243.png'));assert((await stat(path.join(root,'public/app/assets/ai/kamiya-welcoming-v243.png'))).size>1000);

assert(workspace.includes("document.addEventListener('pointerdown',onPointerDownCapture,true)"));assert(workspace.includes('suppressClickUntil=performance.now()+500'));assert(workspace.includes('suppressedControl=switchControl||closeControl||minimizeControl'));assert(workspace.includes('if(closeControl)closeWorkspace();else toggleMinimize()'));assert(workspace.includes("if(switchControl){switchWindow(switchControl.dataset.cw242Window,{open:true});return}"));assert(workspace.includes("new CustomEvent('civweave:guide-workspace-state'"));assert(workspace.includes('submitText:async(text,system=activeWindow)'));assert(workspace.includes('canonicalOwner:true'));
assert(sharedLoader.includes('/app/shared-guide-surface-v236-core-v244.js'));assert(sharedGuide.includes('await api.submitText(value,currentSystem)'));assert(!sharedGuide.includes('form.requestSubmit()'));assert(!sharedGuide.includes("api.open?.({guide:currentSystem,prefill:value})"));assert(sharedGuide.includes('syncInlineVisibility'));assert(sharedGuide.includes("addEventListener('civweave:guide-workspace-state'"));assert(!sharedGuide.includes('input.focus();'));

assert(entry.includes("../../living-school-cleanroom-actions-v243.mjs?v=quiz-integrity-v261"));
assert(entry.includes("../../living-school-generation-guard-v262.mjs?v=source-prompt-quiz-delta-v262"));
assert(entry.includes("../../living-school-quiz-contract-guard-v263.mjs?v=bounded-short-answer-v266"),'Living School must load the bounded quiz contract.');
assert(entry.includes("../../living-school-deadline-guard-v266.mjs?v=provider-deadlines-v266"),'Living School must load provider deadlines.');
assert(entry.includes('await installLivingSchoolGenerationGuard()'));assert(entry.includes('await installLivingSchoolQuizContractGuardV263()'));assert(entry.includes('await installLivingSchoolDeadlineGuardV266()'));assert(entry.includes('sanitizeSavedHybridQuiz()'));
assert(entry.includes("quizIntegrity:'ai-only-v266-bounded-short-answer-contract'"));
assert(localActions.includes("packet.mode==='local-downloaded'"));assert(localActions.includes('await researchCapability(data.capability,{force:false})'));assert(localActions.includes('stripLegacyFallbackQuestions'));assert(localActions.includes("provider==='deterministic'"));assert(!localActions.includes("data.modelRoute!=='shared'||school.generation?.fallback"));assert(localActions.includes("quizIntegrity:'ai-only-complete'"));

const aiStart=core.indexOf('export function normalizeAIQuiz'),deterministicStart=core.indexOf('export function normalizeDeterministicQuiz'),moduleStart=core.indexOf('export function normalizeModule');
assert(aiStart>=0&&deterministicStart>aiStart&&moduleStart>deterministicStart);const aiNormalizer=core.slice(aiStart,deterministicStart),deterministicNormalizer=core.slice(deterministicStart,moduleStart);
assert(!aiNormalizer.includes('quizBank('));assert(!aiNormalizer.includes('while(rows.length<count+2)'));assert(aiNormalizer.includes('isDeterministicQuizQuestion'));assert(deterministicNormalizer.includes('quizBank(')&&deterministicNormalizer.includes('while(rows.length<count+2)'));assert(core.includes("quizMode==='deterministic'?normalizeDeterministicQuiz")&&core.includes(":normalizeAIQuiz(source.quiz,index)"));assert(core.includes("const quizMode=provider==='deterministic'||next.school?.generation?.fallback?'deterministic':'ai'"));assert(core.includes("normalizeModule(item,index,data.capability,'ai')"));assert(core.includes('refusing deterministic module padding'));

for(const token of ["const REVISION='living-school-generation-guard-v262'","'CURRICULUM SOURCE MATERIAL'","'DOWNLOADED LOCAL SCHOOL PASSAGES'",'The source material above is already in this prompt.','Preserve each SOURCE_ID exactly','600-1000 words of useful instruction per module',"purpose!=='living-school-quiz-delta-completion-v258'","quizDeltaMode:forceSingle?'single-question-recovery':'single-module-iterative'",'Return exactly ${needed}','questions.minItems=Math.max(1,count)','livingSchoolGenerationGuardRevision:REVISION','moduleNeedsDepth',"purpose:'living-school-module-depth-expansion-v262'",'moduleDepthRepair:true'])assert(generationGuard.includes(token),`Generation guard missing ${token}.`);
assert(generationGuard.includes("purpose!=='living-school-live-source-research-v260'"));assert(generationGuard.includes('800-2500 characters of useful source-grounded notes'));assert(generationGuard.includes('forceSingle=true'));assert(!generationGuard.includes('fetch(source.url')&&!generationGuard.includes('fetch(source?.url'));

for(const token of ["const REVISION='living-school-quiz-contract-guard-v266-bounded'","const PRIMARY_PURPOSE='living-school-quiz-contract-primary-v266'",'const MAX_REPAIRS_PER_MODULE=3','attempts<MAX_REPAIRS_PER_MODULE','nestedLegacyLoopBypassed:true',"if(type==='short-answer')return rubricRows(question).length>=2",'maxRepairAttempts:1'])assert(quizGuard.includes(token),`Bounded quiz guard missing ${token}.`);
assert(!quizGuard.includes('attempts<12'),'Old twelve-attempt quiz repair loop must be unreachable.');
for(const token of ["const REVISION='living-school-deadline-guard-v266'","['living-school-live-source-research-v260',15000]","['living-school-research-grounded-curriculum-v218.1',30000]","['living-school-quiz-delta-completion-v258',10000]",'livingSchoolDeadlineGuardRevision:REVISION'])assert(deadlineGuard.includes(token),`Deadline guard missing ${token}.`);

assert(localResearch.includes('searchDownloadedKnowledge'));assert(localResearch.includes("provenance:'knowledge-school-downloaded'"));assert(localResearch.includes('ARCHIVE VERIFIED · NOT LIVE-CHECKED'));assert(localResearch.includes('dependency-free cached SQLite passage search'));assert(localResearch.includes('canonicalUrl'));
for(const token of ['openSeed(slug)','DecompressionStream','databaseBundle','extractArticleMetadata','canonicalNearHit','findPassages','windows-1252','SQLite format 3','dependency-free-sqlite-byte-search'])assert(knowledge.includes(token),`Offline knowledge reader missing ${token}.`);
const parsed=JSON.parse(pkg),dependencies=Object.entries(parsed.dependencies||{});assert.equal(dependencies.length,1);assert.equal(parsed.dependencies?.['onnxruntime-web'],'1.27.0');assert(!('sql.js' in (parsed.dependencies||{})));assert(!String(parsed.scripts?.prestart||'').includes('sqljs'));

console.log(JSON.stringify({ok:true,revision:'v243.8-bounded-living-school-v266',singleInteractiveChatSurface:true,sourceMaterialInjectedIntoPrompt:true,moduleDepthRepair:true,boundedQuizRepair:true,maxQuizRepairsPerModule:3,providerDeadlines:true,aiQuizFillersForbidden:true,aiDeterministicQuizPathsSeparated:true,savedHybridQuizSanitized:true,deterministicModulePaddingForbiddenInAI:true,productionDependencyCount:dependencies.length,provenanceExplicit:true},null,2));
