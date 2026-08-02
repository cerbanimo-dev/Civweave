(()=>{
'use strict';
const KEY='commonweave.intentions.v127';
const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed==null?fallback:parsed}catch{return fallback}};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const items=()=>{const value=parse(localStorage.getItem(KEY),[]);return Array.isArray(value)?value:[]};
const save=value=>localStorage.setItem(KEY,JSON.stringify(value.slice(0,100)));
let dialog=null;

function ensureDialog(){
  if(dialog)return dialog;
  dialog=document.createElement('dialog');
  dialog.id='cw138-intentions';
  dialog.className='cw127-dialog cw138-intentions';
  dialog.innerHTML=`<section><header><div><small>ACTIVE INTENTIONS</small><h2>Review the weave</h2></div><button class="cw127-close" type="button" data-close aria-label="Close">×</button></header><div class="cw138-intention-list" data-list></div><form class="cw127-chat-form" data-add><input name="intention" maxlength="300" placeholder="Add a clear intention"><button>Add</button></form><menu><button type="button" data-clear-completed>Clear completed</button></menu></section>`;
  document.body.append(dialog);
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
  dialog.querySelector('[data-add]').addEventListener('submit',event=>{event.preventDefault();const input=event.currentTarget.intention,text=input.value.trim();if(!text)return;const current=items();current.unshift({id:`manual-${Date.now().toString(36)}`,text,done:false,state:'active',createdAt:new Date().toISOString()});save(current);input.value='';render()});
  dialog.querySelector('[data-clear-completed]').onclick=()=>{save(items().filter(item=>!item.done&&item.state!=='completed'));render()};
  dialog.querySelector('[data-list]').addEventListener('click',handleClick);
  dialog.querySelector('[data-list]').addEventListener('change',handleChange);
  return dialog;
}
function pathCard(path,index,total){
  return `<article class="cw138-path" data-path="${index}"><header><div><small>${esc(path.type||'path')} · ${esc(path.realm||'commonweave')}</small><h4>${esc(path.title||'Untitled path')}</h4></div><div class="cw138-path-actions"><button type="button" data-path-up="${index}" ${index===0?'disabled':''} aria-label="Move path earlier">↑</button><button type="button" data-path-down="${index}" ${index===total-1?'disabled':''} aria-label="Move path later">↓</button><button type="button" data-path-remove="${index}" class="cw138-danger">Remove</button></div></header><p>${esc(path.purpose||'')}</p><ol>${(path.steps||[]).map(step=>`<li>${esc(step)}</li>`).join('')}</ol><p><b>Completion:</b> ${esc(path.completionCriteria||'Review and define completion evidence.')}</p></article>`;
}
function planCard(item,index){
  const plan=item.plan||{},paths=Array.isArray(plan.paths)?plan.paths:[],state=item.state||plan.state||'review',governance=plan.governance;
  return `<article class="cw138-plan" data-item="${index}"><header><div><small>INTENTION WEAVE</small><h3>${esc(plan.title||item.text||'Untitled intention')}</h3></div><span class="cw138-plan-state ${state==='active'?'is-active':''}">${esc(state)}</span></header><label>Governing intention<input data-plan-title="${index}" value="${esc(plan.title||item.text||'')}"></label><label>Outcome<textarea data-plan-outcome="${index}">${esc(plan.outcome||'')}</textarea></label><div class="cw138-plan-paths">${paths.map((path,pathIndex)=>pathCard(path,pathIndex,paths.length)).join('')||'<p class="cw138-empty">No sub-paths remain. Add or regenerate a path before activation.</p>'}</div>${governance?`<section class="cw138-governance"><h4>${esc(governance.title||'Consent layer')}</h4><p>${esc(governance.purpose||'')}</p><ul>${(governance.agreements||[]).map(value=>`<li>${esc(value)}</li>`).join('')}</ul><p><b>Review:</b> ${esc(governance.reviewQuestion||'Who must explicitly agree?')}</p></section>`:''}<section class="cw138-assumptions"><h4>Assumptions to inspect</h4><ul>${(plan.assumptions||[]).map((value,assumptionIndex)=>`<li>${esc(value)} <button type="button" data-assumption-remove="${assumptionIndex}" aria-label="Remove assumption">×</button></li>`).join('')}</ul></section><p class="cw138-review-note">This weave does nothing consequential until you explicitly activate it. You can revise the intention, remove or reorder paths, and delete assumptions first.</p><div class="cw138-plan-actions"><button type="button" data-plan-save="${index}">Save revisions</button>${state==='active'?'<button type="button" data-plan-pause="'+index+'">Return to review</button>':'<button type="button" data-plan-activate="'+index+'">Activate weave</button>'}<button type="button" data-plan-delete="${index}" class="cw138-danger">Delete weave</button></div></article>`;
}
function render(){
  const node=ensureDialog(),current=items();
  node.querySelector('[data-list]').innerHTML=current.length?current.map((item,index)=>item?.kind==='weave-plan'?planCard(item,index):`<label class="cw138-basic-intention"><input type="checkbox" data-basic-index="${index}" ${item.done?'checked':''}><span>${esc(item.text||'Untitled intention')}</span></label>`).join(''):'<p class="cw138-empty">No active intentions yet. The loom is quiet, not broken.</p>';
}
function updatePlan(index,mutator){const current=items(),item=current[index];if(!item?.plan)return;mutator(item.plan,item);item.plan.updatedAt=new Date().toISOString();item.updatedAt=item.plan.updatedAt;item.text=item.plan.title;save(current);render()}
function handleClick(event){
  const button=event.target.closest('button');if(!button)return;const card=button.closest('[data-item]'),index=Number(card?.dataset.item);if(!Number.isInteger(index))return;
  if(button.dataset.pathUp!=null)updatePlan(index,plan=>{const i=Number(button.dataset.pathUp);if(i>0)[plan.paths[i-1],plan.paths[i]]=[plan.paths[i],plan.paths[i-1]]});
  else if(button.dataset.pathDown!=null)updatePlan(index,plan=>{const i=Number(button.dataset.pathDown);if(i<plan.paths.length-1)[plan.paths[i+1],plan.paths[i]]=[plan.paths[i],plan.paths[i+1]]});
  else if(button.dataset.pathRemove!=null)updatePlan(index,plan=>plan.paths.splice(Number(button.dataset.pathRemove),1));
  else if(button.dataset.assumptionRemove!=null)updatePlan(index,plan=>plan.assumptions.splice(Number(button.dataset.assumptionRemove),1));
  else if(button.dataset.planSave!=null)updatePlan(index,plan=>{plan.title=card.querySelector('[data-plan-title]').value.trim()||plan.title;plan.outcome=card.querySelector('[data-plan-outcome]').value.trim()||plan.outcome});
  else if(button.dataset.planActivate!=null)updatePlan(index,(plan,item)=>{plan.state='active';item.state='active';plan.activatedAt=new Date().toISOString()});
  else if(button.dataset.planPause!=null)updatePlan(index,(plan,item)=>{plan.state='review';item.state='review';delete plan.activatedAt});
  else if(button.dataset.planDelete!=null){const current=items();current.splice(index,1);save(current);render()}
}
function handleChange(event){const box=event.target.closest('[data-basic-index]');if(!box)return;const current=items(),item=current[Number(box.dataset.basicIndex)];if(item){item.done=box.checked;item.state=box.checked?'completed':'active';save(current);render()}}
function open(){const node=ensureDialog();render();for(const id of ['cw127-intentions']){const old=document.getElementById(id);if(old?.open){try{old.close()}catch{old.removeAttribute('open')}}}if(!node.open)node.showModal()}
document.addEventListener('click',event=>{const target=event.target.closest?.('[data-action="intentions"]');if(!target)return;event.preventDefault();event.stopImmediatePropagation();open()},true);
globalThis.CommonweaveIntentionUI={open,render};
})();
