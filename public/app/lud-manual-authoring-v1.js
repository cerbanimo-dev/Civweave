(()=>{
'use strict';

const VERSION='1.3.0-templates';
const RECORD_SCHEMA='civweave.manual-artifact.v1';
const STORE_KEY='civweave.lud.manual-records.v1';
const MARKET_KEY='fellowfare.marketplace.v2';
const MARKET_DRAFT_KEY='civweave.fellowfare.listing-drafts.v1';
const CERBANIMO_KEY='cerbanimo.quest-engine.v144';
const LIVING_KEY='civweave.living-school.cabinet.v151';
const LOCAL_TYPES=Object.freeze({
  'learning-program':{label:'Learning program',target:'living-school'},
  'resource-manifest':{label:'Resource manifest',target:'fellowfare'},
  'skill-manifest':{label:'Skill manifest',target:'living-school'}
});
const CANONICAL_TYPES=Object.freeze({quest:'Quest',task:'Task','learning-module':'Learning module'});
const TYPE_OPTIONS=Object.freeze([
  ['quest','Cerbanimo Quest'],
  ['task','Cerbanimo task proposal'],
  ['learning-module','Living School module proposal'],
  ['learning-program','Learning program draft'],
  ['resource-manifest','Resource manifest'],
  ['skill-manifest','Skill manifest']
]);
const TEMPLATES=Object.freeze({
  quest:[
    {id:'build',label:'Build or make something',values:{title:'Build [thing]',objective:'Create a usable [thing] that [outcome].',description:'Who it is for: [people]\nConstraints: [budget, tools, time, accessibility]',steps:'Define the result and constraints\nGather materials, tools, or references\nBuild a first working version\nTest it with the people who will use it\nRevise and finish\nShare or hand off the result',acceptanceCriteria:'[Thing] performs its intended job\nThe intended user can use it\nKnown issues or limits are documented',proofRequirements:'Photo, file, link, or demo of the finished result\nShort note describing what was tested and changed',reward:'Completed artifact / community recognition',sequential:true}},
    {id:'event',label:'Organize an event or meetup',values:{title:'Organize [event]',objective:'Plan and run [event] for [people] on [date or window].',description:'Purpose: [why this gathering matters]\nLocation or format: [place / online]\nAccessibility or safety needs: [needs]',steps:'Confirm purpose, audience, and date\nSecure the place or online space\nInvite participants and share the plan\nPrepare materials, roles, and accessibility needs\nRun the event\nClose out, clean up, and capture follow-up',acceptanceCriteria:'Participants know where and when to attend\nRequired logistics and accessibility needs are covered\nThe event happens or is intentionally rescheduled\nFollow-up actions are recorded',proofRequirements:'Invite, flyer, calendar entry, or event page\nShort event recap and any agreed follow-up',reward:'Successful gathering / community recognition',sequential:true}},
    {id:'solve',label:'Solve a problem or make a repair',values:{title:'Solve [problem]',objective:'Identify the cause of [problem] and implement a safe, verified fix.',description:'Current symptoms: [what is happening]\nAffected people or systems: [who / what]\nConstraints or risks: [limits]',steps:'Reproduce or clearly describe the problem\nGather evidence and identify likely causes\nChoose the safest workable fix\nImplement the fix\nVerify the problem is resolved\nDocument the solution and remaining risks',acceptanceCriteria:'The original problem no longer occurs under the tested conditions\nThe fix does not introduce a known new blocker\nThe solution and any remaining limitations are documented',proofRequirements:'Before-and-after evidence\nTest results or verification notes\nRepair notes, patch, photo, or other artifact',reward:'Verified repair / problem solved',sequential:true}},
    {id:'community-support',label:'Help a person or community',values:{title:'Help [person or group] with [need]',objective:'Coordinate useful, consent-based support for [person or group] around [need].',description:'Need: [what would help]\nConsent / point of contact: [how support is coordinated]\nPrivacy or safety boundaries: [do not record sensitive details]',steps:'Confirm the need and consent to help\nIdentify useful resources or people\nCoordinate responsibilities and timing\nDeliver the agreed support\nCheck whether the need was met\nRecord only non-sensitive follow-up',acceptanceCriteria:'The requested support is delivered or a clear next step is agreed\nThe recipient confirms the support was useful or explains what remains\nPrivate or sensitive information is not exposed',proofRequirements:'Non-sensitive completion note\nReceipt, handoff confirmation, photo, or other proof only when appropriate',reward:'Community contribution / mutual-aid recognition',sequential:true}},
    {id:'research-decision',label:'Research and make a decision',values:{title:'Research and decide [question]',objective:'Gather enough reliable evidence to make and explain a decision about [question].',description:'Decision to make: [decision]\nWho is affected: [people]\nConstraints: [budget, deadline, values, requirements]',steps:'Define the decision criteria\nGather multiple relevant sources or options\nCompare options against the criteria\nCheck major risks, unknowns, and tradeoffs\nChoose a recommendation\nDocument the reasoning and next action',acceptanceCriteria:'At least [number] credible options or sources are considered\nTradeoffs and uncertainties are visible\nThe recommendation follows the stated criteria\nA next action is identified',proofRequirements:'Source list or comparison notes\nDecision memo, recommendation, or recorded rationale',reward:'Decision ready to act on',sequential:true}}
  ],
  task:[
    {id:'research',label:'Research / gather information',values:{title:'Research [question or topic]',description:'Find the information needed to answer [question] or unblock [decision].',owner:'[person or role]',acceptanceCriteria:'Relevant sources or evidence are collected\nKey findings are summarized\nOpen questions or uncertainties are listed',proofRequired:true}},
    {id:'build',label:'Build / implement',values:{title:'Build [component or deliverable]',description:'Create or implement [component] so that [outcome].',owner:'[person or role]',acceptanceCriteria:'The deliverable works for its intended use\nRequired edge cases or constraints are handled\nThe result is ready for review or handoff',proofRequired:true}},
    {id:'review',label:'Review / validate',values:{title:'Review [work or result]',description:'Check [work] against the agreed requirements and identify anything that still needs attention.',owner:'[reviewer or role]',acceptanceCriteria:'Acceptance criteria are checked one by one\nIssues are recorded with enough detail to reproduce or correct them\nA clear pass, revise, or blocked result is recorded',proofRequired:true}},
    {id:'coordinate',label:'Coordinate / outreach',values:{title:'Coordinate [people or resource]',description:'Contact and coordinate with [people] to arrange [outcome].',owner:'[person or role]',acceptanceCriteria:'The right participants are contacted\nTime, place, ownership, or handoff is agreed\nAny unresolved dependency has a named next step',proofRequired:false}}
  ],
  'learning-module':[
    {id:'concept',label:'Concept lesson',values:{title:'Understand [concept]',summary:'A focused introduction to [concept] and why it matters.',objective:'Explain [concept] in your own words and recognize when it applies.',relevance:'This matters because [real-world use or decision].',estimatedEffort:'45–60 minutes',artifact:'Short explanation, diagram, or annotated example',prerequisites:'[Any needed prior idea, or “None”]',learningObjectives:'Define [concept]\nRecognize a real example\nExplain the important parts\nConnect it to [related idea or use]',lessonBlocks:'What it is :: Define the concept in plain language\nHow it works :: Break the concept into its important parts\nExample :: Walk through one concrete example\nCommon mistakes :: Show likely misconceptions or failure modes\nConnection :: Relate the concept to the learner’s larger goal',practicePrompt:'Use the concept to explain or analyze [example].',practiceSteps:'Choose or inspect an example\nApply the concept step by step\nExplain what you noticed\nCorrect anything that did not fit',completionCriteria:'The learner can explain the concept without copying the lesson\nThe learner can identify a valid example\nThe learner can describe one limitation or common mistake',sources:'[Add source URLs or references here]'}},
    {id:'hands-on',label:'Hands-on practice',values:{title:'Practice [skill]',summary:'A guided practice session for [skill].',objective:'Perform [skill] safely and repeatably with decreasing guidance.',relevance:'This practice supports [larger capability or project].',estimatedEffort:'60–90 minutes',artifact:'Completed practice artifact, photo, recording, or output',prerequisites:'Basic familiarity with [tool or concept]\nRequired materials or software',learningObjectives:'Prepare the tools or environment\nPerform the core procedure\nRecognize a common failure mode\nRepeat the procedure with less guidance',lessonBlocks:'Setup :: Prepare tools, materials, and safety checks\nDemonstration :: Walk through the procedure once\nGuided attempt :: Complete the procedure with prompts\nTroubleshooting :: Diagnose common problems\nIndependent attempt :: Repeat the procedure with minimal guidance',practicePrompt:'Complete one full [skill] attempt from setup through verification.',practiceSteps:'Prepare the environment\nFollow the core procedure\nCheck the result\nIdentify one improvement\nRepeat if useful',completionCriteria:'The learner completes the procedure safely\nThe result meets the stated quality check\nThe learner can identify what to change on the next attempt',sources:'[Add source URLs, manuals, or references here]'}},
    {id:'project',label:'Project workshop',values:{title:'Build [project]',summary:'Learn by completing a small project that produces [artifact].',objective:'Plan, build, test, and explain a complete [project].',relevance:'The project combines the skills needed for [larger goal].',estimatedEffort:'2–4 hours',artifact:'Finished [project] plus a short reflection or demo',prerequisites:'[Required prior modules or skills]',learningObjectives:'Translate a goal into a small plan\nBuild a working first version\nTest against clear criteria\nRevise based on evidence\nExplain the final result',lessonBlocks:'Brief :: Define the project goal and constraints\nPlan :: Break the work into a small sequence\nBuild :: Produce a first working version\nTest :: Compare the result with the criteria\nRevise :: Improve the weakest part\nShare :: Demonstrate and explain the result',practicePrompt:'Complete the project using the brief, then test it against the criteria.',practiceSteps:'Write a short plan\nBuild the first version\nTest it\nMake at least one evidence-based revision\nPrepare a short demo or explanation',completionCriteria:'A complete artifact exists\nThe artifact meets the project criteria\nAt least one revision is based on testing or feedback\nThe learner can explain major choices and tradeoffs',sources:'[Add source URLs or references here]'}},
    {id:'reflection',label:'Review / reflection',values:{title:'Review and reflect on [topic or project]',summary:'Consolidate learning, identify gaps, and decide what to practice next.',objective:'Demonstrate what you can now do, explain remaining gaps, and choose a useful next step.',relevance:'Reflection turns completed work into a clearer picture of current capability.',estimatedEffort:'30–45 minutes',artifact:'Reflection note, portfolio annotation, or self-assessment',prerequisites:'Completion of [module, project, or practice period]',learningObjectives:'Recall the most important ideas\nDemonstrate one capability\nIdentify one remaining gap\nChoose a specific next practice step',lessonBlocks:'Recall :: Summarize the important ideas without notes\nDemonstrate :: Show one thing you can now do\nCompare :: Check the result against the original objective\nReflect :: Identify what was difficult or surprising\nNext step :: Choose the smallest useful follow-up practice',practicePrompt:'Review your work and write a concise capability check.',practiceSteps:'Summarize what you learned\nPoint to evidence from your work\nName one weakness or uncertainty\nChoose the next practice step',completionCriteria:'The reflection cites concrete evidence\nA remaining gap is identified without vague self-rating\nThe next step is specific and actionable',sources:'[Optional source URLs or references]'}}
  ],
  'learning-program':[
    {id:'practical-skill',label:'Learn a practical skill',values:{title:'Learn [practical skill]',purpose:'Become able to perform [skill] safely, independently, and to a useful real-world standard.',steps:'Learn the core concepts and safety rules\nWatch or study a correct demonstration\nPractice the basic procedure with guidance\nTroubleshoot common mistakes\nComplete an independent practice task\nUse the skill in one real project\nReview evidence and choose the next level',completionCriteria:'Complete the skill independently on a realistic task and explain the important safety, quality, and troubleshooting checks.',evidence:'Practice artifacts or photos\nCompleted real-world task\nChecklist or verification notes\nShort reflection on mistakes and improvements'}},
    {id:'project-path',label:'Project-based learning path',values:{title:'Learn [skill] by building [project]',purpose:'Develop [skill] by completing a sequence of increasingly complete project milestones.',steps:'Define the final project and success criteria\nLearn only the fundamentals needed for milestone 1\nBuild milestone 1\nLearn the next required concept or technique\nBuild milestone 2\nIntegrate the full project\nTest, revise, and present the result',completionCriteria:'Finish the project, meet the agreed criteria, and explain how the final work demonstrates the target skill.',evidence:'Milestone artifacts\nFinal project\nTest or feedback notes\nShort explanation of design choices and revisions'}},
    {id:'onboarding',label:'Onboarding / orientation',values:{title:'Get oriented to [system, role, or place]',purpose:'Become comfortable navigating [system or role], completing the essential first tasks, and knowing where to get help.',steps:'Understand the purpose and basic vocabulary\nLearn the main spaces, tools, or responsibilities\nComplete the first safe practice task\nLearn the common rules and escalation paths\nComplete one normal end-to-end task\nReview where to find help and references',completionCriteria:'Complete the essential workflow without step-by-step prompting and know where to find help for unfamiliar situations.',evidence:'Completed onboarding checklist\nFirst completed task\nShort knowledge or navigation check'}},
    {id:'certification',label:'Certification / exam preparation',values:{title:'Prepare for [exam or certification]',purpose:'Build the knowledge, practice, and test-taking readiness needed for [exam or certification].',steps:'Map the official objectives or domains\nAssess current strengths and gaps\nStudy the highest-priority weak areas\nPractice representative questions or tasks\nReview errors and update notes\nComplete a timed practice assessment\nTarget the remaining gaps and retest',completionCriteria:'Meet the target score or performance threshold on representative practice while being able to explain why missed answers were wrong.',evidence:'Objective checklist\nPractice results over time\nError log\nFinal timed practice result'}}
  ],
  'resource-manifest':[
    {id:'offer-material',label:'Offer an item or material',values:{resourceMode:'offer',title:'[Resource] available',description:'I have [resource] available for [use]. Condition/details: [details].',area:'[pickup / delivery area]',timing:'[when available]',quantity:'[amount or quantity]',gift:false,barter:false,partial:false}},
    {id:'request-material',label:'Request an item or material',values:{resourceMode:'need',title:'Looking for [resource]',description:'I need [resource] for [project or purpose]. Useful alternatives: [alternatives].',area:'[where it is needed]',timing:'[needed by / flexible timing]',quantity:'[amount needed]',gift:false,barter:true,partial:true}},
    {id:'lend-tool',label:'Lend or borrow a reusable tool',values:{resourceMode:'offer',title:'Loan: [tool]',description:'Reusable [tool] available to borrow. Condition, accessories, or use notes: [details].',area:'[pickup / return area]',timing:'[availability window]',quantity:'1 tool / [included accessories]',gift:false,barter:false,partial:false}},
    {id:'community-supplies',label:'Community / shared supplies',values:{resourceMode:'offer',title:'Shared [supplies]',description:'Shared supply of [items] for [community use]. Please take what you need and note any important replenishment needs.',area:'[shared location / delivery area]',timing:'[availability]',quantity:'[current amount / limits]',gift:true,barter:false,partial:true}}
  ],
  'skill-manifest':[
    {id:'practical',label:'Practical / repair skill',values:{label:'[Practical skill]',aliases:'[Other common name]\n[Related trade term]',capability:'Can safely complete [real-world task] using [tools or method], verify the result, and handle common problems.',level:'beginner',proof:'Complete [representative task] to the stated safety and quality checks, with a photo, artifact, observation, or verification note.'}},
    {id:'creative',label:'Creative skill',values:{label:'[Creative skill]',aliases:'[Medium or related name]\n[Alternate term]',capability:'Can plan and produce [creative artifact] using [medium or technique] while making intentional choices about [important qualities].',level:'beginner',proof:'Produce a finished [artifact] that demonstrates the technique and briefly explain the major creative choices and revisions.'}},
    {id:'digital',label:'Technical / digital skill',values:{label:'[Technical skill]',aliases:'[Tool or framework name]\n[Related term]',capability:'Can use [tool or system] to complete [technical outcome], verify that it works, and troubleshoot common failures.',level:'beginner',proof:'Complete a working [technical artifact or task], show the verification result, and explain one troubleshooting step or design choice.'}},
    {id:'facilitation',label:'Teaching / facilitation skill',values:{label:'[Teaching or facilitation skill]',aliases:'[Related facilitation term]\n[Alternate name]',capability:'Can guide [people or group] through [learning, meeting, or decision process] with a clear goal, inclusive participation, and a useful closeout.',level:'beginner',proof:'Plan and facilitate one representative session, then provide the agenda or lesson artifact plus participant, observer, or self-review evidence against the stated criteria.'}}
  ]
});
const now=()=>new Date().toISOString();
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const uid=prefix=>`${prefix}:${crypto.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`}`;
const clone=value=>{try{return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value))}catch{return value}};
const provenance=()=>globalThis.CivweaveContentProvenanceV1;
const mode=()=>globalThis.CivweaveLudModeV1;
const humanTools=()=>globalThis.CivweaveLudHumanToolsV1;
const validationNeurons=()=>globalThis.CivweaveHumanValidationNeuronsV1;
const rewardApi=()=>globalThis.CivweaveRewardWeave||null;
const lines=value=>(Array.isArray(value)?value:clean(value).split(/\r?\n/)).map(row=>clean(row,1200).replace(/^\s*(?:[-*•]|\d+[.)])\s*/,'' )).filter(Boolean);
const slug=value=>clean(value,180).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,100);
const number=value=>Math.max(0,Number(value)||0);

function readRows(key){const value=parse(localStorage.getItem(key),[]);return Array.isArray(value)?value:[]}
function writeRows(key,rows,limit=500){localStorage.setItem(key,JSON.stringify((Array.isArray(rows)?rows:[]).slice(0,limit)))}
function stampHuman(record){const p=provenance();return p?.stamp?p.stamp(record,p.humanAuthored({sourceSystem:'lud-mode',artifactType:record.kind})):{...record,metadata:{...(record.metadata||{}),civweaveProvenance:{schema:'civweave.content-provenance.v1',origin:'human-authored',aiGenerated:false,createdAt:now(),sourceSystem:'lud-mode',artifactType:record.kind,humanValidations:[]}}}}
function localRecords(){return readRows(STORE_KEY)}
function canonicalRecords(){
  const rows=[];
  const cerbanimo=parse(localStorage.getItem(CERBANIMO_KEY),{});for(const quest of Array.isArray(cerbanimo?.quests)?cerbanimo.quests:[])rows.push({id:quest.id,kind:'quest',title:quest.title,description:quest.objective||quest.description,status:quest.status,createdAt:quest.createdAt,canonical:true,source:'Cerbanimo'});
  const living=parse(localStorage.getItem(LIVING_KEY),{});for(const module of Array.isArray(living?.school?.modules)?living.school.modules:[])if(module?.metadata?.civweaveProvenance?.origin==='human-authored')rows.push({id:module.id,kind:'learning-module',title:module.title,description:module.objective||module.summary||module.description,status:'curriculum',createdAt:module.metadata.civweaveProvenance.createdAt,canonical:true,source:'Living School'});
  return rows
}
function records(){return[...canonicalRecords(),...localRecords()]}
function draftBase(record,kind,title,description){
  return{schema:'fellowfare.listing-draft.v1',draftId:uid('human-draft'),kind,mode:'offer',title:clean(title,180),description:clean(description,2400),pricing:{usdMinor:0,buttons:0,acorns:0,gift:false,barter:false},fulfillment:{area:'',timing:'',quantity:'',partial:false},sourceSystem:'lud-mode',sourceId:record.id,marketplaceDraft:true,readyForMarket:true,metadata:clone(record.metadata),createdAt:now()}
}
function enqueueMarketDraft(record){
  const rows=readRows(MARKET_DRAFT_KEY);let draft;
  if(record.kind==='resource-manifest'){
    const source=record.payload||{};
    draft={...draftBase(record,'resource',record.title,record.description),...clone(source),schema:'fellowfare.listing-draft.v1',draftId:uid('human-draft'),kind:'resource',sourceSystem:'lud-mode',sourceId:record.id,marketplaceDraft:true,readyForMarket:true,metadata:clone(record.metadata),createdAt:now()}
  }else if(record.kind==='skill-manifest'){
    draft=draftBase(record,'tutoring',record.title,record.payload?.learningUnit?.capability||record.description)
  }else{
    draft=draftBase(record,'learning',record.title,record.payload?.purpose||record.description)
  }
  writeRows(MARKET_DRAFT_KEY,[draft,...rows],500);return draft
}
function localRecord(kind,input,payload,{title,description,details}={}){
  const config=LOCAL_TYPES[kind],createdAt=now(),id=uid(kind);
  const record=stampHuman({schema:RECORD_SCHEMA,id,kind,title:clean(title??input.title,180)||`Untitled ${config.label.toLowerCase()}`,description:clean(description??input.description,6000),details:clean(details??input.details,12000),payload:clone(payload),status:'draft',targetSystem:config.target,createdAt,updatedAt:createdAt});
  writeRows(STORE_KEY,[record,...localRecords()]);if(input.marketDraft)enqueueMarketDraft(record);try{dispatchEvent(new CustomEvent('civweave:lud-record-created',{detail:{record}}))}catch{}return record
}
async function createRecord(input={}){
  const kind=clean(input.kind,80),tools=humanTools();if(!tools)throw new Error('Lud human creation tools are unavailable.');
  if(kind==='quest')return tools.createQuest({title:input.title,objective:input.objective,description:input.description,steps:input.steps,acceptanceCriteria:input.acceptanceCriteria,proofRequirements:input.proofRequirements,dueDate:input.dueDate,reward:input.reward,sequential:input.sequential!==false});
  if(kind==='task')return tools.proposeTask({questId:input.questId,projectId:input.questId,title:input.title,description:input.description,owner:input.owner,dependencies:input.dependencies,acceptanceCriteria:input.acceptanceCriteria,proofRequired:input.proofRequired!==false});
  if(kind==='learning-module')return tools.proposeLearningModule({schoolId:input.schoolId,projectId:input.schoolId,title:input.title,summary:input.summary,objective:input.objective,relevance:input.relevance,prerequisites:input.prerequisites,estimatedEffort:input.estimatedEffort,learningObjectives:input.learningObjectives,lessonBlocks:input.lessonBlocks,practicePrompt:input.practicePrompt,practiceSteps:input.practiceSteps,artifact:input.artifact,completionCriteria:input.completionCriteria,sources:input.sources});
  if(kind==='learning-program'){
    const payload={type:'learning',realm:'living-school',title:clean(input.title,180),purpose:clean(input.purpose,3000),steps:lines(input.steps),completionCriteria:clean(input.completionCriteria,3000),evidence:lines(input.evidence),status:'draft'};
    return localRecord(kind,input,payload,{title:payload.title,description:payload.purpose,details:[...payload.steps,...payload.evidence].join('\n')})
  }
  if(kind==='resource-manifest'){
    const payload={kind:'resource',mode:input.resourceMode==='need'?'need':'offer',title:clean(input.title,180),description:clean(input.description,2400),pricing:{usdMinor:Math.round(number(input.usd)*100),buttons:number(input.buttons),acorns:number(input.acorns),gift:Boolean(input.gift),barter:Boolean(input.barter)},fulfillment:{area:clean(input.area,160),timing:clean(input.timing,160),quantity:clean(input.quantity,160),partial:Boolean(input.partial)}};
    return localRecord(kind,input,payload,{title:payload.title,description:payload.description,details:[payload.fulfillment.quantity,payload.fulfillment.area,payload.fulfillment.timing].filter(Boolean).join(' · ')})
  }
  if(kind==='skill-manifest'){
    const label=clean(input.label||input.title,180),skillId=clean(input.skillId,140)||`skill.${slug(label)||Date.now().toString(36)}`,aliases=lines(input.aliases);
    const skill={id:skillId,label,aliases};
    const learningUnit={title:label,level:clean(input.level,80)||'beginner',capability:clean(input.capability,3000),skillRefs:[skillId],proof:clean(input.proof,3000),mode:'guided'};
    return localRecord(kind,input,{skill,learningUnit},{title:label,description:learningUnit.capability,details:[aliases.length?`Aliases: ${aliases.join(', ')}`:'',learningUnit.proof].filter(Boolean).join('\n')})
  }
  throw new Error('Unknown Lud human record type.')
}
function humanMarketListings(){const state=parse(localStorage.getItem(MARKET_KEY),{}),rows=Array.isArray(state?.listings)?state.listings:[],p=provenance();if(!p?.isLudVisible)return[];return rows.filter(row=>p.isLudVisible(row))}
function hiddenMarketCount(){const state=parse(localStorage.getItem(MARKET_KEY),{}),rows=Array.isArray(state?.listings)?state.listings:[];return Math.max(0,rows.length-humanMarketListings().length)}
function pendingValidations(){try{return rewardApi()?.summary?.('local-user')?.pending||[]}catch{return[]}}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
const option=(value,label,selected='')=>`<option value="${escapeHtml(value)}"${String(value)===String(selected)?' selected':''}>${escapeHtml(label)}</option>`;
function kindPicker(kind){return`<label><span>What are you making?</span><select name="kind">${TYPE_OPTIONS.map(([value,label])=>option(value,label,kind)).join('')}</select></label>`}
function templatePicker(kind){
  const rows=TEMPLATES[kind]||[];if(!rows.length)return'';
  return`<fieldset class="author-template"><legend>Jumpstart with a template</legend><div class="author-template-controls"><label><span>Common starting point</span><select name="templateId"><option value="">Choose a template…</option>${rows.map(row=>option(row.id,row.label)).join('')}</select></label><button type="button" data-apply-template>Use template</button></div><small>Static human-authored starters only. Using one fills this form; it never submits for you. Replace the [bracketed] prompts with your own details.</small></fieldset>`
}
function findTemplate(kind,id){return(TEMPLATES[kind]||[]).find(row=>row.id===id)||null}
function applyTemplate(form,kind,id){
  const template=findTemplate(kind,id);if(!template)return false;
  for(const [name,value] of Object.entries(template.values||{})){
    const field=form.elements.namedItem(name);if(!field||typeof field==='string')continue;
    if(field.type==='checkbox')field.checked=Boolean(value);else if('value'in field)field.value=String(value??'');
  }
  const status=form.querySelector('#status');if(status)status.textContent=`Template loaded: ${template.label}. Replace the [bracketed] prompts, then edit anything else you need.`;
  try{dispatchEvent(new CustomEvent('civweave:lud-template-applied',{detail:{kind,templateId:id,label:template.label}}))}catch{}
  return true
}
function marketToggle(text){return`<label class="check"><input name="marketDraft" type="checkbox"><span>${escapeHtml(text)}</span></label>`}
function formShell(kind,note,body,button,market=''){return`${kindPicker(kind)}<p class="author-note">${escapeHtml(note)}</p>${templatePicker(kind)}${body}${market}<button type="submit">${escapeHtml(button)}</button><p id="status" class="status" role="status"></p>`}
function questForm(){
  return formShell('quest','Create a Cerbanimo Quest with the same outcome, work-unit, acceptance, proof, deadline, and reward fields used by the Quest engine.',`
    <label><span>Quest title</span><input name="title" maxlength="180" required></label>
    <label><span>Objective</span><textarea name="objective" rows="3" maxlength="3000" required></textarea></label>
    <label><span>Description / context</span><textarea name="description" rows="3" maxlength="5000"></textarea></label>
    <label><span>Work units / steps · one per line</span><textarea name="steps" rows="6" maxlength="12000"></textarea></label>
    <label><span>Quest acceptance criteria · one per line</span><textarea name="acceptanceCriteria" rows="4" maxlength="6000"></textarea></label>
    <label><span>Proof requirements · one per line</span><textarea name="proofRequirements" rows="4" maxlength="6000"></textarea></label>
    <div class="author-grid-2"><label><span>Due date</span><input name="dueDate" type="date"></label><label><span>Reward / recognition</span><input name="reward" maxlength="300"></label></div>
    <label class="check"><input name="sequential" type="checkbox" checked><span>Work units are sequential by default.</span></label>
  `,'Create Cerbanimo Quest')
}
function cerbanimoState(){return parse(localStorage.getItem(CERBANIMO_KEY),{})||{}}
function questRows(){return Array.isArray(cerbanimoState()?.quests)?cerbanimoState().quests.filter(row=>row&&!['archived'].includes(row.status)):[]}
function selectedQuestId(){const state=cerbanimoState(),rows=questRows();return clean(state?.preferences?.activeQuestId,180)||rows[0]?.id||''}
function taskDependencyMarkup(questId){
  const quest=questRows().find(row=>row.id===questId),tasks=Array.isArray(quest?.tasks)?quest.tasks:[];
  if(!tasks.length)return'<p class="author-note">This Quest has no existing work units to depend on.</p>';
  return`<fieldset><legend>Dependencies</legend><div class="author-choice-list">${tasks.map(task=>`<label class="check"><input type="checkbox" name="dependencies" value="${escapeHtml(task.id)}"><span>${escapeHtml(task.title||task.id)}</span></label>`).join('')}</div></fieldset>`
}
function taskForm(){
  const rows=questRows(),active=selectedQuestId(),questSelect=rows.length?`<select name="questId" required>${rows.map(row=>option(row.id,row.title||row.id,row.id===active?active:'')).join('')}</select>`:'<select name="questId" disabled><option>No Cerbanimo Quest available</option></select>';
  return formShell('task','Propose a work unit to a specific Quest. Owner, dependencies, acceptance criteria, and proof requirements mirror Cerbanimo’s regular Add work unit proposal.',`
    <label><span>Target Quest</span>${questSelect}</label>
    <label><span>Task title</span><input name="title" maxlength="180" required></label>
    <label><span>Description</span><textarea name="description" rows="4" maxlength="2400"></textarea></label>
    <label><span>Owner / assignee</span><input name="owner" maxlength="140"></label>
    <div id="author-task-dependencies">${taskDependencyMarkup(active)}</div>
    <label><span>Acceptance criteria · one per line</span><textarea name="acceptanceCriteria" rows="5" maxlength="6000"></textarea></label>
    <label class="check"><input name="proofRequired" type="checkbox" checked><span>Proof is required before review.</span></label>
  `,'Propose Cerbanimo task')
}
function livingState(){return parse(localStorage.getItem(LIVING_KEY),{})||{}}
function learningModuleForm(){
  const school=livingState()?.school,schoolId=clean(school?.id,220),schoolLabel=clean(school?.title||school?.capability||school?.id,220)||'No active Living School curriculum';
  return formShell('learning-module','Draft a human-authored module for the active Living School curriculum, with learning, lesson, practice, artifact, and completion fields kept separate.',`
    <label><span>Target curriculum</span><select name="schoolId"${schoolId?'':' disabled'}>${option(schoolId,schoolLabel,schoolId)}</select></label>
    <label><span>Module title</span><input name="title" maxlength="220" required></label>
    <label><span>Summary</span><textarea name="summary" rows="3" maxlength="1800"></textarea></label>
    <label><span>Objective</span><textarea name="objective" rows="3" maxlength="1200" required></textarea></label>
    <label><span>Why this matters / relevance</span><textarea name="relevance" rows="3" maxlength="1800"></textarea></label>
    <div class="author-grid-2"><label><span>Estimated effort</span><input name="estimatedEffort" maxlength="120" placeholder="50–75 minutes"></label><label><span>Artifact / deliverable</span><input name="artifact" maxlength="1600"></label></div>
    <label><span>Prerequisites · one per line</span><textarea name="prerequisites" rows="3" maxlength="4000"></textarea></label>
    <label><span>Learning objectives · one per line</span><textarea name="learningObjectives" rows="4" maxlength="5000"></textarea></label>
    <label><span>Lesson blocks · one per line, “Heading :: content”</span><textarea name="lessonBlocks" rows="7" maxlength="12000" required></textarea></label>
    <label><span>Practice prompt</span><textarea name="practicePrompt" rows="3" maxlength="4000"></textarea></label>
    <label><span>Practice steps · one per line</span><textarea name="practiceSteps" rows="4" maxlength="6000"></textarea></label>
    <label><span>Completion criteria · one per line</span><textarea name="completionCriteria" rows="4" maxlength="6000"></textarea></label>
    <label><span>Sources / source URLs · one per line</span><textarea name="sources" rows="4" maxlength="8000"></textarea></label>
  `,'Propose Living School module')
}
function learningProgramForm(){
  return formShell('learning-program','Use the same learning-path contract Civweave hands to Living School: purpose, ordered steps, completion criteria, and evidence.',`
    <label><span>Program title</span><input name="title" maxlength="180" required></label>
    <label><span>Purpose / capability</span><textarea name="purpose" rows="4" maxlength="3000" required></textarea></label>
    <label><span>Learning steps · one per line</span><textarea name="steps" rows="7" maxlength="12000" required></textarea></label>
    <label><span>Completion criteria</span><textarea name="completionCriteria" rows="4" maxlength="3000" required></textarea></label>
    <label><span>Evidence · one item per line</span><textarea name="evidence" rows="5" maxlength="6000"></textarea></label>
  `,'Save learning program',marketToggle('Also create a human-authored FellowFare learning draft for this program.'))
}
function resourceManifestForm(){
  return formShell('resource-manifest','Match FellowFare’s resource composer directly: offer or need, description, prices, location/timing, quantity, and fulfillment flexibility.',`
    <div class="author-grid-2"><label><span>Side</span><select name="resourceMode"><option value="offer">I offer this</option><option value="need">I need this</option></select></label><label><span>Resource title</span><input name="title" maxlength="180" required></label></div>
    <label><span>Description</span><textarea name="description" rows="4" maxlength="2400"></textarea></label>
    <div class="author-grid-3"><label><span>USD price</span><input name="usd" type="number" min="0" step="0.01" placeholder="0.00"></label><label><span>Buttons</span><input name="buttons" type="number" min="0" step="0.01"></label><label><span>Acorns</span><input name="acorns" type="number" min="0" step="0.01"></label></div>
    <div class="author-grid-2"><label><span>Area / delivery</span><input name="area" maxlength="160"></label><label><span>Timing</span><input name="timing" maxlength="160"></label></div>
    <label><span>Quantity / scope</span><input name="quantity" maxlength="160"></label>
    <fieldset><legend>Terms</legend><div class="author-choice-list"><label class="check"><input type="checkbox" name="gift"><span>Gift / free</span></label><label class="check"><input type="checkbox" name="barter"><span>Barter welcome</span></label><label class="check"><input type="checkbox" name="partial"><span>Partial fulfillment helps</span></label></div></fieldset>
  `,'Save resource manifest',marketToggle('Also queue this human-authored resource as a FellowFare listing draft.'))
}
function skillManifestForm(){
  return formShell('skill-manifest','Define the same core skill identity Civweave uses in its practice pack, then attach the Living School capability and proof needed to teach or demonstrate it.',`
    <label><span>Skill name / label</span><input name="label" maxlength="180" required></label>
    <label><span>Skill ID</span><input name="skillId" maxlength="140" placeholder="skill.example-name"><small>Leave blank to generate an ID from the label.</small></label>
    <label><span>Aliases · one per line</span><textarea name="aliases" rows="4" maxlength="4000"></textarea></label>
    <label><span>Observable capability</span><textarea name="capability" rows="4" maxlength="3000" required></textarea></label>
    <label><span>Level</span><select name="level"><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
    <label><span>Proof / evidence of the skill</span><textarea name="proof" rows="4" maxlength="3000" required></textarea></label>
  `,'Save skill manifest',marketToggle('Also create a human-authored FellowFare tutoring draft for this skill.'))
}
function renderAuthorForm(kind='quest'){
  const form=document.querySelector('#author-form');if(!form)return;
  const renderers={quest:questForm,task:taskForm,'learning-module':learningModuleForm,'learning-program':learningProgramForm,'resource-manifest':resourceManifestForm,'skill-manifest':skillManifestForm};
  form.innerHTML=(renderers[kind]||questForm)()
}
function ensureAuthorStyles(){
  if(document.querySelector('#lud-author-custom-form-styles'))return;const style=document.createElement('style');style.id='lud-author-custom-form-styles';style.textContent=`
    #author-form .author-note{margin:.1rem 0 .25rem;color:var(--muted,#aeb8cf);font-size:.92rem;line-height:1.45}
    #author-form .author-grid-2,#author-form .author-grid-3{display:grid;gap:12px}
    #author-form .author-grid-2{grid-template-columns:repeat(2,minmax(0,1fr))}
    #author-form .author-grid-3{grid-template-columns:repeat(3,minmax(0,1fr))}
    #author-form fieldset{margin:0;padding:12px;border:1px solid rgba(148,163,184,.32);border-radius:14px}
    #author-form fieldset legend{padding:0 6px;font-weight:800}
    #author-form .author-choice-list{display:grid;gap:8px}
    #author-form label small,#author-form .author-template>small{display:block;margin-top:6px;color:var(--muted,#aeb8cf);font-size:.8rem;line-height:1.4}
    #author-form .author-template{background:rgba(92,229,255,.055);border-color:rgba(92,229,255,.32)}
    #author-form .author-template-controls{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:end}
    #author-form .author-template-controls label{margin:0}
    #author-form .author-template-controls button{min-height:48px;white-space:nowrap}
    @media(max-width:620px){#author-form .author-grid-2,#author-form .author-grid-3,#author-form .author-template-controls{grid-template-columns:1fr}}
  `;document.head.append(style)
}
function inputFromForm(form){
  const fd=new FormData(form),kind=clean(fd.get('kind'),80),base={kind,marketDraft:fd.get('marketDraft')==='on'};
  if(kind==='quest')return{...base,title:fd.get('title'),objective:fd.get('objective'),description:fd.get('description'),steps:fd.get('steps'),acceptanceCriteria:fd.get('acceptanceCriteria'),proofRequirements:fd.get('proofRequirements'),dueDate:fd.get('dueDate'),reward:fd.get('reward'),sequential:fd.get('sequential')==='on'};
  if(kind==='task')return{...base,questId:fd.get('questId'),title:fd.get('title'),description:fd.get('description'),owner:fd.get('owner'),dependencies:fd.getAll('dependencies'),acceptanceCriteria:fd.get('acceptanceCriteria'),proofRequired:fd.get('proofRequired')==='on'};
  if(kind==='learning-module')return{...base,schoolId:fd.get('schoolId'),title:fd.get('title'),summary:fd.get('summary'),objective:fd.get('objective'),relevance:fd.get('relevance'),estimatedEffort:fd.get('estimatedEffort'),artifact:fd.get('artifact'),prerequisites:fd.get('prerequisites'),learningObjectives:fd.get('learningObjectives'),lessonBlocks:fd.get('lessonBlocks'),practicePrompt:fd.get('practicePrompt'),practiceSteps:fd.get('practiceSteps'),completionCriteria:fd.get('completionCriteria'),sources:fd.get('sources')};
  if(kind==='learning-program')return{...base,title:fd.get('title'),purpose:fd.get('purpose'),steps:fd.get('steps'),completionCriteria:fd.get('completionCriteria'),evidence:fd.get('evidence')};
  if(kind==='resource-manifest')return{...base,resourceMode:fd.get('resourceMode'),title:fd.get('title'),description:fd.get('description'),usd:fd.get('usd'),buttons:fd.get('buttons'),acorns:fd.get('acorns'),area:fd.get('area'),timing:fd.get('timing'),quantity:fd.get('quantity'),gift:fd.get('gift')==='on',barter:fd.get('barter')==='on',partial:fd.get('partial')==='on'};
  if(kind==='skill-manifest')return{...base,label:fd.get('label'),skillId:fd.get('skillId'),aliases:fd.get('aliases'),capability:fd.get('capability'),level:fd.get('level'),proof:fd.get('proof')};
  return base
}
function recordCard(row){const p=provenance()?.read?.(row),human=row.canonical||p?.origin==='human-authored';return`<article class="card"><span>${escapeHtml(CANONICAL_TYPES[row.kind]||LOCAL_TYPES[row.kind]?.label||row.kind)}</span><h3>${escapeHtml(row.title)}</h3><p>${escapeHtml(row.description||row.payload?.purpose||row.payload?.learningUnit?.capability||row.details||'No notes yet.')}</p><small>${human?'Human-created':'Provenance unavailable'}${row.source?` · ${escapeHtml(row.source)}`:''}</small></article>`}
function marketCard(row){return`<article class="card"><span>${escapeHtml(row.kind||'listing')}</span><h3>${escapeHtml(row.title||'Untitled listing')}</h3><p>${escapeHtml(row.description||'')}</p><small>Human-authored · FellowFare</small></article>`}
function renderRecords(){const node=document.querySelector('#records');if(!node)return;const rows=records();node.innerHTML=rows.length?rows.map(recordCard).join(''):'<p class="empty">Nothing authored here yet.</p>'}
function renderMarket(){const node=document.querySelector('#market');if(!node)return;const rows=humanMarketListings(),hidden=hiddenMarketCount();node.innerHTML=rows.length?rows.map(marketCard).join(''):'<p class="empty">No explicitly human-authored FellowFare listings are stored on this device.</p>';const note=document.querySelector('#market-note');if(note)note.textContent=hidden?`${hidden} listing${hidden===1?' is':'s are'} hidden because provenance is AI-generated or unknown.`:'Only explicitly human-authored listings are admitted.'}
function validationCard(packet){const payment=validationNeurons()?.paymentForPacket?.(packet.id),paid=Boolean(payment?.requestId);return`<article class="card validation" data-packet-id="${escapeHtml(packet.id)}"><span>${paid?'Human review funded':'Human review needed'}</span><h3>${escapeHtml(packet.subjectTitle||packet.title||'Validation request')}</h3><p>${escapeHtml(packet.evidenceSummary||'Fund independent human review from today’s Lud neuron allowance.')}</p><small>${paid?`${payment.totalNeurons} neurons · ${payment.validatorCount} validators · ${payment.perValidatorNeurons} each`:'30 neurons total · choose 2 or 3 validators'}</small>${paid?'':`<div class="actions"><button type="button" data-fund-packet="${escapeHtml(packet.id)}" data-validator-count="2">Fund 2 validators</button><button type="button" data-fund-packet="${escapeHtml(packet.id)}" data-validator-count="3">Fund 3 validators</button></div>`}</article>`}
function renderValidations(){const node=document.querySelector('#validations');if(!node)return;const rows=pendingValidations();node.innerHTML=rows.length?rows.map(validationCard).join(''):'<p class="empty">No open validation packets are stored on this device yet.</p>'}
async function renderValidationBudget(){const node=document.querySelector('#validation-status');if(!node)return;const client=validationNeurons();if(!client){node.textContent='Human-validation neuron settlement is unavailable.';return}try{const status=await client.status(),source=status.source||{};node.textContent=`${Number(source.remainingNeurons||0)} of ${Number(source.dailyBudgetNeurons||900)} daily neurons remain for human review · ${Number(source.requestsRemainingAtThirtyNeurons||0)} more 30-neuron validations before ${source.resetsAt?new Date(source.resetsAt).toLocaleTimeString(): 'reset'}. Unused daily capacity does not roll over.`}catch(error){node.textContent=clean(error?.message||error,500)}}
function bind(){
  const form=document.querySelector('#author-form');
  form?.addEventListener('change',event=>{
    if(event.target?.name==='kind'){renderAuthorForm(event.target.value);return}
    if(event.target?.name==='questId'&&form.elements.kind?.value==='task'){const host=document.querySelector('#author-task-dependencies');if(host)host.innerHTML=taskDependencyMarkup(event.target.value)}
  });
  form?.addEventListener('click',event=>{const button=event.target.closest?.('[data-apply-template]');if(!button)return;const kind=clean(form.elements.kind?.value,80),templateId=clean(form.elements.templateId?.value,80),status=form.querySelector('#status');if(!templateId){if(status)status.textContent='Choose a starter template first.';return}applyTemplate(form,kind,templateId)});
  form?.addEventListener('submit',async event=>{event.preventDefault();const input=inputFromForm(form),kind=input.kind,status=document.querySelector('#status');try{if(status)status.textContent='Saving through Civweave’s human creation tools…';await createRecord(input);renderRecords();renderMarket();renderAuthorForm(kind);const next=document.querySelector('#status');if(next)next.textContent=kind==='task'?'Human-authored task proposal recorded through Cerbanimo’s project vote gate.':kind==='learning-module'?'Human-authored module proposal recorded through Living School’s project vote gate.':'Human-created work saved with its Civweave counterpart fields.'}catch(error){const current=document.querySelector('#status');if(current)current.textContent=clean(error?.message||error,500)}});
  document.addEventListener('click',async event=>{const button=event.target.closest?.('[data-fund-packet]');if(!button)return;const status=document.querySelector('#validation-status');try{button.disabled=true;if(status)status.textContent='Reserving 30 of today’s Lud neurons for human review…';await validationNeurons().fundPacket(button.dataset.fundPacket,{validatorCount:Number(button.dataset.validatorCount)});renderValidations();await renderValidationBudget()}catch(error){button.disabled=false;if(status)status.textContent=clean(error?.message||error,500)}});
  addEventListener('storage',event=>{if([STORE_KEY,MARKET_KEY,'civweave.validation-ledger.v1.1',CERBANIMO_KEY,LIVING_KEY].includes(event.key)){renderRecords();renderMarket();renderValidations()}});
  addEventListener('civweave:reward-state-changed',()=>renderValidations());addEventListener('civweave:human-validation-neuron-funded',()=>{renderValidations();renderValidationBudget()});
}
function start(){mode()?.enable?.({source:'lud-campus'});ensureAuthorStyles();renderAuthorForm('quest');renderRecords();renderMarket();renderValidations();renderValidationBudget();bind()}
const api=Object.freeze({version:VERSION,schema:RECORD_SCHEMA,storeKey:STORE_KEY,templates:TEMPLATES,createRecord,records,localRecords,canonicalRecords,humanMarketListings,pendingValidations,renderAuthorForm,applyTemplate:(kind,id)=>{const form=document.querySelector('#author-form');return form?applyTemplate(form,kind,id):false},render:()=>{renderRecords();renderMarket();renderValidations();return renderValidationBudget()}});
globalThis.CivweaveLudManualAuthoringV1=api;
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
