(()=>{
'use strict';
const VERSION='1.0.32-capability-readiness-v154';
const KEYS={intentions:'civweave.intentions.v127',readiness:'civweave.capability-readiness.v154'};
const SYSTEM_LABELS={civweave:'Civweave','living-school':'Living School',cerbanimo:'Cerbanimo',fellowfare:'FellowFare',anarchadia:'Anarchadia'};
const POSTURES={learn:{label:'Learn first',prepared:1,realm:'living-school'},practice:{label:'Practice while doing',prepared:.7,realm:'cerbanimo'},recruit:{label:'Recruit help',prepared:1,realm:'fellowfare'},simplify:{label:'Simplify scope',prepared:.8,realm:'anarchadia'},ready:{label:'Ready to use',prepared:0,realm:'civweave'}};
const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed==null?fallback:parsed}catch{return fallback}};
const clean=(value,max=8000)=>String(value??'').trim().slice(0,max);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const rows=value=>Array.isArray(value)?value:[];
const now=()=>new Date().toISOString();
const readIntentions=()=>{const value=parse(localStorage.getItem(KEYS.intentions),[]);return Array.isArray(value)?value:[]};
const writeIntentions=value=>{localStorage.setItem(KEYS.intentions,JSON.stringify(value.slice(0,100)));try{dispatchEvent(new CustomEvent('civweave:intentions-changed',{detail:{items:value}}))}catch{}return value};
const readStore=()=>{const value=parse(localStorage.getItem(KEYS.readiness),{schema:'civweave.capability-readiness.v154',plans:{}});return{schema:'civweave.capability-readiness.v154',plans:value?.plans&&typeof value.plans==='object'?value.plans:{}}};
const writeStore=value=>(localStorage.setItem(KEYS.readiness,JSON.stringify(value)),value);
function locate(planId){const items=readIntentions(),index=items.findIndex(item=>item?.id===planId||item?.plan?.id===planId);return{items,index,item:index>=0?items[index]:null,plan:index>=0?items[index]?.plan:null}}
function activePlan(){return readIntentions().find(item=>item?.kind==='weave-plan'&&(item.state==='active'||item.plan?.state==='active'))?.plan||readIntentions().find(item=>item?.kind==='weave-plan'&&item.state==='review')?.plan||null}
function capability(id,title,realm,requiredLevel,prompt,evidenceHint){return{id,title,realm,requiredLevel,currentLevel:null,posture:'',prompt,evidenceHint}}
function templates(plan){
  const signal=plan?.signals||{},out=[];
  if(signal.game){out.push(
    capability('game-design','Core game-loop design','living-school',3,'Can you explain the repeated player decision, feedback, and stopping condition?','A one-page loop diagram another player can explain.'),
    capability('temporal-rules','Temporal systems design','living-school',3,'Can you define what resets, persists, and changes for each time role?','A rules sheet with examples and edge cases.'),
    capability('prototype-engineering','Playable prototype engineering','cerbanimo',3,'Can you build and debug one complete playable encounter?','A build that another person can run from start to finish.'),
    capability('playtest-revision','Playtesting and evidence-led revision','cerbanimo',2,'Can you observe confusion without teaching the solution during the test?','Three test notes connected to concrete revisions.'),
    capability('production-assets','Visual, audio, and interface production','fellowfare',2,'Can you create or source the minimum assets needed for the slice?','An asset list with ownership, source, and replacement status.'),
    capability('collaboration','Collaborative project coordination','anarchadia',2,'Can the group assign decisions, work, consent, and review without hidden expectations?','Named roles, decision boundaries, and an exit or revision path.')
  )}
  else if(signal.food||signal.collective){out.push(
    capability('pilot-design','Pilot and service-cycle design','living-school',2,'Can you describe one complete cycle and its failure points?','A start-to-finish cycle map.'),
    capability('safety','Safety and handling knowledge','living-school',3,'Can you identify the safety rules and escalation points that apply?','A checked safety and escalation list.'),
    capability('operations','Operational coordination','cerbanimo',3,'Can you run setup, delivery, cleanup, and review as visible work?','A completed pilot checklist and review.'),
    capability('resources','Resource sourcing and logistics','fellowfare',3,'Can you source quantities, transport, storage, and substitutions?','Confirmed sources and logistics records.'),
    capability('participation','Participation and role agreements','anarchadia',2,'Are roles, commitments, consent, and exit conditions explicit?','A short participation agreement.'),
    capability('feedback','Impact observation and revision','civweave',2,'Can you decide whether to repeat, revise, or stop using evidence?','A dated review with a next decision.')
  )}
  else if(signal.learning){out.push(
    capability('outcome-design','Observable learning-outcome design','living-school',3,'Can you describe what the learner will do and what counts as evidence?','An observable outcome and assessment condition.'),
    capability('subject-knowledge','Subject-matter knowledge','living-school',3,'Can you explain and demonstrate the target capability accurately?','A source-aware explanation and demonstration.'),
    capability('practice-design','Practice and feedback design','living-school',2,'Can you create guided and fresh practice with useful feedback?','A practice sequence with feedback criteria.'),
    capability('learning-artifact','Learning artifact production','cerbanimo',2,'Can you build the lesson, tool, or practicum artifact?','A usable artifact tested by one learner.'),
    capability('accessibility','Access, consent, and learner support','anarchadia',2,'Have access needs, privacy, consent, and support boundaries been addressed?','A learner-support and access check.')
  )}
  else out.push(
    capability('outcome','Outcome and scope definition','civweave',3,'Can you define an observable result and what is outside scope?','A bounded outcome with completion criteria.'),
    capability('domain','Required domain knowledge','living-school',3,'Can you explain the key principles and risks involved?','A source-aware brief and fresh demonstration.'),
    capability('execution','Hands-on execution','cerbanimo',3,'Can you produce the smallest visible result and debug it?','A working artifact or completed service cycle.'),
    capability('resources','Tools, materials, and logistics','fellowfare',2,'Can you obtain the required tools, materials, space, and timing?','A confirmed resource and logistics list.'),
    capability('review','Evidence, review, and revision','cerbanimo',2,'Can you test the result against explicit criteria and revise it?','Test evidence and a revision record.'),
    capability('consent','Consent, responsibility, and decision boundaries','anarchadia',2,'Are affected people, decisions, obligations, and exit paths explicit?','A responsibility and consent note.')
  );
  return out.slice(0,10)
}
function preparedLevel(cap){
  const current=Number.isInteger(cap.currentLevel)?cap.currentLevel:0,required=Math.max(1,Number(cap.requiredLevel)||1);
  if(current>=required)return current;
  if(cap.posture==='learn'||cap.posture==='recruit')return required;
  if(cap.posture==='practice')return Math.min(required,current+1);
  if(cap.posture==='simplify')return Math.max(current,required-1);
  return current;
}
function metrics(caps){
  const total=rows(caps).reduce((sum,cap)=>sum+Math.max(1,Number(cap.requiredLevel)||1),0)||1;
  const current=rows(caps).reduce((sum,cap)=>sum+Math.min(Math.max(0,Number.isInteger(cap.currentLevel)?cap.currentLevel:0),Math.max(1,Number(cap.requiredLevel)||1)),0);
  const prepared=rows(caps).reduce((sum,cap)=>sum+Math.min(preparedLevel(cap),Math.max(1,Number(cap.requiredLevel)||1)),0);
  const assessed=rows(caps).filter(cap=>Number.isInteger(cap.currentLevel)).length;
  const unresolved=rows(caps).filter(cap=>Number.isInteger(cap.currentLevel)&&cap.currentLevel<cap.requiredLevel&&!POSTURES[cap.posture]).length;
  const complete=rows(caps).length>0&&assessed===rows(caps).length&&unresolved===0;
  const preparedScore=Math.round(prepared/total*100),currentScore=Math.round(current/total*100);
  const label=!complete?'Assessment incomplete':preparedScore>=90?'Prepared to begin':preparedScore>=70?'Begin with support':preparedScore>=45?'Preparation required':'Rescope before beginning';
  return{currentScore,preparedScore,assessed,totalCapabilities:rows(caps).length,complete,unresolved,label}
}
function ensure(plan){
  if(!plan?.id)return null;
  const store=readStore(),existing=store.plans[plan.id],base=templates(plan),byId=new Map(rows(existing?.capabilities).map(cap=>[cap.id,cap]));
  const capabilities=base.map(cap=>({...cap,...(byId.get(cap.id)||{}),requiredLevel:cap.requiredLevel,prompt:cap.prompt,evidenceHint:cap.evidenceHint,realm:cap.realm,title:cap.title}));
  const record={schema:'civweave.capability-map.v154',planId:plan.id,title:plan.title||'Untitled intention',capabilities,metrics:metrics(capabilities),updatedAt:now()};
  store.plans[plan.id]=record;writeStore(store);return record
}
function get(planId){return readStore().plans[planId]||null}
function uniquePush(list,value){if(value&&!list.includes(value))list.push(value)}
function applyRoutes(plan,record){
  if(!plan||!record)return plan;
  const paths=rows(plan.paths);plan.paths=paths;
  const find=realm=>paths.find(path=>path.realm===realm);
  const makePath=(realm,type,title,purpose,completionCriteria,evidence)=>{
    let route=find(realm);
    if(!route){route={id:`readiness-${realm}-${plan.id}`,type,realm,title,purpose,steps:[],completionCriteria,evidence,status:'draft',source:'capability-readiness-v154'};paths.push(route)}
    route.steps=rows(route.steps);route.evidence=rows(route.evidence);return route
  };
  const gaps=record.capabilities.filter(cap=>cap.currentLevel<cap.requiredLevel&&cap.posture&&cap.posture!=='ready');
  const needsLearning=gaps.some(cap=>cap.posture==='learn'||cap.posture==='practice');
  const needsWork=gaps.some(cap=>cap.posture==='practice');
  const needsRecruitment=gaps.some(cap=>cap.posture==='recruit');
  const learn=find('living-school')||(needsLearning?makePath('living-school','learning','Build the required capability','Learn or practice only the gaps that the reviewed intention actually requires.','The selected capabilities are demonstrated with evidence in the intended context.',['Capability demonstration','Practice evidence','Remaining-uncertainty note']):null);
  const work=find('cerbanimo')||(needsWork?makePath('cerbanimo','skilled-labor','Practice through consequential work','Turn selected practice gaps into supported project checkpoints.','The visible result is completed with inspectable practice and review evidence.',['Working artifact','Checkpoint evidence','Revision record']):null);
  const materials=find('fellowfare')||(needsRecruitment?makePath('fellowfare','material-acquirement','Recruit the missing capability','Find a collaborator or provider with explicit role, timing, terms, and handoff evidence.','The missing capability is covered by an agreed and reviewable source.',['Need or role card','Agreement or terms record','Handoff confirmation']):null);
  if(learn)learn.steps=rows(learn.steps);if(work)work.steps=rows(work.steps);if(materials)materials.steps=rows(materials.steps);
  const simplifications=[];
  for(const cap of record.capabilities){
    if(cap.currentLevel>=cap.requiredLevel||cap.posture==='ready')continue;
    if(cap.posture==='learn'&&learn)uniquePush(learn.steps,`Learn and demonstrate: ${cap.title}. Evidence: ${cap.evidenceHint}`);
    if(cap.posture==='practice'){
      if(learn)uniquePush(learn.steps,`Practice during the project: ${cap.title}. Use the work as a practicum and preserve feedback.`);
      if(work)uniquePush(work.steps,`Create a supported checkpoint for ${cap.title}; attach practice evidence before independent completion.`)
    }
    if(cap.posture==='recruit'&&materials)uniquePush(materials.steps,`Find a collaborator or provider for ${cap.title}; make role, timing, terms, and handoff evidence explicit.`);
    if(cap.posture==='simplify')simplifications.push(`Reduce the requirement for ${cap.title} from level ${cap.requiredLevel} to level ${Math.max(0,cap.requiredLevel-1)}, or remove the dependent scope.`)
  }
  plan.capabilityReadiness={schema:record.schema,planId:plan.id,metrics:record.metrics,capabilities:record.capabilities.map(cap=>({id:cap.id,title:cap.title,realm:cap.realm,requiredLevel:cap.requiredLevel,currentLevel:cap.currentLevel,posture:cap.currentLevel>=cap.requiredLevel?'ready':cap.posture,preparedLevel:preparedLevel(cap),evidenceHint:cap.evidenceHint}))};
  plan.assumptions=rows(plan.assumptions);for(const note of simplifications)uniquePush(plan.assumptions,note);
  plan.updatedAt=now();return plan
}
function persist(planId){
  const located=locate(planId);if(!located.plan)return{ok:false,error:'The saved weave could not be found.'};
  const record=ensure(located.plan);applyRoutes(located.plan,record);located.item.plan=located.plan;located.item.updatedAt=located.plan.updatedAt;located.item.text=located.plan.title;writeIntentions(located.items);
  if(located.item.state==='active')globalThis.CivweaveCoreLoopV152?.activate?.(located.plan);
  return{ok:true,plan:located.plan,record}
}
function update(planId,capabilityId,patch={}){
  const located=locate(planId);if(!located.plan)return{ok:false,error:'The saved weave could not be found.'};const record=ensure(located.plan),cap=record.capabilities.find(item=>item.id===capabilityId);if(!cap)return{ok:false,error:'The capability could not be found.'};
  if(patch.currentLevel!=null){const level=Math.max(0,Math.min(4,Number(patch.currentLevel)));cap.currentLevel=Number.isFinite(level)?level:null;if(cap.currentLevel>=cap.requiredLevel)cap.posture='ready';else if(cap.posture==='ready')cap.posture=''}
  if(patch.posture!=null&&POSTURES[patch.posture])cap.posture=cap.currentLevel>=cap.requiredLevel?'ready':patch.posture;
  record.metrics=metrics(record.capabilities);record.updatedAt=now();const store=readStore();store.plans[planId]=record;writeStore(store);persist(planId);renderOpen();return{ok:true,record,capability:cap}
}
function lane(planId,system){const record=get(planId),caps=rows(record?.capabilities).filter(cap=>system==='civweave'||cap.realm===system||POSTURES[cap.posture]?.realm===system);return{system,metrics:record?.metrics||metrics([]),capabilities:caps}}
function ensureStyle(){
  if(document.getElementById('cr154-style'))return;const style=document.createElement('style');style.id='cr154-style';style.textContent=`
  .cr154-summary{margin:12px 0;padding:12px;border:1px solid #ffffff2e;border-radius:14px;background:#55bfe012}.cr154-summary header{display:flex;align-items:center;justify-content:space-between;gap:10px}.cr154-summary h3,.cr154-summary p{margin:3px 0}.cr154-score{font:900 20px/1 system-ui}.cr154-summary button,.cr154-dialog button{border:0;border-radius:10px;padding:8px 11px;font-weight:800;cursor:pointer}.cr154-summary button{background:#7fe0ff;color:#021018}.cr154-lanes{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.cr154-chip{padding:5px 8px;border-radius:999px;background:#ffffff14;font:700 12px/1.2 system-ui}.cr154-dialog{width:min(96vw,850px);max-height:92vh;padding:0;border:1px solid #ffffff42;border-radius:22px;background:#07131ef8;color:#fff}.cr154-dialog::backdrop{background:#000c}.cr154-shell{display:grid;grid-template-rows:auto minmax(0,1fr) auto;max-height:92vh}.cr154-head{display:flex;align-items:start;gap:12px;padding:16px;border-bottom:1px solid #ffffff25}.cr154-head div{flex:1}.cr154-head h2,.cr154-head p{margin:3px 0}.cr154-meters{display:flex;gap:12px;flex-wrap:wrap;margin-top:8px}.cr154-meters span{padding:6px 9px;border-radius:999px;background:#ffffff13}.cr154-list{display:grid;gap:12px;overflow:auto;padding:16px}.cr154-cap{display:grid;gap:9px;padding:14px;border:1px solid #ffffff24;border-radius:16px;background:#ffffff0c}.cr154-cap header{display:flex;justify-content:space-between;gap:10px}.cr154-cap h3,.cr154-cap p{margin:2px 0}.cr154-cap small{opacity:.72}.cr154-controls{display:grid;grid-template-columns:minmax(130px,1fr) minmax(180px,1.4fr);gap:10px}.cr154-controls label{display:grid;gap:5px;font-weight:700}.cr154-controls select{width:100%;padding:9px;border-radius:10px;background:#051018;color:#fff;border:1px solid #ffffff35}.cr154-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px calc(14px + env(safe-area-inset-bottom));border-top:1px solid #ffffff25}.cr154-foot button:last-child{background:#7fe0ff;color:#021018}.cr154-warning{color:#ffd58a}.gc153-shell>.cr154-summary{margin:10px 16px 0}.cw138-plan>.cr154-summary{margin:14px 0}@media(max-width:620px){.cr154-controls{grid-template-columns:1fr}.cr154-head{display:block}.cr154-foot{align-items:stretch;flex-direction:column}}
  `;document.head.append(style)
}
function summaryMarkup(plan,record,system='civweave'){
  if(!plan||!record)return'';const info=lane(plan.id,system),caps=info.capabilities.slice(0,5),realm=SYSTEM_LABELS[system]||system;
  return`<section class="cr154-summary" data-cr-summary="${esc(plan.id)}"><header><div><small>${esc(realm.toUpperCase())} CAPABILITY ROUTE</small><h3>${esc(record.metrics.label)}</h3></div><strong class="cr154-score">${record.metrics.preparedScore}%</strong></header><p>${record.metrics.assessed}/${record.metrics.totalCapabilities} starting levels mapped · current ${record.metrics.currentScore}% · prepared ${record.metrics.preparedScore}%</p><div class="cr154-lanes">${caps.map(cap=>`<span class="cr154-chip">${esc(cap.title)} · ${esc(cap.currentLevel==null?'unrated':POSTURES[cap.posture]?.label||'choose route')}</span>`).join('')||'<span class="cr154-chip">No capability assigned to this system yet.</span>'}</div><button type="button" data-cr-open="${esc(plan.id)}">${record.metrics.complete?'Review capability map':'Complete capability map'}</button></section>`
}
function dialog(){
  ensureStyle();let node=document.getElementById('cr154-dialog');if(node)return node;node=document.createElement('dialog');node.id='cr154-dialog';node.className='cr154-dialog';node.innerHTML='<section class="cr154-shell"><header class="cr154-head"><div><small>INTENTION STUDIO</small><h2>Capability readiness</h2><p>Rate your current starting point, then choose whether each gap should be learned, practiced in the project, recruited, or removed by simplifying scope.</p><div class="cr154-meters"></div></div><button type="button" data-cr-close>×</button></header><div class="cr154-list"></div><footer class="cr154-foot"><span data-cr-status></span><div><button type="button" data-cr-close>Close</button> <button type="button" data-cr-save>Save capability route</button></div></footer></section>';document.body.append(node);node.querySelectorAll('[data-cr-close]').forEach(button=>button.onclick=()=>node.close());node.addEventListener('click',event=>{if(event.target===node)node.close()});node.querySelector('.cr154-list').addEventListener('change',event=>{const control=event.target.closest('[data-cr-cap]');if(!control)return;const planId=node.dataset.planId,capabilityId=control.dataset.crCap,patch=control.dataset.field==='level'?{currentLevel:control.value}:{posture:control.value};update(planId,capabilityId,patch)});node.querySelector('[data-cr-save]').onclick=()=>{const out=persist(node.dataset.planId),status=node.querySelector('[data-cr-status]');status.textContent=out.ok?(out.record.metrics.complete?'Capability route saved. The weave can be activated.':'Capability route saved. Finish the unrated or unresolved capabilities before activation.'):out.error||'Could not save.';renderDialog(node.dataset.planId)};return node
}
function renderDialog(planId){
  const node=dialog(),located=locate(planId);if(!located.plan)return;const record=ensure(located.plan);node.dataset.planId=planId;node.querySelector('.cr154-meters').innerHTML=`<span>Current readiness <b>${record.metrics.currentScore}%</b></span><span>Prepared readiness <b>${record.metrics.preparedScore}%</b></span><span>${esc(record.metrics.label)}</span>`;node.querySelector('.cr154-list').innerHTML=record.capabilities.map(cap=>`<article class="cr154-cap"><header><div><small>${esc(SYSTEM_LABELS[cap.realm]||cap.realm)} · required level ${cap.requiredLevel}</small><h3>${esc(cap.title)}</h3></div><b>${cap.currentLevel==null?'?':cap.currentLevel} → ${preparedLevel(cap)}</b></header><p>${esc(cap.prompt)}</p><small>Evidence hint: ${esc(cap.evidenceHint)}</small><div class="cr154-controls"><label>Current level<select data-cr-cap="${esc(cap.id)}" data-field="level"><option value="" ${cap.currentLevel==null?'selected':''} disabled>Choose 0–4</option>${[0,1,2,3,4].map(level=>`<option value="${level}" ${cap.currentLevel===level?'selected':''}>${level} · ${['No experience','Recognize with support','Guided practice','Independent use','Can teach or adapt'][level]}</option>`).join('')}</select></label><label>How should this gap be handled?<select data-cr-cap="${esc(cap.id)}" data-field="posture" ${cap.currentLevel==null||cap.currentLevel>=cap.requiredLevel?'disabled':''}><option value="" ${!cap.posture?'selected':''}>Choose a route</option>${Object.entries(POSTURES).filter(([key])=>key!=='ready').map(([key,value])=>`<option value="${key}" ${cap.posture===key?'selected':''}>${esc(value.label)}</option>`).join('')}</select></label></div></article>`).join('');node.querySelector('[data-cr-status]').textContent=record.metrics.complete?'All capabilities have a starting level and route.':'Map every starting level and choose a route for each gap.';return record
}
function openReadiness(planId){const located=locate(planId);if(!located.plan)return null;const node=dialog();renderDialog(planId);if(!node.open)node.showModal();return node}
function injectReview(){
  ensureStyle();for(const card of document.querySelectorAll('.cw138-plan[data-plan-id]')){const planId=card.dataset.planId,located=locate(planId);if(!located.plan)continue;const record=ensure(located.plan),old=card.querySelector(':scope > .cr154-summary');if(old)old.remove();const host=card.querySelector('.cw138-plan-paths')||card;host.insertAdjacentHTML('beforebegin',summaryMarkup(located.plan,record,'civweave'))}
}
function injectChat(){
  const shell=document.querySelector('#gc153-dialog .gc153-shell');if(!shell)return;const system=document.getElementById('gc153-dialog')?.dataset.system||globalThis.CivweaveGuideChatV153?.detectSystem?.()||'civweave',plan=activePlan();if(!plan)return;const record=ensure(plan),old=shell.querySelector(':scope > .cr154-summary');if(old)old.remove();shell.querySelector('.gc153-head')?.insertAdjacentHTML('afterend',summaryMarkup(plan,record,system))
}
function renderOpen(){injectReview();injectChat();const node=document.getElementById('cr154-dialog');if(node?.open&&node.dataset.planId)renderDialog(node.dataset.planId)}
function handleOpen(event){const button=event.target.closest?.('[data-cr-open]');if(!button)return;event.preventDefault();event.stopPropagation();openReadiness(button.dataset.crOpen)}
function hookActivation(){
  const ui=globalThis.CivweaveIntentionUI;if(!ui?.activate||ui.__capabilityReadinessV154)return false;const original=ui.activate.bind(ui);ui.activate=planId=>{const located=locate(planId);if(!located.plan)return original(planId);const record=ensure(located.plan);if(!record.metrics.complete){openReadiness(planId);return{ok:false,error:'Complete the capability map before activating this weave.',readiness:record.metrics}}const saved=persist(planId);if(!saved.ok)return saved;return original(planId)};ui.__capabilityReadinessV154=true;return true
}
let queued=false;function queueRender(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;hookActivation();renderOpen()})}
function boot(){ensureStyle();hookActivation();document.addEventListener('click',handleOpen,true);addEventListener('civweave:intentions-changed',queueRender);new MutationObserver(queueRender).observe(document.documentElement,{childList:true,subtree:true});const plan=activePlan();if(plan)ensure(plan);queueRender()}
document.readyState==='loading'?addEventListener('DOMContentLoaded',boot,{once:true}):boot();
globalThis.CivweaveCapabilityReadinessV154={version:VERSION,keys:KEYS,postures:POSTURES,templates,ensure,get,update,persist,metrics,preparedLevel,lane,activePlan,open:openReadiness,render:renderOpen};
})();
