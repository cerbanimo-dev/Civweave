(()=>{
'use strict';
const VERSION='1.0.35-regression-fixes-v243.1';
const KAMIYA_AVATAR='/app/assets/ai/kamiya-welcoming-v243.png?v=1';
if(globalThis.CivweaveRegressionFixesV243?.version===VERSION)return;

function isOldKamiya(img){
  if(!img)return false;
  try{return new URL(img.getAttribute('src')||img.src,location.href).pathname==='/app/assets/ai/kamiya.png'}catch{return false}
}
function repairNode(node=document){
  const scope=node?.querySelectorAll?node:document;
  if(node?.matches?.('dialog button[data-close]'))node.type='button';
  for(const button of scope.querySelectorAll?.('dialog button[data-close]')||[])button.type='button';
  const images=[];
  if(node?.matches?.('img'))images.push(node);
  for(const image of scope.querySelectorAll?.('img')||[])images.push(image);
  for(const image of images)if(isOldKamiya(image))image.src=KAMIYA_AVATAR;
}
function closeDialog(target,event){
  const control=target?.closest?.('dialog [data-close]');
  if(!control)return false;
  const dialog=control.closest('dialog');
  if(!dialog)return false;
  if(control.tagName==='BUTTON')control.type='button';
  event?.preventDefault?.();
  event?.stopImmediatePropagation?.();
  try{if(dialog.open)dialog.close();else dialog.removeAttribute('open')}catch{dialog.removeAttribute('open')}
  return true;
}
function onClick(event){closeDialog(event.target,event)}

const observer=new MutationObserver(records=>{
  for(const record of records){
    if(record.type==='attributes'){repairNode(record.target);continue}
    for(const node of record.addedNodes)if(node?.nodeType===1)repairNode(node);
  }
});
function start(){
  repairNode(document);
  document.addEventListener('click',onClick,true);
  observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
  document.documentElement.dataset.civweaveRegressionFixes='v243.1';
}
function destroy(){
  observer.disconnect();
  document.removeEventListener('click',onClick,true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
globalThis.CivweaveRegressionFixesV243=Object.freeze({version:VERSION,repair:repairNode,destroy,kamiyaAvatar:KAMIYA_AVATAR});
})();
