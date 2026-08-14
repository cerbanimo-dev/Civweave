(()=>{
'use strict';

const VERSION='1.0.36-regression-fixes-v243-source-truth-v1';
if(globalThis.CivweaveRegressionFixesV243?.version===VERSION)return;

function closeDialog(target,event){
  const control=target?.closest?.('dialog [data-close]');
  if(!control)return false;
  const dialog=control.closest('dialog');
  if(!dialog)return false;
  event?.preventDefault?.();
  event?.stopImmediatePropagation?.();
  try{if(dialog.open)dialog.close();else dialog.removeAttribute('open')}catch{dialog.removeAttribute('open')}
  return true;
}

function onClick(event){closeDialog(event.target,event)}
function start(){
  document.addEventListener('click',onClick,true);
  document.documentElement.dataset.civweaveRegressionFixes='source-truth-v1';
}
function destroy(){document.removeEventListener('click',onClick,true)}
function repair(){return false}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();

globalThis.CivweaveRegressionFixesV243=Object.freeze({
  version:VERSION,
  repair,
  destroy,
  kamiyaAvatar:null,
  sourceTruth:true,
  runtimeImageRepair:false
});
})();
