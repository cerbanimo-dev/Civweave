import labor from '../../shared/labor-intelligence-core-v1.mjs?v=core-labor-v1';

const VERSION='1.0.0-fellowfare-labor-context-v1';
const STORE_KEY='fellowfare.mvp.state.v3';
const clean=(value,max=6000)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};

function state(){const value=parse(localStorage.getItem(STORE_KEY),{});return value&&typeof value==='object'?value:{}}
function save(value){localStorage.setItem(STORE_KEY,JSON.stringify(value))}
function queryForThread(thread={}){return clean([thread.title,thread.description,thread.category,thread.quantity,thread.when].filter(Boolean).join(' '),12000)}
function queryForAgreement(agreement={}){return clean([agreement.title,agreement.category,JSON.stringify(agreement.terms||{}),...(agreement.milestones||[]).map(row=>row.title||'')].filter(Boolean).join(' '),12000)}
function toast(message){const region=document.querySelector('#toastRegion');if(!region)return;const node=document.createElement('div');node.className='toast';node.textContent=message;region.append(node);setTimeout(()=>node.remove(),4200)}
function post(target,kind,title,payload){if(window.parent===window)return;window.parent.postMessage({type:'civweave:handoff',contractVersion:'civweave.handoff.v1',sourceApplication:'fellowfare',target,kind,title,payload,automaticEffect:false},location.origin)}

export async function enrichThread(threadId){
  const current=state(),thread=(current.threads||[]).find(row=>row.id===threadId);if(!thread)return null;
  const query=queryForThread(thread);if(!labor.isLaborQuery(query))return thread;
  const context=await labor.enrichWorkContext(query,{occupationLimit:3,forceOccupations:true});
  thread.laborContext=context;thread.normalizedOccupationRefs=(context.occupations||[]).map(row=>row.occupationCode).filter(Boolean);thread.updatedAt=new Date().toISOString();save(current);
  try{dispatchEvent(new CustomEvent('fellowfare:labor-context-enriched',{detail:{threadId,occupationRefs:thread.normalizedOccupationRefs}}))}catch{}
  return thread;
}

async function enrichNewestThread(snapshotBefore=[]){
  const current=state(),before=new Set(snapshotBefore),thread=(current.threads||[]).find(row=>!before.has(row.id)&&row.ownerId==='me');
  if(!thread)return null;return enrichThread(thread.id);
}

async function handoffWork(id){
  const current=state(),agreement=(current.agreements||[]).find(row=>row.id===id);if(!agreement)return;
  const context=await labor.enrichWorkContext(queryForAgreement(agreement),{occupationLimit:3,forceOccupations:true});
  post('cerbanimo','exchange-to-work',`Coordinate · ${agreement.title}`,{agreement:{id:agreement.id,title:agreement.title,category:agreement.category,terms:agreement.terms,milestones:agreement.milestones,participants:agreement.participants,status:agreement.status},laborContext:context,authority:{fellowfare:'agreement, settlement, repair',cerbanimo:'work planning, proof, review'},automaticEffect:false});
  toast(context.occupations?.length?'Sent to Cerbanimo with O*NET/ESCO labor context.':'Sent to Cerbanimo. Core labor context is unavailable on this build, so the agreement text is preserved unchanged.');
}

async function handoffLearning(id){
  const current=state(),thread=(current.threads||[]).find(row=>row.id===id);if(!thread)return;
  let context=thread.laborContext||null;const query=queryForThread(thread);
  if(labor.isLaborQuery(query))context=await labor.enrichWorkContext(query,{occupationLimit:3,forceOccupations:true});
  post('living','market-skill-gap',`Learn for · ${thread.title}`,{thread:{id:thread.id,mode:thread.mode,title:thread.title,description:thread.description,category:thread.category,laborContext:context},laborContext:context,prompt:`Build the smallest practical learning path that would help someone meet this need or offer this capability honestly: ${thread.title}. Use occupational references only to identify capability/skill coverage, never as procedural authority.`,automaticEffect:false});
  toast(context?.occupations?.length?'Sent to Living School with labor capability context.':'Sent to Living School with the original market context.');
}

let beforeSubmit=[];
document.addEventListener('submit',event=>{
  if(event.target?.id!=='composerForm')return;
  beforeSubmit=(state().threads||[]).map(row=>row.id);
  queueMicrotask(()=>enrichNewestThread(beforeSubmit).catch(error=>console.warn('[FellowFare labor context]',error)));
},false);

document.addEventListener('click',event=>{
  const work=event.target.closest?.('[data-handoff-work]'),learning=event.target.closest?.('[data-handoff-learning]');
  if(!work&&!learning)return;
  event.preventDefault();event.stopImmediatePropagation();
  const job=work?handoffWork(work.dataset.handoffWork):handoffLearning(learning.dataset.handoffLearning);
  job.catch(error=>{console.warn('[FellowFare labor handoff]',error);toast('The labor context handoff could not be prepared. Nothing was published or committed.')});
},true);

globalThis.CivweaveFellowFareLaborContextV1=Object.freeze({version:VERSION,enrichThread,handoffWork,handoffLearning});
