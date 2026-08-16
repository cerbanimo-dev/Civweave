(()=>{
'use strict';

const VERSION='1.2.0-custom-forms';
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
function marketToggle(text){return`<label class="check"><input name="marketDraft" type="checkbox"><span>${escapeHtml(text)}</span></label>`}
function formShell(kind,note,body,button,market=''){return`${kindPicker(kind)}<p class="author-note">${escapeHtml(note)}</p>${body}${market}<button type="submit">${escapeHtml(button)}</button><p id="status" class="status" role="status"></p>`}
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
    #author-form label small{display:block;margin-top:6px;color:var(--muted,#aeb8cf);font-size:.8rem}
    @media(max-width:620px){#author-form .author-grid-2,#author-form .author-grid-3{grid-template-columns:1fr}}
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
  form?.addEventListener('submit',async event=>{event.preventDefault();const input=inputFromForm(form),kind=input.kind,status=document.querySelector('#status');try{if(status)status.textContent='Saving through Civweave’s human creation tools…';await createRecord(input);renderRecords();renderMarket();renderAuthorForm(kind);const next=document.querySelector('#status');if(next)next.textContent=kind==='task'?'Human-authored task proposal recorded through Cerbanimo’s project vote gate.':kind==='learning-module'?'Human-authored module proposal recorded through Living School’s project vote gate.':'Human-created work saved with its Civweave counterpart fields.'}catch(error){const current=document.querySelector('#status');if(current)current.textContent=clean(error?.message||error,500)}});
  document.addEventListener('click',async event=>{const button=event.target.closest?.('[data-fund-packet]');if(!button)return;const status=document.querySelector('#validation-status');try{button.disabled=true;if(status)status.textContent='Reserving 30 of today’s Lud neurons for human review…';await validationNeurons().fundPacket(button.dataset.fundPacket,{validatorCount:Number(button.dataset.validatorCount)});renderValidations();await renderValidationBudget()}catch(error){button.disabled=false;if(status)status.textContent=clean(error?.message||error,500)}});
  addEventListener('storage',event=>{if([STORE_KEY,MARKET_KEY,'civweave.validation-ledger.v1.1',CERBANIMO_KEY,LIVING_KEY].includes(event.key)){renderRecords();renderMarket();renderValidations()}});
  addEventListener('civweave:reward-state-changed',()=>renderValidations());addEventListener('civweave:human-validation-neuron-funded',()=>{renderValidations();renderValidationBudget()});
}
function start(){mode()?.enable?.({source:'lud-campus'});ensureAuthorStyles();renderAuthorForm('quest');renderRecords();renderMarket();renderValidations();renderValidationBudget();bind()}
const api=Object.freeze({version:VERSION,schema:RECORD_SCHEMA,storeKey:STORE_KEY,createRecord,records,localRecords,canonicalRecords,humanMarketListings,pendingValidations,renderAuthorForm,render:()=>{renderRecords();renderMarket();renderValidations();return renderValidationBudget()}});
globalThis.CivweaveLudManualAuthoringV1=api;
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
