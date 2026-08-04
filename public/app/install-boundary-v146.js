(()=>{
'use strict';
const INSTALLER='/';
const DEV_KEY='commonweave.install-boundary.developer.v146';
const ADDITIONS_SCRIPT='/extensions/commonweave-additions-v156.js';
const ADDITIONS_STYLE='/extensions/commonweave-additions-v156.css';
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
function installAdditions(){
  if(document.querySelector(`script[src^="${ADDITIONS_SCRIPT}"]`))return;
  if(!document.querySelector(`link[href^="${ADDITIONS_STYLE}"]`)){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=`${ADDITIONS_STYLE}?v=post-pr56`;
    document.head.append(link);
  }
  const script=document.createElement('script');
  script.src=`${ADDITIONS_SCRIPT}?v=post-pr56`;
  script.defer=true;
  document.head.append(script);
}
if(!allowed()){
  document.documentElement.dataset.installBoundary='blocked';
  location.replace(installerUrl());
}else{
  document.documentElement.dataset.installBoundary=installedDisplay()?'installed':developer()?'developer':'embedded';
  installAdditions();
}
globalThis.CommonweaveInstallBoundaryV146={allowed,installedDisplay,developer,embedded,installerUrl,installAdditions,additionsVersion:'v156-post-pr56'};
})();
