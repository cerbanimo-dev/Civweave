(()=>{
'use strict';
if(globalThis.CivweaveBasicValueSystemsV1)return;
const VERSION='1.0.3';
const KEYS=Object.freeze({civweave:'civweave.working-campus.v1',living:'civweave.living-school.cabinet.v151',cerbanimo:'cerbanimo.quest-engine.v144'});
const clean=(value,max=5000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const now=()=>new Date().toISOString();
const REVIEW=()=>globalThis.CivweaveBasicValueReviewV1;
const attempts=new Map();let running=false,timer=0,observer=null;
function hash(value){let h=2166136261;for(const ch of clean(value,24000)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(36)}
function textFor(row){return clean([row?.title,row?.name,row?.description,row?.summary,row?.objective,row?.prompt,row?.deliverable,row?.artifact,Array.isArray(row?.acceptanceCriteria)?row.acceptanceCriteria.join(' '):'',Array.isArray(row?.completionCriteria)?row.completionCriteria.join(' '):'',row?.estimatedEffort].filter(Boolean).join('\n'),7000)}
function kindFor(system,row){
  const text=textFor(row).toLowerCase();
  if(/mentor|mentorship|on[- ]the[- ]job|job training|apprentice/.test(text))return'mentorship';
  if(system==='living-school')return'curriculum';
  if(system==='learning')return'learning';
  return'labor';
}
function fingerprint(system,row){return hash(`${system}|${row?.id||''}|${textFor(row)}`)}
function needs(system,row){
  if(!row||typeof row!=='object')return false;
  const fp=fingerprint(system,row),valuation=row.valuation;
  return !valuation||valuation.inputFingerprint!==fp||!['model-reviewed-fair','model-reviewed-adjusted'].includes(valuation.status);
}
function subject(system,row,index){
  return{id:clean(row?.id||`${system}-${index+1}`,220),system,kind:kindFor(system,row),title:clean(row?.title||row?.name||`Work ${index+1}`,300),description:textFor(row),acceptanceCriteria:row?.acceptanceCriteria||row?.completionCriteria||[],evidence:row?.proofRequired||row?.proof||row?.artifact||row?.deliverable||'',laborWorthHours:row?.laborWorthHours,educationalHours:row?.educationalHours,curriculumAcorns:row?.curriculumAcorns,mentorshipMode:row?.mentorshipMode,valuationRationale:row?.valuationRationale||row?.valuation?.proposed?.rationale,valuationProvider:row?.generation?.provider||row?.valuation?.estimator?.provider,valuationModel:row?.generation?.model||row?.valuation?.estimator?.model,valuation:row?.valuation};
}
function refsForCiv(state){
  const out=[];for(const path of state?.plan?.paths||[]){const system=path?.realm==='living-school'?'learning':path?.realm||'civweave';for(const row of path?.tasks||[])out.push({system,row})}return out;
}
function refsForLiving(state){return(state?.school?.modules||[]).map(row=>({system:'living-school',row}))}
function refsForCerbanimo(state){const out=[];for(const quest of state?.quests||[])for(const row of quest?.tasks||[])out.push({system:'cerbanimo',row});return out}
function readRefs(key){
  const state=parse(localStorage.getItem(key),null);if(!state)return null;
  const refs=key===KEYS.civweave?refsForCiv(state):key===KEYS.living?refsForLiving(state):refsForCerbanimo(state);
  return{state,refs};
}
function apply(row,system,valuation){
  const fp=fingerprint(system,row);row.valuation={...valuation,inputFingerprint:fp,sourceSystem:system};
  if(valuation.laborWorthHours>0)row.laborWorthHours=valuation.laborWorthHours;
  if(valuation.educationalHours>0)row.educationalHours=valuation.educationalHours;
  if(system==='living-school'&&valuation.curriculumAcorns>0)row.curriculumAcorns=valuation.curriculumAcorns;
  if(valuation.mentorshipMode)row.mentorshipMode=valuation.mentorshipMode;
}
function backoffKey(key,fp){return`${key}:${fp}`}
function eligible(key,fp){const at=attempts.get(backoffKey(key,fp))||0;return Date.now()-at>120000}
async function processKey(key){
  const bundle=readRefs(key);if(!bundle)return false;
  const pending=bundle.refs.filter(ref=>needs(ref.system,ref.row)).filter(ref=>eligible(key,fingerprint(ref.system,ref.row))).slice(0,24);if(!pending.length)return false;
  const runtime=globalThis.CivweaveModelRuntime,review=REVIEW();if(!runtime?.generate||!review)return false;
  for(const ref of pending)attempts.set(backoffKey(key,fingerprint(ref.system,ref.row)),Date.now());
  const subjects=pending.map((ref,index)=>subject(ref.system,ref.row,index));
  let results;try{results=await review.reviewSubjects(runtime,subjects,{purpose:`civweave-${key===KEYS.living?'living-school':key===KEYS.cerbanimo?'cerbanimo':'working-campus'}-economic-review-v1`})}catch(error){console.info('[Civweave value review]',error.message);return false}
  const byId=new Map(results.map(item=>[item.id,item.valuation]));let changed=false;
  for(let i=0;i<pending.length;i++){const ref=pending[i],id=subjects[i].id,valuation=byId.get(id);if(!valuation)continue;apply(ref.row,ref.system,valuation);changed=true}
  if(changed){
    localStorage.setItem(key,JSON.stringify(bundle.state));
    try{dispatchEvent(new CustomEvent('civweave:economic-valuations-updated',{detail:{key,count:pending.length,at:now()}}))}catch{}
  }
  return changed;
}
function valuationText(v,{learning=false}={}){
  if(!v)return'awaiting model estimate + fairness rubric review';
  const parts=[];
  if(v.laborWorthHours>0)parts.push(`${v.laborWorthHours}h human-equivalent`);
  if(v.educationalHours>0)parts.push(`${v.educationalHours}h educational`);
  if(v.baseline?.buttons>0)parts.push(`${v.baseline.buttons} 🔘 Buttons baseline`);
  if(v.baseline?.acorns>0)parts.push(`${v.baseline.acorns} 🌰 Acorns${learning?' curriculum reference':' baseline'}`);
  parts.push(v.status.replace(/^model-/,'').replace(/-/g,' '));
  return parts.join(' · ');
}
function decorateCerbanimo(){
  const bundle=readRefs(KEYS.cerbanimo);if(!bundle)return;
  const byId=new Map(bundle.refs.map(ref=>[String(ref.row?.id||''),ref.row]));
  for(const card of document.querySelectorAll?.('.cq144-task[data-task-id]')||[]){
    const row=byId.get(card.dataset.taskId);if(!row)continue;let node=card.querySelector('[data-economic-valuation]');
    if(!node){node=document.createElement('div');node.dataset.economicValuation='';node.className='cq144-warning';card.querySelector('header')?.insertAdjacentElement('afterend',node)}
    node.textContent=`Value review: ${valuationText(row.valuation)}. Baseline is not an automatic payout.`;
  }
}
function decorateLiving(){
  const bundle=readRefs(KEYS.living),panel=document.querySelector?.('.lsc218-lesson');if(!bundle||!panel)return;
  const id=clean(bundle.state?.activeModuleId,220),row=bundle.refs.find(ref=>ref.row?.id===id)?.row||bundle.refs[0]?.row;if(!row)return;
  let node=panel.querySelector('[data-economic-valuation]');
  if(!node){node=document.createElement('div');node.dataset.economicValuation='';node.className='lsc218-note';panel.querySelector('header')?.insertAdjacentElement('afterend',node)}
  node.innerHTML=`<b>Economic value review</b><br>${valuationText(row.valuation,{learning:true})}. This is the shared curriculum-market reference, not the learner's completion reward and not an automatic charge.`;
}
function decorate(){decorateCerbanimo();decorateLiving()}
async function run(){if(running)return;running=true;try{for(const key of Object.values(KEYS))await processKey(key);decorate()}finally{running=false}}
function schedule(delay=350){clearTimeout(timer);timer=setTimeout(()=>run().catch(error=>console.warn('[Civweave value systems]',error)),delay)}
function start(){
  addEventListener('civweave:assistant-runtime-ready',()=>schedule(0));
  addEventListener('civweave:working-campus-plan-built',()=>schedule(200));
  addEventListener('cerbanimo:quest-engine-changed',()=>schedule(200));
  for(const name of ['living-school:module-completed','living-school:assessment-completed','civweave:basic-value-review-ready'])addEventListener(name,()=>schedule(200));
  addEventListener('storage',event=>{if(Object.values(KEYS).includes(event.key))schedule(250)});
  const root=document.querySelector?.('#living-school-root')||document.querySelector?.('#rc-app');if(root&&typeof MutationObserver!=='undefined'){observer=new MutationObserver(()=>schedule(180));observer.observe(root,{childList:true,subtree:true})}
  setInterval(()=>schedule(0),60000);schedule(1000);
}
const api=Object.freeze({version:VERSION,keys:KEYS,run,schedule,kindFor,needs,valuationText});
globalThis.CivweaveBasicValueSystemsV1=api;
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
})();