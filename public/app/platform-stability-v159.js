(()=>{
'use strict';

const VERSION='1.0.5-platform-stability-v159-source-truth-v1';
if(globalThis.CivweavePlatformStabilityV159?.version===VERSION)return;

const nativeRaf=typeof globalThis.requestAnimationFrame==='function'?globalThis.requestAnimationFrame.bind(globalThis):(callback)=>setTimeout(()=>callback(performance.now()),16);
const nativeCancel=typeof globalThis.cancelAnimationFrame==='function'?globalThis.cancelAnimationFrame.bind(globalThis):clearTimeout;
if(!globalThis.requestAnimationFrame?.cw159Bound){const safe=callback=>nativeRaf(callback);safe.cw159Bound=true;globalThis.requestAnimationFrame=safe;globalThis.cancelAnimationFrame=id=>nativeCancel(id)}

function onClick(event){
  const close=event.target.closest?.('[data-cw159-close-dialog]');
  if(!close)return;
  event.preventDefault();
  const dialog=close.closest('dialog');
  if(dialog?.open)dialog.close();
}
function patch(){return false}
function start(){document.addEventListener('click',onClick,true)}
function destroy(){document.removeEventListener('click',onClick,true)}

document.readyState==='loading'?addEventListener('DOMContentLoaded',start,{once:true}):start();

globalThis.CivweavePlatformStabilityV159=Object.freeze({
  version:VERSION,
  patch,
  destroy,
  domReadySafe:true,
  canonicalChatOwner:'guide-workspace-v242',
  sourceTruth:true,
  injectedDialogControls:false
});
})();
