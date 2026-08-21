(()=>{
'use strict';
const VERSION='1.0.1-five-system-direct-navigation-v440-home';
const NAV_ID='cw-themed-system-nav';
const CONTEXT_KEY='civweave.pending-system-context.v1';
const CANONICAL_HOME='/app/working-campus-v440.html';
const ROUTES=Object.freeze({
  civweave:[CANONICAL_HOME,{}],
  'living-school':['/app/cabinets/living-school/index.html',{cabinet:'1'}],
  cerbanimo:['/app/realm-console-v140.html',{system:'cerbanimo',cabinet:'1'}],
  fellowfare:['/app/fellowfare-cabinet-v144.html',{cabinet:'1'}],
  anarchadia:['/app/anarchadia-console-v139.html',{cabinet:'1'}]
});
if(globalThis.CivweaveFiveSystemDirectNavigationV1?.version===VERSION)return;
function targetFor(system,source='five-system-direct-navigation'){
  const row=ROUTES[String(system||'').toLowerCase()];
  if(!row)return null;
  const url=new URL(row[0],location.origin);
  for(const [key,value] of Object.entries(row[1]))url.searchParams.set(key,value);
  url.searchParams.set('installed','1');
  url.searchParams.set('navigation','five-system-direct-navigation-v1');
  url.searchParams.set('source',source);
  return url;
}
function remember(system){try{localStorage.setItem(CONTEXT_KEY,system)}catch{}}
function rewrite(){
  const nav=document.getElementById(NAV_ID);if(!nav)return false;
  for(const link of nav.querySelectorAll('a[data-system]')){
    const target=targetFor(link.dataset.system,'native-five-system-link');
    if(!target)continue;
    link.href=target.href;
    link.target='_self';
    link.dataset.directNavigationOwner=VERSION;
  }
  return true;
}
function intercept(event){
  if(event.defaultPrevented||event.button!=null&&event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const link=event.target?.closest?.(`#${NAV_ID} a[data-system]`);if(!link)return;
  if(link.classList.contains('is-menu-open'))return;
  const system=String(link.dataset.system||'').toLowerCase(),target=targetFor(system,'five-system-direct-click');if(!target)return;
  event.preventDefault();event.stopImmediatePropagation();remember(system);location.assign(target.href);
}
document.addEventListener('click',intercept,true);
const observer=new MutationObserver(()=>rewrite());
function install(){rewrite();observer.observe(document.documentElement,{childList:true,subtree:true});addEventListener('pageshow',rewrite);addEventListener('focus',rewrite);return true}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
globalThis.CivweaveFiveSystemDirectNavigationV1=Object.freeze({version:VERSION,canonicalHome:CANONICAL_HOME,targetFor,rewrite,install,policy:'capture-direct-canonical-system-navigation-v440-home-no-guide-context-no-shell-substitution'});
})();
