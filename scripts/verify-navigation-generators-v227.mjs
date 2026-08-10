import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [versionText,builder,versionSync,coherenceSync,installedEntry,installedLaunch,installerFallback,manifestText,shellRepair,wrapper,codeCoherence]=await Promise.all([
  read('VERSION'),read('scripts/build-service-worker-v211.mjs'),read('scripts/sync-release-version-assets.mjs'),read('scripts/sync-release-coherence-v220.mjs'),read('public/app/installed-entry-v146.js'),read('public/service-worker-installed-launch-v282.js'),read('public/app/installer-online-fallback-v225.js'),read('public/app/manifest.webmanifest'),read('public/service-worker-shell-repair-v225.js'),read('public/service-worker-v203.js'),read('public/service-worker-code-coherence-v288.js')
]);
const version=versionText.trim(),manifest=JSON.parse(manifestText);
new Function(installedEntry);new Function(installedLaunch);new Function(installerFallback);
for(const token of[
  "importScripts('/app/system-routes-v227.js?v=${version}-five-system-route-contract-v227')",
  "importScripts('/service-worker-code-coherence-v288.js?v=1.0.91-code-coherence-v288')",
  "importScripts('/service-worker-core-v208.js?v=${version}-chat-convergence-v250')",
  "importScripts('/service-worker-installed-launch-v282.js?v=installed-pwa-launch-v282')",
  "importScripts('/service-worker-installer-state-v280.js?v=installer-state-machines-v280')",
  "importScripts('/service-worker-shell-integrity-v281.js?v=shell-integrity-v281')",
  "importScripts('/service-worker-offline-v211-override.js?v=offline-campus-current-graph-v280&policy=resumable-pause-v280')",
  "importScripts('/service-worker-canonical-navigation-v227.js?v=canonical-five-system-navigation-v227')",
  'canonicalNavigationFinalPolicy:true','routeContractFirst:true'
])assert(builder.includes(token),`Worker builder is missing ${token}.`);
assert(builder.indexOf('/app/system-routes-v227.js')<builder.indexOf('/service-worker-code-coherence-v288.js'),'Worker builder no longer loads route identity before executable coherence.');
assert(builder.indexOf('/service-worker-code-coherence-v288.js')<builder.indexOf('/service-worker-core-v208.js'),'Code coherence must own executable requests before generic core caching.');
assert(builder.indexOf('/service-worker-core-v208.js')<builder.indexOf('/service-worker-installed-launch-v282.js'),'Installed launch boundary must follow the retained core.');
assert(builder.indexOf('/service-worker-installed-launch-v282.js')<builder.indexOf('/service-worker-installer-state-v280.js'),'Installed launch boundary must be active before installer state and navigation wrappers.');
assert(builder.indexOf('/service-worker-installer-state-v280.js')<builder.indexOf('/service-worker-shell-integrity-v281.js'),'Worker builder no longer hashes the final required shell asset set.');
assert(builder.lastIndexOf('/service-worker-canonical-navigation-v227.js')>builder.lastIndexOf('/service-worker-shell-repair-v225.js'),'Worker builder no longer places canonical navigation after shell repair.');
for(const token of["await patch('public/app/system-routes-v227.js'","await patch('public/app/themed-system-nav-v178.js'","await patch('public/app/working-campus-v156.js'","await patch('public/app/working-campus-v156.part4.txt'",'worker route contract revision','code-coherence-v288'])assert(versionSync.includes(token),`Release version synchronizer is missing ${token}.`);
for(const token of["const chatRevision='chat-convergence-v250'","const boundaryRevision='chat-convergence-v250'","const routeRevision='five-system-route-contract-v227'","const offlineRevision='offline-campus-current-graph-v280'","const offlinePolicy='resumable-pause-v280'","canonicalPolicy:'five-system-first-class-routes-v242-canonical-chat-owner'","guideWorkspaceRevision:'v250-v242-canonical-owner'",'canonicalSystemCount:5','Canonical navigation must remain the final navigation policy.'])assert(coherenceSync.includes(token),`Release coherence synchronizer is missing ${token}.`);
assert(!coherenceSync.includes("const boundaryRevision='five-system-boundary-v227'"),'Release coherence can still restore the pre-v250 boundary.');
assert(!coherenceSync.includes("const boundaryRevision='canonical-core-only-v226'"),'Release coherence can still downgrade the boundary.');
assert(coherenceSync.includes("if(experience.includes('PERSISTENT_GUIDE_CHAT_SCRIPT')||experience.includes('PERSISTENT_GUIDE_VIEWPORT_SCRIPT'))"),'Release coherence no longer rejects retired canonical chat owners.');

const bootBlock=installedEntry.match(/function boot\(\)\{[\s\S]*?\n\}/)?.[0]||'';
for(const token of ["const LOCAL_ROUTES=Object.freeze({","civweave:'/app/working-campus-v156.html'","'living-school':'/app/cabinets/living-school/index.html'","cerbanimo:'/app/realm-console-v140.html'","fellowfare:'/app/fellowfare-cabinet-v144.html'","anarchadia:'/app/anarchadia-console-v139.html'","location.replace(localDestination(system,releaseVersion).href)"])assert(installedEntry.includes(token),`Local-first installed entry is missing ${token}.`);
assert(!bootBlock.includes('await resolveReleaseVersion'),'Installed boot still waits on a manifest/network version fetch.');
assert(!bootBlock.includes('await refreshWorker'),'Installed boot still waits on service-worker update work.');
assert(!bootBlock.includes('await ensureRoutes'),'Installed boot still waits on the route script.');
assert(installedEntry.includes("fetch(`/app/manifest.webmanifest?boot=${Date.now()}`,{cache:'no-store'})"),'Explicit update helper lost bounded no-store version resolution.');
assert(installedEntry.includes("updateViaCache:'none'")&&installedEntry.includes('await registration.update()'),'Explicit update helper lost service-worker refresh capability.');
assert.equal(new URL(manifest.start_url,'https://civweave.invalid').pathname,'/app/installed-entry-v146.html','PWA manifest no longer launches through the installed bootstrap.');
assert(installedLaunch.includes("const V282_ENTRY_PATH='/app/installed-entry-v146.html'"),'Worker launch boundary no longer serves the installed bootstrap.');
assert(installedLaunch.includes("policy:'installed-entry-never-installer-substitution'"),'Worker launch boundary can regress to installer substitution.');
assert(shellRepair.includes("const V225_OPTIONAL_ASSETS = ['/app/installer-online-fallback-v225.js']"),'Installer launch guard is no longer retained in the offline shell cache lane.');
assert(installerFallback.includes("url = new URL('/app/installed-entry-v146.html'"),'Installed Open button no longer targets the installed bootstrap.');
assert(installerFallback.includes('if (installedDisplay())')&&installerFallback.includes('event.stopImmediatePropagation()'),'Installed Open button no longer preempts the legacy /app/ click handler.');
assert(codeCoherence.includes("network-first-current-version-cache-legacy-offline-fallback"),'Executable code coherence policy was lost.');
assert(codeCoherence.includes("'/app/local-ai/bootstrap-v266.js'")&&codeCoherence.includes("'/app/local-ai/settings-panel-v267.js'"),'Local AI settings/bootstrap are no longer critical executable-code coherence assets.');
assert(wrapper.indexOf('/app/system-routes-v227.js')<wrapper.indexOf('/service-worker-code-coherence-v288.js'),'Checked-in worker wrapper does not load route contract first.');
assert(wrapper.indexOf('/service-worker-code-coherence-v288.js')<wrapper.indexOf('/service-worker-core-v208.js'),'Checked-in worker wrapper no longer gives code coherence first executable ownership.');
assert(wrapper.indexOf('/service-worker-core-v208.js')<wrapper.indexOf('/service-worker-installed-launch-v282.js'),'Checked-in worker wrapper does not load installed launch after the core.');
assert(wrapper.indexOf('/service-worker-installed-launch-v282.js')<wrapper.indexOf('/service-worker-navigation-safety-v224.js'),'Navigation safety must wrap the corrected installed launch handler.');
assert(wrapper.indexOf('/service-worker-installer-state-v280.js')<wrapper.indexOf('/service-worker-shell-integrity-v281.js'),'Checked-in worker wrapper does not load shell integrity after finalizing required assets.');
assert(wrapper.indexOf('/service-worker-canonical-navigation-v227.js')>wrapper.indexOf('/service-worker-shell-repair-v225.js'),'Checked-in worker wrapper does not load canonical navigation after shell repair.');
assert(wrapper.includes("/service-worker-chat-repair-v245.js?v=chat-convergence-v250"),'Checked-in worker wrapper lost the v250 stale-chat migration lane.');
console.log(JSON.stringify({ok:true,version,revision:'navigation-generator-invariants-v293-local-first-v288-coherence',singleRouteAuthority:true,builderRouteFirst:true,codeCoherence:'v288',builderIntegrityOrder:true,builderCanonicalAfterRepair:true,coherenceCannotDowngrade:true,compatibilityLauncherLocalFirst:true,networkBeforeLocalRoute:false,installedLaunchNeverInstaller:true,installerOpenPreempted:true,installerGuardOfflineCached:true},null,2));
