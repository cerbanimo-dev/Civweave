(()=>{
'use strict';

const VERSION='1.1.0';
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

function readRows(key){const value=parse(localStorage.getItem(key),[]);return Array.isArray(value)?value:[]}
function writeRows(key,rows,limit=500){localStorage.setItem(key,JSON.stringify((Array.isArray(rows)?rows:[]).slice(0,limit)))}
function stampHuman(record){const p=provenance();return p?.stamp?p.stamp(record,p.humanAuthored({sourceSystem:'lud-mode',artifactType:record.kind})):{...record,metadata:{...(record.metadata||{}),civweaveProvenance:{schema:'civweave.content-provenance.v1',origin:'human-authored',aiGenerated:false,createdAt:now(),sourceSystem:'lud-mode',artifactType:record.kind,humanValidations:[]}}}}
function localRecords(){return readRows(STORE_KEY)}
function canonicalRecords(){
  const rows=[];
  const cerbanimo=parse(localStorage.getItem(CERBANIMO_KEY),{});for(const quest of Array.isArray(cerbanimo?.quests)?cerbanimo.quests:[])rows.push({id:quest.id,kind:'quest',title:quest.title,description:quest.objective||quest.description,status:quest.status,createdAt:quest.createdAt,canonical:true,source:'Cerbanimo'});
  const living=parse(localStorage.getItem(LIVING_KEY),{});for(const module of Array.isArray(living?.school?.modules)?living.school.modules:[])if(module?.metadata?.civweaveProvenance?.origin==='human-authored')rows.push({id:module.id,kind:'learning-module',title:module.title,description:module.objective||module.description,status:'curriculum',createdAt:module.metadata.civweaveProvenance.createdAt,canonical:true,source:'Living School'});
  return rows
}
function records(){return[...canonicalRecords(),...localRecords()]}
function enqueueMarketDraft(record){const rows=readRows(MARKET_DRAFT_KEY),kind=record.kind==='learning-program'?'learning':'resource',draft={schema:'fellowfare.listing-draft.v1',draftId:uid('human-draft'),kind,title:record.title,description:record.description||record.details,sourceSystem:'lud-mode',sourceId:record.id,marketplaceDraft:true,readyForMarket:true,metadata:clone(record.metadata),createdAt:now()};writeRows(MARKET_DRAFT_KEY,[draft,...rows],500);return draft}
async function createRecord(input={}){
  const kind=clean(input.kind,80),tools=humanTools();if(!tools)throw new Error('Lud human creation tools are unavailable.');
  if(kind==='quest')return tools.createQuest({title:input.title,objective:input.description,description:input.description,details:input.details,steps:input.details});
  if(kind==='task')return tools.proposeTask({title:input.title,description:input.description,details:input.details,acceptanceCriteria:input.details,proofRequired:true});
  if(kind==='learning-module')return tools.proposeLearningModule({title:input.title,description:input.description,objective:input.description,details:input.details,lesson:input.details,completionCriteria:input.description});
  if(!LOCAL_TYPES[kind])throw new Error('Unknown Lud human record type.');
  const createdAt=now(),record=stampHuman({schema:RECORD_SCHEMA,id:uid(kind),kind,title:clean(input.title,180)||`Untitled ${LOCAL_TYPES[kind].label.toLowerCase()}`,description:clean(input.description,6000),details:clean(input.details,12000),status:'draft',targetSystem:LOCAL_TYPES[kind].target,createdAt,updatedAt:createdAt});
  writeRows(STORE_KEY,[record,...localRecords()]);if(input.marketDraft)enqueueMarketDraft(record);try{dispatchEvent(new CustomEvent('civweave:lud-record-created',{detail:{record}}))}catch{}return record
}
function humanMarketListings(){const state=parse(localStorage.getItem(MARKET_KEY),{}),rows=Array.isArray(state?.listings)?state.listings:[],p=provenance();if(!p?.isLudVisible)return[];return rows.filter(row=>p.isLudVisible(row))}
function hiddenMarketCount(){const state=parse(localStorage.getItem(MARKET_KEY),{}),rows=Array.isArray(state?.listings)?state.listings:[];return Math.max(0,rows.length-humanMarketListings().length)}
function pendingValidations(){try{return rewardApi()?.summary?.('local-user')?.pending||[]}catch{return[]}}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function recordCard(row){const p=provenance()?.read?.(row),human=row.canonical||p?.origin==='human-authored';return`<article class="card"><span>${escapeHtml(CANONICAL_TYPES[row.kind]||LOCAL_TYPES[row.kind]?.label||row.kind)}</span><h3>${escapeHtml(row.title)}</h3><p>${escapeHtml(row.description||row.details||'No notes yet.')}</p><small>${human?'Human-created':'Provenance unavailable'}${row.source?` · ${escapeHtml(row.source)}`:''}</small></article>`}
function marketCard(row){return`<article class="card"><span>${escapeHtml(row.kind||'listing')}</span><h3>${escapeHtml(row.title||'Untitled listing')}</h3><p>${escapeHtml(row.description||'')}</p><small>Human-authored · FellowFare</small></article>`}
function renderRecords(){const node=document.querySelector('#records');if(!node)return;const rows=records();node.innerHTML=rows.length?rows.map(recordCard).join(''):'<p class="empty">Nothing authored here yet.</p>'}
function renderMarket(){const node=document.querySelector('#market');if(!node)return;const rows=humanMarketListings(),hidden=hiddenMarketCount();node.innerHTML=rows.length?rows.map(marketCard).join(''):'<p class="empty">No explicitly human-authored FellowFare listings are stored on this device.</p>';const note=document.querySelector('#market-note');if(note)note.textContent=hidden?`${hidden} listing${hidden===1?' is':'s are'} hidden because provenance is AI-generated or unknown.`:'Only explicitly human-authored listings are admitted.'}
function validationCard(packet){const payment=validationNeurons()?.paymentForPacket?.(packet.id),paid=Boolean(payment?.requestId);return`<article class="card validation" data-packet-id="${escapeHtml(packet.id)}"><span>${paid?'Human review funded':'Human review needed'}</span><h3>${escapeHtml(packet.subjectTitle||packet.title||'Validation request')}</h3><p>${escapeHtml(packet.evidenceSummary||'Fund independent human review from today’s Lud neuron allowance.')}</p><small>${paid?`${payment.totalNeurons} neurons · ${payment.validatorCount} validators · ${payment.perValidatorNeurons} each`:'30 neurons total · choose 2 or 3 validators'}</small>${paid?'':`<div class="actions"><button type="button" data-fund-packet="${escapeHtml(packet.id)}" data-validator-count="2">Fund 2 validators</button><button type="button" data-fund-packet="${escapeHtml(packet.id)}" data-validator-count="3">Fund 3 validators</button></div>`}</article>`}
function renderValidations(){const node=document.querySelector('#validations');if(!node)return;const rows=pendingValidations();node.innerHTML=rows.length?rows.map(validationCard).join(''):'<p class="empty">No open validation packets are stored on this device yet.</p>'}
async function renderValidationBudget(){const node=document.querySelector('#validation-status');if(!node)return;const client=validationNeurons();if(!client){node.textContent='Human-validation neuron settlement is unavailable.';return}try{const status=await client.status(),source=status.source||{};node.textContent=`${Number(source.remainingNeurons||0)} of ${Number(source.dailyBudgetNeurons||900)} daily neurons remain for human review · ${Number(source.requestsRemainingAtThirtyNeurons||0)} more 30-neuron validations before ${source.resetsAt?new Date(source.resetsAt).toLocaleTimeString(): 'reset'}. Unused daily capacity does not roll over.`}catch(error){node.textContent=clean(error?.message||error,500)}}
function bind(){
  const form=document.querySelector('#author-form');form?.addEventListener('submit',async event=>{event.preventDefault();const fd=new FormData(form),status=document.querySelector('#status');try{if(status)status.textContent='Saving through Civweave’s human creation tools…';await createRecord({kind:fd.get('kind'),title:fd.get('title'),description:fd.get('description'),details:fd.get('details'),marketDraft:fd.get('marketDraft')==='on'});form.reset();renderRecords();if(status)status.textContent='Human-created work saved through its canonical Civweave owner.'}catch(error){if(status)status.textContent=clean(error?.message||error,500)}});
  document.addEventListener('click',async event=>{const button=event.target.closest?.('[data-fund-packet]');if(!button)return;const status=document.querySelector('#validation-status');try{button.disabled=true;if(status)status.textContent='Reserving 30 of today’s Lud neurons for human review…';await validationNeurons().fundPacket(button.dataset.fundPacket,{validatorCount:Number(button.dataset.validatorCount)});renderValidations();await renderValidationBudget()}catch(error){button.disabled=false;if(status)status.textContent=clean(error?.message||error,500)}});
  addEventListener('storage',event=>{if([STORE_KEY,MARKET_KEY,'civweave.validation-ledger.v1.1',CERBANIMO_KEY,LIVING_KEY].includes(event.key)){renderRecords();renderMarket();renderValidations()}});addEventListener('civweave:reward-state-changed',()=>renderValidations());addEventListener('civweave:human-validation-neuron-funded',()=>{renderValidations();renderValidationBudget()});
}
function start(){mode()?.enable?.({source:'lud-campus'});renderRecords();renderMarket();renderValidations();renderValidationBudget();bind()}
const api=Object.freeze({version:VERSION,schema:RECORD_SCHEMA,storeKey:STORE_KEY,createRecord,records,localRecords,canonicalRecords,humanMarketListings,pendingValidations,render:()=>{renderRecords();renderMarket();renderValidations();return renderValidationBudget()}});
globalThis.CivweaveLudManualAuthoringV1=api;
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
