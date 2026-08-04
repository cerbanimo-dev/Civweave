'use strict';
importScripts('/service-worker.js?v=1.0.4-instant-shell-r37');
const EXTENSION_VERSION='working-campus-additions-v156-r2';
const EXTENSION_CACHE='cwext-working-campus-additions-v156-r2';
const EXTENSION_FILES=[
  '/extensions/commonweave-additions-v156.css',
  '/extensions/commonweave-additions-v156.js',
  '/extensions/commonweave-secure-vault-v156.js',
  '/extensions/commonweave-domain-bridge-v156.js',
  '/extensions/commonweave-qr-v156.js',
  '/extensions/commonweave-mesh-tools-v156.js'
];
const BOUNDARY='/app/install-boundary-v146.js';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fetchRequired(url,{cache='reload'}={}){const response=await fetch(`${url}${url.includes('?')?'&':'?'}v=${EXTENSION_VERSION}`,{cache,headers:{'x-commonweave-package':'install'}});if(!response.ok)throw new Error(`Extension asset ${url} returned ${response.status}`);return response}
async function cacheExtensions(){const cache=await caches.open(EXTENSION_CACHE);await Promise.all(EXTENSION_FILES.map(async url=>cache.put(url,(await fetchRequired(url)).clone())));return true}
async function patchInstalledBoundary(){const fresh=await fetchRequired(BOUNDARY),deadline=Date.now()+20000;while(Date.now()<deadline){const names=(await caches.keys()).filter(name=>name.startsWith('commonweave-static-'));let patched=0;for(const name of names){const cache=await caches.open(name),existing=await cache.match(BOUNDARY,{ignoreSearch:true});if(existing){await cache.put(BOUNDARY,fresh.clone());patched++}}if(patched)return patched;await delay(50)}throw new Error('The base shell did not expose its install boundary in time for the additive layer.')}
async function extensionStatus(){const cache=await caches.open(EXTENSION_CACHE),keys=await cache.keys(),present=new Set(keys.map(request=>new URL(request.url).pathname)),missing=EXTENSION_FILES.filter(url=>!present.has(url));return{type:'COMMONWEAVE_ADDITIONS_STATUS',version:EXTENSION_VERSION,cache:EXTENSION_CACHE,ready:missing.length===0,assetCount:EXTENSION_FILES.length,missing}}
self.addEventListener('install',event=>event.waitUntil(Promise.all([cacheExtensions(),patchInstalledBoundary()])));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(names=>Promise.all(names.filter(name=>name.startsWith('cwext-')&&name!==EXTENSION_CACHE).map(name=>caches.delete(name))))));
self.addEventListener('message',event=>{if(event.data?.type==='GET_ADDITIONS_STATUS')event.waitUntil(extensionStatus().then(packet=>{event.ports?.[0]?.postMessage(packet);event.source?.postMessage?.(packet)}))});
self.addEventListener('fetch',event=>{const request=event.request;if(!['GET','HEAD'].includes(request.method))return;const url=new URL(request.url);if(url.origin!==self.location.origin||!url.pathname.startsWith('/extensions/'))return;event.respondWith((async()=>{const cache=await caches.open(EXTENSION_CACHE),cached=await cache.match(url.pathname,{ignoreSearch:true}),update=fetchRequired(url.pathname,{cache:'no-cache'}).then(async response=>{await cache.put(url.pathname,response.clone());return response}).catch(()=>null);if(cached){event.waitUntil(update);return request.method==='HEAD'?new Response(null,{status:cached.status,statusText:cached.statusText,headers:cached.headers}):cached}const response=await update;return response||(new Response('Commonweave additive tool is not installed.',{status:503,headers:{'content-type':'text/plain; charset=utf-8'}}))})())});
