import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await import('./sync-release-version-assets.mjs');
await import('./sync-release-coherence-v220.mjs');
const read=relative=>readFile(path.join(root,relative),'utf8');
const [manifestText,campusHtml,campusLoader,lifecycle,pwa,viewport,additions,workerCore]=await Promise.all([
  read('public/app/manifest.webmanifest'),
  read('public/app/working-campus-v156.html'),
  read('public/app/working-campus-v156.js'),
  read('public/app/document-lifecycle-v221.js'),
  read('public/app/pwa-update-controller-v204.js'),
  read('public/app/persistent-guide-viewport-v216.js'),
  read('public/extensions/commonweave-additions-v156.js'),
  read('public/service-worker-core-v208.js')
]);
const manifest=JSON.parse(manifestText);
assert.match(manifest.start_url,/^\/app\/working-campus-v156\.html\?/,'Installed PWA still starts on the empty /app/ launcher.');
assert(campusHtml.indexOf('/app/document-lifecycle-v221.js')<campusHtml.indexOf('/app/install-boundary-v146.js'),'Lifecycle guard must load before install-boundary additions.');
assert(campusLoader.includes("cache:'no-store'"),'Working Campus fragments are not fetched fresh.');
assert(!campusLoader.includes("cache:'force-cache'"),'Working Campus still forces stale fragment cache.');
for(const token of ['campusReady()','pagehide','beforeunload','revision','document.getElementById(id)']){
  assert(campusLoader.includes(token),`Working Campus loader is missing ${token}.`);
}
for(const token of ['CommonweaveLifecycleMutationObserver',"addEventListener('pagehide',stop","Object.defineProperty(document,'head'"]){
  assert(lifecycle.includes(token),`Document lifecycle guard is missing ${token}.`);
}
assert(pwa.includes('if(!document.documentElement?.isConnected||!document.head||!document.body)return null;'),'PWA update controller can mount into a detached document.');
assert(pwa.includes("addEventListener('pagehide',()=>{observer?.disconnect();button=null;},{once:true});"),'PWA update observer does not stop on pagehide.');
assert(viewport.includes("addEventListener('pagehide',destroy,{once:true});"),'Persistent guide viewport does not stop on pagehide.');
assert(viewport.includes('const head=document.head;if(!head)return false;head.append(style);return true;'),'Persistent guide viewport still appends to a missing head.');
assert(additions.includes('Document navigation interrupted script loading.'),'Shared additions still append dependencies during navigation teardown.');
assert(additions.includes('document.body?.append(tools)')&&additions.includes('document.body?.append(dialog)'),'Shared additions still require a live body during teardown.');
assert(workerCore.includes("'/app/document-lifecycle-v221.js'"),'Lifecycle guard is missing from the required app shell.');
for(const [name,source] of [['campus loader',campusLoader],['lifecycle guard',lifecycle],['PWA update controller',pwa],['persistent viewport',viewport],['shared additions',additions]]){
  assert.doesNotThrow(()=>new vm.Script(source,{filename:name}),`${name} does not compile after lifecycle synchronization.`);
}
console.log(JSON.stringify({ok:true,revision:'document-lifecycle-v221',directCampusStart:true,teardownSafe:true,freshCampusFragments:true},null,2));
