(()=>{
'use strict';
const VERSION='1.0.4-anarchadia-change-review-v165';
if(globalThis.AnarchadiaChangeReviewV165?.version===VERSION)return;
const CONSOLE_KEY='civweave.anarchadia.citizen-console.v139';
const ACTION_KEY='civweave.realm-actions.v141';
const SELECTED_KEY='civweave.anarchadia.accepted-previews.v165';
const hasDOM=typeof document!=='undefined';
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const clean=(value,max=8000)=>String(value??'').trim().slice(0,max);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const now=()=>new Date().toISOString();
const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const explicitApproval=text=>globalThis.CivweaveActionFollowthroughV165?.explicitApproval?.(text)||/^\s*(?:yes[, ]*)?(?:go ahead(?: and)?\s+)?(?:approve|generate|run|proceed|do it)\b/i.test(clean(text,300));
let currentPreviewId='';
let decorateQueued=false;
function defaultState(){return{schema:'civweave.anarchadia-console.v1',passportId:`AC-${Math.random().toString(36).slice(2,10).toUpperCase()}`,proposals:[],ledger:[],settings:{autoRun:false}}}
function readState(){const value=parse(localStorage.getItem(CONSOLE_KEY),null);return value?.schema==='civweave.anarchadia-console.v1'?value:defaultState()}
function notifyState(serialized){
  try{dispatchEvent(new StorageEvent('storage',{key:CONSOLE_KEY,newValue:serialized,url:location.href,storageArea:localStorage}))}catch{}
}
function writeState(state){state.proposals=Array.isArray(state.proposals)?state.proposals.slice(0,80):[];state.ledger=Array.isArray(state.ledger)?state.ledger.slice(0,250):[];const serialized=JSON.stringify(state);localStorage.setItem(CONSOLE_KEY,serialized);notifyState(serialized);scheduleDecorate();return state}
function record(state,kind,detail,proposalId=''){state.ledger.unshift({id:uid('evt'),time:now(),kind,detail:clean(detail,2400),proposalId})}
function actions(){const rows=parse(localStorage.getItem(ACTION_KEY),[]);return Array.isArray(rows)?rows:[]}
function writeActions(rows){localStorage.setItem(ACTION_KEY,JSON.stringify(rows.slice(0,120)));try{dispatchEvent(new CustomEvent('civweave:actions-changed',{detail:{items:rows}}))}catch{}}
function updateAction(id,patch){if(!id)return null;const rows=actions(),index=rows.findIndex(item=>item.id===id);if(index<0)return null;const action=rows[index];patch(action);action.updatedAt=now();rows[index]=action;writeActions(rows);return action}
function deriveTitle(text,fallback='Feature request'){
  const value=clean(text,180).replace(/^(?:please\s+)?(?:can|could|would)\s+you\s+/i,'').replace(/^(?:add|create|make|build|request)\s+/i,'').replace(/[.!?]+$/,'');
  return value?(value.length>100?`${value.slice(0,97)}…`:value):fallback;
}
function normalizeAction(action){
  if(!action||action.system!=='anarchadia')return action;
  const source=clean(action.sourceText,5000),dark=/\bdark mode\b/i.test(source),feature=action.kind==='feature-request';
  if(feature&&!dark){
    action.title=deriveTitle(source,action.title||'Feature request');
    action.fields={...(action.fields||{}),problem:source,proposedChange:`Implement the requested feature: ${source}`,affectedSystems:Array.isArray(action.fields?.affectedSystems)?action.fields.affectedSystems:['civweave'],implementationRoute:'Anarchadia review → explicit approval → sandbox preview → keep or revert decision.'};
    if(!Array.isArray(action.acceptanceCriteria)||!action.acceptanceCriteria.length)action.acceptanceCriteria=['The requested feature can be inspected in a sandbox preview.','The current live interface remains unchanged until the preview is explicitly kept.','The user can revert the preview without losing the original request.'];
  }
  action.state='review';
  action.approval={...(action.approval||{}),required:true,label:'Approve preview generation'};
  action.execution={...(action.execution||{}),status:'awaiting-preview-approval',events:Array.isArray(action.execution?.events)?action.execution.events:[]};
  action.updatedAt=now();
  const rows=actions(),index=rows.findIndex(item=>item.id===action.id);if(index>=0){rows[index]=action;writeActions(rows)}
  return action;
}
function proposalFromAction(action){
  action=normalizeAction(action);
  const source=clean(action.sourceText,5000),bug=action.kind==='bug-report';
  return{
    id:`proposal-${action.id}`,sourceActionId:action.id,kind:bug?'bugfix':'feature',title:clean(action.title,160)||deriveTitle(source),
    problem:clean(action.fields?.problem||action.fields?.report||source,5000),
    expected:clean(action.fields?.proposedChange||action.fields?.expected||`Implement the requested change: ${source}`,5000),
    area:clean(action.fields?.affectedSurface||action.fields?.affectedSystems?.join(', ')||'Civweave',240),
    acceptance:Array.isArray(action.acceptanceCriteria)&&action.acceptanceCriteria.length?action.acceptanceCriteria.map(value=>clean(value,800)):['A sandbox preview demonstrates the requested change.','The user can keep or revert the preview explicitly.'],
    risk:clean(action.fields?.risk||'The preview is isolated. Keeping it selects a governed candidate; it does not silently publish production code.',3000),
    evidence:clean(action.fields?.evidence||source,3000),status:'review',stage:'intake',pipeline:[{time:now(),stage:'intake',note:'Merlin passed the request into review. No code generation has started.'}],
    approval:{required:true,state:'review',reviewedAt:'',approvedAt:'',approvedBy:'local-user'},createdAt:now(),updatedAt:now(),voteSignal:false
  };
}
function importAction(action){
  if(!action||action.system!=='anarchadia'||!['feature-request','bug-report'].includes(action.kind))return null;
  const state=readState(),existing=state.proposals.find(item=>item.sourceActionId===action.id||item.id===`proposal-${action.id}`);if(existing)return existing;
  const proposal=proposalFromAction(action);state.proposals.unshift(proposal);record(state,'proposal-review-created',`${proposal.title}: awaiting explicit approval before preview generation.`,proposal.id);writeState(state);return proposal;
}
function importPendingActions(){let imported=null;for(const action of actions().filter(item=>item.system==='anarchadia'&&['feature-request','bug-report'].includes(item.kind)&&['draft','clarifying','review'].includes(item.state)))imported=importAction(action)||imported;return imported}
function proposal(id){return readState().proposals.find(item=>item.id===id)||null}
function latestReview(){return readState().proposals.filter(item=>['review','reverted'].includes(item.status)||item.approval?.state==='review').sort((a,b)=>(Date.parse(b.updatedAt||b.createdAt||0)||0)-(Date.parse(a.updatedAt||a.createdAt||0)||0))[0]||null}
function reviewMarkup(item){return`<section><header><div><small>${esc(item.kind.toUpperCase())} · REVIEW REQUIRED</small><h2>${esc(item.title)}</h2></div><button type="button" data-ac165-close-review>×</button></header><div class="ac165-review-body"><p><b>Current problem</b><br>${esc(item.problem)}</p><p><b>Expected result</b><br>${esc(item.expected)}</p><p><b>Affected area</b><br>${esc(item.area)}</p><h3>Acceptance criteria</h3><ol>${(item.acceptance||[]).map(value=>`<li>${esc(value)}</li>`).join('')}</ol>${item.risk?`<p><b>Risk and consent notes</b><br>${esc(item.risk)}</p>`:''}<div class="ac165-consent-note">Approving this review starts bounded code generation and an isolated preview. It does not publish the change. After inspecting the preview, choose <b>Keep this preview</b> or <b>Revert to current look</b>.</div></div><div class="ac-dialog-actions"><button type="button" data-ac165-approve="${esc(item.id)}">APPROVE & GENERATE PREVIEW</button><button type="button" data-ac165-close-review>CANCEL</button></div></section>`}
function ensureReviewDialog(){if(!hasDOM)return null;let dialog=document.querySelector('#ac165-review-dialog');if(dialog)return dialog;dialog=document.createElement('dialog');dialog.id='ac165-review-dialog';dialog.className='ac-dialog ac165-review-dialog';document.body.append(dialog);dialog.addEventListener('click',event=>{if(event.target===dialog||event.target.closest('[data-ac165-close-review]'))dialog.close()});return dialog}
function openReview(id){const item=proposal(id);if(!item)return null;const state=readState(),target=state.proposals.find(row=>row.id===id);if(target&&!target.approval.reviewedAt){target.approval.reviewedAt=now();target.updatedAt=now();record(state,'proposal-reviewed',`${target.title}: review opened.`,target.id);writeState(state)}const dialog=ensureReviewDialog();dialog.innerHTML=reviewMarkup(target||item);if(!dialog.open)dialog.showModal?.();return target||item}
async function approveAndRun(id){
  const state=readState(),item=state.proposals.find(row=>row.id===id);if(!item)return{ok:false,error:'The reviewed request could not be found.'};
  if(item.status==='preview-ready'||item.preview?.srcdoc)return{ok:true,proposal:item,alreadyReady:true};
  item.approval={...(item.approval||{}),required:true,state:'approved',approvedAt:now(),approvedBy:'local-user'};item.status='approved';item.updatedAt=now();item.pipeline=Array.isArray(item.pipeline)?item.pipeline:[];item.pipeline.push({time:now(),stage:'approval',note:'The user approved bounded preview generation.'});record(state,'proposal-preview-approved',`${item.title}: user approved preview generation.`,item.id);writeState(state);
  updateAction(item.sourceActionId,action=>{action.state='approved-for-preview';action.execution={...(action.execution||{}),status:'approved-for-preview',events:[...(action.execution?.events||[]),{type:'anarchadia.preview-generation.approved',at:now(),proposalId:item.id}].slice(-40)}});
  ensureReviewDialog()?.close();
  const api=globalThis.AnarchadiaCitizenConsoleV158;if(!api?.runPipeline)return{ok:false,error:'The Anarchadia preview generator is not ready.'};
  await api.runPipeline(id);scheduleDecorate();return{ok:true,proposal:proposal(id)};
}
function selectPreview(id){
  const state=readState(),item=state.proposals.find(row=>row.id===id);if(!item?.preview?.srcdoc)return{ok:false,error:'No generated preview is available.'};
  item.status='preview-accepted';item.previewDecision={state:'accepted',at:now(),label:'Keep this preview'};item.updatedAt=now();item.pipeline=Array.isArray(item.pipeline)?item.pipeline:[];item.pipeline.push({time:now(),stage:'preview-decision',note:'The user kept this preview as the selected governed candidate.'});record(state,'preview-kept',`${item.title}: preview selected. Current production remains unchanged until its governed publication route completes.`,item.id);writeState(state);
  const selected=parse(localStorage.getItem(SELECTED_KEY),[]),rows=Array.isArray(selected)?selected:[],entry={proposalId:item.id,sourceActionId:item.sourceActionId,title:item.title,generator:item.preview.generator||item.patch?.generator||'configured-provider',acceptedAt:item.previewDecision.at};const index=rows.findIndex(row=>row.proposalId===item.id);if(index>=0)rows[index]=entry;else rows.unshift(entry);localStorage.setItem(SELECTED_KEY,JSON.stringify(rows.slice(0,80)));
  updateAction(item.sourceActionId,action=>{action.state='preview-accepted';action.execution={...(action.execution||{}),status:'preview-accepted',events:[...(action.execution?.events||[]),{type:'anarchadia.preview.accepted',at:now(),proposalId:item.id}].slice(-40)}});
  document.querySelector('#ac-preview-dialog')?.close();toast('Preview kept as the selected candidate. The current production look remains available until governed publication.');return{ok:true,proposal:item};
}
function revertPreview(id){
  const state=readState(),item=state.proposals.find(row=>row.id===id);if(!item)return{ok:false,error:'The preview request could not be found.'};
  delete item.patch;delete item.preview;delete item.validation;item.status='review';item.stage='intake';item.failedStage=null;item.previewDecision={state:'reverted',at:now(),label:'Revert to current look'};item.approval={...(item.approval||{}),state:'review',approvedAt:''};item.updatedAt=now();item.pipeline=Array.isArray(item.pipeline)?item.pipeline:[];item.pipeline.push({time:now(),stage:'preview-reverted',note:'The user rejected the generated preview and returned to the current look.'});record(state,'preview-reverted',`${item.title}: generated preview discarded; current look retained.`,item.id);writeState(state);
  updateAction(item.sourceActionId,action=>{action.state='review';action.execution={...(action.execution||{}),status:'awaiting-preview-approval',events:[...(action.execution?.events||[]),{type:'anarchadia.preview.reverted',at:now(),proposalId:item.id}].slice(-40)}});
  document.querySelector('#ac-preview-dialog')?.close();toast('Preview reverted. The current look is unchanged, and the request returned to review.');return{ok:true,proposal:item};
}
function toast(message){const node=document.querySelector?.('#ac-toast');if(!node)return;node.textContent=message;node.hidden=false;clearTimeout(node._ac165Timer);node._ac165Timer=setTimeout(()=>node.hidden=true,3200)}
function manualSubmit(form){
  const data=new FormData(form),acceptance=clean(data.get('acceptance'),5000).split(/\n+/).map(value=>value.trim()).filter(Boolean),item={id:uid('proposal'),kind:clean(data.get('kind'),40)||'feature',title:clean(data.get('title'),160),problem:clean(data.get('problem'),5000),expected:clean(data.get('expected'),5000),area:clean(data.get('area'),240)||'Civweave',acceptance,risk:clean(data.get('risk'),3000),evidence:clean(data.get('evidence'),3000),status:'review',stage:'intake',pipeline:[{time:now(),stage:'intake',note:'Request submitted to review. Preview generation is waiting for explicit approval.'}],approval:{required:true,state:'review',reviewedAt:'',approvedAt:'',approvedBy:'local-user'},createdAt:now(),updatedAt:now(),voteSignal:false};
  const state=readState();state.proposals.unshift(item);record(state,'proposal-review-created',`${item.title}: manual request awaiting preview approval.`,item.id);writeState(state);globalThis.AnarchadiaCitizenConsoleV158?.setScreen?.('automation');openReview(item.id);return item;
}
function cardProposalId(card){return card.querySelector('[data-open-pipeline]')?.dataset.openPipeline||card.querySelector('[data-rerun]')?.dataset.rerun||''}
function decorateCards(){
  if(!hasDOM)return;
  document.querySelectorAll('#ac-proposal-list article.ac-card,#ac-pipeline-list article.ac-pipeline-card').forEach(card=>{
    const id=cardProposalId(card),item=proposal(id);if(!item)return;const actions=card.querySelector('.ac-card-actions');if(!actions)return;
    if(!actions.querySelector(`[data-ac165-review="${CSS.escape(id)}"]`)){const button=document.createElement('button');button.type='button';button.dataset.ac165Review=id;button.textContent='REVIEW';actions.prepend(button)}
    let approve=actions.querySelector('[data-ac165-approve]');const needsApproval=!item.preview?.srcdoc&&item.approval?.state!=='approved';
    if(needsApproval&&!approve){approve=document.createElement('button');approve.type='button';approve.dataset.ac165Approve=id;approve.textContent='APPROVE & GENERATE';actions.append(approve)}else if(!needsApproval&&approve)approve.remove();
    const rerun=actions.querySelector('[data-rerun]');if(rerun&&item.approval?.state!=='approved'&&!item.preview?.srcdoc){rerun.disabled=true;rerun.title='Review and approve preview generation first.'}
    let stateLabel=card.querySelector('[data-ac165-state]');if(!stateLabel){stateLabel=document.createElement('small');stateLabel.dataset.ac165State='';card.querySelector('header')?.append(stateLabel)}
    stateLabel.textContent=item.previewDecision?.state==='accepted'?'SELECTED PREVIEW':item.previewDecision?.state==='reverted'?'REVERTED · BACK IN REVIEW':item.approval?.state==='approved'&&!item.preview?.srcdoc?'APPROVED · GENERATING':item.preview?.srcdoc?'PREVIEW DECISION REQUIRED':'REVIEW & APPROVAL REQUIRED';
  });
}
function decorateMerlin(){
  const log=document.querySelector?.('#ac-merlin-log'),item=latestReview();if(!log||!item)return;let controls=log.querySelector('.ac165-merlin-actions');if(!controls){controls=document.createElement('div');controls.className='ac165-merlin-actions';log.append(controls)}const markup=`<button type="button" data-ac165-review="${esc(item.id)}">REVIEW REQUEST</button><button type="button" data-ac165-approve="${esc(item.id)}">APPROVE & GENERATE PREVIEW</button>`;if(controls.innerHTML!==markup)controls.innerHTML=markup;
}
function decoratePreview(){
  const dialog=document.querySelector?.('#ac-preview-dialog'),item=proposal(currentPreviewId);if(!dialog||!item?.preview?.srcdoc)return;const actions=dialog.querySelector('.ac-dialog-actions');if(!actions)return;
  actions.querySelectorAll('[data-ac165-preview-decision]').forEach(node=>node.remove());
  const keep=document.createElement('button');keep.type='button';keep.dataset.ac165PreviewDecision='keep';keep.dataset.proposalId=item.id;keep.textContent='KEEP THIS PREVIEW';
  const revert=document.createElement('button');revert.type='button';revert.dataset.ac165PreviewDecision='revert';revert.dataset.proposalId=item.id;revert.textContent='REVERT TO CURRENT LOOK';
  actions.prepend(revert);actions.prepend(keep);
  let note=dialog.querySelector('.ac165-preview-note');if(!note){note=document.createElement('p');note.className='ac165-preview-note';dialog.querySelector('iframe')?.insertAdjacentElement('afterend',note)}note.textContent='This is an isolated candidate. Keep it to select this version for the governed route, or revert to discard it and retain the current look.';
}
function scheduleDecorate(){if(!hasDOM||decorateQueued)return;decorateQueued=true;requestAnimationFrame(()=>{decorateQueued=false;decorateCards();decorateMerlin();decoratePreview()})}
function patchMerlin(api){
  if(!api?.ask||api.__ac165ReviewFlow)return api;const original=api.ask.bind(api);
  api.ask=async(system,text,rows=[])=>{
    const pending=latestReview();
    if(explicitApproval(text)&&pending){const result=await approveAndRun(pending.id);return{role:'assistant',text:result.ok?`Merlin recorded your approval and generated the bounded sandbox preview for “${pending.title}.” Open the preview, then choose Keep this preview or Revert to current look.`:`Merlin could not start the preview: ${result.error}`,provider:'local-contract',model:'anarchadia-review-flow-v165'}}
    const before=new Set(actions().map(item=>item.id)),reply=await original(system,text,rows);let imported=null;
    for(const action of actions().filter(item=>item.system==='anarchadia'&&!before.has(item.id)))imported=importAction(action)||imported;
    imported=imported||importPendingActions();
    if(imported)return{...reply,text:`Merlin passed “${imported.title}” into Anarchadia review. Nothing has been generated yet. Review the request, then approve preview generation. After inspecting the preview, choose whether to keep it or revert to the current look.`,provider:reply.provider||'local-contract',model:reply.model||'anarchadia-review-flow-v165'};
    return reply;
  };
  Object.defineProperty(api,'__ac165ReviewFlow',{value:true});return api;
}
function patchAvailable(){patchMerlin(globalThis.CivweaveGuideChatV153)}
function injectStyles(){if(!hasDOM||document.querySelector('#ac165-styles'))return;const style=document.createElement('style');style.id='ac165-styles';style.textContent='.ac165-review-body{display:grid;gap:12px;padding:18px;max-height:62vh;overflow:auto}.ac165-review-body p,.ac165-review-body li{color:#d9dbe5;line-height:1.5}.ac165-consent-note,.ac165-preview-note{margin:12px 18px;padding:12px;border-left:4px solid #8dff2b;background:rgba(141,255,43,.08);color:#dfffc8}.ac165-merlin-actions{display:flex;gap:8px;flex-wrap:wrap;padding:10px}.ac165-merlin-actions button,[data-ac165-state]{font:800 10px/1.2 system-ui;letter-spacing:.05em}[data-ac165-state]{display:block;color:#8dff2b;padding:4px 0}';document.head.append(style)}
function captureSubmit(event){const form=event.target;if(form?.id!=='ac-request-form')return;event.preventDefault();event.stopImmediatePropagation();manualSubmit(form)}
function captureClick(event){
  const target=event.target.closest?.('button,[data-preview],[data-rerun]');if(!target)return;
  if(target.dataset.ac165Review){event.preventDefault();event.stopImmediatePropagation();openReview(target.dataset.ac165Review);return}
  if(target.dataset.ac165Approve){event.preventDefault();event.stopImmediatePropagation();approveAndRun(target.dataset.ac165Approve).catch(error=>toast(error.message));return}
  if(target.dataset.ac165PreviewDecision){event.preventDefault();event.stopImmediatePropagation();const id=target.dataset.proposalId;target.dataset.ac165PreviewDecision==='keep'?selectPreview(id):revertPreview(id);return}
  if(target.dataset.preview){currentPreviewId=target.dataset.preview;setTimeout(decoratePreview,0);return}
  if(target.dataset.rerun){const item=proposal(target.dataset.rerun);if(item&&item.approval?.state!=='approved'&&!item.preview?.srcdoc){event.preventDefault();event.stopImmediatePropagation();openReview(item.id)}}
}
function boot(){injectStyles();ensureReviewDialog();document.addEventListener('submit',captureSubmit,true);document.addEventListener('click',captureClick,true);const observer=new MutationObserver(scheduleDecorate);document.querySelectorAll('#ac-proposal-list,#ac-pipeline-list').forEach(list=>observer.observe(list,{childList:true}));patchAvailable();importPendingActions();scheduleDecorate();addEventListener('civweave:actions-changed',()=>{importPendingActions();scheduleDecorate()});addEventListener('storage',event=>{if([CONSOLE_KEY,ACTION_KEY].includes(event.key))scheduleDecorate()})}
if(hasDOM){document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot()}
globalThis.AnarchadiaChangeReviewV165={version:VERSION,importAction,importPendingActions,latestReview,openReview,approveAndRun,selectPreview,revertPreview,manualSubmit,patchAvailable,explicitApproval};
})();
