(()=>{
'use strict';

const VERSION='pwa-install-prompt-v246-single-origin-v282';
const ENTRY='/app/?system=civweave&installed=1';
const CANONICAL_ORIGIN='https://commonweave.pages.dev';
const HOST_NODE_ORIGIN='https://civweave-host-node.onrender.com';
const CANONICAL_MANIFEST=`${CANONICAL_ORIGIN}/app/manifest.webmanifest`;
const HOST_NODE_MANIFEST=`${HOST_NODE_ORIGIN}/app/manifest.webmanifest`;
const CANONICAL_APP_ID=`${CANONICAL_ORIGIN}/civweave-local`;
const HOST_NODE_APP_ID=`${HOST_NODE_ORIGIN}/civweave-local`;
const COMMIT_VERIFY_TIMEOUT_MS=60000;
const COMMIT_VERIFY_INTERVAL_MS=1200;
let promptEvent=null;
let installed=false;
let prompting=false;
let installAccepted=false;
let installVerified=false;
let buttonObserver=null;
let relatedApps=[];
let verificationPromise=null;

function standalone(){
  return navigator.standalone===true||['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches);
}
function localDevelopment(){return ['localhost','127.0.0.1','::1'].includes(location.hostname)}
function cloudflarePreview(){return location.hostname.endsWith('.commonweave.pages.dev')&&location.origin!==CANONICAL_ORIGIN}
function canonicalInstallOrigin(){return localDevelopment()||location.origin===CANONICAL_ORIGIN}
function canonicalInstallerUrl(){
  const target=new URL('/app/index.html',CANONICAL_ORIGIN);
  const current=new URL(location.href);
  for(const [key,value] of current.searchParams){if(key!=='install_origin')target.searchParams.append(key,value)}
  if(location.origin===HOST_NODE_ORIGIN&&!target.searchParams.has('host'))target.searchParams.set('host',HOST_NODE_ORIGIN);
  target.searchParams.set('install_origin','canonical');
  target.hash=current.hash;
  return target;
}
function rerouteAlternateInstall(){
  if(standalone()||canonicalInstallOrigin())return false;
  if(location.origin!==HOST_NODE_ORIGIN&&!cloudflarePreview())return false;
  location.replace(canonicalInstallerUrl().href);
  return true;
}
function help(message){
  const node=document.querySelector('#install-help');
  if(node&&node.textContent!==message)node.textContent=message;
}
function installButton(){return document.querySelector('#install-app')}
function setButton(disabled,text){
  const button=installButton();
  if(!button)return null;
  if(button.disabled!==Boolean(disabled))button.disabled=Boolean(disabled);
  if(text!=null&&button.textContent!==text)button.textContent=text;
  return button;
}
function publish(type,detail={}){
  try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,standalone:standalone(),installed,installAccepted,installVerified,canonicalOrigin:CANONICAL_ORIGIN,...detail}}))}catch{}
}
function normalizeRelatedUrl(value){
  try{return new URL(String(value||''),location.origin).href}catch{return''}
}
async function discoverRelatedInstalls(){
  if(typeof navigator.getInstalledRelatedApps!=='function')return[];
  try{
    relatedApps=await navigator.getInstalledRelatedApps()||[];
  }catch{
    relatedApps=[];
  }
  const urls=new Set(relatedApps.map(app=>normalizeRelatedUrl(app?.url)).filter(Boolean));
  const ids=new Set(relatedApps.map(app=>String(app?.id||'')).filter(Boolean));
  const canonicalInstalled=urls.has(CANONICAL_MANIFEST)||ids.has(CANONICAL_APP_ID);
  const hostNodeInstalled=urls.has(HOST_NODE_MANIFEST)||ids.has(HOST_NODE_APP_ID);
  if(canonicalInstalled){
    installed=true;
    installVerified=true;
    installAccepted=true;
  }
  document.documentElement.dataset.civweaveCanonicalInstall=canonicalInstalled?'installed':'absent';
  document.documentElement.dataset.civweaveLegacyRenderInstall=hostNodeInstalled?'installed':'absent';
  publish('civweave:related-install-state',{canonicalInstalled,hostNodeInstalled,relatedApps:[...relatedApps]});
  if(canonicalInstalled)queueMicrotask(refreshButton);
  return [...relatedApps];
}
function setFinalizingUi(){
  setButton(true,'Finishing Android install…');
  help('Chrome accepted the install. Android may need a few seconds to mint and register the Civweave app. Keeping this page open while that finishes.');
}
function markCommitted(){
  installed=true;
  installAccepted=true;
  installVerified=true;
  setButton(false,'Open Civweave');
  help('Civweave is registered as an installed app. You can open it now while the required campus continues downloading.');
  publish('civweave:pwa-install-committed',{committed:true});
}
async function waitForCommittedInstall(timeoutMs=COMMIT_VERIFY_TIMEOUT_MS){
  if(standalone()){
    markCommitted();
    return true;
  }
  if(verificationPromise)return verificationPromise;
  verificationPromise=(async()=>{
    const supportsRelated=typeof navigator.getInstalledRelatedApps==='function';
    if(!supportsRelated){
      installed=true;
      installVerified=true;
      markCommitted();
      return true;
    }
    const deadline=Date.now()+timeoutMs;
    while(Date.now()<deadline){
      await discoverRelatedInstalls();
      if(installVerified){
        markCommitted();
        return true;
      }
      await new Promise(resolve=>setTimeout(resolve,COMMIT_VERIFY_INTERVAL_MS));
    }
    installed=false;
    installVerified=false;
    setButton(false,'Check / retry install');
    help('Chrome accepted the install request, but Civweave is not registered as an installed app yet. Tap Check / retry install. If Android is still finishing the WebAPK it will be detected; otherwise the installer will reload and offer a clean retry.');
    publish('civweave:pwa-install-commit-timeout',{committed:false});
    return false;
  })().finally(()=>{verificationPromise=null});
  return verificationPromise;
}
function refreshButton(){
  const button=installButton();
  if(!button||/reset app shell/i.test(button.textContent||''))return;
  if(!canonicalInstallOrigin()&&!standalone()){
    setButton(false,'Open canonical installer');
    help('Civweave installs into one canonical app home. This host node will hand installation to that home instead of creating a second copy.');
    return;
  }
  if(standalone()||installVerified){
    setButton(false,'Open Civweave');
    help('Civweave is installed as an app. The campus can keep downloading in the background.');
    return;
  }
  if(installAccepted){
    if(verificationPromise){
      setFinalizingUi();
      return;
    }
    setButton(false,'Check / retry install');
    help('The Android install was accepted but has not been verified yet. Check it before starting another install.');
    return;
  }
  if(promptEvent){
    setButton(false,'Install Civweave');
    help('Civweave is ready for a real browser-native app install. Tap Install Civweave.');
    return;
  }
  if(!prompting){
    setButton(false,'Install Civweave');
    help('Waiting for Chrome to offer the real Civweave app-install prompt. Do not use Create shortcut: that only links back to the website.');
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
  if(!canonicalInstallOrigin()){
    rerouteAlternateInstall();
    return;
  }
  promptEvent=event;
  installAccepted=false;
  installVerified=false;
  publish('civweave:pwa-install-prompt-ready',{available:true});
  queueMicrotask(refreshButton);
}
function onInstalled(){
  promptEvent=null;
  prompting=false;
  installAccepted=true;
  setFinalizingUi();
  publish('civweave:pwa-install-accepted',{available:false});
  waitForCommittedInstall();
}
async function verifyOrRetry(){
  setButton(true,'Checking install…');
  await discoverRelatedInstalls();
  if(installVerified){
    markCommitted();
    return;
  }
  const current=new URL(location.href);
  current.searchParams.set('install-retry',Date.now().toString(36));
  location.replace(current.href);
}
async function ownInstallClick(event){
  const button=event.target?.closest?.('#install-app');
  if(!button||button.disabled||prompting)return;
  if(/reset app shell/i.test(button.textContent||''))return;
  if(!canonicalInstallOrigin()&&!standalone()){
    event.preventDefault();
    event.stopImmediatePropagation();
    location.assign(canonicalInstallerUrl().href);
    return;
  }
  if(standalone()||installVerified){
    event.preventDefault();
    event.stopImmediatePropagation();
    location.assign(ENTRY);
    return;
  }
  if(installAccepted&&!promptEvent){
    event.preventDefault();
    event.stopImmediatePropagation();
    await verifyOrRetry();
    return;
  }
  const prompt=promptEvent;
  event.preventDefault();
  event.stopImmediatePropagation();
  if(!prompt){
    help('Chrome has not offered a true Civweave app-install prompt yet. Do not use Create shortcut: that only links back to the website. Tap Check release or reload this installer after the shell is ready.');
    return;
  }
  prompting=true;
  promptEvent=null;
  setButton(true,'Opening app install…');
  try{
    await prompt.prompt();
    const choice=await prompt.userChoice.catch(()=>null);
    if(choice?.outcome==='accepted'){
      installAccepted=true;
      setFinalizingUi();
      publish('civweave:pwa-install-accepted',{available:false});
      await waitForCommittedInstall();
    }else{
      installAccepted=false;
      help('Civweave app installation was dismissed. Reload this installer when you want Chrome to offer the native install again.');
      setButton(false,'Reload to install');
    }
  }catch(error){
    installAccepted=false;
    help(`The native Civweave install prompt could not open: ${error?.message||error}. Reload this installer and try again.`);
    setButton(false,'Reload to install');
  }finally{
    prompting=false;
  }
}

if(rerouteAlternateInstall())return;

addEventListener('beforeinstallprompt',capture);
addEventListener('appinstalled',onInstalled);
document.addEventListener('click',ownInstallClick,true);
if(document.readyState==='loading')addEventListener('DOMContentLoaded',()=>{observeButton();discoverRelatedInstalls()},{once:true});else{observeButton();discoverRelatedInstalls()}
addEventListener('pageshow',()=>{if(installAccepted&&!installVerified)waitForCommittedInstall(Math.min(COMMIT_VERIFY_TIMEOUT_MS,15000))});
addEventListener('pagehide',()=>buttonObserver?.disconnect(),{once:true});

const api=Object.freeze({
  version:VERSION,
  canonicalOrigin:CANONICAL_ORIGIN,
  hostNodeOrigin:HOST_NODE_ORIGIN,
  canonicalInstallOrigin,
  canonicalInstallerUrl:()=>canonicalInstallerUrl().href,
  discoverRelatedInstalls,
  waitForCommittedInstall,
  relatedInstalls:()=>[...relatedApps],
  available:()=>Boolean(promptEvent),
  peek:()=>promptEvent,
  consume(){const value=promptEvent;promptEvent=null;return value},
  restore(event){if(event)promptEvent=event;return Boolean(promptEvent)},
  standalone,
  refresh:refreshButton,
  state:()=>({available:Boolean(promptEvent),installed,installAccepted,installVerified,prompting,standalone:standalone(),canonicalOrigin:CANONICAL_ORIGIN,relatedApps:[...relatedApps]})
});

globalThis.CivweavePWAInstallV246=api;
publish('civweave:pwa-install-bridge-ready',{available:Boolean(promptEvent)});
})();
