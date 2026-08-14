import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [versionText,builder,versionSync,coherenceSync,installedEntry,installedLaunch,repairOnly,manifestText,shellRepair,wrapper,boundary]=await Promise.all([
  read('VERSION'),read('scripts/build-service-worker-v211.mjs'),read('scripts/sync-release-version-assets.mjs'),read('scripts/sync-release-coherence-v220.mjs'),read('public/app/installed-entry-v146.js'),read('public/service-worker-installed-launch-v282.js'),read('public/app/installer-repair-only-v1.js'),read('public/app/manifest.webmanifest'),read('public/service-worker-shell-repair-v225.js'),read('public/service-worker-v203.js'),read('public/app/install-boundary-v146.js')
]);
const version=versionText.trim();
const manifest=JSON.parse(manifestText);
new Function(installedEntry);new Function(installedLaunch);new Function(repairOnly);new Function(boundary);
for(const token of[
  `importScripts('/app/system-routes-v227.js?v=${version}-five-system-route-contract-v227')`,
  `importScripts('/service-worker-core-v208.js?v=${version}-chat-convergence-v250-installer-brand-v1-working-campus-return-v425-install-only-pwa-v1')`,
  "importScripts('/service-worker-installed-launch-v282.js?v=installed-pwa-launch-v294-campus-recovery')",
  "importScripts('/service-worker-installer-state-v280.js?v=installer-state-machines-v280')",
  "importScripts('/service-worker-shell-integrity-v281.js?v=shell-integrity-v281')",
  "importScripts('/service-worker-shell-repair-v225.js?v=shell-self-repair-v225-install-only-pwa-v1')",
  "importScripts('/service-worker-canonical-navigation-v227.js?v=canonical-five-system-navigation-v227')",
  'working-campus-return-v425','install-only-pwa-v1','canonicalNavigationFinalPolicy:true','routeContractFirst:true'
])assert(builder.includes(token),`Worker builder is missing ${token}.`);
assert(builder.indexOf('/app/system-routes-v227.js')<builder.indexOf('/service-worker-core-v208.js'),'Worker builder must place route contract first.');
assert(builder.indexOf('/service-worker-core-v208.js')<builder.indexOf('/service-worker-installed-launch-v282.js'),'Installed launch must follow retained core.');
assert(builder.indexOf('/service-worker-shell-integrity-v281.js')<builder.indexOf('/service-worker-offline-v211-override.js'),'Shell integrity must precede campus downloads.');
assert(builder.lastIndexOf('/service-worker-canonical-navigation-v227.js')>builder.lastIndexOf('/service-worker-shell-repair-v225.js'),'Canonical navigation must remain final after shell repair.');
for(const token of['Launch Civweave from your device app launcher','browser-install-boundary-v228-chat-escape-install-only-pwa-v1','working-campus-return-v425-install-only-pwa-v1','shell-self-repair-v225-install-only-pwa-v1','installOnlyPwa'])assert(versionSync.includes(token),`Release version synchronizer is missing ${token}.`);
for(const token of["const installedEntryRevision='boot-recovery-v426-install-only-pwa-v1'","const boundaryRevision='browser-install-boundary-v228-chat-escape-install-only-pwa-v1'","const boundaryRuntimeRevision='browser-install-boundary-v228-chat-escape-install-only-pwa-v1'","canonicalPolicy:'five-system-first-class-routes-v242-canonical-chat-owner-installed-only-v228'","browserRuntimePolicy:'installed-display-only'",'installedQueryIsAuthorization:false','installOnlyPwa'])assert(coherenceSync.includes(token),`Release coherence synchronizer is missing ${token}.`);
assert(installedEntry.includes('CivweaveSystemRoutesV227')&&installedEntry.includes('routes.urlFor'),'Installed launcher must use canonical route authority.');
assert(installedEntry.includes("if(!installedDisplay()&&!localDeveloper())"),'Installed entry must reject ordinary browser display mode.');
assert(installedEntry.includes("browserRuntimePolicy:'installed-display-only'"),'Installed entry must declare installed-only runtime policy.');
assert.equal(new URL(manifest.start_url,'https://civweave.invalid').pathname,'/app/installed-entry-v146.html','PWA manifest must launch through installed bootstrap.');
assert(installedLaunch.includes("policy:'installed-entry-then-working-campus-never-installer-substitution'"),'Worker installed launch boundary regressed.');
assert(shellRepair.includes("const V225_OPTIONAL_ASSETS = ['/app/installer-repair-only-v1.js']"),'Shell repair must retain repair-only bridge.');
assert(!shellRepair.includes("const V225_OPTIONAL_ASSETS = ['/app/installer-online-fallback-v225.js']"),'Shell repair must not restore online fallback.');
assert(repairOnly.includes("browserRuntimePolicy:'installer-only-until-installed-display'"),'Repair bridge must stay installer-only in browser display.');
assert(repairOnly.includes("if(!required||!rawNext||!installedDisplay())return false"),'Required-next recovery must require installed display mode.');
assert(boundary.includes('function allowed(){return installedDisplay()||developer()}'),'Shared boundary must not allow embedded browser documents.');
assert(wrapper.indexOf('/app/system-routes-v227.js')<wrapper.indexOf('/service-worker-core-v208.js'),'Checked-in worker must load routes first.');
assert(wrapper.includes(`/service-worker-core-v208.js?v=${version}-chat-convergence-v250-installer-brand-v1-working-campus-return-v425-install-only-pwa-v1`),'Checked-in worker lost install-only core cache epoch.');
assert(wrapper.includes('/service-worker-shell-repair-v225.js?v=shell-self-repair-v225-install-only-pwa-v1'),'Checked-in worker lost install-only repair epoch.');
assert(wrapper.indexOf('/service-worker-canonical-navigation-v227.js')>wrapper.indexOf('/service-worker-shell-repair-v225.js'),'Checked-in worker must keep canonical navigation final.');
console.log(JSON.stringify({ok:true,version,revision:'navigation-generator-install-only-pwa-v1',singleRouteAuthority:true,builderRouteFirst:true,builderIntegrityOrder:true,builderCanonicalAfterRepair:true,coherenceCannotRestoreBrowserRuntime:true,updaterFirstEntry:true,installedLaunchNeverInstaller:true,repairOnly:true,browserRuntime:false,workingCampusReturn:'v425',moduleSyntaxCheckedByWorkflow:true},null,2));
