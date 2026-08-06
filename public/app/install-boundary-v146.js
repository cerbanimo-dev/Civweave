(()=>{
'use strict';

const VERSION='1.0.16';
const REVISION='five-system-boundary-v227';
const INSTALLER='/';
const BOOT_KEY='commonweave.install-boundary.boot.v227';
const LEGACY_BOOT_KEY='commonweave.install-boundary.boot.v226';
const DEV_KEY='commonweave.install-boundary.developer.v146';
const ADDITIONS_VERSION='v1.0.16-canonical-core-only-v226';
const ADDITIONS_STYLE='/extensions/commonweave-additions-v156.css';
const FALLBACK_PATHS=new Map([
  ['/app/working-campus-v156.html','commonweave'],
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
  '/extensions/commonweave-antigravity-live-source-guard-v167.js',
  '/extensions/commonweave-device-credentials-v160.js',
  '/extensions/commonweave-additions-v156.js',
  '/app/shared-tools-cleanup-v175.js',
  '/extensions/commonweave-proof-progress-v158.js',
  '/extensions/commonweave-gemini-interactions-v159.js',
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
  const contract=globalThis.CommonweaveSystemRoutesV227;
  const system=contract?.identify?.(location.pathname)||FALLBACK_PATHS.get(location.pathname)||'';
  if(system)authorize();
  return system;
}
function canonicalAppSurface(){return systemSurface()==='commonweave'}
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
  if(!allowed()){
    if(root)root.dataset.installBoundary='blocked';
    location.replace(installerUrl());
    return;
  }
  if(system){
    root.dataset.installBoundary=system==='commonweave'?'canonical':'canonical-system';
    root.dataset.commonweaveSystemRoute=system;
  }else if(root)root.dataset.installBoundary=installedDisplay()?'installed':developer()?'developer':'embedded';
  if(system==='commonweave'){
    root.dataset.commonweaveCanonicalCore='only';
    queueMicrotask(()=>dispatchEvent(new CustomEvent('commonweave:canonical-core-only',{detail:{version:VERSION,revision:REVISION,system}})));
    return;
  }
  installAdditions();
}

start();

globalThis.CommonweaveInstallBoundaryV146=Object.freeze({
  version:'1.0.16',allowed,
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
  canonicalPolicy:'five-system-first-class-routes-commonweave-core-only',
  canonicalSystemCount:5,
  canonicalAutoScripts:0,
  onlineSelfHeal:true,
  missingAssetDetails:true
});
})();
