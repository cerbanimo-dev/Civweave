import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await import('./sync-release-version-assets.mjs');
await import('./sync-release-coherence-v220.mjs');
const read=relative=>readFile(path.join(root,relative),'utf8');
const [manifestText,campusHtml,campusLoader,lifecycle,installBoundary,additions,workerCore,releaseCoherence,wrapper]=await Promise.all([
  read('public/app/manifest.webmanifest'),
  read('public/app/working-campus-v156.html'),
  read('public/app/working-campus-v156.js'),
  read('public/app/document-lifecycle-v221.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/extensions/commonweave-additions-v156.js'),
  read('public/service-worker-core-v208.js'),
  read('public/service-worker-release-coherence-v220.js'),
  read('public/service-worker-v203.js')
]);

const manifest=JSON.parse(manifestText);
assert.match(manifest.start_url,/^\/app\/working-campus-v156\.html\?/,'Installed PWA still starts on the empty /app/ launcher.');
assert(campusHtml.indexOf('/app/document-lifecycle-v221.js')<campusHtml.indexOf('/app/install-boundary-v146.js'),'Lifecycle guard must load before the install boundary.');
assert(campusHtml.includes('/app/document-lifecycle-v221.js?v=document-lifecycle-v222'),'Working Campus does not request the safe lifecycle revision.');
assert(campusHtml.includes('/app/install-boundary-v146.js?v=canonical-core-only-v226'),'Working Campus does not request the core-only boundary revision.');
assert(campusHtml.includes('/app/working-campus-v156.js?v=canonical-campus-startup-v226'),'Working Campus does not request the v226 loader revision.');

assert(campusLoader.includes("cache:'no-store'"),'Working Campus fragments are not fetched fresh.');
assert(campusLoader.includes("redirect:'follow'"),'Working Campus fragments do not follow host redirects internally.');
assert(!campusLoader.includes("cache:'force-cache'"),'Working Campus still forces stale fragment cache.');
for(const token of ['Promise.all(parts.map(fetchPart))','campusReady()','commonweave:working-campus-runtime-ready','document.documentElement===bootDocument','location.href===bootUrl',"policy:'canonical-core-only'"])assert(campusLoader.includes(token),`Working Campus loader is missing ${token}.`);

for(const token of [
  "location.pathname==='/app/working-campus-v156.html'",
  "root.dataset.commonweaveCanonicalCore='only'",
  "canonicalPolicy:'core-only-no-global-additions-no-redirect'",
  'canonicalAutoScripts:0'
])assert(installBoundary.includes(token),`Install boundary is missing ${token}.`);
assert(!installBoundary.includes('function startAdditions()'),'Canonical boundary still contains delayed automatic additions.');
assert(installBoundary.indexOf("if(canonicalAppSurface()){")<installBoundary.indexOf('installAdditions();'),'Canonical short-circuit does not occur before legacy additions.');

for(const token of ['document-lifecycle-v222','CommonweaveLifecycleMutationObserver',"addEventListener('pagehide',stop"]){assert(lifecycle.includes(token),`Document lifecycle guard is missing ${token}.`)}
assert(!lifecycle.includes("Object.defineProperty(document,'head'")&&!lifecycle.includes("Object.defineProperty(document,'body'"),'Lifecycle guard still overrides native document structure.');

assert(additions.includes('commonweaveAdditionsNavigating'),'Shared additions do not track navigation teardown.');
assert(!additions.includes('Document navigation interrupted script loading.'),'Shared additions still emit the reported navigation interruption error.');
assert(additions.includes('document.body?.append(tools)')&&additions.includes('document.body?.append(dialog)'),'Shared additions still require a live body during teardown.');

assert(workerCore.includes("'/app/document-lifecycle-v221.js'"),'Lifecycle guard is missing from the required app shell.');
const installBlock=workerCore.match(/self\.addEventListener\('install',[\s\S]*?\n\}\);/)?.[0]||'';
assert(installBlock.includes('event.waitUntil(cacheShell())'),'Service worker install does not cache the shell.');
assert(!installBlock.includes('skipWaiting'),'Service worker still takes over active pages during installation.');
assert(workerCore.includes("if (type === 'SKIP_WAITING')"),'Explicit update activation message was removed.');

for(const token of ['release-coherence-v226','working-campus-v156.part5.txt','version-pinned-html-js-css-json-txt-network-first-cached-fallback'])assert(releaseCoherence.includes(token),`Release coherence is missing ${token}.`);
assert(wrapper.includes('/service-worker-release-coherence-v220.js?v=release-coherence-v226'),'Active worker does not import release coherence v226.');

for(const [name,source] of [['campus loader',campusLoader],['lifecycle guard',lifecycle],['install boundary',installBoundary],['shared additions',additions],['release coherence',releaseCoherence]])assert.doesNotThrow(()=>new vm.Script(source,{filename:name}),`${name} does not compile after startup synchronization.`);

console.log(JSON.stringify({
  ok:true,
  revision:'canonical-campus-startup-v226',
  directCampusStart:true,
  canonicalCoreOnly:true,
  canonicalAutoScripts:0,
  navigationErrorsSilent:true,
  campusFragmentsNetworkFirst:true,
  nonInterruptingWorker:true
},null,2));
