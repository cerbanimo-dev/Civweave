(()=>{
'use strict';
const VERSION='1.0.0-living-school-pending-plan-review-v1';
const KEY='civweave.chat.capability.pending.living-school.plan.v1';
const ID='lsc218-pending-learning-plan-review';
const clean=(x,n=12000)=>String(x??'').trim().slice(0,n);
const esc=x=>clean(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let priorFingerprint='';
function readPlan(){
  try{
    const p=JSON.parse(localStorage.getItem(KEY)||'null');
    return p?.schema==='civweave.learning-journey-plan.v2'&&p.state==='review'&&
      p.requiresExplicitApproval===true&&p.id&&Array.isArray(p.modules)&&p.modules.length>=3?p:null;
  }catch{return null}
}
function openMoss(){
  for(const w of [globalThis,globalThis.parent]){
    try{const chat=w?.CivweaveGuideChatSurfaceV350||w?.CivweavePersistentGuideChatV215;
      if(typeof chat?.open==='function'){chat.open({guide:'living-school',focus:true});return true}
    }catch{}
  }
  location.assign('/app/working-campus-v440.html?source=moss-pending-review');
  return false;
}
function ensurePanel(){
  const app=document.getElementById('living-school-app');if(!app)return null;
  let box=document.getElementById(ID);if(box)return box;
  box=document.createElement('section');box.id=ID;box.setAttribute('aria-label','Learning Journey awaiting Moss review');
  const header=app.querySelector('.lsc218-header');
  if(header?.after)header.after(box);else app.prepend(box);
  box.style.cssText='margin:12px 16px;padding:15px;border:1px solid #8faeb3;border-radius:14px;background:#152b31;color:#f4f9fb;font:13px/1.5 system-ui,sans-serif';
  return box;
}
function render(){
  const plan=readPlan(),box=ensurePanel();if(!box)return false;
  if(!plan){box.hidden=true;box.textContent='';priorFingerprint='';return false}
  const stamp=plan.id+'|'+plan.updatedAt+'|'+plan.state;
  if(stamp===priorFingerprint&&box.childElementCount)return true;
  priorFingerprint=stamp;box.hidden=false;
  const req=plan.request||{};
  const items=plan.modules.slice(0,8).map((m,i)=>'<li style="margin-bottom:9px"><b>'+
    esc((i+1)+'. '+clean(m.title,150))+'</b><div>Focus: '+esc(clean(m.focus,650))+
    '</div><div>Demonstrate: '+esc(clean(m.outcome,650))+'</div></li>').join('');
  box.innerHTML='<small style="color:#b2d2d4">MOSS · LIVING SCHOOL REVIEW QUEUE</small><h2 style="margin:5px 0;font-size:18px">'+
    esc(clean(req.title,160)||'Learning Journey')+'</h2><p><b>REVIEW — explicit approval required</b></p>'+
    '<p><b>Goal:</b> '+esc(clean(req.capability,400))+'</p>'+
    '<p>This is a saved high-level plan. No lessons or quizzes have been created yet.</p>'+
    '<details><summary style="cursor:pointer;font-weight:bold">Review '+plan.modules.length+' planned modules</summary>'+
    '<ol>'+items+'</ol><p><b>Proof:</b> '+esc(clean(req.proof,450))+'</p></details>'+
    '<button type="button" data-moss-open style="padding:10px 13px;border:1px solid #9ac8d1;border-radius:9px;background:#214956;color:#eefbfe;font-weight:bold;min-height:42px;margin-top:9px">Open Moss to review or approve</button>';
  box.querySelector('[data-moss-open]')?.addEventListener('click',openMoss);
  return true;
}
let queued=false;
function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;render()})}
function start(){
  render();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
  for(const name of ['pageshow','focus','civweave:living-school-workbench-ready','civweave:living-school-pending-plan-review'])
    addEventListener(name,schedule);
  if(typeof MutationObserver==='function'){
    const app=document.getElementById('living-school-app')||document.body;
    new MutationObserver(()=>{if(!document.getElementById(ID))schedule()}).observe(app,{childList:true});
  }
}
globalThis.CivweaveLivingSchoolPendingPlanReviewV1=Object.freeze({version:VERSION,render,readPlan,openMoss,reviewOnly:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();