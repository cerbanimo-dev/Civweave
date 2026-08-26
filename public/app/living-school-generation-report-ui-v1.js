(()=>{
'use strict';
const VERSION='1.0.0-living-school-generation-report-ui-v1-provider-neutral';
const PANEL_ID='lsc220-generation-recovery';
let queued=false;
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
function providerLabel(value){
  const provider=clean(value,120).toLowerCase();
  if(provider==='cloudflare-workers-ai'||provider==='workers-ai')return'Cloudflare Workers AI';
  if(provider==='hosted')return'Cloud inference';
  if(provider==='openai-compatible')return'OpenAI-compatible';
  if(provider==='ollama')return'Ollama';
  if(provider==='browser')return'Browser model';
  return clean(value,120)||'Selected provider';
}
function runtimeConfig(){try{return globalThis.CivweaveModelRuntime?.readSharedConfig?.('interactive')||{}}catch{return{}}}
function reportState(){try{return globalThis.LivingSchoolCleanroomV218?.getState?.()?.generationRecovery||null}catch{return null}}
function render(){
  queued=false;const panel=document.getElementById(PANEL_ID);if(!panel)return;
  const note=panel.querySelector('.lsc218-note'),strong=note?.querySelector('b');if(!strong)return;
  const report=reportState(),design=report?.unstructured||{},config=runtimeConfig();
  const provider=clean(design.provider||config.provider||config.route||config.engine,120),model=clean(design.model||config.model,220);
  strong.textContent=`${providerLabel(provider)}${model?` · ${model}`:''} design → local compile`;
  panel.dataset.providerNeutralReport='true';
}
function schedule(){if(queued)return;queued=true;queueMicrotask(render)}
function install(){
  if(globalThis.CivweaveLivingSchoolGenerationReportUIV1?.version===VERSION)return true;
  new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true});
  for(const event of ['civweave:living-school-workbench-ready','civweave:living-school-curriculum-generated','civweave:model-runtime-ready','pageshow'])addEventListener?.(event,schedule);
  globalThis.CivweaveLivingSchoolGenerationReportUIV1=Object.freeze({version:VERSION,render,providerLabel});schedule();return true;
}
if(document.readyState==='loading')addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
