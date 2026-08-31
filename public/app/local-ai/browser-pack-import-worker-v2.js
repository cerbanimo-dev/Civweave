'use strict';

const VERSION='2.0.1-browser-pack-import-worker-v2-opfs-chunked';
const ALLOWED_CACHES=new Set(['civweave-model-generative-v266','civweave-specialized-model-packs-v1']);
const OPFS_ROOT='civweave-models-v1';
const CHUNK_BYTES=8*1024*1024;
const PROGRESS_BYTES=16*1024*1024;
const PROGRESS_MS=160;

function clean(value,max=500){return String(value??'').slice(0,max)}
function safeUrl(value){const url=new URL(String(value||''));if(url.protocol!=='https:'&&url.protocol!=='http:')throw new Error('Model import URL must use HTTP(S).');return url.href}
function safePart(value,max=180){const input=String(value??'').split('/').pop()||'model-file';return input.replace(/[^A-Za-z0-9._-]+/g,'_').replace(/^\.+/,'_').slice(0,max)||'model-file'}
function guessType(path){return /\.json$/i.test(path)?'application/json':/\.txt$|\.jinja$/i.test(path)?'text/plain; charset=utf-8':'application/octet-stream'}
function send(type,detail={}){try{postMessage({type,version:VERSION,...detail})}catch{}}
function notifyFactory(packet,total){let copied=0,lastBytes=0,lastAt=0;return{add(bytes){copied+=Math.max(0,Number(bytes||0));const at=Date.now();if(copied-lastBytes>=PROGRESS_BYTES||at-lastAt>=PROGRESS_MS){lastBytes=copied;lastAt=at;send('progress',{id:packet.id,copied,total,force:false,backend:packet.storageBackend||'cache'})}return copied},finish(value=total||copied){copied=Math.max(copied,Number(value||0));send('progress',{id:packet.id,copied,total:total||copied,force:true,backend:packet.storageBackend||'cache'});return copied},copied(){return copied}}}
async function opfsFileHandle(packet,{create=true}={}){if(!self.navigator?.storage?.getDirectory)throw new Error('Origin-private file storage is unavailable in this browser.');const modelId=safePart(packet.componentId||packet.modelId||'local-model'),fileName=safePart(packet.path||packet.basename||'model-file'),root=await self.navigator.storage.getDirectory(),store=await root.getDirectoryHandle(OPFS_ROOT,{create}),modelDir=await store.getDirectoryHandle(modelId,{create});return modelDir.getFileHandle(fileName,{create})}
async function writeOpfs(packet,file){
  const total=Number(file.size||0),progress=notifyFactory({...packet,storageBackend:'opfs'},total),handle=await opfsFileHandle(packet,{create:true});
  if(typeof handle.createSyncAccessHandle==='function'){
    const access=await handle.createSyncAccessHandle();
    try{
      access.truncate(0);let offset=0;
      while(offset<total){
        const start=offset,end=Math.min(total,start+CHUNK_BYTES),chunk=new Uint8Array(await file.slice(start,end).arrayBuffer());let at=0;
        while(at<chunk.byteLength){const written=Number(access.write(chunk.subarray(at),{at:start+at})||0);if(written<=0)throw new Error('Origin-private model storage stopped accepting data.');at+=written}
        offset=end;progress.add(end-start);
      }
      access.flush();const size=Number(access.getSize?.()||offset),copied=progress.finish(size);if(total&&size<total)throw new Error(`Origin-private model import stopped early (${size}/${total} bytes).`);
      return{copied,total,backend:'opfs',modelId:safePart(packet.componentId||packet.modelId||'local-model'),fileName:safePart(packet.path||packet.basename||'model-file'),chunkBytes:CHUNK_BYTES,syncAccess:true};
    }finally{try{access.close()}catch{}}
  }
  const writable=await handle.createWritable({keepExistingData:false});
  try{
    let offset=0;
    while(offset<total){const start=offset,end=Math.min(total,start+CHUNK_BYTES),chunk=await file.slice(start,end).arrayBuffer();await writable.write({type:'write',position:start,data:chunk});offset=end;progress.add(end-start)}
    await writable.close();const copied=progress.finish(offset);if(total&&copied<total)throw new Error(`Origin-private model import stopped early (${copied}/${total} bytes).`);
    return{copied,total,backend:'opfs',modelId:safePart(packet.componentId||packet.modelId||'local-model'),fileName:safePart(packet.path||packet.basename||'model-file'),chunkBytes:CHUNK_BYTES,syncAccess:false};
  }catch(error){try{await writable.abort?.()}catch{}throw error}
}
async function writeCache(packet,file){if(!('caches'in self))throw new Error('Cache Storage is unavailable in the import worker.');const cacheName=clean(packet.cacheName,160);if(!ALLOWED_CACHES.has(cacheName))throw new Error('The requested model cache is not allowed.');const url=safeUrl(packet.url),total=Number(file.size||0),progress=notifyFactory({...packet,storageBackend:'cache'},total),headers=new Headers({'content-type':file.type||packet.contentType||guessType(packet.path),'content-length':String(total),'x-civweave-imported':'browser-download-worker-v2'}),cache=await caches.open(cacheName);if(!file.stream||typeof ReadableStream==='undefined'){await cache.put(url,new Response(file,{status:200,headers}));progress.finish(total);return{copied:total,total,backend:'cache'}}const reader=file.stream().getReader(),stream=new ReadableStream({async pull(controller){const result=await reader.read();if(result.done){controller.close();return}progress.add(Number(result.value?.byteLength||0));controller.enqueue(result.value)},cancel(reason){try{return reader.cancel(reason)}catch{return undefined}}});await cache.put(url,new Response(stream,{status:200,headers}));const copied=progress.finish(total||progress.copied());return{copied,total,backend:'cache'}}
async function importFile(packet){const file=packet.file;if(!(file instanceof Blob))throw new Error('No browser-downloaded model file was provided to the import worker.');const total=Number(file.size||0),minBytes=Math.max(0,Number(packet.minBytes||0));if(minBytes&&total<minBytes*.97)throw new Error(`The selected model file is incomplete (${total} bytes).`);return packet.storageBackend==='opfs'?writeOpfs(packet,file):writeCache(packet,file)}
self.addEventListener('message',event=>{const packet=event.data||{};if(packet.type!=='CIVWEAVE_BROWSER_PACK_IMPORT_FILE_V2')return;Promise.resolve().then(()=>importFile(packet)).then(result=>send('done',{id:packet.id,...result}),error=>send('error',{id:packet.id,message:clean(error?.message||error,1000),backend:packet.storageBackend||'cache'}))});
