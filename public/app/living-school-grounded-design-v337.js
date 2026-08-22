(()=>{
'use strict';
const VERSION='1.1.1-living-school-grounded-design-v338-pedagogy';
const ID='living-school-grounded-design-v337';
const DESIGN='living-school-research-grounded-curriculum-v218.1';
const GROUNDED='living-school-grounded-design-lite-v337';
const MODES=new Set(['live-agentic','local-synthesized','local-downloaded','manual-sources','model-derived-unverified']);
const ECONOMY=/\b(?:Acorns?|Buttons?|XP|curriculum\s+(?:package\s+)?valuation|labor\s+worth|labour\s+worth|skill\s+ledger|completion\s+grant|reward\s+contract|wage\s+valuation|ledger\s+metadata|payouts?|wages?|currency\s+values?|bonuses?|grants?)\b/i;
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
const FORMAT_CONTRACT=[
  'Use this exact instructional-design shape for every module so the compiler can preserve the teaching without inventing filler. Keep the labels and bold Lesson Block heading syntax exactly as shown:',
  '## Module N: Specific subject title',
  'Objective: one observable subject skill.',
  'Why It Matters: 1-3 sentences explaining a real consequence, decision, or use of this knowledge. Do not mention the curriculum, module machinery, evidence workflow, or Civweave.',
  'Concepts:',
  '- Term — concise definition that is not copied verbatim from a lesson block.',
  '- Term — concise definition.',
  '- Term — concise definition.',
  '**Lesson Block 1: Specific heading.**',
  'Teach the idea in substantive prose. Explain definitions, mechanisms, distinctions, examples, tradeoffs, mistakes, or consequences as appropriate. Aim for at least 250 characters of useful teaching per lesson block. Attach supplied source IDs only to claims they support; use GENERATED-UNVERIFIED only for unsupported inference.',
  '**Lesson Block 2: Specific heading.**',
  'Teach a distinct idea rather than restating Lesson Block 1.',
  '**Lesson Block 3: Specific heading.**',
  'Teach a distinct idea and connect it to realistic use.',
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
      const messages=[...(Array.isArray(request.messages)?request.messages:[]),{role:'system',content:`The research/evidence pass is complete. Produce instructional design only. Never output Civweave economy or reward metadata. Do not output Acorns, Buttons, XP, grants, payouts, wages, pricing, labor valuation, currency values, ledger metadata, or a reward contract. Use a SOURCE_ID only for claims actually supported by that source passage. Unsupported material must be marked GENERATED-UNVERIFIED with no SOURCE_ID. Do not output media URLs; provide only plain-text video search topics. ${ASSESSMENT_CONTRACT}\n\n${FORMAT_CONTRACT}`}];
      return{...request,purpose:GROUNDED,taskTier:'small',executionProfile:'interactive',messages,context:{...(request.context||{}),livingSchoolOriginalPurpose:DESIGN,livingSchoolGroundedDesign:true,applicationOwnedEconomyBoundary:true,learnerFacingAssessmentContract:true,pedagogyFormatContract:'subject-mastery-v1'}};
    },
    after(result,request){
      if(lower(request?.purpose)!==GROUNDED||result?.status!=='success')return result;
      const raw=clean(result?.outputText||result?.text||result?.output||'');if(!raw)return result;
      const bounded=sanitize(raw);
      if(!bounded.text)return{...result,status:'invalid-response',outputText:'',outputJson:undefined,error:{code:'LIVING_SCHOOL_GROUNDED_DESIGN_EMPTY_AFTER_BOUNDARY',message:'Living School removed provider-authored economy metadata and no instructional design remained.'}};
      return{...result,outputText:bounded.text,diagnostics:[...(result.diagnostics||[]),'Living School required learner-facing subject-matter assessment wording and a compiler-safe subject-mastery design format.',...(bounded.removed?[`Living School removed ${bounded.removed} provider-authored economy/reward line${bounded.removed===1?'':'s'} before storing grounded design.`]:[])]};
    }
  },170);
  try{dispatchEvent(new CustomEvent('civweave:living-school-grounded-design-ready',{detail:{version:VERSION,purpose:GROUNDED,applicationOwnedEconomyBoundary:true,learnerFacingAssessmentContract:true,pedagogyFormatContract:'subject-mastery-v1',at:new Date().toISOString()}}))}catch{}
  return true;
}
for(const event of ['civweave:runtime-spine-ready','civweave:gemini-task-router-ready','civweave:living-school-runtime-route-ready'])addEventListener?.(event,()=>queueMicrotask(install));
install();
globalThis.CivweaveLivingSchoolGroundedDesignV337=Object.freeze({version:VERSION,install,purpose:GROUNDED,sanitize,assessmentContract:ASSESSMENT_CONTRACT,formatContract:FORMAT_CONTRACT});
})();