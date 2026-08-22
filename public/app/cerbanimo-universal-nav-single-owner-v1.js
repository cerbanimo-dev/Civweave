(()=>{
'use strict';
const VERSION='1.0.0-cerbanimo-universal-nav-single-owner';
const params=new URLSearchParams(location.search);
const active=window.self===window.top&&location.pathname==='/app/realm-console-v140.html'&&String(params.get('system')||'cerbanimo').toLowerCase()==='cerbanimo';
if(!active)return;

// Cerbanimo already has the universal themed-system-nav-v178 rail. Prevent the
// route bootstrap from installing three additional navigation/context owners
// that watch the whole document and compete for the same taps and DOM changes.
if(!globalThis.CivweaveFiveSystemDirectNavigationV1){
  globalThis.CivweaveFiveSystemDirectNavigationV1=Object.freeze({
    version:VERSION,
    owner:'themed-system-nav-v178',
    install:()=>false,
    rewrite:()=>false,
    navigationLocked:()=>false,
    navigationTarget:()=>'',
    policy:'universal-navbar-is-the-only-navigation-owner'
  });
}
if(!globalThis.CivweavePersistentSystemContextV1){
  globalThis.CivweavePersistentSystemContextV1=Object.freeze({
    version:VERSION,
    owner:true,
    hostSystem:()=> 'cerbanimo',
    selected:()=> 'cerbanimo',
    install:()=>false,
    bindNav:()=>true,
    syncSelection:()=>true,
    policy:'cerbanimo-direct-page-does-not-install-a-second-nav-context-observer'
  });
}
if(!globalThis.CivweavePersistentShellActionsV1){
  globalThis.CivweavePersistentShellActionsV1=Object.freeze({
    version:VERSION,
    owner:'themed-system-nav-v178',
    ensureMounted:()=>true,
    policy:'universal-navbar-remains-single-owner-on-cerbanimo'
  });
}
document.documentElement.dataset.cerbanimoUniversalNavOwner='themed-system-nav-v178';
document.documentElement.dataset.cerbanimoNavigationSingleOwner=VERSION;
})();
