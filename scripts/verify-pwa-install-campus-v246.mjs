import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const readBytes=path=>readFile(new URL(path,root));
const [html,rootHtml,manifestText,assetlinksText,bridge,workerRepair,workerWrapper,installedEntryHtml,installedEntry,hostMeta]=await Promise.all([
  read('public/app/index.html'),
  read('public/index.html'),
  read('public/app/manifest.webmanifest'),
  read('public/.well-known/assetlinks.json'),
  read('public/app/pwa-install-prompt-v249.js'),
  read('public/service-worker-shell-repair-v293.js'),
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
const pagesUnderlayOrigin='https://civweave.pages.dev';
const manifests=[canonicalOrigin,pagesUnderlayOrigin].map(origin=>`${origin}/app/manifest.webmanifest`);
const related=new Set((manifest.related_applications||[]).filter(app=>app.platform==='webapp').map(app=>app.url));
assert.equal(related.size,manifests.length,'manifest must list only current root install relationships');
for(const url of manifests)assert.ok(related.has(url),`manifest must retain installed-app discovery for ${url}`);

const assetlinks=JSON.parse(assetlinksText);
const querySites=new Set(assetlinks.filter(entry=>(entry.relation||[]).includes('delegate_permission/common.query_webapk')).map(entry=>entry.target?.site));
assert.equal(querySites.size,manifests.length,'asset links must list only current root install relationships');
for(const url of manifests)assert.ok(querySites.has(url),`asset links must allow installed-app discovery for ${url}`);

assert.ok(rootHtml.includes(`const CANONICAL_ORIGIN='${canonicalOrigin}'`));
assert.ok(rootHtml.includes(`const PAGES_UNDERLAY_ORIGIN='${pagesUnderlayOrigin}'`));
assert.ok(!rootHtml.includes('LEGACY_CANONICAL_ORIGIN')&&!rootHtml.includes('HOST_NODE_ORIGIN'));
assert.ok(bridge.includes(`const CANONICAL_ORIGIN='${canonicalOrigin}'`));
assert.ok(bridge.includes(`const PAGES_UNDERLAY_ORIGIN='${pagesUnderlayOrigin}'`));
assert.ok(bridge.includes('navigator.getInstalledRelatedApps()'));
assert.ok(bridge.includes("browserRuntimePolicy:'installer-only-until-installed-display'"));
assert.ok(bridge.includes("installSequencingPolicy:'prepare-shell-before-user-install-gesture'"));
assert.ok(bridge.includes("promptAvailabilityPolicy:'capture-beforeinstallprompt-then-prompt-synchronously-on-click'"));
assert.ok(bridge.includes('eagerShellPreparation:true'));
assert.ok(bridge.includes('function resumeRequiredNext()'));
assert.ok(bridge.includes("requiredNextOwner:'pwa-install-prompt-v249'"));
assert.ok(bridge.includes("if(!required||!rawNext||!standalone())return false"),'required-next recovery must require installed display mode');
assert.ok(!bridge.includes('REPAIR_DEVICE_PACKAGE'),'ordinary installer owner must not invoke installed-shell repair');

for(const retired of ['public/app/installer-repair-only-v1.js','public/app/installer-online-fallback-v225.js','public/service-worker-shell-repair-v225.js'])assert.equal(existsSync(new URL(retired,root)),false,`${retired} must be physically retired`);
assert.ok(!html.includes('installer-repair-only-v1.js')&&!html.includes('installer-online-fallback-v225.js'),'installer must not load post-paint repair sidecars');
for(const script of ['/app/host-node-session-v1.js','/app/host-node-installer-lobby-v1.js','/app/host-node-session-export-v1.js','/app/host-node-session-import-v1.js','/app/hub-recovery-api-v1.js','/app/hub-recovery-ui-v1.js','/app/hub-mail-claim-v1.js'])assert.ok(html.includes(script),`installer source must directly own ${script}`);
assert.ok(html.includes('/app/pwa-install-prompt-v249.js'));
assert.ok(html.includes('Launch Civweave from your device app launcher'));

assert.ok(installedEntryHtml.indexOf('installed-entry-browser-gate-v1')<installedEntryHtml.indexOf('<title>Civweave</title>'));
assert.ok(installedEntryHtml.includes("location.replace(installer.href)"));
assert.ok(installedEntry.includes("if(!installedDisplay()&&!localDeveloper())"));
assert.ok(installedEntry.includes("browserRuntimePolicy:'installed-display-only'"));
assert.ok(installedEntry.includes("updateViaCache:'none'")&&installedEntry.includes('bounded(registration.update()'));

assert.ok(workerRepair.includes("if (event.data?.type !== 'REPAIR_DEVICE_PACKAGE') return"),'v293 must own explicit installed-shell repair messaging');
assert.ok(workerRepair.includes("policy: 'verified-shell-only-preserve-campus-model-school-storage'"),'v293 repair must preserve protected storage');
assert.ok(workerWrapper.includes('service-worker-shell-repair-v293.js?v=installed-shell-repair-v293'));
assert.ok(!workerWrapper.includes('service-worker-shell-repair-v225.js'),'worker wrapper must not resurrect v225 repair owner');

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

console.log(JSON.stringify({ok:true,revision:'pwa-install-campus-v249-source-truth-no-repair-sidecar',canonicalOrigin,pagesUnderlayOrigin,browserRuntime:'installed-display-only',requiredNextOwner:'pwa-install-prompt-v249',installedShellRepair:'v293-sole-owner',onlineFallback:false,repairSidecar:false,relatedOrigins:manifests.length},null,2));