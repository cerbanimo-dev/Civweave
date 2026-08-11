import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [versionText,builder,versionSync,coherenceSync,installedEntry,installedLaunch,installerFallback,manifestText,shellRepair,wrapper]=await Promise.all([
  read('VERSION'),read('scripts/build-service-worker-v211.mjs'),read('scripts/sync-release-version-assets.mjs'),read('scripts/sync-release-coherence-v220.mjs'),read('public/app/installed-entry-v146.js'),read('public/service-worker-installed-launch-v282.js'),read('public/app/installer-online-fallback-v225.js'),read('public/app/manifest.webmanifest'),read('public/service-worker-shell-repair-v225.js'),read('public/service-worker-v203.js')
]);
const version=versionText.trim();
const manifest=JSON.parse(manifestText);
new Function(installedEntry);
new Function(installedLaunch);
new Function(installerFallback);
for(const token of[
  "importScripts('/app/system-routes-v227.js?v=${version}-five-system-route-contract-v227')",
  "importScripts('/service-worker-core-v208.js?v=${version}-chat-convergence-v250')",
  "importScripts('/service-worker-installed-launch-v282.js?v=installed-pwa-launch-v294-campus-recovery')",
  "importScripts('/service-worker-installer-state-v280.js?v=installer-state-machines-v280')",
  "importScripts('/service-worker-shell-integrity-v281.js?v=shell-integrity-v281')",
  "importScripts('/service-worker-offline-v211-override.js?v=offline-campus-current-graph-v280&policy=resumable-pause-v280')",
  "importScripts('/service-worker-canonical-navigation-v227.js?v=canonical-five-system-navigation-v227')",
  'canonicalNavigationFinalPolicy:true',
  'routeContractFirst:true'
])assert(builder.includes(token),`Worker builder is missing ${token}.`);
assert(builder.indexOf('/app/system-routes-v227.js')<builder.indexOf('/service-worker-core-v208.js'),'Worker builder no longer places route contract first.');
assert(builder.indexOf('/service-worker-core-v208.js')<builder.indexOf('/service-worker-installed-launch-v282.js'),'Installed launch boundary must follow the retained core.');
assert(builder.indexOf('/service-worker-installed-launch-v282.js')<builder.indexOf('/service-worker-installer-state-v280.js'),'Installed launch boundary must be active before installer state and navigation wrappers.');
assert(builder.indexOf('/service-worker-core-v208.js')<builder.indexOf('/service-worker-installer-state-v280.js'),'Worker builder no longer extends the core with installer state before integrity.');
assert(builder.indexOf('/service-worker-installer-state-v280.js')<builder.indexOf('/service-worker-shell-integrity-v281.js'),'Worker builder no longer hashes the final required shell asset set.');
assert(builder.indexOf('/service-worker-shell-integrity-v281.js')<builder.indexOf('/service-worker-offline-v211-override.js'),'Worker builder no longer establishes shell integrity before campus downloads.');
assert(builder.lastIndexOf('/service-worker-canonical-navigation-v227.js')>builder.lastIndexOf('/service-worker-shell-repair-v225.js'),'Worker builder no longer places canonical navigation after shell repair.');
for(const token of["await patch('public/app/system-routes-v227.js'","await patch('public/app/themed-system-nav-v178.js'","await patch('public/app/working-campus-v156.js'","await patch('public/app/working-campus-v156.part4.txt'",'worker route contract revision'])assert(versionSync.includes(token),`Release version synchronizer is missing ${token}.`);
for(const token of["const chatRevision='chat-convergence-v250'","const boundaryRevision='chat-convergence-v250'","const routeRevision='five-system-route-contract-v227'","const offlineRevision='offline-campus-current-graph-v280'","const offlinePolicy='resumable-pause-v280'","canonicalPolicy:'five-system-first-class-routes-v242-canonical-chat-owner'","guideWorkspaceRevision:'v250-v242-canonical-owner'",'canonicalSystemCount:5','Canonical navigation must remain the final navigation policy.'])assert(coherenceSync.includes(token),`Release coherence synchronizer is missing ${token}.`);
assert(!coherenceSync.includes("const boundaryRevision='five-system-boundary-v227'"),'Release coherence can still restore the pre-v250 boundary.');
assert(!coherenceSync.includes("const boundaryRevision='canonical-core-only-v226'"),'Release coherence can still downgrade the boundary.');
assert(coherenceSync.includes("for(const retired of ['PERSISTENT_GUIDE_CHAT_SCRIPT','PERSISTENT_GUIDE_VIEWPORT_SCRIPT','/app/persistent-guide-chat-v215.js','/app/persistent-guide-viewport-v216.js'])if(source.includes(retired))"),'Release coherence no longer rejects retired canonical chat owners.');
assert(coherenceSync.includes("await patch('public/service-worker.js'"),'Release coherence no longer removes retired chat assets from the legacy mobile-core manifest.');
assert(installedEntry.includes('CivweaveSystemRoutesV227'),'Compatibility launcher does not use the route contract.');
assert(installedEntry.includes('routes.urlFor'),'Compatibility launcher bypasses canonical URL construction.');
assert(installedEntry.includes("updateViaCache:'none'")&&installedEntry.includes('await registration.update()'),'Updater-first entry no longer refreshes the worker before routing.');
assert(!installedEntry.includes('const sites={'),'Compatibility launcher reintroduced a duplicate route map.');
assert.equal(new URL(manifest.start_url,'https://civweave.invalid').pathname,'/app/installed-entry-v146.html','PWA manifest no longer launches through the installed bootstrap.');
assert(installedLaunch.includes("const V282_ENTRY_PATH='/app/installed-entry-v146.html'"),'Worker launch boundary no longer serves the installed bootstrap.');
assert(installedLaunch.includes("const V282_CAMPUS_PATH='/app/working-campus-v156.html'"),'Worker launch boundary lost the Working Campus recovery path.');
assert(installedLaunch.includes("policy:'installed-entry-then-working-campus-never-installer-substitution'"),'Worker launch boundary can regress to installer substitution or lose campus recovery.');
assert(shellRepair.includes("const V225_OPTIONAL_ASSETS = ['/app/installer-online-fallback-v225.js']"),'Installer launch guard is no longer retained in the offline shell cache lane.');
assert(installerFallback.includes("url = new URL('/app/installed-entry-v146.html'"),'Installed Open button no longer targets the installed bootstrap.');
assert(installerFallback.includes('if (installedDisplay())')&&installerFallback.includes('event.stopImmediatePropagation()'),'Installed Open button no longer preempts the legacy /app/ click handler.');
assert(wrapper.indexOf('/app/system-routes-v227.js')<wrapper.indexOf('/service-worker-core-v208.js'),'Checked-in worker wrapper does not load route contract first.');
assert(wrapper.indexOf('/service-worker-core-v208.js')<wrapper.indexOf('/service-worker-installed-launch-v282.js'),'Checked-in worker wrapper does not load installed launch after the core.');
assert(wrapper.includes("/service-worker-installed-launch-v282.js?v=installed-pwa-launch-v294-campus-recovery"),'Checked-in worker wrapper lost the v294 installed launch cache-bust.');
assert(wrapper.indexOf('/service-worker-installed-launch-v282.js')<wrapper.indexOf('/service-worker-navigation-safety-v224.js'),'Navigation safety must wrap the corrected installed launch handler.');
assert(wrapper.indexOf('/service-worker-core-v208.js')<wrapper.indexOf('/service-worker-installer-state-v280.js'),'Checked-in worker wrapper does not load installer state after the core.');
assert(wrapper.indexOf('/service-worker-installer-state-v280.js')<wrapper.indexOf('/service-worker-shell-integrity-v281.js'),'Checked-in worker wrapper does not load shell integrity after finalizing required assets.');
assert(wrapper.indexOf('/service-worker-canonical-navigation-v227.js')>wrapper.indexOf('/service-worker-shell-repair-v225.js'),'Checked-in worker wrapper does not load canonical navigation after shell repair.');
assert(wrapper.includes("/service-worker-chat-repair-v245.js?v=chat-convergence-v250"),'Checked-in worker wrapper lost the v250 stale-chat migration lane.');
console.log(JSON.stringify({ok:true,version,revision:'navigation-generator-invariants-v294',singleRouteAuthority:true,builderRouteFirst:true,builderIntegrityOrder:true,builderCanonicalAfterRepair:true,coherenceCannotDowngrade:true,coherenceCannotRestoreRetiredChatOwners:true,compatibilityLauncherUsesContract:true,updaterFirstEntry:true,installedLaunchCampusRecovery:true,installedLaunchNeverInstaller:true,installerOpenPreempted:true,installerGuardOfflineCached:true,moduleSyntaxCheckedByWorkflow:true},null,2));
