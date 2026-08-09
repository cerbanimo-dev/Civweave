import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [versionText,builder,versionSync,coherenceSync,installedEntry,wrapper]=await Promise.all([
  read('VERSION'),read('scripts/build-service-worker-v211.mjs'),read('scripts/sync-release-version-assets.mjs'),read('scripts/sync-release-coherence-v220.mjs'),read('public/app/installed-entry-v146.js'),read('public/service-worker-v203.js')
]);
const version=versionText.trim();
new Function(installedEntry);
for(const token of [
  "importScripts('/app/system-routes-v227.js?v=${version}-five-system-route-contract-v227')",
  "importScripts('/service-worker-offline-runtime-boundary-v266.js?v=${version}-downloaded-runtime-v266')",
  "importScripts('/service-worker-core-v208.js?v=${version}-chat-convergence-v250')",
  "importScripts('/service-worker-campus-completion-v246.js?v=campus-retired-completion-v246')",
  "importScripts('/service-worker-canonical-navigation-v227.js?v=canonical-package-navigation-v266')",
  "importScripts('/service-worker-chat-repair-v245.js?v=chat-convergence-v250')",
  'downloadedRuntimeBoundary:\'v266-before-core\'',
  "canonicalRuntime:'package-only-no-live-fallback'",
  'canonicalNavigationFinal:true',
  'routeContractFirst:true'
])assert(builder.includes(token),`Worker builder is missing ${token}.`);
assert(builder.indexOf('/app/system-routes-v227.js')<builder.indexOf('/service-worker-offline-runtime-boundary-v266.js'),'Worker builder must load route identity before downloaded-runtime boundary.');
assert(builder.indexOf('/service-worker-offline-runtime-boundary-v266.js')<builder.indexOf('/service-worker-core-v208.js'),'Worker builder must place downloaded-runtime boundary before general core fetch handling.');
assert(builder.lastIndexOf('/service-worker-canonical-navigation-v227.js')>builder.lastIndexOf('/service-worker-shell-repair-v225.js'),'Worker builder no longer places canonical navigation after generic shell repair.');
for(const token of ["await patch('public/app/system-routes-v227.js'","await patch('public/app/themed-system-nav-v178.js'","await patch('public/app/working-campus-v156.js'","await patch('public/app/working-campus-v156.part4.txt'","await patch('public/service-worker-offline-runtime-boundary-v266.js'",'worker route contract revision','Downloaded runtime boundary must load before the general service-worker core.'])assert(versionSync.includes(token),`Release version synchronizer is missing ${token}.`);
for(const token of [
  "const chatRevision='chat-convergence-v250'",
  "const boundaryRevision='chat-convergence-v250'",
  "const routeRevision='five-system-route-contract-v227'",
  "const runtimeRevision='downloaded-runtime-boundary-v266'",
  "const runtimeWorkerCacheRevision='downloaded-runtime-v266'",
  "const canonicalRuntimeRevision='canonical-package-navigation-v266'",
  "canonicalPolicy:'five-system-first-class-routes-v242-canonical-chat-owner'",
  "runtimeCanonicalPolicy:'five-system-first-class-routes-v266-downloaded-runtime-only'",
  "guideWorkspaceRevision:'v250-v242-canonical-owner'",
  'canonicalSystemCount:5',
  'Canonical navigation must remain the final navigation policy.',
  'Canonical runtime navigation contains a live network fetch.'
])assert(coherenceSync.includes(token),`Release coherence synchronizer is missing ${token}.`);
assert(!coherenceSync.includes("const boundaryRevision='five-system-boundary-v227'"),'Release coherence can still restore the pre-v250 boundary.');
assert(!coherenceSync.includes("const boundaryRevision='canonical-core-only-v226'"),'Release coherence can still downgrade the boundary.');
assert(coherenceSync.includes("if(experience.includes('PERSISTENT_GUIDE_CHAT_SCRIPT')||experience.includes('PERSISTENT_GUIDE_VIEWPORT_SCRIPT'))"),'Release coherence no longer rejects retired canonical chat owners.');
assert(installedEntry.includes('CivweaveSystemRoutesV227'),'Compatibility launcher does not use the route contract.');
assert(installedEntry.includes('routes.urlFor'),'Compatibility launcher bypasses canonical URL construction.');
assert(installedEntry.includes("updateViaCache:'none'")&&installedEntry.includes('await registration.update()'),'Updater-first entry no longer refreshes the worker before routing.');
assert(!installedEntry.includes('const sites={'),'Compatibility launcher reintroduced a duplicate route map.');
assert(wrapper.indexOf('/app/system-routes-v227.js')<wrapper.indexOf('/service-worker-offline-runtime-boundary-v266.js'),'Checked-in worker wrapper no longer loads route identity before runtime boundary.');
assert(wrapper.indexOf('/service-worker-offline-runtime-boundary-v266.js')<wrapper.indexOf('/service-worker-core-v208.js'),'Checked-in worker wrapper no longer protects canonical runtime before generic fetch handling.');
assert(wrapper.indexOf('/service-worker-canonical-navigation-v227.js')>wrapper.indexOf('/service-worker-shell-repair-v225.js'),'Checked-in worker wrapper does not load canonical navigation after generic shell repair.');
assert(wrapper.includes("/service-worker-chat-repair-v245.js?v=chat-convergence-v250"),'Checked-in worker wrapper lost the v250 stale-chat migration lane.');
console.log(JSON.stringify({ok:true,version,revision:'navigation-generator-invariants-v266-downloaded-runtime',singleRouteAuthority:true,builderRouteFirst:true,builderRuntimeBoundaryBeforeCore:true,builderCanonicalLast:true,builderPackageOnlyCanonical:true,coherenceCannotDowngrade:true,coherenceCannotRestoreRetiredChatOwners:true,coherenceRejectsLiveCanonicalFetch:true,compatibilityLauncherUsesContract:true,updaterFirstEntry:true,moduleSyntaxCheckedByWorkflow:true},null,2));
