(()=>{
'use strict';

const VERSION='pwa-install-prompt-v250-download-then-install-v8-navigation-handoff';
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
const SHELL_HANDOFF_KEY='civweave.pwa.shell-handoff.v1';
const SHELL_HANDOFF_ATTEMPT_KEY='civweave.pwa.shell-handoff-attempt.v1';
const INSTALLABILITY_WORKER_URL='/pwa-installability-worker-v1.js?v=desktop-installability-v1';
const INSTALLABILITY_WORKER_PATH='/pwa-installability-worker-v1.js';
const SHELL_WORKER_PATH='/service-worker-v203.js';
const INSTALL_CONFIRM_TIMEOUT_MS=3500;
let promptEvent=null,prompting=false,buttonObserver=null,refreshQueued=false,relatedApps=[];
let bootstrapTask=null,shellDownloadStarted=false,handoffResumeAttempts=0;

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
function shellHandoffPending(){try{return sessionStorage.getItem(SHELL_HANDOFF_KEY)==='1'}catch{return false}}
function markShellHandoff(){try{sessionStorage.setItem(SHELL_HANDOFF_KEY,'1');if(!sessionStorage.getItem(SHELL_HANDOFF_ATTEMPT_KEY))sessionStorage.setItem(SHELL_HANDOFF_ATTEMPT_KEY,'0')}catch{}return true}
function clearShellHandoff(){try{sessionStorage.removeItem(SHELL_HANDOFF_KEY);sessionStorage.removeItem(SHELL_HANDOFF_ATTEMPT_KEY)}catch{}return true}
function handoffAttempt(){try{return Math.max(0,Number(sessionStorage.getItem(SHELL_HANDOFF_ATTEMPT_KEY)||0)||0)}catch{return 0}}
function reloadForShellHandoff(source='download'){
  const attempt=handoffAttempt()+1;try{sessionStorage.setItem(SHELL_HANDOFF_ATTEMPT_KEY,String(attempt))}catch{}
  const next=new URL(location.href);next.searchParams.set('shell_handoff',`${source}-${attempt}-${Date.now().toString(36)}`);location.replace(next.href);return true;
}
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
function loadProgressiveDisclosure(){if(globalThis.CivweaveProgressiveDisclosureV1||document.querySelector('script[data-cw-progressive-disclosure-v1]'))return true;const script=document.createElement('script');script.src='/app/usability-progressive-disclosure-v1.js?v=1.0.0';script.async=true;script.dataset.cwProgressiveDisclosureV1='';document.head.append(script);return true}
function installButton(){return document.querySelector('#install-app')}
function installer(){return globalThis.CivweaveInstallerV130||null}
function setButton(button,{disabled,text}={}){if(!button)return;if(typeof disabled==='boolean')button.disabled=disabled;if(typeof text==='string'&&button.textContent!==text)button.textContent=text}
function publish(type,detail={}){try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,standalone:standalone(),installed,installedHint,installOrigin:location.origin,...detail}}))}catch{}}
function queueRefresh(){if(refreshQueued)return;refreshQueued=true;queueMicrotask(()=>{refreshQueued=false;refreshButton()})}
function workerPath(worker){try{return new URL(worker?.scriptURL||'',location.href).pathname}catch{return ''}}
function registrationHasPath(registration,path){return[registration?.active,registration?.waiting,registration?.installing].some(worker=>workerPath(worker)===path)}

async function ensureInstallabilityBootstrap(){
  if(shellDownloadStarted||shellHandoffPending()||appRuntime()||!installOrigin()||!('serviceWorker' in navigator))return false;
  try{
    const existing=await navigator.serviceWorker.getRegistration('/');
    if(shellDownloadStarted)return false;
    if(existing?.active){publish('civweave:pwa-installability-bootstrap',{ready:true,worker:workerPath(existing.active),reused:true});return true}
    await navigator.serviceWorker.register(INSTALLABILITY_WORKER_URL,{scope:'/',updateViaCache:'none'});
    await Promise.race([navigator.serviceWorker.ready,new Promise(resolve=>setTimeout(resolve,5000))]);
    if(shellDownloadStarted)return false;
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
function startInstallabilityBootstrap(){if(bootstrapTask)return bootstrapTask;bootstrapTask=ensureInstallabilityBootstrap().finally(()=>{bootstrapTask=null});return bootstrapTask}

async function retireInstallabilityBootstrap(){
  if(!('serviceWorker' in navigator))return false;
  try{
    const registration=await navigator.serviceWorker.getRegistration('/');
    if(!registration||!registrationHasPath(registration,INSTALLABILITY_WORKER_PATH)||registrationHasPath(registration,SHELL_WORKER_PATH))return false;
    const removed=await Promise.race([registration.unregister(),new Promise(resolve=>setTimeout(()=>resolve(false),2500))]);
    publish('civweave:pwa-installability-bootstrap-retired',{removed:Boolean(removed),worker:INSTALLABILITY_WORKER_PATH});
    if(removed)await new Promise(resolve=>setTimeout(resolve,40));
    return Boolean(removed);
  }catch(error){publish('civweave:pwa-installability-bootstrap-retire-error',{message:error?.message||String(error)});return false}
}

async function shellNeedsNavigationHandoff(){
  if(!('serviceWorker' in navigator))return false;
  try{const registration=await navigator.serviceWorker.getRegistration('/');return Boolean(registrationHasPath(registration,INSTALLABILITY_WORKER_PATH)&&!registrationHasPath(registration,SHELL_WORKER_PATH))}catch{return false}
}

async function beginNavigationHandoff(source='download'){
  markShellHandoff();shellDownloadStarted=true;
  if(bootstrapTask)await Promise.race([bootstrapTask,new Promise(resolve=>setTimeout(resolve,1800))]);
  await retireInstallabilityBootstrap();
  publish('civweave:pwa-shell-handoff',{source,navigationRequired:true,attempt:handoffAttempt()+1});
  help('Switching from the tiny browser-install helper to the Civweave app shell…');
  reloadForShellHandoff(source);
  return true;
}

async function resumeShellHandoff(){
  if(!shellHandoffPending())return false;
  const shell=installer();
  if(!shell?.prepareShell){
    handoffResumeAttempts+=1;
    if(handoffResumeAttempts<60){setTimeout(()=>void resumeShellHandoff(),50);return true}
    clearShellHandoff();help('The Civweave download controller did not load. Reload the installer and try Download Civweave again.');queueRefresh();return false;
  }
  const current=await navigator.serviceWorker.getRegistration('/').catch(()=>null);
  if(registrationHasPath(current,INSTALLABILITY_WORKER_PATH)&&!registrationHasPath(current,SHELL_WORKER_PATH)){
    await retireInstallabilityBootstrap();
    if(handoffAttempt()<3){help('Finishing the browser-to-app-shell handoff…');reloadForShellHandoff('bootstrap-release');return true}
    clearShellHandoff();help('The browser did not release its temporary install helper. Reload once, then tap Download Civweave again.');queueRefresh();return false;
  }
  shellDownloadStarted=true;prompting=true;
  const button=installButton();setButton(button,{disabled:true,text:'Downloading Civweave…'});help('Downloading the small Civweave app shell.');
  try{
    await shell.prepareShell({manual:false});
    const ready=Boolean(shell.shellReady);
    publish('civweave:pwa-installability-ready',{ready,userInitiated:true,resumedHandoff:true});
    if(ready){clearShellHandoff();try{sessionStorage.removeItem(INSTALLABILITY_RELOAD_KEY)}catch{}help('Civweave is downloaded. Waiting for the browser install option…')}
    return ready;
  }catch(error){publish('civweave:pwa-installability-error',{message:error?.message||String(error),userInitiated:true,resumedHandoff:true});return false}
  finally{prompting=false;setButton(button,{disabled:false});queueRefresh()}
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
  if(prompting||shellHandoffPending()){if(shellHandoffPending())setButton(button,{disabled:true,text:'Preparing app shell…'});return}
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

async function completeShellAfterBrowserInstall(){
  const shell=installer();if(!shell?.prepareShell||shell.shellReady)return true;shellDownloadStarted=true;
  if(await shellNeedsNavigationHandoff()){await beginNavigationHandoff('browser-install');return false}
  await shell.prepareShell({manual:false});return Boolean(shell.shellReady)
}
function onInstalled(){rememberInstalled('appinstalled');promptEvent=null;prompting=false;publish('civweave:pwa-installed',{available:false});queueRefresh();void completeShellAfterBrowserInstall();void discoverRelatedInstalls()}

async function prepareAfterInteraction(shell,button){
  prompting=true;shellDownloadStarted=true;setButton(button,{disabled:true,text:'Downloading Civweave…'});help('Downloading the small Civweave app shell.');
  let navigating=false;
  try{
    if(await shellNeedsNavigationHandoff()){navigating=true;await beginNavigationHandoff('download');return}
    await shell.prepareShell({manual:false});
    publish('civweave:pwa-installability-ready',{ready:Boolean(shell.shellReady),userInitiated:true});
  }catch(error){publish('civweave:pwa-installability-error',{message:error?.message||String(error),userInitiated:true})}
  finally{if(!navigating){prompting=false;setButton(button,{disabled:false});queueRefresh()}}
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
const startInstaller=()=>{loadProgressiveDisclosure();observeButton();if(shellHandoffPending())void resumeShellHandoff();else void startInstallabilityBootstrap()};
if(document.readyState==='loading')addEventListener('DOMContentLoaded',startInstaller,{once:true});else startInstaller();
addEventListener('pagehide',()=>buttonObserver?.disconnect(),{once:true});

const api=Object.freeze({
  version:VERSION,canonicalOrigin:CANONICAL_ORIGIN,stagingOrigin:STAGING_ORIGIN,previousCanonicalOrigin:PREVIOUS_CANONICAL_ORIGIN,legacyCanonicalOrigin:LEGACY_CANONICAL_ORIGIN,hostNodeOrigin:HOST_NODE_ORIGIN,
  installMarkerKey:INSTALL_MARKER_KEY,launchSessionKey:LAUNCH_SESSION_KEY,shellHandoffKey:SHELL_HANDOFF_KEY,installedMarker:readInstalledMarker,launchSession,appRuntime,rememberInstalled,forgetInstalledMarker,installOrigin,canonicalInstallOrigin:installOrigin,
  canonicalInstallerUrl:()=>stableInstallerUrl().href,stableInstallerUrl:()=>stableInstallerUrl().href,discoverRelatedInstalls,relatedInstalls:()=>[...relatedApps],available:()=>Boolean(promptEvent),peek:()=>promptEvent,
  consume(){const value=promptEvent;promptEvent=null;return value},restore(event){if(event)promptEvent=event;return Boolean(promptEvent)},standalone,refresh:refreshButton,retireInstallabilityBootstrap,shellHandoffPending,resumeShellHandoff,
  browserRuntimePolicy:'installed-display-or-pwa-launch-session-only',installStatePolicy:'confirmed-install-only-marker-is-hint',installSequencingPolicy:'download-click-retire-bootstrap-navigation-resume-shell-then-install-on-fresh-gesture',
  promptAvailabilityPolicy:'capture-beforeinstallprompt-then-prompt-synchronously-on-fresh-click',singleOwnerPromptPolicy:'capture-stop-immediate-propagation',installabilityBootstrapPolicy:'tiny-navigation-pass-through-worker-retired-across-navigation-before-shell-download',
  eagerInstallabilityBootstrap:true,eagerRelatedAppDiscovery:false,eagerShellPreparation:false,firstPaintShellWork:false,cacheDistinctPath:true,firstInputSafe:true,navigationSafeShellHandoff:true,
  state:()=>({available:Boolean(promptEvent),installed,installedHint,prompting,standalone:standalone(),controller:workerPath(navigator.serviceWorker?.controller),installOrigin:location.origin,shellHandoffPending:shellHandoffPending(),handoffAttempt:handoffAttempt(),relatedApps:[...relatedApps]})
});
globalThis.CivweavePWAInstallV250=api;globalThis.CivweavePWAInstallV249=api;globalThis.CivweavePWAInstallV248=api;globalThis.CivweavePWAInstallV247=api;globalThis.CivweavePWAInstallV246=api;
publish('civweave:pwa-install-bridge-ready',{available:Boolean(promptEvent),singleOwner:true,navigationSafeShellHandoff:true});
})();