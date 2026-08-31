// GENERATED: one persistent five-system shell + shared canonical rail + Guild/Map actions + direct realm content inside the shell.
// persistent-system-shell-v1: the universal navbar is top-level and survives system changes; only the content stage changes.
// persistent-stage-viewport-r1: the iframe stage has explicit dynamic viewport height so intrinsic iframe sizing cannot expose the parent shell as a dark card.
// canonical-home-v1: top-level home navigation enters the persistent shell; embedded home remains the validated v440 campus.
// five-system-pages-v1: top-level realm navigation enters the persistent shell; embedded realm content remains bounded and validated.
// release-generation-boundary-v1: live code/doc assets are network-first, stale executable/page cache entries are purged, and user data/media caches are preserved.
// navigation-runtime-recovery-v3: stale navigation code/pages are purged once on every installed Civweave origin without touching user data.
// direct-shell-retirement-v1: only retired legacy shells are purged; the current persistent-system-shell-v1 is not retired.
// persistent-shell-actions-v1: Guilds and Map belong to the canonical rail across all five systems.
// family-nav-single-owner-r3: themed-system-nav-v178 is mounted once by persistent-system-shell-v1 and is not recreated by realms.
// shell-assets-v25: persistent shell, shared navbar runtime, five sprite sheets, and fallback portraits are required app-shell assets.
'use strict';
const V203_REGISTERED_SETTINGS_GENERATION='v339-settings-saved-state-first-worker-boundary';
// The saved-state-first Settings bootstrap must run before the historical v325 override so the Local Models tab can render without waiting for lifecycle/runtime code.
importScripts('/service-worker-settings-v337-entrypoint.js?v=settings-v339-saved-state-first-registered-worker-v1');
// Must run before every general fetch/cache listener. It owns only Settings/local-model display paths and stops propagation for those paths not claimed by the v339 direct-route bootstrap.
importScripts('/service-worker-settings-v325-override.js?v=settings-v325-direct-local-models-v1');
// Staging takeover for the current Gemma phone stack. It runs before historical local-AI coherence so retired Q4 presentation scripts cannot reclaim Settings after a successful LiteRT import.
importScripts('/service-worker-gemma4-current-phone-v1.js?v=gemma4-current-phone-worker-v1');
importScripts('/service-worker-release-generation-v1.js?v=release-generation-boundary-v1-20260825');
importScripts('/app/system-routes-v227.js?v=1.0.167-five-system-route-contract-v230-shared-navbar-owner');
importScripts('/service-worker-canonical-navbar-v1.js?v=canonical-navbar-cache-first-v11-current-rail');
importScripts('/service-worker-legacy-home-redirect-v1.js?v=legacy-home-redirect-v1-v156-to-v440');
importScripts('/service-worker-canonical-home-v1.js?v=canonical-home-v1-persistent-shell-r2');
importScripts('/service-worker-five-system-pages-v1.js?v=five-system-pages-v1-persistent-shell-r5');
importScripts('/service-worker-navigation-runtime-recovery-v1.js?v=navigation-runtime-recovery-v3-all-installed-origins');
importScripts('/service-worker-direct-shell-retirement-v1.js?v=direct-shell-retirement-v1');
importScripts('/service-worker-living-school-cleanroom-v218.js?v=living-school-cleanroom-v219-lifecycle-deferred');
importScripts('/service-worker-local-ai-coherence-v307.js?v=1.0.167-local-ai-code-v322-ai-quest-source-authority');
importScripts('/service-worker-code-coherence-v288.js?v=1.0.92-code-coherence-v289-lifecycle-deferred');
importScripts('/service-worker-core-v208.js?v=1.0.163-chat-convergence-v250-installer-brand-v1-working-campus-return-v425-guild-quest-browser-v430-install-only-pwa-v1');
importScripts('/service-worker-shell-assets-v1.js?v=shell-assets-v1-repair-v25-persistent-navbar-required');
importScripts('/service-worker-installed-launch-v282.js?v=installed-pwa-launch-v295-entry-integrity');
importScripts('/service-worker-installer-state-v280.js?v=installer-state-machines-v280');
importScripts('/service-worker-shell-integrity-v281.js?v=shell-integrity-v281');
importScripts('/service-worker-radio-core-v305.js?v=1.0.163-radio-core-shell-v305-safe-station-v356');
importScripts('/service-worker-shell-repair-v293.js?v=installed-shell-repair-v293');
importScripts('/service-worker-offline-v211-override.js?v=offline-campus-current-graph-v280&policy=resumable-pause-v280&references=current-manifest-only-v282');
importScripts('/service-worker-offline-low-pressure-v1.js?v=offline-campus-low-pressure-v1');
importScripts('/service-worker-campus-completion-v246.js?v=campus-current-completion-v250');
importScripts('/service-worker-release-coherence-v220.js?v=release-coherence-v226');
importScripts('/service-worker-navigation-safety-v224.js?v=navigation-redirect-safety-v224-direct-system-pages-v2');
importScripts('/service-worker-canonical-navigation-v227.js?v=canonical-five-system-navigation-v227-direct-routes-v1');
importScripts('/service-worker-chat-repair-v245.js?v=guild-live-balance-v2&purge=guild-live-balance-v2&freeze=mobile-chat-main-thread-quiescence-v349&layout=mobile-chat-long-thread-fit-v362&threads=saved-tabs-contained-v354&party=lazy-v353&model=selected-local-minilm-v357&failover=server-auto-local-failover-v358&passover=guide-capability-passover-v361&endeavor=kamiya-provider-authority-v7&provider=selected-provider-authority-v1&sanitize=assistant-output-sanitizer-v1');
importScripts('/service-worker-local-model-download-v267.js?v=1.0.75-local-model-background-v267');
importScripts('/service-worker-boot-recovery-v426.js?v=boot-recovery-v432-lifecycle-deferred');
// staging-installed-entry-takeover-v21-learning-source-pack-authority: one-shot activation that purges mixed-generation Living School source-pack status code without touching downloaded source data.
const V203_STAGING_RECOVERY_HOST='civweave-staging.pages.dev';
const V203_STAGING_RECOVERY_CACHE='cwrecovery-v453-learning-source-pack-authority';
const V203_STAGING_RECOVERY_MARKER='/__civweave/staging-installed-entry-takeover-v21-learning-source-pack-authority';
const V203_STAGING_SOURCE_STATUS_PATHS=new Set([
  '/app/living-school-active-run-ui-v1.js',
  '/app/living-school-media-pack-recommender-v1.mjs',
  '/app/learning-source-pack-runtime-v1.mjs',
  '/app/knowledge-school-seeds-v1.js',
  '/app/living-school-video-generation-guard-v1.mjs',
  '/app/cabinets/living-school/index.html'
]);
function v203StagingRecoveryRequest(){return new Request(new URL(V203_STAGING_RECOVERY_MARKER,self.location.origin).href)}
async function v203StagingRecoveryPending(){if(self.location.hostname!==V203_STAGING_RECOVERY_HOST)return false;try{return !(await(await caches.open(V203_STAGING_RECOVERY_CACHE)).match(v203StagingRecoveryRequest()))}catch{return true}}
async function v203VisibleInstallerClient(){try{const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});return windows.some(client=>{if(client.visibilityState!=='visible')return false;try{const url=new URL(client.url);return url.origin===self.location.origin&&(url.pathname==='/app/'||url.pathname==='/app/index.html')}catch{return false}})}catch{return false}}
async function v203PurgeLivingSchoolSourceStatusAssets(){
  const names=await caches.keys();
  for(const name of names){
    const cache=await caches.open(name),requests=await cache.keys();
    for(const request of requests){
      let pathname='';try{pathname=new URL(request.url).pathname}catch{}
      if(V203_STAGING_SOURCE_STATUS_PATHS.has(pathname))await cache.delete(request,{ignoreSearch:true});
    }
  }
}
if(self.location.hostname===V203_STAGING_RECOVERY_HOST){
  self.addEventListener('install',event=>{event.waitUntil((async()=>{if(!(await v203StagingRecoveryPending()))return;if(await v203VisibleInstallerClient())return;await self.skipWaiting()})())});
  self.addEventListener('activate',event=>{event.waitUntil((async()=>{await v203PurgeLivingSchoolSourceStatusAssets();const cache=await caches.open(V203_STAGING_RECOVERY_CACHE);await cache.put(v203StagingRecoveryRequest(),new Response('learning-source-pack-authority-v1-activated',{headers:{'content-type':'text/plain','cache-control':'no-store'}}));await self.clients.claim()})())});
}

// staging-installed-entry-takeover-v24-settings-v339-saved-state-first: one-shot staging activation for the canonical worker bytes installed clients actually register. It purges only Settings executable assets, never saved model state or downloaded model bytes.
const V203_STAGING_SETTINGS_RECOVERY_CACHE='cwrecovery-v456-settings-v339-saved-state-first';
const V203_STAGING_SETTINGS_RECOVERY_MARKER='/__civweave/staging-installed-entry-takeover-v24-settings-v339-saved-state-first';
const V203_STAGING_SETTINGS_PATHS=new Set([
  '/app/settings-gateway-v317.js',
  '/app/settings-direct-entry-v338.js',
  '/app/settings-direct-entry-v339.js',
  '/app/settings-local-models-direct-v325.js',
  '/app/settings-local-loader-v337.js',
  '/app/settings-local-route-v323.js',
  '/app/settings-local-route-v325.js',
  '/app/settings-local-route-v327.js',
  '/app/settings-local-route-v331.js'
]);
function v203StagingSettingsRecoveryRequest(){return new Request(new URL(V203_STAGING_SETTINGS_RECOVERY_MARKER,self.location.origin).href)}
async function v203StagingSettingsRecoveryPending(){if(self.location.hostname!==V203_STAGING_RECOVERY_HOST)return false;try{return !(await(await caches.open(V203_STAGING_SETTINGS_RECOVERY_CACHE)).match(v203StagingSettingsRecoveryRequest()))}catch{return true}}
async function v203PurgeSettingsRecoveryAssets(){
  const names=await caches.keys();
  for(const name of names){
    const cache=await caches.open(name),requests=await cache.keys();
    for(const request of requests){
      let pathname='';try{pathname=new URL(request.url).pathname}catch{}
      if(V203_STAGING_SETTINGS_PATHS.has(pathname))await cache.delete(request,{ignoreSearch:true});
    }
  }
}
if(self.location.hostname===V203_STAGING_RECOVERY_HOST){
  self.addEventListener('install',event=>{event.waitUntil((async()=>{if(await v203StagingSettingsRecoveryPending())await self.skipWaiting()})())});
  self.addEventListener('activate',event=>{event.waitUntil((async()=>{if(!(await v203StagingSettingsRecoveryPending()))return;await v203PurgeSettingsRecoveryAssets();const cache=await caches.open(V203_STAGING_SETTINGS_RECOVERY_CACHE);await cache.put(v203StagingSettingsRecoveryRequest(),new Response('settings-v339-saved-state-first-activated',{headers:{'content-type':'text/plain','cache-control':'no-store'}}));await self.clients.claim()})())});
}
// Legacy coherence marker only, intentionally non-executable: self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting())})