'use strict';

const VERSION='1.0.0-browser-pack-import-worker-v1';
const ALLOWED_CACHES=new Set(['civweave-model-generative-v266','civweave-specialized-model-packs-v1']);
const PROGRESS_BYTES=8*1024*1024;
const PROGRESS_MS=120;

function clean(value,max=500){return String(value??'').slice(0,max)}
function safeUrl(value){
  const url=new URL(String(value||''));
  if(url.protocol!=='https:'&&url.protocol!=='http:')throw new Error('Model import URL must use HTTP(S).');
  return url.href;
}
function guessType(path){return /\.json$/i.test(path)?'application/json':/\.txt$|\.jinja$/i.test(path)?'text/plain; charset=utf-8':'application/octet-stream'}
function send(type,detail={}){try{postMessage({type,version:VERSION,...detail})}catch{}}

async function importFile(packet){
  if(!('caches'in self))throw new Error('Cache Storage is unavailable in the import worker.');
  const cacheName=clean(packet.cacheName,160);
  if(!ALLOWED_CACHES.has(cacheName))throw new Error('The requested model cache is not allowed.');
  const file=packet.file;
  if(!(file instanceof Blob))throw new Error('No browser-downloaded model file was provided to the import worker.');
  const url=safeUrl(packet.url),total=Number(file.size||0),minBytes=Math.max(0,Number(packet.minBytes||0));
  if(minBytes&&total<minBytes*.97)throw new Error(`The selected model file is incomplete (${total} bytes).`);
  const headers=new Headers({
    'content-type':file.type||packet.contentType||guessType(packet.path),
    'content-length':String(total),
    'x-civweave-imported':'browser-download-worker-v1'
  });
  const cache=await caches.open(cacheName);
  let copied=0,lastBytes=0,lastAt=0;
  const notify=force=>{
    const at=Date.now();
    if(!force&&copied-lastBytes<PROGRESS_BYTES&&at-lastAt<PROGRESS_MS)return;
    lastBytes=copied;lastAt=at;send('progress',{id:packet.id,copied,total,force:Boolean(force)});
  };
  if(!file.stream||typeof ReadableStream==='undefined'){
    await cache.put(url,new Response(file,{status:200,headers}));
    copied=total;notify(true);return{copied,total};
  }
  const reader=file.stream().getReader();
  const stream=new ReadableStream({
    async pull(controller){
      const result=await reader.read();
      if(result.done){notify(true);controller.close();return}
      copied+=Number(result.value?.byteLength||0);notify(false);controller.enqueue(result.value);
    },
    cancel(reason){try{return reader.cancel(reason)}catch{return undefined}}
  });
  await cache.put(url,new Response(stream,{status:200,headers}));
  copied=total||copied;notify(true);return{copied,total};
}

self.addEventListener('message',event=>{
  const packet=event.data||{};
  if(packet.type!=='CIVWEAVE_BROWSER_PACK_IMPORT_FILE_V1')return;
  Promise.resolve().then(()=>importFile(packet)).then(result=>send('done',{id:packet.id,...result}),error=>send('error',{id:packet.id,message:clean(error?.message||error,1000)}));
});
