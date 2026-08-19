(()=>{
'use strict';

const VERSION='pwa-install-prompt-v250-v10-no-reload-background-io';
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
const INSTALLABILITY_WORKER_URL='/pwa-installability-worker-v1.js?v=desktop-installability-v1';
const INSTALLABILITY_WORKER_PATH='/pwa-installability-worker-v1.js';
const SHELL_WORKER_PATH='/service-worker-v203.js';
const SHELL_WORKER_URL='/service-worker-v203.js?v=1.0.163-lightweight-shell-v208&revision=release-coherence-v226';
const CAMPUS_OPT_IN_KEY='civweave.offline-campus.explicit-opt-in.v304';
const NATIVE_PROMPT_WATCHDOG_MS=12000;
const CAMPUS_PROGRESS_WATCHDOG_MS=20000;
let promptEvent=null;
let prompting=false;
let installed=false;
let installedHint=readInstalledMarker();
let bootstrapTask=null;
let shellUpgradeTask=null;
let campusBusy=false;
let campusGeneration=0;
let nativePromptGeneration=0;
let relatedApps=[];
let buttonObserver=null;
let refreshQueued=false;

function standalone(){return navigator.standalone===true||['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches)}
function launchSession(){try{return sessionStorage.getItem(LAUNCH_SESSION_KEY)==='1'}catch{return false}}
function appRuntime(){return standalone()||launchSession()}
function readInstalledMarker(){try{const value=JSON.parse(localStorage.getItem(INSTALL_MARKER_KEY)||'null');return Boolean(value&&value.origin===location.origin&&value.manifestId==='/civweave-local')}catch{return false}}
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
function loadProgressiveDisclosure(){if(globalThis.CivweaveProgressiveDisclosureV1||document.querySelector('script[data-cw-progressive-disclosure-v1]'))return true;const script=document.createElement('script');script.src='/app/usability-progressive-disclosure-v1.js?v=1.0.0';script.async=true;script.dataset.cwProgressiveDisclosureV1='';document.head.append(script);return true}
function installButton(){return document.querySelector('#install-app')}
function campusButton(){return document.querySelector('#download-offline-package')}
function setButton(button,{disabled,text,busy}={}){if(!button)return;if(typeof disabled==='boolean')button.disabled=disabled;if(typeof text==='string'&&button.textContent!==text)button.textContent=text;if(typeof busy==='boolean'){if(busy)button.setAttribute('aria-busy','true');else button.removeAttribute('aria-busy')}}
function publish(type,detail={}){try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,standalone:standalone(),installed,installedHint,installOrigin:location.origin,...detail}}))}catch{}}
function queueRefresh(){if(refreshQueued)return;refreshQueued=true;queueMicrotask(()=>{refreshQueued=false;refreshButton()})}
function workerPath(worker){try{return new URL(worker?.scriptURL||'',location.href).pathname}catch{return ''}}
function shellWorkerFromRegistration(registration){for(const worker of [registration?.active,registration?.waiting,registration?.installing])if(workerPath(worker)===SHELL_WORKER_PATH)return worker;return null}
function activeShellWorker(registration){return workerPath(registration?.active)===SHELL_WORKER_PATH?registration.active:null}

async function ensureInstallabilityBootstrap(){
  if(appRuntime()||!installOrigin()||!('serviceWorker' in navigator))return false;
  try{
    const existing=await navigator.serviceWorker.getRegistration('/');
    const active=existing?.active||null,activePath=workerPath(active);
    if(activePath===SHELL_WORKER_PATH){publish('civweave:pwa-installability-bootstrap',{ready:true,worker:activePath,reused:true,validatedCurrentShell:true});return true}
    if(activePath===INSTALLABILITY_WORKER_PATH){publish('civweave:pwa-installability-bootstrap',{ready:true,worker:activePath,reused:true,validatedInstallabilityWorker:true});return true}
    if(existing?.active){publish('civweave:pwa-installability-bootstrap',{ready:false,worker:activePath,reused:true,retiredRootWorker:true});return false}
    await navigator.serviceWorker.register(INSTALLABILITY_WORKER_URL,{scope:'/',updateViaCache:'none'});
    publish('civweave:pwa-installability-bootstrap',{ready:true,worker:INSTALLABILITY_WORKER_PATH,reused:false,noReload:true});
    return true;
  }catch(error){publish('civweave:pwa-installability-bootstrap-error',{message:error?.message||String(error)});return false}
}
function startInstallabilityBootstrap(){if(bootstrapTask)return bootstrapTask;bootstrapTask=ensureInstallabilityBootstrap().finally(()=>{bootstrapTask=null});return bootstrapTask}

// Compatibility hook retained for pre-live metadata generation. The bootstrap is
// intentionally NOT unregistered in-page anymore: replacing a root worker while
// the installer was still controlled by it caused Android navigation/registration
// stalls and forced scroll-reset reloads.
async function retireInstallabilityBootstrap(){return false}

function shellHandoffPending(){return false}
function resumeShellHandoff(){return false}
function restoreHandoffScroll(){return false}

function scheduleShellUpgrade(reason='background'){
  if(shellUpgradeTask||!('serviceWorker' in navigator))return shellUpgradeTask||Promise.resolve(null);
  shellUpgradeTask=new Promise(resolve=>setTimeout(resolve,0)).then(async()=>{
    try{
      const registration=await navigator.serviceWorker.register(SHELL_WORKER_URL,{scope:'/',updateViaCache:'none'});
      const nudge=()=>{try{registration.waiting?.postMessage?.({type:'SKIP_WAITING'});if(registration.installing?.state==='installed')registration.installing.postMessage?.({type:'SKIP_WAITING'})}catch{}};
      nudge();
      registration.addEventListener?.('updatefound',()=>{
        const worker=registration.installing;
        worker?.addEventListener?.('statechange',()=>{nudge();if(worker.state==='activated')publish('civweave:pwa-shell-upgrade-ready',{reason,worker:SHELL_WORKER_PATH})});
      });
      publish('civweave:pwa-shell-upgrade-started',{reason,worker:SHELL_WORKER_PATH,nonBlocking:true});
      return registration;
    }catch(error){publish('civweave:pwa-shell-upgrade-error',{reason,message:error?.message||String(error)});return null}
  }).finally(()=>{shellUpgradeTask=null});
  return shellUpgradeTask;
}

async function waitForActiveShell(timeoutMs=16000){
  const started=Date.now();
  while(Date.now()-started<timeoutMs){
    const registration=await navigator.serviceWorker.getRegistration('/').catch(()=>null);
    const active=activeShellWorker(registration);if(active)return active;
    const candidate=shellWorkerFromRegistration(registration);try{if(candidate?.state==='installed'||registration?.waiting===candidate)candidate.postMessage?.({type:'SKIP_WAITING'})}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  return null;
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
  if(!installOrigin()&&!appRuntime()){setButton(button,{disabled:false,text:'Open stable Civweave installer',busy:false});return}
  if(appRuntime()){setButton(button,{disabled:false,text:'Open Civweave',busy:false});return}
  if(installed){setButton(button,{disabled:false,text:'Open Civweave',busy:false});return}
  setButton(button,{disabled:false,text:'Install Civweave',busy:prompting});
  if(promptEvent)help('Civweave is ready to install. The app shell finishes in the background after the browser accepts installation.');
  else if(!prompting)help('Install remains available without a page reload. If Chrome has not offered its native prompt yet, use the browser Install app command.');
}
function observeButton(){const button=installButton();if(!button)return;buttonObserver?.disconnect();buttonObserver=new MutationObserver(queueRefresh);buttonObserver.observe(button,{attributes:true,attributeFilter:['disabled','aria-busy'],childList:true});refreshButton()}

function capture(event){
  if(!installOrigin()){rerouteUnsafeInstall();return}
  event.preventDefault();event.stopImmediatePropagation();promptEvent=event;
  publish('civweave:pwa-install-prompt-ready',{available:true,singleOwner:true,noReload:true});queueRefresh();
}

function settleNativePrompt(generation,button,result){
  if(generation!==nativePromptGeneration)return false;
  prompting=false;setButton(button,{disabled:false,busy:false});
  const outcome=result?.outcome||'unknown';publish('civweave:pwa-install-prompt-settled',{outcome});
  if(outcome==='accepted'){
    rememberInstalled('beforeinstallprompt-accepted');
    help('Installation accepted. Civweave is preparing its lightweight shell in the background; this page stays usable.');
    void scheduleShellUpgrade('install-accepted');void discoverRelatedInstalls();queueRefresh();return true;
  }
  if(outcome==='dismissed')help('Installation was dismissed. Chrome may offer the prompt again after a later visit; the page remains usable.');
  else if(outcome==='timeout')help('Chrome did not return an install result. Nothing is blocked; use the browser Install app command if the native sheet did not appear.');
  else help(`Chrome could not finish the native install request${result?.error?.message?`: ${result.error.message}`:''}. The page remains usable.`);
  queueRefresh();return false;
}

function openNativeInstallPrompt(prompt,button){
  const generation=++nativePromptGeneration;prompting=true;setButton(button,{disabled:false,text:'Opening app install…',busy:true});
  const watchdog=setTimeout(()=>settleNativePrompt(generation,button,{outcome:'timeout'}),NATIVE_PROMPT_WATCHDOG_MS);
  try{
    prompt.prompt();
    Promise.resolve(prompt.userChoice).then(choice=>{clearTimeout(watchdog);settleNativePrompt(generation,button,choice||{outcome:'unknown'})},error=>{clearTimeout(watchdog);settleNativePrompt(generation,button,{outcome:'error',error})});
    return true;
  }catch(error){clearTimeout(watchdog);settleNativePrompt(generation,button,{outcome:'error',error});return false}
}

function ownInstallClick(event){
  const button=event.target?.closest?.('#install-app');if(!button)return;if(/reset app shell|repair shell/i.test(button.textContent||''))return;
  event.preventDefault();event.stopImmediatePropagation();
  if(!installOrigin()&&!appRuntime()){location.assign(stableInstallerUrl().href);return}
  if(appRuntime()||installed){location.assign(ENTRY);return}
  if(prompting){help('Chrome is already handling the install request; the rest of the page remains usable.');return}
  const prompt=promptEvent;
  if(prompt){promptEvent=null;openNativeInstallPrompt(prompt,button);return}
  void startInstallabilityBootstrap();
  help('Chrome has not exposed its native install event on this visit. Use the browser Install app command; no shell download or reload is required first.');
}

function renderCampus(packet={}){
  const button=campusButton();
  const state=document.querySelector('#offline-package-state');
  const assets=document.querySelector('#offline-package-assets');
  const fill=document.querySelector('#offline-campus-progress-fill');
  const percentNode=document.querySelector('#offline-campus-progress-percent');
  const track=document.querySelector('#offline-campus-progress-track');
  const total=Math.max(0,Number(packet.total||packet.discovered||0)||0);
  const complete=Math.max(0,Number(packet.downloaded??packet.completed??0)||0);
  const failed=Math.max(0,Number(packet.failedCount||packet.failed?.length||0)||0);
  const ready=Boolean(packet.ready)&&failed===0;
  const running=Boolean(packet.running)||campusBusy;
  const percent=ready?100:total?Math.max(0,Math.min(100,Math.round(complete*100/total))):running?1:0;
  if(state)state.textContent=ready?'ready offline':running?'downloading':packet.paused?'paused':failed?`${failed} file${failed===1?'':'s'} need retry`:complete?'partially downloaded':'not downloaded';
  if(assets)assets.textContent=total?`${Math.min(complete,total)}/${total} files`:running?'discovering files':'not started';
  if(fill)fill.style.width=`${percent}%`;
  if(percentNode)percentNode.textContent=`${percent}%`;
  if(track)track.setAttribute('aria-valuenow',String(percent));
  if(button){button.disabled=false;button.textContent=ready?'Refresh offline campus':running?'Campus downloading in background…':complete?'Resume offline campus':'Download offline campus';button.setAttribute('aria-busy',running?'true':'false')}
}

function startCampusOnWorker(worker,generation){
  if(!worker||generation!==campusGeneration)return false;
  const channel=new MessageChannel();
  let watchdog=0;
  const arm=()=>{clearTimeout(watchdog);watchdog=setTimeout(()=>{
    if(generation!==campusGeneration)return;
    campusBusy=false;try{channel.port1.close()}catch{};renderCampus({running:false});help('The campus worker stopped reporting progress. The page is still responsive; tap Download offline campus to resume.');
  },CAMPUS_PROGRESS_WATCHDOG_MS)};
  channel.port1.onmessage=event=>{
    const packet=event.data||{};arm();renderCampus(packet);
    if(packet.type==='CIVWEAVE_OFFLINE_PACKAGE_STATUS'&&!packet.running){clearTimeout(watchdog);campusBusy=false;try{channel.port1.close()}catch{};renderCampus(packet);help(packet.ready?'Offline campus is ready.':'Campus download paused or stopped; saved files are preserved and can be resumed.')}
  };
  try{worker.postMessage({type:'DOWNLOAD_OFFLINE_PACKAGE',background:true,reason:'installer-explicit-opt-in',revision:VERSION},[channel.port2]);arm();return true}catch(error){clearTimeout(watchdog);campusBusy=false;renderCampus({running:false});help(`Campus download could not start: ${error?.message||error}`);return false}
}

function ownCampusClick(event){
  const button=event.target?.closest?.('#download-offline-package');if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(campusBusy){help('The campus download is already running in the background; the rest of this page remains usable.');return}
  try{localStorage.setItem(CAMPUS_OPT_IN_KEY,'1')}catch{}
  campusBusy=true;const generation=++campusGeneration;renderCampus({running:true});help('Starting the offline campus in a low-pressure background lane. You can keep using this page while it downloads.');
  void (async()=>{
    let registration=await navigator.serviceWorker?.getRegistration?.('/').catch(()=>null);
    let worker=activeShellWorker(registration);
    if(!worker){await scheduleShellUpgrade('campus-download');worker=await waitForActiveShell()}
    if(generation!==campusGeneration)return;
    if(!worker){campusBusy=false;renderCampus({running:false});help('The lightweight app worker did not become ready. Nothing is frozen; tap Download offline campus to retry.');return}
    startCampusOnWorker(worker,generation);
  })();
}

function onWorkerMessage(event){const packet=event.data||{};if(packet.type==='CIVWEAVE_OFFLINE_PACKAGE_STATUS'||packet.type==='CIVWEAVE_OFFLINE_PACKAGE_PROGRESS')renderCampus(packet)}
function onInstalled(){nativePromptGeneration+=1;rememberInstalled('appinstalled');promptEvent=null;prompting=false;publish('civweave:pwa-installed',{available:false});queueRefresh();void scheduleShellUpgrade('appinstalled');void discoverRelatedInstalls()}

if(hostSetupRedirect())return;if(rerouteUnsafeInstall())return;
addEventListener('beforeinstallprompt',capture,{capture:true});
addEventListener('appinstalled',onInstalled);
document.addEventListener('click',event=>{if(event.target?.closest?.('#install-app'))ownInstallClick(event);else if(event.target?.closest?.('#download-offline-package'))ownCampusClick(event)},true);
navigator.serviceWorker?.addEventListener?.('message',onWorkerMessage);
const startInstaller=()=>{loadProgressiveDisclosure();observeButton();renderCampus({running:false});void startInstallabilityBootstrap()};
if(document.readyState==='loading')addEventListener('DOMContentLoaded',startInstaller,{once:true});else startInstaller();
addEventListener('pagehide',()=>buttonObserver?.disconnect(),{once:true});

const api=Object.freeze({
  version:VERSION,canonicalOrigin:CANONICAL_ORIGIN,stagingOrigin:STAGING_ORIGIN,previousCanonicalOrigin:PREVIOUS_CANONICAL_ORIGIN,legacyCanonicalOrigin:LEGACY_CANONICAL_ORIGIN,hostNodeOrigin:HOST_NODE_ORIGIN,
  installMarkerKey:INSTALL_MARKER_KEY,launchSessionKey:LAUNCH_SESSION_KEY,installedMarker:readInstalledMarker,launchSession,appRuntime,rememberInstalled,forgetInstalledMarker,installOrigin,canonicalInstallOrigin:installOrigin,
  canonicalInstallerUrl:()=>stableInstallerUrl().href,stableInstallerUrl:()=>stableInstallerUrl().href,discoverRelatedInstalls,relatedInstalls:()=>[...relatedApps],available:()=>Boolean(promptEvent),peek:()=>promptEvent,
  consume(){const value=promptEvent;promptEvent=null;return value},restore(event){if(event)promptEvent=event;return Boolean(promptEvent)},standalone,refresh:refreshButton,retireInstallabilityBootstrap,shellHandoffPending,resumeShellHandoff,restoreHandoffScroll,scheduleShellUpgrade,
  browserRuntimePolicy:'installed-display-or-pwa-launch-session-only',installStatePolicy:'confirmed-install-only-marker-is-hint',installSequencingPolicy:'native-install-first-shell-upgrade-background-no-navigation',
  promptAvailabilityPolicy:'capture-beforeinstallprompt-call-prompt-synchronously-observe-user-choice-with-watchdog',singleOwnerPromptPolicy:'capture-stop-immediate-propagation',installabilityBootstrapPolicy:'tiny-network-pass-through-worker-retained-until-background-shell-upgrade',
  eagerInstallabilityBootstrap:true,eagerRelatedAppDiscovery:false,eagerShellPreparation:false,firstPaintShellWork:false,cacheDistinctPath:true,firstInputSafe:true,navigationSafeShellHandoff:true,noInstallerReload:true,nonBlockingNativePrompt:true,nonBlockingCampusDownload:true,
  state:()=>({available:Boolean(promptEvent),installed,installedHint,prompting,campusBusy,standalone:standalone(),controller:workerPath(navigator.serviceWorker?.controller),installOrigin:location.origin,relatedApps:[...relatedApps]})
});
globalThis.CivweavePWAInstallV250=api;globalThis.CivweavePWAInstallV249=api;globalThis.CivweavePWAInstallV248=api;globalThis.CivweavePWAInstallV247=api;globalThis.CivweavePWAInstallV246=api;
publish('civweave:pwa-install-bridge-ready',{available:Boolean(promptEvent),singleOwner:true,noInstallerReload:true,nonBlockingNativePrompt:true,nonBlockingCampusDownload:true});
})();