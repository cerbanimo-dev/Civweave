import {
  normalizeGovernanceState,newGovernanceState,audit,createCredential,createIntentionPlan,openConsensusRound,
  castConsensusPosition,tallyConsensusRound,closeConsensusRound
} from './anarchadia-governance-kernel-v145.js';
import {loadGovernanceState,saveGovernanceState,putPrivateKey,getPrivateKey} from './anarchadia-governance-store-v145.js';

const VERSION='1.0.0-anarchadia-consensus-v145';
const ACTIVE_KEY='civweave.anarchadia.active-consensus-credential.v145';
const LEVELS=['hub','region','mesh'];
const LEVEL_LABELS={individual:'MY PATH',hub:'HUB',region:'REGION',mesh:'MESH'};
const REALM_LABELS={'living-school':'Living School',cerbanimo:'Cerbanimo',fellowfare:'FellowFare',civweave:'Civweave',anarchadia:'Anarchadia'};
const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const percent=value=>`${Math.round(Number(value||0)*100)}%`;
let state=normalizeGovernanceState(await loadGovernanceState()||newGovernanceState());
let activeCredentialId=localStorage.getItem(ACTIVE_KEY)||'';
let saving=Promise.resolve();
function showDialog(dialog){if(!dialog)return;if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','')}
function closeDialog(dialog){if(!dialog)return;if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open')}

function participantLevels(credential){
  const levels=Array.isArray(credential.consensusLevels)?credential.consensusLevels:credential.scope==='community'?['hub']:['hub','region','mesh'];
  return levels.filter(level=>LEVELS.includes(level));
}
function activeCredential(){return state.credentials.find(item=>item.id===activeCredentialId&&item.status==='active')||state.credentials.find(item=>item.status==='active')||null}
function roundFor(plan,level=plan.activeLevel){return state.consensusRounds.find(round=>round.planId===plan.id&&round.level===level&&round.status==='open')||state.consensusRounds.find(round=>round.planId===plan.id&&round.level===level)||null}
function electorateFor(level){return state.credentials.filter(credential=>credential.status==='active'&&participantLevels(credential).includes(level))}
async function persist(action,detail={}){
  if(action)audit(state,action,detail);
  saving=saving.then(()=>saveGovernanceState(state));
  await saving;
  dispatchEvent(new CustomEvent('anarchadia:consensus-changed',{detail:{action,...detail}}));
  render();
}
async function ensureLocalCitizen(){
  if(state.credentials.length){if(!activeCredentialId)activeCredentialId=state.credentials[0].id;localStorage.setItem(ACTIVE_KEY,activeCredentialId);return}
  const created=await createCredential('Local Citizen','member','local-hub');
  created.record.consensusLevels=['hub','region','mesh'];
  state.credentials.push(created.record);activeCredentialId=created.record.id;localStorage.setItem(ACTIVE_KEY,activeCredentialId);
  await putPrivateKey(created.record.id,created.privateKey);
  await persist('consensus.local-citizen-created',{credentialId:created.record.id});
}
async function ensureRound(plan){
  if(plan.state==='adopted'||plan.state==='stalled'||plan.activeLevel==='individual')return null;
  const existing=roundFor(plan);if(existing)return existing;
  const electorate=electorateFor(plan.activeLevel);if(!electorate.length)return null;
  const round=await openConsensusRound(plan,{level:plan.activeLevel,electorate,quorum:.6,threshold:.67});
  state.consensusRounds.unshift(round);await persist('consensus.round-opened',{planId:plan.id,roundId:round.id,level:round.level,electorate:round.electorate.length});return round;
}
async function publishMesh(plan,kind){
  const mesh=globalThis.CivweaveLocalMeshV146;if(!mesh?.createObject)return null;
  try{return await mesh.createObject({id:`anarchadia:intention:${plan.id}:${kind}`,kind:'anarchadia.intention-consensus.v1',purpose:'Propagate a hub-approved intention through staged regional and mesh consensus.',consent:'federated',audience:[],hopLimit:kind==='hub-adopted'?4:8,publish:true,payload:{kind,plan:structuredClone(plan),originNode:await mesh.deviceId()}})}catch(error){console.warn('Anarchadia consensus mesh publication deferred.',error);return null}
}
function routeMarkup(plan){
  return `<div class="ac-consensus-route" aria-label="Authority path">${plan.authorityPath.map(level=>{const decision=plan.decisions?.find(item=>item.level===level),active=plan.activeLevel===level&&!decision,status=decision?.outcome||(active?'active':'waiting');return `<span class="${decision?.outcome==='adopted'?'is-done':decision?'is-stalled':active?'is-active':''}"><i>${decision?.outcome==='adopted'?'✓':LEVEL_LABELS[level].slice(0,1)}</i><b>${LEVEL_LABELS[level]}</b><small>${esc(status)}</small></span>`}).join('<em>→</em>')}</div>`;
}
function tallyMarkup(round){
  if(!round)return '<div class="ac-consensus-empty">No eligible credential exists at this level. Add a participant with the required reach.</div>';
  const tally=tallyConsensusRound(round),supportWidth=round.electorate.length?tally.totals.support/round.electorate.length*100:0,opposeWidth=round.electorate.length?(tally.totals.oppose+tally.totals.amend)/round.electorate.length*100:0;
  const outlook=tally.outcome==='ready-to-adopt'?'Quorum and support threshold are both met.':tally.plausible?`Still plausible · ${tally.neededForQuorum} more for quorum · ${tally.neededForThreshold} more support position${tally.neededForThreshold===1?'':'s'} needed.`:'This electorate can no longer reach the adoption threshold without amendment or a new round.';
  return `<div class="ac-consensus-tally"><div class="ac-consensus-meter"><span class="is-support" style="width:${supportWidth}%"></span><span class="is-objection" style="width:${opposeWidth}%"></span><i style="left:${round.procedure.quorum*100}%" title="Quorum ${percent(round.procedure.quorum)}"></i></div><div class="ac-consensus-values"><span><b>${tally.cast}/${tally.eligible}</b> participating</span><span><b>${percent(tally.participation)}</b> quorum progress</span><span><b>${percent(tally.approval)}</b> support</span><span><b>${percent(round.procedure.threshold)}</b> needed</span></div><p class="${tally.plausible||tally.outcome==='ready-to-adopt'?'is-plausible':'is-stalled'}">${esc(outlook)}</p></div>`;
}
function planCard(plan){
  const round=roundFor(plan),tally=round&&tallyConsensusRound(round),credential=activeCredential(),eligible=round?.electorate.some(item=>item.actorId===credential?.id),position=round?.positions.find(item=>item.actorId===credential?.id),canClose=round?.status==='open'&&(tally?.quorumMet||tally?.cast===tally?.eligible);
  const realms=plan.realms.map(realm=>REALM_LABELS[realm]||realm).join(' + ');
  return `<article class="ac-intention-card" data-plan-id="${esc(plan.id)}"><header><div><small>${esc(realms)} · ${esc(plan.sourceKind==='civweave-change'?'GOVERNED CHANGE':'INTENTION PLAN')}</small><h3>${esc(plan.title)}</h3></div><span class="ac-intention-state is-${esc(plan.state)}">${esc(plan.state.replaceAll('-',' '))}</span></header><p>${esc(plan.summary)}</p>${routeMarkup(plan)}${plan.successSignals?.length?`<div class="ac-intention-signals"><b>Success looks like</b><ul>${plan.successSignals.map(signal=>`<li>${esc(signal)}</li>`).join('')}</ul></div>`:''}${tallyMarkup(round)}${round?.status==='open'?`<div class="ac-consensus-actions"><span>Voting as <b>${esc(credential?.label||'no active participant')}</b>${position?` · current: ${esc(position.choice)}`:''}</span><div>${['support','oppose','abstain','amend'].map(choice=>`<button type="button" data-consensus-vote="${choice}" data-round-id="${round.id}" ${eligible?'':'disabled'}>${choice.toUpperCase()}</button>`).join('')}<button class="is-primary" type="button" data-consensus-close="${round.id}" ${canClose?'':'disabled'}>${plan.authorityPath.at(-1)===round.level?'ADOPT INTENTION':`ADVANCE TO ${LEVEL_LABELS[plan.authorityPath[plan.authorityPath.indexOf(round.level)+1]]}`}</button></div></div>`:''}${plan.state==='adopted'?`<div class="ac-consensus-adopted"><b>SHARED INTENTION ADOPTED</b><span>${plan.authorityPath.length===1?'This path belongs to the individual.':'Every required authority level adopted the same plan revision.'}</span></div>`:''}${plan.state==='stalled'?'<div class="ac-consensus-stalled"><b>CONSENSUS PAUSED</b><span>Revise the plan or open a new electorate snapshot before continuing.</span></div>':''}</article>`;
}
function renderParticipants(){
  const selector=$('#ac-consensus-actor');if(selector){selector.innerHTML=state.credentials.filter(item=>item.status==='active').map(item=>`<option value="${esc(item.id)}" ${item.id===activeCredential()?.id?'selected':''}>${esc(item.label)}</option>`).join('')}
  const roster=$('#ac-member-roster');if(roster)roster.innerHTML=state.credentials.map(item=>`<article><span><b>${esc(item.label)}</b><small>${participantLevels(item).map(level=>LEVEL_LABELS[level]).join(' · ')}</small></span><code>${esc(item.fingerprint)}</code></article>`).join('');
  const count=$('#ac-citizens');if(count)count.textContent=String(state.credentials.filter(item=>item.status==='active').length);
}
function render(){
  renderParticipants();
  const list=$('#ac-intention-list');if(list){const plans=state.intentionPlans.slice().sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));list.innerHTML=plans.length?plans.map(planCard).join(''):'<div class="ac-empty"><b>No intention plans yet.</b><span>Offer a direction, choose who it affects, and Anarchadia will route it to the smallest legitimate authority.</span></div>'}
  const open=state.intentionPlans.filter(plan=>!['adopted','stalled'].includes(plan.state)).length,adopted=state.intentionPlans.filter(plan=>plan.state==='adopted').length,mesh=state.intentionPlans.filter(plan=>plan.authorityPath.includes('mesh')&&!['adopted','stalled'].includes(plan.state)).length;
  if($('#ac-consensus-open'))$('#ac-consensus-open').textContent=String(open);
  if($('#ac-consensus-adopted'))$('#ac-consensus-adopted').textContent=String(adopted);
  if($('#ac-consensus-mesh'))$('#ac-consensus-mesh').textContent=String(mesh);
}
async function submitPlan(input){
  const creator=activeCredential();if(!creator)throw new Error('Create an active participant first.');
  const plan=await createIntentionPlan({...input,creatorId:creator.id});state.intentionPlans.unshift(plan);
  await persist('intention.submitted',{planId:plan.id,path:plan.authorityPath,realms:plan.realms,sourceProposalId:plan.sourceProposalId});
  await ensureRound(plan);
  if(plan.state==='adopted')dispatchEvent(new CustomEvent('anarchadia:intention-adopted',{detail:{plan:structuredClone(plan)}}));
  return plan;
}
async function submitChangeProposal(proposal,authority={}){
  const reach=authority.level==='mesh'?'mesh':authority.level==='region'?'region':'hub';
  const realms=authority.realms?.length?authority.realms:[proposal.area||'civweave'];
  const plan=await submitPlan({title:proposal.title,summary:`${proposal.problem}\n\nExpected: ${proposal.expected}`,realms,reach,crossEffecting:authority.level==='mesh',sourceKind:'civweave-change',sourceProposalId:proposal.id,successSignals:proposal.acceptance,risks:proposal.risk});
  showIntentions();return plan;
}
function showIntentions(){globalThis.AnarchadiaCitizenConsoleV158?.setScreen?.('intentions');render()}

document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-consensus-action],[data-consensus-vote],[data-consensus-close]');if(!target)return;
  try{
    if(target.dataset.consensusAction==='new-plan'){showDialog($('#ac-intention-dialog'));return}
    if(target.dataset.consensusAction==='members'){showDialog($('#ac-members-dialog'));return}
    if(target.dataset.consensusAction==='close-dialog'){closeDialog(target.closest('dialog'));return}
    if(target.dataset.consensusVote){
      const round=state.consensusRounds.find(item=>item.id===target.dataset.roundId),credential=activeCredential(),key=credential&&await getPrivateKey(credential.id);if(!round||!credential||!key)throw new Error('The active participant does not have a local signing key.');
      await castConsensusPosition(round,credential,key,target.dataset.consensusVote);await persist('consensus.position-cast',{planId:round.planId,roundId:round.id,level:round.level,actorId:credential.id,choice:target.dataset.consensusVote});return;
    }
    if(target.dataset.consensusClose){
      const round=state.consensusRounds.find(item=>item.id===target.dataset.consensusClose),plan=state.intentionPlans.find(item=>item.id===round?.planId);if(!round||!plan)return;
      const tally=tallyConsensusRound(round);if(!tally.quorumMet&&tally.cast<tally.eligible)throw new Error('This round is still open: quorum has not been reached and eligible participants remain.');
      const level=round.level,outcome=await closeConsensusRound(round,plan);await persist('consensus.round-closed',{planId:plan.id,roundId:round.id,level,outcome:outcome.outcome});
      if(outcome.outcome==='adopted'&&plan.state!=='adopted'){await publishMesh(plan,`${level}-adopted`);await ensureRound(plan)}
      if(plan.state==='adopted'){if(plan.authorityPath.includes('mesh'))await publishMesh(plan,'mesh-adopted');dispatchEvent(new CustomEvent('anarchadia:intention-adopted',{detail:{plan:structuredClone(plan)}}))}
    }
  }catch(error){globalThis.AnarchadiaCitizenConsoleV158?.toast?.(error.message)||alert(error.message)}
});

$('#ac-consensus-actor')?.addEventListener('change',event=>{activeCredentialId=event.target.value;localStorage.setItem(ACTIVE_KEY,activeCredentialId);render()});
$('#ac-intention-form')?.addEventListener('submit',async event=>{
  event.preventDefault();const data=new FormData(event.currentTarget),realms=data.getAll('realms');
  try{await submitPlan({title:data.get('title'),summary:data.get('summary'),realms,reach:data.get('reach'),crossEffecting:realms.length>1,successSignals:data.get('successSignals'),risks:data.get('risks')});event.currentTarget.reset();closeDialog($('#ac-intention-dialog'));showIntentions()}catch(error){alert(error.message)}
});
$('#ac-member-form')?.addEventListener('submit',async event=>{
  event.preventDefault();const data=new FormData(event.currentTarget),levels=data.getAll('levels').filter(level=>LEVELS.includes(level));
  try{if(!levels.length)throw new Error('Choose at least one participation level.');const created=await createCredential(data.get('label'),'member',levels.at(-1));created.record.consensusLevels=levels;state.credentials.push(created.record);await putPrivateKey(created.record.id,created.privateKey);activeCredentialId=created.record.id;localStorage.setItem(ACTIVE_KEY,activeCredentialId);await persist('consensus.participant-created',{credentialId:created.record.id,levels});for(const plan of state.intentionPlans)await ensureRound(plan);event.currentTarget.reset();closeDialog($('#ac-members-dialog'))}catch(error){alert(error.message)}
});

await ensureLocalCitizen();
for(const plan of state.intentionPlans)await ensureRound(plan);
render();
globalThis.AnarchadiaConsensusV145={version:VERSION,showIntentions,submitPlan,submitChangeProposal,render,getState:()=>structuredClone(state),tallyConsensusRound};
dispatchEvent(new CustomEvent('anarchadia:consensus-ready'));
