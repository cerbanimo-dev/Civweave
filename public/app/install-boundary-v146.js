(()=>{
'use strict';
const INSTALLER='/';
const DEV_KEY='commonweave.install-boundary.developer.v146';
const params=new URLSearchParams(location.search);
function installedDisplay(){
  return navigator.standalone===true
    ||matchMedia('(display-mode: standalone)').matches
    ||matchMedia('(display-mode: fullscreen)').matches
    ||matchMedia('(display-mode: minimal-ui)').matches
    ||matchMedia('(display-mode: window-controls-overlay)').matches;
}
function localhost(){return ['localhost','127.0.0.1','::1'].includes(location.hostname)}
function developer(){
  if(localhost()&&params.get('developer')==='1'){sessionStorage.setItem(DEV_KEY,'1');return true}
  return localhost()&&sessionStorage.getItem(DEV_KEY)==='1';
}
function embedded(){try{return window.top!==window.self}catch{return true}}
function allowed(){return installedDisplay()||developer()||embedded()}
function installerUrl(){
  const target=`${location.pathname}${location.search}${location.hash}`;
  const next=new URL(INSTALLER,location.origin);
  next.searchParams.set('install','required');
  next.searchParams.set('next',target.slice(0,1800));
  return next.href;
}
if(!allowed()){
  document.documentElement.dataset.installBoundary='blocked';
  location.replace(installerUrl());
}else{
  document.documentElement.dataset.installBoundary=installedDisplay()?'installed':developer()?'developer':'embedded';
}
globalThis.CommonweaveInstallBoundaryV146={allowed,installedDisplay,developer,embedded,installerUrl};
})();
