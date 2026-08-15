(()=>{
'use strict';

const VERSION='pwa-install-prompt-v249-user-gesture-safe';
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
let priming=false;
let primed=false;
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
function installer(){return globalThis.CivweaveInstallerV130||null}
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
  if(prompting)return;
  const shell=installer();
  if(priming||shell&&!shell.shellReady){
    button.disabled=true;
    button.textContent='Preparing app shell…';
    help('Preparing the small installable shell so the browser can offer Civweave before your install click. Offline campus files remain separate.');
    return;
  }
  if(promptEvent){
    button.disabled=false;
    button.textContent='Install Civweave';
    help('Civweave is ready for a browser-native app install from this host. Tap Install Civweave.');
    return;
  }
  button.disabled=false;
  button.textContent='Install Civweave';
  help(primed
    ? 'The lightweight shell is ready. Waiting for Chromium to expose its native install prompt; the browser menu can also install the app.'
    : 'Preparing installability now. The offline campus, media, knowledge packs, and local models stay opt-in.');
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
  void discoverRelatedInstalls();
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
async function primeInstallability(){
  if(standalone()||installed||priming||primed||!installOrigin())return;
  const shell=installer();
  if(!shell?.prepareShell)return;
  priming=true;
  publish('civweave:pwa-installability-preparing',{eager:true});
  queueMicrotask(refreshButton);
  try{
    if(!shell.shellReady)await shell.prepareShell({eager:true});
    primed=Boolean(shell.shellReady);
    publish('civweave:pwa-installability-ready',{ready:primed});
    if(!primed)help('The lightweight app shell could not finish preparing. Use Reset app shell and retry if the installer reports an error.');
  }catch(error){
    primed=false;
    publish('civweave:pwa-installability-error',{message:error?.message||String(error)});
  }finally{
    priming=false;
    queueMicrotask(refreshButton);
  }
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
  const shell=installer();
  event.preventDefault();
  event.stopImmediatePropagation();
  if(!shell?.prepareShell){
    help('The lightweight shell controller is still loading. Installability will prepare automatically as soon as it is available.');
    return;
  }
  if(!shell.shellReady){
    button.disabled=true;
    button.textContent='Preparing app shell…';
    help('Finishing the small app shell first. The Install button will re-enable when a fresh browser install gesture can open the native prompt.');
    void primeInstallability();
    return;
  }
  const prompt=promptEvent;
  if(!prompt){
    primed=true;
    button.disabled=false;
    button.textContent='Install Civweave';
    help('The app shell is ready, but Chromium has not exposed its native install prompt yet. Wait a moment and tap Install again, or use the browser Install app command.');
    return;
  }

  promptEvent=null;
  prompting=true;
  button.disabled=true;
  button.textContent='Opening app install…';
  try{
    // prompt() must be invoked synchronously from this click. Do not await shell work here.
    prompt.prompt();
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
    help(`Civweave could not open the native install prompt: ${error?.message||error}. Reload the installer and retry.`);
    button.disabled=false;
    button.textContent='Retry install';
  }finally{prompting=false}
}
function start(){
  observeButton();
  queueMicrotask(()=>void primeInstallability());
}

if(hostSetupRedirect())return;
if(rerouteUnsafeInstall())return;

addEventListener('beforeinstallprompt',capture);
addEventListener('appinstalled',onInstalled);
document.addEventListener('click',ownInstallClick,true);
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
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
  prepareInstallability:primeInstallability,
  browserRuntimePolicy:'installer-only-until-installed-display',
  installSequencingPolicy:'prepare-shell-before-user-install-gesture',
  promptAvailabilityPolicy:'capture-beforeinstallprompt-then-prompt-synchronously-on-click',
  eagerRelatedAppDiscovery:false,
  eagerShellPreparation:true,
  firstInputSafe:true,
  state:()=>({available:Boolean(promptEvent),installed,prompting,priming,primed,standalone:standalone(),canonicalOrigin:CANONICAL_ORIGIN,installOrigin:location.origin,relatedApps:[...relatedApps]})
});

globalThis.CivweavePWAInstallV249=api;
globalThis.CivweavePWAInstallV248=api;
globalThis.CivweavePWAInstallV247=api;
globalThis.CivweavePWAInstallV246=api;
publish('civweave:pwa-install-bridge-ready',{available:Boolean(promptEvent)});
})();