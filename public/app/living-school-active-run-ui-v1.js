(()=>{
'use strict';
const VERSION='1.0.0-living-school-active-run-ui-v1';
const GENERATE='[data-ls-action="generate-curriculum"]';
const REPORT='#lsc220-generation-recovery';
let queued=false;
function active(button){
  if(!button)return false;
  const label=String(button.textContent||'');
  return button.getAttribute('aria-busy')==='true'||(button.disabled&&/researching|generating|regenerating|completing/i.test(label));
}
function sync(){
  queued=false;
  const button=document.querySelector(GENERATE),report=document.querySelector(REPORT),running=active(button);
  if(report){report.hidden=running;report.dataset.previousRunWhileGenerating=running?'true':'false'}
  document.documentElement.dataset.livingSchoolGenerationActive=running?'true':'false';
}
function schedule(){if(queued)return;queued=true;queueMicrotask(sync)}
const observer=new MutationObserver(schedule);
function install(){
  if(!document.body)return false;
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-busy','disabled','hidden']});
  sync();return true;
}
if(document.readyState==='loading')addEventListener('DOMContentLoaded',install,{once:true});else install();
globalThis.CivweaveLivingSchoolActiveRunUIV1=Object.freeze({version:VERSION,sync});
})();