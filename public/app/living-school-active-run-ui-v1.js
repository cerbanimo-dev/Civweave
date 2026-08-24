(()=>{
'use strict';
const VERSION='1.1.0-living-school-active-run-ui-v1-source-pack-authority';
const GENERATE='[data-ls-action="generate-curriculum"]';
const REPORT='#lsc220-generation-recovery';
const PACK_DIALOG='dialog[data-living-school-media-pack-offer]';
const PACK_CHECK_ATTR='livingSchoolPackOfferCheck';
let queued=false;
let packOfferToken=0;
function active(button){
  if(!button)return false;
  const label=String(button.textContent||'');
  return button.getAttribute('aria-busy')==='true'||(button.disabled&&/researching|generating|regenerating|completing/i.test(label));
}
function sync(){
  queued=false;
  const button=document.querySelector(GENERATE),report=document.querySelector(REPORT),running=active(button);
  if(report){
    if(report.hidden!==running)report.hidden=running;
    const next=running?'true':'false';
    if(report.dataset.previousRunWhileGenerating!==next)report.dataset.previousRunWhileGenerating=next;
  }
  const root=document.documentElement,next=running?'true':'false';
  if(root.dataset.livingSchoolGenerationActive!==next)root.dataset.livingSchoolGenerationActive=next;
}
function schedule(){if(queued)return;queued=true;queueMicrotask(sync)}
const observer=new MutationObserver(schedule);
function foundationReadyFromRecommendation(pack){return Boolean(pack?.foundationReady===true||pack?.sourcePackCurrent===true||pack?.alreadyDownloaded===true)}
async function canonicalFoundationReady(pack){
  const slugs=Array.isArray(pack?.sourceSchoolSlugs)?[...new Set(pack.sourceSchoolSlugs.map(value=>String(value||'').trim()).filter(Boolean))]:[];
  if(!slugs.length)return false;
  const store=globalThis.CivweaveKnowledgeSchools;
  if(!store?.status)return false;
  try{
    const rows=await store.status(),bySlug=new Map((Array.isArray(rows)?rows:[]).map(row=>[row.school_slug,row]));
    return slugs.every(slug=>bySlug.get(slug)?.current===true);
  }catch(error){console.warn('[Living School pack authority]',error);return false}
}
function continuePastPackDialog(){
  const dialog=document.querySelector(PACK_DIALOG);
  if(!dialog)return false;
  const button=[...dialog.querySelectorAll('button')].find(node=>/continue to curriculum/i.test(String(node.textContent||'')));
  if(!button)return false;
  button.click();
  return true;
}
async function suppressRedundantPackOffer(event){
  const token=++packOfferToken,recommendations=Array.isArray(event?.detail?.recommendations)?event.detail.recommendations:[],primary=recommendations[0];
  if(!primary)return;
  document.documentElement.dataset[PACK_CHECK_ATTR]='true';
  try{
    const ready=foundationReadyFromRecommendation(primary)||await canonicalFoundationReady(primary);
    if(token!==packOfferToken||!ready)return;
    for(let attempt=0;attempt<12;attempt++){
      if(continuePastPackDialog()){
        document.documentElement.dataset.livingSchoolPackOfferSuppressed='foundation-ready-primary';
        return;
      }
      await new Promise(resolve=>setTimeout(resolve,16));
    }
  }finally{
    if(token===packOfferToken)delete document.documentElement.dataset[PACK_CHECK_ATTR];
  }
}
function installPackOfferAuthority(){
  if(document.getElementById('living-school-pack-offer-authority-style'))return;
  const style=document.createElement('style');
  style.id='living-school-pack-offer-authority-style';
  style.textContent='html[data-living-school-pack-offer-check="true"] dialog[data-living-school-media-pack-offer]{visibility:hidden!important}';
  document.head.append(style);
  addEventListener('civweave:living-school-media-pack-recommendations',event=>{suppressRedundantPackOffer(event).catch(error=>console.warn('[Living School pack offer guard]',error))});
}
function install(){
  if(!document.body)return false;
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-busy','disabled']});
  installPackOfferAuthority();
  sync();return true;
}
if(document.readyState==='loading')addEventListener('DOMContentLoaded',install,{once:true});else install();
globalThis.CivweaveLivingSchoolActiveRunUIV1=Object.freeze({version:VERSION,sync,canonicalFoundationReady,suppressRedundantPackOffer});
})();