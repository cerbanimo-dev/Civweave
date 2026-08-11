(()=>{
'use strict';

const VERSION='1.0.4-platform-stability-v159-canonical-chat-r2';
if(globalThis.CivweavePlatformStabilityV159?.version===VERSION)return;

const nativeRaf=typeof globalThis.requestAnimationFrame==='function'?globalThis.requestAnimationFrame.bind(globalThis):(callback)=>setTimeout(()=>callback(performance.now()),16);
const nativeCancel=typeof globalThis.cancelAnimationFrame==='function'?globalThis.cancelAnimationFrame.bind(globalThis):clearTimeout;
if(!globalThis.requestAnimationFrame?.cw159Bound){const safe=callback=>nativeRaf(callback);safe.cw159Bound=true;globalThis.requestAnimationFrame=safe;globalThis.cancelAnimationFrame=id=>nativeCancel(id)}

function enhanceDialogs(root=document){
  const dialogs=[];
  if(root?.matches?.('dialog.cw127-dialog,dialog#cw138-intentions'))dialogs.push(root);
  root?.querySelectorAll?.('dialog.cw127-dialog,dialog#cw138-intentions')?.forEach(dialog=>dialogs.push(dialog));
  for(const dialog of dialogs){
    if(dialog.dataset.cw159Escape==='true')continue;
    dialog.dataset.cw159Escape='true';
    const panel=dialog.querySelector(':scope > section,:scope > form')||dialog;
    if(!panel.querySelector(':scope > .cw159-dialog-return')){
      const returnBar=document.createElement('div');
      returnBar.className='cw159-dialog-return';
      returnBar.innerHTML='<button type="button" data-cw159-close-dialog>Close and return</button>';
      panel.append(returnBar);
    }
    dialog.addEventListener('cancel',()=>setTimeout(()=>dialog.returnValue='',0));
  }
}
function dialogIn(node){return Boolean(node?.nodeType===1&&(node.matches?.('dialog.cw127-dialog,dialog#cw138-intentions')||node.querySelector?.('dialog.cw127-dialog,dialog#cw138-intentions')))}
const observer=new MutationObserver(records=>{
  if(records.some(record=>[...record.addedNodes].some(dialogIn)))enhanceDialogs();
});
observer.observe(document.documentElement,{childList:true,subtree:true});

document.addEventListener('click',event=>{
  const close=event.target.closest?.('[data-cw159-close-dialog]');
  if(!close)return;
  event.preventDefault();
  const dialog=close.closest('dialog');
  if(dialog?.open)dialog.close();
},true);

function patch(){enhanceDialogs()}
document.readyState==='loading'?addEventListener('DOMContentLoaded',patch,{once:true}):patch();
addEventListener('pageshow',patch);

globalThis.CivweavePlatformStabilityV159=Object.freeze({
  version:VERSION,
  patch,
  domReadySafe:true,
  canonicalChatOwner:'guide-workspace-v242'
});
})();