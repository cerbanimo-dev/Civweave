import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const readBytes=path=>readFile(new URL(path,root));
const [html,rootHtml,manifestText,assetlinksText,installer,bootstrap,workerRepair,workerWrapper,installedEntryHtml,installedEntry,hostMeta]=await Promise.all([
  read('public/app/index.html'),
  read('public/index.html'),
  read('public/app/manifest.webmanifest'),
  read('public/.well-known/assetlinks.json'),
  read('public/install-v130.js'),
  read('public/service-worker-install-v1.js'),
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
const hostNodeOrigin='https://civweave-host-node.onrender.com';
const manifests=[canonicalOrigin,previousCanonicalOrigin,hostNodeOrigin].map(origin=>`${origin}/app/manifest.webmanifest`);
const related=new Set((manifest.related_applications||[]).filter(app=>app.platform==='webapp').map(app=>app.url));
for(const url of manifests)assert.ok(related.has(url),`manifest must retain installed-app discovery for ${url}`);
assert.equal(related.size,manifests.length,'manifest must not retain obsolete related-app origins');

const assetlinks=JSON.parse(assetlinksText);
const querySites=new Set(assetlinks.filter(entry=>(entry.relation||[]).includes('delegate_permission/common.query_webapk')).map(entry=>entry.target?.site));
for(const url of manifests)assert.ok(querySites.has(url),`asset links must allow installed-app discovery for ${url}`);
assert.equal(querySites.size,manifests.length,'asset links must not retain obsolete install origins');

assert.ok(rootHtml.includes(`const CANONICAL_ORIGIN='${canonicalOrigin}'`),'root entry must know civweave.cc as the canonical PWA origin');
assert.ok(rootHtml.includes(`const PREVIOUS_CANONICAL_ORIGIN='${previousCanonicalOrigin}'`),'root entry must retain the previous Civweave Pages origin during migration');
assert.ok(!rootHtml.includes('LEGACY_CANONICAL_ORIGIN'),'root entry must not retain obsolete legacy install-origin routing');

assert.ok(!html.includes('id="open-online-campus-v225"'),'installer must not expose an online-campus fallback button');
assert.ok(!html.includes('Browser fallback'),'installer must not advertise browser runtime fallback');
assert.ok(!html.includes('/app/installer-online-fallback-v225.js'),'installer must not load the retired online fallback bridge');
assert.ok(html.includes('Civweave installs in two local stages. The campus is required;'),'installer must explain the required local package before browser installation');
assert.ok(html.includes('Required local campus'),'installer must visibly distinguish required campus code from optional models/media/knowledge');
assert.ok(html.includes('/app/images/install/anarchadia-01-arrival.webp')&&html.includes('/app/images/install/anarchadia-05-commons.webp'),'installer must retain the Anarchadia wait-story slots');

assert.ok(installer.includes("BOOTSTRAP_BUILD='installer-bootstrap-v1-local-first'"),'installer must use the local-first bootstrap worker');
assert.ok(installer.includes('ensureLocalPackage'),'browser install must wait for the local campus');
assert.ok(installer.includes("'x-civweave-package':'campus-preflight'"),'campus acquisition must be explicitly marked as package installation');
assert.ok(installer.includes('Installation will wait rather than fall back to an online runtime.'),'incomplete package must block installation rather than create a thin client');
assert.ok(bootstrap.includes('offlinePackageOptional: false'),'bootstrap must not label required campus code optional');
assert.ok(bootstrap.includes('localCampusRequiredForLaunch: true'),'bootstrap must require local campus before launch');
assert.ok(bootstrap.includes('runtimeNetworkFallback: false'),'bootstrap runtime must not fetch missing code from the network');
assert.ok(bootstrap.includes("error: 'LOCAL_PACKAGE_REQUIRED'"),'missing package must fail visibly');

assert.ok(installedEntryHtml.indexOf('installed-entry-browser-gate-v1')<installedEntryHtml.indexOf('<title>Civweave</title>'),'installed-entry browser gate must execute before boot UI paint');
assert.ok(installedEntryHtml.includes('location.replace(installer.href)'),'ordinary browser display must redirect to installer before boot UI');
assert.ok(installedEntry.includes('if(!installedDisplay()&&!localDeveloper())'),'installed bootstrap must enforce display mode again at runtime');
assert.ok(installedEntry.includes("browserRuntimePolicy:'installed-display-cache-only'"),'installed bootstrap must declare cache-only installed runtime policy');
assert.ok(installedEntry.includes('allowProvision:localDeveloper()'),'production installed launch must not provision the full worker implicitly');
assert.ok(installedEntry.includes('installed-entry-local-package-required'),'missing local campus must return to package installation');

assert.ok(workerRepair.includes("const V225_OPTIONAL_ASSETS = ['/app/installer-repair-only-v1.js']"),'shell repair may retain the repair-only bridge as a package asset');
assert.ok(workerRepair.includes('runtimeAutoRepair: false'),'shell status must not trigger automatic repair downloads');
assert.ok(workerRepair.includes('explicit-repair-only-report-missing-without-runtime-fetch'),'shell repair must require explicit acquisition intent');
assert.ok(workerWrapper.includes('working-campus-return-v425-install-only-pwa-v1'),'worker core cache identity must carry install-only boundary');
assert.ok(workerWrapper.includes('shell-self-repair-v225-install-only-pwa-v1-local-first'),'worker repair import must carry local-first boundary');
assert.ok(workerWrapper.includes('canonical-five-system-navigation-v227-local-first'),'canonical navigation must carry the local-first epoch');

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
  revision:'pwa-install-campus-v250-local-package-first',
  canonicalOrigin,
  previousCanonicalOrigin,
  browserRuntime:'installed-display-cache-only',
  localCampusRequired:true,
  runtimeNetworkFallback:false,
  onlineFallback:false,
  repairOnly:true,
  relatedOrigins:manifests.length
},null,2));
