(()=>{
'use strict';
const VERSION='1.0.1-cerbanimo-universal-nav-single-owner';
const params=new URLSearchParams(location.search);
const active=window.self===window.top&&location.pathname==='/app/realm-console-v140.html'&&String(params.get('system')||'cerbanimo').toLowerCase()==='cerbanimo';
if(!active)return;

// themed-system-nav-v178 owns system switching on Cerbanimo. Suppress the two
// redundant whole-page navigation/context owners. Persistent Guild/Map actions
// remain available through their separately bounded universal action runtime.
if(!globalThis.CivweaveFiveSystemDirectNavigationV1){
  globalThis.CivweaveFiveSystemDirectNavigationV1=Object.freeze({
    version:VERSION,
    owner:'themed-system-nav-v178',
    install:()=>false,
    rewrite:()=>false,
    navigationLocked:()=>false,
    navigationTarget:()=>'',
    policy:'universal-navbar-is-the-only-system-navigation-owner'
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
document.documentElement.dataset.cerbanimoUniversalNavOwner='themed-system-nav-v178';
document.documentElement.dataset.cerbanimoNavigationSingleOwner=VERSION;
})();
