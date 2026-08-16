(()=>{
'use strict';

const VERSION='pwa-install-prompt-v250-download-then-install-v5-desktop-bootstrap';
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
const POST_DOWNLOAD_RELOAD_KEY='civweave.pwa.post-download-reload.v1';
const INSTALLABILITY_RELOAD_KEY='civweave.pwa.installability-reload.v1';
const INSTALLABILITY_WORKER_URL='/pwa-installability-worker-v1.js?v=desktop-installability-v1';
const PROMPT_WAIT_MS=6000;
const INSTALL_CONFIRM_TIMEOUT_MS=3500;
let promptEvent=null,prompting=false,buttonObserver=null,refreshQueued=false,relatedApps=[];

function standalone(){return navigator.standalone===true||['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches)}
function launchSession(){try{return sessionStorage.getItem(LAUNCH_SESSION_KEY)==='1'}catch{return false}}
function appRuntime(){return standalone()||launchSession()}
function readInstalledMarker(){try{const value=JSON.parse(localStorage.getItem(INSTALL_MARKER_KEY)||'null');return Boolean(value&&value.origin===location.origin&&value.manifestId==='/civweave-local')}catch{return false}}
function postDownloadReloadArmed(){try{return sessionStorage.getItem(POST_DOWNLOAD_RELOAD_KEY)===VERSION}catch{return false}}
function armPostDownloadReload(){try{sessionStorage.setItem(POST_DOWNLOAD_RELOAD_KEY,VERSION);return true}catch{return false}}
function clearPostDownloadReload(){try{sessionStorage.removeItem(POST_DOWNLOAD_RELOAD_KEY)}catch{}return true}
function installabilityReloadArmed(){try{return sessionStorage.getItem(INSTALLABILITY_RELOAD_KEY)===VERSION}catch{return false}}
function armInstallabilityReload(){try{sessionStorage.setItem(INSTALLABILITY_RELOAD_KEY,VERSION);return true}catch{return false}}
function clearInstallabilityReload(){try{sessionStorage.removeItem(INSTALLABILITY_RELOAD_KEY)}catch{}return true}
let installed=false,installedHint=readInstalledMarker();
if(installedHint)document.documentElement.dataset.civweaveInstalledMarker='hint';
function rememberInstalled(source='appinstalled'){
  try{localStorage.setItem(INSTALL_MARKER_KEY,JSON.stringify({origin:location.origin,manifestId:'/civweave-local',source,installedAt:new Date().toISOString()}));localStorage.removeItem(RETIRED_CAPABILITY_KEY)}catch{}
  installed=true;installedHint=true;document.documentElement.dataset.civweaveInstalledMarker='confirmed';clearPostDownloadReload();clearInstallabilityReload();return true;
}
function forgetInstalledMarker(){
  try{localStorage.removeItem(INSTALL_MARKER_KEY);localStorage.removeItem(RETIRED_CAPABILITY_KEY)}catch{}
  installedHint=false;document.documentElement.dataset.civweaveInstalledMarker='absent';return true;
}

function localDevelopment(){return ['localhost','127.0.0.1','::1'].includes(location.hostname)}
function cloudflarePreview(){return location.hostname.endsWith('.pages.dev')&&location.hostname.split('.').length>3}
function productionPagesOrigin(){return location.hostname.endsWith('.pages.dev')&&location.hostname.split('.').length===3}
function previousCanonical(){return location.origin===PREVIOUS_CANONICAL_ORIGIN}
function previewParentOrigin(){if(!cloudflarePreview())return null;const parent=`https://${location.hostname.split('.').slice(1).join('.')}`;return parent===LEGACY_CANONICAL_ORIGIN||parent===PREVIOUS_CANONICAL_ORIGIN?CANONICAL_ORIGIN:parent}
function hostSetupRedirect(){const current=new URL(location.href);if(current.searchParams.get('host_setup')!=='1'||current.pathname===HOST_SETUP_PATH)return false;const target=new URL(HOST_SETUP_PATH,current.origin);for(const [key,value] of current.searchParams)target.searchParams.append(key,value);target.hash=current.hash;location.replace(target.href);return true}
function installOrigin(){return localDevelopment()||(productionPagesOrigin()&&!previousCanonical())||(!location.hostname.endsWith('.pages.dev')&&![HOST_NODE_ORIGIN,LEGACY_CANONICAL_ORIGIN,PREVIOUS_CANONICAL_ORIGIN].includes(location.origin))}
function stableInstallerUrl(){const destination=previewParentOrigin()||CANONICAL_ORIGIN;const target=new URL('/app/index.html',destination),current=new URL(location.href);for(const [key,value] of current.searchParams)if(key!=='install_origin')target.searchParams.append(key,value);if(location.origin===HOST_NODE_ORIGIN&&!target.searchParams.has('host'))target.searchParams.set('host',HOST_NODE_ORIGIN);target.searchParams.set('install_origin',cloudflarePreview()?'host-production':'canonical');target.hash=current.hash;return target}
function rerouteUnsafeInstall(){if(appRuntime()||localDevelopment())return false;if(![HOST_NODE_ORIGIN,LEGACY_CANONICAL_ORIGIN,PREVIOUS_CANONICAL_ORIGIN].includes(location.origin)&&!cloudflarePreview())return false;location.replace(stableInstallerUrl().href);return true}
function help(message){const node=document.querySelector('#install-help');if(node&&node.textContent!==message)node.textContent=message}
function installButton(){return document.querySelector('#install-app')}
function installer(){return globalThis.CivweaveInstallerV130||null}
function setButton(button,{disabled,text}={}){if(!button)return;if(typeof disabled==='boolean'&&button.disabled!==disabled)button.disabled=disabled;if(typeof text==='string'&&button.textContent!==text)button.textContent=text}
function queueRefresh(){if(refreshQueued)return;refreshQueued=true;queueMicrotask(()=>{refreshQueued=false;refreshButton()})}
function publish(type,detail={}){try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,standalone:standalone(),launchSession:launchSession(),installed,installedHint,canonicalOrigin:CANONICAL_ORIGIN,installOrigin:location.origin,...detail}}))}catch{}}
function workerPath(worker){try{return new URL(worker?.scriptURL||'',location.href).pathname}catch{return ''}}
function waitForController(timeoutMs=1800){
  if(navigator.serviceWorker?.controller)return Promise.resolve(navigator.serviceWorker.controller);
  return new Promise(resolve=>{
    let settled=false;
    const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);navigator.serviceWorker?.removeEventListener?.('controllerchange',onChange);resolve(value||null)};
    const onChange=()=>finish(navigator.serviceWorker?.controller||null);
    const timer=setTimeout(()=>finish(navigator.serviceWorker?.controller||null),timeoutMs);
    navigator.serviceWorker?.addEventListener?.('controllerchange',onChange,{once:true});
  });
}
async function ensureInstallabilityBootstrap(){
  if(appRuntime()||!installOrigin()||!('serviceWorker' in navigator))return false;
  try{
    const existing=await navigator.serviceWorker.getRegistration('/');
    const existingWorker=existing?.active||existing?.waiting||existing?.installing||null;
    if(existingWorker){
      publish('civweave:pwa-installability-bootstrap',{ready:Boolean(existing?.active),worker:workerPath(existingWorker),reused:true});
      if(existing?.active)clearInstallabilityReload();
      return Boolean(existing?.active);
    }
    publish('civweave:pwa-installability-bootstrap',{ready:false,worker:'/pwa-installability-worker-v1.js',reused:false});
    await navigator.serviceWorker.register(INSTALLABILITY_WORKER_URL,{scope:'/',updateViaCache:'none'});
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise(resolve=>setTimeout(resolve,5000))
    ]);
    const controller=await waitForController();
    const registration=await navigator.serviceWorker.getRegistration('/');
    const active=registration?.active||null;
    publish('civweave:pwa-installability-bootstrap',{ready:Boolean(active),controlled:Boolean(controller),worker:workerPath(active),reused:false});
    if(active&&!controller&&!installabilityReloadArmed()){
      armInstallabilityReload();
      const next=new URL(location.href);
      next.searchParams.set('installability_ready',Date.now().toString(36));
      location.replace(next.href);
      return true;
    }
    if(controller)clearInstallabilityReload();
    return Boolean(active);
  }catch(error){
    publish('civweave:pwa-installability-bootstrap-error',{message:error?.message||String(error)});
    return false;
  }
}
async function discoverRelatedInstalls(){
  if(typeof navigator.getInstalledRelatedApps!=='function')return[];
  try{relatedApps=await navigator.getInstalledRelatedApps()||[]}catch{relatedApps=[]}
  const urls=new Set(relatedApps.map(app=>String(app?.url||''))),currentManifest=`${location.origin}/app/manifest.webmanifest`,currentInstalled=urls.has(currentManifest);
  if(currentInstalled)rememberInstalled('getInstalledRelatedApps');
  else if(installedHint)forgetInstalledMarker();
  for(const [index,url] of MANIFESTS.entries())document.documentElement.dataset[`civweaveRelatedInstall${index}`]=urls.has(url)?'installed':'absent';
  publish('civweave:related-install-state',{currentInstalled,relatedApps:[...relatedApps]});queueRefresh();return [...relatedApps]
}
function refreshButton(){
  const button=installButton();if(!button||/reset app shell|repair shell/i.test(button.textContent||''))return;
  if(!installOrigin()&&!appRuntime()){setButton(button,{disabled:false,text:'Open stable Civweave installer'});help('This address is not a stable Civweave install origin. Opening its production host instead.');return}
  if(appRuntime()){setButton(button,{disabled:false,text:'Open Civweave'});help('This is an installed Civweave app window. Open the campus from this doorway.');return}
  if(installed){setButton(button,{disabled:true,text:'Civweave installed'});help('Civweave is installed. Open it from your device app launcher; browser-tab runtime stays disabled.');return}
  if(prompting)return;
  const shell=installer();
  if(!shell?.shellReady){
    setButton(button,{disabled:false,text:'Download Civweave'});
    if(promptEvent)help('Desktop installation is available. Download the small Civweave app files first; then this button changes to Install Civweave.');
    else help('Download the small Civweave app files first. When the download is ready, this button changes to Install Civweave. Offline campus, media, knowledge packs, and local models stay separate.');
    return;
  }
  setButton(button,{disabled:false,text:'Install Civweave'});
  if(promptEvent){help('Civweave is downloaded and ready for the browser-native app install. Tap Install Civweave.');return}
  if(installedHint){help('Civweave was installed from this browser before, but that old marker is not proof it is still installed. Tap Install Civweave to verify or reinstall it.');return}
  help('Civweave is downloaded. Install it with this button when the native prompt is available, or use the browser Install app command.');
}
function observeButton(){const button=installButton();if(!button)return;buttonObserver?.disconnect();buttonObserver=new MutationObserver(queueRefresh);buttonObserver.observe(button,{attributes:true,attributeFilter:['disabled'],childList:true});refreshButton()}
function capture(event){event.preventDefault();if(!installOrigin()){rerouteUnsafeInstall();return}promptEvent=event;clearInstallabilityReload();publish('civweave:pwa-install-prompt-ready',{available:true});queueRefresh()}
async function completeShellAfterBrowserInstall(){
  const shell=installer();
  if(!shell?.prepareShell||shell.shellReady)return true;
  publish('civweave:pwa-post-install-shell',{started:true});
  try{
    await shell.prepareShell({manual:false});
    publish('civweave:pwa-post-install-shell',{started:false,ready:Boolean(shell.shellReady)});
    return Boolean(shell.shellReady);
  }catch(error){
    publish('civweave:pwa-post-install-shell-error',{message:error?.message||String(error)});
    return false;
  }
}
function onInstalled(){rememberInstalled('appinstalled');promptEvent=null;prompting=false;publish('civweave:pwa-installed',{available:false});queueRefresh();void discoverRelatedInstalls();void completeShellAfterBrowserInstall()}
function waitForPrompt(timeoutMs=PROMPT_WAIT_MS){if(promptEvent)return Promise.resolve(promptEvent);return new Promise(resolve=>{let settled=false;const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);removeEventListener('beforeinstallprompt',onPrompt);resolve(value||null)},onPrompt=event=>{if(!promptEvent)promptEvent=event;finish(promptEvent||event)},timer=setTimeout(()=>finish(promptEvent),timeoutMs);addEventListener('beforeinstallprompt',onPrompt)})}
async function prepareAfterInteraction(shell,button){
  prompting=true;
  let reloading=false;
  setButton(button,{disabled:true,text:'Downloading Civweave…'});
  help('Downloading the small Civweave app files. The offline campus, media, knowledge packs, and local models are not part of this download.');
  publish('civweave:pwa-installability-preparing',{eager:false,userInitiated:true});
  try{
    await shell.prepareShell({manual:false});
    const ready=Boolean(shell.shellReady);
    publish('civweave:pwa-installability-ready',{ready,userInitiated:true});
    if(ready&&!promptEvent&&!appRuntime()&&!postDownloadReloadArmed()){
      armPostDownloadReload();
      reloading=true;
      setButton(button,{disabled:true,text:'Download complete · preparing install…'});
      help('Civweave is downloaded. Refreshing the installer once so Chromium can expose the native Install app prompt.');
      const next=new URL(location.href);
      next.searchParams.set('install_ready',Date.now().toString(36));
      location.replace(next.href);
      return;
    }
  }catch(error){
    clearPostDownloadReload();
    publish('civweave:pwa-installability-error',{message:error?.message||String(error),userInitiated:true});
  }finally{
    if(!reloading){prompting=false;setButton(button,{disabled:false});queueRefresh()}
  }
}
async function resumeAfterDownloadReload(){
  const current=new URL(location.href);
  if(!current.searchParams.has('install_ready')||!postDownloadReloadArmed()||appRuntime()||!installOrigin())return false;
  const shell=installer(),button=installButton();
  if(!shell?.prepareShell||!button)return false;
  prompting=true;
  setButton(button,{disabled:true,text:'Preparing Install Civweave…'});
  help('Download complete. Verifying the already-downloaded shell after refresh so the browser can expose Install Civweave.');
  publish('civweave:pwa-post-download-resume',{started:true});
  try{
    await shell.prepareShell({manual:false});
    const ready=Boolean(shell.shellReady);
    if(ready)clearPostDownloadReload();
    publish('civweave:pwa-post-download-resume',{started:false,ready});
    return ready;
  }catch(error){
    clearPostDownloadReload();
    publish('civweave:pwa-installability-error',{message:error?.message||String(error),postDownloadResume:true});
    return false;
  }finally{
    prompting=false;
    setButton(button,{disabled:false});
    queueRefresh();
  }
}
async function verifyAcceptedInstall(button){
  await new Promise(resolve=>setTimeout(resolve,INSTALL_CONFIRM_TIMEOUT_MS));
  if(installed||appRuntime())return true;
  await discoverRelatedInstalls();
  if(installed||appRuntime())return true;
  setButton(button,{disabled:false,text:'Reload to verify install'});
  help('The browser accepted the install request but did not confirm that Civweave was installed. Check your app launcher. If Civweave is not there, reload this installer and install again.');
  publish('civweave:pwa-install-confirmation-missing',{accepted:true});
  return false;
}
async function ownInstallClick(event){
  const button=event.target?.closest?.('#install-app');if(!button||button.disabled||prompting)return;if(/reset app shell|repair shell/i.test(button.textContent||''))return;
  if(/^reload to (?:verify|install)/i.test(button.textContent||'')){event.preventDefault();event.stopImmediatePropagation();location.reload();return}
  if(!installOrigin()&&!appRuntime()){event.preventDefault();event.stopImmediatePropagation();location.assign(stableInstallerUrl().href);return}
  if(appRuntime()){event.preventDefault();event.stopImmediatePropagation();location.assign(ENTRY);return}
  if(installed){event.preventDefault();event.stopImmediatePropagation();help('Civweave is installed. Launch it from your device app launcher; this browser tab remains the installer.');return}
  const shell=installer();event.preventDefault();event.stopImmediatePropagation();if(!shell?.prepareShell){help('The Civweave download controller is still loading. Wait a moment, then tap Download Civweave again.');return}if(!shell.shellReady){void prepareAfterInteraction(shell,button);return}
  const prompt=promptEvent;if(!prompt){await discoverRelatedInstalls();if(installed){queueRefresh();return}setButton(button,{disabled:false,text:'Install Civweave'});help('Civweave is downloaded, but Chromium has not exposed its native install prompt yet. Wait a moment and tap Install again, or use the browser Install app command.');return}
  promptEvent=null;prompting=true;setButton(button,{disabled:true,text:'Opening app install…'});try{
    prompt.prompt();
    const choice=await prompt.userChoice.catch(()=>null);
    if(choice?.outcome==='accepted'){
      help('Civweave accepted the install request. Waiting for the browser to confirm installation…');
      setButton(button,{disabled:true,text:'Finishing installation…'});
      publish('civweave:pwa-install-accepted',{confirmed:false});
      setTimeout(()=>void verifyAcceptedInstall(button),0);
    }else{
      help('Civweave app installation was dismissed. Reload this installer when you want the native install prompt again.');
      setButton(button,{disabled:false,text:'Reload to install'});
    }
  }catch(error){
    help(`Civweave could not open the native install prompt: ${error?.message||error}. Reload the installer and retry.`);
    setButton(button,{disabled:false,text:'Retry install'});
  }finally{prompting=false}
}

if(hostSetupRedirect())return;if(rerouteUnsafeInstall())return;
addEventListener('beforeinstallprompt',capture);addEventListener('appinstalled',onInstalled);document.addEventListener('click',ownInstallClick,true);
const startInstaller=()=>{observeButton();void resumeAfterDownloadReload();void ensureInstallabilityBootstrap()};
if(document.readyState==='loading')addEventListener('DOMContentLoaded',startInstaller,{once:true});else startInstaller();
addEventListener('pagehide',()=>buttonObserver?.disconnect(),{once:true});
const reminder=document.createElement('script');reminder.src='/app/host-steward-reminder-v1.js?v=1';reminder.async=true;document.head.append(reminder);
const api=Object.freeze({version:VERSION,canonicalOrigin:CANONICAL_ORIGIN,stagingOrigin:STAGING_ORIGIN,previousCanonicalOrigin:PREVIOUS_CANONICAL_ORIGIN,legacyCanonicalOrigin:LEGACY_CANONICAL_ORIGIN,hostNodeOrigin:HOST_NODE_ORIGIN,installMarkerKey:INSTALL_MARKER_KEY,launchSessionKey:LAUNCH_SESSION_KEY,installedMarker:readInstalledMarker,launchSession,appRuntime,rememberInstalled,forgetInstalledMarker,installOrigin,canonicalInstallOrigin:installOrigin,canonicalInstallerUrl:()=>stableInstallerUrl().href,stableInstallerUrl:()=>stableInstallerUrl().href,discoverRelatedInstalls,relatedInstalls:()=>[...relatedApps],available:()=>Boolean(promptEvent),peek:()=>promptEvent,consume(){const value=promptEvent;promptEvent=null;return value},restore(event){if(event)promptEvent=event;return Boolean(promptEvent)},standalone,refresh:refreshButton,waitForPrompt,browserRuntimePolicy:'installed-display-or-pwa-launch-session-only',installStatePolicy:'confirmed-install-only-marker-is-hint',installSequencingPolicy:'download-on-first-interaction-then-install-on-fresh-gesture',promptAvailabilityPolicy:'capture-beforeinstallprompt-then-prompt-synchronously-on-fresh-click',installabilityBootstrapPolicy:'tiny-navigation-pass-through-worker-no-shell-cache',postDownloadInstallabilityPolicy:'single-user-initiated-refresh-then-shell-rehydrate',observerPolicy:'idempotent-writes-coalesced-refresh',eagerInstallabilityBootstrap:true,eagerRelatedAppDiscovery:false,eagerShellPreparation:false,firstPaintShellWork:false,cacheDistinctPath:true,firstInputSafe:true,state:()=>({available:Boolean(promptEvent),installed,installedHint,prompting,standalone:standalone(),launchSession:launchSession(),controller:workerPath(navigator.serviceWorker?.controller),canonicalOrigin:CANONICAL_ORIGIN,installOrigin:location.origin,relatedApps:[...relatedApps]})});
globalThis.CivweavePWAInstallV250=api;globalThis.CivweavePWAInstallV249=api;globalThis.CivweavePWAInstallV248=api;globalThis.CivweavePWAInstallV247=api;globalThis.CivweavePWAInstallV246=api;publish('civweave:pwa-install-bridge-ready',{available:Boolean(promptEvent)});
})();
