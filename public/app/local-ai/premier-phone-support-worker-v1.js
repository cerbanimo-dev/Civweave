'use strict';

const VERSION='1.1.0-premier-phone-support-worker-v1-native-large-cache';
const DEFAULT_CACHE='civweave-specialized-model-packs-v1';
const NATIVE_CACHE_THRESHOLD=32*1024*1024;
const HEARTBEAT_MS=5000;

function post(type,detail={}){try{self.postMessage({type,version:VERSION,...detail})}catch{}}
function safeBytes(value){return Math.max(0,Number(value)||0)}
async function existing(cache,url,minBytes){
  const response=await cache.match(url);
  if(!response?.ok)return null;
  const type=String(response.headers.get('content-type')||'').toLowerCase();
  if(type.includes('text/html')){await cache.delete(url);return null}
  const bytes=safeBytes(response.headers.get('content-length'));
  if(bytes&&bytes<minBytes){await cache.delete(url);return null}
  return{response,bytes};
}
async function nativeCacheLarge(cache,url,response,component,path,index,totalArtifacts,total,minBytes){
  post('progress',{componentId:component.id,label:component.label,artifact:path,index,totalArtifacts,loaded:0,total:0,expectedTotal:total,indeterminate:true,storageBackend:'cache-storage-native'});
  const heartbeat=setInterval(()=>post('progress',{componentId:component.id,label:component.label,artifact:path,index,totalArtifacts,loaded:0,total:0,expectedTotal:total,indeterminate:true,storageBackend:'cache-storage-native'}),HEARTBEAT_MS);
  try{await cache.put(url,response)}finally{clearInterval(heartbeat)}
  const stored=await existing(cache,url,minBytes);
  if(!stored)throw new Error(`${component.label||component.id} · ${path} finished transferring but was not readable from Civweave internal storage.`);
  const bytes=stored.bytes||total;
  post('progress',{componentId:component.id,label:component.label,artifact:path,index,totalArtifacts,loaded:bytes,total:bytes,storageBackend:'cache-storage-native'});
  return bytes;
}
async function cacheArtifact(cache,component,artifact,index,totalArtifacts){
  const url=String(artifact?.url||'');
  const path=String(artifact?.path||'asset');
  const minBytes=Math.max(1,safeBytes(artifact?.minBytes));
  const expected=Math.max(minBytes,safeBytes(artifact?.sizeBytes));
  if(!url)throw new Error(`${component.label||component.id} · ${path} has no download URL.`);
  const cached=await existing(cache,url,minBytes);
  if(cached){
    post('progress',{componentId:component.id,label:component.label,artifact:path,index,totalArtifacts,loaded:cached.bytes||expected,total:expected,cached:true});
    return cached.bytes||expected;
  }
  const response=await fetch(url,{cache:'no-store',redirect:'follow'});
  if(!response.ok)throw new Error(`${component.label||component.id} · ${path} returned HTTP ${response.status}.`);
  const type=String(response.headers.get('content-type')||'').toLowerCase();
  if(type.includes('text/html'))throw new Error(`${component.label||component.id} · ${path} returned HTML instead of model data.`);
  const declared=safeBytes(response.headers.get('content-length'));
  if(declared&&declared<minBytes)throw new Error(`${component.label||component.id} · ${path} is smaller than its model manifest.`);
  const total=declared||expected;
  if(total>=NATIVE_CACHE_THRESHOLD)return nativeCacheLarge(cache,url,response,component,path,index,totalArtifacts,total,minBytes);
  if(!response.body?.getReader){
    await cache.put(url,response);
    post('progress',{componentId:component.id,label:component.label,artifact:path,index,totalArtifacts,loaded:total,total});
    return total;
  }
  const reader=response.body.getReader();
  let loaded=0,lastReport=0;
  const body=new ReadableStream({
    async pull(controller){
      const part=await reader.read();
      if(part.done){controller.close();return}
      const chunk=part.value;
      loaded+=chunk?.byteLength||0;
      if(loaded-lastReport>=4*1024*1024||loaded===total){
        lastReport=loaded;
        post('progress',{componentId:component.id,label:component.label,artifact:path,index,totalArtifacts,loaded,total});
      }
      controller.enqueue(chunk);
    },
    cancel(reason){try{reader.cancel(reason)}catch{}}
  });
  await cache.put(url,new Response(body,{status:response.status,statusText:response.statusText,headers:response.headers}));
  if(loaded<minBytes)throw new Error(`${component.label||component.id} · ${path} ended before its minimum model size.`);
  post('progress',{componentId:component.id,label:component.label,artifact:path,index,totalArtifacts,loaded:loaded||total,total});
  return loaded||total;
}
async function install(packet){
  const component=packet?.component||{};
  const artifacts=Array.isArray(component.artifacts)?component.artifacts:[];
  if(!component.id||!artifacts.length)throw new Error('Support component manifest is incomplete.');
  const cache=await caches.open(String(packet.cacheName||DEFAULT_CACHE));
  let completed=0;
  post('started',{componentId:component.id,label:component.label,totalArtifacts:artifacts.length});
  for(let index=0;index<artifacts.length;index++)completed+=await cacheArtifact(cache,component,artifacts[index],index+1,artifacts.length);
  post('complete',{componentId:component.id,label:component.label,bytes:completed,totalArtifacts:artifacts.length});
}
self.addEventListener('message',event=>{
  const packet=event.data||{};
  if(packet.type!=='install-support-component')return;
  void install(packet).catch(error=>post('error',{componentId:packet?.component?.id||'',label:packet?.component?.label||'',message:String(error?.message||error)}));
});

self.CivweavePremierPhoneSupportWorkerV1=Object.freeze({version:VERSION,cache:DEFAULT_CACHE,workerOnly:true,mainThreadLargeCachePut:false,sequentialArtifacts:true,nativeLargeCachePut:true,nativeLargeCacheThreshold:NATIVE_CACHE_THRESHOLD,largeProgressIndeterminate:true});
