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
const coherenceImport="importScripts('/service-worker-release-coherence-v220.js?v=release-coherence-v226')";
assert(wrapper.includes(coherenceImport),'Active worker wrapper does not import release coherence v226.');
assert(wrapper.indexOf(coherenceImport)>wrapper.indexOf(offlineImport),'Release coherence must load after the retained core and offline override.');
assert(entry.includes("document.currentScript?.src"),'Installed entry does not derive an explicit release from a versioned script URL when one is supplied.');
assert(entry.includes("fetch(`/app/manifest.webmanifest?boot=${Date.now()}`,{cache:'no-store',signal:controller.signal})"),'Explicit installed-entry release refresh helper is no longer a bounded no-store manifest request.');
assert(entry.includes("updateViaCache:'none'"),'Explicit installed-entry worker refresh can still reuse HTTP-cached worker script bytes.');
assert(entry.includes('await registration.update()'),'Explicit installed-entry update helper no longer refreshes the worker.');
assert(entry.includes("revision=chat-convergence-v250"),'Explicit installed-entry update helper no longer targets the v250 convergence worker.');
assert(entry.includes("candidate.postMessage({type:'SKIP_WAITING'})"),'Explicit installed-entry update helper no longer activates a waiting convergence worker.');
assert(entry.includes("bootPolicy:'local-first-no-host-gate-v283'"),'Installed entry lost the local-first boot policy marker.');
assert(entry.includes('const LOCAL_ROUTES=Object.freeze({'),'Installed entry lost its boot-safe canonical route mirror.');
const bootStart=entry.indexOf('function boot(){'),bootEnd=entry.indexOf('boot();'),boot=entry.slice(bootStart,bootEnd);
assert(bootStart>=0&&bootEnd>bootStart,'Installed entry boot function is missing.');
assert(boot.includes('location.replace(localDestination(system,releaseVersion).href)'),'Installed entry no longer routes directly to an on-device canonical system.');
assert(!boot.includes('resolveReleaseVersion('),'Installed entry boot is again gated by release metadata resolution.');
assert(!boot.includes('refreshWorker('),'Installed entry boot is again gated by worker refresh.');
assert(!boot.includes('fetch('),'Installed entry boot is again gated by network access.');
assert(cloudflareBuild.includes("await import('./sync-release-version-assets.mjs')"),'Cloudflare build skips canonical release synchronization.');
assert(cloudflareBuild.includes("await import('./sync-release-coherence-v220.mjs')"),'Cloudflare build skips release-coherence synchronization.');
assert(prepareStart.includes("await import('./sync-release-coherence-v220.mjs')"),'Render/local startup skips release-coherence synchronization.');
assert(override.includes('working-campus-v156.part5.txt'),'Campus fragments are absent from release-coherent boot paths.');
assert(override.includes('webmanifest|txt'),'Text source fragments are excluded from release coherence.');

let cachedCalls=0;
let fetchCalls=0;
let runtimeWrites=0;
let networkAvailable=true;
const cachedResponse=(type='application/javascript')=>new Response('cached',{status:200,headers:{'content-type':type}});
const sandbox={
  URL,
  Request,
  Response,
  Headers,
  self:{},
  cacheFirst:async request=>{cachedCalls+=1;const type=new URL(request.url).pathname.endsWith('.txt')?'text/plain':'application/javascript';return cachedResponse(type)},
  withTimeout:promise=>promise,
  fetch:async request=>{
    fetchCalls+=1;
    if(!networkAvailable)throw new Error('offline');
    const pathname=new URL(request.url).pathname;
    const type=pathname.endsWith('.css')?'text/css':pathname.endsWith('.txt')?'text/plain':'application/javascript';
    return new Response('fresh',{status:200,headers:{'content-type':type}});
  },
  responseLooksValid:response=>Boolean(response?.ok),
  caches:{open:async()=>({put:async()=>{runtimeWrites+=1}})},
  RUNTIME_CACHE:'civweave-runtime-test',
  cacheKey:pathname=>pathname,
  console
};
vm.createContext(sandbox);
vm.runInContext(override,sandbox,{filename:'service-worker-release-coherence-v220.js'});

const fresh=await sandbox.cacheFirst(new Request('https://civweave.invalid/app/install-boundary-v146.js?v=chat-convergence-v250'));
assert.equal(await fresh.text(),'fresh','Version-pinned boot code did not prefer the network.');
assert.equal(fetchCalls,1);
assert.equal(cachedCalls,0);
assert.equal(runtimeWrites,1);

const fragment=await sandbox.cacheFirst(new Request('https://civweave.invalid/app/working-campus-v156.part1.txt?revision=canonical-campus-startup-v227'));
assert.equal(await fragment.text(),'fresh','Version-pinned campus fragment did not prefer the network.');
assert.equal(fetchCalls,2);
assert.equal(cachedCalls,0);
assert.equal(runtimeWrites,2);

const image=await sandbox.cacheFirst(new Request('https://civweave.invalid/app/logos/civweave-icon-192.png?v=1.0.13'));
assert.equal(await image.text(),'cached','Images should retain the cache-first offline path.');
assert.equal(cachedCalls,1);

networkAvailable=false;
const fallback=await sandbox.cacheFirst(new Request('https://civweave.invalid/app/working-campus-v156.part2.txt?revision=canonical-campus-startup-v227'));
assert.equal(await fallback.text(),'cached','Version-pinned campus fragment did not fall back to cache while offline.');
assert.equal(cachedCalls,2);
assert.equal(sandbox.self.CivweaveReleaseCoherenceV220?.policy,'version-pinned-html-js-css-json-txt-network-first-cached-fallback');

console.log(JSON.stringify({
  ok:true,
  revision:'release-coherence-v226-v283-local-first-entry',
  installedEntryBoot:'local-first-no-host-gate',
  explicitUpdateHelper:'bounded-no-store-v250-refresh',
  cloudflareVersionSync:true,
  renderLocalVersionSync:true,
  versionedTextAndCampusFragments:'network-first-cached-fallback',
  images:'cache-first'
},null,2));
