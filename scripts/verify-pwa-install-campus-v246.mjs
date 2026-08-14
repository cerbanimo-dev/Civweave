import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const readBytes=path=>readFile(new URL(path,root));
const [html,rootHtml,manifestText,assetlinksText,bridge,repairOnly,workerRepair,workerWrapper,installedEntryHtml,installedEntry,hostMeta]=await Promise.all([
  read('public/app/index.html'),
  read('public/index.html'),
  read('public/app/manifest.webmanifest'),
  read('public/.well-known/assetlinks.json'),
  read('public/app/pwa-install-prompt-v249.js'),
  read('public/app/installer-repair-only-v1.js'),
  read('public/service-worker-shell-repair-v225.js'),
  read('public/service-worker-v203.js'),
  read('public/app/installed-entry-v146.html'),
  read('public/app/installed-entry-v146.js'),
  read('public/app/host-deployment-v1.json')
]);

const manifest=JSON.parse(manifestText);
assert.equal(manifest.display,'standalone');
assert.equal(manifest.prefer_related_applications,false);
assert.equal(manifest.id,'/civweave-local','PWA id must remain stable across host origins');
assert.match(manifest.start_url,/^\/app\/installed-entry-v146(?:\.html)?\?installed=1$/,'installed PWA must launch through updater entry');
assert.ok((manifest.shortcuts||[]).every(shortcut=>/^\/app\/installed-entry-v146(?:\.html)?\?/.test(String(shortcut.url||''))),'all installed shortcuts must pass through updater entry');

const canonicalOrigin='https://civweave.cc';
const previousCanonicalOrigin='https://civweave.pages.dev';
const legacyCanonicalOrigin='https://commonweave.pages.dev';
const hostNodeOrigin='https://civweave-host-node.onrender.com';
const manifests=[canonicalOrigin,previousCanonicalOrigin,legacyCanonicalOrigin,hostNodeOrigin].map(origin=>`${origin}/app/manifest.webmanifest`);
const related=new Set((manifest.related_applications||[]).filter(app=>app.platform==='webapp').map(app=>app.url));
for(const url of manifests)assert.ok(related.has(url),`manifest must retain installed-app discovery for ${url}`);

const assetlinks=JSON.parse(assetlinksText);
const querySites=new Set(assetlinks.filter(entry=>(entry.relation||[]).includes('delegate_permission/common.query_webapk')).map(entry=>entry.target?.site));
for(const url of manifests)assert.ok(querySites.has(url),`asset links must allow installed-app discovery for ${url}`);

assert.ok(rootHtml.includes(`const CANONICAL_ORIGIN='${canonicalOrigin}'`),'root entry must know civweave.cc as the canonical PWA origin');
assert.ok(rootHtml.includes(`const PREVIOUS_CANONICAL_ORIGIN='${previousCanonicalOrigin}'`),'root entry must retain the previous Pages origin during migration');
assert.ok(rootHtml.includes(`const LEGACY_CANONICAL_ORIGIN='${legacyCanonicalOrigin}'`),'root entry must retain the legacy Commonweave origin during migration');
assert.ok(rootHtml.includes("location.hostname.endsWith('.pages.dev')&&labels.length>3"),'root entry must recognize Pages preview aliases');
assert.ok(rootHtml.includes("labels.slice(1).join('.')"),'preview root must resolve its parent production host');
assert.ok(rootHtml.includes("target.searchParams.set('install_origin',cloudflarePreview?'host-production':'canonical')"),'root handoff must distinguish host-production recovery from canonical migration');

assert.ok(bridge.includes(`const CANONICAL_ORIGIN='${canonicalOrigin}'`),'native install bridge must name civweave.cc as canonical');
assert.ok(bridge.includes(`const PREVIOUS_CANONICAL_ORIGIN='${previousCanonicalOrigin}'`),'native install bridge must retain the Pages migration origin');
assert.ok(bridge.includes(`const LEGACY_CANONICAL_ORIGIN='${legacyCanonicalOrigin}'`),'native install bridge must retain the Commonweave migration origin');
assert.ok(bridge.includes('navigator.getInstalledRelatedApps()'),'installer must discover related installs when supported');
assert.ok(bridge.includes("browserRuntimePolicy:'installer-only-until-installed-display'"),'installer bridge must declare installer-only browser policy');
assert.ok(bridge.includes("promptAvailabilityPolicy:'prepare-shell-then-wait-for-beforeinstallprompt'"),'installer must prepare the shell before waiting for a native prompt');
assert.ok(bridge.includes("if(standalone())")&&bridge.includes("if(installed){"),'installer must distinguish installed display from merely accepted installation');
assert.ok(bridge.includes('Open Civweave from your device app launcher')||bridge.includes('device app launcher'),'accepted browser installation must direct launch through the device app launcher');

assert.ok(!html.includes('id="open-online-campus-v225"'),'installer must not expose an online-campus fallback button');
assert.ok(!html.includes('Browser fallback'),'installer must not advertise browser runtime fallback');
assert.ok(!html.includes('/app/installer-online-fallback-v225.js'),'installer must not load the retired online fallback bridge');
assert.ok(html.includes('/app/pwa-install-prompt-v249.js'),'installer must load the current cache-distinct v249 install bridge');
assert.ok(html.includes('/app/installer-repair-only-v1.js?v=install-only-pwa-v1'),'installer must load the repair-only bridge');
assert.ok(html.includes('Launch Civweave from your device app launcher'),'installer headline must describe installed-app launch');

assert.ok(repairOnly.includes('function installedDisplay()'),'repair bridge must prove installed display before resuming runtime');
assert.ok(repairOnly.includes("if(!required||!rawNext||!installedDisplay())return false"),'stale required-next state must not open runtime in a browser tab');
assert.ok(!repairOnly.includes("launch','online"),'repair bridge must not synthesize an online campus launch');
assert.ok(repairOnly.includes("browserRuntimePolicy:'installer-only-until-installed-display'"),'repair bridge must declare installer-only browser policy');

assert.ok(installedEntryHtml.indexOf('installed-entry-browser-gate-v1')<installedEntryHtml.indexOf('<title>Civweave</title>'),'installed-entry browser gate must execute before boot UI paint');
assert.ok(installedEntryHtml.includes("location.replace(installer.href)"),'ordinary browser display must redirect to installer before boot UI');
assert.ok(installedEntry.includes("if(!installedDisplay()&&!localDeveloper())"),'installed bootstrap must enforce display mode again at runtime');
assert.ok(installedEntry.includes("browserRuntimePolicy:'installed-display-only'"),'installed bootstrap must declare installed-display-only runtime policy');
assert.ok(installedEntry.includes("updateViaCache:'none'")&&installedEntry.includes('bounded(registration.update()'),'installed entry must perform a bounded no-cache worker refresh');

assert.ok(workerRepair.includes("const V225_OPTIONAL_ASSETS = ['/app/installer-repair-only-v1.js']"),'shell repair must cache the repair-only bridge');
assert.ok(!workerRepair.includes("const V225_OPTIONAL_ASSETS = ['/app/installer-online-fallback-v225.js']"),'shell repair must not resurrect the retired browser fallback');
assert.ok(workerWrapper.includes('working-campus-return-v425-install-only-pwa-v1'),'worker core cache identity must carry install-only boundary');
assert.ok(workerWrapper.includes('shell-self-repair-v225-install-only-pwa-v1'),'worker repair import must carry install-only boundary');

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
  revision:'pwa-install-campus-v249-first-input-safe',
  canonicalOrigin,
  previousCanonicalOrigin,
  browserRuntime:'installed-display-only',
  onlineFallback:false,
  repairOnly:true,
  workerCacheBusted:true,
  relatedOrigins:manifests.length
},null,2));