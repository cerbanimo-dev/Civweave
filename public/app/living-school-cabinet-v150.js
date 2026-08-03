(()=>{
'use strict';
const PARTS=['/app/living-school-cabinet-v150.c0.b64','/app/living-school-cabinet-v150.c1.b64','/app/living-school-cabinet-v150.c2.b64'];
const fail=error=>{const node=document.querySelector('#ls-app');if(node)node.innerHTML=`<div class="ls-boot"><span class="ls-boot-acorn">❧</span><b>Living School could not open.</b><small>${String(error?.message||error)}</small></div>`;console.error(error)};
(async()=>{
  try{
    if(typeof DecompressionStream!=='function')throw new Error('This browser does not support the local cabinet decompressor.');
    const text=(await Promise.all(PARTS.map(async url=>{const response=await fetch(url,{cache:'force-cache'});if(!response.ok)throw new Error(`Missing cabinet runtime part: ${url}`);return response.text()}))).join('').replace(/\s+/g,'');
    const bytes=Uint8Array.from(atob(text),character=>character.charCodeAt(0));
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const source=await new Response(stream).text();
    const script=document.createElement('script');script.textContent=`${source}\n//# sourceURL=living-school-cabinet-v150.runtime.js`;document.head.append(script);
  }catch(error){fail(error)}
})();
})();
