(()=>{
'use strict';
if(globalThis.CivweaveBasicValueSystemsV1)return;
const VERSION='1.2.0-explicit-subject-review';
const KEYS=Object.freeze({civweave:'civweave.working-campus.v1',living:'civweave.living-school.cabinet.v151',cerbanimo:'cerbanimo.quest-engine.v144'});
const clean=(value,max=5000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const now=()=>new Date().toISOString();
const REVIEW=()=>globalThis.CivweaveBasicValueReviewV1;
const feedback=new Map();let running=false,timer=0;
function hash(value){let h=2166136261;for(const ch of clean(value,24000)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(36)}
function textFor(row){return clean([row?.title,row?.name,row?.description,row?.summary,row?.objective,row?.prompt,row?.deliverable,row?.artifact,Array.isArray(row?.acceptanceCriteria)?row.acceptanceCriteria.join(' '):'',Array.isArray(row?.completionCriteria)?row.completionCriteria.join(' '):'',row?.estimatedEffort].filter(Boolean).join('\n'),7000)}
function kindFor(system,row){
  const text=textFor(row).toLowerCase();
  if(/mentor|mentorship|on[- ]the[- ]job|job training|apprentice/.test(text))return'mentorship';
  if(system==='living-school')return'curriculum';
  if(system==='learning')return'learning';
  return'labor';
}
function fingerprint(system,row){return hash(JSON.stringify({system,id:row?.id||'',kind:kindFor(system,row),text:textFor(row),criteria:row?.acceptanceCriteria||row?.completionCriteria||[],evidence:row?.proofRequired||row?.proof||row?.artifact||row?.deliverable||''}))}
function needs(system,row){
  if(!row||typeof row!=='object')return false;
  const fp=fingerprint(system,row),valuation=row.valuation;
  return !valuation||valuation.inputFingerprint!==fp||!['model-reviewed-fair','model-reviewed-adjusted'].includes(valuation.status);
}
function subject(system,row,index){
  return{id:clean(row?.id||`${system}-${index+1}`,220),system,kind:kindFor(system,row),title:clean(row?.title||row?.name||`Work ${index+1}`,300),description:textFor(row),acceptanceCriteria:row?.acceptanceCriteria||row?.completionCriteria||[],evidence:row?.proofRequired||row?.proof||row?.artifact||row?.deliverable||'',laborWorthHours:row?.laborWorthHours,educationalHours:row?.educationalHours,curriculumAcorns:row?.curriculumAcorns,mentorshipMode:row?.mentorshipMode,valuationRationale:row?.valuationRationale||row?.valuation?.proposed?.rationale,valuationProvider:row?.generation?.provider||row?.valuation?.estimator?.provider,valuationModel:row?.generation?.model||row?.valuation?.estimator?.model,valuation:row?.valuation};
}
function refsForCiv(state){
  const out=[];for(const path of state?.plan?.paths||[]){const system=path?.realm==='living-school'?'learning':path?.realm||'civweave';for(const row of path?.tasks||[])out.push({system,row,scope:JSON.stringify([state.plan.id||'',path.id||''])})}return out;
}
function refsForLiving(state){return(state?.school?.modules||[]).map(row=>({system:'living-school',row,scope:JSON.stringify([state.school.id||''])}))}
function refsForCerbanimo(state){const out=[];for(const quest of state?.quests||[])for(const row of quest?.tasks||[])out.push({system:'cerbanimo',row,scope:JSON.stringify([quest.id||''])});return out}
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
function requestFor(value){
  if(!value||typeof value!=='object'||!Object.values(KEYS).includes(value.key)||!Array.isArray(value.ids)||!value.ids.length||value.ids.length>24)return null;
  if(value.ids.some(id=>typeof id!=='string'||!id.trim()||id.length>220))return null;
  return{key:value.key,ids:[...new Set(value.ids)]};
}
function uniqueRef(refs,id){const matches=refs.filter(ref=>ref.row?.id===id);return matches.length===1?matches[0]:null}
async function processKey({key,ids}){
  const bundle=readRefs(key);if(!bundle)return false;
  const pending=ids.map(id=>uniqueRef(bundle.refs,id)).filter(ref=>ref&&needs(ref.system,ref.row)).map(ref=>({...ref,inputFingerprint:fingerprint(ref.system,ref.row)}));if(!pending.length)return false;
  const runtime=globalThis.CivweaveModelRuntime,review=REVIEW();if(!runtime?.generate||!review)return false;
  const subjects=pending.map((ref,index)=>subject(ref.system,ref.row,index));
  const results=await review.reviewSubjects(runtime,subjects,{purpose:`civweave-${key===KEYS.living?'living-school':key===KEYS.cerbanimo?'cerbanimo':'working-campus'}-economic-review-v1`});
  // A review may take minutes. Only merge valuation fields into the current
  // record; the captured state must never replace newer proof or selection.
  const fresh=readRefs(key);if(!fresh)return false;let changed=0;
  for(const ref of pending){
    const current=uniqueRef(fresh.refs,ref.row.id),matches=(Array.isArray(results)?results:[]).filter(item=>item?.id===ref.row.id),valuation=matches.length===1?matches[0].valuation:null;
    if(!valuation||!current||current.system!==ref.system||current.scope!==ref.scope||fingerprint(current.system,current.row)!==ref.inputFingerprint)continue;
    apply(current.row,current.system,valuation);changed++;
  }
  if(changed){
    localStorage.setItem(key,JSON.stringify(fresh.state));
    try{dispatchEvent(new CustomEvent('civweave:economic-valuations-updated',{detail:{key,count:changed,at:now()}}))}catch{}
  }
  return changed>0;
}
function valuationText(v,{learning=false}={}){
  if(!v)return'Not reviewed. Choose Review economic value to request a model estimate and fairness review.';
  const parts=[];
  if(v.laborWorthHours>0)parts.push(`${v.laborWorthHours}h human-equivalent`);
  if(v.educationalHours>0)parts.push(`${v.educationalHours}h educational`);
  if(v.baseline?.buttons>0){
    const rate=Number(v.baseline?.wageRateButtonsPerHour||globalThis.CivweaveBasicValueV1?.guide?.labor?.wageButtonsPerHour||5);
    parts.push(`${v.baseline.buttons} 🔘 wage · ${rate} 🔘/h uniform rate`);
  }
  if(v.baseline?.acorns>0)parts.push(`${v.baseline.acorns} 🌰 Acorns${learning?' curriculum reference':' baseline'}`);
  parts.push(clean(v.status,120).replace(/^model-/,'').replace(/-/g,' ')||'unreviewed');
  return parts.join(' · ');
}
function decorateValue(node,row,system,key,{learning=false}={}){
  node.textContent=`${learning?'Economic value review':'Value review'}: ${valuationText(row.valuation?.inputFingerprint===fingerprint(system,row)?row.valuation:null,{learning})}. ${learning?"This is a curriculum-market reference, not the learner's completion reward or an automatic charge.":'The Button rate is the same starting wage for everyone; the model only judges human-equivalent hours. This record does not transfer currency.'}`;
  const message=feedback.get(`${key}:${row.id}`);if(message){const status=document.createElement('span');status.textContent=` ${message}`;status.setAttribute('role','status');node.append(status)}
  if(!row.id)return;
  const unreviewed=needs(system,row),button=document.createElement('button');button.type='button';button.textContent=unreviewed?'Review economic value':'Economic value reviewed';button.disabled=running||!unreviewed;button.dataset.economicReviewId=row.id;button.setAttribute('aria-label',`Review economic value for ${clean(row.title||row.name||row.id,300)}`);
  button.addEventListener('click',async()=>{
    const request={key,ids:[row.id]};button.disabled=true;button.textContent='Review requested…';feedback.set(`${key}:${row.id}`,'Review requested.');
    try{
      const loader=globalThis.CivweaveFamilyAILoaderV105;
      const changed=loader?.requestEconomicReview?await loader.requestEconomicReview(request):await run(request);
      feedback.set(`${key}:${row.id}`,changed?'Review saved.':'No review saved. Check that this item still exists, has unchanged scope, and a model is available; then try again.');
    }catch(error){feedback.set(`${key}:${row.id}`,`Review failed: ${clean(error?.message||error,500)}`)}
    decorate();
  });node.append(button);
}
function decorateCerbanimo(){
  const bundle=readRefs(KEYS.cerbanimo);if(!bundle)return;
  for(const card of document.querySelectorAll?.('.cq144-task[data-task-id]')||[]){
    const row=uniqueRef(bundle.refs,card.dataset.taskId)?.row;if(!row)continue;let node=card.querySelector('[data-economic-valuation]');
    if(!node){node=document.createElement('div');node.dataset.economicValuation='';node.className='cq144-warning';card.querySelector('header')?.insertAdjacentElement('afterend',node)}
    decorateValue(node,row,'cerbanimo',KEYS.cerbanimo);
  }
}
function decorateLiving(){
  const bundle=readRefs(KEYS.living),panel=document.querySelector?.('.lsc218-lesson');if(!bundle||!panel)return;
  const id=clean(bundle.state?.activeModuleId,220),row=bundle.refs.find(ref=>ref.row?.id===id)?.row||bundle.refs[0]?.row;if(!row)return;
  let node=panel.querySelector('[data-economic-valuation]');
  if(!node){node=document.createElement('div');node.dataset.economicValuation='';node.className='lsc218-note';panel.querySelector('header')?.insertAdjacentElement('afterend',node)}
  decorateValue(node,row,'living-school',KEYS.living,{learning:true});
}
function decorate(){decorateCerbanimo();decorateLiving()}
async function run(value){const request=requestFor(value);if(!request||running)return false;running=true;try{decorate();return await processKey(request)}finally{running=false;decorate()}}
function schedule(delay=350){clearTimeout(timer);timer=setTimeout(decorate,Math.max(0,Number(delay)||0))}
function start(){
  addEventListener('civweave:working-campus-plan-built',()=>schedule(200));
  addEventListener('cerbanimo:quest-engine-changed',()=>schedule(200));
  for(const name of ['living-school:module-completed','living-school:assessment-completed'])addEventListener(name,()=>schedule(200));
  addEventListener('storage',event=>{if(Object.values(KEYS).includes(event.key))schedule(250)});
  decorate();
}
const api=Object.freeze({version:VERSION,keys:KEYS,run,schedule,kindFor,needs,valuationText,eventDriven:true,explicitSubjectDemand:true,polling:false,initialRun:false,domObserver:false});
globalThis.CivweaveBasicValueSystemsV1=api;
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
