import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=(await readFile(path.join(root,'VERSION'),'utf8')).trim();
if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('VERSION must contain a semantic release version.');
const required=[
  'public/app/system-routes-v227.js',
  'public/app/persistent-family-shell-v1.html',
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
  'public/service-worker-campus-completion-v246.js',
  'public/service-worker-release-coherence-v220.js',
  'public/service-worker-navigation-safety-v224.js',
  'public/service-worker-canonical-navigation-v227.js',
  'public/service-worker-chat-repair-v245.js',
  'public/service-worker-local-model-download-v267.js',
  'public/app/working-campus-return-guard-v425.js',
  'public/app/document-lifecycle-v221.js',
  'public/app/working-campus-home-declutter-v1.js',
  'public/app/themed-system-nav-v178.js',
  'public/service-worker-boot-recovery-v426.js'
];
for(const relative of required)await readFile(path.join(root,relative),'utf8');
const output=`// GENERATED: five-system route contract v227 + living-school clean-room cache boundary + local-ai-code-coherence-v308 + code-coherence-v288-language-v2 + retained lightweight shell core + shell-assets-v1-repair-v12-persistent-shell-route-safe + installed-pwa-launch-v295-entry-integrity + installer-state-machines-v280 + shell-integrity-v281 + radio-core-shell-v305 + installed-shell-repair-v293 + offline-campus-current-graph-v280 current-manifest-only-v282 + campus-current-completion-v250 + release-coherence-v226 + navigation-redirect-safety-v224 + strict-shell-install-v228 + canonical-navigation-v227 + chat-avatar-visible-v346 + mobile-chat-main-thread-quiescence-v349 + mobile-chat-long-thread-fit-v362 + selected-local-minilm-v357 + server-auto-local-failover-v358 + guide-capability-passover-v361 + local-ai-bootstrap-capability-v359 + local-model-background-v267 + open-learning-media-v1 + working-campus-return-v425 + guild-quest-browser-v430 + boot-recovery-v426 + atomic-update-handoff-v427 + install-only-pwa-v1 + family-nav-single-owner-r1 + family-navigation-live-r2 + persistent-family-shell-v1 + persistent-shell-route-safe-v1 + required-nav-media-v1 + standard-ai-isolation-v1 + cerbanimo-boot-network-first-v1 + desktop-civweave-boot-recovery-v363 + staging-installed-entry-takeover-v5-canonical-navbar + canonical-navbar-network-first-v2
// chat-open-ui-only-v351: opening the chat surface must not start avatar-expression or MiniLM work.
// chat-party-lazy-v353: ordinary AI chat open must not start party DOM observers, mesh sessions, gateway polling, or intention-ledger decoration.
// universal-chat-launcher-v354: every first-class realm receives the same canonical launcher; stale Anarchadia page/chat assets are purged on activation.
// radio-safe-station-v356: clean/default and S.A.F.E. are separate station tiers; S.A.F.E. owns an independent fail-closed queue and tier-aware suggestions.
// selected-local-minilm-v357: selected generative local chat, MiniLM semantic routing, and avatar lifecycle assets are purged together on worker activation.
// server-auto-local-failover-v358: a failed selected device-local chat turn continues through the configured host and Cloudflare rungs instead of terminating early.
// guide-capability-passover-v361: realm guides keep specialized generators with their owning realm and offer one-click request passover instead of duplicating capabilities.
// local-ai-bootstrap-capability-v359: mutable local-AI support modules are accepted by capability contract so a version bump cannot prevent the inference runtime from loading.
// family-navigation-live-r2: rotate the installed shell so the canonical themed navigation and route contract replace stale shell-cached copies before a realm opens.
// persistent-family-shell-v1: the five-guide rail is top-level PWA chrome and survives realm changes while only the realm stage is replaced.
// persistent-shell-route-safe-v1: the live persistent shell uses a path distinct from legacy compatibility entries so the worker cannot substitute the installer for it.
// required-nav-media-v1: the five avatar atlases and face fallbacks are required offline shell assets rather than best-effort optional media.
// mobile-chat-long-thread-fit-v362: long guide transcripts scroll inside the remaining visual viewport; the composer and saved-thread bar stay in the fixed chat frame.
// standard-ai-isolation-v1: the standard worker owns only the five-system Civweave shell and does not import alternate-mode workers.
// cerbanimo-boot-network-first-v1: realm console, parity runtime, parity ledger, and parity fallback chunks bypass stale runtime caches while online.
// desktop-civweave-boot-recovery-v363: route/nav and Working Campus recovery/declutter boot scripts are required shell assets, never best-effort runtime repairs.
// canonical-navbar-network-first-v2: the sole five-guide navbar and both former geometry injectors bypass stale shell/runtime copies; the worker installs only after all three current assets are warmed.
'use strict';
importScripts('/app/system-routes-v227.js?v=${version}-five-system-route-contract-v227');
importScripts('/service-worker-canonical-navbar-v1.js?v=canonical-navbar-network-first-v2');
importScripts('/service-worker-living-school-cleanroom-v218.js?v=living-school-cleanroom-v218');
importScripts('/service-worker-local-ai-coherence-v307.js?v=${version}-local-ai-code-coherence-v308-bootstrap-capability');
importScripts('/service-worker-code-coherence-v288.js?v=1.0.92-code-coherence-v288-language-v2');
importScripts('/service-worker-core-v208.js?v=${version}-chat-convergence-v250-installer-brand-v1-working-campus-return-v425-guild-quest-browser-v430-install-only-pwa-v1');
// Keep the compatibility import URL expected by the release synchronizer; the imported file declares its own persistent-shell route-safe revision.
importScripts('/service-worker-shell-assets-v1.js?v=shell-assets-v1-repair-v2');
importScripts('/service-worker-installed-launch-v282.js?v=installed-pwa-launch-v295-entry-integrity');
importScripts('/service-worker-installer-state-v280.js?v=installer-state-machines-v280');
importScripts('/service-worker-shell-integrity-v281.js?v=shell-integrity-v281');
importScripts('/service-worker-radio-core-v305.js?v=${version}-radio-core-shell-v305-safe-station-v356');
importScripts('/service-worker-shell-repair-v293.js?v=installed-shell-repair-v293');
importScripts('/service-worker-offline-v211-override.js?v=offline-campus-current-graph-v280&policy=resumable-pause-v280&references=current-manifest-only-v282');
importScripts('/service-worker-campus-completion-v246.js?v=campus-current-completion-v250');
importScripts('/service-worker-release-coherence-v220.js?v=release-coherence-v226');
importScripts('/service-worker-navigation-safety-v224.js?v=navigation-redirect-safety-v224');
importScripts('/service-worker-canonical-navigation-v227.js?v=canonical-five-system-navigation-v227');
importScripts('/service-worker-chat-repair-v245.js?v=chat-avatar-visible-v346&purge=chat-avatar-visible-v346&freeze=mobile-chat-main-thread-quiescence-v349&layout=mobile-chat-long-thread-fit-v362&threads=saved-tabs-contained-v354&party=lazy-v353&model=selected-local-minilm-v357&failover=server-auto-local-failover-v358&passover=guide-capability-passover-v361');
importScripts('/service-worker-local-model-download-v267.js?v=1.0.75-local-model-background-v267');
importScripts('/service-worker-boot-recovery-v426.js?v=boot-recovery-v426');
// atomic-update-handoff-v427: updated workers normally remain waiting until the visible update controller explicitly activates them.
// staging-installed-entry-takeover-v5-canonical-navbar: rotate the one-shot staging marker so stale compact navbar code cannot survive an update.
const V203_STAGING_RECOVERY_HOST='civweave-staging.pages.dev';
const V203_STAGING_RECOVERY_CACHE='cwrecovery-v437-canonical-navbar';
const V203_STAGING_RECOVERY_MARKER='/__civweave/staging-installed-entry-takeover-v5-canonical-navbar';
function v203StagingRecoveryRequest(){return new Request(new URL(V203_STAGING_RECOVERY_MARKER,self.location.origin).href)}
async function v203StagingRecoveryPending(){
  if(self.location.hostname!==V203_STAGING_RECOVERY_HOST)return false;
  try{return !(await (await caches.open(V203_STAGING_RECOVERY_CACHE)).match(v203StagingRecoveryRequest()))}catch{return true}
}
if(self.location.hostname===V203_STAGING_RECOVERY_HOST){
  self.addEventListener('install',event=>{event.waitUntil((async()=>{if(await v203StagingRecoveryPending())await self.skipWaiting()})())});
  self.addEventListener('activate',event=>{event.waitUntil((async()=>{const cache=await caches.open(V203_STAGING_RECOVERY_CACHE);await cache.put(v203StagingRecoveryRequest(),new Response('canonical-navbar-scorched-earth-v2-activated',{headers:{'content-type':'text/plain','cache-control':'no-store'}}));await self.clients.claim()})())});
}
// Legacy coherence marker only, intentionally non-executable: self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting())})
`;
await writeFile(path.join(root,'public/service-worker-v203.js'),output,'utf8');
console.log(JSON.stringify({
  ok:true,
  version,
  output:'public/service-worker-v203.js',
  imports:20,
  canonicalNavbar:'network-first-v2-fail-closed-former-geometry-injectors',
  localAICodeCoherence:'v308-bootstrap-capability-network-first-pre-core',
  localAIBootstrapCapability:'v359',
  codeCoherence:'v288-language-v2',
  installedLaunch:'installed-pwa-launch-v295-entry-integrity',
  installedEntryRecovery:'network-first-marker-validation',
  stagingInstalledEntryTakeover:'one-shot-v5-canonical-navbar',
  radioCore:'radio-core-shell-v305',
  radioAssetHandoff:'safe-station-v356',
  shellAssets:'shell-assets-v1-repair-v12-persistent-shell-route-safe',
  persistentFamilyShell:'v1',
  persistentShellRouteSafety:'v1',
  requiredNavigationMedia:true,
  installedShellRepair:'installed-shell-repair-v293',
  offlineRevision:'offline-campus-current-graph-v280',
  offlinePolicy:'resumable-pause-v280',
  offlineReferencePolicy:'current-manifest-only-v282',
  shellIntegrity:'shell-integrity-v281',
  installerState:'installer-state-machines-v280',
  chatRepair:'chat-avatar-visible-v346',
  chatParty:'lazy-v353',
  selectedLocalMiniLM:'v357',
  serverAutoFailover:'v358',
  guideCapabilityPassover:'v361',
  mobileChatFreeze:'v349-main-thread-quiescence',
  mobileChatLayout:'v362-long-thread-fit',
  workingCampusReturn:'v425',
  workingCampusDocumentLifecycle:'v221',
  workingCampusHomeDeclutter:'v1',
  desktopCivweaveBoot:'v363',
  bootRecovery:'v426',
  installOnlyPwa:'v1',
  updateActivation:'explicit-waiting-worker-handoff-v427-with-one-shot-staging-recovery',
  standardModeIsolation:true,
  canonicalNavigationFinalPolicy:true,
  routeContractFirst:true
},null,2));