// GENERATED: one persistent five-system shell + shared canonical rail + Guild/Map actions + direct realm content inside the shell.
// persistent-system-shell-v1: the universal navbar is top-level and survives system changes; only the content stage changes.
// canonical-home-v1: top-level home navigation enters the persistent shell; embedded home remains the validated v440 campus.
// five-system-pages-v1: top-level realm navigation enters the persistent shell; embedded realm content remains bounded and validated.
// navigation-runtime-recovery-v2: stale navigation code/pages are purged without reloading or redirecting open clients.
// direct-shell-retirement-v1: only retired legacy shells are purged; the current persistent-system-shell-v1 is not retired.
// persistent-shell-actions-v1: Guilds and Map belong to the canonical rail across all five systems.
// family-nav-single-owner-r3: themed-system-nav-v178 is mounted once by persistent-system-shell-v1 and is not recreated by realms.
// lifecycle-deferred-v434: optional AI/code warming, cache-wide cleanup, chat repair, route warming, and recovery staging never block install/activate.
'use strict';
importScripts('/app/system-routes-v227.js?v=1.0.167-five-system-route-contract-v230-shared-navbar-owner');
importScripts('/service-worker-canonical-navbar-v1.js?v=canonical-navbar-cache-first-v9-shared-rail');
importScripts('/service-worker-legacy-home-redirect-v1.js?v=legacy-home-redirect-v1-v156-to-v440');
importScripts('/service-worker-canonical-home-v1.js?v=canonical-home-v1-persistent-shell-r2');
importScripts('/service-worker-five-system-pages-v1.js?v=five-system-pages-v1-persistent-shell-r5');
importScripts('/service-worker-navigation-runtime-recovery-v1.js?v=staging-navigation-runtime-recovery-v2-purge-only');
importScripts('/service-worker-direct-shell-retirement-v1.js?v=direct-shell-retirement-v1');
importScripts('/service-worker-living-school-cleanroom-v218.js?v=living-school-cleanroom-v219-lifecycle-deferred');
importScripts('/service-worker-local-ai-coherence-v307.js?v=1.0.167-local-ai-code-v322-ai-quest-source-authority');
importScripts('/service-worker-code-coherence-v288.js?v=1.0.92-code-coherence-v289-lifecycle-deferred');
importScripts('/service-worker-core-v208.js?v=1.0.163-chat-convergence-v250-installer-brand-v1-working-campus-return-v425-guild-quest-browser-v430-install-only-pwa-v1');
importScripts('/service-worker-shell-assets-v1.js?v=shell-assets-v1-repair-v24-navbar-actions-refresh');
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
// staging-installed-entry-takeover-v18-persistent-system-shell: one-shot activation so installed staging immediately enters the persistent navbar shell.
const V203_STAGING_RECOVERY_HOST='civweave-staging.pages.dev';
const V203_STAGING_RECOVERY_CACHE='cwrecovery-v450-persistent-system-shell';
const V203_STAGING_RECOVERY_MARKER='/__civweave/staging-installed-entry-takeover-v18-persistent-system-shell';
function v203StagingRecoveryRequest(){return new Request(new URL(V203_STAGING_RECOVERY_MARKER,self.location.origin).href)}
async function v203StagingRecoveryPending(){if(self.location.hostname!==V203_STAGING_RECOVERY_HOST)return false;try{return !(await(await caches.open(V203_STAGING_RECOVERY_CACHE)).match(v203StagingRecoveryRequest()))}catch{return true}}
async function v203VisibleInstallerClient(){try{const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});return windows.some(client=>{if(client.visibilityState!=='visible')return false;try{const url=new URL(client.url);return url.origin===self.location.origin&&(url.pathname==='/app/'||url.pathname==='/app/index.html')}catch{return false}})}catch{return false}}
if(self.location.hostname===V203_STAGING_RECOVERY_HOST){
  self.addEventListener('install',event=>{event.waitUntil((async()=>{if(!(await v203StagingRecoveryPending()))return;if(await v203VisibleInstallerClient())return;await self.skipWaiting()})())});
  self.addEventListener('activate',event=>{event.waitUntil((async()=>{const cache=await caches.open(V203_STAGING_RECOVERY_CACHE);await cache.put(v203StagingRecoveryRequest(),new Response('persistent-system-shell-r1-activated',{headers:{'content-type':'text/plain','cache-control':'no-store'}}));await self.clients.claim()})())});
}
// Legacy coherence marker only, intentionally non-executable: self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting())})