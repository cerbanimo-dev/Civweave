(()=>{
'use strict';

const VERSION='pwa-install-prompt-v247-front-door-v3-install-only-runtime';
const ENTRY='/app/installed-entry-v146?installed=1&system=civweave';
const HOST_SETUP_PATH='/host-setup.html';
const CANONICAL_ORIGIN='https://civweave.pages.dev';
const LEGACY_CANONICAL_ORIGIN='https://commonweave.pages.dev';
const HOST_NODE_ORIGIN='https://civweave-host-node.onrender.com';
const CANONICAL_MANIFEST=`${CANONICAL_ORIGIN}/app/manifest.webmanifest`;
const LEGACY_CANONICAL_MANIFEST=`${LEGACY_CANONICAL_ORIGIN}/app/manifest.webmanifest`;
const HOST_NODE_MANIFEST=`${HOST_NODE_ORIGIN}/app/manifest.webmanifest`;
let promptEvent=null;
let installed=false;
let prompting=false;
let buttonObserver=null;
let relatedApps=[];

function standalone(){
  return navigator.standalone===true||['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches);
}
function localDevelopment(){return ['localhost','127.0.0.1','::1'].includes(location.hostname)}
function cloudflarePreview(){return location.hostname.endsWith('.pages.dev')&&location.hostname.split('.').length>3}
function productionPagesOrigin(){return location.hostname.endsWith('.pages.dev')&&location.hostname.split('.').length===3}
function previewParentOrigin(){
  if(!cloudflarePreview())return null;
  const parent=`https://${location.hostname.split('.').slice(1).join('.')}`;
  return parent===LEGACY_CANONICAL_ORIGIN?CANONICAL_ORIGIN:parent;
}
function hostSetupRedirect(){
  const current=new URL(location.href);
  if(current.searchParams.get('host_setup')!=='1'||current.pathname===HOST_SETUP_PATH)return false;
  const target=new URL(HOST_SETUP_PATH,current.origin);
  for(const [key,value] of current.searchParams)target.searchParams.append(key,value);
  target.hash=current.hash;
  location.replace(target.href);
  return true;
}
function installOrigin(){return localDevelopment()||productionPagesOrigin()||(!location.hostname.endsWith('.pages.dev')&&location.origin!==HOST_NODE_ORIGIN&&location.origin!==LEGACY_CANONICAL_ORIGIN)}
function stableInstallerUrl(){
  const destination=previewParentOrigin()||CANONICAL_ORIGIN;
  const target=new URL('/app/index.html',destination);
  const current=new URL(location.href);
  for(const [key,value] of current.searchParams){if(key!=='install_origin')target.searchParams.append(key,value)}
  if(location.origin===HOST_NODE_ORIGIN&&!target.searchParams.has('host'))target.searchParams.set('host',HOST_NODE_ORIGIN);
  target.searchParams.set('install_origin',cloudflarePreview()?'host-production':'canonical');
  target.hash=current.hash;
  return target;
}
function rerouteUnsafeInstall(){
  if(standalone()||localDevelopment())return false;
  if(location.origin!==HOST_NODE_ORIGIN&&location.origin!==LEGACY_CANONICAL_ORIGIN&&!cloudflarePreview())return false;
  location.replace(stableInstallerUrl().href);
  return true;
}
function help(message){
  const node=document.querySelector('#install-help');
  if(node&&node.textContent!==message)node.textContent=message;
}
function installButton(){return document.querySelector('#install-app')}
function publish(type,detail={}){
  try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,standalone:standalone(),installed,canonicalOrigin:CANONICAL_ORIGIN,installOrigin:location.origin,...detail}}))}catch{}
}
async function discoverRelatedInstalls(){
  if(typeof navigator.getInstalledRelatedApps!=='function')return[];
  try{relatedApps=await navigator.getInstalledRelatedApps()||[]}catch{relatedApps=[]}
  const urls=new Set(relatedApps.map(app=>String(app?.url||'')));
  const canonicalInstalled=urls.has(CANONICAL_MANIFEST);
  const legacyCanonicalInstalled=urls.has(LEGACY_CANONICAL_MANIFEST);
  const hostNodeInstalled=urls.has(HOST_NODE_MANIFEST);
  document.documentElement.dataset.civweaveCanonicalInstall=canonicalInstalled?'installed':'unknown';
  document.documentElement.dataset.civweaveLegacyCanonicalInstall=legacyCanonicalInstalled?'installed':'absent';
  document.documentElement.dataset.civweaveLegacyRenderInstall=hostNodeInstalled?'installed':'absent';
  publish('civweave:related-install-state',{canonicalInstalled,legacyCanonicalInstalled,hostNodeInstalled,relatedApps:[...relatedApps]});
  return [...relatedApps];
}
function refreshButton(){
  const button=installButton();
  if(!button||/reset app shell|repair shell/i.test(button.textContent||''))return;
  if(!installOrigin()&&!standalone()){
    button.disabled=false;
    button.textContent='Open stable Civweave installer';
    help('This address is not a stable Civweave install origin. Opening its production host instead.');
    return;
  }
  if(standalone()){
    button.disabled=false;
    if(button.textContent!=='Open Civweave')button.textContent='Open Civweave';
    help('Civweave is installed as an app from this host origin.');
    return;
  }
  if(installed){
    button.disabled=true;
    if(button.textContent!=='Civweave installed')button.textContent='Civweave installed';
    help('Installation is complete. Open Civweave from your device app launcher; the campus does not run in this browser tab.');
    return;
  }
  if(button.disabled)return;
  if(promptEvent){
    if(button.textContent!=='Install Civweave')button.textContent='Install Civweave';
    help('Civweave is ready for a browser-native app install from this host. Tap Install Civweave.');
    return;
  }
  if(!prompting){
    if(button.textContent!=='Install Civweave')button.textContent='Install Civweave';
    help('Waiting for the browser to offer the real Civweave app-install prompt. Do not use Create shortcut: that only links back to the website.');
  }
}
function observeButton(){
  const button=installButton();
  if(!button)return;
  buttonObserver?.disconnect();
  buttonObserver=new MutationObserver(()=>queueMicrotask(refreshButton));
  buttonObserver.observe(button,{attributes:true,attributeFilter:['disabled'],childList:true,subtree:true});
  refreshButton();
}
function capture(event){
  event.preventDefault();
  if(!installOrigin()){
    rerouteUnsafeInstall();
    return;
  }
  promptEvent=event;
  publish('civweave:pwa-install-prompt-ready',{available:true});
  queueMicrotask(refreshButton);
}
function onInstalled(){
  installed=true;
  promptEvent=null;
  prompting=false;
  publish('civweave:pwa-installed',{available:false});
  queueMicrotask(refreshButton);
  discoverRelatedInstalls();
}
async function ownInstallClick(event){
  const button=event.target?.closest?.('#install-app');
  if(!button||button.disabled||prompting)return;
  if(/reset app shell|repair shell/i.test(button.textContent||''))return;
  if(!installOrigin()&&!standalone()){
    event.preventDefault();
    event.stopImmediatePropagation();
    location.assign(stableInstallerUrl().href);
    return;
  }
  if(standalone()){
    event.preventDefault();
    event.stopImmediatePropagation();
    location.assign(ENTRY);
    return;
  }
  if(installed){
    event.preventDefault();
    event.stopImmediatePropagation();
    help('Civweave is already installed. Open it from your device app launcher; browser-tab runtime is disabled.');
    return;
  }
  const prompt=promptEvent;
  event.preventDefault();
  event.stopImmediatePropagation();
  if(!prompt){
    help('The browser has not offered a true Civweave app-install prompt yet. Do not use Create shortcut. Reload this installer after the shell is ready.');
    return;
  }
  prompting=true;
  promptEvent=null;
  button.disabled=true;
  button.textContent='Opening app install…';
  try{
    await prompt.prompt();
    const choice=await prompt.userChoice.catch(()=>null);
    if(choice?.outcome==='accepted'){
      installed=true;
      help('Civweave app installation accepted. Open the installed app from your device launcher; this browser tab remains installer-only.');
      button.disabled=true;
      button.textContent='Civweave installed';
    }else{
      help('Civweave app installation was dismissed. Reload this installer when you want the native install prompt again.');
      button.disabled=false;
      button.textContent='Reload to install';
    }
  }catch(error){
    help(`The native Civweave install prompt could not open: ${error?.message||error}. Reload this installer and try again.`);
    button.disabled=false;
    button.textContent='Reload to install';
  }finally{prompting=false}
}

if(hostSetupRedirect())return;
if(rerouteUnsafeInstall())return;

addEventListener('beforeinstallprompt',capture);
addEventListener('appinstalled',onInstalled);
document.addEventListener('click',ownInstallClick,true);
if(document.readyState==='loading')addEventListener('DOMContentLoaded',()=>{observeButton();discoverRelatedInstalls()},{once:true});else{observeButton();discoverRelatedInstalls()}
addEventListener('pagehide',()=>buttonObserver?.disconnect(),{once:true});

const reminder=document.createElement('script');
reminder.src='/app/host-steward-reminder-v1.js?v=1';
reminder.async=true;
document.head.append(reminder);

const api=Object.freeze({
  version:VERSION,
  canonicalOrigin:CANONICAL_ORIGIN,
  legacyCanonicalOrigin:LEGACY_CANONICAL_ORIGIN,
  hostNodeOrigin:HOST_NODE_ORIGIN,
  installOrigin,
  canonicalInstallOrigin:installOrigin,
  canonicalInstallerUrl:()=>stableInstallerUrl().href,
  stableInstallerUrl:()=>stableInstallerUrl().href,
  discoverRelatedInstalls,
  relatedInstalls:()=>[...relatedApps],
  available:()=>Boolean(promptEvent),
  peek:()=>promptEvent,
  consume(){const value=promptEvent;promptEvent=null;return value},
  restore(event){if(event)promptEvent=event;return Boolean(promptEvent)},
  standalone,
  refresh:refreshButton,
  browserRuntimePolicy:'installer-only-until-installed-display',
  state:()=>({available:Boolean(promptEvent),installed,prompting,standalone:standalone(),canonicalOrigin:CANONICAL_ORIGIN,installOrigin:location.origin,relatedApps:[...relatedApps]})
});

globalThis.CivweavePWAInstallV247=api;
globalThis.CivweavePWAInstallV246=api;
publish('civweave:pwa-install-bridge-ready',{available:Boolean(promptEvent)});
})();