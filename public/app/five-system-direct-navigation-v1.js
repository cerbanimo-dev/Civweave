(()=>{
'use strict';
const VERSION='1.0.2-five-system-direct-navigation-v440-home-rapid-tap-guard';
const NAV_ID='cw-themed-system-nav';
const CONTEXT_KEY='civweave.pending-system-context.v1';
const CANONICAL_HOME='/app/working-campus-v440.html';
const NAVIGATION_LOCK_MS=2500;
const ROUTES=Object.freeze({
  civweave:[CANONICAL_HOME,{}],
  'living-school':['/app/cabinets/living-school/index.html',{cabinet:'1'}],
  cerbanimo:['/app/realm-console-v140.html',{system:'cerbanimo',cabinet:'1'}],
  fellowfare:['/app/fellowfare-cabinet-v144.html',{cabinet:'1'}],
  anarchadia:['/app/anarchadia-console-v139.html',{cabinet:'1'}]
});
if(globalThis.CivweaveFiveSystemDirectNavigationV1?.version===VERSION)return;
let navigationLockedUntil=0;
let navigationTarget='';
let unlockTimer=0;
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
function navigationLocked(){return Date.now()<navigationLockedUntil}
function unlockNavigation(){
  navigationLockedUntil=0;navigationTarget='';clearTimeout(unlockTimer);unlockTimer=0;
  const nav=document.getElementById(NAV_ID);if(nav){nav.removeAttribute('aria-busy');delete nav.dataset.navigationPending}
}
function lockNavigation(system,target){
  navigationLockedUntil=Date.now()+NAVIGATION_LOCK_MS;navigationTarget=target.href;
  const nav=document.getElementById(NAV_ID);if(nav){nav.setAttribute('aria-busy','true');nav.dataset.navigationPending=system}
  clearTimeout(unlockTimer);unlockTimer=setTimeout(unlockNavigation,NAVIGATION_LOCK_MS);
}
function intercept(event){
  if(event.defaultPrevented||event.button!=null&&event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const link=event.target?.closest?.(`#${NAV_ID} a[data-system]`);if(!link)return;
  if(link.classList.contains('is-menu-open'))return;
  const system=String(link.dataset.system||'').toLowerCase(),target=targetFor(system,'five-system-direct-click');if(!target)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(navigationLocked())return;
  remember(system);lockNavigation(system,target);
  try{location.assign(target.href)}catch(error){unlockNavigation();throw error}
}
document.addEventListener('click',intercept,true);
const observer=new MutationObserver(()=>rewrite());
function install(){rewrite();observer.observe(document.documentElement,{childList:true,subtree:true});addEventListener('pageshow',()=>{unlockNavigation();rewrite()});addEventListener('focus',rewrite);return true}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
globalThis.CivweaveFiveSystemDirectNavigationV1=Object.freeze({version:VERSION,canonicalHome:CANONICAL_HOME,targetFor,rewrite,install,navigationLocked,navigationTarget:()=>navigationTarget,policy:'capture-direct-canonical-system-navigation-v440-home-rapid-tap-single-flight'});
})();