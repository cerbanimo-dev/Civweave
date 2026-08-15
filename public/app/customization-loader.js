const ACTIVE_KEY='civweave.customization.active';
const LAST_GOOD_KEY='civweave.customization.last-good';
const CANDIDATE_KEY='civweave.customization.candidate';
const BOOT_KEY='civweave.customization.boot';
const DISABLED_KEY='civweave.customization.disabled';
const clean=(value,max=500000)=>String(value??'').slice(0,max);
const parse=(value,fallback=null)=>{try{return JSON.parse(value)??fallback}catch{return fallback}};
const read=key=>parse(localStorage.getItem(key),null);
const write=(key,value)=>value==null?localStorage.removeItem(key):localStorage.setItem(key,JSON.stringify(value));
const now=()=>new Date().toISOString();
let styleNode=null,active=null,failed=false;

function snapshot(value){if(!value||typeof value!=='object')return null;return{id:String(value.id||''),name:clean(value.name,120),css:clean(value.css),js:clean(value.js),createdAt:value.createdAt||now(),activatedAt:value.activatedAt||'',health:value.health||'unknown'}}
function rollback(reason,error=''){
  failed=true;
  const previous=snapshot(read(LAST_GOOD_KEY));
  if(previous)write(ACTIVE_KEY,{...previous,health:'rollback',rollbackReason:reason,rollbackAt:now()});else write(ACTIVE_KEY,null);
  write(DISABLED_KEY,{failed:snapshot(active),reason,error:clean(error,2000),at:now()});
  write(BOOT_KEY,{state:'rolled-back',reason,error:clean(error,2000),at:now(),failedId:active?.id||''});
  try{styleNode?.remove()}catch{}
  dispatchEvent(new CustomEvent('civweave:customization-rollback',{detail:{reason,error,restored:previous?.id||null}}));
  return previous;
}
function previousBootCrashed(){const boot=read(BOOT_KEY);if(!boot||boot.state!=='starting')return false;const age=Date.now()-Date.parse(boot.at||0);return Number.isFinite(age)&&age>=0&&age<10*60*1000}
function markStable(){if(failed||!active)return;const stable={...snapshot(active),health:'stable',stableAt:now()};write(ACTIVE_KEY,stable);write(LAST_GOOD_KEY,stable);write(BOOT_KEY,{state:'stable',id:stable.id,at:now()});dispatchEvent(new CustomEvent('civweave:customization-stable',{detail:{id:stable.id}}))}
function apply(){
  if(previousBootCrashed())rollback('previous-boot-did-not-stabilize');
  active=snapshot(read(ACTIVE_KEY));if(!active)return false;
  write(BOOT_KEY,{state:'starting',id:active.id,at:now(),path:location.pathname});
  const onFailure=event=>{if(failed)return;const message=event?.error?.stack||event?.reason?.stack||event?.message||event?.reason||'Customization error';rollback('runtime-error',message);setTimeout(()=>location.reload(),50)};
  addEventListener('error',onFailure,{once:true});addEventListener('unhandledrejection',onFailure,{once:true});
  try{
    if(active.css){styleNode=document.createElement('style');styleNode.id='civweave-user-customization';styleNode.textContent=active.css;document.head.append(styleNode)}
    if(active.js){const api=Object.freeze({id:active.id,name:active.name,root:document.documentElement,emit:(type,detail={})=>dispatchEvent(new CustomEvent(`civweave:user:${String(type).slice(0,80)}`,{detail}))});Function('CivweaveCustomization','"use strict";\n'+active.js)(api)}
    setTimeout(markStable,900);return true;
  }catch(error){rollback('synchronous-error',error?.stack||error?.message||String(error));setTimeout(()=>location.reload(),50);return false}
}

document.readyState==='loading'?document.addEventListener('DOMContentLoaded',apply,{once:true}):apply();
export const customizationLoader=Object.freeze({active:()=>snapshot(read(ACTIVE_KEY)),lastGood:()=>snapshot(read(LAST_GOOD_KEY)),disabled:()=>read(DISABLED_KEY),rollback});
