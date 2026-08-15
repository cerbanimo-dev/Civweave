import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [versionText,builder,versionSync,coherenceSync,installedEntry,installedLaunch,manifestText,shellRepair,wrapper,boundary]=await Promise.all([
  read('VERSION'),read('scripts/build-service-worker-v211.mjs'),read('scripts/sync-release-version-assets.mjs'),read('scripts/sync-release-coherence-v220.mjs'),read('public/app/installed-entry-v146.js'),read('public/service-worker-installed-launch-v282.js'),read('public/app/manifest.webmanifest'),read('public/service-worker-shell-repair-v225.js'),read('public/service-worker-v203.js'),read('public/app/install-boundary-v146.js')
]);
const version=versionText.trim();
const manifest=JSON.parse(manifestText);
new Function(installedEntry);new Function(installedLaunch);new Function(boundary);
for(const token of[
  `importScripts('/app/system-routes-v227.js?v=${version}-five-system-route-contract-v227')`,
  `importScripts('/service-worker-core-v208.js?v=${version}-chat-convergence-v250-installer-brand-v1-working-campus-return-v425-install-only-pwa-v1')`,
  "importScripts('/service-worker-installed-launch-v282.js?v=installed-pwa-launch-v294-campus-recovery-local-first')",
  "importScripts('/service-worker-local-ai-coherence-v307.js?v=${version}-local-ai-code-coherence-v307-local-first')",
  "importScripts('/service-worker-code-coherence-v288.js?v=1.0.92-code-coherence-v288-language-v2-local-first')",
  "importScripts('/service-worker-release-coherence-v220.js?v=release-coherence-v226-local-first')",
  "importScripts('/service-worker-navigation-safety-v224.js?v=navigation-redirect-safety-v224-local-first')",
  "importScripts('/service-worker-shell-repair-v225.js?v=shell-self-repair-v225-install-only-pwa-v1-local-first')",
  "importScripts('/service-worker-canonical-navigation-v227.js?v=canonical-five-system-navigation-v227-local-first')",
  'runtimeNetworkFallback:false','canonicalNavigationFinalPolicy:true','routeContractFirst:true'
])assert(builder.includes(token),`Worker builder is missing ${token}.`);
assert(builder.indexOf('/app/system-routes-v227.js')<builder.indexOf('/service-worker-core-v208.js'),'Worker builder must place route contract first.');
assert(builder.indexOf('/service-worker-core-v208.js')<builder.indexOf('/service-worker-installed-launch-v282.js'),'Installed launch must follow retained core.');
assert(builder.indexOf('/service-worker-shell-integrity-v281.js')<builder.indexOf('/service-worker-offline-v211-override.js'),'Shell integrity must precede campus downloads.');
assert(builder.lastIndexOf('/service-worker-canonical-navigation-v227.js')>builder.lastIndexOf('/service-worker-shell-repair-v225.js'),'Canonical navigation must remain final after shell repair.');
for(const token of['Civweave installs in two local stages','working-campus-return-v425-install-only-pwa-v1','shell-self-repair-v225-install-only-pwa-v1-local-first','localFirstInstaller'])assert(versionSync.includes(token),`Release version synchronizer is missing ${token}.`);
for(const token of['release-coherence-v226-local-first','localCampusRequiredForLaunch:true',"browserRuntime:'installed-display-cache-only'",'packageAcquisition:\'explicit-only\''])assert(coherenceSync.includes(token),`Release coherence guard is missing ${token}.`);
assert(installedEntry.includes('CivweaveSystemRoutesV227')&&installedEntry.includes('routes.urlFor'),'Installed launcher must use canonical route authority.');
assert(installedEntry.includes("if(!installedDisplay()&&!localDeveloper())"),'Installed entry must reject ordinary browser display mode.');
assert(installedEntry.includes("browserRuntimePolicy:'installed-display-cache-only'"),'Installed entry must declare cache-only installed runtime policy.');
assert(installedEntry.includes('allowProvision:localDeveloper()'),'Production installed entry must not provision missing code implicitly.');
assert.equal(new URL(manifest.start_url,'https://civweave.invalid').pathname,'/app/installed-entry-v146.html','PWA manifest must launch through installed bootstrap.');
assert(installedLaunch.includes("policy:'installed-entry-then-local-working-campus-never-network-fallback'"),'Worker installed launch boundary regressed.');
assert(installedLaunch.includes('runtimeNetworkFallback:false'),'Installed launch must explicitly forbid runtime network fallback.');
assert(shellRepair.includes("const V225_OPTIONAL_ASSETS = ['/app/installer-repair-only-v1.js']"),'Shell repair must retain repair-only bridge as a package asset.');
assert(shellRepair.includes('runtimeAutoRepair: false'),'Shell status must not trigger a package download.');
assert(shellRepair.includes('explicit-repair-only-report-missing-without-runtime-fetch'),'Shell repair must require explicit user intent.');
assert(boundary.includes('function allowed(){return installedDisplay()||developer()}'),'Shared boundary must not allow embedded browser documents.');
assert(wrapper.indexOf('/app/system-routes-v227.js')<wrapper.indexOf('/service-worker-core-v208.js'),'Checked-in worker must load routes first.');
assert(wrapper.includes(`/service-worker-core-v208.js?v=${version}-chat-convergence-v250-installer-brand-v1-working-campus-return-v425-install-only-pwa-v1`),'Checked-in worker lost install-only core cache epoch.');
assert(wrapper.includes('/service-worker-release-coherence-v220.js?v=release-coherence-v226-local-first'),'Checked-in worker lost local-first release coherence epoch.');
assert(wrapper.includes('/service-worker-shell-repair-v225.js?v=shell-self-repair-v225-install-only-pwa-v1-local-first'),'Checked-in worker lost local-first repair epoch.');
assert(wrapper.includes('/service-worker-canonical-navigation-v227.js?v=canonical-five-system-navigation-v227-local-first'),'Checked-in worker lost local-first canonical navigation epoch.');
assert(wrapper.indexOf('/service-worker-canonical-navigation-v227.js')>wrapper.indexOf('/service-worker-shell-repair-v225.js'),'Checked-in worker must keep canonical navigation final.');
console.log(JSON.stringify({ok:true,version,revision:'navigation-generator-local-first-v227',singleRouteAuthority:true,builderRouteFirst:true,builderIntegrityOrder:true,builderCanonicalAfterRepair:true,coherenceCannotRestoreOnlineRuntime:true,installedRuntime:'cache-only',runtimeNetworkFallback:false,explicitRepairOnly:true,workingCampusReturn:'v425',moduleSyntaxCheckedByWorkflow:true},null,2));
