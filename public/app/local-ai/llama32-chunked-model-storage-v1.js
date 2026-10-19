// Browser-local, resumable external weight import for the Llama 3.2 3B trial.
// CacheStorage holds independently committed 8 MiB pieces instead of a single
// 2 GiB Cache.put() response, which can cause mobile renderer OOM/crashes.
// Source files remain in browser Downloads; no upload or redownload occurs.
export const CHUNK_BYTES=8*1024*1024;
export const CHUNK_SCHEMA='civweave.llama32.cache-chunks.v1';
const MANIFEST_PARAM='cw-llama32-chunk-manifest';
const PART_PARAM='cw-llama32-chunk';
const integer=value=>Number.isSafeInteger(value)&&value>0;
export const chunkManifestUrl=url=>{const x=new URL(url);x.searchParams.set(MANIFEST_PARAM,'1');return x.href};
export const chunkPartUrl=(url,index)=>{const x=new URL(url);x.searchParams.set(PART_PARAM,String(index));return x.href};
export const chunkCount=size=>Math.ceil(size/CHUNK_BYTES);
const contentSize=response=>Number(response?.headers?.get('content-length')||0);
function validManifest(row,size){
  return Boolean(row&&row.schema===CHUNK_SCHEMA&&integer(row.bytes)&&(!size||row.bytes===size)
    &&row.chunkBytes===CHUNK_BYTES&&row.chunks===chunkCount(row.bytes));
}
async function readManifest(cache,url,expectedBytes=0){
  const result=await cache.match(chunkManifestUrl(url));
  if(!result?.ok)return null;
  let value=null;try{value=await result.json()}catch{return null}
  return validManifest(value,expectedBytes)?value:null;
}
async function hasPart(cache,url,index,size){
  const response=await cache.match(chunkPartUrl(url,index));
  return Boolean(response?.ok&&contentSize(response)===size);
}
// Inspect every fragment: Cache Storage may evict individual keys.
// A manifest alone is never proof that the complete model is present.
export async function chunkedStatus(cache,url,expectedBytes=0){
  const meta=await readManifest(cache,url,expectedBytes);
  if(!meta)return{available:false,bytes:0,reason:'chunk-manifest-missing'};
  for(let i=0;i<meta.chunks;i++){
    const size=Math.min(CHUNK_BYTES,meta.bytes-i*CHUNK_BYTES);
    if(!await hasPart(cache,url,i,size))return{available:false,bytes:0,reason:'chunk-missing',index:i};
  }
  return{available:true,bytes:meta.bytes,chunks:meta.chunks};
}
export async function importChunkedFile(cache,url,file,{onProgress=()=>{},signal}={}){
  if(!file||!integer(file.size))throw new Error('Invalid local model file.');
  const bytes=file.size,chunks=chunkCount(bytes);
  // Remove any old commit marker before importing, but retain verified pieces.
  await cache.delete(chunkManifestUrl(url));
  for(let i=0;i<chunks;i++){
    if(signal?.aborted)throw new DOMException('Import aborted','AbortError');
    const begin=i*CHUNK_BYTES,size=Math.min(CHUNK_BYTES,bytes-begin);
    if(!await hasPart(cache,url,i,size)){
      const slice=file.slice(begin,begin+size);
      await cache.put(chunkPartUrl(url,i),new Response(slice,{
        headers:{'content-type':'application/octet-stream','content-length':String(size)}
      }));
    }
    onProgress({bytes:begin+size,totalBytes:bytes,chunk:i+1,chunks});
  }
  // This marker is last: crashed imports can restart from committed chunks.
  const meta={schema:CHUNK_SCHEMA,bytes,chunks,chunkBytes:CHUNK_BYTES,createdAt:new Date().toISOString()};
  await cache.put(chunkManifestUrl(url),new Response(JSON.stringify(meta),{
    headers:{'content-type':'application/json'}
  }));
  const check=await chunkedStatus(cache,url,bytes);
  if(!check.available)throw Error('A required model fragment was evicted before the import completed: '+check.reason);
  return check;
}
export async function chunkedResponse(cache,url,expectedBytes=0){
  const meta=await readManifest(cache,url,expectedBytes);
  if(!meta)return null;
  let next=0,reader=null;
  const stream=new ReadableStream({
    async pull(controller){
      try{
        while(true){
          if(reader){
            const event=await reader.read();
            if(!event.done){controller.enqueue(event.value);return}
            reader.releaseLock();reader=null;
          }
          if(next===meta.chunks){controller.close();return}
          const n=next++,expected=Math.min(CHUNK_BYTES,meta.bytes-(n*CHUNK_BYTES));
          const part=await cache.match(chunkPartUrl(url,n));
          if(!part?.ok||contentSize(part)!==expected||!part.body)
            throw Error('Model fragment '+(n+1)+'/'+meta.chunks+' missing or wrong length. Reimport that weight file to restore only missing fragments.');
          reader=part.body.getReader();
        }
      }catch(error){controller.error(error)}
    },
    async cancel(reason){try{await reader?.cancel(reason)}catch{}}
  });
  return new Response(stream,{status:200,headers:{
    'content-type':'application/octet-stream','content-length':String(meta.bytes),
    'x-civweave-chunked-model':'1'
  }});
}
