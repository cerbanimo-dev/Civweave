import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const readBytes=path=>readFile(new URL(path,root));
const [html,rootHtml,manifestText,assetlinksText,bridge,repairOnly,workerRepair,workerWrapper,installedEntryHtml,installedEntry,boundary,hostMeta]=await Promise.all([
  read('public/app/index.html'),
  read('public/index.html'),
  read('public/app/manifest.webmanifest'),
  read('public/.well-known/assetlinks.json'),
  read('public/app/pwa-install-prompt-v250.js'),
  read('public/app/installer-repair-only-v2.js'),
  read('public/service-worker-shell-repair-v225.js'),
  read('public/service-worker-v203.js'),
  read('public/app/installed-entry-v146.html'),
  read('public/app/installed-entry-v146.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/host-deployment-v1.json')
]);

const manifest=JSON.parse(manifestText);
assert.equal(manifest.display,'standalone');
assert.equal(manifest.prefer_related_applications,false);
assert.equal(manifest.id,'/civweave-local','PWA id must remain stable across host origins');
assert.match(manifest.start_url,/^\/app\/installed-entry-v146(?:\.html)?\?installed=1$/,'installed PWA must launch through updater entry');
assert.equal(manifest.launch_handler?.client_mode,'navigate-new','PWA launches must create a launch event in a dedicated app client');
assert.ok((manifest.shortcuts||[]).every(shortcut=>/^\/app\/installed-entry-v146(?:\.html)?\?/.test(String(shortcut.url||''))),'all installed shortcuts must pass through updater entry');

const canonicalOrigin='https://civweave.cc';
const stagingOrigin='https://civweave-staging.pages.dev';
const previousCanonicalOrigin='https://civweave.pages.dev';
const legacyCanonicalOrigin='https://commonweave.pages.dev';
const hostNodeOrigin='https://civweave-host-node.onrender.com';
const manifests=[canonicalOrigin,stagingOrigin,previousCanonicalOrigin,legacyCanonicalOrigin,hostNodeOrigin].map(origin=>`${origin}/app/manifest.webmanifest`);
const related=new Set((manifest.related_applications||[]).filter(app=>app.platform==='webapp').map(app=>app.url));
for(const url of manifests)assert.ok(related.has(url),`manifest must retain installed-app discovery for ${url}`);

const assetlinks=JSON.parse(assetlinksText);
const querySites=new Set(assetlinks.filter(entry=>(entry.relation||[]).includes('delegate_permission/common.query_webapk')).map(entry=>entry.target?.site));
for(const url of manifests)assert.ok(querySites.has(url),`asset links must allow non-authorizing installed-app discovery for ${url}`);

assert.ok(rootHtml.includes(`const CANONICAL_ORIGIN='${canonicalOrigin}'`),'root entry must know civweave.cc as the canonical PWA origin');
assert.ok(rootHtml.includes(`const PREVIOUS_CANONICAL_ORIGIN='${previousCanonicalOrigin}'`),'root entry must retain the previous Pages origin during migration');
assert.ok(rootHtml.includes(`const LEGACY_CANONICAL_ORIGIN='${legacyCanonicalOrigin}'`),'root entry must retain the legacy Commonweave origin during migration');
assert.ok(rootHtml.includes("location.hostname.endsWith('.pages.dev')&&labels.length>3"),'root entry must recognize Pages preview aliases');
assert.ok(rootHtml.includes("labels.slice(1).join('.')"),'preview root must resolve its parent production host');
assert.ok(rootHtml.includes("target.searchParams.set('install_origin',cloudflarePreview?'host-production':'canonical')"),'root handoff must distinguish host-production recovery from canonical migration');

assert.ok(bridge.includes(`const CANONICAL_ORIGIN='${canonicalOrigin}'`),'native install bridge must name civweave.cc as canonical');
assert.ok(bridge.includes(`const STAGING_ORIGIN='${stagingOrigin}'`),'native install bridge must know the isolated staging PWA origin');
assert.ok(bridge.includes("const INSTALL_MARKER_KEY='civweave.pwa.installed-marker.v1'"),'installer must keep a non-authorizing installed UX marker');
assert.ok(bridge.includes("const LAUNCH_SESSION_KEY='civweave.pwa.launch-session.v1'"),'installer must share the PWA launch-session key');
assert.ok(bridge.includes("const RETIRED_CAPABILITY_KEY='civweave.pwa.installed-capability.v1'"),'installer must explicitly retire the unsafe durable runtime capability');
assert.ok(bridge.includes('navigator.getInstalledRelatedApps()'),'installer may discover related installs for UX when supported');
assert.ok(bridge.includes("rememberInstalled('appinstalled')"),'successful app installation must persist only the installed UX marker');
assert.ok(bridge.includes("rememberInstalled('getInstalledRelatedApps')"),'related-app discovery may recover only the installed UX marker');
assert.ok(bridge.includes("if(installed){setButton(button,{disabled:true,text:'Civweave installed'})"),'ordinary browser tabs must not expose an Open Civweave runtime button merely because installation is known');
assert.ok(bridge.includes("if(appRuntime()){setButton(button,{disabled:false,text:'Open Civweave'})"),'only an installed display or PWA launch session may expose the campus action');
assert.ok(bridge.includes("browserRuntimePolicy:'installed-display-or-pwa-launch-session-only'"),'installer bridge must keep runtime authorization session-scoped');
assert.ok(bridge.includes("installSequencingPolicy:'prepare-on-first-install-interaction-then-prompt-on-fresh-gesture'"),'installer must prepare the shell only after explicit install interaction, then require a fresh install gesture');
assert.ok(bridge.includes("promptAvailabilityPolicy:'capture-beforeinstallprompt-then-prompt-synchronously-on-fresh-click'"),'installer must invoke the captured native prompt synchronously from the fresh install gesture');
assert.ok(bridge.includes('eagerRelatedAppDiscovery:false'),'installer must keep related-app discovery off the first-paint path');
assert.ok(bridge.includes('eagerShellPreparation:false'),'installer bridge must explicitly forbid eager shell preparation');
assert.ok(bridge.includes('firstPaintShellWork:false'),'installer bridge must explicitly forbid first-paint shell work');
assert.ok(bridge.includes('cacheDistinctPath:true'),'installer bridge must declare its stale-service-worker cache escape');
assert.ok(!bridge.includes('queueMicrotask(()=>void primeInstallability())'),'installer bridge must not queue shell preparation from page startup');

assert.ok(!html.includes('id="open-online-campus-v225"'),'installer must not expose an anonymous online-campus fallback button');
assert.ok(!html.includes('Browser fallback'),'installer must not advertise anonymous browser runtime fallback');
assert.ok(!html.includes('/app/installer-online-fallback-v225.js'),'installer must not load the retired online fallback bridge');
assert.ok(html.includes('/app/pwa-install-prompt-v250.js'),'installer must load the current install bridge');
assert.ok(!html.includes('/app/pwa-install-prompt-v249.js'),'installer must not load the stale-cache-prone v249 install bridge');
assert.ok(html.includes('/app/installer-repair-only-v2.js'),'installer must load the cache-distinct repair bridge v2');
assert.ok(!html.includes('/app/installer-repair-only-v1.js'),'installer must not load the shell-cached repair bridge v1');

assert.ok(repairOnly.includes('function installedDisplay()'),'repair bridge must still recognize installed display');
assert.ok(!repairOnly.includes("launch','online"),'repair bridge must not synthesize an anonymous online campus launch');
assert.ok(repairOnly.includes("hubToolsPolicy:'explicit-user-load-only'"),'Guild and account tools must be explicit opt-in work');
assert.ok(repairOnly.includes('firstPaintHubWork:false'),'repair bridge must explicitly forbid Guild/account work on first paint');
assert.ok(repairOnly.includes('cacheDistinctPath:true'),'repair bridge must declare its stale-shell-cache escape');
assert.ok(repairOnly.includes('installHubToolsGate();'),'installer startup must install only the lightweight Guild tools gate');
assert.ok(repairOnly.includes("addEventListener('click',loadHubTools)"),'Guild/account scripts must start from an explicit user click');
const startupTail=repairOnly.slice(repairOnly.indexOf('if(resumeRequiredNext())return;'),repairOnly.indexOf('const api=Object.freeze'));
assert.ok(!startupTail.includes('installHostNodeLobby();'),'installer startup must not boot host scripts before user intent');
assert.ok(!startupTail.includes('installHubRecovery();'),'installer startup must not boot recovery scripts before user intent');

assert.ok(installedEntryHtml.includes("const LAUNCH_SESSION_KEY='civweave.pwa.launch-session.v1'"),'installed-entry gate must use the session-scoped PWA launch key');
assert.ok(installedEntryHtml.includes('globalThis.launchQueue.setConsumer'),'installed-entry gate must consume the browser PWA launch event');
assert.ok(installedEntryHtml.includes("rememberLaunchSession('launch-queue')"),'PWA launch events must mint the session-scoped authorization');
assert.ok(installedEntryHtml.includes("policy:'installed-display-or-pwa-launch-session'"),'installed-entry gate must declare session-scoped authorization');
assert.ok(!installedEntryHtml.includes('getInstalledRelatedApps'),'installed-entry runtime authorization must not derive from related-app discovery');
assert.ok(!installedEntryHtml.includes('localStorage.setItem(INSTALL_CAPABILITY_KEY'),'installed-entry runtime must not persist authorization in localStorage');
assert.ok(installedEntry.includes('async function installedLaunchAuthorized()'),'installed bootstrap must use an asynchronous installed authorization boundary');
assert.ok(installedEntry.includes('await installedLaunchAuthorized()'),'installed bootstrap must await PWA launch authorization before redirecting');
assert.ok(installedEntry.includes("browserRuntimePolicy:'installed-display-or-pwa-launch-session'"),'installed bootstrap must declare launch-session runtime policy');
assert.ok(installedEntry.includes("revision=boot-recovery-v428-launch-session-v1"),'installed bootstrap must rotate the worker identity for the new launch boundary');
assert.ok(installedEntry.includes("updateViaCache:'none'")&&installedEntry.includes('bounded(registration.update()'),'installed entry must perform a bounded no-cache worker refresh');

assert.ok(boundary.includes("const LAUNCH_SESSION_KEY='civweave.pwa.launch-session.v1'"),'Working Campus boundary must use the same session-scoped PWA launch key');
assert.ok(boundary.includes('function allowed(){return installedDisplay()||launchSession()||developer()}'),'Working Campus must authorize only installed display, PWA launch session, or local developer mode');
assert.ok(boundary.includes("browserRuntimePolicy:'installed-display-or-pwa-launch-session'"),'Working Campus must preserve launch-session authorization');
assert.ok(boundary.includes('installedQueryIsAuthorization:false'),'installed=1 must remain non-authorizing');
assert.ok(!boundary.includes('civweave.pwa.installed-capability.v1'),'Working Campus must not retain the retired durable runtime capability');

assert.ok(workerRepair.includes("const V225_OPTIONAL_ASSETS = ['/app/installer-repair-only-v2.js']"),'future shell installs must cache the cache-distinct repair bridge v2');
assert.ok(!workerRepair.includes("const V225_OPTIONAL_ASSETS = ['/app/installer-repair-only-v1.js']"),'future shell installs must not seed the stale v1 repair bridge');
assert.ok(!workerRepair.includes("const V225_OPTIONAL_ASSETS = ['/app/installer-online-fallback-v225.js']"),'shell repair must not resurrect the retired browser fallback');
assert.ok(workerWrapper.includes('working-campus-return-v425-install-only-pwa-v1'),'worker core cache identity must carry install-only boundary');
assert.ok(workerWrapper.includes('shell-self-repair-v225-install-only-pwa-v1'),'worker wrapper must preserve the stable V225 repair module epoch');

const meta=JSON.parse(hostMeta);
assert.equal(meta.schema,'civweave.host-deployment.v1');
assert.equal(meta.publicOrigin,canonicalOrigin);

const any192=manifest.icons?.find(icon=>icon.sizes==='192x192'&&String(icon.purpose||'any').includes('any'));
const any512=manifest.icons?.find(icon=>icon.sizes==='512x512'&&String(icon.purpose||'any').includes('any'));
const mask512=manifest.icons?.find(icon=>icon.sizes==='512x512'&&String(icon.purpose||'').includes('maskable'));
assert.ok(any192&&any512&&mask512,'manifest must advertise 192, 512, and maskable install icons');
function localIconPath(src){assert.match(src,/^\/app\/logos\/[A-Za-z0-9._-]+\.png$/);return `public${src}`}
function pngDimensions(buffer,label){
  const signature=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  assert.ok(buffer.length>=33&&buffer.subarray(0,8).equals(signature),`${label} must be a real PNG`);
  assert.equal(buffer.toString('ascii',12,16),'IHDR',`${label} must contain IHDR`);
  return [buffer.readUInt32BE(16),buffer.readUInt32BE(20)];
}
const [bytes192,bytes512,bytesMask512]=await Promise.all([readBytes(localIconPath(any192.src)),readBytes(localIconPath(any512.src)),readBytes(localIconPath(mask512.src))]);
assert.deepEqual(pngDimensions(bytes192,'192 icon'),[192,192]);
assert.deepEqual(pngDimensions(bytes512,'512 icon'),[512,512]);
assert.deepEqual(pngDimensions(bytesMask512,'maskable 512 icon'),[512,512]);

console.log(JSON.stringify({
  ok:true,
  revision:'pwa-install-campus-v250-launch-session-v1',
  canonicalOrigin,
  stagingOrigin,
  previousCanonicalOrigin,
  browserRuntime:'installed-display-or-pwa-launch-session',
  installedMarkerAuthorizesRuntime:false,
  anonymousOnlineFallback:false,
  repairOnly:true,
  firstPaintShellWork:false,
  firstPaintHubWork:false,
  cacheDistinctInstallerPaths:true,
  stableWorkerEpoch:true,
  relatedOrigins:manifests.length
},null,2));
