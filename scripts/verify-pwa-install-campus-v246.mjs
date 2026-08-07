import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const readBytes=path=>readFile(new URL(path,root));
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

const any192=manifest.icons?.find(icon=>icon.sizes==='192x192'&&String(icon.purpose||'any').includes('any'));
const any512=manifest.icons?.find(icon=>icon.sizes==='512x512'&&String(icon.purpose||'any').includes('any'));
const mask512=manifest.icons?.find(icon=>icon.sizes==='512x512'&&String(icon.purpose||'').includes('maskable'));
assert.ok(any192,'manifest must advertise a 192x192 app icon');
assert.ok(any512,'manifest must advertise a 512x512 app icon');
assert.ok(mask512,'manifest must retain a maskable 512x512 icon');
assert.notEqual(any512.src,'/app/logos/civweave-canonical.png','malformed canonical display PNG must not be used for PWA installation');
assert.ok((manifest.shortcuts||[]).every(shortcut=>(shortcut.icons||[]).every(icon=>icon.src!=='/app/logos/civweave-canonical.png')),'manifest shortcuts must not use malformed canonical display PNG');

function localIconPath(src){
  assert.match(src,/^\/app\/logos\/[A-Za-z0-9._-]+\.png$/,'install icon must be a local PNG');
  return `public${src}`;
}
function pngDimensions(buffer,label){
  const signature=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  assert.ok(buffer.length>=33,`${label} is too short to be a usable PNG`);
  assert.ok(buffer.subarray(0,8).equals(signature),`${label} has an invalid PNG signature`);
  assert.equal(buffer.toString('ascii',12,16),'IHDR',`${label} is missing its IHDR chunk`);
  const width=buffer.readUInt32BE(16),height=buffer.readUInt32BE(20);
  assert.ok(width>0&&height>0,`${label} has invalid PNG dimensions`);
  assert.ok(buffer.includes(Buffer.from('IDAT')),`${label} is missing image data`);
  assert.ok(buffer.includes(Buffer.from('IEND')),`${label} is missing its end chunk`);
  return [width,height];
}
const [bytes192,bytes512,bytesMask512]=await Promise.all([
  readBytes(localIconPath(any192.src)),
  readBytes(localIconPath(any512.src)),
  readBytes(localIconPath(mask512.src))
]);
assert.deepEqual(pngDimensions(bytes192,'192 install icon'),[192,192],'192 manifest declaration must match raw PNG pixels');
assert.deepEqual(pngDimensions(bytes512,'512 install icon'),[512,512],'512 manifest declaration must match raw PNG pixels');
assert.deepEqual(pngDimensions(bytesMask512,'maskable 512 install icon'),[512,512],'maskable manifest declaration must match raw PNG pixels');
assert.notDeepEqual(bytes192,bytes512,'192 and 512 install icons must not be the same mislabeled binary');

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

console.log(JSON.stringify({
  ok:true,
  revision:'pwa-install-campus-v247',
  manifestIcons:{any192:pngDimensions(bytes192,'192 install icon'),any512:pngDimensions(bytes512,'512 install icon'),maskable512:pngDimensions(bytesMask512,'maskable 512 install icon')},
  retiredCampusLedger:true,
  nativeInstallBridge:true
},null,2));
