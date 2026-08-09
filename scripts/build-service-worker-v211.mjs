import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=(await readFile(path.join(root,'VERSION'),'utf8')).trim();
if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('VERSION must contain a semantic release version.');
const required=[
  'public/app/system-routes-v227.js',
  'public/service-worker-offline-runtime-boundary-v266.js',
  'public/service-worker-living-school-cleanroom-v218.js',
  'public/service-worker-core-v208.js',
  'public/service-worker-offline-v211-override.js',
  'public/service-worker-campus-completion-v246.js',
  'public/service-worker-release-coherence-v220.js',
  'public/service-worker-navigation-safety-v224.js',
  'public/service-worker-shell-repair-v225.js',
  'public/service-worker-canonical-navigation-v227.js',
  'public/service-worker-chat-repair-v245.js'
];
for(const relative of required)await readFile(path.join(root,relative),'utf8');
const output=`// GENERATED: five-system route contract v227 + downloaded-runtime boundary v266 + living-school clean-room cache boundary + retained lightweight shell core + offline-campus-current-graph-v238 policy fast-background-v241 + campus-retired-completion-v246 + release-coherence-v226 + navigation-redirect-safety-v224 + shell-self-repair-v225 + canonical-navigation-v266 + chat-convergence-v250
'use strict';
importScripts('/app/system-routes-v227.js?v=${version}-five-system-route-contract-v227');
importScripts('/service-worker-offline-runtime-boundary-v266.js?v=${version}-downloaded-runtime-v266');
importScripts('/service-worker-living-school-cleanroom-v218.js?v=living-school-cleanroom-v218');
importScripts('/service-worker-core-v208.js?v=${version}-chat-convergence-v250');
importScripts('/service-worker-offline-v211-override.js?v=offline-campus-current-graph-v238&policy=fast-background-v241');
importScripts('/service-worker-campus-completion-v246.js?v=campus-retired-completion-v246');
importScripts('/service-worker-release-coherence-v220.js?v=release-coherence-v226');
importScripts('/service-worker-navigation-safety-v224.js?v=navigation-redirect-safety-v224');
importScripts('/service-worker-shell-repair-v225.js?v=shell-self-repair-v225');
importScripts('/service-worker-canonical-navigation-v227.js?v=canonical-package-navigation-v266');
importScripts('/service-worker-chat-repair-v245.js?v=chat-convergence-v250');
self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting())});
`;
await writeFile(path.join(root,'public/service-worker-v203.js'),output,'utf8');
console.log(JSON.stringify({ok:true,version,output:'public/service-worker-v203.js',imports:11,offlineRevision:'offline-campus-current-graph-v238',offlinePolicy:'fast-background-v241',downloadedRuntimeBoundary:'v266-before-core',canonicalNavigationFinal:true,canonicalRuntime:'package-only-no-live-fallback',chatMigration:'v250',routeContractFirst:true},null,2));
