(()=>{
'use strict';

const ROUTES=new Set(['market','loom','assemblies','inbox','profile']);
const host=document.querySelector('#ffc144-workbench');
const loading=document.querySelector('[data-ffc-loading]');
const status=document.querySelector('[data-ffc-status]');
const tabs=[...document.querySelectorAll('[data-ffc-command]')];

function marketplace(){return globalThis.CivweaveFellowFareMarketplaceV2||null}
function currentRoute(){
  const hash=location.hash.replace(/^#/,'').trim();
  return ROUTES.has(hash)?hash:'market';
}
function syncTabs(route=currentRoute()){
  tabs.forEach(button=>{
    const active=button.dataset.ffcCommand===route;
    button.toggleAttribute('aria-current',active);
  });
}
function enforceScroll(){
  const root=document.documentElement;
  const body=document.body;
  root.style.setProperty('overflow-x','hidden');
  root.style.setProperty('overflow-y','auto');
  root.style.setProperty('overscroll-behavior-y','auto');
  body.style.setProperty('overflow-x','clip');
  body.style.setProperty('overflow-y','visible');
  body.style.setProperty('overscroll-behavior-y','auto');
  body.style.setProperty('touch-action','pan-y');
  body.style.setProperty('height','auto');
  for(const node of [document.querySelector('#ffc144-app'),document.querySelector('.ffc144-native-market'),host,document.querySelector('#app.ffv2-native-shell'),document.querySelector('#main')]){
    if(!node)continue;
    node.style.setProperty('height','auto');
    node.style.setProperty('min-height','0');
    node.style.setProperty('max-height','none');
    node.style.setProperty('overflow','visible');
  }
  body.classList.remove('ffc144-mobile-flow');
  body.dataset.fellowfareScrollOwner='document-root';
}
function openRoute(route){
  if(!ROUTES.has(route))return false;
  const api=marketplace();
  if(!api?.routeTo)return false;
  api.routeTo(route);
  syncTabs(route);
  if(status)status.textContent=`Opened ${route==='loom'?'sell desk':route==='assemblies'?'orders':route==='inbox'?'wallet':route}.`;
  return true;
}
function bind(){
  document.addEventListener('click',event=>{
    const tab=event.target.closest?.('[data-ffc-command]');
    if(!tab)return;
    event.preventDefault();
    openRoute(tab.dataset.ffcCommand);
  });
  addEventListener('hashchange',()=>syncTabs());
  addEventListener('pageshow',enforceScroll);
  addEventListener('resize',enforceScroll,{passive:true});
  enforceScroll();
  syncTabs();
  if(loading)loading.hidden=true;
  if(status)status.textContent='Marketplace is ready on the direct native surface.';
}

if(document.readyState==='loading')addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
