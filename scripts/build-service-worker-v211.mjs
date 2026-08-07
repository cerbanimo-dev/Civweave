import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=(await readFile(path.join(root,'VERSION'),'utf8')).trim();
if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('VERSION must contain a semantic release version.');
const required=[
  'public/app/system-routes-v227.js',
  'public/service-worker-living-school-cleanroom-v218.js',
  'public/service-worker-core-v208.js',
  'public/service-worker-offline-v211-override.js',
  'public/service-worker-release-coherence-v220.js',
  'public/service-worker-navigation-safety-v224.js',
  'public/service-worker-shell-repair-v225.js',
  'public/service-worker-canonical-navigation-v227.js'
];
for(const relative of required)await readFile(path.join(root,relative),'utf8');
const output=`// GENERATED: five-system route contract v227 + living-school clean-room cache boundary + retained lightweight shell core + offline-campus-current-graph-v238 policy fast-background-v241 + release-coherence-v226 + navigation-redirect-safety-v224 + shell-self-repair-v225 + canonical-navigation-v227
'use strict';
importScripts('/app/system-routes-v227.js?v=${version}-five-system-route-contract-v227');
importScripts('/service-worker-living-school-cleanroom-v218.js?v=living-school-cleanroom-v218');
importScripts('/service-worker-core-v208.js?v=${version}-lightweight-shell-v208-retained-v218');
importScripts('/service-worker-offline-v211-override.js?v=offline-campus-current-graph-v238&policy=fast-background-v241');
importScripts('/service-worker-release-coherence-v220.js?v=release-coherence-v226');
importScripts('/service-worker-navigation-safety-v224.js?v=navigation-redirect-safety-v224');
importScripts('/service-worker-shell-repair-v225.js?v=shell-self-repair-v225');
importScripts('/service-worker-canonical-navigation-v227.js?v=canonical-five-system-navigation-v227');
`;
await writeFile(path.join(root,'public/service-worker-v203.js'),output,'utf8');
console.log(JSON.stringify({ok:true,version,output:'public/service-worker-v203.js',imports:8,offlineRevision:'offline-campus-current-graph-v238',offlinePolicy:'fast-background-v241',canonicalNavigationFinal:true,routeContractFirst:true},null,2));
