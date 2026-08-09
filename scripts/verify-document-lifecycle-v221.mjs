import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await import('./sync-release-version-assets.mjs');
await import('./sync-release-coherence-v220.mjs');
const read=relative=>readFile(path.join(root,relative),'utf8');
const [manifestText,installedEntry,campusHtml,campusLoader,campusPart4,lifecycle,installBoundary,routes,additions,workerCore,releaseCoherence,wrapper,offlineRuntime,canonicalNavigation]=await Promise.all([
  read('public/app/manifest.webmanifest'),
  read('public/app/installed-entry-v146.js'),
  read('public/app/working-campus-v156.html'),
  read('public/app/working-campus-v156.js'),
  read('public/app/working-campus-v156.part4.txt'),
  read('public/app/document-lifecycle-v221.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/system-routes-v227.js'),
  read('public/extensions/civweave-additions-v156.js'),
  read('public/service-worker-core-v208.js'),
  read('public/service-worker-release-coherence-v220.js'),
  read('public/service-worker-v203.js'),
  read('public/service-worker-offline-runtime-boundary-v266.js'),
  read('public/service-worker-canonical-navigation-v227.js')
]);
const manifest=JSON.parse(manifestText);
assert.equal(manifest.start_url,'/app/installed-entry-v146.html?installed=1','Installed PWA no longer enters the updater-first launch boundary.');
assert(installedEntry.includes("fetch(`/app/manifest.webmanifest?boot=${Date.now()}`,{cache:'no-store'})"),'Installed entry no longer resolves the current release without cache.');
assert(installedEntry.includes("updateViaCache:'none'")&&installedEntry.includes('await registration.update()'),'Installed entry no longer refreshes the worker before routing.');
assert(installedEntry.includes("candidate.postMessage({type:'SKIP_WAITING'})")&&installedEntry.indexOf('await refreshWorker(releaseVersion)')<installedEntry.indexOf('const requested='),'Installed entry no longer activates the refreshed worker before route selection.');
assert(campusHtml.indexOf('/app/document-lifecycle-v221.js')<campusHtml.indexOf('/app/install-boundary-v146.js'),'Lifecycle guard must load before boundary.');
assert(campusHtml.includes('/app/document-lifecycle-v221.js?v=document-lifecycle-v222'),'Working Campus lifecycle revision is stale.');
assert(campusHtml.includes('/app/install-boundary-v146.js?v=chat-convergence-v250'),'Working Campus boundary revision is stale.');
assert(campusHtml.includes('/app/working-campus-v156.js?v=canonical-campus-startup-v227'),'Working Campus loader revision is stale.');
for(const token of ["cache:'no-store'","redirect:'follow'","'x-civweave-package':'working-campus-v227'",'Promise.all(parts.map(fetchPart))','campusReady()','ensureRouteContract','civweave:working-campus-runtime-ready','document.documentElement===bootDocument','location.href===bootUrl',"policy:'canonical-core-only-five-system-routing'"])assert(campusLoader.includes(token),`Working Campus loader is missing ${token}.`);
assert(!campusLoader.includes("cache:'force-cache'"),'Working Campus forces stale fragments.');
for(const token of ["['/app/working-campus-v156.html','civweave']","['/app/cabinets/living-school/index.html','living-school']","['/app/realm-console-v140.html','cerbanimo']","['/app/fellowfare-cabinet-v144.html','fellowfare']","['/app/anarchadia-console-v139.html','anarchadia']","root.dataset.civweaveCanonicalCore='only'","canonicalPolicy:'five-system-first-class-routes-v242-canonical-chat-owner'","runtimeCanonicalPolicy:'five-system-first-class-routes-v266-downloaded-runtime-only'","runtimeSourcePolicy:'current-downloaded-package-never-live-site-fallback'",'canonicalSystemCount:5','canonicalAutoScripts:0',"guideWorkspaceRevision:'v250-v242-canonical-owner'"])assert(installBoundary.includes(token),`Install boundary is missing ${token}.`);
const experienceStart=installBoundary.indexOf('const SYSTEM_EXPERIENCE_SCRIPTS=['),experienceEnd=installBoundary.indexOf('];',experienceStart),experience=installBoundary.slice(experienceStart,experienceEnd);
assert(experience.includes('GUIDE_WORKSPACE'),'Canonical boundary no longer boots the v242 workspace.');
assert(!experience.includes('PERSISTENT_GUIDE_CHAT_SCRIPT')&&!experience.includes('PERSISTENT_GUIDE_VIEWPORT_SCRIPT'),'Canonical boundary restored a retired chat owner.');
assert(!installBoundary.includes('function startAdditions()'),'Boundary contains delayed automatic additions.');
const startBlock=installBoundary.match(/function start\(\)\{[\s\S]*?\n\}\n\nstart\(\);/)?.[0]||'';
const additionCall=startBlock.includes('installAdditionsWhenReady();')?'installAdditionsWhenReady();':'installAdditions();';
assert(startBlock.includes("if(system==='civweave'){"),'Install boundary start() is missing the Civweave short-circuit.');
assert(startBlock.includes(additionCall),'Install boundary start() is missing the realm additions handoff.');
assert(startBlock.indexOf("if(system==='civweave'){")<startBlock.indexOf(additionCall),'Civweave short-circuit occurs after realm additions.');
for(const pathname of ['/app/working-campus-v156.html','/app/cabinets/living-school/index.html','/app/realm-console-v140.html','/app/fellowfare-cabinet-v144.html','/app/anarchadia-console-v139.html'])assert(routes.includes(`pathname:'${pathname}'`),`Route contract is missing ${pathname}.`);
assert(routes.includes('intrinsicAuthorization:false'),'Route contract no longer proves pathname recognition is non-authorizing.');
assert(campusPart4.includes('CivweaveSystemRoutesV227')&&campusPart4.includes('routes.navigate(id'),'Working Campus realm travel bypasses the route contract.');
for(const token of ['document-lifecycle-v222','CivweaveLifecycleMutationObserver',"addEventListener('pagehide',stop"])assert(lifecycle.includes(token),`Lifecycle guard is missing ${token}.`);
assert(!lifecycle.includes("Object.defineProperty(document,'head'")&&!lifecycle.includes("Object.defineProperty(document,'body'"),'Lifecycle guard overrides native document structure.');
assert(additions.includes('civweaveAdditionsNavigating'),'Shared additions do not track navigation teardown.');
assert(!additions.includes('Document navigation interrupted script loading.'),'Shared additions emit the reported navigation error.');
assert(workerCore.includes("'/app/document-lifecycle-v221.js'"),'Lifecycle guard is absent from shell.');
const installBlock=workerCore.match(/self\.addEventListener\('install',[\s\S]*?\n\}\);/)?.[0]||'';
assert(installBlock.includes('event.waitUntil(cacheShell())'),'Worker install does not cache shell.');
assert(!installBlock.includes('skipWaiting'),'Core worker takes over active pages during its own install instead of leaving activation to the v250 wrapper.');
for(const token of ['release-coherence-v226','working-campus-v156.part5.txt','version-pinned-html-js-css-json-txt-network-first-cached-fallback'])assert(releaseCoherence.includes(token),`Release coherence is missing ${token}.`);
assert(wrapper.includes('/service-worker-chat-repair-v245.js?v=chat-convergence-v250'),'Worker wrapper lost the v250 stale-chat migration lane.');
assert(wrapper.includes("self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting())})"),'v250 worker wrapper no longer activates the convergence worker promptly.');
assert(wrapper.indexOf('/app/system-routes-v227.js')<wrapper.indexOf('/service-worker-offline-runtime-boundary-v266.js'),'Worker route contract must load before downloaded-runtime boundary.');
assert(wrapper.indexOf('/service-worker-offline-runtime-boundary-v266.js')<wrapper.indexOf('/service-worker-core-v208.js'),'Downloaded-runtime boundary must protect canonical requests before generic core handling.');
assert(wrapper.indexOf('/service-worker-canonical-navigation-v227.js')>wrapper.indexOf('/service-worker-shell-repair-v225.js'),'Canonical navigation is not final.');
for(const token of ['canonical-runtime-current-downloaded-package-only-no-live-site-fallback',"headers.set('x-civweave-runtime-source','downloaded-package')",'event.stopImmediatePropagation()','package-miss'])assert(offlineRuntime.includes(token),`Downloaded-runtime boundary is missing ${token}.`);
for(const token of ["'x-civweave-package':REVISION",'exact-route-current-package-first-no-live-network-runtime-fallback','runtimeNetworkFallback:false',"canonicalHandler:'packageOnlyCanonical'",'async function packageOnlyCanonical(request)'])assert(canonicalNavigation.includes(token),`Canonical worker navigation contract is missing ${token}.`);
const handlerStart=canonicalNavigation.indexOf('async function packageOnlyCanonical(request)'),handlerEnd=canonicalNavigation.indexOf("self.addEventListener('install'",handlerStart),canonicalHandler=canonicalNavigation.slice(handlerStart,handlerEnd);
assert(canonicalHandler.length>0&&!canonicalHandler.includes('fetch(')&&!canonicalHandler.includes('originalNetworkFirst'),'Canonical package-only navigation can still reach the hosted network.');
for(const [name,source] of [['installed entry',installedEntry],['campus loader',campusLoader],['lifecycle guard',lifecycle],['install boundary',installBoundary],['route contract',routes],['shared additions',additions],['release coherence',releaseCoherence],['offline runtime boundary',offlineRuntime],['canonical navigation',canonicalNavigation]])assert.doesNotThrow(()=>new vm.Script(source,{filename:name}),`${name} does not compile.`);
console.log(JSON.stringify({ok:true,revision:'canonical-campus-startup-v227-v266-downloaded-runtime',updaterFirstStart:true,directCampusStart:false,canonicalSystems:5,canonicalChatOwner:'guide-workspace-v242',civweaveCoreOnly:true,navigationErrorsSilent:true,campusFragmentsNetworkFirstDuringPackagePreparation:true,packageAuthenticatedNavigation:true,canonicalRuntime:'downloaded-package-only',canonicalNetworkFallback:false,canonicalHandler:'packageOnlyCanonical',nonInterruptingCoreWorker:true,v250WrapperActivation:true},null,2));
