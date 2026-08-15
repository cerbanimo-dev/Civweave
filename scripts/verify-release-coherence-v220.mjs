import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(path.join(root,file),'utf8');
const [wrapper,override,entry,cloudflareBuild,prepareStart]=await Promise.all([
  read('public/service-worker-v203.js'),
  read('public/service-worker-release-coherence-v220.js'),
  read('public/app/installed-entry-v146.js'),
  read('scripts/build-cloudflare-pages.mjs'),
  read('scripts/prepare-start-v131.mjs')
]);

const offlineImport="importScripts('/service-worker-offline-v211-override.js";
const coherenceImport="importScripts('/service-worker-release-coherence-v220.js?v=release-coherence-v226-local-first')";
assert(wrapper.includes(coherenceImport),'Active worker wrapper does not import local-first release coherence v226.');
assert(wrapper.indexOf(coherenceImport)>wrapper.indexOf(offlineImport),'Release coherence must load after the retained core and offline override.');
assert(entry.includes('document.currentScript?.src'),'Installed entry does not derive an explicit release from a versioned local script URL when one is supplied.');
assert(entry.includes("cachedResponse('/app/manifest.webmanifest')"),'Installed entry must resolve release metadata from local cache first.');
assert(entry.includes('if(!localDeveloper())return FALLBACK_VERSION'),'Production installed entry must not fetch release metadata when local cache is absent.');
assert(entry.includes('allowProvision:localDeveloper()'),'Only localhost developer mode may provision/refresh the full worker during launch.');
assert(entry.includes("browserRuntimePolicy:'installed-display-cache-only'"),'Installed entry must advertise cache-only runtime behavior.');
assert(cloudflareBuild.includes("await import('./sync-release-version-assets.mjs')"),'Cloudflare build skips canonical release synchronization.');
assert(cloudflareBuild.includes("await import('./sync-release-coherence-v220.mjs')"),'Cloudflare build skips release-coherence verification.');
assert(prepareStart.includes("await import('./sync-release-coherence-v220.mjs')"),'Render/local startup skips release-coherence verification.');
assert(override.includes('version-pinned-cache-only-runtime-explicit-update-only'),'Release coherence policy must be cache-only at runtime.');
assert(override.includes('runtimeNetworkFallback: false'),'Release coherence must explicitly forbid runtime network fallback.');

let cachedCalls=0;
let fetchCalls=0;
const cachedResponse=(type='application/javascript')=>new Response('cached',{status:200,headers:{'content-type':type}});
const sandbox={
  URL,
  Request,
  Response,
  Headers,
  self:{},
  cacheFirst:async request=>{cachedCalls+=1;const pathname=new URL(request.url).pathname;const type=pathname.endsWith('.txt')?'text/plain':pathname.endsWith('.css')?'text/css':'application/javascript';return cachedResponse(type)},
  fetch:async()=>{fetchCalls+=1;return new Response('network',{status:200})},
  console
};
vm.createContext(sandbox);
vm.runInContext(override,sandbox,{filename:'service-worker-release-coherence-v220.js'});

for(const url of [
  'https://civweave.invalid/app/install-boundary-v146.js?v=chat-convergence-v250',
  'https://civweave.invalid/app/working-campus-v156.part1.txt?revision=canonical-campus-startup-v227',
  'https://civweave.invalid/app/logos/civweave-icon-192.png?v=1.0.13'
]){
  const response=await sandbox.cacheFirst(new Request(url));
  assert.equal(await response.text(),'cached',`Runtime asset must resolve from cache: ${url}`);
}
assert.equal(fetchCalls,0,'Release-coherence runtime must never contact the network.');
assert.equal(cachedCalls,3,'Release-coherence wrapper must preserve local cache resolution.');
assert.equal(sandbox.self.CivweaveReleaseCoherenceV220?.policy,'version-pinned-cache-only-runtime-explicit-update-only');
assert.equal(sandbox.self.CivweaveReleaseCoherenceV220?.runtimeNetworkFallback,false);

console.log(JSON.stringify({
  ok:true,
  revision:'release-coherence-v226-local-first',
  installedEntryRefresh:'explicit-package-or-local-developer-only',
  cloudflareVersionSync:true,
  renderLocalVersionSync:true,
  versionedRuntimeAssets:'cache-only',
  runtimeNetworkFallback:false
},null,2));
