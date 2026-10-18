#!/usr/bin/env node
// Checks HTTP responses actually delivered by Cloudflare Pages, not merely the
// build folder. Read only the first bytes of each binary; never download weights.
const ORIGIN='https://civweave-staging.pages.dev';
const root=new URL(ORIGIN);
const stamp=Date.now().toString(36);
const get=path=>new URL(path+'?cw-wasm-verify='+stamp,root).href;
const manifestURL=get('/app/vendor/litert-lm/stage-manifest.json');
const head=async response=>{
  const reader=response.body?.getReader();
  if(!reader)return[];
  const bytes=[];
  try{
    while(bytes.length<8){
      const chunk=await reader.read();
      if(chunk.done)break;
      for(const v of chunk.value||[]){bytes.push(v);if(bytes.length===8)break}
    }
  }finally{try{await reader.cancel()}catch{}}
  return bytes;
};
const magic=bytes=>bytes.length>=4&&bytes[0]===0&&bytes[1]===97&&bytes[2]===115&&bytes[3]===109;
const printBytes=b=>b.map(x=>x.toString(16).padStart(2,'0')).join(' ');
async function main(){
  const raw=await fetch(manifestURL,{headers:{'Cache-Control':'no-cache'}});
  const type=raw.headers.get('content-type')||'';
  if(!raw.ok||!type.includes('json'))throw Error('Published staging LiteRT manifest missing: '+manifestURL+' · HTTP '+raw.status+' · '+type);
  const manifest=await raw.json();
  const names=(manifest.wasmFiles||[]).filter(name=>/\.wasm$/i.test(name));
  if(manifest.coreVersion!=='0.17.1'||!names.length)throw Error('Unexpected manifest version or empty binary inventory: '+JSON.stringify({version:manifest.coreVersion,wasm:names}));
  let failures=0;
  console.log('Published LiteRT runtime version '+manifest.coreVersion+' · '+names.length+' declared WASM binaries · '+(manifest.omittedFiles||[]).length+' omitted fallback files.');
  for(const name of names){
    const url=get('/app/vendor/litert-lm/'+name);
    const response=await fetch(url,{headers:{Range:'bytes=0-7','Cache-Control':'no-cache'}});
    const mime=response.headers.get('content-type')||'';
    const bytes=response.ok?await head(response):[];
    const ok=response.ok&&magic(bytes);
    console.log((ok?'PASS':'FAIL')+' published WASM '+name+' · HTTP '+response.status+' · '+mime+' · magic '+printBytes(bytes));
    if(!ok)failures++;
  }
  for(const row of manifest.omittedFiles||[]){
    if(!/\.wasm$/i.test(row.path))continue;
    const url=get('/app/vendor/litert-lm/'+row.path);
    const response=await fetch(url,{headers:{Range:'bytes=0-7','Cache-Control':'no-cache'}});
    const bytes=response.ok?await head(response):[];
    const valid=response.ok&&magic(bytes)&&/application\/wasm/i.test(response.headers.get('content-type')||'');
    console.log((valid?'PASS':'FAIL')+' reassembled fallback '+row.path+' · HTTP '+response.status+' · '+(response.headers.get('content-type')||'')+' · magic '+printBytes(bytes)+' · parts '+(row.parts||[]).length+' · bytes '+row.bytes);
    if(!valid||!Array.isArray(row.parts)||!row.parts.length)failures++;
  }
  // These aliases are not part of LiteRT's manifest. Emscripten's generated
  // glue fetches the .wasm name relative to its execution context, which is
  // /app/local-ai/ in a classic worker and can be /app/ for shell scripts.
  for(const prefix of ['/app/local-ai/','/app/']){
    for(const basename of [
      'litertlm_wasm_internal.wasm',
      'litertlm_wasm_compat_internal.wasm',
      'litertlm_wasm_asyncify_internal.wasm',
      'litertlm_wasm_compat_asyncify_internal.wasm'
    ]){
      const response=await fetch(get(prefix+basename),{headers:{Range:'bytes=0-7','Cache-Control':'no-cache'}});
      const mime=response.headers.get('content-type')||'';
      const bytes=response.ok?await head(response):[];
      const valid=response.ok&&magic(bytes)&&/application\/wasm/i.test(mime);
      console.log((valid?'PASS':'FAIL')+' LiteRT worker-relative alias '+prefix+basename+' · HTTP '+response.status+' · '+mime+' · magic '+printBytes(bytes)+' · resolved '+response.url);
      if(!valid)failures++;
    }
  }
  if(failures)throw Error(failures+' published LiteRT WASM assets (including reconstructed Asyncify fallbacks) are invalid.');
}
main().catch(error=>{console.error('STAGING_LITERT_WASM_ASSET_FAILURE: '+String(error?.stack||error));process.exitCode=1});
