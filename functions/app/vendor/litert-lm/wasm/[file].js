// Staging LiteRT-LM fallback WASM asset bridge.
// Cloudflare Pages' per-static-file limit prevents direct publication of
// Asyncify WebAssembly binaries. The staging builder publishes bounded parts;
// this route streams their exact concatenation as application/wasm without
// buffering the entire runtime binary in memory.
const PREFIX='/app/vendor/litert-lm/';
const NAMES=new Set([
  'litertlm_wasm_asyncify_internal.wasm',
  'litertlm_wasm_compat_asyncify_internal.wasm'
]);
const isBinaryResponse=response=>Boolean(response?.ok)&&!/(?:text\/html|application\/json)/i.test(String(response.headers.get('content-type')||''));
function safeUrl(request,pathname){const url=new URL(request.url);url.pathname=pathname;url.search='';return url.toString()}
async function serveFallback({request,env,params,next}){
  const name=String(params?.file||'');
  if(!NAMES.has(name))return next();
  if(!env?.ASSETS?.fetch)return new Response('LiteRT static asset binding unavailable.',{status:503});
  const manifestResponse=await env.ASSETS.fetch(new Request(safeUrl(request,PREFIX+'stage-manifest.json')));
  if(!manifestResponse.ok||!/(?:json)/i.test(manifestResponse.headers.get('content-type')||''))
    return new Response('LiteRT staging manifest unavailable.',{status:503});
  const manifest=await manifestResponse.json();
  const entry=(manifest.omittedFiles||[]).find(row=>row.path==='wasm/'+name);
  const parts=entry?.parts||[],total=Number(entry?.bytes)||0;
  if(!parts.length||total<=0||parts.some(path=>!/^wasm\/litertlm_wasm_(?:compat_)?asyncify_internal\.wasm\.part\d+$/.test(path)))
    return new Response('LiteRT WASM fallback chunks are absent or invalid.',{status:503,headers:{'content-type':'text/plain'}});
  // Validate every bounded chunk before returning 200. A missing Pages asset
  // could otherwise be an HTML SPA fallback, corrupting the WASM stream.
  const responses=[];
  for(const part of parts){
    const response=await env.ASSETS.fetch(new Request(safeUrl(request,PREFIX+part)));
    if(!isBinaryResponse(response)){
      for(const row of responses)try{await row.body?.cancel?.()}catch{}
      return new Response('Missing LiteRT WASM chunk: '+part,{status:503,headers:{'content-type':'text/plain'}});
    }
    responses.push(response);
  }
  const readers=responses.map(response=>response.body.getReader());
  let index=0,used=0;
  const body=new ReadableStream({
    async pull(controller){
      try{
        while(index<readers.length){
          const {done,value}=await readers[index].read();
          if(done){index++;continue}
          used+=value.byteLength;controller.enqueue(value);return;
        }
        if(used!==total)throw new Error('LiteRT WASM fallback length mismatch: '+used+' vs '+total);
        controller.close();
      }catch(error){controller.error(error)}
    },
    async cancel(reason){for(const reader of readers)try{await reader.cancel(reason)}catch{}}
  });
  const headers=new Headers({
    'content-type':'application/wasm',
    'content-length':String(total),
    'cache-control':'no-store',
    'x-civweave-litert-wasm':'reassembled-chunks'
  });
  if(request.method==='HEAD'){for(const r of readers)try{await r.cancel()}catch{};return new Response(null,{status:200,headers})}
  return new Response(body,{status:200,headers});
}
export const onRequestGet=serveFallback;
export const onRequestHead=serveFallback;
