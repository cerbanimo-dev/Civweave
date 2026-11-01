/**
 * Optional, read-only OpenSimulator region-module export client.
 * It is NOT the OpenSim grid/viewer protocol. An OpenSim operator must expose
 * the permission-filtered civweave.opensim-region-geometry.v1 JSON export on
 * the user's loopback interface, with explicit CORS for the Civweave origin.
 * Never send Guild credentials, model tokens, cookies or remote URLs to it.
 */
import {buildOpenSimGeometry} from './worldweaver-opensim-geometry-v1.mjs';

const MAX_JSON_BYTES=2_000_000;
export function normalizeOpenSimBridgeUrl(input){
 const raw=String(input||'').trim();
 if(!raw||raw.length>300)throw new TypeError('Enter a loopback OpenSim region-export URL.');
 let url;
 try{url=new URL(raw)}catch{throw new TypeError('Enter a valid OpenSim bridge URL.')}
 if(url.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(url.hostname))
   throw new TypeError('OpenSim bridge must be served on HTTP loopback, not a remote address.');
 if(url.username||url.password||url.search||url.hash)
   throw new TypeError('OpenSim bridge URL cannot include credentials, query tokens, or fragments.');
 if(!url.port||Number(url.port)<1024)throw new TypeError('Choose an explicit unprivileged loopback port.');
 return url.toString();
}
export function parseOpenSimRegion(input){
 if(!input||input.source!=='opensim-region-module')
   throw new TypeError('An authorized OpenSim region-module export is required, not a simulated scene.');
 const geometry=buildOpenSimGeometry(input);
 if(!geometry.faces.length)throw new TypeError('OpenSim export has no renderable geometry.');
 return geometry;
}
export async function connectOpenSimRegion(endpoint,{fetcher=fetch,timeoutMs=12000}={}){
 const url=normalizeOpenSimBridgeUrl(endpoint);
 const response=await fetcher(url,{method:'GET',headers:{Accept:'application/json'},
   credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
 if(!response.ok)throw new Error('OpenSim bridge returned HTTP '+response.status+'.');
 const size=Number(response.headers?.get?.('content-length')||0);
 if(size>MAX_JSON_BYTES)throw new Error('OpenSim region export is too large.');
 const body=await response.text();
 if(body.length>MAX_JSON_BYTES)throw new Error('OpenSim region export is too large.');
 let json;
 try{json=JSON.parse(body)}catch{throw new TypeError('OpenSim bridge did not return valid region JSON.')}
 return parseOpenSimRegion(json);
}
