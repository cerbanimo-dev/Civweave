(()=>{
'use strict';
const VERSION='1.4.0-living-school-grounded-design-v341-effort-hours';
const ID='living-school-grounded-design-v337';
const DESIGN='living-school-research-grounded-curriculum-v218.1';
const MODES=new Set(['live-agentic','local-synthesized','local-downloaded','manual-sources','model-derived-unverified']);
// This sanitizer is application-side only. The model is not told Civweave currency/reward names.
const ECONOMY=/\b(?:Acorns?|Buttons?|XP|curriculum\s+(?:package\s+)?valuation|labor\s+worth|labour\s+worth|skill\s+ledger|completion\s+grant|reward\s+contract|wage\s+valuation|ledger\s+metadata|payouts?|wages?|currency\s+values?|bonuses?|grants?|prices?|pricing|monetary\s+value|compensation)\b/i;
const clean=(value,max=64000)=>String(value??'').trim().slice(0,max);
const lower=value=>clean(value,220).toLowerCase();
function sanitize(text){const rows=clean(text).split(/\r?\n/),kept=[];let removed=0;for(const row of rows){if(ECONOMY.test(row)){removed++;continue}kept.push(row)}return{text:kept.join('\n').replace(/\n{3,}/g,'\n\n').trim(),removed}}
const ASSESSMENT_CONTRACT=[
  'Assessment authoring boundary: every module assessment must test the subject itself, not the curriculum document.',
  'Write Assessment Intent as a concrete learner-facing question or task that could be shown verbatim to the learner.',
  'Never phrase an assessment as "evaluate/assess/verify the learner’s ability", "show understanding", "demonstrate the objective", "identify what the module taught", or any question about modules, lesson blocks, rubrics, source packets, curriculum structure, or assessment mechanics.',
  'Prefer domain verbs such as identify, compare, distinguish, choose, diagnose, calculate, plan, design, explain, or apply.',
  'Bad: "Evaluate the learner’s ability to categorize project goals based on the gardening/farming distinction."',
  'Good: "Given three proposed garden sites, classify each as leisure/aesthetic or production-focused and justify each classification using the gardening/farming distinction."',
  'Bad: "Assess whether the learner understands controlled environments."',
  'Good: "A vacant urban lot has limited space and poor weather protection. Choose an appropriate controlled-environment approach and explain why it fits the site."'
].join(' ');
const LONG_FORM_CONTRACT=[
  'LONG-FORM INSTRUCTION IS REQUIRED. This is not an outline, executive summary, slide deck, or list of talking points.',
  'Each Lesson Block must be connected instructional prose in full sentences, normally 2-4 substantive paragraphs and roughly 180-320 words when the supplied evidence supports that depth.',
  'A one-sentence block, a paragraph-sized bullet, or a list of claims without explanation is invalid even if the headings are present.',
  'Develop the teaching: explain definitions and mechanisms, make meaningful distinctions, work through concrete examples, discuss tradeoffs and common mistakes or failure modes, and state practical consequences where the source material supports them.',
  'Do not compress later modules merely to fit the response. Keep all requested modules comparably developed.',
  'When the supplied sources do not support a detail that would improve the explanation, either omit it or clearly mark the instructional inference GENERATED-UNVERIFIED; never manufacture a source-backed fact to create length.',
  'Use bullets only for compact Concepts or Practice Steps. The actual Lesson Block teaching must be prose.',
  'Estimate learner/labor effort in hours for each module. This is a time estimate only, used by the application to compare workload across learning paths; do not convert those hours into any monetary, exchange, reward, compensation, or ledger value.'
].join(' ');
const FORMAT_CONTRACT=[
  'Use this exact instructional-design shape for every module so the compiler can preserve the teaching without inventing filler. Keep the labels and bold Lesson Block heading syntax exactly as shown:',
  '## Module N: Specific subject title',
  'Objective: one observable subject skill.',
  'Why It Matters: 1-3 sentences explaining a real consequence, decision, or use of this knowledge. Do not mention the curriculum, module machinery, evidence workflow, or Civweave.',
  'Estimated Effort: a realistic learner/labor time estimate in hours, such as 1.5-2 hours. Estimate time only; do not attach any value, price, reward, compensation, or currency to it.',
  'Concepts:',
  '- Term — concise definition that is not copied verbatim from a lesson block.',
  '- Term — concise definition.',
  '- Term — concise definition.',
  '**Lesson Block 1: Specific heading.**',
  'Write 2-4 connected paragraphs of long-form teaching. Normally target 180-320 words. Explain the idea rather than naming it. Attach supplied source IDs only to claims they support; use GENERATED-UNVERIFIED only for unsupported inference.',
  '**Lesson Block 2: Specific heading.**',
  'Write another 2-4 connected paragraphs that teach a distinct idea rather than restating Lesson Block 1. Include concrete examples, distinctions, mechanisms, tradeoffs, or failure modes where appropriate.',
  '**Lesson Block 3: Specific heading.**',
  'Write another 2-4 connected paragraphs that deepen the subject and connect it to realistic use. Do not collapse this block into a summary bullet.',
  'Exercise: one authentic task that applies the subject in a concrete situation.',
  'Practice Steps:',
  '1. concrete subject action',
  '2. concrete subject action',
  '3. concrete subject action',
  'Assessment Intent: one learner-facing subject question or scenario satisfying the assessment contract.',
  'Remediation Focus: name the concepts or relationships to revisit after an incorrect answer; do not say merely “review the module.”',
  'Video Search Topic: plain-text subject search phrase only.',
  'Do not repeat concept definitions as lesson prose. Do not append generic learning-application sentences. Do not write generic instructions about recording evidence, uncertainty, revision, provenance, or completion unless those are genuinely the subject being learned.'
].join('\n');
function install(){
  const spine=globalThis.CivweaveFastInteractiveV192;if(!spine?.register)return false;
  spine.unregister?.('living-school-grounded-design-v333');spine.unregister?.(ID);
  spine.register(ID,{
    before(request){
      if(lower(request?.purpose)!==DESIGN||!MODES.has(lower(request?.context?.research?.mode)))return request;
      const messages=[...(Array.isArray(request.messages)?request.messages:[]),{role:'system',content:`The research/evidence pass is complete. This is the single strong instructional-design pass for this curriculum run. Produce instructional design only. Estimate learner/labor effort in hours, but do not produce any monetary, exchange, compensation, reward, pricing, payout, or ledger valuation metadata. Use a SOURCE_ID only for claims actually supported by that source passage. Unsupported material must be marked GENERATED-UNVERIFIED with no SOURCE_ID. Do not output media URLs; provide only plain-text video search topics. ${LONG_FORM_CONTRACT} ${ASSESSMENT_CONTRACT}\n\n${FORMAT_CONTRACT}`}];
      return{...request,purpose:DESIGN,taskTier:'complex',executionProfile:'interactive',messages,context:{...(request.context||{}),livingSchoolOriginalPurpose:DESIGN,livingSchoolGroundedDesign:true,livingSchoolSingleStrongDesign:true,applicationOwnedEconomyBoundary:true,learnerFacingAssessmentContract:true,longFormInstructionRequired:true,effortHoursRequired:true,effortHoursAreNonValuation:true,pedagogyFormatContract:'subject-mastery-long-form-v2'}};
    },
    after(result,request){
      if(lower(request?.purpose)!==DESIGN||result?.status!=='success')return result;
      const raw=clean(result?.outputText||result?.text||result?.output||'');if(!raw)return result;
      const bounded=sanitize(raw);
      if(!bounded.text)return{...result,status:'invalid-response',outputText:'',outputJson:undefined,error:{code:'LIVING_SCHOOL_GROUNDED_DESIGN_EMPTY_AFTER_BOUNDARY',message:'Living School removed provider-authored valuation metadata and no instructional design remained.'}};
      return{...result,outputText:bounded.text,diagnostics:[...(result.diagnostics||[]),'Living School kept the single strong design pass on the canonical curriculum-design purpose, required long-form subject teaching, and allowed effort hours only as non-valued workload metadata.',...(bounded.removed?[`Living School removed ${bounded.removed} provider-authored valuation/reward line${bounded.removed===1?'':'s'} before storing grounded design.`]:[])]};
    }
  },170);
  try{dispatchEvent(new CustomEvent('civweave:living-school-grounded-design-ready',{detail:{version:VERSION,purpose:DESIGN,singleStrongDesign:true,applicationOwnedEconomyBoundary:true,learnerFacingAssessmentContract:true,longFormInstructionRequired:true,effortHoursRequired:true,effortHoursAreNonValuation:true,pedagogyFormatContract:'subject-mastery-long-form-v2',at:new Date().toISOString()}}))}catch{}
  return true;
}
for(const event of ['civweave:runtime-spine-ready','civweave:gemini-task-router-ready','civweave:living-school-runtime-route-ready'])addEventListener?.(event,()=>queueMicrotask(install));
install();
globalThis.CivweaveLivingSchoolGroundedDesignV337=Object.freeze({version:VERSION,install,purpose:DESIGN,sanitize,assessmentContract:ASSESSMENT_CONTRACT,longFormContract:LONG_FORM_CONTRACT,formatContract:FORMAT_CONTRACT,singleStrongDesign:true,effortHoursRequired:true,effortHoursAreNonValuation:true});
})();