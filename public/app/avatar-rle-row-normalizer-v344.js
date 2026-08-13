(()=>{'use strict';
const VERSION='avatar-rle-row-normalizer-v344';
if(globalThis.CivweaveAvatarRleRowNormalizerV344?.version===VERSION)return;
const nativeFetch=globalThis.fetch?.bind(globalThis),ROOT='/app/assets/ai/chat/expressions/rle-v315/';
if(!nativeFetch)return;
function target(input){try{const raw=typeof input==='string'?input:input?.url||'',u=new URL(raw,location.href);return u.origin===location.origin&&u.pathname.startsWith(ROOT)&&/-row-[0-3]\.json$/i.test(u.pathname)}catch{return false}}
async function normalized(response){if(!response?.ok)return response;const payload=await response.clone().json().catch(()=>null);if(!payload||payload.coordinateSpace==='atlas-global-v344'||!Number.isInteger(payload.row)||!Array.isArray(payload.runs))return response;const dy=payload.row*27,runs=payload.runs.slice();for(let i=0;i+3<runs.length;i+=4)runs[i+2]+=dy;const headers=new Headers(response.headers);headers.set('content-type','application/json; charset=utf-8');headers.set('x-civweave-avatar-rle','atlas-global-v344');headers.delete('content-length');return new Response(JSON.stringify({...payload,runs,coordinateSpace:'atlas-global-v344'}),{status:response.status,statusText:response.statusText,headers})}
globalThis.fetch=async function(input,init){const response=await nativeFetch(input,init);return target(input)?normalized(response):response};
globalThis.CivweaveAvatarRleRowNormalizerV344=Object.freeze({version:VERSION,root:ROOT,rowHeight:27,sourceCoordinateSpace:'row-local',outputCoordinateSpace:'atlas-global-v344'});
try{dispatchEvent(new CustomEvent('civweave:avatar-rle-normalizer-ready',{detail:{version:VERSION}}))}catch{}
})();
