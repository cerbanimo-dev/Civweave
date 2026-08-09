(()=>{
'use strict';
const VERSION='1.0.58-living-school-chat-progress-v266';
const SYSTEM='living-school';
const THREAD_KEY='civweave.guide-thread.living-school.v237';
if(globalThis.CivweaveLivingSchoolChatProgressV266?.version===VERSION)return;
const clean=(value,max=1200)=>String(value??'').trim().slice(0,max);
const parse=(value,fallback)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const stageText=stage=>({
  researching:'Moss is researching sources for the learning pathway…',
  generating:'Moss is generating the curriculum from the research packet…',
  'repairing-quiz':'Moss is completing the AI quiz contract…',
  complete:'Moss is finalizing the learning pathway…'
}[stage]||`Moss is working on the curriculum (${clean(stage,80)})…`);
function realmApi(){return globalThis.CivweaveRealmSessionIntegrityV237}
function readThread(){
  try{return realmApi()?.readThread?.(SYSTEM)||parse(localStorage.getItem(THREAD_KEY),{schema:'civweave.realm-guide-thread.v237',system:SYSTEM,messages:[]})}catch{return{schema:'civweave.realm-guide-thread.v237',system:SYSTEM,messages:[]}}
}
function writeThread(thread){
  try{if(realmApi()?.writeThread)return realmApi().writeThread(SYSTEM,thread)}catch{}
  try{localStorage.setItem(THREAD_KEY,JSON.stringify(thread))}catch{}
  try{dispatchEvent(new CustomEvent('civweave:realm-guide-thread-changed',{detail:{system:SYSTEM,updatedAt:new Date().toISOString()}}))}catch{}
  return thread;
}
function updatePending(stage,detail={}){
  const thread=readThread(),rows=Array.isArray(thread.messages)?thread.messages:[];
  let index=-1;
  for(let i=rows.length-1;i>=0;i--){
    const row=rows[i];
    if(row?.role==='assistant'&&row?.pending===true&&(row?.guide===SYSTEM||row?.responderSystem===SYSTEM)){index=i;break}
  }
  if(index<0)return false;
  rows[index]={...rows[index],text:stageText(stage),pipelineStage:stage,pipelineDetail:{title:clean(detail?.title,240),capability:clean(detail?.capability,500)},updatedAt:new Date().toISOString()};
  thread.messages=rows;thread.updatedAt=new Date().toISOString();writeThread(thread);return true;
}
function onStage(event){const detail=event?.detail||{};updatePending(clean(detail.stage,80),detail)}
function start(){addEventListener('civweave:living-school-curriculum-stage',onStage)}
function destroy(){removeEventListener('civweave:living-school-curriculum-stage',onStage)}
globalThis.CivweaveLivingSchoolChatProgressV266=Object.freeze({version:VERSION,updatePending,destroy,policy:'pending-moss-turn-mirrors-real-workbench-stage-v266'});
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
