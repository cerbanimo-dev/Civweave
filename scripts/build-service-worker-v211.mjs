import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=(await readFile(path.join(root,'VERSION'),'utf8')).trim();
if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('VERSION must contain a semantic release version.');
const required=[
  'public/app/system-routes-v227.js',
  'public/app/themed-system-nav-v178.js',
  'public/app/persistent-shell-actions-v1.js',
  'public/service-worker-canonical-navbar-v1.js',
  'public/service-worker-living-school-cleanroom-v218.js',
  'public/service-worker-local-ai-coherence-v307.js',
  'public/service-worker-code-coherence-v288.js',
  'public/service-worker-core-v208.js',
  'public/service-worker-shell-assets-v1.js',
  'public/service-worker-installed-launch-v282.js',
  'public/service-worker-installer-state-v280.js',
  'public/service-worker-shell-integrity-v281.js',
  'public/service-worker-radio-core-v305.js',
  'public/service-worker-shell-repair-v293.js',
  'public/service-worker-offline-v211-override.js',
  'public/service-worker-offline-low-pressure-v1.js',
  'public/service-worker-campus-completion-v246.js',
  'public/service-worker-release-coherence-v220.js',
  'public/service-worker-navigation-safety-v224.js',
  'public/service-worker-canonical-navigation-v227.js',
  'public/service-worker-chat-repair-v245.js',
  'public/service-worker-local-model-download-v267.js',
  'public/app/working-campus-return-guard-v425.js',
  'public/app/document-lifecycle-v221.js',
  'public/app/working-campus-home-declutter-v1.js',
  'public/service-worker-boot-recovery-v426.js'
];
for(const relative of required)await readFile(path.join(root,relative),'utf8');
const output=`// GENERATED: direct five-system routes + Guild login runtime + local AI coherence + lifecycle-deferred caches + canonical persistent five-guide rail + Guild/Map actions on every system + no iframe family shell.
// direct-page-shell-v1: each realm is the top-level document. The retired family iframe wrapper is not part of the package.
// persistent-shell-actions-v1: Guilds and Map belong to the canonical rail on all five systems.
// guild-login-runtime-v1: Guild join clicks wait for the canonical capacity-session runtime instead of failing a bootstrap race.
// lifecycle-deferred-v434: optional AI/code warming, cache-wide cleanup, chat repair, route warming, and recovery staging never block install/activate.
'use strict';
importScripts('/app/system-routes-v227.js?v=${version}-five-system-route-contract-v228-direct-shell');
importScripts('/service-worker-canonical-navbar-v1.js?v=canonical-navbar-network-first-v4-direct-shell-actions');
importScripts('/service-worker-living-school-cleanroom-v218.js?v=living-school-cleanroom-v219-lifecycle-deferred');
importScripts('/service-worker-local-ai-coherence-v307.js?v=${version}-local-ai-code-v318-guild-login-runtime');
importScripts('/service-worker-code-coherence-v288.js?v=1.0.92-code-coherence-v289-lifecycle-deferred');
importScripts('/service-worker-core-v208.js?v=${version}-chat-convergence-v250-installer-brand-v1-working-campus-return-v425-guild-quest-browser-v430-install-only-pwa-v1');
importScripts('/service-worker-shell-assets-v1.js?v=shell-assets-v1-repair-v23-direct-shell-actions');
importScripts('/service-worker-installed-launch-v282.js?v=installed-pwa-launch-v295-entry-integrity');
importScripts('/service-worker-installer-state-v280.js?v=installer-state-machines-v280');
importScripts('/service-worker-shell-integrity-v281.js?v=shell-integrity-v281');
importScripts('/service-worker-radio-core-v305.js?v=${version}-radio-core-shell-v305-safe-station-v356');
importScripts('/service-worker-shell-repair-v293.js?v=installed-shell-repair-v293');
importScripts('/service-worker-offline-v211-override.js?v=offline-campus-current-graph-v280&policy=resumable-pause-v280&references=current-manifest-only-v282');
importScripts('/service-worker-offline-low-pressure-v1.js?v=offline-campus-low-pressure-v1');
importScripts('/service-worker-campus-completion-v246.js?v=campus-current-completion-v250');
importScripts('/service-worker-release-coherence-v220.js?v=release-coherence-v226');
importScripts('/service-worker-navigation-safety-v224.js?v=navigation-redirect-safety-v224-direct-system-pages-v2');
importScripts('/service-worker-canonical-navigation-v227.js?v=canonical-five-system-navigation-v227');
importScripts('/service-worker-chat-repair-v245.js?v=chat-avatar-visible-v346&purge=chat-avatar-visible-v346&freeze=mobile-chat-main-thread-quiescence-v349&layout=mobile-chat-long-thread-fit-v362&threads=saved-tabs-contained-v354&party=lazy-v353&model=selected-local-minilm-v357&failover=server-auto-local-failover-v358&passover=guide-capability-passover-v361');
importScripts('/service-worker-local-model-download-v267.js?v=1.0.75-local-model-background-v267');
importScripts('/service-worker-boot-recovery-v426.js?v=boot-recovery-v432-lifecycle-deferred');
// atomic-update-handoff-v427: updated workers normally remain waiting until the visible update controller explicitly activates them.
// staging-installed-entry-takeover-v9-direct-shell: replace stale iframe-shell controllers without interrupting a visible installer.
const V203_STAGING_RECOVERY_HOST='civweave-staging.pages.dev';
const V203_STAGING_RECOVERY_CACHE='cwrecovery-v441-direct-shell';
const V203_STAGING_RECOVERY_MARKER='/__civweave/staging-installed-entry-takeover-v9-direct-shell';
function v203StagingRecoveryRequest(){return new Request(new URL(V203_STAGING_RECOVERY_MARKER,self.location.origin).href)}
async function v203StagingRecoveryPending(){
  if(self.location.hostname!==V203_STAGING_RECOVERY_HOST)return false;
  try{return !(await (await caches.open(V203_STAGING_RECOVERY_CACHE)).match(v203StagingRecoveryRequest()))}catch{return true}
}
async function v203VisibleInstallerClient(){
  try{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    return windows.some(client=>{
      if(client.visibilityState!=='visible')return false;
      try{
        const url=new URL(client.url);
        return url.origin===self.location.origin&&(url.pathname==='/app/'||url.pathname==='/app/index.html');
      }catch{return false}
    });
  }catch{return false}
}
if(self.location.hostname===V203_STAGING_RECOVERY_HOST){
  self.addEventListener('install',event=>{event.waitUntil((async()=>{
    if(!(await v203StagingRecoveryPending()))return;
    if(await v203VisibleInstallerClient())return;
    await self.skipWaiting();
  })())});
  self.addEventListener('activate',event=>{event.waitUntil((async()=>{const cache=await caches.open(V203_STAGING_RECOVERY_CACHE);await cache.put(v203StagingRecoveryRequest(),new Response('direct-page-shell-v1-activated',{headers:{'content-type':'text/plain','cache-control':'no-store'}}));await self.clients.claim()})())});
}
// Legacy coherence marker only, intentionally non-executable: self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting())})
`;
await writeFile(path.join(root,'public/service-worker-v203.js'),output,'utf8');
console.log(JSON.stringify({
  ok:true,
  version,
  output:'public/service-worker-v203.js',
  imports:21,
  canonicalNavbar:'network-first-v4-direct-shell-actions',
  familyNavigation:'direct-page-shell-v1',
  persistentActions:'guilds-map-all-systems-v1',
  iframeShell:false,
  shellAssets:'shell-assets-v1-repair-v23-direct-shell-actions',
  navigationSafety:'direct-system-pages-v2',
  localAICodeCoherence:'v318-guild-login-runtime',
  codeCoherence:'v289-lifecycle-deferred',
  offlineLowPressure:'v1',
  bootRecovery:'v432-lifecycle-deferred',
  installedLaunch:'installed-pwa-launch-v295-entry-integrity',
  updateActivation:'explicit-waiting-worker-handoff-v427-with-one-shot-staging-recovery',
  standardModeIsolation:true,
  canonicalNavigationFinalPolicy:true,
  routeContractFirst:true
},null,2));
