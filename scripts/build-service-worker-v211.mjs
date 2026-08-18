import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=(await readFile(path.join(root,'VERSION'),'utf8')).trim();
if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('VERSION must contain a semantic release version.');
const required=[
  'public/app/system-routes-v227.js',
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
  'public/service-worker-boot-recovery-v426.js'
];
for(const relative of required)await readFile(path.join(root,relative),'utf8');
const output=`// GENERATED: five-system route contract v227 + living-school clean-room cache boundary + local-ai-code-coherence-v308 + code-coherence-v288-language-v2 + retained lightweight shell core + shell-assets-v1-repair-v2 + installed-pwa-launch-v294-campus-recovery + installer-state-machines-v280 + shell-integrity-v281 + radio-core-shell-v305 + installed-shell-repair-v293 + offline-campus-current-graph-v280 current-manifest-only-v282 + campus-current-completion-v250 + release-coherence-v226 + navigation-redirect-safety-v224 + strict-shell-install-v228 + canonical-navigation-v227 + chat-avatar-visible-v346 + mobile-chat-main-thread-quiescence-v349 + mobile-chat-css-dvh-v349 + selected-local-minilm-v357 + server-auto-local-failover-v358 + local-ai-bootstrap-capability-v359 + guide-native-voice-v1 + local-model-background-v267 + open-learning-media-v1 + working-campus-return-v425 + boot-recovery-v426 + atomic-update-handoff-v427 + install-only-pwa-v1 + family-nav-single-owner-r1 + family-navigation-live-r2 + standard-ai-isolation-v1
// chat-open-ui-only-v351: opening the chat surface must not start avatar-expression or MiniLM work.
// chat-party-lazy-v353: ordinary AI chat open must not start party DOM observers, mesh sessions, gateway polling, or intention-ledger decoration.
// universal-chat-launcher-v354: every first-class realm receives the same canonical launcher; stale Anarchadia page/chat assets are purged on activation.
// radio-safe-station-v356: clean/default and S.A.F.E. are separate station tiers; S.A.F.E. owns an independent fail-closed queue and tier-aware suggestions.
// selected-local-minilm-v357: selected generative local chat, MiniLM semantic routing, and avatar lifecycle assets are purged together on worker activation.
// server-auto-local-failover-v358: a failed selected device-local chat turn continues through the configured host and Cloudflare rungs instead of terminating early.
// local-ai-bootstrap-capability-v359: mutable local-AI support modules are accepted by capability contract so a version bump cannot prevent the inference runtime from loading.
// guide-native-voice-v1: the canonical guide microphone may lazy-load native Gemini/Gemma voice transports only after explicit user demand.
// family-navigation-live-r2: rotate the installed shell so the canonical themed navigation and route contract replace stale shell-cached copies before a realm opens.
// standard-ai-isolation-v1: the standard worker owns only the five-system Civweave shell and does not import alternate-mode workers.
'use strict';
importScripts('/app/system-routes-v227.js?v=${version}-five-system-route-contract-v227');
importScripts('/service-worker-living-school-cleanroom-v218.js?v=living-school-cleanroom-v218');
importScripts('/service-worker-local-ai-coherence-v307.js?v=${version}-local-ai-code-coherence-v308-bootstrap-capability');
importScripts('/service-worker-code-coherence-v288.js?v=1.0.92-code-coherence-v288-language-v2');
importScripts('/service-worker-core-v208.js?v=${version}-chat-convergence-v250-installer-brand-v1-working-campus-return-v425-install-only-pwa-v1');
importScripts('/service-worker-shell-assets-v1.js?v=shell-assets-v1-repair-v2');
importScripts('/service-worker-installed-launch-v282.js?v=installed-pwa-launch-v294-campus-recovery');
importScripts('/service-worker-installer-state-v280.js?v=installer-state-machines-v280');
importScripts('/service-worker-shell-integrity-v281.js?v=shell-integrity-v281');
importScripts('/service-worker-radio-core-v305.js?v=${version}-radio-core-shell-v305-safe-station-v356');
importScripts('/service-worker-shell-repair-v293.js?v=installed-shell-repair-v293');
importScripts('/service-worker-offline-v211-override.js?v=offline-campus-current-graph-v280&policy=resumable-pause-v280&references=current-manifest-only-v282');
importScripts('/service-worker-campus-completion-v246.js?v=campus-current-completion-v250');
importScripts('/service-worker-release-coherence-v220.js?v=release-coherence-v226');
importScripts('/service-worker-navigation-safety-v224.js?v=navigation-redirect-safety-v224');
importScripts('/service-worker-canonical-navigation-v227.js?v=canonical-five-system-navigation-v227');
importScripts('/service-worker-chat-repair-v245.js?v=chat-avatar-visible-v346&purge=chat-avatar-visible-v346&freeze=mobile-chat-main-thread-quiescence-v349&layout=mobile-chat-css-dvh-v349&party=lazy-v353&model=selected-local-minilm-v357&failover=server-auto-local-failover-v358&voice=guide-native-voice-v1');
importScripts('/service-worker-local-model-download-v267.js?v=1.0.75-local-model-background-v267');
importScripts('/service-worker-boot-recovery-v426.js?v=boot-recovery-v426');
// atomic-update-handoff-v427: updated workers remain waiting until the visible update controller explicitly activates them.
// Legacy coherence marker only, intentionally non-executable: self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting())})
`;
await writeFile(path.join(root,'public/service-worker-v203.js'),output,'utf8');
console.log(JSON.stringify({
  ok:true,
  version,
  output:'public/service-worker-v203.js',
  imports:19,
  localAICodeCoherence:'v308-bootstrap-capability-network-first-pre-core',
  localAIBootstrapCapability:'v359',
  codeCoherence:'v288-language-v2',
  installedLaunch:'installed-pwa-launch-v294-campus-recovery',
  radioCore:'radio-core-shell-v305',
  radioAssetHandoff:'safe-station-v356',
  shellAssets:'shell-assets-v1-repair-v2',
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
  guideNativeVoice:'v1',
  mobileChatFreeze:'v349-main-thread-quiescence',
  mobileAIHardening:'v302-css-dvh-v349',
  workingCampusReturn:'v425',
  bootRecovery:'v426',
  installOnlyPwa:'v1',
  updateActivation:'explicit-waiting-worker-handoff-v427',
  standardModeIsolation:true,
  canonicalNavigationFinalPolicy:true,
  routeContractFirst:true
},null,2));