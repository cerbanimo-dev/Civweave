(() => {
'use strict';
const REVISION = 'host-node-paid-join-v1';
function slots(id){const text=document.getElementById(id)?.textContent||'';const n=Number(text.replace(/[^0-9.-]/g,''));return Number.isFinite(n)&&n>=0?Math.floor(n):null;}
function apply(){
  const actions=document.querySelector('.cw-host-node-actions');
  if(!actions)return false;
  const free=slots('cw-host-free-slots'),paid=slots('cw-host-paid-slots');
  if(free==null||paid==null)return false;
  let box=document.getElementById('cw-paid-join');
  if(!box){
    box=document.createElement('section');box.id='cw-paid-join';box.hidden=true;
    box.innerHTML='<p>This Hub has membership capacity but no free community seats.</p><button id="cw-paid-join-button" type="button">Join with membership</button>';
    actions.insertAdjacentElement('afterend',box);
  }
  box.hidden=!(free<1&&paid>0);
  const join=document.getElementById('cw-host-node-join');
  if(!box.hidden&&join){join.dataset.mode='search';join.textContent='Find a free Hub';}
  return true;
}
const observer=new MutationObserver(apply);observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
globalThis.CivweaveHostNodePaidJoinV1=Object.freeze({revision:REVISION,apply});
})();
