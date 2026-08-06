(()=>{
'use strict';

const VERSION='1.0.17';
const REVISION='five-system-boundary-v227';
const INSTALLER='/app/index.html';
const BOOT_KEY='civweave.install-boundary.boot.v227';
const LEGACY_BOOT_KEY='civweave.install-boundary.boot.v226';
const DEV_KEY='civweave.install-boundary.developer.v146';
const ADDITIONS_VERSION='v1.0.17-canonical-core-only-v226';
const ADDITIONS_STYLE='/extensions/civweave-additions-v156.css';
const BRAND_SCRIPT='/app/civweave-brand.js';
const FALLBACK_PATHS=new Map([
  ['/app/working-campus-v156.html','civweave'],
  ['/app/cabinets/living-school/index.html','living-school'],
  ['/app/realm-console-v140.html','cerbanimo'],
  ['/app/fellowfare-cabinet-v144.html','fellowfare'],
  ['/app/anarchadia-console-v139.html','anarchadia']
]);
const LEGACY_SCRIPTS=[
  '/app/system-routes-v227.js',
  '/app/release-version-v1.js',
  '/app/weaveling-memory-v191.js',
  '/app/weaveling-memory-bridge-v191.js',
  '/app/deterministic-mode-v175.js',
  '/app/model-settings-controller-v173.js',
  '/app/settings-delegation-v175.js',
  '/app/gemini-task-tier-router-v213.js',
  '/app/guide-identity-integrity-v216.js',
  '/app/persistent-guide-chat-v215.js',
  '/app/persistent-guide-viewport-v216.js',
  '/extensions/civweave-antigravity-live-source-guard-v167.js',
  '/extensions/civweave-device-credentials-v160.js',
  '/extensions/civweave-additions-v156.js',
  '/app/shared-tools-cleanup-v175.js',
  '/extensions/civweave-proof-progress-v158.js',
  '/extensions/civweave-gemini-interactions-v159.js',
  '/app/themed-system-nav-v178.js',
  '/app/pwa-update-controller-v204.js'
];
const params=new URLSearchParams(location.search);
let unloading=false;
addEventListener('pagehide',()=>{unloading=true},{once:true});
addEventListener('beforeunload',()=>{unloading=true},{once:true});

function installedDisplay(){
  return navigator.standalone===true||['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches);
}
function localhost(){return['localhost','127.0.0.1','::1'].includes(location.hostname)}
function developer(){
  if(localhost()&&params.get('developer')==='1'){try{sessionStorage.setItem(DEV_KEY,'1')}catch{}return true}
  try{return localhost()&&sessionStorage.getItem(DEV_KEY)==='1'}catch{return false}
}
function embedded(){try{return window.top!==window.self}catch{return true}}
function authorize(){
  try{sessionStorage.setItem(BOOT_KEY,'1');sessionStorage.setItem(LEGACY_BOOT_KEY,'1')}catch{}
}
function explicitInstalled(){
  try{
    if(params.get('installed')==='1'){authorize();return true}
    return sessionStorage.getItem(BOOT_KEY)==='1'||sessionStorage.getItem(LEGACY_BOOT_KEY)==='1';
  }catch{return params.get('installed')==='1'}
}
function systemSurface(){
  const contract=globalThis.CivweaveSystemRoutesV227;
  const system=contract?.identify?.(location.pathname)||FALLBACK_PATHS.get(location.pathname)||'';
  if(system)authorize();
  return system;
}
function canonicalAppSurface(){return systemSurface()==='civweave'}
function allowed(){return Boolean(systemSurface())||installedDisplay()||explicitInstalled()||developer()||embedded()}
function installerUrl(){
  const target=`${location.pathname}${location.search}${location.hash}`;
  const next=new URL(INSTALLER,location.origin);
  next.searchParams.set('install','required');
  next.searchParams.set('next',target.slice(0,1800));
  return next.href;
}
function liveHead(){return!unloading&&document.documentElement?.isConnected&&document.head?.isConnected}
function addScript(src){
  if(!liveHead()||document.querySelector(`script[src^="${src}"]`))return false;
  const script=document.createElement('script');
  script.src=`${src}?v=${ADDITIONS_VERSION}`;
  script.async=false;
  document.head.append(script);
  return true;
}
function installAdditions(){
  if(canonicalAppSurface()||!liveHead())return false;
  if(!document.querySelector(`link[href^="${ADDITIONS_STYLE}"]`)){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=`${ADDITIONS_STYLE}?v=${ADDITIONS_VERSION}`;
    document.head.append(link);
  }
  LEGACY_SCRIPTS.forEach(addScript);
  return true;
}
function start(){
  const root=document.documentElement,system=systemSurface();
  addScript(BRAND_SCRIPT);
  if(!allowed()){
    if(root)root.dataset.installBoundary='blocked';
    location.replace(installerUrl());
    return;
  }
  if(system){
    root.dataset.installBoundary=system==='civweave'?'canonical':'canonical-system';
    root.dataset.civweaveSystemRoute=system;
  }else if(root)root.dataset.installBoundary=installedDisplay()?'installed':developer()?'developer':'embedded';
  if(system==='civweave'){
    root.dataset.civweaveCanonicalCore='only';
    queueMicrotask(()=>dispatchEvent(new CustomEvent('civweave:canonical-core-only',{detail:{version:VERSION,revision:REVISION,system}})));
    return;
  }
  installAdditions();
}

start();

globalThis.CivweaveInstallBoundaryV146=Object.freeze({
  version:'1.0.17',allowed,
  revision:REVISION,
  systemSurface,
  canonicalAppSurface,
  installedDisplay,
  explicitInstalled,
  developer,
  embedded,
  installerUrl,
  installAdditions,
  additionsVersion:ADDITIONS_VERSION,
  brandScript:BRAND_SCRIPT,
  publicBrand:'Civweave',
  canonicalPolicy:'five-system-first-class-routes-civweave-core-only',
  canonicalSystemCount:5,
  canonicalAutoScripts:0,
  onlineSelfHeal:true,
  missingAssetDetails:true
});
})();
