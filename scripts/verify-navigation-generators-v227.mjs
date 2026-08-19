import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const exists=path=>access(new URL(path,root)).then(()=>true,()=>false);
const [versionText,builder,versionSync,coherenceSync,installedEntry,installedLaunch,repairOnly,manifestText,shellAssets,shellRepair,wrapper,canonicalNavbar,boundary,ownershipText]=await Promise.all([
  read('VERSION'),read('scripts/build-service-worker-v211.mjs'),read('scripts/sync-release-version-assets.mjs'),read('scripts/sync-release-coherence-v220.mjs'),read('public/app/installed-entry-v146.js'),read('public/service-worker-installed-launch-v282.js'),read('public/app/installer-repair-only-v2.js'),read('public/app/manifest.webmanifest'),read('public/service-worker-shell-assets-v1.js'),read('public/service-worker-shell-repair-v293.js'),read('public/service-worker-v203.js'),read('public/service-worker-canonical-navbar-v1.js'),read('public/app/install-boundary-v146.js'),read('config/system-ownership.json')
]);
const version=versionText.trim(),manifest=JSON.parse(manifestText),ownership=JSON.parse(ownershipText);
const chatOwner=ownership?.systems?.['guide-chat']?.owner,chatRevision=chatOwner?.match(/-(v\d+)\.js$/i)?.[1];
assert.ok(chatOwner&&chatRevision,'System ownership must declare a revisioned canonical guide-chat owner.');
new Function(installedEntry);new Function(installedLaunch);new Function(repairOnly);new Function(boundary);new Function(canonicalNavbar);
for(const token of[
  "importScripts('/app/system-routes-v227.js?v=${version}-five-system-route-contract-v227')",
  "importScripts('/service-worker-canonical-navbar-v1.js?v=canonical-navbar-network-first-v1')",
  "importScripts('/service-worker-core-v208.js?v=${version}-chat-convergence-v250-installer-brand-v1-working-campus-return-v425-guild-quest-browser-v430-install-only-pwa-v1')",
  "importScripts('/service-worker-shell-assets-v1.js?v=shell-assets-v1-repair-v2')",
  "importScripts('/service-worker-installed-launch-v282.js?v=installed-pwa-launch-v295-entry-integrity')",
  "importScripts('/service-worker-installer-state-v280.js?v=installer-state-machines-v280')",
  "importScripts('/service-worker-shell-integrity-v281.js?v=shell-integrity-v281')",
  "importScripts('/service-worker-shell-repair-v293.js?v=installed-shell-repair-v293')",
  "importScripts('/service-worker-canonical-navigation-v227.js?v=canonical-five-system-navigation-v227')",
  'working-campus-return-v425','install-only-pwa-v1','canonicalNavigationFinalPolicy:true','routeContractFirst:true','canonicalNavbar:\'network-first-v1\''
])assert(builder.includes(token),`Worker builder is missing ${token}.`);
assert(!builder.includes('service-worker-shell-repair-v225.js'),'Worker builder can resurrect retired v225 repair ownership.');
assert.equal(await exists('public/service-worker-shell-repair-v225.js'),false,'Retired v225 repair runtime must remain absent.');
assert(builder.indexOf('/app/system-routes-v227.js')<builder.indexOf('/service-worker-canonical-navbar-v1.js'),'Worker builder must place route authority before the canonical navbar lane.');
assert(builder.indexOf('/service-worker-canonical-navbar-v1.js')<builder.indexOf('/service-worker-core-v208.js'),'Canonical navbar worker lane must register before generic cache-first core handling.');
assert(builder.indexOf('/service-worker-core-v208.js')<builder.indexOf('/service-worker-shell-assets-v1.js'),'Declarative shell assets must follow the core arrays they extend.');
assert(builder.indexOf('/service-worker-shell-repair-v293.js')<builder.indexOf('/service-worker-canonical-navigation-v227.js'),'Canonical navigation must remain downstream of explicit shell repair.');
assert(builder.indexOf('/service-worker-shell-integrity-v281.js')<builder.indexOf('/service-worker-offline-v211-override.js'),'Shell integrity must precede campus downloads.');
for(const token of['public/app/themed-system-nav-v178.js','five-system-navigation-','browser-install-boundary-v228-chat-escape-install-only-pwa-v1','working-campus-return-v425-install-only-pwa-v1','installOnlyPwa'])assert(versionSync.includes(token),`Release version synchronizer is missing ${token}.`);
for(const token of["const installedEntryRevision='boot-recovery-v428-launch-session-v1'","const boundaryRevision='browser-install-boundary-v228-chat-escape-install-only-pwa-v1'","const boundaryRuntimeRevision='browser-install-boundary-v228-chat-escape-install-only-pwa-v1'",'guideChatCanonicalPolicy','guideChatWorkspaceRevision','guideChatOwnershipPolicy',"ownership?.systems?.['guide-chat']?.owner","browserRuntimePolicy:'installed-display-or-pwa-launch-session'",'installedQueryIsAuthorization:false',"pwaLaunchSession:'v1'",'installOnlyPwa'])assert(coherenceSync.includes(token),`Release coherence synchronizer is missing ${token}.`);
assert(installedEntry.includes('CivweaveSystemRoutesV227')&&installedEntry.includes('routes.urlFor'),'Installed launcher must use canonical route authority.');
assert(installedEntry.includes('async function installedLaunchAuthorized()')&&installedEntry.includes('await installedLaunchAuthorized()'),'Installed entry must await PWA launch authorization before routing.');
assert(installedEntry.includes("const LAUNCH_SESSION_KEY='civweave.pwa.launch-session.v1'"),'Installed entry must share the PWA launch-session key.');
assert(installedEntry.includes("browserRuntimePolicy:'installed-display-or-pwa-launch-session'"),'Installed entry must require installed display or PWA launch session.');
assert.equal(new URL(manifest.start_url,'https://civweave.invalid').pathname,'/app/installed-entry-v146.html','PWA manifest must launch through installed bootstrap.');
assert(installedLaunch.includes("policy:'installed-entry-then-working-campus-never-installer-substitution'"),'Worker installed launch boundary regressed.');
assert(shellAssets.includes("const OPTIONAL=['/app/installer-repair-only-v2.js']"),'Shell assets must seed current repair-only bridge v2.');
assert(shellAssets.includes("policy:'code-critical-shell-avatar-media-on-demand-no-repair-or-message-ownership'"),'Shell asset helper must remain non-owning.');
assert(shellRepair.includes("event.data?.type!=='REPAIR_DEVICE_PACKAGE'"),'v293 must own explicit repair messaging.');
assert(repairOnly.includes('cacheDistinctPath:true'),'Current repair bridge must declare its stale-cache escape.');
assert(boundary.includes("const LAUNCH_SESSION_KEY='civweave.pwa.launch-session.v1'"),'Shared boundary must use the session-scoped PWA launch key.');
assert(boundary.includes('function allowed(){return installedDisplay()||launchSession()||developer()}'),'Shared boundary must accept installed display or PWA launch session, never embedded browser state.');
assert(boundary.includes("browserRuntimePolicy:'installed-display-or-pwa-launch-session'"),'Shared boundary must declare launch-session installed policy.');
assert(boundary.includes('installedQueryIsAuthorization:false'),'Query parameters alone must never authorize the campus.');
assert(!boundary.includes('civweave.pwa.installed-capability.v1'),'Shared boundary must not retain the unsafe durable runtime capability.');
assert(boundary.includes(`canonicalPolicy:'five-system-first-class-routes-${chatRevision}-canonical-chat-owner'`),'Checked-in boundary must match canonical chat ownership.');
assert(canonicalNavbar.includes("const PATH='/app/themed-system-nav-v178.js';"),'Canonical navbar worker must own the exact five-guide rail path.');
assert(canonicalNavbar.includes("policy:'network-first-exact-canonical-navbar-never-stale-shell-first'"),'Canonical navbar worker must stay network-first.');
assert(canonicalNavbar.includes('event.stopImmediatePropagation()'),'Canonical navbar worker must bypass generic cache-first handling.');
assert(wrapper.indexOf('/app/system-routes-v227.js')<wrapper.indexOf('/service-worker-canonical-navbar-v1.js'),'Checked-in worker must load route authority first.');
assert(wrapper.indexOf('/service-worker-canonical-navbar-v1.js')<wrapper.indexOf('/service-worker-core-v208.js'),'Checked-in worker must register the canonical navbar lane before generic core handling.');
assert(wrapper.includes('/service-worker-shell-assets-v1.js?v=shell-assets-v1-repair-v2'),'Checked-in worker lost declarative repair-v2 shell asset.');
assert(wrapper.includes('/service-worker-shell-repair-v293.js?v=installed-shell-repair-v293'),'Checked-in worker lost v293 repair owner.');
assert(!wrapper.includes('/service-worker-shell-repair-v225.js'),'Checked-in worker resurrected retired v225 repair owner.');
assert(wrapper.indexOf('/service-worker-canonical-navigation-v227.js')>wrapper.indexOf('/service-worker-shell-repair-v293.js'),'Checked-in worker must keep canonical navigation after explicit repair.');
console.log(JSON.stringify({ok:true,version,revision:'navigation-generator-five-guide-rail-v232-canonical-navbar',canonicalChatOwner:chatOwner,singleRouteAuthority:true,fiveGuideRailReleaseSync:true,builderRouteFirst:true,builderIntegrityOrder:true,shellRepairOwner:'v293',retiredV225Absent:true,updaterFirstEntry:true,installedLaunchNeverInstaller:true,pwaLaunchSession:true,queryAuthorization:false,repairOnly:true,cacheDistinctRepair:true,workingCampusReturn:'v425',canonicalNavbar:'network-first-v1'},null,2));
