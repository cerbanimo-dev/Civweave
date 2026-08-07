import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [html,manifestText,bridge,autostart,statusRuntime,workerRepair,workerWrapper]=await Promise.all([
  read('public/app/index.html'),
  read('public/app/manifest.webmanifest'),
  read('public/app/pwa-install-prompt-v246.js'),
  read('public/app/required-campus-autostart-v1.js'),
  read('public/app/offline-campus-status-v210.js'),
  read('public/service-worker-campus-completion-v246.js'),
  read('public/service-worker-v203.js')
]);

const manifest=JSON.parse(manifestText);
assert.equal(manifest.display,'standalone');
assert.equal(manifest.prefer_related_applications,false);
assert.ok(manifest.start_url?.includes('/app/working-campus-v156.html'));
assert.ok(manifest.icons?.some(icon=>icon.sizes==='192x192'&&String(icon.purpose||'any').includes('any')),'manifest must advertise a 192x192 app icon');
assert.ok(manifest.icons?.some(icon=>icon.sizes==='512x512'&&String(icon.purpose||'any').includes('any')),'manifest must advertise a 512x512 app icon');
assert.ok(manifest.icons?.some(icon=>String(icon.purpose||'').includes('maskable')),'manifest must retain a maskable icon');

const bridgeIndex=html.indexOf('/app/pwa-install-prompt-v246.js');
const manifestIndex=html.indexOf('rel="manifest"');
assert.ok(bridgeIndex>=0&&manifestIndex>=0&&bridgeIndex<manifestIndex,'native install bridge must load before manifest discovery');
assert.ok(bridge.includes("addEventListener('beforeinstallprompt',capture)"));
assert.ok(bridge.includes('await prompt.prompt()'));
assert.ok(bridge.includes("document.addEventListener('click',ownInstallClick,true)"),'install bridge must own the primary gesture before the legacy installer');
assert.ok(bridge.includes('Do not use Create shortcut'),'installer must distinguish a PWA install from a web shortcut');

assert.ok(!autostart.includes('civweave.pwa.install-accepted'),'campus download must not gate installation using a persisted install flag');
assert.ok(!autostart.includes("button.disabled=true"),'required campus autostart must never disable the install button');
assert.ok(!html.includes('campusLaunchReady'),'installer must not gate app launch on the campus percentage');

const sandbox={
  console,
  document:{querySelector:()=>null,documentElement:{dataset:{}}},
  navigator:{serviceWorker:null},
  addEventListener:()=>{},
  dispatchEvent:()=>{},
  CustomEvent:class CustomEvent{},
  setTimeout:()=>0,
  clearTimeout:()=>{}
};
vm.createContext(sandbox);
vm.runInContext(statusRuntime,sandbox,{filename:'offline-campus-status-v210.js'});
const normalize=sandbox.CivweaveOfflineCampusStatusV210?.normalize;
assert.equal(typeof normalize,'function');
const legacy=normalize({
  type:'CIVWEAVE_OFFLINE_PACKAGE_STATUS',
  revision:'offline-campus-current-graph-v238',
  total:234,
  discovered:234,
  downloaded:217,
  completed:217,
  attempted:217,
  running:false,
  ready:false,
  failed:[],
  failedCount:0,
  skipped:Array.from({length:17},(_,index)=>({pathname:`/retired-${index}.js`})),
  skippedCount:17
});
assert.equal(legacy.total,217,'retired references must be removed from the current-campus denominator');
assert.equal(legacy.downloaded,217);
assert.equal(legacy.ready,true,'217 downloaded + 17 retired must complete a legacy 234-item ledger');

assert.ok(workerRepair.includes('retired-references-do-not-block-current-campus-readiness'));
assert.ok(workerRepair.includes('downloaded+skippedCount>=reportedTotal'));
assert.ok(workerRepair.includes('writeOfflineMeta'),'worker must repair persisted completion metadata');
assert.ok(workerWrapper.includes("importScripts('/service-worker-campus-completion-v246.js?v=campus-retired-completion-v246')"));

console.log('PWA install + campus completion v246 verification passed.');
