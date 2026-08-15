import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const exists=path=>access(new URL(`../${path}`,import.meta.url)).then(()=>true,()=>false);
const [versionText,builder,versionSync,coherenceSync,installedEntry,installedLaunch,repairOnly,manifestText,repair293,core,wrapper,boundary]=await Promise.all([
  read('VERSION'),read('scripts/build-service-worker-v211.mjs'),read('scripts/sync-release-version-assets.mjs'),read('scripts/sync-release-coherence-v220.mjs'),read('public/app/installed-entry-v146.js'),read('public/service-worker-installed-launch-v282.js'),read('public/app/installer-repair-only-v1.js'),read('public/app/manifest.webmanifest'),read('public/service-worker-shell-repair-v293.js'),read('public/service-worker-core-v208.js'),read('public/service-worker-v203.js'),read('public/app/install-boundary-v146.js')
]);
const version=versionText.trim();
const manifest=JSON.parse(manifestText);
new Function(installedEntry);new Function(installedLaunch);new Function(repairOnly);new Function(boundary);
for(const token of[
  "importScripts('/app/system-routes-v227.js?v=${version}-five-system-route-contract-v227')",
  "importScripts('/service-worker-core-v208.js?v=${version}-chat-convergence-v250-installer-brand-v1-working-campus-return-v425-install-only-pwa-v1')",
  "importScripts('/service-worker-installed-launch-v282.js?v=installed-pwa-launch-v294-campus-recovery')",
  "importScripts('/service-worker-installer-state-v280.js?v=installer-state-machines-v280')",
  "importScripts('/service-worker-shell-integrity-v281.js?v=shell-integrity-v281')",
  "importScripts('/service-worker-shell-repair-v293.js?v=installed-shell-repair-v293')",
  "importScripts('/service-worker-canonical-navigation-v227.js?v=canonical-five-system-navigation-v227')",
  'working-campus-return-v425','install-only-pwa-v1','retiredParallelShellRepair:\'v225-absent\'','canonicalNavigationFinalPolicy:true','routeContractFirst:true'
])assert(builder.includes(token),`Worker builder is missing ${token}.`);
assert(builder.indexOf('/app/system-routes-v227.js')<builder.indexOf('/service-worker-core-v208.js'),'Worker builder must place route contract first.');
assert(builder.indexOf('/service-worker-core-v208.js')<builder.indexOf('/service-worker-installed-launch-v282.js'),'Installed launch must follow retained core.');
assert(builder.indexOf('/service-worker-shell-integrity-v281.js')<builder.indexOf('/service-worker-shell-repair-v293.js'),'Shell integrity must precede explicit repair.');
assert(builder.indexOf('/service-worker-shell-repair-v293.js')<builder.indexOf('/service-worker-offline-v211-override.js'),'Repair authority must be established before offline package behavior.');
assert(builder.lastIndexOf('/service-worker-canonical-navigation-v227.js')>builder.lastIndexOf('/service-worker-navigation-safety-v224.js'),'Canonical navigation must remain the final navigation policy.');
for(const token of['Launch Civweave from your device app launcher','browser-install-boundary-v228-chat-escape-install-only-pwa-v1','working-campus-return-v425-install-only-pwa-v1','installOnlyPwa'])assert(versionSync.includes(token),`Release version synchronizer is missing ${token}.`);
for(const token of["const installedEntryRevision='boot-recovery-v426-install-only-pwa-v1'","const boundaryRevision='browser-install-boundary-v228-chat-escape-install-only-pwa-v1'","const boundaryRuntimeRevision='browser-install-boundary-v228-chat-escape-install-only-pwa-v1'","canonicalPolicy:'five-system-first-class-routes-v242-canonical-chat-owner'","browserRuntimePolicy:'installed-display-only'",'installedQueryIsAuthorization:false','installOnlyPwa'])assert(coherenceSync.includes(token),`Release coherence synchronizer is missing ${token}`);
assert(installedEntry.includes('CivweaveSystemRoutesV227')&&installedEntry.includes('routes.urlFor'),'Installed launcher must use canonical route authority.');
assert(installedEntry.includes("if(!installedDisplay()&&!localDeveloper())"),'Installed entry must reject ordinary browser display mode.');
assert(installedEntry.includes("browserRuntimePolicy:'installed-display-only'"),'Installed entry must declare installed-only runtime policy.');
assert.equal(new URL(manifest.start_url,'https://civweave.invalid').pathname,'/app/installed-entry-v146.html','PWA manifest must launch through installed bootstrap.');
assert(installedLaunch.includes("policy:'installed-entry-then-working-campus-never-installer-substitution'"),'Worker installed launch boundary regressed.');
assert(repair293.includes("const REVISION='installed-shell-repair-v293'"),'v293 must remain the sole explicit shell repair owner.');
assert(core.includes("'/app/installer-repair-only-v1.js'"),'Core must retain the repair-only installer bridge as an optional shell asset.');
assert.equal(await exists('public/service-worker-shell-repair-v225.js'),false,'Parallel v225 shell repair worker must remain absent.');
assert(repairOnly.includes("browserRuntimePolicy:'installer-only-until-installed-display'"),'Repair bridge must stay installer-only in browser display.');
assert(repairOnly.includes("if(!required||!rawNext||!installedDisplay())return false"),'Required-next recovery must require installed display mode.');
assert(boundary.includes('function allowed(){return installedDisplay()||developer()}'),'Shared boundary must not allow embedded browser documents.');
assert(wrapper.indexOf('/app/system-routes-v227.js')<wrapper.indexOf('/service-worker-core-v208.js'),'Checked-in worker must load routes first.');
assert(wrapper.includes(`/service-worker-core-v208.js?v=${version}-chat-convergence-v250-installer-brand-v1-working-campus-return-v425-install-only-pwa-v1`),'Checked-in worker lost install-only core cache epoch.');
assert(wrapper.includes('/service-worker-shell-repair-v293.js?v=installed-shell-repair-v293'),'Checked-in worker lost canonical repair epoch.');
assert.ok(!wrapper.includes('/service-worker-shell-repair-v225.js'),'Checked-in worker resurrected parallel repair.');
assert(wrapper.indexOf('/service-worker-canonical-navigation-v227.js')>wrapper.indexOf('/service-worker-navigation-safety-v224.js'),'Checked-in worker must keep canonical navigation final.');
console.log(JSON.stringify({ok:true,version,revision:'navigation-generator-single-repair-owner-v293',singleRouteAuthority:true,builderRouteFirst:true,builderIntegrityOrder:true,builderCanonicalAfterSafety:true,coherenceCannotRestoreBrowserRuntime:true,updaterFirstEntry:true,installedLaunchNeverInstaller:true,repairOwner:'v293',parallelRepairOwners:0,repairOnly:true,browserRuntime:false,workingCampusReturn:'v425',moduleSyntaxCheckedByWorkflow:true},null,2));