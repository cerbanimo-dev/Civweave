import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await import('./sync-release-version-assets.mjs');
await import('./sync-release-coherence-v220.mjs');
const read=relative=>readFile(path.join(root,relative),'utf8');
const [manifestText,campusHtml,campusLoader,lifecycle,installBoundary,pwa,viewport,guideChat,additions,workerCore]=await Promise.all([
  read('public/app/manifest.webmanifest'),
  read('public/app/working-campus-v156.html'),
  read('public/app/working-campus-v156.js'),
  read('public/app/document-lifecycle-v221.js'),
  read('public/app/install-boundary-v146.js'),
  read('public/app/pwa-update-controller-v204.js'),
  read('public/app/persistent-guide-viewport-v216.js'),
  read('public/app/persistent-guide-chat-v215.js'),
  read('public/extensions/commonweave-additions-v156.js'),
  read('public/service-worker-core-v208.js')
]);
const manifest=JSON.parse(manifestText);
assert.match(manifest.start_url,/^\/app\/working-campus-v156\.html\?/,'Installed PWA still starts on the empty /app/ launcher.');
assert(campusHtml.indexOf('/app/document-lifecycle-v221.js')<campusHtml.indexOf('/app/install-boundary-v146.js'),'Lifecycle guard must load before install-boundary additions.');
assert(campusHtml.includes('/app/document-lifecycle-v221.js?v=document-lifecycle-v222'),'Working Campus does not request the safe lifecycle revision.');
assert(campusHtml.includes('/app/working-campus-v156.js?v=canonical-campus-startup-v223'),'Working Campus does not request the canonical loader revision.');
assert(campusLoader.includes("cache:'no-store'"),'Working Campus fragments are not fetched fresh.');
assert(!campusLoader.includes("cache:'force-cache'"),'Working Campus still forces stale fragment cache.');
for(const token of ['Promise.all(parts.map(fetchPart))','campusReady()','commonweave:working-campus-runtime-ready','commonweaveCampusRuntime','document.documentElement===bootDocument','location.href===bootUrl'])assert(campusLoader.includes(token),`Working Campus loader is missing ${token}.`);
assert(!campusLoader.includes('sameCampus()'),'Working Campus still aborts on ordinary DOM identity changes.');
for(const token of ['function canonicalAppSurface()','function startAdditions()','commonweave:working-campus-runtime-ready',"boundaryRevision:'canonical-campus-boundary-v223'"])assert(installBoundary.includes(token),`Install boundary is missing ${token}.`);
assert(installBoundary.includes("location.pathname==='/app/working-campus-v156.html'"),'Canonical Working Campus is not explicitly authorized.');
assert(installBoundary.indexOf('function startAdditions()')<installBoundary.indexOf("if(!allowed())"),'Delayed additions boundary is not installed before route enforcement.');
for(const token of ['document-lifecycle-v222','CommonweaveLifecycleMutationObserver',"addEventListener('pagehide',stop"]){assert(lifecycle.includes(token),`Document lifecycle guard is missing ${token}.`)}
assert(!lifecycle.includes("Object.defineProperty(document,'head'")&&!lifecycle.includes("Object.defineProperty(document,'body'"),'Lifecycle guard still overrides native document structure.');
for(const token of ['v222-atomic-campus-update-handoff','commonweave:working-campus-runtime-ready','activateWaiting','setTimeout(queueAutomaticCheck,45000)'])assert(pwa.includes(token),`PWA update controller is missing ${token}.`);
assert(!pwa.includes("if(worker.state==='installed'&&reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'})"),'PWA update controller still auto-activates an installed worker.');
assert(viewport.includes("addEventListener('pagehide',destroy,{once:true});"),'Persistent guide viewport does not stop on pagehide.');
assert(viewport.includes('const head=document.head;if(!head)return false;head.append(style);return true;'),'Persistent guide viewport still appends to a missing head.');
assert(!guideChat.includes('.cwp215-working-campus-retired>.main')&&!guideChat.includes('.cwp215-working-campus-retired .main>.guide'),'Persistent guide still hides the native Working Campus.');
assert(guideChat.includes("classList.remove('cwp215-working-campus-retired')"),'Persistent guide does not recover a previously hidden campus.');
assert(guideChat.includes("form.id==='weaveling-chat-form'&&form.closest('.app')"),'Persistent guide still intercepts the native Working Campus form.');
assert(additions.includes('Document navigation interrupted script loading.'),'Shared additions still append dependencies during navigation teardown.');
assert(additions.includes('document.body?.append(tools)')&&additions.includes('document.body?.append(dialog)'),'Shared additions still require a live body during teardown.');
assert(workerCore.includes("'/app/document-lifecycle-v221.js'"),'Lifecycle guard is missing from the required app shell.');
const installBlock=workerCore.match(/self\.addEventListener\('install',[\s\S]*?\n\}\);/)?.[0]||'';
assert(installBlock.includes('event.waitUntil(cacheShell())'),'Service worker install does not cache the shell.');
assert(!installBlock.includes('skipWaiting'),'Service worker still takes over active pages during installation.');
assert(workerCore.includes("if (type === 'SKIP_WAITING')"),'Explicit update activation message was removed.');
for(const [name,source] of [['campus loader',campusLoader],['lifecycle guard',lifecycle],['install boundary',installBoundary],['PWA update controller',pwa],['persistent viewport',viewport],['persistent guide chat',guideChat],['shared additions',additions]])assert.doesNotThrow(()=>new vm.Script(source,{filename:name}),`${name} does not compile after startup synchronization.`);
console.log(JSON.stringify({ok:true,revision:'canonical-campus-startup-v223',directCampusStart:true,canonicalBoundary:true,delayedAdditions:true,nonInterruptingWorker:true},null,2));
