(()=>{
'use strict';

const VERSION='pwa-install-prompt-v250-download-then-install-v6-single-owner-live';
const ENTRY='/app/installed-entry-v146.html?installed=1&system=civweave';
const HOST_SETUP_PATH='/host-setup.html';
const CANONICAL_ORIGIN='https://civweave.cc';
const STAGING_ORIGIN='https://civweave-staging.pages.dev';
const PREVIOUS_CANONICAL_ORIGIN='https://civweave.pages.dev';
const LEGACY_CANONICAL_ORIGIN='https://commonweave.pages.dev';
const HOST_NODE_ORIGIN='https://civweave-host-node.onrender.com';
const MANIFESTS=[CANONICAL_ORIGIN,STAGING_ORIGIN,PREVIOUS_CANONICAL_ORIGIN,LEGACY_CANONICAL_ORIGIN,HOST_NODE_ORIGIN].map(origin=>`${origin}/app/manifest.webmanifest`);
const INSTALL_MARKER_KEY='civweave.pwa.installed-marker.v1';
const LAUNCH_SESSION_KEY='civweave.pwa.launch-session.v1';
const RETIRED_CAPABILITY_KEY='civweave.pwa.installed-capability.v1';
const INSTALLABILITY_RELOAD_KEY='civweave.pwa.installability-reload.v2';
const INSTALLABILITY_WORKER_URL='/pwa-installability-worker-v1.js?v=desktop-installability-v1';
const INSTALL_CONFIRM_TIMEOUT_MS=3500;
let promptEvent=null,prompting=false,buttonObserver=null,refreshQueued=false,relatedApps=[];

function standalone(){return navigator.standalone===true||['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches)}
function launchSession(){try{return sessionStorage.getItem(LAUNCH_SESSION_KEY)==='1'}catch{return false}}
function appRuntime(){return standalone()||launchSession()}
function readInstalledMarker(){try{const value=JSON.parse(localStorage.getItem(INSTALL_MARKER_KEY)||'null');return Boolean(value&&value.origin===location.origin&&value.manifestId==='/civweave-local')}catch{return false}}
let installed=false,installedHint=readInstalledMarker();
function rememberInstalled(source='appinstalled'){
  try{localStorage.setItem(INSTALL_MARKER_KEY,JSON.stringify({origin:location.origin,manifestId:'/civweave-local',source,installedAt:new Date().toISOString()}));localStorage.removeItem(RETIRED_CAPABILITY_KEY)}catch{}
  installed=true;installedHint=true;document.documentElement.dataset.civweaveInstalledMarker='confirmed';return true;
}
function forgetInstalledMarker(){try{localStorage.removeItem(INSTALL_MARKER_KEY);localStorage.removeItem(RETIRED_CAPABILITY_KEY)}catch{}installedHint=false;return true}
function localDevelopment(){return ['localhost','127.0.0.1','::1'].includes(location.hostname)}
function cloudflarePreview(){return location.hostname.endsWith('.pages.dev')&&location.hostname.split('.').length>3}
function productionPagesOrigin(){return location.hostname.endsWith('.pages.dev')&&location.hostname.split('.').length===3}
function previousCanonical(){return location.origin===PREVIOUS_CANONICAL_ORIGIN}
function previewParentOrigin(){if(!cloudflarePreview())return null;const parent=`https://${location.hostname.split('.').slice(1).join('.')}`;return parent===LEGACY_CANONICAL_ORIGIN||parent===PREVIOUS_CANONICAL_ORIGIN?CANONICAL_ORIGIN:parent}
function installOrigin(){return localDevelopment()||(productionPagesOrigin()&&!previousCanonical())||(!location.hostname.endsWith('.pages.dev')&&![HOST_NODE_ORIGIN,LEGACY_CANONICAL_ORIGIN,PREVIOUS_CANONICAL_ORIGIN].includes(location.origin))}
function stableInstallerUrl(){const destination=previewParentOrigin()||CANONICAL_ORIGIN,target=new URL('/app/index.html',destination),current=new URL(location.href);for(const [key,value] of current.searchParams)if(key!=='install_origin')target.searchParams.append(key,value);target.searchParams.set('install_origin',cloudflarePreview()?'host-production':'canonical');return target}
function hostSetupRedirect(){const current=new URL(location.href);if(current.searchParams.get('host_setup')!=='1'||current.pathname===HOST_SETUP_PATH)return false;location.replace(new URL(HOST_SETUP_PATH,current.origin).href);return true}
function rerouteUnsafeInstall(){if(appRuntime()||localDevelopment())return false;if(![HOST_NODE_ORIGIN,LEGACY_CANONICAL_ORIGIN,PREVIOUS_CANONICAL_ORIGIN].includes(location.origin)&&!cloudflarePreview())return false;location.replace(stableInstallerUrl().href);return true}
function help(message){const node=document.querySelector('#install-help');if(node&&node.textContent!==message)node.textContent=message}
function installButton(){return document.querySelector('#install-app')}
function installer(){return globalThis.CivweaveInstallerV130||null}
function setButton(button,{disabled,text}={}){if(!button)return;if(typeof disabled==='boolean')button.disabled=disabled;if(typeof text==='string'&&button.textContent!==text)button.textContent=text}
function publish(type,detail={}){try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,standalone:standalone(),installed,installedHint,installOrigin:location.origin,...detail}}))}catch{}}
function queueRefresh(){if(refreshQueued)return;refreshQueued=true;queueMicrotask(()=>{refreshQueued=false;refreshButton()})}
function workerPath(worker){try{return new URL(worker?.scriptURL||'',location.href).pathname}catch{return ''}}

async function ensureInstallabilityBootstrap(){
  if(appRuntime()||!installOrigin()||!('serviceWorker' in navigator))return false;
  try{
    const existing=await navigator.serviceWorker.getRegistration('/');
    if(existing?.active){publish('civweave:pwa-installability-bootstrap',{ready:true,worker:workerPath(existing.active),reused:true});return true}
    await navigator.serviceWorker.register(INSTALLABILITY_WORKER_URL,{scope:'/',updateViaCache:'none'});
    await Promise.race([navigator.serviceWorker.ready,new Promise(resolve=>setTimeout(resolve,5000))]);
    const registration=await navigator.serviceWorker.getRegistration('/');
    if(registration?.active){
      let alreadyReloaded=false;try{alreadyReloaded=sessionStorage.getItem(INSTALLABILITY_RELOAD_KEY)==='1'}catch{}
      if(!navigator.serviceWorker.controller&&!alreadyReloaded){try{sessionStorage.setItem(INSTALLABILITY_RELOAD_KEY,'1')}catch{}const next=new URL(location.href);next.searchParams.set('installability_ready',Date.now().toString(36));location.replace(next.href);return true}
      publish('civweave:pwa-installability-bootstrap',{ready:true,worker:workerPath(registration.active),reused:false});
      return true;
    }
  }catch(error){publish('civweave:pwa-installability-bootstrap-error',{message:error?.message||String(error)})}
  return false;
}

async function discoverRelatedInstalls(){
  if(typeof navigator.getInstalledRelatedApps!=='function')return[];
  try{relatedApps=await navigator.getInstalledRelatedApps()||[]}catch{relatedApps=[]}
  const urls=new Set(relatedApps.map(app=>String(app?.url||''))),currentManifest=`${location.origin}/app/manifest.webmanifest`;
  if(urls.has(currentManifest))rememberInstalled('getInstalledRelatedApps');else if(installedHint)forgetInstalledMarker();
  for(const [index,url] of MANIFESTS.entries())document.documentElement.dataset[`civweaveRelatedInstall${index}`]=urls.has(url)?'installed':'absent';
  queueRefresh();return [...relatedApps];
}

function refreshButton(){
  const button=installButton();if(!button||/reset app shell|repair shell/i.test(button.textContent||''))return;
  if(!installOrigin()&&!appRuntime()){setButton(button,{disabled:false,text:'Open stable Civweave installer'});return}
  if(appRuntime()){setButton(button,{disabled:false,text:'Open Civweave'});return}
  if(installed){setButton(button,{disabled:true,text:'Civweave installed'});return}
  if(prompting)return;
  const shell=installer();
  if(!shell?.shellReady){
    setButton(button,{disabled:false,text:'Download Civweave'});
    help(promptEvent?'Civweave can be installed. Download the small app shell first; then use Install Civweave.':'Download the small Civweave app shell first. The offline campus, media, knowledge packs, and local models remain separate.');
    return;
  }
  setButton(button,{disabled:false,text:'Install Civweave'});
  help(promptEvent?'Civweave is downloaded. Tap Install Civweave to open the browser-native install dialog.':'Civweave is downloaded. Chromium has not offered its install event yet; use the browser Install app command or reload this installer once.');
}
function observeButton(){const button=installButton();if(!button)return;buttonObserver?.disconnect();buttonObserver=new MutationObserver(queueRefresh);buttonObserver.observe(button,{attributes:true,attributeFilter:['disabled'],childList:true});refreshButton()}

function capture(event){
  if(!installOrigin()){rerouteUnsafeInstall();return}
  event.preventDefault();
  event.stopImmediatePropagation();
  promptEvent=event;
  try{sessionStorage.removeItem(INSTALLABILITY_RELOAD_KEY)}catch{}
  publish('civweave:pwa-install-prompt-ready',{available:true,singleOwner:true});
  queueRefresh();
}

async function completeShellAfterBrowserInstall(){const shell=installer();if(!shell?.prepareShell||shell.shellReady)return true;await shell.prepareShell({manual:false});return Boolean(shell.shellReady)}
function onInstalled(){rememberInstalled('appinstalled');promptEvent=null;prompting=false;publish('civweave:pwa-installed',{available:false});queueRefresh();void completeShellAfterBrowserInstall();void discoverRelatedInstalls()}

async function prepareAfterInteraction(shell,button){
  prompting=true;setButton(button,{disabled:true,text:'Downloading Civweave…'});help('Downloading the small Civweave app shell.');
  try{await shell.prepareShell({manual:false});publish('civweave:pwa-installability-ready',{ready:Boolean(shell.shellReady),userInitiated:true})}
  catch(error){publish('civweave:pwa-installability-error',{message:error?.message||String(error),userInitiated:true})}
  finally{prompting=false;setButton(button,{disabled:false});queueRefresh()}
}

async function verifyAcceptedInstall(button){await new Promise(resolve=>setTimeout(resolve,INSTALL_CONFIRM_TIMEOUT_MS));if(installed||appRuntime())return true;await discoverRelatedInstalls();if(installed||appRuntime())return true;setButton(button,{disabled:false,text:'Install Civweave'});help('The browser accepted the install request but did not confirm installation yet. Check your app launcher, then retry if needed.');return false}

async function ownInstallClick(event){
  const button=event.target?.closest?.('#install-app');if(!button||button.disabled||prompting)return;if(/reset app shell|repair shell/i.test(button.textContent||''))return;
  event.preventDefault();event.stopImmediatePropagation();
  if(!installOrigin()&&!appRuntime()){location.assign(stableInstallerUrl().href);return}
  if(appRuntime()){location.assign(ENTRY);return}
  if(installed)return;
  const shell=installer();if(!shell?.prepareShell){help('The Civweave download controller is still loading. Try again.');return}
  if(!shell.shellReady){await prepareAfterInteraction(shell,button);return}
  const prompt=promptEvent;
  if(!prompt){help('Civweave is downloaded, but no deferred Chromium install event is available. Use the browser Install app command or reload this installer once.');return}
  promptEvent=null;prompting=true;setButton(button,{disabled:true,text:'Opening app install…'});
  try{
    prompt.prompt();
    const choice=await prompt.userChoice.catch(()=>null);
    if(choice?.outcome==='accepted'){setButton(button,{disabled:true,text:'Finishing installation…'});help('Civweave installation was accepted. Waiting for browser confirmation…');setTimeout(()=>void verifyAcceptedInstall(button),0)}
    else{setButton(button,{disabled:false,text:'Install Civweave'});help('Installation was dismissed. Reload to request a new install prompt.')}
  }catch(error){setButton(button,{disabled:false,text:'Install Civweave'});help(`Civweave could not open the native install prompt: ${error?.message||error}.`)}
  finally{prompting=false}
}

if(hostSetupRedirect())return;if(rerouteUnsafeInstall())return;
addEventListener('beforeinstallprompt',capture,{capture:true});
addEventListener('appinstalled',onInstalled);
document.addEventListener('click',ownInstallClick,true);
const startInstaller=()=>{observeButton();void ensureInstallabilityBootstrap()};
if(document.readyState==='loading')addEventListener('DOMContentLoaded',startInstaller,{once:true});else startInstaller();
addEventListener('pagehide',()=>buttonObserver?.disconnect(),{once:true});

const api=Object.freeze({
  version:VERSION,canonicalOrigin:CANONICAL_ORIGIN,stagingOrigin:STAGING_ORIGIN,previousCanonicalOrigin:PREVIOUS_CANONICAL_ORIGIN,legacyCanonicalOrigin:LEGACY_CANONICAL_ORIGIN,hostNodeOrigin:HOST_NODE_ORIGIN,
  installMarkerKey:INSTALL_MARKER_KEY,launchSessionKey:LAUNCH_SESSION_KEY,installedMarker:readInstalledMarker,launchSession,appRuntime,rememberInstalled,forgetInstalledMarker,installOrigin,canonicalInstallOrigin:installOrigin,
  canonicalInstallerUrl:()=>stableInstallerUrl().href,stableInstallerUrl:()=>stableInstallerUrl().href,discoverRelatedInstalls,relatedInstalls:()=>[...relatedApps],available:()=>Boolean(promptEvent),peek:()=>promptEvent,
  consume(){const value=promptEvent;promptEvent=null;return value},restore(event){if(event)promptEvent=event;return Boolean(promptEvent)},standalone,refresh:refreshButton,
  browserRuntimePolicy:'installed-display-or-pwa-launch-session-only',installStatePolicy:'confirmed-install-only-marker-is-hint',installSequencingPolicy:'download-on-first-interaction-then-install-on-fresh-gesture',
  promptAvailabilityPolicy:'capture-beforeinstallprompt-then-prompt-synchronously-on-fresh-click',singleOwnerPromptPolicy:'capture-stop-immediate-propagation',installabilityBootstrapPolicy:'tiny-navigation-pass-through-worker-no-shell-cache',
  eagerInstallabilityBootstrap:true,eagerRelatedAppDiscovery:false,eagerShellPreparation:false,firstPaintShellWork:false,cacheDistinctPath:true,firstInputSafe:true,
  state:()=>({available:Boolean(promptEvent),installed,installedHint,prompting,standalone:standalone(),controller:workerPath(navigator.serviceWorker?.controller),installOrigin:location.origin,relatedApps:[...relatedApps]})
});
globalThis.CivweavePWAInstallV250=api;globalThis.CivweavePWAInstallV249=api;globalThis.CivweavePWAInstallV248=api;globalThis.CivweavePWAInstallV247=api;globalThis.CivweavePWAInstallV246=api;
publish('civweave:pwa-install-bridge-ready',{available:Boolean(promptEvent),singleOwner:true});
})();
