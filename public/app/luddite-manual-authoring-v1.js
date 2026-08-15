(()=>{
'use strict';

const VERSION='1.0.0';
const RECORD_SCHEMA='civweave.manual-artifact.v1';
const STORE_KEY='civweave.luddite.manual-records.v1';
const INTENTIONS_KEY='civweave.intentions.v127';
const INBOX_KEY='civweave.realm-inbox.v1';
const MARKET_KEY='fellowfare.marketplace.v2';
const MARKET_DRAFT_KEY='civweave.fellowfare.listing-drafts.v1';
const TYPES=Object.freeze({
  quest:{label:'Quest',target:'civweave'},
  'learning-program':{label:'Learning program',target:'living-school'},
  task:{label:'Task',target:'cerbanimo'},
  'resource-manifest':{label:'Resource manifest',target:'fellowfare'},
  'skill-manifest':{label:'Skill manifest',target:'living-school'}
});
const now=()=>new Date().toISOString();
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const clean=(value,max=12000)=>String(value??'').trim().slice(0,max);
const uid=prefix=>`${prefix}:${crypto.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`}`;
const clone=value=>{try{return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value))}catch{return value}};
const provenance=()=>globalThis.CivweaveContentProvenanceV1;
const mode=()=>globalThis.CivweaveLudditeModeV1;

function readRows(key){const value=parse(localStorage.getItem(key),[]);return Array.isArray(value)?value:[]}
function writeRows(key,rows,limit=500){localStorage.setItem(key,JSON.stringify((Array.isArray(rows)?rows:[]).slice(0,limit)))}
function records(){return readRows(STORE_KEY)}
function authorId(){
  try{const sync=globalThis.CivweaveIdentitySync,vault=sync?.readVault?.();return clean(vault?.identityId||vault?.identity?.identityId,240)}catch{}
  try{const vault=parse(localStorage.getItem('civweave-identity-vault'),{});return clean(vault?.identityId||vault?.identity?.identityId,240)}catch{return''}
}
function stampHuman(record){
  const p=provenance();
  return p?.stamp?p.stamp(record,p.humanAuthored({sourceSystem:'luddite-mode',artifactType:record.kind,authorId:authorId()})):{...record,metadata:{...(record.metadata||{}),civweaveProvenance:{schema:'civweave.content-provenance.v1',origin:'human-authored',aiGenerated:false,createdAt:now(),sourceSystem:'luddite-mode',artifactType:record.kind,authorId:authorId(),humanValidations:[]}}};
}
function createRecord(input={}){
  const kind=TYPES[input.kind]?input.kind:'task',createdAt=now();
  const record=stampHuman({
    schema:RECORD_SCHEMA,
    id:uid(kind),
    kind,
    title:clean(input.title,180)||`Untitled ${TYPES[kind].label.toLowerCase()}`,
    description:clean(input.description,6000),
    details:clean(input.details,12000),
    status:'draft',
    targetSystem:TYPES[kind].target,
    createdAt,
    updatedAt:createdAt
  });
  writeRows(STORE_KEY,[record,...records()]);
  mirrorRecord(record,{marketDraft:Boolean(input.marketDraft)});
  dispatchEvent(new CustomEvent('civweave:luddite-record-created',{detail:{record}}));
  return record;
}
function mirrorRecord(record,{marketDraft=false}={}){
  if(record.kind==='quest'){
    const intentions=readRows(INTENTIONS_KEY),plan={schema:'civweave.intention-weave.v1',id:record.id,title:record.title,wish:record.description||record.title,outcome:record.details||record.description||record.title,state:'review',createdAt:record.createdAt,updatedAt:record.updatedAt,paths:[],requiresExplicitActivation:true,planning:{engine:'human-authored',mode:'luddite'},metadata:clone(record.metadata)};
    const row={id:record.id,kind:'weave-plan',text:record.title,state:'review',done:false,createdAt:record.createdAt,updatedAt:record.updatedAt,plan,metadata:clone(record.metadata)};
    writeRows(INTENTIONS_KEY,[row,...intentions.filter(item=>item?.id!==record.id)],100);
  }else{
    const inbox=readRows(INBOX_KEY),packet={schema:'civweave.handoff.v1',id:uid('handoff'),source:'luddite-mode',target:record.targetSystem,kind:record.kind,title:record.title,status:'review',payload:{manualRecordId:record.id,title:record.title,description:record.description,details:record.details,manualReviewRequired:true,metadata:clone(record.metadata)},metadata:clone(record.metadata),createdAt:record.createdAt};
    writeRows(INBOX_KEY,[packet,...inbox],120);
  }
  if(marketDraft&&['resource-manifest','learning-program','skill-manifest'].includes(record.kind))enqueueMarketDraft(record);
}
function enqueueMarketDraft(record){
  const rows=readRows(MARKET_DRAFT_KEY),kind=record.kind==='learning-program'?'learning':'resource',draft={schema:'fellowfare.listing-draft.v1',draftId:uid('human-draft'),kind,title:record.title,description:record.description||record.details,sourceSystem:'luddite-mode',sourceId:record.id,marketplaceDraft:true,readyForMarket:true,metadata:clone(record.metadata),createdAt:now()};
  writeRows(MARKET_DRAFT_KEY,[draft,...rows],500);
  return draft;
}
function humanMarketListings(){
  const state=parse(localStorage.getItem(MARKET_KEY),{}),rows=Array.isArray(state?.listings)?state.listings:[];
  const p=provenance();
  if(!p?.isLudditeVisible)return[];
  return rows.filter(row=>p.isLudditeVisible(row));
}
function unknownMarketCount(){
  const state=parse(localStorage.getItem(MARKET_KEY),{}),rows=Array.isArray(state?.listings)?state.listings:[];
  return Math.max(0,rows.length-humanMarketListings().length);
}
function identityVault(){
  const sync=globalThis.CivweaveIdentitySync;
  if(sync?.readVault){try{return sync.readVault()}catch{}}
  try{return parse(localStorage.getItem('civweave-identity-vault'),null)}catch{return null}
}
function identityParts(vault){
  const identityId=clean(vault?.identityId||vault?.identity?.identityId,180),deviceId=clean(vault?.deviceId,180);
  return{identityId,deviceId};
}
function rewardApi(){return globalThis.CivweaveRewardWeave||null}
function pendingValidations(){
  try{return rewardApi()?.summary?.(authorId()||'local-user')?.pending||[]}catch{return[]}
}
function validationById(id){return pendingValidations().find(packet=>packet?.id===id)||null}
function evidenceChecks(packet,checked){
  const selected=new Set(Array.isArray(checked)?checked:[]);
  return(Array.isArray(packet?.evidenceArtifacts)?packet.evidenceArtifacts:[]).map(item=>({artifactId:clean(item?.id||item?.contentHash||item?.name,180),contentHash:clean(item?.contentHash,180),inspected:selected.has(clean(item?.contentHash||item?.id,180)),sourceRef:clean(item?.sourceRef,1000)}));
}
function rubricScores(packet,checked){
  const selected=new Set(Array.isArray(checked)?checked:[]);
  return(Array.isArray(packet?.rubric)?packet.rubric:[]).map(criterion=>({criterion:clean(criterion,600),met:selected.has(clean(criterion,600)),score:selected.has(clean(criterion,600))?1:0,note:''}));
}
async function recordHumanValidation(input={}){
  const packet=validationById(clean(input.packetId,180));if(!packet)throw new Error('That validation packet is no longer open.');
  const reward=rewardApi(),identity=globalThis.CivweaveIdentitySync,vault=identityVault(),parts=identityParts(vault);
  if(!reward?.record||!identity?.signValue)throw new Error('The signed reward-validation runtime is unavailable on this device.');
  if(!parts.identityId||!parts.deviceId)throw new Error('A portable Civweave identity is required to earn validation rewards.');
  const scores=rubricScores(packet,input.rubricChecks),checks=evidenceChecks(packet,input.evidenceChecks),createdAt=now();
  const unsigned={
    schema:'civweave.validation-receipt.v1.1',
    id:uid('validation-receipt'),
    packetId:clean(packet.id,180),
    requestId:clean(packet.requestId,180),
    submissionId:clean(packet.submissionId,180),
    validatorId:parts.identityId,
    validatorDeviceId:parts.deviceId,
    validatorType:'human',
    relationship:'independent',
    verdict:input.verdict==='fail'?'fail':'pass',
    confidence:Math.max(.05,Math.min(.95,Number(input.confidence)||.85)),
    rubricScore:scores.length?scores.reduce((sum,row)=>sum+row.score,0)/scores.length:(input.verdict==='fail'?0:1),
    rubricThreshold:.6,
    rubricScores:scores,
    evidenceChecks:checks,
    reason:clean(input.reason,1800),
    integrity:'verified',
    provenance:'human-review',
    createdAt
  };
  if(unsigned.reason.length<24)throw new Error('Human validation needs a useful reason of at least 24 characters.');
  const receipt={...unsigned,signature:await identity.signValue(vault,unsigned)};
  const state=await reward.record(receipt);
  dispatchEvent(new CustomEvent('civweave:validation-receipt-recorded',{detail:{packetId:packet.id,receiptId:receipt.id,provenance:'human-review'}}));
  return{receipt,state};
}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function recordCard(row){const p=provenance()?.read?.(row);return`<article class="ld-card"><span>${escapeHtml(TYPES[row.kind]?.label||row.kind)}</span><h3>${escapeHtml(row.title)}</h3><p>${escapeHtml(row.description||row.details||'No notes yet.')}</p><small>${p?.origin==='human-authored'?'Human-authored':'Provenance unavailable'} · ${escapeHtml(new Date(row.createdAt).toLocaleString())}</small></article>`}
function marketCard(row){return`<article class="ld-card"><span>${escapeHtml(row.kind||'listing')}</span><h3>${escapeHtml(row.title||'Untitled listing')}</h3><p>${escapeHtml(row.description||'')}</p><small>Human-authored · FellowFare</small></article>`}
function renderRecords(){const node=document.querySelector('#ld-records');if(!node)return;const rows=records();node.innerHTML=rows.length?rows.map(recordCard).join(''):'<p class="ld-empty">Nothing authored here yet.</p>'}
function renderMarket(){const node=document.querySelector('#ld-market');if(!node)return;const rows=humanMarketListings(),hidden=unknownMarketCount();node.innerHTML=rows.length?rows.map(marketCard).join(''):'<p class="ld-empty">No explicitly human-authored FellowFare listings are stored on this device.</p>';const note=document.querySelector('#ld-market-note');if(note)note.textContent=hidden?`${hidden} listing${hidden===1?' is':'s are'} hidden because provenance is AI-generated or unknown.`:'Only explicitly human-authored listings are admitted.'}
function validationCard(packet){const rubric=Array.isArray(packet.rubric)?packet.rubric:[],artifacts=Array.isArray(packet.evidenceArtifacts)?packet.evidenceArtifacts:[];return`<article class="ld-card ld-validation" data-packet-id="${escapeHtml(packet.id)}"><span>Human validation · reward eligible</span><h3>${escapeHtml(packet.subjectTitle||packet.title||'Validation request')}</h3><p>${escapeHtml(packet.summary||packet.evidenceSummary||'Inspect the supplied evidence and rubric before recording a verdict.')}</p><small>${rubric.length} rubric item${rubric.length===1?'':'s'} · ${artifacts.length} evidence item${artifacts.length===1?'':'s'}</small><button type="button" data-review-packet="${escapeHtml(packet.id)}">Review evidence</button></article>`}
function renderValidations(){const node=document.querySelector('#ld-validations');if(!node)return;const rows=pendingValidations();node.innerHTML=rows.length?rows.map(validationCard).join(''):'<p class="ld-empty">No open validation packets are stored on this device.</p>'}
function openReview(packetId){
  const packet=validationById(packetId),dialog=document.querySelector('#ld-review-dialog'),body=document.querySelector('#ld-review-body');if(!packet||!dialog||!body)return;
  const rubric=Array.isArray(packet.rubric)?packet.rubric:[],artifacts=Array.isArray(packet.evidenceArtifacts)?packet.evidenceArtifacts:[];
  body.innerHTML=`<input type="hidden" name="packetId" value="${escapeHtml(packet.id)}"><h2>${escapeHtml(packet.subjectTitle||packet.title||'Human validation')}</h2><p>Inspect the evidence yourself. Nothing here asks a model to decide for you.</p><fieldset><legend>Rubric</legend>${rubric.map((item,index)=>`<label><input type="checkbox" name="rubric" value="${escapeHtml(item)}"><span>${escapeHtml(item)}</span></label>`).join('')||'<p>No rubric items recorded.</p>'}</fieldset><fieldset><legend>Evidence inspected</legend>${artifacts.map(item=>{const key=clean(item.contentHash||item.id,180);return`<label><input type="checkbox" name="evidence" value="${escapeHtml(key)}"><span>${escapeHtml(item.name||item.id||'Evidence')}</span></label>`}).join('')||'<p>No evidence artifacts recorded.</p>'}</fieldset><label><span>Verdict</span><select name="verdict"><option value="pass">Pass</option><option value="fail">Fail</option></select></label><label><span>Confidence</span><input name="confidence" type="number" min="0.05" max="0.95" step="0.05" value="0.85"></label><label><span>Reason</span><textarea name="reason" rows="4" minlength="24" required placeholder="Explain what you inspected and why the evidence passes or fails."></textarea></label><div class="ld-actions"><button type="submit">Sign human validation</button><button type="button" data-close-review>Cancel</button></div>`;
  dialog.showModal();
}
function bind(){
  const form=document.querySelector('#ld-author-form');
  form?.addEventListener('submit',event=>{event.preventDefault();const fd=new FormData(form),record=createRecord({kind:fd.get('kind'),title:fd.get('title'),description:fd.get('description'),details:fd.get('details'),marketDraft:fd.get('marketDraft')==='on'});form.reset();renderRecords();const status=document.querySelector('#ld-status');if(status)status.textContent=`Saved ${TYPES[record.kind].label.toLowerCase()} with human-authored provenance.`});
  document.addEventListener('click',event=>{const id=event.target.closest?.('[data-review-packet]')?.dataset.reviewPacket;if(id){openReview(id);return}if(event.target.closest?.('[data-close-review]'))document.querySelector('#ld-review-dialog')?.close()});
  document.querySelector('#ld-review-form')?.addEventListener('submit',async event=>{event.preventDefault();const fd=new FormData(event.target),status=document.querySelector('#ld-validation-status');try{if(status)status.textContent='Signing human validation…';await recordHumanValidation({packetId:fd.get('packetId'),verdict:fd.get('verdict'),confidence:fd.get('confidence'),reason:fd.get('reason'),rubricChecks:fd.getAll('rubric'),evidenceChecks:fd.getAll('evidence')});document.querySelector('#ld-review-dialog')?.close();if(status)status.textContent='Human validation recorded. Reward eligibility remains governed by the canonical independent/cross-device rules.';renderValidations()}catch(error){if(status)status.textContent=clean(error?.message||error,500)}});
  addEventListener('storage',event=>{if([STORE_KEY,MARKET_KEY,'civweave.validation-ledger.v1.1'].includes(event.key)){renderRecords();renderMarket();renderValidations()}});
  addEventListener('civweave:reward-state-changed',()=>renderValidations());
}
function start(){mode()?.enable?.({source:'luddite-campus'});renderRecords();renderMarket();renderValidations();bind()}
const api=Object.freeze({version:VERSION,schema:RECORD_SCHEMA,storeKey:STORE_KEY,createRecord,records,humanMarketListings,pendingValidations,recordHumanValidation,render:()=>{renderRecords();renderMarket();renderValidations()}});
globalThis.CivweaveLudditeManualAuthoringV1=api;
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
