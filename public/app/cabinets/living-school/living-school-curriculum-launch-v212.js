(()=>{
'use strict';
const VERSION='living-school-curriculum-launch-v212-canonical-state';
const STATE_KEY='commonweave.living-school.cabinet.v151';
const frame=globalThis.requestAnimationFrame||((callback)=>setTimeout(callback,16));
let bridgeInstalled=false;
const clean=(value,max=800)=>String(value??'').trim().slice(0,max);
function readState(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'null')}catch{return null}}
function dispatchState(next,oldValue,text){
  try{dispatchEvent(new StorageEvent('storage',{key:STATE_KEY,oldValue,newValue:text,url:location.href,storageArea:localStorage}));return true}catch{}
  try{const event=new Event('storage');Object.defineProperties(event,{key:{value:STATE_KEY},oldValue:{value:oldValue},newValue:{value:text},url:{value:location.href},storageArea:{value:localStorage}});dispatchEvent(event);return true}catch{}
  try{dispatchEvent(new CustomEvent('living-school:state-replaced',{detail:{state:next}}));return true}catch{return false}
}
function replaceState(next){
  const oldValue=(()=>{try{return localStorage.getItem(STATE_KEY)||''}catch{return''}})();
  const text=JSON.stringify(next);
  try{localStorage.setItem(STATE_KEY,text)}catch(error){throw new Error(`Living School could not open this curriculum: ${clean(error.message)}`)}
  dispatchState(next,oldValue,text);
  return next;
}
function setCanonicalRoom(room){
  const current=readState();
  if(!current||typeof current!=='object')return false;
  replaceState({...current,room:clean(room,80)||current.room||'desk'});
  return true;
}
function installCabinetBridge(){
  const cabinet=globalThis.LivingSchoolCabinetV151;
  if(!cabinet?.setRoom)return false;
  if(cabinet.setRoom.__livingSchoolCanonicalV212){bridgeInstalled=true;return true}
  const legacySetRoom=cabinet.setRoom.bind(cabinet);
  function canonicalSetRoom(room){
    if(setCanonicalRoom(room))return true;
    return legacySetRoom(room);
  }
  Object.defineProperty(canonicalSetRoom,'__livingSchoolCanonicalV212',{value:true});
  cabinet.setRoom=canonicalSetRoom;
  bridgeInstalled=true;
  return true;
}
function toast(message){
  const node=document.querySelector?.('#toast');if(!node)return;
  node.textContent=clean(message,1000);node.hidden=false;
  clearTimeout(node._ls212);node._ls212=setTimeout(()=>node.hidden=true,4200);
}
function focusCurriculum(attempt=0){
  const target=document.querySelector?.('.lsw-course-head,.lsw-reader,#ls-generated-workbench');
  if(target){target.scrollIntoView?.({behavior:'auto',block:'start'});target.querySelector?.('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')?.focus?.();return true}
  if(attempt<12){frame(()=>focusCurriculum(attempt+1));return false}
  toast('The curriculum is saved, but its reader did not mount.');return false;
}
function openCurriculum(){
  const current=readState();
  if(!current?.school){
    const opened=globalThis.LivingSchoolPathsV160?.openGenerator?.();
    if(!opened)toast('Generate a curriculum before opening its reader.');
    return !!opened;
  }
  installCabinetBridge();
  setCanonicalRoom('map');
  try{document.querySelector?.('#instrument-dialog')?.close?.()}catch{}
  globalThis.LivingSchoolWorkbenchV158?.render?.();
  frame(()=>focusCurriculum());
  return true;
}
function expose(){
  installCabinetBridge();
  const paths=globalThis.LivingSchoolPathsV160;
  if(paths)paths.viewCurriculum=openCurriculum;
}
function boot(){
  expose();
  document.addEventListener?.('commonweave:living-school-flat-ready',expose);
  addEventListener?.('living-school:open-curriculum',openCurriculum);
}
document.readyState==='loading'?document.addEventListener?.('DOMContentLoaded',boot,{once:true}):boot();
globalThis.LivingSchoolCurriculumLaunchV212={version:VERSION,open:openCurriculum,setRoom:setCanonicalRoom,install:installCabinetBridge,isInstalled:()=>bridgeInstalled};
})();
