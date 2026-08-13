(()=>{
'use strict';
const VERSION='fellowfare-native-scroll-v208';
if(globalThis.CivweaveFellowFareNativeScrollV208?.version===VERSION)return;
const host=document.querySelector('#ffc144-workbench[data-fellowfare-native-host]');
if(!host)return;
let frame=0;
const set=(node,name,value)=>{
  if(!node)return;
  if(node.style.getPropertyValue(name)!==value||node.style.getPropertyPriority(name)!=='important')node.style.setProperty(name,value,'important');
};
function enforce(){
  frame=0;
  const root=document.documentElement,body=document.body;
  set(root,'overflow-x','hidden');
  set(root,'overflow-y','auto');
  set(root,'overscroll-behavior-y','auto');
  set(body,'overflow-x','clip');
  set(body,'overflow-y','visible');
  set(body,'overscroll-behavior-y','auto');
  set(body,'touch-action','pan-y');
  set(body,'height','auto');
  for(const node of [document.querySelector('#ffc144-app'),document.querySelector('.ffc144-native-market'),host,document.querySelector('#app.ffv2-native-shell'),document.querySelector('#main')]){
    set(node,'height','auto');
    set(node,'min-height','0px');
    set(node,'max-height','none');
    set(node,'overflow','visible');
  }
  body.classList.remove('ffc144-mobile-flow');
  body.dataset.fellowfareScrollOwner='document-root-v208';
}
function schedule(){if(frame)return;frame=requestAnimationFrame(enforce)}
addEventListener('message',event=>{
  const type=event?.data?.type;
  if(type==='fellowfare:cabinet-ready'||type==='fellowfare:cabinet-command'||type==='civweave:navigation-receipt')queueMicrotask(enforce);
});
addEventListener('hashchange',schedule);
addEventListener('pageshow',schedule);
addEventListener('resize',schedule,{passive:true});
if(document.readyState==='loading')addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
const observer=new MutationObserver(schedule);
observer.observe(document.documentElement,{attributes:true,attributeFilter:['style','class']});
observer.observe(document.body,{attributes:true,attributeFilter:['style','class']});
globalThis.CivweaveFellowFareNativeScrollV208=Object.freeze({version:VERSION,enforce,native:true,scrollOwner:'documentElement'});
})();
