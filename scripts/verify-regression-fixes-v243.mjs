import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFile(path.join(root,relative),'utf8');
const exists=relative=>access(path.join(root,relative)).then(()=>true,()=>false);
const [repairs,workspace,sharedLoader,sharedCore,entry,core,generationGuard,localResearch,localActions,knowledge,pkg]=await Promise.all([
  read('public/app/regression-fixes-v243.js'),
  read('public/app/guide-workspace-v242.js'),
  read('public/app/shared-guide-surface-v236.js'),
  read('public/app/shared-guide-surface-v236-core-v244.js'),
  read('public/app/cabinets/living-school/living-school-cleanroom-v218.mjs'),
  read('public/app/cabinets/living-school/living-school-cleanroom-core-v218.mjs'),
  read('public/app/living-school-generation-guard-v262.mjs'),
  read('public/app/living-school-local-research-v243.mjs'),
  read('public/app/living-school-cleanroom-actions-v243.mjs'),
  read('public/app/knowledge-school-runtime-v243.mjs'),
  read('package.json')
]);
const sharedGuide=`${sharedLoader}\n${sharedCore}`;

assert.equal(await exists('public/app/persistent-guide-viewport-v216.js'),false,'Retired viewport compatibility runtime must remain deleted.');
assert.equal(await exists('public/app/chat-single-owner-v245.js'),false,'Retired chat owner must remain deleted.');
assert(repairs.includes("target?.closest?.('dialog [data-close]')")&&repairs.includes('runtimeImageRepair:false'),'Regression compatibility must delegate existing dialog controls without repairing presentation.');
assert(!repairs.includes('createElement('),'Regression compatibility must not inject missing UI controls.');
assert(!repairs.includes('MutationObserver'),'Regression compatibility must not watch the DOM for presentation repair.');
assert(!repairs.includes("document.addEventListener('pointerup',onPointerUp,true)"),'Retired pointerup relay is still installed.');
assert(!repairs.includes('queueMicrotask(()=>control.click())'),'Synthetic chat click relay is still present.');
assert(!repairs.includes('/app/assets/ai/kamiya-welcoming-v243.png')&&!repairs.includes('/app/assets/ai/kamiya.png'),'Regression compatibility must not substitute Kamiya artwork.');

assert(workspace.includes("document.addEventListener('pointerdown',onPointerDownCapture,true)"),'Canonical workspace does not own pointer-down gestures.');
assert(workspace.includes('suppressClickUntil=performance.now()+500'),'Workspace does not suppress the targeted compatibility click after a handled pointer gesture.');
assert(workspace.includes('suppressedControl=switchControl||closeControl||minimizeControl'),'Compatibility click suppression is not scoped to the control that owned pointerdown.');
assert(workspace.includes('if(closeControl)closeWorkspace();else toggleMinimize()'),'Close/minimize gestures do not invoke canonical workspace state directly.');
assert(workspace.includes("if(switchControl){switchWindow(switchControl.dataset.cw242Window,{open:true});return}"),'Persona pointer gesture does not invoke canonical workspace switching directly.');
assert(workspace.includes("new CustomEvent('civweave:guide-workspace-state'"),'Workspace does not publish canonical workspace state.');
assert(workspace.includes('submitText:async(text,system=activeWindow)'),'Canonical direct text submission API is missing.');
assert(workspace.includes('canonicalOwner:true'),'Workspace does not advertise canonical ownership.');
assert(workspace.includes('globalThis.visualViewport?.addEventListener'),'Canonical workspace does not own mobile viewport resize.');
assert(workspace.includes('height:min(62dvh,560px)!important'),'Canonical workspace lost mobile dynamic-height sizing.');
assert(!workspace.includes('CHAT_OWNER_REPAIR')&&!workspace.includes('chat-single-owner-v245.js'),'Canonical workspace resurrects a second owner.');

assert(sharedLoader.includes('/app/shared-guide-surface-v236-core-v244.js'),'Shared guide loader no longer mounts the canonical bubble-only implementation.');
assert(sharedGuide.includes('await api.submitText(value,currentSystem)'),'Shared guide submission helper does not submit directly through the canonical chat API.');
assert(!sharedGuide.includes('form.requestSubmit()'),'Shared guide still tunnels submission through the hidden floating form.');
assert(!sharedGuide.includes("api.open?.({guide:currentSystem,prefill:value})"),'Shared guide still opens the full composer as a submission side effect.');
assert(sharedCore.includes("mode:'bubble-only'"),'Shared guide surface must remain bubble-only.');
assert(sharedCore.includes('function buildInline(){return false}'),'Retired inline guide cards can be rebuilt.');
assert(sharedCore.includes('function syncInlineVisibility(){return false}'),'Retired inline visibility path must stay inert.');
assert(sharedCore.includes('function removeEmbeddedGuideCards(){return false}'),'Embedded guide card cleanup must remain a no-op because source markup owns absence.');
assert(!sharedCore.includes('new MutationObserver'),'Shared guide must not repeatedly delete presentation after paint.');
assert(sharedCore.includes("document.documentElement.dataset.civweaveGuideSurfaceMode='bubble-only'"),'Bubble-only state is not exposed for page-level coordination.');
assert(!sharedGuide.includes('input.focus();'),'Shared guide still forces keyboard focus after submission.');

assert(entry.includes("../../living-school-cleanroom-actions-v243.mjs?v=quiz-integrity-v261"),'Living School is not cache-busting the AI-only quiz integrity adapter.');
assert(entry.includes("../../living-school-generation-guard-v262.mjs?v=source-prompt-quiz-delta-v262"),'Living School does not load the source-injection and iterative quiz guard.');
assert(entry.includes("../../living-school-quiz-contract-guard-v263.mjs?v=short-answer-rubric-v263"),'Living School does not load the short-answer quiz contract guard.');
assert(entry.includes('await installLivingSchoolGenerationGuard()'),'Living School does not install the generation guard before actions run.');
assert(entry.includes('await installLivingSchoolQuizContractGuardV263()'),'Living School does not install the v263 quiz contract guard.');
assert(entry.includes('sanitizeSavedHybridQuiz()'),'Living School does not sanitize saved mixed-provenance quiz banks at startup.');
assert(entry.includes("quizIntegrity:'ai-only-v263-short-answer-contract'"),'Living School does not expose the current AI-only quiz integrity revision.');
assert(localActions.includes("packet.mode==='local-downloaded'"),'Living School actions do not recognize downloaded research.');
assert(localActions.includes('await researchCapability(data.capability,{force:false})'),'Curriculum generation does not research before generation.');
assert(localActions.includes('stripLegacyFallbackQuestions'),'AI curriculum generation does not strip deterministic quiz fillers.');
assert(localActions.includes("provider==='deterministic'"),'Quiz completion does not distinguish the actual deterministic compiler from AI providers.');
assert(!localActions.includes("data.modelRoute!=='shared'||school.generation?.fallback"),'Quiz integrity is still incorrectly gated on the literal shared route string.');
assert(localActions.includes("quizIntegrity:'ai-only-complete'"),'Successful supplemental quiz completion is not marked AI-only.');

const aiStart=core.indexOf('export function normalizeAIQuiz'),deterministicStart=core.indexOf('export function normalizeDeterministicQuiz'),moduleStart=core.indexOf('export function normalizeModule');
assert(aiStart>=0&&deterministicStart>aiStart&&moduleStart>deterministicStart,'Living School does not expose physically separate AI and deterministic quiz normalizers.');
const aiNormalizer=core.slice(aiStart,deterministicStart),deterministicNormalizer=core.slice(deterministicStart,moduleStart);
assert(!aiNormalizer.includes('quizBank('),'AI quiz normalization can still reach the deterministic quiz bank.');
assert(!aiNormalizer.includes('while(rows.length<count+2)'),'AI quiz normalization can still synthesize filler questions.');
assert(aiNormalizer.includes('isDeterministicQuizQuestion'),'AI quiz normalization does not reject deterministic question provenance.');
assert(deterministicNormalizer.includes('quizBank(')&&deterministicNormalizer.includes('while(rows.length<count+2)'),'Deterministic quiz normalization no longer owns its offline filler behavior.');
assert(core.includes("quizMode==='deterministic'?normalizeDeterministicQuiz")&&core.includes(":normalizeAIQuiz(source.quiz,index)"),'Module normalization does not route quiz provenance explicitly.');
assert(core.includes("const quizMode=provider==='deterministic'||next.school?.generation?.fallback?'deterministic':'ai'"),'Saved curriculum normalization does not select quiz behavior from actual generation provenance.');
assert(core.includes("normalizeModule(item,index,data.capability,'ai')"),'Shared AI curriculum generation is not locked to the AI quiz normalizer.');
assert(core.includes('refusing deterministic module padding'),'Shared AI generation can still silently pad missing modules with the deterministic compiler.');

for(const token of [
  "const REVISION='living-school-generation-guard-v262'",
  "'CURRICULUM SOURCE MATERIAL'",
  "'DOWNLOADED LOCAL SCHOOL PASSAGES'",
  'The source material above is already in this prompt.',
  'Preserve each SOURCE_ID exactly',
  '600-1000 words of useful instruction per module',
  "purpose!=='living-school-quiz-delta-completion-v258'",
  "quizDeltaMode:forceSingle?'single-question-recovery':'single-module-iterative'",
  'Return exactly ${needed}',
  'questions.minItems=Math.max(1,count)',
  'livingSchoolGenerationGuardRevision:REVISION',
  'moduleNeedsDepth',
  "purpose:'living-school-module-depth-expansion-v262'",
  'moduleDepthRepair:true'
])assert(generationGuard.includes(token),`Living School generation guard is missing ${token}.`);
assert(generationGuard.includes("purpose!=='living-school-live-source-research-v260'"),'Antigravity evidence-digest strengthening is missing.');
assert(generationGuard.includes('800-2500 characters of useful source-grounded notes'),'Live research does not request enough source material for downstream curriculum synthesis.');
assert(generationGuard.includes("forceSingle=true"),'Quiz delta completion cannot degrade to one-question recovery after a structured-output miss.');
assert(!generationGuard.includes('fetch(source.url')&&!generationGuard.includes('fetch(source?.url'),'Curriculum generation guard must inject supplied source text rather than refetching sources.');

assert(localResearch.includes('searchDownloadedKnowledge'),'Downloaded knowledge is not queried.');
assert(localResearch.includes("provenance:'knowledge-school-downloaded'"),'Downloaded-source provenance is missing.');
assert(localResearch.includes('ARCHIVE VERIFIED · NOT LIVE-CHECKED'),'Downloaded references overstate or omit verification status.');
assert(localResearch.includes('dependency-free cached SQLite passage search'),'Local research does not report the dependency-free reader.');
assert(localResearch.includes('canonicalUrl'),'Downloaded research no longer carries canonical article links.');

for(const token of ['openSeed(slug)','DecompressionStream','databaseBundle','extractArticleMetadata','canonicalNearHit','findPassages','windows-1252','SQLite format 3','dependency-free-sqlite-byte-search'])assert(knowledge.includes(token),`Offline knowledge reader is missing ${token}.`);
const parsed=JSON.parse(pkg),dependencies=Object.entries(parsed.dependencies||{});
assert.equal(dependencies.length,2,'v243 must preserve Civweave’s two pinned production runtime dependencies.');
assert.equal(parsed.dependencies?.['onnxruntime-web'],'1.27.0','Pinned ONNX Runtime dependency changed unexpectedly.');
assert.equal(parsed.dependencies?.['@huggingface/transformers'],'3.8.1','Pinned Transformers.js dependency changed unexpectedly.');
assert(!('sql.js' in (parsed.dependencies||{})),'Local knowledge search must not add sql.js to production dependencies.');
assert(!String(parsed.scripts?.prestart||'').includes('sqljs'),'Normal startup must not stage a second database runtime.');

console.log(JSON.stringify({ok:true,revision:'v243.11-source-truth-v1',proofDialogControlsSourceOwned:true,syntheticClickRelay:false,pointerControlsOwnedByWorkspace:true,personaPointerOwnedByWorkspace:true,singleInteractiveChatSurface:true,directGuideSubmit:true,sharedGuideBubbleOnly:true,embeddedGuideCardsSourceAbsent:true,forcedKeyboardRefocus:false,kamiyaRuntimeSubstitution:false,retiredViewportDeleted:true,downloadedKnowledgeQueryable:true,downloadedResearchBeforeModelFallback:true,dependencyFreeLocalReader:true,canonicalArticleLinks:true,sourceMaterialInjectedIntoPrompt:true,localPassagesInjectedIntoPrompt:true,liveEvidenceDigestStrengthened:true,moduleDepthRepair:true,iterativePerModuleQuizCompletion:true,singleQuestionQuizRecovery:true,shortAnswerContractGuard:true,aiQuizFillersForbidden:true,aiDeterministicQuizPathsSeparated:true,savedHybridQuizSanitized:true,deterministicModulePaddingForbiddenInAI:true,productionDependencyCount:dependencies.length,localAIRuntimePinned:true,provenanceExplicit:true},null,2));