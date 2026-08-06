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
  "importScripts('/service-worker-core-v208.js?v=${version}-lightweight-shell-v208-retained-v218')",
  "importScripts('/service-worker-canonical-navigation-v227.js?v=canonical-five-system-navigation-v227')",
  'canonicalNavigationFinal:true',
  'routeContractFirst:true'
])assert(builder.includes(token),`Worker builder is missing ${token}.`);
assert(builder.indexOf('/app/system-routes-v227.js')<builder.indexOf('/service-worker-core-v208.js'),'Worker builder no longer places route contract first.');
assert(builder.lastIndexOf('/service-worker-canonical-navigation-v227.js')>builder.lastIndexOf('/service-worker-shell-repair-v225.js'),'Worker builder no longer places canonical navigation last.');
for(const token of ["await patch('public/app/system-routes-v227.js'","await patch('public/app/themed-system-nav-v178.js'","await patch('public/app/working-campus-v156.js'","await patch('public/app/working-campus-v156.part4.txt'",'worker route contract revision'])assert(versionSync.includes(token),`Release version synchronizer is missing ${token}.`);
for(const token of ["const boundaryRevision='five-system-boundary-v227'","const routeRevision='five-system-route-contract-v227'","canonicalPolicy:'five-system-first-class-routes-civweave-core-only'",'canonicalSystemCount:5','Canonical navigation must remain the final worker policy'])assert(coherenceSync.includes(token),`Release coherence synchronizer is missing ${token}.`);
assert(!coherenceSync.includes("const boundaryRevision='canonical-core-only-v226'"),'Release coherence can still downgrade the boundary.');
assert(installedEntry.includes('CivweaveSystemRoutesV227'),'Compatibility launcher does not use the route contract.');
assert(installedEntry.includes('routes.urlFor'),'Compatibility launcher bypasses canonical URL construction.');
assert(!installedEntry.includes('const sites={'),'Compatibility launcher reintroduced a duplicate route map.');
assert(wrapper.indexOf('/app/system-routes-v227.js')<wrapper.indexOf('/service-worker-core-v208.js'),'Checked-in worker wrapper does not load route contract first.');
assert(wrapper.indexOf('/service-worker-canonical-navigation-v227.js')>wrapper.indexOf('/service-worker-shell-repair-v225.js'),'Checked-in worker wrapper does not load canonical navigation last.');
console.log(JSON.stringify({ok:true,version,revision:'navigation-generator-invariants-v227',singleRouteAuthority:true,builderRouteFirst:true,builderCanonicalLast:true,coherenceCannotDowngrade:true,compatibilityLauncherUsesContract:true,moduleSyntaxCheckedByWorkflow:true},null,2));
