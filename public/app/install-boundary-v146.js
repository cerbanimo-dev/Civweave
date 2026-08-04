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
function additionMarkup(){return`<link rel="stylesheet" href="${ADDITIONS_STYLE}"><script src="${ADDITIONS_SCRIPT}"><\/script>`}
function enhanceHtml(text){
  const source=String(text||'');
  if(source.includes(ADDITIONS_SCRIPT))return source;
  const markup=additionMarkup();
  if(/<\/head>/i.test(source))return source.replace(/<\/head>/i,`${markup}</head>`);
  if(/<\/body>/i.test(source))return source.replace(/<\/body>/i,`${markup}</body>`);
  return source+markup;
}
function patchWorkingCampusPayload(){
  if(globalThis.__commonweaveCampusPayloadPatchV156)return;
  globalThis.__commonweaveCampusPayloadPatchV156=true;
  const original=Response.prototype.text;
  Response.prototype.text=async function(...args){
    const text=await original.apply(this,args);
    if(text.includes('Commonweave Working Campus')||text.includes('commonweave.working-campus.v1'))return enhanceHtml(text);
    return text;
  };
}
function installAdditions(){
  if(location.pathname.includes('fullscreen-family-v104')){patchWorkingCampusPayload();return}
  if(document.querySelector(`script[src="${ADDITIONS_SCRIPT}"]`))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href=ADDITIONS_STYLE;
  const script=document.createElement('script');script.src=ADDITIONS_SCRIPT;script.defer=true;
  document.head.append(link,script);
}
if(!allowed()){
  document.documentElement.dataset.installBoundary='blocked';
  location.replace(installerUrl());
}else{
  document.documentElement.dataset.installBoundary=installedDisplay()?'installed':developer()?'developer':'embedded';
  installAdditions();
}
globalThis.CommonweaveInstallBoundaryV146={allowed,installedDisplay,developer,embedded,installerUrl,installAdditions,enhanceHtml,additionsVersion:'v156'};
})();
