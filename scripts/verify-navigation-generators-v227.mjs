import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [versionText,builder,versionSync,coherenceSync,installedEntry,installedLaunch,pwa,manifestText,installedRepair,wrapper,boundary]=await Promise.all([
  read('VERSION'),read('scripts/build-service-worker-v211.mjs'),read('scripts/sync-release-version-assets.mjs'),read('scripts/sync-release-coherence-v220.mjs'),read('public/app/installed-entry-v146.js'),read('public/service-worker-installed-launch-v282.js'),read('public/app/pwa-install-prompt-v249.js'),read('public/app/manifest.webmanifest'),read('public/service-worker-shell-repair-v293.js'),read('public/service-worker-v203.js'),read('public/app/install-boundary-v146.js')
]);
const version=versionText.trim();
const manifest=JSON.parse(manifestText);
new Function(installedEntry);new Function(installedLaunch);new Function(pwa);new Function(boundary);
for(const retired of ['public/app/installer-repair-only-v1.js','public/app/installer-online-fallback-v225.js','public/service-worker-shell-repair-v225.js'])assert.equal(existsSync(new URL(`../${retired}`,import.meta.url)),false,`${retired} must remain retired`);
for(const token of[
  `importScripts('/app/system-routes-v227.js?v=${version}-five-system-route-contract-v227')`,
  `importScripts('/service-worker-core-v208.js?v=${version}-chat-convergence-v250-installer-brand-v1-working-campus-return-v425-install-only-pwa-v1')`,
  `importScripts('/service-worker-installed-launch-v282.js?v=installed-pwa-launch-v294-campus-recovery')`,
  `importScripts('/service-worker-installer-state-v280.js?v=installer-state-machines-v280')`,
  `importScripts('/service-worker-shell-integrity-v281.js?v=shell-integrity-v281')`,
  `importScripts('/service-worker-shell-repair-v293.js?v=installed-shell-repair-v293')`,
  `importScripts('/service-worker-canonical-navigation-v227.js?v=canonical-five-system-navigation-v227')`,
  'working-campus-return-v425','install-only-pwa-v1','canonicalNavigationFinalPolicy:true','routeContractFirst:true'
])assert(builder.includes(token),`Worker builder is missing ${token}.`);
assert(!builder.includes('service-worker-shell-repair-v225.js'),'Worker builder must not resurrect v225.');
assert(builder.indexOf('/app/system-routes-v227.js')<builder.indexOf('/service-worker-core-v208.js'),'Worker builder must place route contract first.');
assert(builder.indexOf('/service-worker-core-v208.js')<builder.indexOf('/service-worker-installed-launch-v282.js'),'Installed launch must follow retained core.');
assert(builder.indexOf('/service-worker-shell-integrity-v281.js')<builder.indexOf('/service-worker-offline-v211-override.js'),'Shell integrity must precede campus downloads.');
assert(builder.indexOf('/service-worker-shell-repair-v293.js')<builder.lastIndexOf('/service-worker-canonical-navigation-v227.js'),'Canonical navigation must remain after the sole installed repair responder.');
for(const token of['Launch Civweave from your device app launcher','browser-install-boundary-v228-chat-escape-install-only-pwa-v1','working-campus-return-v425-install-only-pwa-v1','installed-shell-repair-v293','installOnlyPwa'])assert(versionSync.includes(token),`Release version synchronizer is missing ${token}.`);
assert(!versionSync.includes('service-worker-shell-repair-v225'),'Release version synchronizer must not recreate v225.');
for(const token of["const installedEntryRevision='boot-recovery-v426-install-only-pwa-v1'","const boundaryRevision='browser-install-boundary-v228-chat-escape-install-only-pwa-v1'","const boundaryRuntimeRevision='browser-install-boundary-v228-chat-escape-install-only-pwa-v1'","canonicalPolicy:'five-system-first-class-routes-v242-canonical-chat-owner'","browserRuntimePolicy:'installed-display-only'",'installedQueryIsAuthorization:false','installOnlyPwa','installedShellRepair'])assert(coherenceSync.includes(token),`Release coherence synchronizer is missing ${token}.`);
assert(installedEntry.includes('CivweaveSystemRoutesV227')&&installedEntry.includes('routes.urlFor'),'Installed launcher must use canonical route authority.');
assert(installedEntry.includes("if(!installedDisplay()&&!localDeveloper())"),'Installed entry must reject ordinary browser display mode.');
assert(installedEntry.includes("browserRuntimePolicy:'installed-display-only'"),'Installed entry must declare installed-only runtime policy.');
assert.equal(new URL(manifest.start_url,'https://civweave.invalid').pathname,'/app/installed-entry-v146.html','PWA manifest must launch through installed bootstrap.');
assert(installedLaunch.includes("policy:'installed-entry-then-working-campus-never-installer-substitution'"),'Worker installed launch boundary regressed.');
assert(installedRepair.includes("event.data?.type !== 'REPAIR_DEVICE_PACKAGE'"),'v293 must retain explicit repair message ownership.');
assert(pwa.includes("requiredNextOwner:'pwa-install-prompt-v249'"),'Required-next recovery must belong to the PWA controller.');
assert(pwa.includes("if(!required||!rawNext||!standalone())return false"),'Required-next recovery must require installed display mode.');
assert(!pwa.includes('REPAIR_DEVICE_PACKAGE'),'PWA install controller must not invoke installed-shell repair.');
assert(boundary.includes('function allowed(){return installedDisplay()||developer()}'),'Shared boundary must not allow embedded browser documents.');
assert(wrapper.indexOf('/app/system-routes-v227.js')<wrapper.indexOf('/service-worker-core-v208.js'),'Checked-in worker must load routes first.');
assert(wrapper.includes(`/service-worker-core-v208.js?v=${version}-chat-convergence-v250-installer-brand-v1-working-campus-return-v425-install-only-pwa-v1`),'Checked-in worker lost install-only core cache epoch.');
assert(wrapper.includes('/service-worker-shell-repair-v293.js?v=installed-shell-repair-v293'),'Checked-in worker lost installed repair owner.');
assert(!wrapper.includes('/service-worker-shell-repair-v225.js'),'Checked-in worker resurrected retired repair owner.');
assert(wrapper.indexOf('/service-worker-canonical-navigation-v227.js')>wrapper.indexOf('/service-worker-shell-repair-v293.js'),'Checked-in worker must keep canonical navigation after installed repair.');
console.log(JSON.stringify({ok:true,version,revision:'navigation-generator-install-only-pwa-v1-source-truth',singleRouteAuthority:true,builderRouteFirst:true,builderIntegrityOrder:true,builderCanonicalAfterRepair:true,coherenceCannotRestoreBrowserRuntime:true,updaterFirstEntry:true,installedLaunchNeverInstaller:true,requiredNextOwner:'pwa-install-prompt-v249',installedShellRepair:'v293-sole-owner',browserRuntime:false,workingCampusReturn:'v425',moduleSyntaxCheckedByWorkflow:true},null,2));