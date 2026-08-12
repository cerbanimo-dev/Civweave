import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const readBytes=path=>readFile(new URL(path,root));
const [html,rootHtml,manifestText,assetlinksText,bridge,reminder,hostMeta,autostart,statusRuntime,workerRepair,workerWrapper,installedEntry,gateway]=await Promise.all([
  read('public/app/index.html'),
  read('public/index.html'),
  read('public/app/manifest.webmanifest'),
  read('public/.well-known/assetlinks.json'),
  read('public/app/pwa-install-prompt-v247.js'),
  read('public/app/host-steward-reminder-v1.js'),
  read('public/app/host-deployment-v1.json'),
  read('public/app/required-campus-autostart-v1.js'),
  read('public/app/offline-campus-status-v210.js'),
  read('public/service-worker-campus-completion-v246.js'),
  read('public/service-worker-v203.js'),
  read('public/app/installed-entry-v146.js'),
  read('server/gateway.mjs')
]);

const manifest=JSON.parse(manifestText);
assert.equal(manifest.display,'standalone');
assert.equal(manifest.prefer_related_applications,false);
assert.equal(manifest.id,'/civweave-local','PWA id must remain stable across host origins');
assert.match(manifest.start_url,/^\/app\/installed-entry-v146(?:\.html)?\?installed=1$/,'installed PWA must launch through updater entry');
assert.ok((manifest.shortcuts||[]).every(shortcut=>/^\/app\/installed-entry-v146(?:\.html)?\?/.test(String(shortcut.url||''))),'all installed shortcuts must pass through updater entry');
assert.ok(!manifestText.includes('working-campus-v156.html?installed=1&version='),'manifest must not pin an installed launch to an old Working Campus release');
assert.ok(installedEntry.includes("fetch(`/app/manifest.webmanifest?boot=${Date.now()}`,{cache:'no-store'})"),'installed entry must resolve current release without cache');
assert.ok(installedEntry.includes("updateViaCache:'none'"));
assert.ok(installedEntry.includes('await registration.update()'));
assert.ok(installedEntry.includes("candidate.postMessage({type:'SKIP_WAITING'})"),'installed entry must activate a waiting worker before routing');
assert.ok(installedEntry.indexOf('await refreshWorker(releaseVersion)')<installedEntry.indexOf('const requested='),'worker refresh must finish before installed route selection');

const canonicalOrigin='https://civweave.pages.dev';
const legacyCanonicalOrigin='https://commonweave.pages.dev';
const hostNodeOrigin='https://civweave-host-node.onrender.com';
const canonicalManifest=`${canonicalOrigin}/app/manifest.webmanifest`;
const legacyCanonicalManifest=`${legacyCanonicalOrigin}/app/manifest.webmanifest`;
const hostNodeManifest=`${hostNodeOrigin}/app/manifest.webmanifest`;
const related=manifest.related_applications||[];
assert.ok(related.some(app=>app.platform==='webapp'&&app.url===canonicalManifest),'manifest must prefer civweave.pages.dev for installed-related-app discovery');
assert.ok(related.some(app=>app.platform==='webapp'&&app.url===legacyCanonicalManifest),'manifest must retain legacy Commonweave discovery during origin migration');
assert.ok(related.some(app=>app.platform==='webapp'&&app.url===hostNodeManifest),'manifest must retain legacy Render discovery during migration');

const assetlinks=JSON.parse(assetlinksText);
const querySites=new Set(assetlinks.filter(entry=>(entry.relation||[]).includes('delegate_permission/common.query_webapk')).map(entry=>entry.target?.site));
assert.ok(querySites.has(canonicalManifest),'asset links must let the new canonical manifest query a related installed PWA');
assert.ok(querySites.has(legacyCanonicalManifest),'asset links must retain legacy canonical discovery during migration');
assert.ok(querySites.has(hostNodeManifest),'asset links must retain Render migration discovery');

assert.ok(rootHtml.includes(`const CANONICAL_ORIGIN='${canonicalOrigin}'`),'root entry must know the new canonical PWA origin');
assert.ok(rootHtml.includes(`const LEGACY_CANONICAL_ORIGIN='${legacyCanonicalOrigin}'`),'root entry must recognize the previous canonical origin');
assert.ok(rootHtml.includes("location.hostname.endsWith('.pages.dev')&&labels.length>3"),'root entry must recognize Pages preview/hash aliases');
assert.ok(rootHtml.includes("labels.slice(1).join('.')"),'preview root must resolve its own parent production host');
assert.ok(rootHtml.includes("target.searchParams.set('install_origin',cloudflarePreview?'host-production':'canonical')"),'root handoff must distinguish host-production recovery from canonical migration');

assert.ok(bridge.includes(`const CANONICAL_ORIGIN='${canonicalOrigin}'`),'native install bridge must name civweave.pages.dev as the OG root');
assert.ok(bridge.includes(`const LEGACY_CANONICAL_ORIGIN='${legacyCanonicalOrigin}'`),'native install bridge must recognize the legacy origin');
assert.ok(bridge.includes('function productionPagesOrigin()'),'native installer must recognize stable production Pages origins');
assert.ok(bridge.includes('function previewParentOrigin()'),'native installer must resolve preview aliases back to their host production origin');
assert.ok(bridge.includes('function stableInstallerUrl()'),'native installer must have a stable-origin recovery route');
assert.ok(bridge.includes('navigator.getInstalledRelatedApps()'),'installer must discover related legacy/canonical installs when supported');
assert.ok(bridge.includes("dataset.civweaveLegacyRenderInstall"),'related Render install state must be exposed to the app');
assert.ok(bridge.includes('/app/host-steward-reminder-v1.js'),'installer must load the steward Anchor reminder');
assert.ok(bridge.includes('This installed copy stays attached to the host you chose.'),'installer must preserve host identity in user messaging');

const meta=JSON.parse(hostMeta);
assert.equal(meta.schema,'civweave.host-deployment.v1');
assert.equal(meta.publicOrigin,canonicalOrigin);
assert.equal(meta.localAnchorRecommended,true);
assert.equal(meta.localAnchorRequired,false);
assert.ok(reminder.includes("civweave.host-steward.v1"),'Anchor reminder must only persist for steward browsers');
assert.ok(reminder.includes("civweave.host-anchor.paired.v1"),'Anchor reminder must remember completion');
assert.ok(reminder.includes('Remind me tomorrow'),'Anchor reminder must be persistent but non-blocking');
assert.ok(reminder.includes('/host-local-anchor.html'),'Anchor reminder must provide a setup path');

assert.ok(gateway.includes(canonicalOrigin),'legacy gateway must advertise the new canonical install origin');
assert.ok(gateway.includes('CIVWEAVE_INSTALL_ORIGIN'),'legacy gateway runtime must replace self-referential install URLs');
assert.ok(gateway.includes('releasePacketNeedle'),'legacy gateway release metadata must converge on the canonical installer');
assert.ok(gateway.includes('runtimeGateNeedle'),'installed-runtime recovery must point back to the canonical installer');
assert.ok(gateway.includes('configNeedle'),'public legacy host config must point back to the canonical installer');

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

const bridgeIndex=html.indexOf('/app/pwa-install-prompt-v247.js');
const manifestIndex=html.indexOf('rel="manifest"');
assert.ok(bridgeIndex>=0&&manifestIndex>=0&&bridgeIndex<manifestIndex,'native install bridge must load before manifest discovery');
assert.ok(html.includes('/app/pwa-install-prompt-v247.js?v=front-door-v2-open-after-install'),'installer must cache-bust the repaired Open-after-install bridge');
assert.ok(html.includes('/app/offline-campus-status-v210.js?v=1.0.116-current-manifest-only-v282'),'installer must cache-bust the current-manifest-only status reader');
assert.ok(bridge.includes("addEventListener('beforeinstallprompt',capture)"));
assert.ok(bridge.includes('await prompt.prompt()'));
assert.ok(bridge.includes("document.addEventListener('click',ownInstallClick,true)"),'install bridge must own the primary gesture before the legacy installer');
assert.ok(bridge.includes('Do not use Create shortcut'),'installer must distinguish a PWA install from a web shortcut');
assert.ok(bridge.includes('if(standalone()||installed)'),'accepted installs must make the primary action launchable before standalone display mode changes');
assert.ok(bridge.includes("button.textContent='Open Civweave'"),'accepted installs must immediately replace the transient install label');

const installWindowListeners=new Map();
const installDocumentListeners=new Map();
let assignedInstallUrl='';
const installButton={disabled:false,textContent:'Install Civweave'};
const installHelp={textContent:''};
const installDocument={
  readyState:'complete',
  documentElement:{dataset:{}},
  head:{append(){}},
  querySelector(selector){return selector==='#install-app'?installButton:selector==='#install-help'?installHelp:null},
  addEventListener(type,handler){installDocumentListeners.set(type,handler)},
  createElement(){return{async:false,src:'',dataset:{}}}
};
const installLocation={
  origin:canonicalOrigin,
  hostname:'civweave.pages.dev',
  href:`${canonicalOrigin}/app/index.html`,
  pathname:'/app/index.html',
  hash:'',
  assign(url){assignedInstallUrl=String(url)},
  replace(url){assignedInstallUrl=String(url)}
};
const installSandbox={
  console,URL,URLSearchParams,Promise,queueMicrotask,setTimeout,clearTimeout,
  CustomEvent:class CustomEvent{constructor(type,options){this.type=type;this.detail=options?.detail}},
  MutationObserver:class MutationObserver{observe(){}disconnect(){}},
  document:installDocument,
  location:installLocation,
  navigator:{standalone:false,getInstalledRelatedApps:async()=>[]},
  matchMedia:()=>({matches:false}),
  addEventListener(type,handler){installWindowListeners.set(type,handler)},
  dispatchEvent(){return true},
  globalThis:null
};
installSandbox.globalThis=installSandbox;
vm.createContext(installSandbox);
vm.runInContext(bridge,installSandbox,{filename:'pwa-install-prompt-v247.js'});
const nativePrompt={preventDefault(){},prompt:async()=>{},userChoice:Promise.resolve({outcome:'accepted'})};
installWindowListeners.get('beforeinstallprompt')(nativePrompt);
await Promise.resolve();
const primaryClick=installDocumentListeners.get('click');
const clickEvent={target:{closest:selector=>selector==='#install-app'?installButton:null},preventDefault(){},stopImmediatePropagation(){}};
await primaryClick(clickEvent);
assert.equal(installButton.textContent,'Open Civweave','accepted install remained stuck on its transient label');
assert.equal(installButton.disabled,false,'accepted install left the Open action disabled');
await primaryClick(clickEvent);
assert.match(assignedInstallUrl,/^\/app\/installed-entry-v146\?installed=1&system=civweave$/,'Open action did not route through the installed bootstrap');

assert.ok(!autostart.includes('civweave.pwa.install-accepted'),'campus download must not gate installation using a persisted install flag');
assert.ok(!autostart.includes("button.disabled=true"),'required campus autostart must never disable the install button');
assert.ok(!html.includes('campusLaunchReady'),'installer must not gate app launch on the campus percentage');

const sandbox={console,document:{querySelector:()=>null,documentElement:{dataset:{}}},navigator:{serviceWorker:null},addEventListener:()=>{},dispatchEvent:()=>{},CustomEvent:class CustomEvent{},setTimeout:()=>0,clearTimeout:()=>{}};
vm.createContext(sandbox);
vm.runInContext(statusRuntime,sandbox,{filename:'offline-campus-status-v210.js'});
const normalize=sandbox.CivweaveOfflineCampusStatusV210?.normalize;
assert.equal(typeof normalize,'function');
assert.equal(sandbox.CivweaveOfflineCampusStatusV210?.workerRevision,'offline-campus-current-graph-v280');
const current=normalize({type:'CIVWEAVE_OFFLINE_PACKAGE_STATUS',revision:'offline-campus-current-graph-v280',total:234,discovered:234,downloaded:217,completed:217,attempted:217,running:false,ready:false,failed:[],failedCount:0,skipped:Array.from({length:17},(_,index)=>({pathname:`/retired-${index}.js`})),skippedCount:17});
assert.equal(current.total,217,'retired references must be removed from current-campus denominator');
assert.equal(current.downloaded,217);
assert.equal(current.ready,true,'217 downloaded + 17 retired must complete a 234-item current graph ledger');
assert.equal(current.skippedCount,0,'obsolete references must not survive in current status metadata');

assert.ok(workerRepair.includes('retired-references-do-not-block-current-campus-readiness'));
assert.ok(workerRepair.includes('downloaded+skippedCount>=reportedTotal'));
assert.ok(workerRepair.includes('writeOfflineMeta'),'worker must repair persisted completion metadata');
assert.ok(workerWrapper.includes("importScripts('/service-worker-campus-completion-v246.js?v=campus-retired-completion-v246')"));
assert.ok(workerWrapper.includes('offline-campus-current-graph-v280'));
assert.ok(workerWrapper.includes('policy=resumable-pause-v280'));
assert.ok(workerWrapper.includes('chat-convergence-v250'),'worker wrapper must carry current convergence identity');
assert.ok(workerWrapper.includes("self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting())})"),'new worker must activate immediately');

console.log(JSON.stringify({ok:true,revision:'pwa-install-campus-v284-open-after-install-current-manifest-only',workerRevision:'offline-campus-current-graph-v280',manifestIcons:{any192:pngDimensions(bytes192,'192 install icon'),any512:pngDimensions(bytes512,'512 install icon'),maskable512:pngDimensions(bytesMask512,'maskable 512 install icon')},obsoleteReferencesRetained:0,nativeInstallBridge:true,openAfterInstall:true,installedLaunch:'updater-first',canonicalInstallOrigin:canonicalOrigin,productionHostsInstallable:true,previewFallsToHostProduction:true,localAnchorReminder:true,frontDoorBridge:'/app/pwa-install-prompt-v247.js'},null,2));
