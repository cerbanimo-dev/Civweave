import{copy,state,VERSION}from'./living-school-cleanroom-core-v218.mjs';
import{render}from'./living-school-cleanroom-render-v218.mjs';
import{actions}from'./living-school-cleanroom-actions-v243.mjs';

let busy=false,dispatchCount=0;
async function handleLivingSchoolClick(event){
  const target=event.target?.closest?.('[data-ls-action]');
  if(!target)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(target.disabled||busy)return;
  const action=actions[String(target.dataset.lsAction||'').trim()];
  if(!action)return;
  busy=true;dispatchCount+=1;
  document.documentElement.dataset.livingSchoolDispatchCount=String(dispatchCount);
  try{await action(target)}catch(error){console.error('[Living School cleanroom]',error);const toast=document.getElementById('lsc218-toast');if(toast){toast.textContent=String(error?.message||error);toast.hidden=false}}
  finally{busy=false;render()}
}

document.addEventListener('click',handleLivingSchoolClick,true);
render();
globalThis.LivingSchoolCleanroomV218=Object.freeze({version:VERSION,controller:'single-delegated-click-handler-local-research-v243',getState:()=>copy(state()),render,dispatchCount:()=>dispatchCount,legacyNavigation:false});
