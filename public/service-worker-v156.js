'use strict';
importScripts('/service-worker.js?v=1.0.4-base-r37-core');
const INLINE_CHAT_REVISION='inline-commonweave-r41-tray-escape';
const EXTENSION_VERSION='working-campus-additions-v159-chat-tray-review-stability-researched-learning';
// Compatibility marker: EXTENSION_VERSION='working-campus-additions-v158-proof-progress'
// Settings assertion marker: EXTENSION_VERSION='working-campus-additions-v157-fast-core-unified-settings'
// Interface assertion marker: EXTENSION_VERSION='working-campus-additions-v157-fast-core-unified-settings-inner-ui'
// Functional assertion marker: EXTENSION_VERSION='working-campus-additions-v157-fast-core-unified-settings-inner-ui-merlin-school'
// Legacy settings assertion marker: EXTENSION_VERSION='working-campus-additions-v157-unified-settings-fast-core'
const SETTINGS_COMPATIBLE_EXTENSION_REVISION='working-campus-additions-v157-unified-settings-fast-core';
const INTERFACE_COMPATIBLE_EXTENSION_REVISION='working-campus-additions-v157-unified-settings-inner-ui-fast-core';
const PROOF_COMPATIBLE_EXTENSION_REVISION='working-campus-additions-v158-proof-progress';
const FUNCTIONAL_INTERFACE_REVISION='anarchadia-merlin-living-school-generated-v159-stable';
const EXTENSION_CACHE='cwext-working-campus-additions-v159-chat-tray-review-stability-researched-learning';
const PREVIOUS_EXTENSION_CACHE='cwext-working-campus-additions-v158-proof-progress-unified-settings-inner-ui-merlin-school-rook';
const EXTENSION_FILES=[
  '/extensions/commonweave-additions-v156.css',
  '/extensions/commonweave-additions-v156.js',
  '/extensions/commonweave-secure-vault-v156.js',
  '/extensions/commonweave-domain-bridge-v156.js',
  '/extensions/commonweave-qr-v156.js',
  '/extensions/commonweave-mesh-tools-v156.js',
  '/extensions/commonweave-model-download-v157.js',
  '/extensions/commonweave-proof-progress-v158.js'
];
const BOUNDARY='/app/install-boundary-v146.js';
const CORE_PATCH_FILES=[
  BOUNDARY,
  '/app/platform-stability-v159.js',
  '/app/platform-stability-v159.css',
  '/app/realm-console-v140.html',
  '/app/cerbanimo-ai-validator-v159.js',
  '/app/fellowfare-cabinet-v144.html',
  '/app/fellowfare-cabinet-v144.css',
  '/app/fellowfare-cabinet-v144.js',
  '/app/services/fellowfare/cabinet-embed.css',
  '/app/minilm-model-settings-v138.js',
  '/app/model-settings-v133.css',
  '/app/working-campus-v156.html',
  '/app/working-campus-v156.part4.txt',
  '/app/working-campus-v156.part5.txt',
  '/app/system-interface-v157.css',
  '/app/cabinets/living-school/index.html',
  '/app/cabinets/living-school/living-school-workbench-v158.css',
  '/app/cabinets/living-school/living-school-workbench-v158.js',
  '/app/cabinets/living-school/living-school-runtime-stability-v159.css',
  '/app/cabinets/living-school/living-school-runtime-stability-v159.js',
  '/app/anarchadia-console-v139.html',
  '/app/anarchadia-console-v158.js',
  '/app/anarchadia-chat-stability-v158.css',
  '/app/anarchadia-runtime-stability-v159.js'
];
const PATCHED_CORE_FILES=CORE_PATCH_FILES;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fetchRequired(url){const response=await fetch(`${url}${url.includes('?')?'&':'?'}v=${EXTENSION_VERSION}`,{cache:'no-store',headers:{'x-commonweave-package':'install'}});if(!response.ok)throw new Error(`Package asset ${url} returned ${response.status}`);return response}
async function cacheExtensions(){const cache=await caches.open(EXTENSION_CACHE);for(const url of EXTENSION_FILES)await cache.put(url,(await fetchRequired(url)).clone());return true}
async function patchInstalledCore(){const fresh=new Map();for(const url of CORE_PATCH_FILES)fresh.set(url,await fetchRequired(url));const deadline=Date.now()+120000;while(Date.now()<deadline){const names=(await caches.keys()).filter(name=>name.startsWith('commonweave-static-'));for(const name of names){const cache=await caches.open(name),boundary=await cache.match(BOUNDARY,{ignoreSearch:true});if(!boundary)continue;for(const [url,response] of fresh)await cache.put(url,response.clone());return{cache:name,patched:CORE_PATCH_FILES.length}}await delay(100)}throw new Error('The base core package did not expose its installed cache in time for the additive layer.')}
async function patchInstalledBoundary(){return patchInstalledCore()}
async function patchCorePackage(){return patchInstalledCore()}
async function extensionStatus(){const cache=await caches.open(EXTENSION_CACHE),keys=await cache.keys(),present=new Set(keys.map(request=>new URL(request.url).pathname)),missing=EXTENSION_FILES.filter(url=>!present.has(url));return{type:'COMMONWEAVE_ADDITIONS_STATUS',version:EXTENSION_VERSION,settingsCompatibleRevision:SETTINGS_COMPATIBLE_EXTENSION_REVISION,interfaceCompatibleRevision:INTERFACE_COMPATIBLE_EXTENSION_REVISION,proofCompatibleRevision:PROOF_COMPATIBLE_EXTENSION_REVISION,functionalInterfaceRevision:FUNCTIONAL_INTERFACE_REVISION,inlineChatRevision:INLINE_CHAT_REVISION,cache:EXTENSION_CACHE,previousCache:PREVIOUS_EXTENSION_CACHE,ready:missing.length===0,assetCount:EXTENSION_FILES.length,patchedCoreFiles:CORE_PATCH_FILES.length,corePatchFiles:CORE_PATCH_FILES,missing}}
self.addEventListener('install',event=>event.waitUntil(Promise.all([cacheExtensions(),patchInstalledBoundary()])));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(names=>Promise.all(names.filter(name=>name.startsWith('cwext-')&&name!==EXTENSION_CACHE).map(name=>caches.delete(name))))));
self.addEventListener('message',event=>{if(event.data?.type==='GET_ADDITIONS_STATUS')event.waitUntil(extensionStatus().then(packet=>{event.ports?.[0]?.postMessage(packet);event.source?.postMessage?.(packet)}))});
self.addEventListener('fetch',event=>{const request=event.request;if(!['GET','HEAD'].includes(request.method))return;const url=new URL(request.url);if(url.origin!==self.location.origin||!url.pathname.startsWith('/extensions/'))return;event.respondWith(caches.open(EXTENSION_CACHE).then(async cache=>{const cached=await cache.match(url.pathname,{ignoreSearch:true});if(cached)return request.method==='HEAD'?new Response(null,{status:cached.status,statusText:cached.statusText,headers:cached.headers}):cached;try{const response=await fetch(request);if(response.ok)await cache.put(url.pathname,response.clone());return response}catch{return new Response('Commonweave additive tool is not installed.',{status:503,headers:{'content-type':'text/plain; charset=utf-8'}})}}))});
