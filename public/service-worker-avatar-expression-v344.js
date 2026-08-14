'use strict';
(()=>{
  const VERSION='avatar-expression-offline-v344-indexed-minilm';
  const CACHE=`civweave-avatar-expression-${VERSION}`;
  const PREFIX='civweave-avatar-expression-';
  const ATLAS='/app/assets/ai/chat/expressions/atlas-v344/';
  const ASSETS=[
    '/app/avatar-expression-director-v343.js',
    '/app/shared-chat-face-icons-v255.js',
    '/app/minilm-context-router-v344.js',
    '/app/models/all-minilm-l6-v2/adapter.js',
    '/app/models/all-minilm-l6-v2/worker.js',
    '/app/models/all-minilm-l6-v2/model-manifest.json',
    '/app/models/all-minilm-l6-v2/reflex-index.json',
    '/app/vendor/onnxruntime/ort.wasm.min.mjs',
    '/app/vendor/onnxruntime/ort-wasm-simd-threaded.mjs',
    '/app/vendor/onnxruntime/ort-wasm-simd-threaded.wasm',
    `${ATLAS}manifest.json`,
    ...['weaveling','moss','kamiya','rook','merlin'].flatMap(name=>[0,1,2,3].map(row=>`${ATLAS}${name}-row-${row}.json`))
  ];
  const KEYS=new Set(ASSETS);
  const key=pathname=>new Request(new URL(pathname,self.location.origin).href,{method:'GET'});
  const valid=(response,pathname)=>Boolean(response?.ok&&!(/text\/html/i.test(String(response.headers.get('content-type')||''))&&!/\.html$/i.test(pathname)));
  async function fresh(pathname){const response=await fetch(new Request(new URL(pathname,self.location.origin).href,{cache:'no-store',credentials:'same-origin',headers:{'x-civweave-package':'avatar-expression-v344'}}));if(!valid(response,pathname))throw new Error(`${pathname} unavailable`);return response}
  async function install(){const cache=await caches.open(CACHE),results=await Promise.allSettled(ASSETS.map(async pathname=>{const response=await fresh(pathname);await cache.put(key(pathname),response.clone());return pathname}));return{loaded:results.filter(r=>r.status==='fulfilled').length,total:ASSETS.length,failed:results.flatMap((r,i)=>r.status==='rejected'?[ASSETS[i]]:[])}}
  async function cleanup(){const names=await caches.keys();await Promise.all(names.map(name=>name.startsWith(PREFIX)&&name!==CACHE?caches.delete(name):false))}
  self.addEventListener('install',event=>event.waitUntil(install().catch(()=>({loaded:0,total:ASSETS.length}))));
  self.addEventListener('activate',event=>event.waitUntil(cleanup()));
  self.addEventListener('fetch',event=>{
    const request=event.request,url=new URL(request.url);if(!['GET','HEAD'].includes(request.method)||url.origin!==self.location.origin||!KEYS.has(url.pathname))return;
    event.stopImmediatePropagation();
    event.respondWith((async()=>{const cache=await caches.open(CACHE),cached=await cache.match(key(url.pathname),{ignoreSearch:true}),code=/\.(?:m?js|html)$/i.test(url.pathname);if(code){try{const response=await fresh(url.pathname);if(request.method==='GET')await cache.put(key(url.pathname),response.clone());return request.method==='HEAD'?new Response(null,{status:response.status,statusText:response.statusText,headers:response.headers}):response}catch{}}
      if(valid(cached,url.pathname))return request.method==='HEAD'?new Response(null,{status:cached.status,statusText:cached.statusText,headers:cached.headers}):cached;
      try{const response=await fresh(url.pathname);if(request.method==='GET')await cache.put(key(url.pathname),response.clone());return request.method==='HEAD'?new Response(null,{status:response.status,statusText:response.statusText,headers:response.headers}):response}catch{return new Response(`Avatar expression asset unavailable offline: ${url.pathname}`,{status:503,headers:{'content-type':'text/plain; charset=utf-8'}})}})());
  });
  self.CivweaveAvatarExpressionOfflineV344=Object.freeze({version:VERSION,cache:CACHE,assets:ASSETS.slice(),modelCache:'civweave-model-1.0.7-minilm-fixed-ort-r1',policy:'code-network-first-assets-cache-first',alreadyDownloadedMiniLMSurvivesOffline:true,coordinateRunRleRetired:true});
})();