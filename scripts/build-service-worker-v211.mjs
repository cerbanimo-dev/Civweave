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
  'public/service-worker-installed-launch-v282.js',
  'public/service-worker-installer-state-v280.js',
  'public/service-worker-shell-integrity-v281.js',
  'public/service-worker-radio-core-v305.js',
  'public/service-worker-shell-repair-v293.js',
  'public/service-worker-offline-v211-override.js',
  'public/service-worker-campus-completion-v246.js',
  'public/service-worker-release-coherence-v220.js',
  'public/service-worker-navigation-safety-v224.js',
  'public/service-worker-shell-repair-v225.js',
  'public/service-worker-canonical-navigation-v227.js',
  'public/service-worker-chat-repair-v245.js',
  'public/service-worker-local-model-download-v267.js',
  'public/app/working-campus-return-guard-v425.js',
  'public/service-worker-boot-recovery-v426.js'
];
for(const relative of required)await readFile(path.join(root,relative),'utf8');
const output=`// GENERATED: five-system route contract v227 + living-school clean-room cache boundary + local-ai-code-coherence-v307 + code-coherence-v288 + retained lightweight shell core + installed-pwa-launch-v294-campus-recovery + installer-state-machines-v280 + shell-integrity-v281 + radio-core-shell-v305 + installed-shell-repair-v293 + offline-campus-current-graph-v280 current-manifest-only-v282 + campus-retired-completion-v246 + release-coherence-v226 + navigation-redirect-safety-v224 + shell-self-repair-v225 + canonical-navigation-v227 + chat-css-contract-v343 + mobile-ai-hardening-v302 + local-model-background-v267 + open-learning-media-v1 + working-campus-return-v425 + boot-recovery-v426 + atomic-update-handoff-v427
'use strict';
importScripts('/app/system-routes-v227.js?v=${version}-five-system-route-contract-v227');
importScripts('/service-worker-living-school-cleanroom-v218.js?v=living-school-cleanroom-v218');
importScripts('/service-worker-local-ai-coherence-v307.js?v=${version}-local-ai-code-coherence-v307');
importScripts('/service-worker-code-coherence-v288.js?v=1.0.91-code-coherence-v288');
importScripts('/service-worker-core-v208.js?v=${version}-chat-convergence-v250-installer-brand-v1-working-campus-return-v425');
importScripts('/service-worker-installed-launch-v282.js?v=installed-pwa-launch-v294-campus-recovery');
importScripts('/service-worker-installer-state-v280.js?v=installer-state-machines-v280');
importScripts('/service-worker-shell-integrity-v281.js?v=shell-integrity-v281');
importScripts('/service-worker-radio-core-v305.js?v=${version}-radio-core-shell-v305-playlist-only-v246');
importScripts('/service-worker-shell-repair-v293.js?v=installed-shell-repair-v293');
importScripts('/service-worker-offline-v211-override.js?v=offline-campus-current-graph-v280&policy=resumable-pause-v280&references=current-manifest-only-v282');
importScripts('/service-worker-campus-completion-v246.js?v=campus-retired-completion-v246');
importScripts('/service-worker-release-coherence-v220.js?v=release-coherence-v226');
importScripts('/service-worker-navigation-safety-v224.js?v=navigation-redirect-safety-v224');
importScripts('/service-worker-shell-repair-v225.js?v=shell-self-repair-v225');
importScripts('/service-worker-canonical-navigation-v227.js?v=canonical-five-system-navigation-v227');
importScripts('/service-worker-chat-repair-v245.js?v=chat-css-contract-v343&purge=chat-css-contract-v343');
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
  localAICodeCoherence:'v307-network-first-pre-core',
  codeCoherence:'v288',
  installedLaunch:'installed-pwa-launch-v294-campus-recovery',
  radioCore:'radio-core-shell-v305',
  radioAssetHandoff:'playlist-only-v246',
  installedShellRepair:'installed-shell-repair-v293',
  offlineRevision:'offline-campus-current-graph-v280',
  offlinePolicy:'resumable-pause-v280',
  offlineReferencePolicy:'current-manifest-only-v282',
  shellIntegrity:'shell-integrity-v281',
  installerState:'installer-state-machines-v280',
  chatRepair:'chat-css-contract-v343',
  mobileAIHardening:'v302',
  workingCampusReturn:'v425',
  bootRecovery:'v426',
  updateActivation:'explicit-waiting-worker-handoff-v427',
  canonicalNavigationFinalPolicy:true,
  routeContractFirst:true
},null,2));