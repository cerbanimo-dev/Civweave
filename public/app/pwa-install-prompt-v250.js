(()=>{
'use strict';

const VERSION='pwa-install-prompt-v250-launch-session-v1';
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
const PROMPT_WAIT_MS=6000;
let promptEvent=null,prompting=false,buttonObserver=null,refreshQueued=false,relatedApps=[];

function standalone(){return navigator.standalone===true||['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>matchMedia(`(display-mode: ${mode})`).matches)}
function launchSession(){try{return sessionStorage.getItem(LAUNCH_SESSION_KEY)==='1'}catch{return false}}
function appRuntime(){return standalone()||launchSession()}
function readInstalledMarker(){try{const value=JSON.parse(localStorage.getItem(INSTALL_MARKER_KEY)||'null');return Boolean(value&&value.origin===location.origin&&value.manifestId==='/civweave-local')}catch{return false}}
function rememberInstalled(source='appinstalled'){
  try{localStorage.setItem(INSTALL_MARKER_KEY,JSON.stringify({origin:location.origin,manifestId:'/civweave-local',source,installedAt:new Date().toISOString()}));localStorage.removeItem(RETIRED_CAPABILITY_KEY)}catch{}
  installed=true;document.documentElement.dataset.civweaveInstalledMarker='present';return true;
}
let installed=readInstalledMarker();if(installed)document.documentElement.dataset.civweaveInstalledMarker='present';

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
function publish(type,detail={}){try{dispatchEvent(new CustomEvent(type,{detail:{version:VERSION,standalone:standalone(),launchSession:launchSession(),installed,canonicalOrigin:CANONICAL_ORIGIN,installOrigin:location.origin,...detail}}))}catch{}}
async function discoverRelatedInstalls(){if(typeof navigator.getInstalledRelatedApps!=='function')return[];try{relatedApps=await navigator.getInstalledRelatedApps()||[]}catch{relatedApps=[]}const urls=new Set(relatedApps.map(app=>String(app?.url||''))),currentManifest=`${location.origin}/app/manifest.webmanifest`,currentInstalled=urls.has(currentManifest);if(currentInstalled)rememberInstalled('getInstalledRelatedApps');for(const [index,url] of MANIFESTS.entries())document.documentElement.dataset[`civweaveRelatedInstall${index}`]=urls.has(url)?'installed':'absent';publish('civweave:related-install-state',{currentInstalled,relatedApps:[...relatedApps]});queueRefresh();return [...relatedApps]}
function refreshButton(){
  const button=installButton();if(!button||/reset app shell|repair shell/i.test(button.textContent||''))return;
  if(!installOrigin()&&!appRuntime()){setButton(button,{disabled:false,text:'Open stable Civweave installer'});help('This address is not a stable Civweave install origin. Opening its production host instead.');return}
  if(appRuntime()){setButton(button,{disabled:false,text:'Open Civweave'});help('This is an installed Civweave app window. Open the campus from this doorway.');return}
  if(installed){setButton(button,{disabled:true,text:'Civweave installed'});help('Civweave is installed. Open it from your device app launcher; browser-tab runtime stays disabled.');return}
  if(prompting)return;
  const shell=installer();setButton(button,{disabled:false,text:'Install Civweave'});
  if(promptEvent){help('Civweave is ready for a browser-native app install from this host. Tap Install Civweave.');return}
  if(shell?.shellReady){help('The lightweight shell is ready. Chromium has not exposed its native install prompt yet; wait a moment and tap Install again, or use the browser Install app command.');return}
  help('Nothing runs on page load. Your first Install click prepares the small app shell; when it is ready, use a fresh Install click for the browser-native prompt.');
}
function observeButton(){const button=installButton();if(!button)return;buttonObserver?.disconnect();buttonObserver=new MutationObserver(queueRefresh);buttonObserver.observe(button,{attributes:true,attributeFilter:['disabled'],childList:true});refreshButton();if(!installed)void discoverRelatedInstalls()}
function capture(event){event.preventDefault();if(!installOrigin()){rerouteUnsafeInstall();return}promptEvent=event;publish('civweave:pwa-install-prompt-ready',{available:true});queueRefresh()}
function onInstalled(){rememberInstalled('appinstalled');promptEvent=null;prompting=false;publish('civweave:pwa-installed',{available:false});queueRefresh();void discoverRelatedInstalls()}
function waitForPrompt(timeoutMs=PROMPT_WAIT_MS){if(promptEvent)return Promise.resolve(promptEvent);return new Promise(resolve=>{let settled=false;const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);removeEventListener('beforeinstallprompt',onPrompt);resolve(value||null)},onPrompt=event=>{if(!promptEvent)promptEvent=event;finish(promptEvent||event)},timer=setTimeout(()=>finish(promptEvent),timeoutMs);addEventListener('beforeinstallprompt',onPrompt)})}
async function prepareAfterInteraction(shell,button){prompting=true;setButton(button,{disabled:true,text:'Preparing app shell…'});help('Preparing the small app shell because you asked to install. No offline campus, media, knowledge packs, or local models are being downloaded.');publish('civweave:pwa-installability-preparing',{eager:false,userInitiated:true});try{await shell.prepareShell({manual:true});publish('civweave:pwa-installability-ready',{ready:Boolean(shell.shellReady),userInitiated:true})}catch(error){publish('civweave:pwa-installability-error',{message:error?.message||String(error),userInitiated:true})}finally{prompting=false;setButton(button,{disabled:false});queueRefresh()}}
async function ownInstallClick(event){
  const button=event.target?.closest?.('#install-app');if(!button||button.disabled||prompting)return;if(/reset app shell|repair shell/i.test(button.textContent||''))return;
  if(!installOrigin()&&!appRuntime()){event.preventDefault();event.stopImmediatePropagation();location.assign(stableInstallerUrl().href);return}
  if(appRuntime()){event.preventDefault();event.stopImmediatePropagation();location.assign(ENTRY);return}
  if(installed){event.preventDefault();event.stopImmediatePropagation();help('Civweave is installed. Launch it from your device app launcher; this browser tab remains the installer.');return}
  const shell=installer();event.preventDefault();event.stopImmediatePropagation();if(!shell?.prepareShell){help('The lightweight shell controller is still loading. Wait a moment, then tap Install Civweave again.');return}if(!shell.shellReady){void prepareAfterInteraction(shell,button);return}
  const prompt=promptEvent;if(!prompt){await discoverRelatedInstalls();if(installed){queueRefresh();return}setButton(button,{disabled:false,text:'Install Civweave'});help('The app shell is ready, but Chromium has not exposed its native install prompt yet. Wait a moment and tap Install again, or use the browser Install app command.');return}
  promptEvent=null;prompting=true;setButton(button,{disabled:true,text:'Opening app install…'});try{prompt.prompt();const choice=await prompt.userChoice.catch(()=>null);if(choice?.outcome==='accepted'){rememberInstalled('native-install-accepted');help('Civweave installation accepted. Open Civweave from your device app launcher.');setButton(button,{disabled:true,text:'Civweave installed'})}else{help('Civweave app installation was dismissed. Reload this installer when you want the native install prompt again.');setButton(button,{disabled:false,text:'Reload to install'})}}catch(error){help(`Civweave could not open the native install prompt: ${error?.message||error}. Reload the installer and retry.`);setButton(button,{disabled:false,text:'Retry install'})}finally{prompting=false}
}

if(hostSetupRedirect())return;if(rerouteUnsafeInstall())return;
addEventListener('beforeinstallprompt',capture);addEventListener('appinstalled',onInstalled);document.addEventListener('click',ownInstallClick,true);if(document.readyState==='loading')addEventListener('DOMContentLoaded',observeButton,{once:true});else observeButton();addEventListener('pagehide',()=>buttonObserver?.disconnect(),{once:true});
const reminder=document.createElement('script');reminder.src='/app/host-steward-reminder-v1.js?v=1';reminder.async=true;document.head.append(reminder);
const api=Object.freeze({version:VERSION,canonicalOrigin:CANONICAL_ORIGIN,stagingOrigin:STAGING_ORIGIN,previousCanonicalOrigin:PREVIOUS_CANONICAL_ORIGIN,legacyCanonicalOrigin:LEGACY_CANONICAL_ORIGIN,hostNodeOrigin:HOST_NODE_ORIGIN,installMarkerKey:INSTALL_MARKER_KEY,launchSessionKey:LAUNCH_SESSION_KEY,installedMarker:readInstalledMarker,launchSession,appRuntime,rememberInstalled,installOrigin,canonicalInstallOrigin:installOrigin,canonicalInstallerUrl:()=>stableInstallerUrl().href,stableInstallerUrl:()=>stableInstallerUrl().href,discoverRelatedInstalls,relatedInstalls:()=>[...relatedApps],available:()=>Boolean(promptEvent),peek:()=>promptEvent,consume(){const value=promptEvent;promptEvent=null;return value},restore(event){if(event)promptEvent=event;return Boolean(promptEvent)},standalone,refresh:refreshButton,waitForPrompt,browserRuntimePolicy:'installed-display-or-pwa-launch-session-only',installSequencingPolicy:'prepare-on-first-install-interaction-then-prompt-on-fresh-gesture',promptAvailabilityPolicy:'capture-beforeinstallprompt-then-prompt-synchronously-on-fresh-click',observerPolicy:'idempotent-writes-coalesced-refresh',eagerRelatedAppDiscovery:true,eagerShellPreparation:false,firstPaintShellWork:false,cacheDistinctPath:true,firstInputSafe:true,state:()=>({available:Boolean(promptEvent),installed,prompting,standalone:standalone(),launchSession:launchSession(),canonicalOrigin:CANONICAL_ORIGIN,installOrigin:location.origin,relatedApps:[...relatedApps]})});
globalThis.CivweavePWAInstallV250=api;globalThis.CivweavePWAInstallV249=api;globalThis.CivweavePWAInstallV248=api;globalThis.CivweavePWAInstallV247=api;globalThis.CivweavePWAInstallV246=api;publish('civweave:pwa-install-bridge-ready',{available:Boolean(promptEvent)});
})();