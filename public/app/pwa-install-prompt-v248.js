(()=>{
'use strict';

const VERSION='pwa-install-prompt-v248-shell-first-prompt-wait';
const ENTRY='/app/installed-entry-v146.html?installed=1&system=civweave';
const HOST_SETUP_PATH='/host-setup.html';
const CANONICAL_ORIGIN='https://civweave.cc';
const PREVIOUS_CANONICAL_ORIGIN='https://civweave.pages.dev';
const LEGACY_CANONICAL_ORIGIN='https://commonweave.pages.dev';
const HOST_NODE_ORIGIN='https://civweave-host-node.onrender.com';
const CANONICAL_MANIFEST=`${CANONICAL_ORIGIN}/app/manifest.webmanifest`;
const PREVIOUS_CANONICAL_MANIFEST=`${PREVIOUS_CANONICAL_ORIGIN}/app/manifest.webmanifest`;
const LEGACY_CANONICAL_MANIFEST=`${LEGACY_CANONICAL_ORIGIN}/app/manifest.webmanifest`;
const HOST_NODE_MANIFEST=`${HOST_NODE_ORIGIN}/app/manifest.webmanifest`;
const PROMPT_WAIT_MS=6000;
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
function previousCanonical(){return location.origin===PREVIOUS_CANONICAL_ORIGIN}
function previewParentOrigin(){
  if(!cloudflarePreview())return null;
  const parent=`https://${location.hostname.split('.').slice(1).join('.')}`;
  return parent===LEGACY_CANONICAL_ORIGIN||parent===PREVIOUS_CANONICAL_ORIGIN?CANONICAL_ORIGIN:parent;
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
function installOrigin(){return localDevelopment()||(productionPagesOrigin()&&!previousCanonical())||(!location.hostname.endsWith('.pages.dev')&&location.origin!==HOST_NODE_ORIGIN&&location.origin!==LEGACY_CANONICAL_ORIGIN&&location.origin!==PREVIOUS_CANONICAL_ORIGIN)}
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
  if(location.origin!==HOST_NODE_ORIGIN&&location.origin!==LEGACY_CANONICAL_ORIGIN&&location.origin!==PREVIOUS_CANONICAL_ORIGIN&&!cloudflarePreview())return false;
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
  const previousCanonicalInstalled=urls.has(PREVIOUS_CANONICAL_MANIFEST);
  const legacyCanonicalInstalled=urls.has(LEGACY_CANONICAL_MANIFEST);
  const hostNodeInstalled=urls.has(HOST_NODE_MANIFEST);
  document.documentElement.dataset.civweaveCanonicalInstall=canonicalInstalled?'installed':'unknown';
  document.documentElement.dataset.civweavePreviousCanonicalInstall=previousCanonicalInstalled?'installed':'absent';
  document.documentElement.dataset.civweaveLegacyCanonicalInstall=legacyCanonicalInstalled?'installed':'absent';
  document.documentElement.dataset.civweaveLegacyRenderInstall=hostNodeInstalled?'installed':'absent';
  publish('civweave:related-install-state',{canonicalInstalled,previousCanonicalInstalled,legacyCanonicalInstalled,hostNodeInstalled,relatedApps:[...relatedApps]});
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
    help('Install prepares the lightweight shell first, then opens the browser-native app prompt as soon as Chromium offers it.');
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
function waitForPrompt(timeoutMs=PROMPT_WAIT_MS){
  if(promptEvent)return Promise.resolve(promptEvent);
  return new Promise(resolve=>{
    let settled=false;
    const finish=value=>{
      if(settled)return;
      settled=true;
      clearTimeout(timer);
      removeEventListener('beforeinstallprompt',onPrompt);
      resolve(value||null);
    };
    const onPrompt=event=>{
      if(!promptEvent)promptEvent=event;
      finish(promptEvent||event);
    };
    const timer=setTimeout(()=>finish(promptEvent),timeoutMs);
    addEventListener('beforeinstallprompt',onPrompt);
  });
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
  const installer=globalThis.CivweaveInstallerV130;
  event.preventDefault();
  event.stopImmediatePropagation();
  if(!installer?.prepareShell){
    help('The lightweight shell controller is still loading. Wait a moment, then tap Install Civweave again.');
    return;
  }
  prompting=true;
  button.disabled=true;
  button.textContent='Preparing app shell…';
  try{
    await installer.prepareShell({manual:true});
    if(!installer.shellReady){
      help('Civweave was not installed because the lightweight app shell is not ready. Repair or retry the shell, then install again.');
      return;
    }
    button.textContent='Waiting for browser install…';
    help('The app shell is ready. Waiting briefly for Chromium to publish the native Civweave install prompt…');
    const prompt=promptEvent||await waitForPrompt();
    if(!prompt){
      button.disabled=false;
      button.textContent='Install Civweave';
      help('The Civweave shell is ready, but this browser has not exposed its native app prompt yet. Reload this installer once, then tap Install Civweave again; do not use Create shortcut.');
      return;
    }
    promptEvent=null;
    button.disabled=true;
    button.textContent='Opening app install…';
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
    help(`Civweave was not installed because the lightweight shell or native install prompt could not finish: ${error?.message||error}. Retry from this installer.`);
    button.disabled=false;
    button.textContent='Retry install';
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
  previousCanonicalOrigin:PREVIOUS_CANONICAL_ORIGIN,
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
  waitForPrompt,
  browserRuntimePolicy:'installer-only-until-installed-display',
  installSequencingPolicy:'prepare-shell-before-native-prompt',
  promptAvailabilityPolicy:'prepare-shell-then-wait-for-beforeinstallprompt',
  state:()=>({available:Boolean(promptEvent),installed,prompting,standalone:standalone(),canonicalOrigin:CANONICAL_ORIGIN,installOrigin:location.origin,relatedApps:[...relatedApps]})
});

globalThis.CivweavePWAInstallV248=api;
globalThis.CivweavePWAInstallV247=api;
globalThis.CivweavePWAInstallV246=api;
publish('civweave:pwa-install-bridge-ready',{available:Boolean(promptEvent)});
})();